import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({resolve:vi.fn(),garden:vi.fn(),request:vi.fn(),set:vi.fn(),eval:vi.fn(),
 db:{campaign:{findMany:vi.fn()},systemSetting:{findMany:vi.fn(),upsert:vi.fn()}}}));
vi.mock('@/lib/prisma',()=>({prisma:m.db}));vi.mock('@/lib/redis',()=>({redis:{set:m.set,eval:m.eval}}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));vi.mock('@/lib/unifi',()=>({UnifiClient:class{siteRequest=m.request;}}));
vi.mock('@/lib/network/portal-walled-garden-sync',()=>({syncPortalWalledGarden:m.garden}));
import { runCampaignHotspotTick } from '@/lib/network/campaign-hotspot-worker';
const c={id:'c',ssid:'Open',unifiSite:'s1',wlanConfId:'w1',active:true,startTime:new Date(Date.now()-3600000),endTime:new Date(Date.now()+3600000),template:{publishedRevision:{id:'r'}}};
let rows:any[];let owned:any[];
beforeEach(()=>{
 vi.resetAllMocks();process.env.APP_SERVER_MODE='backend';process.env.CAMPAIGN_HOTSPOT_ENABLED='true';process.env.UNIFI_PORTAL_SERVER='192.168.1.253';
 rows=[{_id:'w1',name:'Open',enabled:true,security:'open',is_guest:false}];owned=[];
 m.resolve.mockResolvedValue({id:'conn',baseUrl:'https://controller',credentials:{password:'p'},username:'u',config:{site:'s1'},isDefault:true});
 m.db.campaign.findMany.mockResolvedValue([c]);m.db.systemSetting.findMany.mockImplementation(async()=>owned);
 m.db.systemSetting.upsert.mockImplementation(async({where,update}:any)=>{owned=[{key:where.key,value:update.value}];return owned[0];});
 m.set.mockResolvedValue('OK');m.eval.mockResolvedValue(1);
 m.request.mockImplementation(async(path:string,method:string,body:any)=>{
  if(method==='PUT'){rows=rows.map(row=>({...row,...body}));return{meta:{rc:'ok'}};}
  return{data:path==='rest/wlanconf'?structuredClone(rows):[{key:'guest_access',portal_enabled:true,auth:'custom',custom_ip:'192.168.1.253'}]};
 });
});
describe('backend campaign hotspot worker boundary',()=>{
 it('does no device login or config writes without campaigns or durable ownership and publishes heartbeat',async()=>{
  m.db.campaign.findMany.mockResolvedValue([]);await runCampaignHotspotTick();expect(m.resolve).not.toHaveBeenCalled();expect(m.request).not.toHaveBeenCalled();expect(m.set.mock.calls.some(args=>args[0]==='campaign-hotspot:status'&&JSON.parse(args[1]).status==='idle')).toBe(true);
 });
 it('patches only is_guest and persists per-connection/site ownership before controller mutation',async()=>{
  await runCampaignHotspotTick();expect(rows[0].is_guest).toBe(true);expect(owned[0].value).toMatchObject({connectionId:'conn',site:'s1',wlans:[{wlanId:'w1',originalGuest:false}]});
  expect(m.db.systemSetting.upsert.mock.invocationCallOrder[0]).toBeLessThan(m.request.mock.invocationCallOrder[m.request.mock.calls.findIndex(args=>args[1]==='PUT')]);
  expect(m.request.mock.calls.filter(args=>args[1]==='PUT')).toEqual([['rest/wlanconf/w1','PUT',{is_guest:true}]]);
  m.db.campaign.findMany.mockResolvedValue([]);await runCampaignHotspotTick();expect(rows[0].is_guest).toBe(false);expect(owned[0].value.wlans).toEqual([]);
 });
 it('does not write WPA WLANs or enable guest when external portal is unready',async()=>{
  rows[0].security='wpapsk';await runCampaignHotspotTick();expect(m.request.mock.calls.filter(args=>args[1]==='PUT')).toEqual([]);
  rows[0].security='open';m.request.mockImplementation(async(path:string)=>({data:path==='rest/wlanconf'?rows:[{key:'guest_access',portal_enabled:true,auth:'custom',custom_ip:'wrong'}]}));await runCampaignHotspotTick();expect(m.db.systemSetting.upsert).not.toHaveBeenCalled();
 });
 it('skips when another process holds the lease and stops writes after lease loss',async()=>{
  m.set.mockImplementation(async(key:string)=>key==='campaign-hotspot:lock'?null:'OK');await runCampaignHotspotTick();expect(m.request).not.toHaveBeenCalled();
  m.set.mockResolvedValue('OK');m.eval.mockResolvedValue(0);await runCampaignHotspotTick();expect(m.request.mock.calls.filter(args=>args[1]==='PUT')).toEqual([]);expect(m.db.systemSetting.upsert).not.toHaveBeenCalled();
 });
 it('is opt in and never mutates unconfigured site ownership',async()=>{
  process.env.CAMPAIGN_HOTSPOT_ENABLED='false';await runCampaignHotspotTick();expect(m.db.campaign.findMany).not.toHaveBeenCalled();
  process.env.CAMPAIGN_HOTSPOT_ENABLED='true';m.db.campaign.findMany.mockResolvedValue([]);owned=[{key:'campaignHotspot:owned:conn:other',value:{version:1,connectionId:'conn',site:'other',wlans:[{wlanId:'w1',originalGuest:false}]}}];await runCampaignHotspotTick();expect(m.request).not.toHaveBeenCalled();expect(m.db.systemSetting.upsert).not.toHaveBeenCalled();
 });
});

it('reports ambiguous overlapping campaigns without enabling either campaign',async()=>{
 m.db.campaign.findMany.mockResolvedValue([c,{...c,id:'overlap'}]);await runCampaignHotspotTick();expect(rows[0].is_guest).toBe(false);
 expect(m.set.mock.calls.some(args=>args[0]==='campaign-hotspot:status'&&JSON.parse(args[1]).status==='needs-attention'&&JSON.parse(args[1]).ambiguousWlans===1)).toBe(true);
});

it('does not acquire a new guest WLAN if portal DNS/preauthorization sync fails, while retaining existing owned guest policy',async()=>{
 m.garden.mockRejectedValue(Error('DNS/readback/lease failure'));await runCampaignHotspotTick();expect(rows[0].is_guest).toBe(false);expect(m.request.mock.calls.filter(args=>args[1]==='PUT')).toEqual([]);
 rows[0].is_guest=true;owned=[{key:'campaignHotspot:owned:conn:s1',value:{version:1,connectionId:'conn',site:'s1',wlans:[{wlanId:'w1',originalGuest:false}]}}];await runCampaignHotspotTick();expect(rows[0].is_guest).toBe(true);expect(m.request.mock.calls.filter(args=>args[1]==='PUT')).toEqual([]);
 expect(m.set.mock.calls.some(args=>args[0]==='campaign-hotspot:status'&&JSON.parse(args[1]).portalDnsFailures===1)).toBe(true);
});
