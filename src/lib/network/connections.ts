import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AccessError } from '@/lib/api-access';
import { decryptCredentials, encryptCredentials, redactSecrets, type ConnectionCredentials } from './secrets';
export type NetworkProvider='UNIFI'|'MIKROTIK';
export interface ResolvedConnection {id:string;provider:NetworkProvider;name:string;baseUrl:string;username:string|null;config:Record<string,unknown>;credentials:ConnectionCredentials;version:string|null;isDefault:boolean}
export function normalizeBaseUrl(input:string):string {
  let url:URL;try{url=new URL(input.trim());}catch{throw new AccessError(400,'Địa chỉ phải có giao thức http:// hoặc https://.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||url.search||!url.hostname||url.pathname!=='/')throw new AccessError(400,'Địa chỉ kết nối chỉ gồm giao thức, máy chủ và cổng; không chứa mật khẩu hoặc đường dẫn.');
  return url.origin;
}
export function publicConnection(row:any){
  return {id:row.id,provider:row.provider,name:row.name,baseUrl:row.baseUrl,username:row.username,config:redactSecrets(row.config),isDefault:row.isDefault,version:row.version,status:row.status,lastSyncAt:row.lastSyncAt,lastError:row.lastError?redactSecrets(row.lastError):null,capabilities:redactSecrets(row.capabilities),hasCredentials:Boolean(row.encryptedCredentials)};
}
export async function importLegacyConnection(provider:NetworkProvider) {
  const existing=await prisma.networkConnection.findFirst({where:{provider},orderBy:{createdAt:'asc'}});
  if(existing)return existing;
  if(provider==='MIKROTIK'&&process.env.MIKROTIK_IMPORT_LEGACY==='false')return null;
  const migrationKey=`networkImport:${provider}`;
  const marker=await prisma.systemSetting.findUnique({where:{key:migrationKey}});
  if((marker?.value as {completed?:boolean}|null)?.completed)return null;
  const key=provider==='UNIFI'?'unifi':'mikrotik';
  const setting=await prisma.systemSetting.findUnique({where:{key}});
  const data=(setting?.value && typeof setting.value==='object'?setting.value:{}) as Record<string,any>;
  if(data.migratedConnectionId)return null;
  let baseUrl:string|undefined;
  if(provider==='UNIFI')baseUrl=data.controllerUrl||process.env.UNIFI_CONTROLLER_URL;
  else{
    const host=data.host||process.env.MIKROTIK_HOST||process.env.MIKROTIK_IP;
    if(host){const port=Number(data.port||process.env.MIKROTIK_PORT||443);const url=new URL(/^https?:\/\//i.test(host)?host:`${port===80&&data.allowInsecure!==false?'http':'https'}://${host}`);if(!url.port&&port!==443&&port!==80)url.port=String(port);baseUrl=url.origin;}
  }
  if(!baseUrl)return null;
  const credentials:ConnectionCredentials={password:data.password||(provider==='UNIFI'?process.env.UNIFI_PASSWORD:process.env.MIKROTIK_PASSWORD),apiKey:data.apiKey||(provider==='UNIFI'?process.env.UNIFI_API_KEY:undefined)};
  // Import is deliberately unavailable until a deployment-specific key is configured.
  const encryptedCredentials=encryptCredentials(credentials);
  try{
    return await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('network-connections'))`;
      const current=await tx.networkConnection.findFirst({where:{provider},orderBy:{createdAt:'asc'}});if(current)return current;
      const marker=await tx.systemSetting.findUnique({where:{key:migrationKey}});
      if((marker?.value as {completed?:boolean}|null)?.completed)return null;
      const imported=await tx.networkConnection.create({data:{provider,name:provider==='UNIFI'?'UniFi Controller':'MikroTik mặc định',baseUrl:normalizeBaseUrl(baseUrl!),username:data.username||(provider==='UNIFI'?process.env.UNIFI_USERNAME:process.env.MIKROTIK_USERNAME||process.env.MIKROTIK_USER)||null,encryptedCredentials,isDefault:true,config:{site:data.site||process.env.UNIFI_SITE||'default',allowInsecure:data.allowInsecure??(provider==='UNIFI')} as Prisma.InputJsonValue}});
      if(setting){const {password,apiKey,...metadata}=data;await tx.systemSetting.update({where:{key},data:{value:{...metadata,migratedConnectionId:imported.id} as Prisma.InputJsonValue}});}
      await tx.systemSetting.upsert({where:{key:migrationKey},create:{key:migrationKey,value:{completed:true,connectionId:imported.id}},update:{value:{completed:true,connectionId:imported.id}}});
      return imported;
    });
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return prisma.networkConnection.findFirst({where:{provider},orderBy:{createdAt:'asc'}});
    throw error;
  }
}
export async function resolveConnection(provider:NetworkProvider,req?:Request,explicitId?:string):Promise<ResolvedConnection>{
  const id=explicitId|| (req?new URL(req.url).searchParams.get('connectionId'):null);
  let row=id?await prisma.networkConnection.findUnique({where:{id}}):await prisma.networkConnection.findFirst({where:{provider,isDefault:true}});
  if(id&&(!row||row.provider!==provider))throw new AccessError(404,'Không tìm thấy kết nối của nhà cung cấp đã chọn.');
  if(!row&&!id)row=await importLegacyConnection(provider);
  if(!row)throw new AccessError(503,`Chưa cấu hình kết nối ${provider}. Mở Cài đặt → Kết nối thiết bị.`);
  return {id:row.id,provider:row.provider as NetworkProvider,name:row.name,baseUrl:row.baseUrl,username:row.username,config:(row.config||{}) as Record<string,unknown>,credentials:decryptCredentials(row.encryptedCredentials),version:row.version,isDefault:row.isDefault};
}
export interface SaveConnectionInput {id?:string;provider:NetworkProvider;name:string;baseUrl:string;username?:string|null;credentials?:ConnectionCredentials;config?:Record<string,unknown>;isDefault?:boolean}
export async function saveConnection(input:SaveConnectionInput,actor:{id:string;username:string}){
  if(!['UNIFI','MIKROTIK'].includes(input.provider))throw new AccessError(400,'Nhà cung cấp không hợp lệ.');
  const name=typeof input.name==='string'?input.name.trim():'';
  if(!name||name.length>120)throw new AccessError(400,'Tên kết nối phải từ 1 đến 120 ký tự.');
  const baseUrl=normalizeBaseUrl(input.baseUrl||'');
  const acceptedConfig=['site','sites','allowInsecure','apiMode','apiPrefix','snmpEnabled','syslogEnabled'];
  const config=Object.fromEntries(Object.entries(input.config||{}).filter(([k])=>acceptedConfig.includes(k)));
  if(config.site!==undefined&&(typeof config.site!=='string'||!/^[a-zA-Z\d_-]{1,100}$/.test(config.site)))throw new AccessError(400,'Site không hợp lệ.');
  if(config.sites!==undefined){
    if(!Array.isArray(config.sites)||config.sites.length>100||config.sites.some(site=>typeof site!=='string'||!/^[a-zA-Z\d_-]{1,100}$/.test(site)))throw new AccessError(400,'Danh sách site giám sát không hợp lệ.');
    config.sites=Array.from(new Set(config.sites));
  }
  for(const field of ['allowInsecure','snmpEnabled','syslogEnabled'])if(config[field]!==undefined&&typeof config[field]!=='boolean')throw new AccessError(400,'Cấu hình trạng thái kết nối phải là giá trị boolean.');
  if(config.apiPrefix!==undefined&&config.apiPrefix!=='/proxy/network'&&config.apiPrefix!=='')throw new AccessError(400,'API prefix không hợp lệ.');
  if(config.apiMode!==undefined&&!['legacy','official','auto'].includes(String(config.apiMode)))throw new AccessError(400,'Chế độ API không hợp lệ.');
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('network-connections'))`;
    const current=input.id?await tx.networkConnection.findUnique({where:{id:input.id}}):null;
    if(input.id&&!current)throw new AccessError(404,'Kết nối không tồn tại.');
    if(current&&current.provider!==input.provider)throw new AccessError(400,'Không thể thay nhà cung cấp của kết nối.');
    if(input.provider==='UNIFI'&&!current&&await tx.networkConnection.findFirst({where:{provider:'UNIFI'}}))throw new AccessError(409,'Hệ thống hiện quản lý một UniFi Controller. Hãy sửa kết nối hiện có.');
    if(current?.isDefault&&input.isDefault===false)throw new AccessError(400,'Hãy đặt một kết nối khác làm mặc định trước.');
    const credentials=current?decryptCredentials(current.encryptedCredentials):{};
    for(const k of ['password','apiKey'] as const){const value=input.credentials?.[k];if(value!==undefined&&typeof value!=='string')throw new AccessError(400,'Thông tin xác thực không hợp lệ.');if(value?.trim())credentials[k]=value;}
    if(!credentials.password&&!credentials.apiKey)throw new AccessError(400,'Cần mật khẩu thiết bị hoặc UniFi API key.');
    const encryptedCredentials=encryptCredentials(credentials);
    const first=!(await tx.networkConnection.findFirst({where:{provider:input.provider}}));
    const isDefault=input.isDefault===true||current?.isDefault||first;
    if(isDefault)await tx.networkConnection.updateMany({where:{provider:input.provider,isDefault:true,...(current?{id:{not:current.id}}:{})},data:{isDefault:false}});
    const data={name,baseUrl,username:input.username?.trim()||null,encryptedCredentials,config:{...((current?.config||{}) as Record<string,unknown>),...config} as Prisma.InputJsonValue,isDefault,status:'unknown',lastError:null};
    const saved=current?await tx.networkConnection.update({where:{id:current.id},data}):await tx.networkConnection.create({data:{...data,provider:input.provider}});
    const migrationKey=`networkImport:${input.provider}`;
    await tx.systemSetting.upsert({where:{key:migrationKey},create:{key:migrationKey,value:{completed:true,connectionId:saved.id}},update:{value:{completed:true,connectionId:saved.id}}});
    await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.username,action:current?'connection.update':'connection.create',connectionId:saved.id,before:current?publicConnection(current) as Prisma.InputJsonValue:Prisma.JsonNull,after:publicConnection(saved) as Prisma.InputJsonValue,status:'verified'}});
    return saved;
  });
}
