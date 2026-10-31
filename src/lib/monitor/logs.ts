import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { fingerprint } from './core';
const secretNames='password|passwd|passphrase|secret|token|authorization|cookie|api[-_]?key|credential|wpa[-_]?psk|private[-_]?key|preshared[-_]?key|community';
const secretKey=new RegExp(secretNames,'i');
const secretAssignment=new RegExp(`((?:${secretNames})["']?\\s*[=:]\\s*)(?:"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\s,;}]+)`,'gi');
export function redactLog(value:unknown,depth=0):any {
  if(depth>8)return '[depth limit]';
  if(typeof value==='string') return value.replace(/\b(Bearer|Basic)\s+\S+/gi,'$1 [REDACTED]').replace(secretAssignment,'$1[REDACTED]').replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g,'$1[REDACTED]@').slice(0,12000);
  if(Array.isArray(value))return value.slice(0,100).map(v=>redactLog(v,depth+1));
  if(value instanceof Error)return {name:value.name,message:redactLog(value.message),stack:redactLog(value.stack)};
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,100).map(([k,v])=>[k,secretKey.test(k)?'[REDACTED]':redactLog(v,depth+1)]));
  return value;
}
export interface LogInput {source:string;severity:string;message:string;occurredAt?:string;connectionId?:string;deviceId?:string;metadata?:Record<string,unknown>;fingerprint?:string}
export async function persistLog(input:LogInput) {
  const safe=redactLog(input) as LogInput;
  const data={...safe,occurredAt:safe.occurredAt?new Date(safe.occurredAt):new Date(),metadata:JSON.parse(JSON.stringify(safe.metadata||{})) as Prisma.InputJsonValue};
  if(Number.isNaN(data.occurredAt.getTime())) data.occurredAt=new Date();
  if(safe.fingerprint) await prisma.operationalLog.upsert({where:{fingerprint:safe.fingerprint},create:data,update:{}});
  else await prisma.operationalLog.create({data});
}
export async function enqueueLog(input:LogInput) {
  const safe=redactLog({...input,occurredAt:input.occurredAt||new Date().toISOString(),fingerprint:input.fingerprint||randomUUID()});
  try { await redis.multi().lpush('monitor:logs',JSON.stringify(safe)).ltrim('monitor:logs',0,9999).exec(); }
  catch { process.stdout.write(`${JSON.stringify({...safe,queue:'unavailable'})}\n`); }
}
export async function drainLogs() {
  // RPOPLPUSH retains an in-flight entry until persistence succeeds, including across restart.
  for(let i=0;i<500;i++) {
    let value=await redis.lindex('monitor:logs:processing',-1);
    if(!value) value=await redis.rpoplpush('monitor:logs','monitor:logs:processing');
    if(!value)break;
    try {const row=JSON.parse(value);await persistLog({...row,fingerprint:row.fingerprint||fingerprint({queue:value})});await redis.lrem('monitor:logs:processing',1,value);}
    catch(error){throw new Error(`Operational log drain failed: ${error instanceof Error?error.name:'error'}`);}
  }
}
