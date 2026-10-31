import {syncPortalWalledGarden} from './portal-walled-garden-sync';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { resolveConnection } from './connections';
import { configuredHotspotSites, effectiveHotspotCampaigns, hotspotClient, hotspotPortalReady, readHotspotWlans } from './campaign-hotspot';
import { hotspotOwnershipKey, parseHotspotOwnership, reconcileGuestPolicy } from './campaign-hotspot-policy';

const OWNERSHIP_PREFIX = 'campaignHotspot:owned:';
const LOCK_KEY = 'campaign-hotspot:lock';
export const CAMPAIGN_HOTSPOT_STATUS_KEY = 'campaign-hotspot:status';
const LEASE_MS = 60000;
const RENEW_LEASE = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end";
const RELEASE_LEASE = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
/** All controller writes occur inside a Redis lease and are restricted to owned is_guest fields and explicit portal preauthorization IPs. */
export async function runCampaignHotspotTick(): Promise<void> {
  if (process.env.CAMPAIGN_HOTSPOT_ENABLED !== 'true' || process.env.APP_SERVER_MODE !== 'backend') return;
  const owner = randomUUID();
  let lease = false;
  let renewal: ReturnType<typeof setInterval> | undefined;
  let lostLease = false;
  const assertLease = async () => {
    if (lostLease || Number(await redis.eval(RENEW_LEASE, 1, LOCK_KEY, owner, LEASE_MS)) !== 1) {
      lostLease = true; throw new Error('Campaign hotspot lease lost');
    }
  };
  const heartbeat = async (status: string, extra: Record<string, unknown> = {}) => {
    await assertLease();
    await redis.set(CAMPAIGN_HOTSPOT_STATUS_KEY, JSON.stringify({ enabled: true, status, lastRunAt: new Date().toISOString(), ...extra }), 'EX', 120);
  };
  try {
    lease = (await redis.set(LOCK_KEY, owner, 'PX', LEASE_MS, 'NX')) === 'OK';
    if (!lease) return;
    renewal = setInterval(() => { void assertLease().catch(() => { lostLease = true; }); }, 15000);
    renewal.unref?.();
    const [campaigns, records] = await Promise.all([
      effectiveHotspotCampaigns(), prisma.systemSetting.findMany({ where: { key: { startsWith: OWNERSHIP_PREFIX } } }),
    ]);
    const states = records.map(record => {
      const state = parseHotspotOwnership(record.value);
      if (!state) throw new Error('Invalid campaign hotspot ownership state');
      return { key: record.key, state };
    });
    const owned = states.filter(record => record.state.wlans.length > 0);
    if (!campaigns.length && !owned.length) { await heartbeat('idle', { campaigns: 0, ownedWlans: 0 }); return; }
    const connection = await resolveConnection('UNIFI');
    const sites = configuredHotspotSites(connection);
    let blockedOwnership = 0;
    for (const record of owned) {
      if (record.state.connectionId !== connection.id || !sites.includes(record.state.site)) blockedOwnership++;
    }
    let managedSites = 0;
    let ambiguousWlans = 0;
    let unreadySites = 0;
    let portalDnsFailures = 0;
    for (const site of sites) {
      const key = hotspotOwnershipKey(connection.id, site);
      const record = states.find(item => item.key === key);
      if (record && (record.state.connectionId !== connection.id || record.state.site !== site)) throw new Error('Ownership identity mismatch');
      const relevant = campaigns.filter(campaign => (campaign.unifiSite || sites[0]) === site);
      if (!relevant.length && !record?.state.wlans.length) continue;
      const client = hotspotClient(connection, site);
      let portalReady = await hotspotPortalReady(client);
      if (!portalReady) unreadySites++;
      if(portalReady)try{await syncPortalWalledGarden(key,client,assertLease);}catch{portalDnsFailures++;portalReady=false;}
      const result = await reconcileGuestPolicy({
        site, defaultSite: sites[0], campaigns: relevant, owned: record?.state.wlans || [], now: new Date(), portalReady, assertLease,
        read: () => readHotspotWlans(client),
        save: async wlans => {
          const value: Prisma.InputJsonValue = { version: 1, connectionId: connection.id, site, wlans: wlans.map(item => ({ ...item })) };
          await prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
        },
        write: async (id, isGuest) => {
          const response = await client.siteRequest(`rest/wlanconf/${id}`, 'PUT', { is_guest: isGuest });
          if (response?.meta?.rc !== 'ok') throw new Error('Controller refused guest policy update');
        },
      });
      ambiguousWlans += result.ambiguousWlans;
      managedSites++;
    }
    await heartbeat(blockedOwnership || ambiguousWlans || unreadySites || portalDnsFailures ? 'needs-attention' : 'healthy', { campaigns: campaigns.length, managedSites, blockedOwnership, ambiguousWlans, unreadySites, portalDnsFailures });
  } catch {
    // Do not leak controller credentials or URLs into public worker status. Ownership remains retryable.
    if (lease && !lostLease) await heartbeat('error', { error: 'Campaign hotspot reconciliation failed; retry scheduled' }).catch(() => {});
  } finally {
    if (renewal) clearInterval(renewal);
    if (lease) await redis.eval(RELEASE_LEASE, 1, LOCK_KEY, owner).catch(() => {});
  }
}
const globalWorker = globalThis as unknown as { campaignHotspotWorker?: ReturnType<typeof setInterval> };
export function startCampaignHotspotWorker(intervalMs = 15000): void {
  if (process.env.CAMPAIGN_HOTSPOT_ENABLED !== 'true' || process.env.APP_SERVER_MODE !== 'backend' || globalWorker.campaignHotspotWorker) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runCampaignHotspotTick(); } finally { running = false; }
  };
  globalWorker.campaignHotspotWorker = setInterval(() => { void tick(); }, intervalMs);
  globalWorker.campaignHotspotWorker.unref?.();
  void tick();
}
