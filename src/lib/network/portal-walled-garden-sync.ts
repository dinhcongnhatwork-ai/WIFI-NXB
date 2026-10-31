import {lookup} from 'node:dns/promises';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {ownedPortalAddresses,portalAddressPlan} from './portal-walled-garden';
import {controllerRows} from './campaign-hotspot';
interface PortalController {siteRequest(path:string,method?:string,body?:unknown):Promise<any>}
const refreshed=new Map<string,number>();
/** Called only inside the hotspot worker's renewable lease; modifies owned pre-auth IP entries only. */
export async function syncPortalWalledGarden(scopeKey:string,client:PortalController,assertLease:()=>Promise<void>):Promise<void>{
 const raw=process.env.NEXT_PUBLIC_APP_URL,expected=process.env.UNIFI_PORTAL_SERVER;if(!raw||!expected)return;
 if(!/^campaignHotspot:owned:[a-zA-Z\d_-]{1,100}:[a-zA-Z\d_-]{1,100}$/.test(scopeKey))throw Error('Invalid portal address scope');
 const target=new URL(raw);if(target.protocol!=='https:'||target.username||target.password)throw Error('Invalid portal origin');
 const cacheKey=scopeKey+':'+target.hostname;if((refreshed.get(cacheKey)||0)>Date.now()-300000)return;
 const key=scopeKey.replace('campaignHotspot:owned:','campaignHotspot:portalAddresses:');
 const [rows,stored]=await Promise.all([client.siteRequest('get/setting').then(controllerRows),prisma.systemSetting.findUnique({where:{key}})]);
 const settings=rows.filter(r=>r.key==='guest_access');if(settings.length!==1||settings[0].portal_enabled!==true||settings[0].auth!=='custom'||settings[0].custom_ip!==expected)throw Error('External portal configuration changed');
 // Only maintain the domain already explicitly allowed by the administrator.
 if(!Object.entries(settings[0]).some(([k,v])=>/^allowed_subnet_\d+$/.test(k)&&v===target.hostname))return;
 const state=stored?.value as {version:number;hostname:string;entries:unknown}|undefined;
 if(state&&(state.version!==1||state.hostname!==target.hostname))throw Error('Portal address ownership mismatch');
 const previous=state?ownedPortalAddresses(state.entries):[];
 const addresses=await lookup(target.hostname,{all:true,family:4});const plan=portalAddressPlan(settings[0],addresses.map(r=>r.address),previous);
 const save=async(entries:typeof previous)=>{
  await assertLease();const value={version:1,hostname:target.hostname,entries:entries.map(e=>({...e}))} as Prisma.InputJsonValue;
  await prisma.systemSetting.upsert({where:{key},create:{key,value},update:{value}});
 };
 if(Object.keys(plan.patch).length){
  // Retain both values for replaced slots until readback: recover after an ambiguous write/restart.
  const intent=Array.from(new Map([...previous,...plan.entries].map(e=>[e.field+'='+e.value,e])).values());await save(intent);
  await assertLease();const response=await client.siteRequest('set/setting/guest_access','POST',plan.patch);if(response?.meta?.rc!=='ok')throw Error('Portal preauthorization update refused');
  const after=controllerRows(await client.siteRequest('get/setting')).filter(r=>r.key==='guest_access');
  if(after.length!==1||Object.entries(plan.patch).some(([k,v])=>(after[0][k]||'')!==v))throw Error('Portal preauthorization readback failed');
 }
 if(Object.keys(plan.patch).length||JSON.stringify(previous)!==JSON.stringify(plan.entries))await save(plan.entries);
 refreshed.set(cacheKey,Date.now());
}
