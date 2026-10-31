import {prisma} from '@/lib/prisma';
import {redis} from '@/lib/redis';
import {readDeviceExemption} from './unifi-exempt-store';
import {resolveConnection} from './connections';
import {configuredHotspotSites,controllerRows,effectiveHotspotCampaigns,hotspotClient,readHotspotWlans} from './campaign-hotspot';
import {hotspotOwnershipKey,isOpenWlan,matchCampaign,normalizeMac,parseHotspotOwnership,validGuestClient,validMac,wlanName} from './campaign-hotspot-policy';
import {SESSION_PREFIX} from './campaign-session-policy';
import {expireTimedGuest,releaseTimedGuest,retargetExemptSession,parseGuestSession,sessionKey} from './campaign-sessions';
export const CAMPAIGN_SESSION_STATUS_KEY='campaign-session:status';
export async function runCampaignSessionTick():Promise<void> {
 if(process.env.CAMPAIGN_HOTSPOT_ENABLED!=='true'||process.env.APP_SERVER_MODE!=='backend')return;
 let revoked=0,released=0,waiting=0,blocked=0,failed=0,authorizing=0;
 try {
  const records=await prisma.systemSetting.findMany({where:{key:{startsWith:SESSION_PREFIX}}});
  const candidates=records.flatMap(record=>{
   try{const s=parseGuestSession(record.value);if(s.state==='pending'&&s.accessMode!=='exempt'&&!s.resetRequired&&s.expiresAt>Date.now()&&(s.authorizationPendingUntil??0)>Date.now()){authorizing++;return [];}return (s.state==='revoked'&&s.cachePending?.length||s.state!=='revoked'&&(s.accessMode==='exempt'||(s.state!=='released'&&(s.state!=='active'||s.expiresAt<=Date.now()))))?[{key:record.key,session:s}]:[];}catch{blocked++;return [];}
  });
  const due=[];for(const record of candidates){try{if(record.session.accessMode==='exempt'&&!record.session.resetRequired&&await readDeviceExemption(record.session))continue;due.push(record);}catch{blocked++;}}
  if(due.length){
   const connection=await resolveConnection('UNIFI');
   for(const site of configuredHotspotSites(connection)){
    const siteDue=due.filter(r=>r.session.connectionId===connection.id&&r.session.site===site);const group=[...siteDue.filter(r=>r.session.state!=='revoked'),...siteDue.filter(r=>r.session.state==='revoked').slice(0,3)];if(!group.length)continue;
    const client=hotspotClient(connection,site);
    const [wlans,record]=await Promise.all([readHotspotWlans(client),prisma.systemSetting.findUnique({where:{key:hotspotOwnershipKey(connection.id,site)}})]);
    const ownership=parseHotspotOwnership(record?.value);
    for(const {key,session:snapshot}of group){
     let session=snapshot;
     if(session.accessMode==='exempt'&&!session.resetRequired){
      try{
       const stations=controllerRows(await client.siteRequest('stat/sta'));const live=stations.filter(s=>normalizeMac(s.mac)===session.mac);
       if(live.length>1){blocked++;continue;}
       if(live.length===1){
        const station=live[0],ssid=String(station.essid??station.ssid??''),apMac=normalizeMac(station.ap_mac);
        if(station.is_wired!==false||!validMac(apMac)){blocked++;continue;}
        const campaigns=await effectiveHotspotCampaigns();
        const targets=wlans.filter(w=>ownership?.connectionId===connection.id&&ownership.site===site&&ownership.wlans.some(o=>o.wlanId===w._id)&&w.is_guest===true&&wlanName(w)===ssid&&matchCampaign(w,wlans,campaigns,site,new Date(),configuredHotspotSites(connection)[0]));
        if(targets.length!==1){blocked++;continue;}
        const target=targets[0],campaign=matchCampaign(target,wlans,campaigns,site,new Date(),configuredHotspotSites(connection)[0])!;
        const context={mac:session.mac,ssid,apMac,unifiSite:site};
        const moved=await retargetExemptSession(key,session,{...session,campaignId:campaign.id,wlanId:target._id,ssid,apMac},async()=>{
         const fresh=validGuestClient(context,controllerRows(await client.siteRequest('stat/sta')),site);
         if((fresh.wlanconf_id??fresh.wlan_id)&&(fresh.wlanconf_id??fresh.wlan_id)!==target._id)throw Error('WLAN changed');return fresh;
        });
        if(!moved)continue;session=moved;
       }
      }catch{failed++;continue;}
     }
     const wlan=wlans.find(w=>w._id===session.wlanId);
     const relinquished=ownership&&ownership.connectionId===connection.id&&ownership.site===site&&!ownership.wlans.some(w=>w.wlanId===session.wlanId);
     if(key===sessionKey(session)&&relinquished&&(!wlan||wlan.is_guest===false)){
      try{await releaseTimedGuest(key,session);released++;}catch{failed++;}continue;
     }
     if(key!==sessionKey(session)||!ownership||ownership.connectionId!==connection.id||ownership.site!==site||!ownership.wlans.some(w=>w.wlanId===session.wlanId)||!wlan||!isOpenWlan(wlan)||wlan.is_guest!==true||wlanName(wlan)!==session.ssid){blocked++;continue;}
     try{const status=await expireTimedGuest(key,client,session);if(status==='revoked')revoked++;else if(status==='waiting')waiting++;else if(status==='skipped')blocked++;}catch{failed++;}
    }
   }
   blocked+=due.filter(r=>r.session.connectionId!==connection.id||!configuredHotspotSites(connection).includes(r.session.site)).length;
  }
  await redis.set(CAMPAIGN_SESSION_STATUS_KEY,JSON.stringify({status:blocked||failed?'needs-attention':'healthy',lastRunAt:new Date().toISOString(),revoked,released,waiting,blocked,failed,authorizing}),'EX',60);
 }catch{await redis.set(CAMPAIGN_SESSION_STATUS_KEY,JSON.stringify({status:'error',lastRunAt:new Date().toISOString(),error:'Không thể xử lý hết hạn phiên WiFi; sẽ thử lại.'}),'EX',60).catch(()=>{});}
}
const state=globalThis as unknown as {campaignSessionTimer?:ReturnType<typeof setTimeout>};
export function startCampaignSessionWorker(intervalMs=5000):void {
 if(process.env.CAMPAIGN_HOTSPOT_ENABLED!=='true'||process.env.APP_SERVER_MODE!=='backend'||state.campaignSessionTimer)return;
 const tick=async()=>{try{await runCampaignSessionTick();}finally{state.campaignSessionTimer=setTimeout(()=>{void tick();},intervalMs);state.campaignSessionTimer.unref?.();}};
 state.campaignSessionTimer=setTimeout(()=>{void tick();},1000);state.campaignSessionTimer.unref?.();
}
