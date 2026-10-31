import {beforeEach,it,expect,vi} from 'vitest';import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({role:'ADMIN',reset:vi.fn(),audit:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/api-access',()=>({getIdentity:async()=>({id:'admin',username:'admin'}),withPermission:(_level:string,fn:any)=>async(...args:any[])=>m.role==='ADMIN'?fn(...args):new Response(null,{status:403})}));
vi.mock('@/lib/prisma',()=>({prisma:{auditLog:{create:m.audit,update:m.update}}}));vi.mock('@/lib/network/campaign-session-management',()=>({resetCampaignWifi:m.reset}));
import {POST} from '@/app/api/campaigns/[id]/reset-wifi/route';
const req=()=>new NextRequest('https://portal.test/api/campaigns/c1/reset-wifi',{method:'POST'});const context={params:{id:'c1'}};
beforeEach(()=>{vi.resetAllMocks();m.role='ADMIN';m.audit.mockResolvedValue({id:'audit'});m.reset.mockResolvedValue({queued:2,revoked:2,waiting:0,skipped:0,failed:0});});
it('reports only verified resets as complete and records accurate pending/failed counts',async()=>{
 const response=await POST(req(),context);expect(response.status).toBe(200);expect((await response.json()).data.revoked).toBe(2);expect(m.reset).toHaveBeenCalledWith('c1');
 m.reset.mockResolvedValue({queued:3,revoked:1,waiting:1,skipped:0,failed:1});expect((await POST(req(),context)).status).toBe(202);expect(m.update.mock.calls.at(-1)![0].data.status).toBe('accepted');
});
it('requires admin and persists audit intent before any reset command',async()=>{
 m.role='OPERATOR';expect((await POST(req(),context)).status).toBe(403);expect(m.reset).not.toHaveBeenCalled();m.role='ADMIN';m.audit.mockRejectedValue(Error('DB'));expect((await POST(req(),context)).status).toBe(500);expect(m.reset).not.toHaveBeenCalled();
});
