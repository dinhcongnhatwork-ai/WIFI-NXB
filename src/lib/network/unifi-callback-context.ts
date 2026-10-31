import {resolveConnection} from './connections';
import {configuredHotspotSites,hotspotClient} from './campaign-hotspot';
import {readManagedApSnapshot} from './ap-ssh';
import {CampaignHotspotError,GuestClientPendingError,normalizeMac,validMac} from './campaign-hotspot-policy';
const rows=(r:unknown):Record<string,any>[]=>{const data=(r as {data?:unknown})?.data;if(!Array.isArray(data))throw new GuestClientPendingError();return data;};
/** Older AP firmware omits ssid. Recover it from fresh station evidence, never from a default campaign. */
export async function resolveCallbackSsid(site:string,mac:string,apMac:string):Promise<string>{
 if(!validMac(mac)||!validMac(apMac))throw new CampaignHotspotError('Định danh WiFi không hợp lệ.');
 const connection=await resolveConnection('UNIFI');
 if(!configuredHotspotSites(connection).includes(site))throw new CampaignHotspotError('Site WiFi không được quản lý.');
 const client=hotspotClient(connection,site);
 let devices:Record<string,any>[],settings:Record<string,any>[],snapshot:Record<string,any>;
 try{
  [devices,settings]=await Promise.all([client.siteRequest('stat/device').then(rows),client.siteRequest('get/setting').then(rows)]);
  const aps=devices.filter(d=>d.type==='uap'&&d.state===1&&normalizeMac(d.mac)===apMac),mgmt=settings.find(s=>s.key==='mgmt');
  if(aps.length!==1||!mgmt)throw new GuestClientPendingError();
  snapshot=await readManagedApSnapshot({connectionId:connection.id,site,apMac,host:aps[0].ip,username:mgmt.x_ssh_username??mgmt.ssh_username,password:mgmt.x_ssh_password??mgmt.ssh_password}) as Record<string,any>;
 }catch{throw new GuestClientPendingError();}
 if(normalizeMac(snapshot?.mac)!==apMac||!Array.isArray(snapshot.vap_table))throw new CampaignHotspotError('Điểm phát không khớp kết nối WiFi.');
 const matches=snapshot.vap_table.filter((v:any)=>Array.isArray(v.sta_table)&&v.sta_table.some((s:any)=>normalizeMac(s.mac)===mac));
 if(!matches.length)throw new GuestClientPendingError();
 if(matches.length!==1)throw new CampaignHotspotError('Kết nối WiFi không rõ định danh.');
 const vap=matches[0],ap=devices.find(d=>normalizeMac(d.mac)===apMac);
 if(vap.up!==true||vap.state!=='RUN'||typeof vap.essid!=='string'||!vap.essid.trim()||vap.essid.length>128||!ap?.vap_table?.some((v:any)=>(v.id??v.wlanconf_id)===vap.id&&v.essid===vap.essid&&v.is_guest===true))throw new CampaignHotspotError('Thiết bị không thuộc WiFi portal.');
 return vap.essid;
}
