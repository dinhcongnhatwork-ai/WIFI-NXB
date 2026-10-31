import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getIdentity } from '@/lib/api-access';
import { redactSecrets } from './secrets';
export const redact = redactSecrets;
export interface AuditInput {actorId:string;actorName:string;action:string;connectionId?:string;deviceId?:string;before?:unknown;after?:unknown;status:string;error?:string}
const json=(value:unknown)=>value===undefined||value===null?Prisma.JsonNull:redact(value) as Prisma.InputJsonValue;
export async function recordAudit(input:AuditInput):Promise<void>{
  await prisma.auditLog.create({data:{...input,before:json(input.before),after:json(input.after),error:input.error?redact(input.error):undefined}});
}
export interface NetworkChange {
  action:string;connectionId?:string;deviceId?:string;
  before?:()=>Promise<unknown>;
  execute:()=>Promise<unknown>;
  verify?:(result:unknown)=>Promise<{verified:boolean;value?:unknown}>;
}
export async function networkChange(req:NextRequest,change:NetworkChange):Promise<{result:unknown;status:string;auditId:string}>{
  const actor=await getIdentity(req);
  const before=change.before?await change.before():undefined;
  // Persist intent before sending a write: lack of audit storage prevents unaudited mutations.
  const entry=await prisma.auditLog.create({data:{actorId:actor.id,actorName:actor.username,action:change.action,connectionId:change.connectionId,deviceId:change.deviceId,before:json(before),status:'applying'}});
  let executed=false;
  try{
    executed=true; const result=await change.execute();
    if(result===false || (result && typeof result==='object' && (result as {success?:unknown}).success===false))throw new Error('Thiết bị từ chối thay đổi.');
    let status='accepted'; let after:unknown=result;
    if(change.verify){try{const verification=await change.verify(result);status=verification.verified?'verified':'uncertain';after=verification.value;}catch{status='uncertain';}}
    await prisma.auditLog.update({where:{id:entry.id},data:{status,after:json(after)}});
    return {result,status,auditId:entry.id};
  }catch(error){
    const ambiguous=executed&&error instanceof Error&&/timeout|abort|fetch failed|ECONNRESET|socket|network/i.test(error.message);
    await prisma.auditLog.update({where:{id:entry.id},data:{status:ambiguous?'uncertain':'failed',error:redact(error instanceof Error?error.message:String(error))}});
    throw error;
  }
}
