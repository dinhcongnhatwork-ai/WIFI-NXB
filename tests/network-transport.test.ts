import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createServer,type Server} from 'node:https';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {deviceFetch} from '@/lib/network/transport';
let server:Server,folder:string,url:string;
beforeAll(async()=>{
 folder=mkdtempSync(join(tmpdir(),'wifi-device-tls-'));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(folder,'key.pem'),'-out',join(folder,'cert.pem'),'-subj','/CN=localhost','-days','1'],{stdio:'ignore'});
 server=createServer({key:readFileSync(join(folder,'key.pem')),cert:readFileSync(join(folder,'cert.pem'))},(_req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end('{"connected":true}');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));url=`https://127.0.0.1:${(server.address() as {port:number}).port}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(folder,{recursive:true,force:true});});
describe('per-connection device TLS policy',()=>{
 it('validates certificates even if a legacy deployment globally disabled verification',async()=>{
  const previous=process.env.NODE_TLS_REJECT_UNAUTHORIZED;process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
  try{await expect(deviceFetch(url,{},false)).rejects.toThrow();const response=await deviceFetch(url,{},true);expect(await response.json()).toEqual({connected:true});expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');}
  finally{if(previous===undefined)delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;else process.env.NODE_TLS_REJECT_UNAUTHORIZED=previous;}
 });
});
