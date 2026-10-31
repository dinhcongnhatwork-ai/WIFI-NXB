/** Pure policy and device boundary: no environment, database or controller side effects. */
export type Wlan = Record<string, unknown> & { _id: string; name?: string; ssid?: string };
export interface HotspotCampaign {
  id: string; ssid: string; unifiSite?: string | null; wlanConfId?: string | null; active: boolean;
  startTime: Date | string; endTime: Date | string; template?: { publishedRevision?: unknown } | null;
}
export interface OwnedWlan { wlanId: string; originalGuest: false }
export interface HotspotOwnership { version: 1; connectionId: string; site: string; wlans: OwnedWlan[] }
export function hotspotOwnershipKey(connectionId: string, site: string): string {
  return `campaignHotspot:owned:${connectionId}:${site}`;
}
/** Shared durable-state validation: duplicate identities and unknown originals fail closed. */
export function parseHotspotOwnership(value: unknown): HotspotOwnership | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (state.version !== 1 || typeof state.connectionId !== 'string' || typeof state.site !== 'string' || !Array.isArray(state.wlans)
    || state.wlans.some(item => !item || typeof item !== 'object' || Array.isArray(item) || typeof item.wlanId !== 'string'
      || !/^[a-zA-Z\d_-]{1,100}$/.test(item.wlanId) || item.originalGuest !== false)
    || new Set(state.wlans.map(item => item.wlanId)).size !== state.wlans.length) return null;
  return { version: 1, connectionId: state.connectionId, site: state.site, wlans: state.wlans as OwnedWlan[] };
}
export interface GuestContext { mac: string; ssid: string; apMac: string; unifiSite: string }
export class CampaignHotspotError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
/** Association redirects can reach the portal before the controller lists the station. */
export class GuestClientPendingError extends CampaignHotspotError {
  constructor() { super('Đang chờ điểm phát WiFi cập nhật kết nối của bạn.', 409); }
}
export class GuestAuthorizationPendingError extends GuestClientPendingError {
  constructor(){super();this.message='Đang mở quyền truy cập Internet. Vui lòng giữ kết nối WiFi.';}
}
export const normalizeMac = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase().replace(/-/g, ':') : '';
export const validMac = (value: string) => /^([a-f0-9]{2}:){5}[a-f0-9]{2}$/.test(value);
export const wlanName = (wlan: Wlan) => wlan.ssid || wlan.name || '';
// Treat unknown non-boolean flags as already managed elsewhere: never acquire them.
export const guestFlag = (wlan: Wlan) => [wlan.is_guest, wlan.isGuest].some(value => value !== undefined && value !== null && value !== false);
export function isOpenWlan(wlan: Wlan): boolean {
  // Unknown security and password-bearing configurations fail closed, even with an open label.
  return wlan.enabled === true && ['open', 'none'].includes(String(wlan.security).toLowerCase())
    && !['wpaPsk', 'wpa_psk', 'x_passphrase', 'passphrase', 'wpa_passphrase', 'password', 'radius_secret'].some(key => !!wlan[key])
    && wlan.wpa3_support !== true && wlan.wpa3_transition !== true;
}
export function matchingCampaigns(wlan: Wlan, wlans: Wlan[], campaigns: HotspotCampaign[], site: string, now: Date, defaultSite = site): HotspotCampaign[] {
  if (!isOpenWlan(wlan)) return [];
  return campaigns.filter(campaign => campaign.active && new Date(campaign.startTime) <= now && new Date(campaign.endTime) > now
    && !!campaign.template?.publishedRevision && (campaign.unifiSite || defaultSite) === site
    && campaign.ssid === wlanName(wlan)
    && (campaign.wlanConfId ? campaign.wlanConfId === wlan._id : wlans.filter(item => wlanName(item) === campaign.ssid).length === 1));
}
export function matchCampaign(wlan: Wlan, wlans: Wlan[], campaigns: HotspotCampaign[], site: string, now: Date, defaultSite = site): HotspotCampaign | null {
  const matches = matchingCampaigns(wlan, wlans, campaigns, site, now, defaultSite);
  return matches.length === 1 ? matches[0] : null;
}
export async function reconcileGuestPolicy(input: {
  site: string; campaigns: HotspotCampaign[]; owned: OwnedWlan[]; now: Date; portalReady: boolean; defaultSite?: string;
  read: () => Promise<Wlan[]>; save: (owned: OwnedWlan[]) => Promise<void>;
  write: (id: string, isGuest: boolean) => Promise<void>; assertLease?: () => Promise<void>;
}): Promise<{ ambiguousWlans: number }> {
  let owned = [...input.owned];
  const wlans = await input.read();
  const ambiguousWlans = wlans.filter(wlan => matchingCampaigns(wlan, wlans, input.campaigns, input.site, input.now, input.defaultSite).length > 1).length;
  const targets = new Set(wlans.filter(wlan => matchCampaign(wlan, wlans, input.campaigns, input.site, input.now, input.defaultSite)
    && (input.portalReady || owned.some(entry => entry.wlanId === wlan._id))).map(wlan => wlan._id));
  // Cleanup first; only fields for which we saved ownership can be restored.
  for (const entry of [...owned]) {
    if (targets.has(entry.wlanId)) continue;
    const current = (await input.read()).find(wlan => wlan._id === entry.wlanId);
    if (current && guestFlag(current)) {
      await input.assertLease?.();
      await input.write(entry.wlanId, entry.originalGuest);
      const verified = (await input.read()).find(wlan => wlan._id === entry.wlanId);
      if (!verified || guestFlag(verified)) throw new Error('Guest policy cleanup readback failed');
    }
    owned = owned.filter(item => item.wlanId !== entry.wlanId);
    await input.assertLease?.();
    await input.save(owned);
  }
  for (const id of Array.from(targets)) {
    if (!input.portalReady) continue;
    const fresh = await input.read();
    const current = fresh.find(wlan => wlan._id === id);
    if (!current || !matchCampaign(current, fresh, input.campaigns, input.site, input.now, input.defaultSite) || guestFlag(current)) continue;
    if (!owned.some(item => item.wlanId === id)) {
      owned.push({ wlanId: id, originalGuest: false });
      await input.assertLease?.();
      await input.save(owned); // durable write-ahead ownership survives mutation/readback failure
    }
    await input.assertLease?.();
    await input.write(id, true);
    const verified = (await input.read()).find(wlan => wlan._id === id);
    if (!verified || !guestFlag(verified)) throw new Error('Guest policy enable readback failed');
  }
  return { ambiguousWlans };
}
export function validGuestClient(context: GuestContext, clients: Record<string, unknown>[], site: string): Record<string, unknown> {
  const mac = normalizeMac(context.mac), apMac = normalizeMac(context.apMac);
  if (context.unifiSite !== site || !validMac(mac) || !validMac(apMac) || !context.ssid) throw new CampaignHotspotError('Invalid UniFi guest context');
  const matches = clients.filter(client => normalizeMac(client.mac) === mac);
  if (!matches.length) throw new GuestClientPendingError();
  const client = matches.length === 1 ? matches[0] : null;
  if (!client || !(client.is_wired === false || client.isWireless === true) || client.is_wired === true || client.isWired === true
    || (client.essid ?? client.ssid) !== context.ssid || normalizeMac(client.ap_mac ?? client.apMac) !== apMac) {
    throw new CampaignHotspotError('Thông tin kết nối WiFi đã thay đổi. Vui lòng kết nối lại đúng mạng và thử lại.');
  }
  return client;
}
export function guestMinutes(campaign: HotspotCampaign, now: Date): number {
  const minutes = Math.min(240, Math.floor((new Date(campaign.endTime).getTime() - now.getTime()) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) throw new CampaignHotspotError('Campaign is ending; reconnect when a campaign is available');
  return minutes;
}
