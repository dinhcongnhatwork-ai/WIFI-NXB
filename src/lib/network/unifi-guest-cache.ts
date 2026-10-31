import {canonicalDeviceMac} from './unifi-exempt-policy';
import {purgeApGuestMac} from './ap-ssh';
import type {CampaignSessionScope} from './campaign-sessions';
interface Controller {siteRequest(path:string):Promise<unknown>}
const rows=(r:unknown)=>{const data=(r as {data?:unknown})?.data;if(!Array.isArray(data))throw Error('Invalid UniFi cache metadata');return data as Record<string,any>[];};
/** Only the target MAC on APs that advertise this exact campaign WLAN; never flush an AP set. */
export async function clearUniFiGuestCache(client:Controller,scope:CampaignSessionScope,pending?:string[],assertLease?:()=>Promise<void>):Promise<string[]>{
 const mac=canonicalDeviceMac(scope.mac);if(pending&&pending.length===0)return [];
 const [devices,settings]=await Promise.all([client.siteRequest('stat/device').then(rows),client.siteRequest('get/setting').then(rows)]);const mgmt=settings.find(s=>s.key==='mgmt');
 const targets=devices.filter(d=>d.type==='uap'&&(!pending||pending.includes(String(d.mac).toLowerCase()))&&Array.isArray(d.vap_table)&&d.vap_table.some((v:any)=>(v.id??v.wlanconf_id)===scope.wlanId&&v.essid===scope.ssid&&v.is_guest===true));
 if(targets.length&&(!mgmt||typeof(mgmt.x_ssh_username??mgmt.ssh_username)!=='string'||typeof(mgmt.x_ssh_password??mgmt.ssh_password)!=='string'))throw Error('AP cache verification requires configured device SSH credentials');
 const offline=new Set<string>(pending??[]);
 // Offline APs may omit vap_table entirely. Retain their MAC until their target WLAN can be verified.
 if(!pending)for(const ap of devices.filter(d=>d.type==='uap'&&d.state!==1))offline.add(canonicalDeviceMac(ap.mac));
 if(!pending)offline.add(canonicalDeviceMac(scope.apMac));
 // Revoke the connected AP first; other AP caches are durable follow-up work.
 const online=targets.filter(ap=>ap.state===1).sort((a,b)=>Number(canonicalDeviceMac(b.mac)===canonicalDeviceMac(scope.apMac))-Number(canonicalDeviceMac(a.mac)===canonicalDeviceMac(scope.apMac)));
 for(const ap of targets)offline.add(canonicalDeviceMac(ap.mac));
 const batch=online.slice(0,pending?3:1);
 const results=await Promise.allSettled(batch.map(async ap=>{
  const apMac=canonicalDeviceMac(ap.mac);
  await purgeApGuestMac({connectionId:scope.connectionId,site:scope.site,apMac,host:ap.ip,username:mgmt!.x_ssh_username??mgmt!.ssh_username,password:mgmt!.x_ssh_password??mgmt!.ssh_password,mac,assertLease});
  offline.delete(apMac);
 }));
 // A failed AP remains pending; it must not prevent revoking/kicking the connected device.
 if(results.some(result=>result.status==='rejected'))console.warn('[guest-cache] AP cleanup retained for retry',{failed:results.filter(result=>result.status==='rejected').length,pending:offline.size});
 return Array.from(offline).sort();
}
