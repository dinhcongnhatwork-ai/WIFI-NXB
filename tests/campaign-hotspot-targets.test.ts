import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m=vi.hoisted(()=>({resolve:vi.fn(),request:vi.fn(),db:{campaign:{create:vi.fn(),findUnique:vi.fn(),update:vi.fn()}}}));
vi.mock('@/lib/prisma',()=>({prisma:m.db}));vi.mock('@/lib/auth',()=>({authenticateRequest:()=>({id:'admin'})}));
vi.mock('@/lib/api-access',()=>({withPermission:(_level:any,handler:any)=>handler}));vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/settings',()=>({getUnifiClientFromRequest:async()=>({login:async()=>{},getWlanConfs:async()=>[{_id:'w1',name:'Open'}],getSiteId:()=> 's1'})}));
vi.mock('@/lib/network/legacy-mutation',()=>({legacyMutation:(_p:any,h:any)=>h}));
vi.mock('@/lib/unifi',()=>({UnifiClient:class{siteRequest=m.request;}}));
import { POST as create } from '@/app/api/campaigns/route';
import { PUT as update } from '@/app/api/campaigns/[id]/route';
import { GET as ssids } from '@/app/api/unifi/ssids/route';
const data={name:'Campaign',ssid:'Open',templateId:'t',startTime:'2026-10-28T12:00:00Z',endTime:'2026-10-29T12:00:00Z',wlanConfId:'w1',unifiSite:'s1',active:true};
const req=(body:any)=>new NextRequest('https://app/api/campaigns',{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}});
beforeEach(()=>{vi.resetAllMocks();process.env.CAMPAIGN_HOTSPOT_ENABLED='true';m.resolve.mockResolvedValue({id:'conn',baseUrl:'https://controller',credentials:{},config:{site:'s1',sites:['s2']},isDefault:true});m.request.mockResolvedValue({data:[{_id:'w1',name:'Open',security:'open',enabled:true}]});m.db.campaign.create.mockImplementation(async({data}:any)=>data);m.db.campaign.update.mockImplementation(async({data}:any)=>data);m.db.campaign.findUnique.mockResolvedValue(data);});
describe('campaign targets',()=>{
 it('returns the actual resolved site with SSID choices',async()=>{expect(await(await ssids(new NextRequest('https://app/api/unifi/ssids'))).json()).toMatchObject({success:true,site:'s1'});});
 it('derives missing site from the configured connection and validates exact WLAN identity',async()=>{
  const response=await create(req({...data,unifiSite:undefined}));expect(response.status).toBe(201);expect((await response.json()).data.unifiSite).toBe('s1');
  for(const patch of [{unifiSite:'unknown'},{ssid:'Forged'},{wlanConfId:'other'}])expect((await create(req({...data,...patch}))).status).toBe(400);
 });
 it('persists reassigned site and WLAN on edit and rejects forged edit targets',async()=>{
  const response=await update(req({...data,unifiSite:'s2'}),{params:{id:'c'}});expect(response.status).toBe(200);expect((await response.json()).data).toMatchObject({unifiSite:'s2',wlanConfId:'w1'});
  expect((await update(req({ssid:'Forged'}),{params:{id:'c'}})).status).toBe(400);
 });
 it('allows disabling without a controller and preserves legacy creation when feature disabled',async()=>{
  m.resolve.mockRejectedValue(Error('offline'));expect((await update(req({active:false}),{params:{id:'c'}})).status).toBe(200);
  process.env.CAMPAIGN_HOTSPOT_ENABLED='false';expect((await create(req({...data,unifiSite:'legacy-site',ssid:'Legacy'}))).status).toBe(201);
 });
});
