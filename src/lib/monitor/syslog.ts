import { open, readdir, stat } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { fingerprint } from './core';
import { persistLog } from './logs';
export interface TailCheckpoint {inode:string;offset:number;prefix:string;generation:string}
export function shouldReset(checkpoint:TailCheckpoint,size:number,prefix:string) { return size<checkpoint.offset || (checkpoint.prefix!==prefix && checkpoint.offset>0); }
export async function tailSyslog(path=process.env.MONITOR_SYSLOG_PATH||'/var/log/network/devices.ndjson') {
  const directory=dirname(path),base=basename(path);
  let names:string[];try{names=await readdir(directory);}catch(e:any){if(e.code==='ENOENT')return {available:false,lines:0};throw e;}
  const files=await Promise.all(names.filter(n=>n===base||n.startsWith(`${base}.`)).filter(n=>!n.endsWith('.gz')).map(async n=>({path:join(directory,n),info:await stat(join(directory,n))})));
  files.sort((a,b)=>a.info.mtimeMs-b.info.mtimeMs);
  let lines=0;
  for(const file of files){
    const inode=`${file.info.dev}:${file.info.ino}`,key=`syslog:${inode}`;
    const handle=await open(file.path,'r');
    try{
      const head=Buffer.alloc(Math.min(128,file.info.size));await handle.read(head,0,head.length,0);
      // Prefix only covers bytes already consumed, so append to a short file does not reset its checkpoint.
      const saved=await prisma.monitoringCheckpoint.findUnique({where:{key}});
      let cp=saved?.value as unknown as TailCheckpoint|undefined;
      const prefixLength=cp?Math.min(cp.offset,128):head.length;
      const prefix=fingerprint(head.subarray(0,prefixLength).toString('base64'));
      if(!cp||shouldReset(cp,file.info.size,prefix)) {
        cp={inode,offset:0,prefix:'',generation:fingerprint({inode,birth:file.info.birthtimeMs,changed:file.info.ctimeMs})};
        // Save the generation before any row is durable. A producer append changes ctime,
        // but replay after an offset-checkpoint failure must retain the same fingerprints.
        await prisma.monitoringCheckpoint.upsert({where:{key},create:{key,value:{...cp}},update:{value:{...cp}}});
      }
      const buffer=Buffer.alloc(Math.min(file.info.size-cp.offset,4*1024*1024));if(!buffer.length)continue;
      await handle.read(buffer,0,buffer.length,cp.offset);
      let consumed=0;
      while(lines<5000){const end=buffer.indexOf(10,consumed);if(end<0)break;
        const raw=buffer.subarray(consumed,end).toString('utf8');const offset=cp.offset+consumed;
        let row:any;try{row=JSON.parse(raw);}catch{row={message:raw,severity:'warning',parseError:true};}
        const severity=String(row.severity||row.level||'info').toLowerCase();
        await persistLog({source:'syslog',severity,message:String(row.message||row.MESSAGE||raw),occurredAt:row.timestamp||row.ISODATE,deviceId:row.host||row.HOST,metadata:{sender:row.sender||row.SOURCEIP,facility:row.facility,parseError:row.parseError||false},fingerprint:fingerprint({inode,generation:cp.generation,offset,raw})});
        consumed=end+1;lines++;
      }
      if(consumed){cp.offset+=consumed;cp.prefix=fingerprint(head.subarray(0,Math.min(cp.offset,128)).toString('base64'));await prisma.monitoringCheckpoint.upsert({where:{key},create:{key,value:{...cp}},update:{value:{...cp}}});}
    }finally{await handle.close();}
    if(lines>=5000)break;
  }
  return {available:files.length>0,lines};
}
