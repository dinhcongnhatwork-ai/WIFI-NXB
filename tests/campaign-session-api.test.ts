import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({role:'ADMIN',campaign:vi.fn(),find:vi.fn(),upsert:vi.fn(),audit:vi.fn(),queue:vi.fn()}));
vi.mock('@/lib/api-access',()=>({getIdentity:async()=>({id:'admin',username:'admin',role:m.role}),withPermission:(level:string,handler:any)=>async(...args:any[])=>m.role==='NONE'?new Response(null,{status:401}):(level==='admin'&&m.role!=='ADMIN'||level==='operate'&&m.role==='VIEWER')?new Response(null,{status:403}):handler(...args)}));
vi.mock('@/lib/prisma',()=>{const db={campaign:{findUnique:m.campaign},systemSetting:{findUnique:m.find,upsert:m.upsert},auditLog:{create:m.audit}};return {prisma:{...db,$transaction:async(fn:any)=>fn(db)}};});
vi.mock('@/lib/network/campaign-session-management',()=>({queueCampaignDisconnect:m.queue}));
import {GET,PUT,POST} from '@/app/api/campaigns/[id]/session-policy/route';
const context={params:{id:'c1'}};
const req=(method='GET',data?:unknown)=>new NextRequest('https://portal.test/api/campaigns/c1/session-policy',{method,...(data!==undefined?{body:JSON.stringify(data)}:{})});
beforeEach(()=>{vi.resetAllMocks();m.role='ADMIN';m.campaign.mockResolvedValue({id:'c1'});m.find.mockResolvedValue(null);m.queue.mockResolvedValue({queued:2});});
it('reads the existing default and saves 30/60 minute policies with audit, without kicking anyone implicitly',async()=>{
 expect((await(await GET(req(),context)).json()).data.sessionMinutes).toBe(240);
 for(const sessionMinutes of [30,60]){const r=await PUT(req('PUT',{sessionMinutes}),context);expect(r.status).toBe(200);expect((await r.json()).data.sessionMinutes).toBe(sessionMinutes);}
 expect(m.audit).toHaveBeenCalledTimes(2);expect(m.queue).not.toHaveBeenCalled();
});
it.each([0,-1,1.1,'30',1441,null])('rejects invalid policy input %s without changing storage',async sessionMinutes=>{expect((await PUT(req('PUT',{sessionMinutes}),context)).status).toBe(400);expect(m.upsert).not.toHaveBeenCalled();});
it('rejects missing campaigns, anonymous/read-only writes and non-admin disconnects',async()=>{
 m.campaign.mockResolvedValue(null);expect((await GET(req(),context)).status).toBe(404);
 m.role='NONE';expect((await PUT(req('PUT',{sessionMinutes:30}),context)).status).toBe(401);
 m.role='VIEWER';expect((await PUT(req('PUT',{sessionMinutes:30}),context)).status).toBe(403);
 m.role='OPERATOR';expect((await POST(req('POST'),context)).status).toBe(403);expect(m.queue).not.toHaveBeenCalled();
});
it('queues a reset only for the selected campaign',async()=>{const r=await POST(req('POST'),context);expect(r.status).toBe(202);expect(m.queue).toHaveBeenCalledWith('c1');expect((await r.json()).data.queued).toBe(2);});
