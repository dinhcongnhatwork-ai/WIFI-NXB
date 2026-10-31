import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission,AccessError } from '@/lib/api-access';
import { resolveConnection } from '@/lib/network/connections';
import { redact } from '@/lib/network/audit';
export const dynamic='force-dynamic';
export const POST=withPermission('admin',async(req:NextRequest,{params}:{params:{id:string}})=>{
 const row=await prisma.networkConnection.findUnique({where:{id:params.id}});if(!row)throw new AccessError(404,'Kết nối không tồn tại.');
 const c=await resolveConnection(row.provider as 'UNIFI'|'MIKROTIK',undefined,row.id);
 try{
  let version:string|null=null;let capabilities:Record<string,unknown>={};
  if(c.provider==='UNIFI'){
   const {UnifiClient}=await import('@/lib/unifi');
   const client=new UnifiClient({controllerUrl:c.baseUrl,username:c.username||'',password:c.credentials.password||'',apiKey:c.credentials.apiKey,site:String(c.config.site||'default'),apiMode:c.config.apiMode as any,apiPrefix:c.config.apiPrefix as string,version:c.version||undefined,rejectUnauthorized:c.config.allowInsecure!==true});
   await client.login();const info=await client.getControllerInfo();version=String(info.version||'')||null;
   const sites=await client.getSites();capabilities={apiKey:Boolean(c.credentials.apiKey),siteCount:sites.length,apiMode:c.config.apiMode||'auto'};await client.logout().catch(()=>{});
  }else{
   const {MikrotikClient}=await import('@/lib/mikrotik');const client=new MikrotikClient({host:c.baseUrl,username:c.username||'',password:c.credentials.password||'',allowInsecure:c.config.allowInsecure===true});
   const resource=await client.getSystemResource();if(!resource)throw new Error('Không lấy được tài nguyên RouterOS. Kiểm tra dịch vụ REST và quyền tài khoản.');
   version=resource.version||null;const supported=Boolean(version&&Number(version.split('.')[0])>=7);capabilities={rest:supported,configuration:supported,reason:supported?null:'Cấu hình yêu cầu RouterOS 7 REST.'};
  }
  await prisma.networkConnection.update({where:{id:row.id},data:{version,capabilities:capabilities as any,status:'online',lastSyncAt:new Date(),lastError:null}});
  return NextResponse.json({success:true,data:{version,capabilities,status:'online',sampledAt:new Date().toISOString()}});
 }catch(error){const message=redact(error instanceof Error?error.message:String(error));await prisma.networkConnection.update({where:{id:row.id},data:{status:'error',lastError:message}});return NextResponse.json({success:false,error:message},{status:502});}
});
