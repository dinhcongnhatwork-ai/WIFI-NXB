import {readManagedApSnapshot} from './ap-ssh';
import {CampaignHotspotError,GuestClientPendingError,normalizeMac,validGuestClient,type GuestContext} from './campaign-hotspot-policy';
interface Controller {siteRequest(path:string):Promise<unknown>}
const rows=(response:unknown):Record<string,any>[]=>{
 const data=(response as {data?:unknown})?.data;
 if(!Array.isArray(data)||data.some(row=>!row||typeof row!=='object'))throw new CampaignHotspotError('Invalid UniFi association response',502);
 return data;
};
/** An AP redirect is only a hint: the AP must independently attest this MAC on this exact WLAN. */
export function stationFromApSnapshot(snapshot:unknown,context:GuestContext,wlanId:string):Record<string,unknown>{
 const dump=snapshot as Record<string,any>;
 if(!dump||normalizeMac(dump.mac)!==normalizeMac(context.apMac)||!Array.isArray(dump.vap_table))throw new CampaignHotspotError('AP identity does not match the WiFi connection',502);
 const matches=dump.vap_table.flatMap((vap:Record<string,any>)=>Array.isArray(vap.sta_table)?vap.sta_table.filter((s:Record<string,any>)=>normalizeMac(s.mac)===normalizeMac(context.mac)).map((station:Record<string,any>)=>({vap,station})):[]);
 if(!matches.length)throw new GuestClientPendingError();
 if(matches.length!==1)throw new CampaignHotspotError('Ambiguous live AP association');
 const {vap,station}=matches[0];
 if(vap.id!==wlanId||vap.essid!==context.ssid||vap.up!==true||vap.state!=='RUN')throw new CampaignHotspotError('Live AP association does not match the campaign WLAN');
 return validGuestClient({...context},[{mac:station.mac,ap_mac:dump.mac,essid:vap.essid,wlanconf_id:vap.id,is_wired:false,authorized:station.authorized===true,ip:station.ip}],context.unifiSite);
}
/** The controller can lag association and grant propagation. Fresh AP evidence avoids waiting for an inform. */
export async function readUnifiPortalAssociation(client:Controller,connectionId:string,context:GuestContext,wlanId:string,initialStations?:Record<string,unknown>[],confirmOnAp=false):Promise<Record<string,unknown>>{
 let live:Record<string,unknown>|undefined;
 try{live=validGuestClient(context,initialStations??rows(await client.siteRequest('stat/sta')),context.unifiSite);}
 catch(error){if(!(error instanceof GuestClientPendingError))throw error;}
 if(live&&(live.wlanconf_id??live.wlan_id)&&(live.wlanconf_id??live.wlan_id)!==wlanId)throw new CampaignHotspotError('Live client WLAN does not match the campaign');
 if(live?.authorized===true&&!confirmOnAp)return live;
 let snapshot:unknown;
 try{
  const [devices,settings]=await Promise.all([client.siteRequest('stat/device').then(rows),client.siteRequest('get/setting').then(rows)]);
  const aps=devices.filter(d=>d.type==='uap'&&d.state===1&&normalizeMac(d.mac)===normalizeMac(context.apMac));const mgmt=settings.find(s=>s.key==='mgmt');
  if(aps.length!==1||!mgmt)throw Error('Managed AP unavailable');
  snapshot=await readManagedApSnapshot({connectionId,site:context.unifiSite,apMac:context.apMac,host:aps[0].ip,username:mgmt.x_ssh_username??mgmt.ssh_username,password:mgmt.x_ssh_password??mgmt.ssh_password});
 }catch{
  // Existing supported controller verification remains available when AP SSH is unavailable.
  if(live)return live;
  throw new GuestClientPendingError();
 }
 return stationFromApSnapshot(snapshot,context,wlanId);
}
