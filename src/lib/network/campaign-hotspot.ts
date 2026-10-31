import {readUnifiPortalAssociation} from './unifi-portal-association';
import {reconnectUniFiGuest} from './unifi-guest-reconnect';
import {clearUniFiGuestCache} from './unifi-guest-cache';
import type {CampaignSessionScope} from './campaign-sessions';
import { prisma } from '@/lib/prisma';
import { UnifiClient } from '@/lib/unifi';
import { readPortalSessionId } from '@/lib/attendance/runtime';
import { normalizeRedirectUrl, resolvePortalFallbackUrl } from '@/lib/redirect-url';
import { resolveConnection, type ResolvedConnection } from './connections';
import { CampaignHotspotError, GuestClientPendingError, hotspotOwnershipKey, matchCampaign, parseHotspotOwnership, validGuestClient, type GuestContext, type HotspotCampaign, type Wlan } from './campaign-hotspot-policy';

import {authorizeTimedGuest} from './campaign-sessions';

export { CampaignHotspotError } from './campaign-hotspot-policy';
export function configuredHotspotSites(connection: ResolvedConnection): string[] {
  const sites = [connection.config.site || process.env.UNIFI_SITE || 'default', ...(Array.isArray(connection.config.sites) ? connection.config.sites : [])];
  if (sites.some(site => typeof site !== 'string' || !/^[a-zA-Z\d_-]{1,100}$/.test(site))) throw new CampaignHotspotError('Invalid configured UniFi site', 503);
  return Array.from(new Set(sites as string[]));
}
export function hotspotClient(connection: ResolvedConnection, site: string): UnifiClient {
  if (!connection.isDefault || !configuredHotspotSites(connection).includes(site)) throw new CampaignHotspotError('Unknown UniFi portal site');
  const client=new UnifiClient({ controllerUrl: connection.baseUrl, username: connection.username || '', password: connection.credentials.password || '', site,
    rejectUnauthorized: connection.config.allowInsecure !== true, apiMode: 'legacy', apiPrefix: connection.config.apiPrefix as string | undefined, version: connection.version });
  return Object.assign(client,{reconnectGuest:(scope:CampaignSessionScope,assertLease?:()=>Promise<void>)=>reconnectUniFiGuest(client,scope,assertLease),clearGuestCache:(scope:CampaignSessionScope,pending?:string[],assertLease?:()=>Promise<void>)=>clearUniFiGuestCache(client,scope,pending,assertLease)});
}
export function controllerRows(response: unknown): Record<string, unknown>[] {
  const rows = (response as { data?: unknown })?.data;
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object')) throw new CampaignHotspotError('Invalid controller response', 502);
  return rows;
}
export async function readHotspotWlans(client: UnifiClient): Promise<Wlan[]> {
  const rows = controllerRows(await client.siteRequest('rest/wlanconf'));
  if (rows.some(row => typeof row._id !== 'string' || !/^[a-zA-Z\d_-]{1,100}$/.test(row._id))) throw new CampaignHotspotError('Invalid controller WLAN identity', 502);
  return rows as Wlan[];
}
export async function hotspotPortalReady(client: UnifiClient): Promise<boolean> {
  const expected = process.env.UNIFI_PORTAL_SERVER;
  if (!expected) return false;
  const settings = controllerRows(await client.siteRequest('get/setting')).filter(row => row.key === 'guest_access');
  return settings.length === 1 && settings[0].portal_enabled === true && settings[0].auth === 'custom' && settings[0].custom_ip === expected;
}
export async function effectiveHotspotCampaigns(now = new Date()) {
  return prisma.campaign.findMany({ where: { active: true, startTime: { lte: now }, endTime: { gt: now }, template: { publishedRevisionId: { not: null } } }, include: { template: { include: { publishedRevision: true } } } });
}
export function isUnifiPortalRequest(portalSessionId: unknown, site: string): boolean {
  return !!site || !!readPortalSessionId(portalSessionId)?.unifiSite;
}
/** Validate the live context before minting a signed session, and again before granting access. */
export async function inspectUnifiPortal(context: GuestContext,allowPending=false) {
  if (process.env.CAMPAIGN_HOTSPOT_ENABLED !== 'true') throw new CampaignHotspotError('Campaign hotspot is disabled', 503);
  try {
    const connection = await resolveConnection('UNIFI'); // never accept request-selected connection/site credentials
    const client = hotspotClient(connection, context.unifiSite);
    const [wlans, clients, campaigns, ready] = await Promise.all([readHotspotWlans(client), client.siteRequest('stat/sta').then(controllerRows), effectiveHotspotCampaigns(), hotspotPortalReady(client)]);
    if (!ready) throw new CampaignHotspotError('UniFi external portal is not ready', 503);
    const matches = wlans.filter(wlan => (wlan.ssid || wlan.name) === context.ssid && matchCampaign(wlan, wlans, campaigns, context.unifiSite, new Date(), configuredHotspotSites(connection)[0]));
    if (matches.length !== 1 || !(matches[0].is_guest === true || matches[0].isGuest === true)) throw new CampaignHotspotError('No effective open WLAN campaign');
    const ownershipKey = hotspotOwnershipKey(connection.id, context.unifiSite);
    const record = await prisma.systemSetting.findUnique({ where: { key: ownershipKey } });
    const ownership = parseHotspotOwnership(record?.value);
    if (record?.key !== ownershipKey || !ownership || ownership.connectionId !== connection.id || ownership.site !== context.unifiSite
      || !ownership.wlans.some(entry => entry.wlanId === matches[0]._id)) {
      throw new CampaignHotspotError('WLAN is not managed by campaign hotspot');
    }
    let liveVerified=true;try{if(allowPending)validGuestClient(context,clients,context.unifiSite);else await readUnifiPortalAssociation(client,connection.id,context,matches[0]._id,clients);}catch(error){if(!allowPending||!(error instanceof GuestClientPendingError))throw error;liveVerified=false;}
    const campaign = matchCampaign(matches[0], wlans, campaigns, context.unifiSite, new Date(), configuredHotspotSites(connection)[0])!;
    return { client, campaign, wlan: matches[0], connectionId: connection.id,liveVerified };
  } catch (error) {
    if (error instanceof CampaignHotspotError) throw error;
    throw new CampaignHotspotError('UniFi controller unavailable', 502);
  }
}
export async function authorizeUnifiPortal(portalSessionId: unknown): Promise<{ redirect: string }> {
  const signed = readPortalSessionId(portalSessionId);
  if (!signed?.unifiSite) throw new CampaignHotspotError('Signed UniFi portal session required');
  // The live association is rechecked under the MAC lease immediately before the grant.
  const { client, campaign, wlan, connectionId } = await inspectUnifiPortal(signed,true);
  if (campaign.id !== signed.campaignId) throw new CampaignHotspotError('The signed campaign is no longer effective');
  try {
    await authorizeTimedGuest({campaignId:campaign.id,connectionId,site:signed.unifiSite,wlanId:wlan._id,ssid:signed.ssid,mac:signed.mac,apMac:signed.apMac},client,new Date(campaign.endTime),async(confirmOnAp)=>readUnifiPortalAssociation(client,connectionId,signed,wlan._id,undefined,confirmOnAp),false,signed.resetEpoch||'');
    return {redirect:normalizeRedirectUrl((campaign as HotspotCampaign & {redirectUrl?:string}).redirectUrl)||resolvePortalFallbackUrl(process.env.NEXT_PUBLIC_APP_URL)};
  } catch(error) {
    if(error instanceof CampaignHotspotError)throw error;
    throw new CampaignHotspotError('UniFi guest authorization failed',502);
  }

}

