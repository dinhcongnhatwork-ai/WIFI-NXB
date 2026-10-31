import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterAll,beforeAll,it,expect} from 'vitest';
import {UnifiClient} from '@/lib/unifi';
let server:Server,origin:string;const requests:{path:string;body:any}[]=[];
beforeAll(async()=>{
 server=createServer((req,res)=>{let data='';req.on('data',b=>data+=b);req.on('end',()=>{requests.push({path:req.url!,body:JSON.parse(data||'{}')});res.writeHead(200,{'Content-Type':'application/json'});res.end('{"meta":{"rc":"ok"},"data":[]}');});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
it('sends the verified AP to the native UniFi guest command',async()=>{
 const client=new UnifiClient({controllerUrl:origin,site:'s1',apiMode:'legacy'});
 expect(await client.authorizeGuest('aa:bb:cc:dd:ee:ff',30,'22:33:44:55:66:88')).toBe(true);
 expect(requests[0]).toEqual({path:'/api/s/s1/cmd/stamgr',body:{cmd:'authorize-guest',mac:'aa:bb:cc:dd:ee:ff',minutes:30,ap_mac:'22:33:44:55:66:88'}});
 const before=requests.length;await expect(client.authorizeGuest('aa:bb:cc:dd:ee:ff',30,'bad;value')).rejects.toThrow();expect(requests.length).toBe(before);
});
