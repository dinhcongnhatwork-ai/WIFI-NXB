import {readUnifiPortalAssociation} from './unifi-portal-association';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {redis} from '@/lib/redis';
import {campaignResetEpoch} from './campaign-reset-policy';
import {readDeviceExemption} from './unifi-exempt-store';
import {CampaignHotspotError,GuestClientPendingError,GuestAuthorizationPendingError,normalizeMac,validMac} from './campaign-hotspot-policy';
import {readSessionPolicy,sessionPolicyKey,SESSION_PREFIX} from './campaign-session-policy';
export interface CampaignSessionScope {campaignId:string;connectionId:string;site:string;wlanId:string;ssid:string;mac:string;apMac:string}
export interface CampaignGuestSession extends CampaignSessionScope {version:1;state:'pending'|'active'|'waiting'|'revoked'|'released';authorizedAt:number;expiresAt:number;revokedAt?:number;accessMode?:'exempt';resetRequired?:boolean;cachePending?:string[];authorizationPendingUntil?:number}
export interface SessionController {
 authorizeGuest(mac:string,minutes:number,apMac?:string):Promise<boolean>;
 unauthorizeGuest(mac:string):Promise<boolean>;
 kickClient(mac:string):Promise<boolean>;
 siteRequest(path:string):Promise<unknown>;
 reconnectGuest?(scope:CampaignSessionScope,assertLease?:()=>Promise<void>):Promise<'reconnected'|'offline'|'skipped'>;
 clearGuestCache?(scope:CampaignSessionScope,pending?:string[],assertLease?:()=>Promise<void>):Promise<string[]>;
}
const RENEW="if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end";
const RELEASE="if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
export function sessionKey(scope:Pick<CampaignSessionScope,'connectionId'|'site'|'mac'>):string {
 if(![scope.connectionId,scope.site].every(id=>/^[a-zA-Z\d_-]{1,100}$/.test(id))||!validMac(normalizeMac(scope.mac)))throw new CampaignHotspotError('Thông tin phiên WiFi không hợp lệ.');
 return `${SESSION_PREFIX}${scope.connectionId}:${scope.site}:${normalizeMac(scope.mac)}`;
}
export function parseGuestSession(value:unknown):CampaignGuestSession {
 const s=value as CampaignGuestSession;
 if(!s||(s.authorizationPendingUntil!==undefined&&(!Number.isFinite(s.authorizationPendingUntil)||s.authorizationPendingUntil<0))||(s.cachePending!==undefined&&(!Array.isArray(s.cachePending)||s.cachePending.length>500||s.cachePending.some(mac=>!validMac(mac))))||(s.resetRequired!==undefined&&typeof s.resetRequired!=='boolean')||(s.accessMode!==undefined&&s.accessMode!=='exempt')||s.version!==1||!['pending','active','waiting','revoked','released'].includes(s.state)||!Number.isFinite(s.authorizedAt)||!Number.isFinite(s.expiresAt)||![s.campaignId,s.wlanId].every(id=>typeof id==='string'&&/^[a-zA-Z\d_-]{1,100}$/.test(id))||typeof s.ssid!=='string'||!s.ssid||!validMac(normalizeMac(s.apMac)))throw new CampaignHotspotError('Dữ liệu phiên WiFi không hợp lệ.',503);
 sessionKey(s);return s;
}
export async function withGuestLease<T>(key:string,work:(assertLease:()=>Promise<void>)=>Promise<T>):Promise<T> {
 const lock='campaign-session-lock:'+key;const owner=randomUUID();let lost=false;
 if(await redis.set(lock,owner,'PX',60000,'NX')!=='OK')throw new CampaignHotspotError('Phiên WiFi đang được xử lý. Vui lòng thử lại.',409);
 const check=async()=>{if(lost||Number(await redis.eval(RENEW,1,lock,owner,60000))!==1){lost=true;throw new CampaignHotspotError('Không thể giữ khóa xử lý phiên WiFi.',503);}};
 const timer=setInterval(()=>{void check().catch(()=>{lost=true;});},15000);timer.unref?.();
 try {await check();return await work(check);}finally{clearInterval(timer);await redis.eval(RELEASE,1,lock,owner).catch(()=>{});}
}
export async function saveGuestSession(key:string,value:CampaignGuestSession):Promise<void> {
 if(sessionKey(value)!==key)throw new CampaignHotspotError('Định danh phiên WiFi không khớp.',503);
 const json={...value} as Prisma.InputJsonValue;
 await prisma.systemSetting.upsert({where:{key},create:{key,value:json},update:{value:json}});
}
/** One fresh read per HTTP request; the pending page resumes the same durable grant. */
async function confirmGuestAuthorization(readLive:(confirmOnAp?:boolean)=>Promise<Record<string,unknown>>):Promise<boolean>{
 try{return (await readLive(true)).authorized===true;}catch(error){if(error instanceof CampaignHotspotError&&!(error instanceof GuestClientPendingError)&&error.status<500)throw error;return false;}
}
export async function authorizeTimedGuest(scope:CampaignSessionScope,client:SessionController,campaignEnd:Date,readLive:(confirmOnAp?:boolean)=>Promise<Record<string,unknown>>,requireExempt=false,expectedResetEpoch?:string):Promise<void> {
 const key=sessionKey(scope);
 await withGuestLease(key,async check=>{
  const record=await prisma.systemSetting.findUnique({where:{key}});const prior=record?parseGuestSession(record.value):null;
  if(expectedResetEpoch!==undefined&&await campaignResetEpoch(prisma,scope.campaignId)!==expectedResetEpoch)throw new CampaignHotspotError('Phiên portal đã bị Reset. Vui lòng mở lại trang WiFi.',403);
  const current=await readLive(prior?.state==='pending');
  const exempt=await readDeviceExemption(scope);
  if(requireExempt&&prior?.resetRequired)throw new CampaignHotspotError('Vui lòng bấm Kết nối để xác thực lại sau Reset WiFi.',403);
  if(requireExempt&&!exempt)throw new CampaignHotspotError('Thiết bị không còn được miễn xác thực.',409);
  const resuming=prior?.state==='pending'&&prior.authorizationPendingUntil!==undefined&&prior.campaignId===scope.campaignId&&prior.wlanId===scope.wlanId&&prior.ssid===scope.ssid&&prior.expiresAt>Date.now()&&Boolean(prior.accessMode==='exempt')===Boolean(exempt)&&!prior.resetRequired?prior:null;
  if(resuming){
   if(current.authorized===true){await check();await saveGuestSession(key,{...resuming,apMac:scope.apMac,state:'active'});return;}
   if((resuming.authorizationPendingUntil??0)>Date.now())throw new GuestAuthorizationPendingError();
   if(!exempt)throw new CampaignHotspotError('Chưa thể mở Internet. Vui lòng mở lại trang kết nối và thử lại.',408);
  }
  if(exempt){
   if(prior?.accessMode==='exempt'&&prior.state==='active'&&prior.campaignId===scope.campaignId&&prior.wlanId===scope.wlanId&&prior.expiresAt>Date.now()+12*60*60000&&current.authorized===true)return;
   const value:CampaignGuestSession={...scope,mac:normalizeMac(scope.mac),version:1,state:'pending',accessMode:'exempt',authorizedAt:Date.now(),expiresAt:Date.now()+1440*60000,authorizationPendingUntil:Date.now()+45000};
   await check();await saveGuestSession(key,value);
   await check();let accepted:boolean;try{accepted=await client.authorizeGuest(value.mac,1440,normalizeMac(current.ap_mac??scope.apMac));}catch{throw new GuestAuthorizationPendingError();}if(!accepted){await check();await saveGuestSession(key,{...value,expiresAt:0,authorizationPendingUntil:0});throw new CampaignHotspotError('UniFi từ chối miễn xác thực WiFi.',502);}
   if(await confirmGuestAuthorization(readLive)){await check();await saveGuestSession(key,{...value,state:'active'});return;}
   throw new GuestAuthorizationPendingError();
  }
  // Repeated clicks and reconnecting with an active grant do not reset the deadline.
  const continuing=prior?.accessMode!=='exempt'&&prior?.state==='active'&&prior.campaignId===scope.campaignId&&prior.wlanId===scope.wlanId&&prior.expiresAt>Date.now()?prior:null;
  if(continuing&&current.authorized===true)return;
  const policy=await prisma.systemSetting.findUnique({where:{key:sessionPolicyKey(scope.campaignId)}});
  const deadline=continuing?Math.min(continuing.expiresAt,campaignEnd.getTime()):null;
  // The worker retains the exact original deadline; UniFi's native API uses whole minutes.
  const minutes=Math.min(deadline?Math.ceil((deadline-Date.now())/60000):readSessionPolicy(policy?.value),Math.floor((campaignEnd.getTime()-Date.now())/60000));
  if(minutes<1)throw new CampaignHotspotError('Chiến dịch sắp kết thúc. Vui lòng thử lại sau.');
  const started=continuing?.authorizedAt??Date.now();
  const value:CampaignGuestSession={...scope,mac:normalizeMac(scope.mac),version:1,state:'pending',authorizedAt:started,expiresAt:deadline??(started+minutes*60000),authorizationPendingUntil:Math.min(deadline??(started+minutes*60000),Date.now()+45000)};
  await check();await saveGuestSession(key,value); // durable intent before any grant, including ambiguous timeouts
  await check();let accepted:boolean;try{accepted=await client.authorizeGuest(value.mac,minutes,normalizeMac(current.ap_mac??scope.apMac));}catch{throw new GuestAuthorizationPendingError();}if(!accepted){await check();await saveGuestSession(key,{...value,expiresAt:0,authorizationPendingUntil:0});throw new CampaignHotspotError('UniFi từ chối cấp quyền WiFi.',502);}
  if(await confirmGuestAuthorization(readLive)){await check();await saveGuestSession(key,{...value,state:'active'});return;}
  throw new GuestAuthorizationPendingError();
 });
}
function stationRows(response:unknown):Record<string,unknown>[] {
 const rows=(response as {data?:unknown})?.data;
 if(!Array.isArray(rows))throw new CampaignHotspotError('Không đọc được thiết bị WiFi.',502);
 return rows;
}
function uniqueStation(response:unknown,mac:string):Record<string,unknown>|undefined {
 const rows=stationRows(response).filter(row=>normalizeMac(row.mac)===mac);
 if(rows.length>1)throw new CampaignHotspotError('Thiết bị WiFi không rõ định danh.',503);
 return rows[0];
}
/** The caller first verifies that this site/WLAN is still an owned open campaign WLAN. */
export async function expireTimedGuest(key:string,client:SessionController,expected?:CampaignSessionScope):Promise<'revoked'|'waiting'|'skipped'|'not-due'> {
 return withGuestLease(key,async check=>{
  const record=await prisma.systemSetting.findUnique({where:{key}});if(!record)return 'not-due';
  const value=parseGuestSession(record.value);if(expected&&(value.campaignId!==expected.campaignId||value.wlanId!==expected.wlanId||value.ssid!==expected.ssid||value.site!==expected.site||value.connectionId!==expected.connectionId))return 'not-due';if(sessionKey(value)!==key)throw new CampaignHotspotError('Định danh phiên WiFi không khớp.',503);
  if(!value.resetRequired&&await readDeviceExemption(value))return 'not-due';
  if(value.state==='revoked'&&value.cachePending?.length&&client.clearGuestCache){const cachePending=await client.clearGuestCache(value,value.cachePending,check);await check();await saveGuestSession(key,{...value,cachePending});return cachePending.length?'waiting':'not-due';}
  if(value.state==='revoked'||value.state==='released'||(value.accessMode!=='exempt'&&value.state==='active'&&value.expiresAt>Date.now()))return 'not-due';
  if(value.state==='pending'&&value.accessMode!=='exempt'&&!value.resetRequired&&value.expiresAt>Date.now()&&(value.authorizationPendingUntil??0)>Date.now())return 'not-due';
  const live=uniqueStation(await client.siteRequest('stat/sta'),value.mac);
  const outside=live&&((live.essid??live.ssid)!==value.ssid||live.is_wired!==false||((live.wlanconf_id??live.wlan_id)&&(live.wlanconf_id??live.wlan_id)!==value.wlanId));
  const cacheScope=!outside&&live&&validMac(normalizeMac(live.ap_mac))?{...value,apMac:normalizeMac(live.ap_mac)}:value;
  // A browser may close as soon as Internet opens. Reconcile the accepted grant instead of undoing it.
  if(value.state==='pending'&&value.accessMode!=='exempt'&&!value.resetRequired&&value.expiresAt>Date.now()&&value.authorizationPendingUntil!==undefined&&live&&!outside&&live.authorized===true){
   let confirmed=false;try{confirmed=(await readUnifiPortalAssociation(client,value.connectionId,{mac:value.mac,ssid:value.ssid,apMac:cacheScope.apMac,unifiSite:value.site},value.wlanId,undefined,true)).authorized===true;}catch{}
   if(confirmed){await check();await saveGuestSession(key,{...cacheScope,state:'active'});return 'not-due';}
  }
  // A non-guest association must not retain this old campaign's site-wide guest grant. Never kick it.
  if(outside&&live.is_guest!==false)return 'skipped';
  if((outside&&value.state==='waiting'&&value.revokedAt)||(!live&&value.state==='waiting')){if((value.cachePending===undefined||value.cachePending.length>0)&&client.clearGuestCache){const cachePending=await client.clearGuestCache(value,value.cachePending,check);await check();await saveGuestSession(key,{...value,cachePending});}return 'waiting';}
  await check();if(!await client.unauthorizeGuest(value.mac))throw new CampaignHotspotError('Không thể thu hồi quyền WiFi.',502);
  const grants=stationRows(await client.siteRequest('stat/guest'));if(grants.some(g=>normalizeMac(g.mac)===value.mac&&g.expired===false))throw new CampaignHotspotError('Quyền guest vẫn còn hiệu lực; sẽ thử lại.',502);
  const cachePending=client.clearGuestCache?await client.clearGuestCache(cacheScope,value.cachePending,check):[];
  const beforeKick=uniqueStation(await client.siteRequest('stat/sta'),value.mac);
  if(beforeKick&&((beforeKick.essid??beforeKick.ssid)!==value.ssid||beforeKick.is_wired!==false||((beforeKick.wlanconf_id??beforeKick.wlan_id)&&(beforeKick.wlanconf_id??beforeKick.wlan_id)!==value.wlanId))){
   if(beforeKick.is_guest!==false)return 'skipped';
   await check();await saveGuestSession(key,{...value,state:'waiting',cachePending,revokedAt:Date.now()});return 'waiting';
  }
  let reconnected=false;
  if(client.reconnectGuest){const result=await client.reconnectGuest(cacheScope,check);if(result==='skipped')return 'skipped';reconnected=result==='reconnected';}
  else if(beforeKick){await check();if(!await client.kickClient(value.mac))throw new CampaignHotspotError('Không thể ngắt thiết bị WiFi.',502);}
  const after=uniqueStation(await client.siteRequest('stat/sta'),value.mac);
  if(after&&((after.essid??after.ssid)!==value.ssid||after.is_wired!==false))return 'skipped';
  if(after?.authorized===true)throw new CampaignHotspotError('Thiết bị vẫn còn quyền truy cập; sẽ thử lại.',502);
  const observed=Boolean(reconnected||live||beforeKick);
  await check();await saveGuestSession(key,{...cacheScope,state:observed?'revoked':'waiting',cachePending,revokedAt:Date.now()});
  return observed&&!cachePending.length?'revoked':'waiting';
 });
}

