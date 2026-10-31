import {EventEmitter} from 'node:events';
import type {Duplex,Readable} from 'node:stream';
import {isIP} from 'node:net';
import {prisma} from '@/lib/prisma';
import {canonicalDeviceMac} from './unifi-exempt-policy';
interface Channel extends Duplex {stderr:Readable}
interface Ssh extends EventEmitter {connect(options:Record<string,unknown>):void;exec(command:string,callback:(error:Error|undefined,stream:Channel)=>void):void;end():void;destroy():void}
const {Client}=require('ssh2') as {Client:new()=>Ssh};
export interface ManagedApConnection {connectionId:string;site:string;apMac:string;host:string;username:string;password:string;assertLease?:()=>Promise<void>}
export interface ApGuestPurge extends ManagedApConnection {mac:string}
export function guestMacDeleteInput(mac:string):string{return `del guest_authorized_mac ${canonicalDeviceMac(mac)}\n`;}
/** Authenticated AP identity and pinned SSH host key precede all managed AP operations. */
async function withManagedAp<T>(input:ManagedApConnection,work:(run:(command:string,stdin?:string)=>Promise<string>,identity:string)=>Promise<T>,identityCommand:'mca-cli-op info'|'mca-dump'='mca-cli-op info'):Promise<T>{
 const apMac=canonicalDeviceMac(input.apMac);
 if(isIP(input.host)!==4||!(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(input.host))||![input.connectionId,input.site].every(v=>/^[a-zA-Z\d_-]{1,100}$/.test(v))||!input.username||!input.password)throw Error('Invalid managed AP connection');
 const key=`unifi:ap-host:${input.connectionId}:${input.site}:${apMac}`;const stored=await prisma.systemSetting.findUnique({where:{key}});const expected=(stored?.value as {sha256?:unknown}|undefined)?.sha256;
 if(stored&&(typeof expected!=='string'||!/^[a-f\d]{64}$/.test(expected)))throw Error('Invalid AP SSH host identity');
 const connection=new Client();let fingerprint='';
 const run=(command:string,stdin='')=>new Promise<string>((resolve,reject)=>{
  const timer=setTimeout(()=>{connection.destroy();reject(Error('AP cache operation timed out'));},5000);
  connection.exec(command,(error,channel)=>{
   if(error){clearTimeout(timer);reject(Error('AP cache command unavailable'));return;}
   let output='';channel.on('data',(chunk:Buffer)=>{output+=chunk.toString();if(output.length>2*1024*1024){connection.destroy();clearTimeout(timer);reject(Error('AP response too large'));}});channel.stderr.on('data',()=>{});
   channel.on('error',()=>{clearTimeout(timer);reject(Error('AP cache command failed'));});channel.on('close',(code:number)=>{clearTimeout(timer);if(code===0)resolve(output);else reject(Error('AP cache command refused'));});channel.end(stdin);
  });
 });
 try{
  await new Promise<void>((resolve,reject)=>{connection.once('ready',resolve);connection.on('error',()=>reject(Error('Cannot authenticate managed AP')));connection.connect({host:input.host,port:22,username:input.username,password:input.password,readyTimeout:5000,hostHash:'sha256',hostVerifier:(hash:string)=>{fingerprint=hash;return !expected||hash===expected;}});});
  const info=await run(identityCommand);const actual=identityCommand==='mca-dump'?String(JSON.parse(info)?.mac||'').toLowerCase():/MAC(?: Address)?:\s*([a-f\d:]{17})/i.exec(info)?.[1]?.toLowerCase();if(actual!==apMac||!/^[a-f\d]{64}$/.test(fingerprint))throw Error('Managed AP identity mismatch');
  if(!stored){
   try{await prisma.systemSetting.create({data:{key,value:{version:1,sha256:fingerprint}}});}catch{const concurrent=await prisma.systemSetting.findUnique({where:{key}});if((concurrent?.value as {sha256?:unknown}|undefined)?.sha256!==fingerprint)throw Error('AP SSH identity changed');}
  }
  return await work(run,info);
 }finally{connection.end();}
}
/** Read-only, fresh station evidence from this exact authenticated AP. */
export async function readManagedApSnapshot(input:ManagedApConnection):Promise<unknown>{
 return withManagedAp(input,async(_run,identity)=>JSON.parse(identity),'mca-dump');
}
export async function purgeApGuestMac(input:ApGuestPurge):Promise<void>{
 const mac=canonicalDeviceMac(input.mac);
 await withManagedAp(input,async run=>{
  await input.assertLease?.();await run('ipset -exist restore',guestMacDeleteInput(mac));const remaining=await run('ipset list guest_authorized_mac');
  if(!remaining.includes('Name: guest_authorized_mac')||remaining.toLowerCase().split(/\s+/).includes(mac))throw Error('AP still retains guest authorization');
 });
}