/** Validate campaign targeting against the configured controller, without modifying a WLAN. */
export async function validateCampaignTarget(input: { ssid: unknown; unifiSite?: unknown; wlanConfId?: unknown }): Promise<{ ssid: string; unifiSite: string; wlanConfId: string | null }> {
  const ssid = typeof input.ssid === 'string' ? input.ssid.trim() : '';
  const site = typeof input.unifiSite === 'string' ? input.unifiSite.trim() : '';
  const wlanId = typeof input.wlanConfId === 'string' ? input.wlanConfId.trim() : '';
  if (!ssid || ssid.length > 128 || (input.unifiSite != null && typeof input.unifiSite !== 'string') || (site && !/^[a-zA-Z\d_-]{1,100}$/.test(site))
    || (input.wlanConfId != null && typeof input.wlanConfId !== 'string') || (wlanId && !/^[a-zA-Z\d_-]{1,100}$/.test(wlanId))) throw new CampaignHotspotError('Invalid campaign network target', 400);
  try {
    const connection = await resolveConnection('UNIFI');
    const effectiveSite = site || configuredHotspotSites(connection)[0];
    if (!configuredHotspotSites(connection).includes(effectiveSite)) throw new CampaignHotspotError('Unknown campaign UniFi site', 400);
    const wlans = await readHotspotWlans(hotspotClient(connection, effectiveSite));
    const matches = wlans.filter(wlan => (wlan.ssid || wlan.name) === ssid && (!wlanId || wlan._id === wlanId));
    if (matches.length !== 1) throw new CampaignHotspotError('Campaign SSID/WLAN target is missing or ambiguous', 400);
    return { ssid, unifiSite: effectiveSite, wlanConfId: matches[0]._id };
  } catch (error) {
    if (error instanceof CampaignHotspotError) throw error;
    throw new CampaignHotspotError('Cannot validate campaign target: UniFi controller unavailable', 502);
  }
}
