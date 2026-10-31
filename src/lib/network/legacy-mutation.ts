import { NextRequest, NextResponse } from 'next/server';
import { networkChange } from './audit';
import { resolveConnection } from './connections';
import { legacyReadUrl, verifyLegacyChange } from './legacy-verification';
/** Preserve legacy response shapes while auditing intent and comparing observed state. */
export function legacyMutation(provider:'UNIFI'|'MIKROTIK',handler:(req:NextRequest)=>Promise<Response>,read?:(req:NextRequest)=>Promise<Response>){
 return async(req:NextRequest)=>{
  const connection=await resolveConnection(provider,req);const body=await req.clone().json().catch(()=>({}));let before:any;
  const snapshot=async()=>{if(!read)return undefined;const response=await read(new NextRequest(legacyReadUrl(req.url,body),{headers:req.headers}));const value=await response.json();if(!response.ok||!value.success)throw new Error(value.error||'Không thể đọc lại trạng thái thiết bị');return value.data;};
  const change=await networkChange(req,{action:`${provider.toLowerCase()}.${String(body.type||body.action||'change')}`,connectionId:connection.id,deviceId:body.deviceId||body.id,
   before:read?async()=>{before=await snapshot();return before;}:undefined,
   execute:async()=>{const response=await handler(req);const result=await response.json();if(!response.ok||result.success===false||result.data===false)throw new Error(result.error||'Thiết bị từ chối thay đổi');return result;},
   verify:read?async(result)=>{const after=await snapshot();return {verified:verifyLegacyChange(provider,req.nextUrl.pathname,body,before,after,result),value:after};}:undefined,
  });
  return NextResponse.json({...change.result as object,status:change.status,auditId:change.auditId});
 };
}
