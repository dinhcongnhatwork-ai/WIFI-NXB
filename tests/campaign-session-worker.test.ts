import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn(),owned:vi.fn(),resolve:vi.fn(),request:vi.fn(),expire:vi.fn(),release:vi.fn(),retarget:vi.fn(),effective:vi.fn(),approval:vi.fn(),set:vi.fn(),eval:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{systemSetting:{findMany:m.find,findUnique:m.owned}}}));
vi.mock('@/lib/redis',()=>({redis:{set:m.set,eval:m.eval}}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/network/campaign-hotspot',()=>({configuredHotspotSites:()=>['s1'],hotspotClient:()=>({siteRequest:m.request}),controllerRows:(r:any)=>r.data,effectiveHotspotCampaigns:m.effective,readHotspotWlans:async()=> (await m.request('rest/wlanconf')).data}));
vi.mock('@/lib/network/campaign-sessions',async importOriginal=>({...await importOriginal<any>(),expireTimedGuest:m.expire,releaseTimedGuest:m.release,retargetExemptSession:m.retarget}));
vi.mock('@/lib/network/unifi-exempt-store',()=>({readDeviceExemption:m.approval}));
import {runCampaignSessionTick} from '@/lib/network/campaign-session-worker';
const session={version:1,state:'active',campaignId:'c',connectionId:'conn',site:'s1',wlanId:'w1',ssid:'Open',mac:'aa:bb:cc:dd:ee:ff',apMac:'11:22:33:44:55:66',authorizedAt:1,expiresAt:2};
beforeEach(()=>{
 vi.resetAllMocks();process.env.CAMPAIGN_HOTSPOT_ENABLED='true';process.env.APP_SERVER_MODE='backend';
 m.find.mockResolvedValue([{key:'campaignHotspot:session:conn:s1:'+session.mac,value:session}]);
 m.owned.mockResolvedValue({value:{version:1,connectionId:'conn',site:'s1',wlans:[{wlanId:'w1',originalGuest:false}]}});
 m.resolve.mockResolvedValue({id:'conn'});m.set.mockResolvedValue('OK');m.eval.mockResolvedValue(1);m.expire.mockResolvedValue('revoked');
 m.request.mockResolvedValue({data:[{_id:'w1',name:'Open',security:'open',enabled:true,is_guest:true}]});
});
it('expires durable due sessions on their owned open WLAN and emits operational status',async()=>{await runCampaignSessionTick();expect(m.expire).toHaveBeenCalledTimes(1);expect(m.set.mock.calls.some(c=>c[0]==='campaign-session:status'&&JSON.parse(c[1]).revoked===1)).toBe(true);});
it('never contacts a controller when all sessions are unexpired or the feature is off',async()=>{m.find.mockResolvedValue([{value:{...session,expiresAt:Date.now()+60000}}]);await runCampaignSessionTick();expect(m.resolve).not.toHaveBeenCalled();process.env.CAMPAIGN_HOTSPOT_ENABLED='false';await runCampaignSessionTick();expect(m.expire).not.toHaveBeenCalled();});
it('does not expire sessions on WPA, unowned, disabled or foreign-connection WLANs',async()=>{
 for(const patch of [{security:'wpapsk'},{is_guest:false},{enabled:false}]){m.request.mockResolvedValue({data:[{_id:'w1',name:'Open',security:'open',enabled:true,is_guest:true,...patch}]});await runCampaignSessionTick();}
 m.owned.mockResolvedValue(null);await runCampaignSessionTick();m.resolve.mockResolvedValue({id:'other'});await runCampaignSessionTick();expect(m.expire).not.toHaveBeenCalled();
});
it('retains failed expirations for the next tick and reports an error',async()=>{m.expire.mockRejectedValue(Error('offline'));await runCampaignSessionTick();expect(m.set.mock.calls.some(c=>c[0]==='campaign-session:status'&&JSON.parse(c[1]).status==='needs-attention')).toBe(true);});

it('retires due sessions after confirmed guest policy cleanup rather than blocking forever',async()=>{
 m.owned.mockResolvedValue({value:{version:1,connectionId:'conn',site:'s1',wlans:[]}});m.request.mockResolvedValue({data:[{_id:'w1',name:'Open',security:'open',enabled:true,is_guest:false}]});
 await runCampaignSessionTick();expect(m.release).toHaveBeenCalledTimes(1);expect(m.expire).not.toHaveBeenCalled();
 expect(m.set.mock.calls.some(c=>c[0]==='campaign-session:status'&&JSON.parse(c[1]).status==='healthy'&&JSON.parse(c[1]).released===1)).toBe(true);
});

it('revokes a removed exemption after roaming to a different campaign, including a released old ledger',async()=>{
 const old={...session,accessMode:'exempt',state:'released',expiresAt:Date.now()+86400000};
 m.find.mockResolvedValue([{key:'campaignHotspot:session:conn:s1:'+session.mac,value:old}]);m.approval.mockResolvedValue(null);
 m.owned.mockResolvedValue({value:{version:1,connectionId:'conn',site:'s1',wlans:[{wlanId:'w2',originalGuest:false}]}});
 const next={...old,state:'pending',expiresAt:0,campaignId:'c2',wlanId:'w2',ssid:'Open2'};m.retarget.mockResolvedValue(next);
 m.request.mockImplementation(async(path:string)=>({data:path==='stat/sta'?[{mac:session.mac,ap_mac:session.apMac,essid:'Open2',wlanconf_id:'w2',is_wired:false}]:[{_id:'w2',name:'Open2',security:'open',enabled:true,is_guest:true}]}));
 m.effective.mockResolvedValue([{id:'c2',ssid:'Open2',unifiSite:'s1',wlanConfId:'w2',active:true,startTime:new Date(Date.now()-1000),endTime:new Date(Date.now()+600000),template:{publishedRevision:{id:'r'}}}]);
 await runCampaignSessionTick();expect(m.retarget).toHaveBeenCalled();expect(m.expire).toHaveBeenCalledWith(expect.any(String),expect.anything(),next);
});
it('does not contact a controller for currently approved exemption ledgers',async()=>{
 m.find.mockResolvedValue([{key:'campaignHotspot:session:conn:s1:'+session.mac,value:{...session,accessMode:'exempt'}}]);m.approval.mockResolvedValue({enabled:true});
 await runCampaignSessionTick();expect(m.resolve).not.toHaveBeenCalled();
});
it('continues cache cleanup on revoked sessions with an offline AP pending',async()=>{
 m.find.mockResolvedValue([{key:'campaignHotspot:session:conn:s1:'+session.mac,value:{...session,state:'revoked',cachePending:['22:33:44:55:66:88']}}]);
 await runCampaignSessionTick();expect(m.expire).toHaveBeenCalledTimes(1);
});
it('does not race the portal by revoking a newly accepted grant during its confirmation window',async()=>{
 m.find.mockResolvedValue([{key:'campaignHotspot:session:conn:s1:'+session.mac,value:{...session,state:'pending',expiresAt:Date.now()+60000,authorizationPendingUntil:Date.now()+45000}}]);
 await runCampaignSessionTick();expect(m.expire).not.toHaveBeenCalled();expect(m.resolve).not.toHaveBeenCalled();
});
