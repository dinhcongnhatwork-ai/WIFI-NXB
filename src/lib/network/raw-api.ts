import { NextRequest, NextResponse } from 'next/server';
import { AccessError, withPermission } from '@/lib/api-access';
import { networkChange, redact } from './audit';
import { connectionAdapter } from './resource-api';
import { validateRelativePath } from './paths';
import type { Provider } from './resources';
function pathFor(provider:Provider,value:unknown){
 if(typeof value!=='string')throw new AccessError(400,"Cần đường dẫn API");
 try{validateRelativePath(value);}catch(error){throw new AccessError(400,(error as Error).message);}
 if(provider==='unifi'&&!/^\/(api|proxy\/network\/api|integration\/v1|proxy\/network\/integration\/v1)\//.test(value))throw new AccessError(400,"Yêu cầu UniFi phải dùng đường dẫn API Network");
 return value;
}
export function rawHandlers(provider:Provider){
 const GET=withPermission('admin',async(req:NextRequest)=>{const path=pathFor(provider,req.nextUrl.searchParams.get('path'));const {adapter}=await connectionAdapter(provider,req);return NextResponse.json({success:true,data:redact(await adapter.request(path))});});
 const POST=withPermission('admin',async(req:NextRequest)=>{
  const body=await req.json();const path=pathFor(provider,body.path);const method=String(body.method||'GET').toUpperCase();
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))throw new AccessError(400,"Phương thức HTTP không hỗ trợ");
  const {adapter,connection}=await connectionAdapter(provider,req);
  if(method==='GET')return NextResponse.json({success:true,data:redact(await adapter.request(path))});
  if(body.confirmed!==true)throw new AccessError(400,"Xem trước và xác nhận trước khi thay đổi cấu hình");
  const outcome=await networkChange(req,{action:`${provider}.raw.${method}`,connectionId:connection.id,execute:()=>adapter.request(path,method,body.payload),verify:async()=>{
   // A successful arbitrary command cannot be semantically verified from HTTP success.
   try{return {verified:false,value:await adapter.request(path)};}catch{return {verified:false,value:"Không thể đọc lại kết quả lệnh API này"};}
  }});
  return NextResponse.json({success:true,data:redact(outcome.result),status:outcome.status,auditId:outcome.auditId});
 });return {GET,POST};
}