/** Ownership was deliberately relinquished: non-campaign WLANs must keep direct access. */
export async function releaseTimedGuest(key:string,expected:CampaignGuestSession):Promise<void>{
 await withGuestLease(key,async check=>{
  const row=await prisma.systemSetting.findUnique({where:{key}});if(!row)return;
  const current=parseGuestSession(row.value);
  if(sessionKey(current)!==key||current.campaignId!==expected.campaignId||current.wlanId!==expected.wlanId||current.ssid!==expected.ssid||current.authorizedAt!==expected.authorizedAt||current.expiresAt!==expected.expiresAt||current.state!==expected.state)return;
  await check();await saveGuestSession(key,{...current,state:'released'});
 });
}

/** Native UniFi guest grants are per site/MAC and can survive roaming to another campaign. */
export async function retargetExemptSession(key:string,expected:CampaignGuestSession,target:CampaignSessionScope,readLive:(confirmOnAp?:boolean)=>Promise<Record<string,unknown>>):Promise<CampaignGuestSession|null>{
 return withGuestLease(key,async check=>{
  const row=await prisma.systemSetting.findUnique({where:{key}});if(!row||sessionKey(target)!==key)return null;
  const current=parseGuestSession(row.value);
  if(current.accessMode!=='exempt'||current.state==='revoked'||current.campaignId!==expected.campaignId||current.wlanId!==expected.wlanId||current.authorizedAt!==expected.authorizedAt||current.expiresAt!==expected.expiresAt||current.state!==expected.state||await readDeviceExemption(current))return null;
  await readLive();const value:CampaignGuestSession={...current,...target,state:'pending',expiresAt:0};await check();await saveGuestSession(key,value);return value;
 });
}

export async function isGuestResetRequired(scope:Pick<CampaignSessionScope,'connectionId'|'site'|'mac'>):Promise<boolean>{const row=await prisma.systemSetting.findUnique({where:{key:sessionKey(scope)}});return row?parseGuestSession(row.value).resetRequired===true:false;}
