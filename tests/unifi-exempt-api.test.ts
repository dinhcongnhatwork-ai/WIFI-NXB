import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({role:'ADMIN',rows:new Map<string,any>(),resolve:vi.fn(),audit:vi.fn(),lease:vi.fn(),failAudit:false}));
vi.mock('@/lib/api-access',()=>({getIdentity:async()=>({id:'admin',username:'admin',role:m.role}),withPermission:(level:string,fn:any)=>async(...args:any[])=>m.role==='NONE'?new Response(null,{status:401}):level==='admin'&&m.role!=='ADMIN'?new Response(null,{status:403}):fn(...args)}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/network/campaign-sessions',()=>({sessionKey:({connectionId,site,mac}:any)=>`${connectionId}:${site}:${mac}`,withGuestLease:async(key:string,fn:any)=>{m.lease(key);return fn(async()=>{});}}));
vi.mock('@/lib/prisma',()=>{
 const db={systemSetting:{findUnique:async({where}:any)=>m.rows.get(where.key)||null,findMany:async({where}:any)=>Array.from(m.rows.values()).filter((r:any)=>r.key.startsWith(where.key.startsWith)),upsert:async({where,create,update}:any)=>{m.rows.set(where.key,m.rows.has(where.key)?{key:where.key,value:update.value}:create);},delete:async({where}:any)=>m.rows.delete(where.key)},auditLog:{create:m.audit}};
 return {prisma:{...db,$transaction:async(fn:any)=>{const before=new Map(m.rows);try{return await fn(db);}catch(e){m.rows.clear();before.forEach((v,k)=>m.rows.set(k,v));throw e;}}}};
});
import {GET,POST} from '@/app/api/unifi/exempt-devices/route';
import {PUT,DELETE} from '@/app/api/unifi/exempt-devices/[mac]/route';
const mac='aa:bb:cc:dd:ee:ff';const device={ownerName:'Đinh Công Nhất',deviceName:'Laptop',mac,enabled:true};
const context={params:{mac}};
const req=(method='GET',body?:any,query='connectionId=conn&siteId=s1')=>new NextRequest('https://portal.test/api/unifi/exempt-devices?'+query,{method,...(body?{body:JSON.stringify(body)}:{})});
beforeEach(()=>{vi.resetAllMocks();m.rows.clear();m.role='ADMIN';m.resolve.mockResolvedValue({id:'conn',isDefault:true,config:{site:'s1'}});});
it('approves normalized devices with server-owned scope and actor, reads only this site and audits changes',async()=>{
 const r=await POST(req('POST',{devices:[{...device,mac:'AABB.CCDD.EEFF',connectionId:'evil',approvedBy:'evil'}]}));expect(r.status).toBe(201);
 const data=(await(await GET(req())).json()).data;expect(data).toHaveLength(1);expect(data[0]).toMatchObject({...device,approvedBy:'admin',connectionId:'conn',site:'s1'});expect(m.audit).toHaveBeenCalledTimes(1);expect(m.lease).toHaveBeenCalled();
 expect((await PUT(req('PUT',{...device,enabled:false}),context)).status).toBe(200);
 expect((await(await GET(req())).json()).data[0].enabled).toBe(false);
 expect((await DELETE(req('DELETE'),context)).status).toBe(200);expect(m.rows.size).toBe(0);
});
it('rejects unauthorized approval, duplicate input/existing MAC and unknown or unmanaged scope',async()=>{
 m.role='OPERATOR';expect((await POST(req('POST',{devices:[device]}))).status).toBe(403);m.role='NONE';expect((await GET(req())).status).toBe(401);m.role='ADMIN';
 expect((await POST(req('POST',{devices:[device,device]}))).status).toBe(400);expect(m.rows.size).toBe(0);
 await POST(req('POST',{devices:[device]}));expect((await POST(req('POST',{devices:[device]}))).status).toBe(409);
 expect((await GET(req('GET',null,'connectionId=conn&siteId=other'))).status).toBe(400);
 m.resolve.mockResolvedValue({id:'conn',isDefault:false,config:{site:'s1'}});expect((await GET(req())).status).toBe(400);
});
it('rolls back the whole bulk approval if audit persistence fails; never changes a MAC in place',async()=>{
 m.audit.mockRejectedValueOnce(Error('DB'));expect((await POST(req('POST',{devices:[device]}))).status).toBe(500);expect(m.rows.size).toBe(0);
 await POST(req('POST',{devices:[device]}));expect((await PUT(req('PUT',{...device,mac:'02:22:33:44:55:66'}),context)).status).toBe(400);expect(m.rows.size).toBe(1);
});
