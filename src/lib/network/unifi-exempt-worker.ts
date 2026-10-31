import {prisma} from '@/lib/prisma';
import {redis} from '@/lib/redis';
import {resolveConnection} from './connections';
import {configuredHotspotSites,controllerRows,effectiveHotspotCampaigns,hotspotClient,readHotspotWlans} from './campaign-hotspot';
import {hotspotOwnershipKey,matchCampaign,normalizeMac,parseHotspotOwnership,validGuestClient,validMac,wlanName} from './campaign-hotspot-policy';
import {authorizeTimedGuest,parseGuestSession,sessionKey} from './campaign-sessions';
import {SESSION_PREFIX} from './campaign-session-policy';
import {listDeviceExemptions} from './unifi-exempt-store';
export const UNIFI_EXEMPT_STATUS_KEY='unifi-exempt:status';
export async function runUnifiExemptTick():Promise<void>{
 if(process.env.CAMPAIGN_HOTSPOT_ENABLED!=='true'||process.env.APP_SERVER_MODE!=='backend')return;
 let checked=0,failed=0;
 try{
  const approved=(await listDeviceExemptions()).filter(d=>d.enabled);
  if(approved.length){
   const connection=await resolveConnection('UNIFI');const sites=configuredHotspotSites(connection);
   for(const site of sites){
    const group=approved.filter(d=>d.connectionId===connection.id&&d.site===site);if(!group.length)continue;
    const client=hotspotClient(connection,site);
    const [wlans,campaigns,stations,owned,ledgers]=await Promise.all([readHotspotWlans(client),effectiveHotspotCampaigns(),client.siteRequest('stat/sta').then(controllerRows),prisma.systemSetting.findUnique({where:{key:hotspotOwnershipKey(connection.id,site)}}),prisma.systemSetting.findMany({where:{key:{startsWith:`${SESSION_PREFIX}${connection.id}:${site}:`}}})]);
    const sessions=new Map(ledgers.map(row=>[row.key,row.value]));
    const ownership=parseHotspotOwnership(owned?.value);if(!ownership||ownership.connectionId!==connection.id||ownership.site!==site){failed++;continue;}
    for(const device of group){
     const matches=stations.filter(s=>normalizeMac(s.mac)===device.mac);if(matches.length!==1)continue;
     const station=matches[0];const apMac=normalizeMac(station.ap_mac),ssid=String(station.essid??station.ssid??'');
     if(station.is_wired!==false||!validMac(apMac))continue;
     const targets=wlans.filter(w=>wlanName(w)===ssid&&w.is_guest===true&&ownership.wlans.some(o=>o.wlanId===w._id)&&matchCampaign(w,wlans,campaigns,site,new Date(),sites[0]));
     if(targets.length!==1)continue;const wlan=targets[0];if((station.wlanconf_id??station.wlan_id)&&(station.wlanconf_id??station.wlan_id)!==wlan._id)continue;
     const campaign=matchCampaign(wlan,wlans,campaigns,site,new Date(),sites[0])!;
     try{
      const key=sessionKey({connectionId:connection.id,site,mac:device.mac});const saved=sessions.get(key);
      if(saved){
       const prior=parseGuestSession(saved);if(prior.resetRequired)continue;
       if(station.authorized===true&&
       sessionKey(prior)===key&&prior.accessMode==='exempt'&&prior.state==='active'&&prior.campaignId===campaign.id&&prior.wlanId===wlan._id&&prior.ssid===ssid&&prior.expiresAt>Date.now()+12*60*60000){checked++;continue;}
      }
      const context={mac:device.mac,apMac,ssid,unifiSite:site};
      await authorizeTimedGuest({campaignId:campaign.id,connectionId:connection.id,site,wlanId:wlan._id,ssid,mac:device.mac,apMac},client,new Date(campaign.endTime),async()=>{
       const live=validGuestClient(context,controllerRows(await client.siteRequest('stat/sta')),site);
       if((live.wlanconf_id??live.wlan_id)&&(live.wlanconf_id??live.wlan_id)!==wlan._id)throw Error('WLAN changed');return live;
      },true);checked++;
     }catch{failed++;}
    }
   }
  }
  await redis.set(UNIFI_EXEMPT_STATUS_KEY,JSON.stringify({status:failed?'needs-attention':'healthy',lastRunAt:new Date().toISOString(),checked,failed}),'EX',60);
 }catch{await redis.set(UNIFI_EXEMPT_STATUS_KEY,JSON.stringify({status:'error',lastRunAt:new Date().toISOString(),error:'Không thể cập nhật thiết bị miễn xác thực; sẽ thử lại.'}),'EX',60).catch(()=>{});}
}
const state=globalThis as unknown as {unifiExemptTimer?:ReturnType<typeof setTimeout>};
export function startUnifiExemptWorker(intervalMs=3000){
 if(process.env.CAMPAIGN_HOTSPOT_ENABLED!=='true'||process.env.APP_SERVER_MODE!=='backend'||state.unifiExemptTimer)return;
 const tick=async()=>{try{await runUnifiExemptTick();}finally{state.unifiExemptTimer=setTimeout(()=>{void tick();},intervalMs);state.unifiExemptTimer.unref?.();}};
 state.unifiExemptTimer=setTimeout(()=>{void tick();},1000);state.unifiExemptTimer.unref?.();
}
