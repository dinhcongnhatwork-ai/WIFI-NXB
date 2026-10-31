import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rows:new Map<string,any>(),campaign:vi.fn(),find:vi.fn(),owned:vi.fn(),request:vi.fn(),wlans:vi.fn(),effective:vi.fn(),upsert:vi.fn(),resolve:vi.fn(),set:vi.fn(),eval:vi.fn(),unauth:vi.fn(),kick:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{campaign:{findUnique:m.campaign},systemSetting:{findMany:m.find,findUnique:m.owned,upsert:m.upsert}}}));
vi.mock('@/lib/redis',()=>({redis:{set:m.set,eval:m.eval}}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/network/campaign-hotspot',()=>({configuredHotspotSites:()=>['s1'],hotspotClient:()=>({siteRequest:m.request,unauthorizeGuest:m.unauth,kickClient:m.kick}),readHotspotWlans:m.wlans,effectiveHotspotCampaigns:m.effective,controllerRows:(r:any)=>r.data}));
import {queueCampaignDisconnect,resetCampaignWifi} from '@/lib/network/campaign-session-management';
const c={id:'c1',ssid:'Open',unifiSite:'s1',wlanConfId:'w1',active:true,startTime:new Date(Date.now()-60000),endTime:new Date(Date.now()+3600000),template:{publishedRevision:{id:'r'}}};
beforeEach(()=>{vi.resetAllMocks();m.rows.clear();process.env.CAMPAIGN_HOTSPOT_ENABLED='true';m.campaign.mockResolvedValue(c);m.resolve.mockResolvedValue({id:'conn'});m.effective.mockResolvedValue([c]);m.find.mockResolvedValue([]);m.set.mockResolvedValue('OK');m.eval.mockResolvedValue(1);
 m.wlans.mockResolvedValue([{_id:'w1',name:'Open',security:'open',enabled:true,is_guest:true}]);
 m.owned.mockImplementation(async({where}:any)=>where.key==='campaignHotspot:owned:conn:s1'?{value:{version:1,connectionId:'conn',site:'s1',wlans:[{wlanId:'w1',originalGuest:false}]}}:m.rows.get(where.key)||null);
 m.upsert.mockImplementation(async({where,create}:any)=>{m.rows.set(where.key,create);return create;});
 m.request.mockResolvedValue({data:[{mac:'aa:bb:cc:dd:ee:ff',ap_mac:'11:22:33:44:55:66',essid:'Open',is_wired:false,authorized:true},{mac:'bb:bb:cc:dd:ee:ff',ap_mac:'11:22:33:44:55:66',essid:'Password',is_wired:false,authorized:true}]});
});
it('queues only exact campaign wireless clients and performs no device writes',async()=>{expect(await queueCampaignDisconnect('c1')).toEqual({queued:1});expect(m.upsert).toHaveBeenCalledTimes(1);expect(m.upsert.mock.calls[0][0].create.value).toMatchObject({campaignId:'c1',mac:'aa:bb:cc:dd:ee:ff',expiresAt:0,state:'pending'});expect(m.request.mock.calls).toEqual([['stat/sta']]);});
it('rejects unowned, WPA, disabled, ambiguous and foreign-site campaigns',async()=>{
 m.wlans.mockResolvedValue([{_id:'w1',name:'Open',security:'wpapsk',enabled:true,is_guest:true}]);await expect(queueCampaignDisconnect('c1')).rejects.toThrow();
 m.wlans.mockResolvedValue([{_id:'w1',name:'Open',security:'open',enabled:true,is_guest:true}]);m.owned.mockResolvedValue(null);await expect(queueCampaignDisconnect('c1')).rejects.toThrow();
 m.campaign.mockResolvedValue({...c,unifiSite:'other'});await expect(queueCampaignDisconnect('c1')).rejects.toThrow();expect(m.upsert).not.toHaveBeenCalled();
});
it('excludes an approved MAC from a campaign-wide disconnect',async()=>{
 const mac='aa:bb:cc:dd:ee:ff',key=`unifi:portal-exempt:conn:s1:${mac}`;
 m.rows.set(key,{key,value:{version:1,connectionId:'conn',site:'s1',mac,ownerName:'A',deviceName:'Laptop',enabled:true,approvedAt:1,approvedBy:'admin',createdAt:1,updatedAt:1}});
 expect(await queueCampaignDisconnect('c1')).toEqual({queued:0});expect(m.upsert).not.toHaveBeenCalled();
});
it('forced reset marks even exempt and previously revoked known campaign MACs for explicit login',async()=>{
 const mac='aa:bb:cc:dd:ee:ff',key=`unifi:portal-exempt:conn:s1:${mac}`;m.rows.set(key,{value:{version:1,connectionId:'conn',site:'s1',mac,ownerName:'A',deviceName:'Laptop',enabled:true,approvedAt:1,approvedBy:'admin',createdAt:1,updatedAt:1}});
 await queueCampaignDisconnect('c1',{forceReauth:true});expect(m.upsert.mock.calls.some(call=>call[0].create.value.resetRequired===true)).toBe(true);
});

it('queues a durable reset, revokes a reachable client immediately, and invalidates previous portal tokens',async()=>{
 const live={mac:'aa:bb:cc:dd:ee:ff',ap_mac:'11:22:33:44:55:66',essid:'Open',is_wired:false,authorized:true};
 m.find.mockImplementation(async({where}:any)=>Array.from(m.rows.values()).filter((row:any)=>row.key.startsWith(where.key.startsWith)));m.request.mockImplementation(async()=>({data:[live]}));m.unauth.mockImplementation(async()=>{live.authorized=false;return true;});m.kick.mockResolvedValue(true);
 expect(await resetCampaignWifi('c1')).toEqual({queued:1,revoked:1,waiting:0,skipped:0,failed:0,notQueued:0});expect(live.authorized).toBe(false);expect(m.rows.get('campaignHotspot:reset:c1').value.epoch).toEqual(expect.any(String));
});
it('targets a live client on this SSID even when its ledger still points to another campaign',async()=>{
 const mac='aa:bb:cc:dd:ee:ff',key=`campaignHotspot:session:conn:s1:${mac}`;m.rows.set(key,{key,value:{version:1,state:'active',campaignId:'previous',connectionId:'conn',site:'s1',wlanId:'previous',ssid:'Other',mac,apMac:'11:22:33:44:55:66',authorizedAt:1,expiresAt:Date.now()+60000}});
 expect(await queueCampaignDisconnect('c1',{forceReauth:true})).toMatchObject({queued:1,notQueued:0});expect(m.rows.get(key).value).toMatchObject({campaignId:'c1',ssid:'Open',resetRequired:true});
});

it('processes other clients when the middle MAC lease stays busy and reports unqueued targets honestly',async()=>{
 const aps='11:22:33:44:55:66';const macs=['02:00:00:00:00:01','02:00:00:00:00:02','02:00:00:00:00:03'];m.request.mockResolvedValue({data:macs.map(mac=>({mac,ap_mac:aps,essid:'Open',is_wired:false}))});
 m.set.mockImplementation(async(key:string)=>key.endsWith(macs[1])?null:'OK');
 expect(await queueCampaignDisconnect('c1',{forceReauth:true})).toEqual({queued:2,notQueued:1});expect(m.rows.has('campaignHotspot:session:conn:s1:'+macs[2])).toBe(true);
});
