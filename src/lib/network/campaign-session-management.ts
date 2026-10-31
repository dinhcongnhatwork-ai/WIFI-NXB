import {randomUUID} from 'node:crypto';
import {campaignResetKey} from './campaign-reset-policy';
import {prisma} from '@/lib/prisma';
import {readDeviceExemption} from './unifi-exempt-store';
import {resolveConnection} from './connections';
import {configuredHotspotSites,controllerRows,effectiveHotspotCampaigns,hotspotClient,readHotspotWlans} from './campaign-hotspot';
import {CampaignHotspotError,hotspotOwnershipKey,matchCampaign,normalizeMac,parseHotspotOwnership,validMac} from './campaign-hotspot-policy';
import {SESSION_PREFIX} from './campaign-session-policy';
import {CampaignGuestSession,expireTimedGuest,parseGuestSession,saveGuestSession,sessionKey,withGuestLease} from './campaign-sessions';
/** Queue durable revocation intents for one managed campaign; no site-wide reset command. */
export async function queueCampaignDisconnect(campaignId:string,options:{forceReauth?:boolean;assertLease?:()=>Promise<void>}={}):Promise<{queued:number;notQueued?:number}> {
 if(process.env.CAMPAIGN_HOTSPOT_ENABLED!=='true')throw new CampaignHotspotError('Tự động quản lý phiên UniFi chưa được bật.',503);
 const campaign=await prisma.campaign.findUnique({where:{id:campaignId}});if(!campaign)throw new CampaignHotspotError('Không tìm thấy chiến dịch.',404);
 const connection=await resolveConnection('UNIFI');const sites=configuredHotspotSites(connection);const site=campaign.unifiSite||sites[0];
 if(!sites.includes(site))throw new CampaignHotspotError('Site chiến dịch không được quản lý.');
 const client=hotspotClient(connection,site);
 const [wlans,campaigns,owned,stations,records]=await Promise.all([
  readHotspotWlans(client),effectiveHotspotCampaigns(),prisma.systemSetting.findUnique({where:{key:hotspotOwnershipKey(connection.id,site)}}),
  client.siteRequest('stat/sta').then(controllerRows),prisma.systemSetting.findMany({where:{key:{startsWith:SESSION_PREFIX}}}),
 ]);
 const matches=wlans.filter(w=>matchCampaign(w,wlans,campaigns,site,new Date(),sites[0])?.id===campaignId);const ownership=parseHotspotOwnership(owned?.value);
 if(matches.length!==1||matches[0].is_guest!==true||!ownership||ownership.connectionId!==connection.id||ownership.site!==site||!ownership.wlans.some(w=>w.wlanId===matches[0]._id))throw new CampaignHotspotError('Chỉ ngắt phiên trên SSID mở thuộc chiến dịch đang được quản lý.');
 const liveTargets=new Set<string>();
 const wlan=matches[0];const targets=new Map<string,CampaignGuestSession>();
 for(const record of records){
  const s=parseGuestSession(record.value);
  if(s.campaignId===campaignId&&s.connectionId===connection.id&&s.site===site&&s.wlanId===wlan._id&&s.ssid===campaign.ssid&&(options.forceReauth||s.state!=='revoked')&&record.key===sessionKey(s))targets.set(s.mac,s);
 }
 // Includes active guests authorized before session tracking was installed; never includes a WPA SSID.
 for(const station of stations){
  const mac=normalizeMac(station.mac),apMac=normalizeMac(station.ap_mac);
  if(station.is_wired!==false||station.essid!==campaign.ssid||!validMac(mac)||!validMac(apMac)||(station.wlanconf_id&&station.wlanconf_id!==wlan._id))continue;
  liveTargets.add(mac);
  if(!targets.has(mac))targets.set(mac,{version:1,state:'pending',campaignId,connectionId:connection.id,site,wlanId:wlan._id,ssid:campaign.ssid,mac,apMac,authorizedAt:Date.now(),expiresAt:0});
 }
 if(options.forceReauth){await options.assertLease?.();const key=campaignResetKey(campaignId);const value={version:1,epoch:randomUUID(),resetAt:Date.now()};await prisma.systemSetting.upsert({where:{key},create:{key,value},update:{value}});}
 let queued=0,notQueued=0;
 for(const target of Array.from(targets.values())){
  const key=sessionKey(target);
  let handled=false;
  for(let attempt=0;attempt<3&&!handled;attempt++){try{await withGuestLease(key,async check=>{
   if(!options.forceReauth&&await readDeviceExemption(target))return;
   await options.assertLease?.();
   const row=await prisma.systemSetting.findUnique({where:{key}});let current=row?parseGuestSession(row.value):target;
   if(current.campaignId!==campaignId||current.site!==site||current.wlanId!==wlan._id||current.ssid!==campaign.ssid){
    if(!options.forceReauth||!liveTargets.has(target.mac))return;
    const fresh=controllerRows(await client.siteRequest('stat/sta')).filter(s=>normalizeMac(s.mac)===target.mac);
    if(fresh.length!==1||fresh[0].is_wired!==false||(fresh[0].essid??fresh[0].ssid)!==campaign.ssid||((fresh[0].wlanconf_id??fresh[0].wlan_id)&&(fresh[0].wlanconf_id??fresh[0].wlan_id)!==wlan._id))return;
    current={...target,apMac:normalizeMac(fresh[0].ap_mac)};if(!validMac(current.apMac))return;
   }
   await options.assertLease?.();await check();await saveGuestSession(key,{...Object.fromEntries(Object.entries(current).filter(([k])=>k!=='cachePending')) as CampaignGuestSession,state:'pending',expiresAt:0,...(options.forceReauth?{resetRequired:true}:{})});queued++;
  });handled=true;}catch(error){if(!options.forceReauth)throw error;if(error instanceof CampaignHotspotError&&error.status===409&&attempt<2){await new Promise(resolve=>setTimeout(resolve,250));}else{notQueued++;handled=true;}}}
 }
 return options.forceReauth?{queued,notQueued}:{queued};
}

/** Reset is serialized per campaign; each native revoke/kick still uses the shared MAC lease. */
export async function resetCampaignWifi(campaignId:string):Promise<{queued:number;revoked:number;waiting:number;skipped:number;failed:number;notQueued:number}>{
 return withGuestLease('campaign-reset:'+campaignResetKey(campaignId),async check=>{
  const {queued,notQueued=0}=await queueCampaignDisconnect(campaignId,{forceReauth:true,assertLease:check});
  const connection=await resolveConnection('UNIFI');const sites=configuredHotspotSites(connection);
  const rows=await prisma.systemSetting.findMany({where:{key:{startsWith:SESSION_PREFIX}}});let revoked=0,waiting=0,skipped=0,failed=notQueued;
  for(const row of rows){
   const session=parseGuestSession(row.value);if(session.campaignId!==campaignId||!session.resetRequired||session.connectionId!==connection.id||!sites.includes(session.site)||sessionKey(session)!==row.key||!['pending','waiting'].includes(session.state))continue;
   try{await check();const status=await expireTimedGuest(row.key,hotspotClient(connection,session.site),session);if(status==='revoked')revoked++;else if(status==='waiting')waiting++;else if(status==='skipped')skipped++;}catch{failed++;}
  }
  return {queued,revoked,waiting,skipped,failed,notQueued};
 });
}
