import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({approved:vi.fn(),sessions:vi.fn(),resolve:vi.fn(),wlans:vi.fn(),campaigns:vi.fn(),request:vi.fn(),owned:vi.fn(),authorize:vi.fn(),set:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{systemSetting:{findUnique:m.owned,findMany:m.sessions}}}));
vi.mock('@/lib/redis',()=>({redis:{set:m.set}}));
vi.mock('@/lib/network/unifi-exempt-store',()=>({listDeviceExemptions:m.approved}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/network/campaign-hotspot',()=>({configuredHotspotSites:()=>['s1'],hotspotClient:()=>({siteRequest:m.request}),controllerRows:(r:any)=>r.data,readHotspotWlans:m.wlans,effectiveHotspotCampaigns:m.campaigns}));
vi.mock('@/lib/network/campaign-sessions',async original=>({...await original<any>(),authorizeTimedGuest:m.authorize}));
import {runUnifiExemptTick} from '@/lib/network/unifi-exempt-worker';
const mac='aa:bb:cc:dd:ee:ff',ap='22:33:44:55:66:77';let station:any;let wlan:any;let approval:any;
beforeEach(()=>{
 vi.resetAllMocks();process.env.CAMPAIGN_HOTSPOT_ENABLED='true';process.env.APP_SERVER_MODE='backend';
 approval={connectionId:'conn',site:'s1',mac,enabled:true};station={mac,essid:'Open',ap_mac:ap,is_wired:false,authorized:false};wlan={_id:'w1',name:'Open',security:'open',enabled:true,is_guest:true};
 m.sessions.mockResolvedValue([]);m.approved.mockImplementation(async()=>[approval]);m.resolve.mockResolvedValue({id:'conn'});m.wlans.mockImplementation(async()=>[wlan]);m.request.mockImplementation(async()=>({data:[station]}));
 m.campaigns.mockResolvedValue([{id:'c1',ssid:'Open',unifiSite:'s1',wlanConfId:'w1',active:true,startTime:new Date(Date.now()-1000),endTime:new Date(Date.now()+600000),template:{publishedRevision:{id:'r1'}}}]);
 m.owned.mockResolvedValue({value:{version:1,connectionId:'conn',site:'s1',wlans:[{wlanId:'w1',originalGuest:false}]}});
});
it('authorizes only an approved live wireless client on an owned effective open campaign',async()=>{
 await runUnifiExemptTick();expect(m.authorize).toHaveBeenCalledTimes(1);expect(m.authorize.mock.calls[0][0]).toMatchObject({mac,apMac:ap,campaignId:'c1',wlanId:'w1'});expect(m.authorize.mock.calls[0][4]).toBe(true);
 const readLive=m.authorize.mock.calls[0][3];station.essid='Password';await expect(readLive()).rejects.toThrow();
});
it.each(['disabled','other-site','other-controller','wired','password','no-owner','duplicate','other-wlan','no-campaign'])('never grants to %s',async scenario=>{
 if(scenario==='disabled')approval.enabled=false;if(scenario==='other-site')approval.site='other';if(scenario==='other-controller')approval.connectionId='other';if(scenario==='wired')station.is_wired=true;
 if(scenario==='password')wlan.security='wpapsk';if(scenario==='no-owner')m.owned.mockResolvedValue(null);if(scenario==='duplicate')m.request.mockResolvedValue({data:[station,{...station,essid:'Other'}]});if(scenario==='other-wlan')station.wlanconf_id='other';if(scenario==='no-campaign')m.campaigns.mockResolvedValue([]);
 await runUnifiExemptTick();expect(m.authorize).not.toHaveBeenCalled();
});
it('does not read controllers when the list is empty or on frontend',async()=>{
 m.approved.mockResolvedValue([]);await runUnifiExemptTick();expect(m.resolve).not.toHaveBeenCalled();
 process.env.APP_SERVER_MODE='frontend';await runUnifiExemptTick();expect(m.resolve).not.toHaveBeenCalled();
});

it('avoids per-device controller reads for a healthy durable exemption grant until renewal is needed',async()=>{
 station.authorized=true;
 m.sessions.mockResolvedValue([{key:'campaignHotspot:session:conn:s1:'+mac,value:{version:1,state:'active',accessMode:'exempt',campaignId:'c1',connectionId:'conn',site:'s1',wlanId:'w1',ssid:'Open',mac,apMac:ap,authorizedAt:Date.now(),expiresAt:Date.now()+86400000}}]);
 await runUnifiExemptTick();expect(m.authorize).not.toHaveBeenCalled();expect(m.request).toHaveBeenCalledTimes(1);
});
