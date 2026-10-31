import { prisma } from '@/lib/prisma';
import { UnifiClient, registerUnifiConfigResolver } from '@/lib/unifi';
import { registerMikrotikConfigResolver } from '@/lib/mikrotik';
import { resolveConnection } from '@/lib/network/connections';
import { AccessError } from '@/lib/api-access';
export interface UnifiSystemConfig {controllerUrl:string;username:string;password?:string;site:string;apiKey?:string;apiMode?:'legacy'|'official';apiPrefix?:string;version?:string|null;rejectUnauthorized?:boolean}
export interface MikrotikSystemConfig {host:string;port:number;username:string;password?:string;allowInsecure:boolean}
const cache=new Map<string,{value:any;expiresAt:number}>();
let defaultUnifi:UnifiSystemConfig|undefined;let defaultMikrotik:MikrotikSystemConfig|undefined;
export async function getSystemSetting<T>(key:string,fallback:T):Promise<T>{const cached=cache.get(key);if(cached&&cached.expiresAt>Date.now())return cached.value;const record=await prisma.systemSetting.findUnique({where:{key}});const value=record?.value??fallback;cache.set(key,{value,expiresAt:Date.now()+30000});return value as T;}
export async function saveSystemSetting<T>(key:string,value:T):Promise<void>{if(key==='unifi'||key==='mikrotik')throw new AccessError(400,'Lưu kết nối thiết bị qua /api/network/connections.');await prisma.systemSetting.upsert({where:{key},create:{key,value:value as any},update:{value:value as any}});cache.set(key,{value,expiresAt:Date.now()+30000});}
export function getCachedUnifiConfig():UnifiSystemConfig{return defaultUnifi||{controllerUrl:process.env.UNIFI_CONTROLLER_URL||'',username:process.env.UNIFI_USERNAME||'',password:process.env.UNIFI_PASSWORD,site:process.env.UNIFI_SITE||'default',apiKey:process.env.UNIFI_API_KEY,rejectUnauthorized:true};}
export function getCachedMikrotikConfig():MikrotikSystemConfig{return defaultMikrotik||{host:process.env.MIKROTIK_HOST||process.env.MIKROTIK_IP||'',port:Number(process.env.MIKROTIK_PORT||443),username:process.env.MIKROTIK_USERNAME||process.env.MIKROTIK_USER||'',password:process.env.MIKROTIK_PASSWORD,allowInsecure:process.env.MIKROTIK_ALLOW_INSECURE==='true'};}
export async function getUnifiConfig():Promise<UnifiSystemConfig>{const c=await resolveConnection('UNIFI');defaultUnifi={controllerUrl:c.baseUrl,username:c.username||'',password:c.credentials.password,apiKey:c.credentials.apiKey,site:String(c.config.site||'default'),apiMode:c.config.apiMode==='legacy'?'legacy':c.config.apiMode==='official'?'official':undefined,apiPrefix:typeof c.config.apiPrefix==='string'?c.config.apiPrefix:undefined,version:c.version,rejectUnauthorized:c.config.allowInsecure!==true};return defaultUnifi;}
export async function getMikrotikConfig():Promise<MikrotikSystemConfig>{const c=await resolveConnection('MIKROTIK');const url=new URL(c.baseUrl);defaultMikrotik={host:c.baseUrl,port:Number(url.port||(url.protocol==='http:'?80:443)),username:c.username||'',password:c.credentials.password,allowInsecure:c.config.allowInsecure===true};return defaultMikrotik;}
export async function getUnifiClientFromRequest(req?:Request):Promise<UnifiClient>{
 const c=await resolveConnection('UNIFI',req);const params=req?new URL(req.url).searchParams:null;const explicit=params?.get('siteId')||params?.get('site');
 const site=explicit||String(c.config.site||'default');if(!/^[a-zA-Z\d_-]{1,100}$/.test(site))throw new AccessError(400,'Site không hợp lệ.');
 return new UnifiClient({controllerUrl:c.baseUrl,username:c.username||'',password:c.credentials.password||'',apiKey:c.credentials.apiKey,site,version:c.version,apiMode:c.config.apiMode==='legacy'?'legacy':c.config.apiMode==='official'?'official':undefined,apiPrefix:typeof c.config.apiPrefix==='string'?c.config.apiPrefix:undefined,rejectUnauthorized:c.config.allowInsecure!==true});
}
registerUnifiConfigResolver(()=>getCachedUnifiConfig());
registerMikrotikConfigResolver(()=>{const c=getCachedMikrotikConfig();return{host:c.host,username:c.username,password:c.password,allowInsecure:c.allowInsecure};});
