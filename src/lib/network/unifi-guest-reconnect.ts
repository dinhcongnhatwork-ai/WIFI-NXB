import {readManagedApSnapshot} from './ap-ssh';
import {CampaignHotspotError,normalizeMac} from './campaign-hotspot-policy';
import type {CampaignSessionScope} from './campaign-sessions';
interface Controller {siteRequest(path:string):Promise<unknown>;kickClient(mac:string):Promise<boolean>}
const rows=(r:unknown):Record<string,any>[]=>{const data=(r as {data?:unknown})?.data;if(!Array.isArray(data))throw new CampaignHotspotError('Không đọc được thông tin AP.',502);return data;};
/** A controller acknowledgement is not evidence that the radio actually disconnected the client. */
export async function reconnectUniFiGuest(client:Controller,scope:CampaignSessionScope,assertLease?:()=>Promise<void>,wait:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms))):Promise<'reconnected'|'offline'|'skipped'>{
 const [devices,settings]=await Promise.all([client.siteRequest('stat/device').then(rows),client.siteRequest('get/setting').then(rows)]);
 const aps=devices.filter(d=>d.type==='uap'&&d.state===1&&normalizeMac(d.mac)===scope.apMac),mgmt=settings.find(s=>s.key==='mgmt');
 if(aps.length!==1||!mgmt)throw new CampaignHotspotError('Chưa xác minh được điểm phát để kết nối lại.',502);
 const ap=aps[0];
 if(!ap.vap_table?.some((v:any)=>(v.id??v.wlanconf_id)===scope.wlanId&&v.essid===scope.ssid&&v.is_guest===true))return 'skipped';
 const input={connectionId:scope.connectionId,site:scope.site,apMac:scope.apMac,host:ap.ip,username:mgmt.x_ssh_username??mgmt.ssh_username,password:mgmt.x_ssh_password??mgmt.ssh_password};
 const observe=async()=>{
  const dump=await readManagedApSnapshot(input) as Record<string,any>;
  if(normalizeMac(dump?.mac)!==scope.apMac||!Array.isArray(dump.vap_table))throw new CampaignHotspotError('Điểm phát không khớp phiên WiFi.',502);
  const found=dump.vap_table.flatMap((v:any)=>Array.isArray(v.sta_table)?v.sta_table.filter((s:any)=>normalizeMac(s.mac)===scope.mac).map((s:any)=>({vap:v,station:s})):[]);
  if(found.length>1)throw new CampaignHotspotError('Kết nối trên AP không rõ định danh.',502);
  if(!found.length)return {state:'offline' as const,uptime:null};
  const {vap,station}=found[0];
  if(vap.id!==scope.wlanId||vap.essid!==scope.ssid||vap.up!==true||vap.state!=='RUN')return {state:'skipped' as const,uptime:null};
  if(station.authorized===true)throw new CampaignHotspotError('AP vẫn còn quyền Internet; sẽ thử thu hồi lại.',502);
  return {state:'connected' as const,uptime:typeof station.uptime==='number'&&Number.isFinite(station.uptime)&&station.uptime>=0?station.uptime:null};
 };
 const before=await observe();if(before.state!=='connected')return before.state;
 await assertLease?.();if(!await client.kickClient(scope.mac))throw new CampaignHotspotError('Điểm phát từ chối kết nối lại thiết bị.',502);
 for(let attempt=0;attempt<3;attempt++){
  if(attempt)await wait(750);await assertLease?.();const after=await observe();
  if(after.state==='offline')return 'reconnected';if(after.state==='skipped')return 'skipped';
  // The client can rejoin before the next read. A reset radio uptime proves a new association.
  if(before.uptime!==null&&after.uptime!==null&&after.uptime<before.uptime)return 'reconnected';
 }
 throw new CampaignHotspotError('AP chưa ngắt phiên WiFi cũ; hệ thống sẽ thử lại.',502);
}
