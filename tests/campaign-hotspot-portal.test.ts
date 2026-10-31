import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(()=>({
  callbackSsid:vi.fn(), apRead:vi.fn(), resolve:vi.fn(), request:vi.fn(), authorize:vi.fn(), watched:vi.fn(), lockSet:vi.fn(), lockEval:vi.fn(),
  db:{systemSetting:{findUnique:vi.fn(),upsert:vi.fn()},campaign:{findMany:vi.fn(),findFirst:vi.fn(),findUnique:vi.fn()},attendanceSession:{findMany:vi.fn()},attendanceRegistration:{findFirst:vi.fn()},template:{findFirst:vi.fn(),findUnique:vi.fn()},wifiUser:{upsert:vi.fn()},log:{create:vi.fn()}}
}));
vi.mock('@/lib/network/unifi-callback-context',()=>({resolveCallbackSsid:m.callbackSsid}));
vi.mock('@/lib/network/ap-ssh',()=>({readManagedApSnapshot:m.apRead}));
vi.mock('@/lib/prisma',()=>({prisma:m.db}));
vi.mock('@/lib/redis',()=>({isVideoWatched:m.watched,redis:{set:m.lockSet,eval:m.lockEval}}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/unifi',()=>({UnifiClient:class {siteRequest=m.request;authorizeGuest=m.authorize;}}));
import { GET as callback } from '@/app/guest/s/[site]/route';
import { GET as portal } from '@/app/api/portal/route';
import { GET as connect } from '@/app/api/connect/route';
import { POST as login } from '@/app/api/login/route';
const mac='aa:bb:cc:dd:ee:ff', ap='11:22:33:44:55:66';
const template={id:'t1',publishedRevisionId:'r1',publishedRevision:{id:'r1',layoutJson:{elements:[{type:'video_gate',enabled:true}]}}};
const campaign={id:'c1',ssid:'Open',unifiSite:'s1',wlanConfId:'w1',active:true,startTime:new Date(Date.now()-3600000),endTime:new Date(Date.now()+3600000),template,redirectUrl:'https://example.org/thanks'};
const ownedRecord=()=>({key:'campaignHotspot:owned:conn:s1',value:{version:1,connectionId:'conn',site:'s1',wlans:[{wlanId:'w1',originalGuest:false}]}});
let authorized=false;
let wlan:any;
let client:any;
const request=(path:string,body?:any)=>new NextRequest('https://portal.example'+path,body?{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}}:undefined);
async function session(){const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));expect(response.status).toBe(200);return (await response.json()).data.portalSessionId;}
beforeEach(()=>{
  vi.resetAllMocks();process.env.CAMPAIGN_HOTSPOT_ENABLED='true';process.env.UNIFI_PORTAL_SERVER='192.168.1.253';process.env.NEXT_PUBLIC_APP_URL='https://portal.example';
  authorized=false;wlan={_id:'w1',name:'Open',enabled:true,security:'open',is_guest:true};client={mac,essid:'Open',ap_mac:ap,is_wired:false};
  m.resolve.mockResolvedValue({id:'conn',baseUrl:'https://controller',username:'u',credentials:{password:'p'},config:{site:'s1'},isDefault:true});
  m.db.campaign.findMany.mockResolvedValue([campaign]);m.db.campaign.findFirst.mockResolvedValue(campaign);m.db.attendanceSession.findMany.mockResolvedValue([]);m.db.template.findUnique.mockResolvedValue(template);
  m.watched.mockResolvedValue(true);
  m.db.systemSetting.findUnique.mockImplementation(async({where}:any)=>where.key==='campaignHotspot:owned:conn:s1'?ownedRecord():null);m.lockSet.mockResolvedValue('OK');m.lockEval.mockResolvedValue(1);
  m.request.mockImplementation(async(path:string)=>({data:path==='stat/sta'?[{...client,authorized}]:path==='rest/wlanconf'?[wlan]:path==='get/setting'?[{key:'guest_access',portal_enabled:true,auth:'custom',custom_ip:'192.168.1.253'}]:[]}));
  m.authorize.mockImplementation(async()=>{authorized=true;return true;});
});
afterEach(()=>vi.useRealTimers());
describe('UniFi external portal and signed authorization',()=>{
  it('normalizes legacy id into MAC and redirects only to configured HTTPS origin',async()=>{
    const response=await callback(request(`/guest/s/s1/?id=${mac}&ap=${ap}&ssid=Open&url=https://evil.example&idTemplate=evil`),{params:{site:'s1'}});
    const target=new URL(response.headers.get('location')!);expect(target.origin).toBe('https://portal.example');expect(target.pathname).toBe('/portal');expect(target.searchParams.get('mac')).toBe(mac);expect(target.searchParams.get('unifiSite')).toBe('s1');expect(target.searchParams.has('id')).toBe(false);expect(target.searchParams.has('templateId')).toBe(false);
    expect((await callback(request('/guest/s/bad/?id=bad'),{params:{site:'../bad'}})).status).toBe(400);
  });
  it('accepts legacy AP callbacks without ssid only after live identity resolution',async()=>{
    m.callbackSsid.mockResolvedValue('Open');
    const response=await callback(request(`/guest/s/s1/?id=${mac}&ap=${ap}`),{params:{site:'s1'}});
    expect(response.status).toBe(302);expect(new URL(response.headers.get('location')!).searchParams.get('ssid')).toBe('Open');expect(m.callbackSsid).toHaveBeenCalledWith('s1',mac,ap);
  });
  it('bounds missing-SSID recovery and never authorizes while waiting for AP association',async()=>{
    const {GuestClientPendingError}=await import('@/lib/network/campaign-hotspot-policy');m.callbackSsid.mockRejectedValue(new GuestClientPendingError());
    const path=`/guest/s/s1/?id=${mac}&ap=${ap}`;
    const pending=await callback(request(path),{params:{site:'s1'}});expect(pending.status).toBe(202);expect(await pending.text()).toContain('http-equiv="refresh"');expect(m.authorize).not.toHaveBeenCalled();
    const stopped=await callback(request(path+'&_portalRetry=10'),{params:{site:'s1'}});expect(stopped.status).toBe(408);expect(await stopped.text()).not.toContain('http-equiv="refresh"');
  });
  it('rejects unknown site and live client mismatch before issuing a signed portal session',async()=>{
    expect((await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=other`))).status).toBe(403);
    client.essid='Other';expect((await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`))).status).toBe(403);
  });
  it('authorizes through controller after gates, caps time and returns configured redirect',async()=>{
    const token=await session();const response=await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${token}&redirectUrl=https://evil.example`));
    expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('https://example.org/thanks');expect(await response.text()).toBe('');expect(m.authorize).toHaveBeenCalledWith(mac,expect.any(Number),ap);expect(m.authorize.mock.calls[0][1]).toBeLessThanOrEqual(60);
    const post=await login(request('/api/login',{mac,ssid:'Open',portalSessionId:token}));expect((await post.json()).data.redirect).toBe('https://example.org/thanks');
  });
  it('keeps video and attendance gates ahead of controller authorization',async()=>{
    const token=await session();m.watched.mockResolvedValue(false);
    expect((await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${token}`))).status).toBe(403);
    expect((await login(request('/api/login',{mac,ssid:'Open',portalSessionId:token}))).status).toBe(403);expect(m.authorize).not.toHaveBeenCalled();
  });
  it('fails closed on unsigned/malformed UniFi context instead of accepting a MikroTik URL',async()=>{
    for(const body of [{mac,ssid:'Open',unifiSite:'s1'},{mac,ssid:'Open',unifiSite:'s1',portalSessionId:'invalid'}]){
      const response=await login(request('/api/login',{...body,trial:'http://192.168.0.1/login'}));expect(response.status).toBeGreaterThanOrEqual(400);
      const params=new URLSearchParams(Object.entries({...body,trial:'http://192.168.0.1/login'}).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));const get=await connect(request(`/api/connect?${params}`));expect(get.status).toBeGreaterThanOrEqual(400);
    }expect(m.authorize).not.toHaveBeenCalled();
  });
  it('rejects changed AP, secured WLAN, expired/deleted campaign and failed controller readback',async()=>{
    const token=await session();
    client.ap_mac='22:22:33:44:55:66';expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(403);
    client.ap_mac=ap;wlan.security='wpapsk';expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(403);
    wlan.security='open';m.db.campaign.findMany.mockResolvedValue([]);expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(403);
    m.db.campaign.findMany.mockResolvedValue([{...campaign,endTime:new Date(Date.now()-1)}]);expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(403);
    m.db.campaign.findMany.mockResolvedValue([campaign]);m.authorize.mockResolvedValue(false);expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(502);
  });
  it('rejects arbitrary signed runtime fallback templates without an eligible campaign',async()=>{
    m.db.campaign.findMany.mockResolvedValue([]);expect((await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1&id=unrelated`))).status).toBe(403);
  });
});

it('requires a completed attendance registration before authorizing either endpoint',async()=>{
 const time=new Date();template.publishedRevision.layoutJson.elements=[{type:'attendance_gate',enabled:true}];
 const meeting={id:'meeting',ssid:'Open',unifiSite:'s1',status:'ACTIVE',startTime:campaign.startTime,endTime:campaign.endTime,targetApMacs:[],campaignId:'c1',templateId:'t1',createdAt:time,updatedAt:time};
 m.db.attendanceSession.findMany.mockResolvedValue([meeting]);m.db.campaign.findUnique.mockResolvedValue(campaign);m.db.attendanceRegistration.findFirst.mockResolvedValue(null);
 const token=await session();expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(403);
 expect((await connect(request(`/api/connect?mac=${mac}&portalSessionId=${token}`))).status).toBe(403);expect(m.authorize).not.toHaveBeenCalled();
 template.publishedRevision.layoutJson.elements=[{type:'video_gate',enabled:true}];
});
it('keeps accepted authorization pending without showing a server error or redirecting early',async()=>{
 const token=await session();m.authorize.mockImplementation(async()=>true);
 expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(202);
 const pending=await connect(request(`/api/connect?mac=${mac}&portalSessionId=${token}`));expect(pending.status).toBe(202);expect(pending.headers.get('location')).toBeNull();expect(await pending.text()).toContain('Đang mở quyền truy cập Internet');
 let reads=0;m.request.mockImplementation(async(path:string)=>({data:path==='stat/sta'?[{...client,authorized:++reads>=3}]:path==='rest/wlanconf'?[wlan]:[{key:'guest_access',portal_enabled:true,auth:'custom',custom_ip:'192.168.1.253'}]}));
 await login(request('/api/login',{mac,portalSessionId:token}));
 expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(200);
});
it('fails closed if an attendance gate has no effective session or a signed UniFi request loses its client MAC',async()=>{
 template.publishedRevision.layoutJson.elements=[{type:'attendance_gate',enabled:true}];
 const token=await session();
 expect((await login(request('/api/login',{mac,portalSessionId:token}))).status).toBe(403);
 expect((await connect(request(`/api/connect?mac=${mac}&portalSessionId=${token}`))).status).toBe(403);
 expect((await connect(request(`/api/connect?portalSessionId=${token}`))).status).toBeGreaterThanOrEqual(400);
 expect(m.authorize).not.toHaveBeenCalled();
 template.publishedRevision.layoutJson.elements=[{type:'video_gate',enabled:true}];
});

const invalidOwnership = [
  ['missing record', null],
  ['missing value', {key:'campaignHotspot:owned:conn:s1',value:null}],
  ['wrong version', {...ownedRecord(),value:{...ownedRecord().value,version:2}}],
  ['wrong key', {...ownedRecord(),key:'campaignHotspot:owned:other:s1'}],
  ['wrong connection', {...ownedRecord(),value:{...ownedRecord().value,connectionId:'other'}}],
  ['wrong site', {...ownedRecord(),value:{...ownedRecord().value,site:'other'}}],
  ['wrong WLAN', {...ownedRecord(),value:{...ownedRecord().value,wlans:[{wlanId:'other',originalGuest:false}]}}],
  ['preexisting guest', {...ownedRecord(),value:{...ownedRecord().value,wlans:[{wlanId:'w1',originalGuest:true}]}}],
  ['ambiguous WLAN ownership', {...ownedRecord(),value:{...ownedRecord().value,wlans:[{wlanId:'w1',originalGuest:false},{wlanId:'w1',originalGuest:false}]}}],
  ['malformed WLAN ownership', {...ownedRecord(),value:{...ownedRecord().value,wlans:[null]}}],
] as const;
describe('durable WLAN ownership boundary',()=>{
 it.each(invalidOwnership)('refuses to mint a session for %s',async(_description,record)=>{
  m.db.systemSetting.findUnique.mockImplementation(async({where}:any)=>where.key.startsWith('campaignHotspot:owned:')?record:null);
  const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));
  expect(response.status).toBe(403);expect((await response.json()).success).toBe(false);expect(m.authorize).not.toHaveBeenCalled();
 });
 it.each(invalidOwnership)('rechecks %s after minting before either authorization endpoint',async(_description,record)=>{
  const token=await session();m.db.systemSetting.findUnique.mockImplementation(async({where}:any)=>where.key.startsWith('campaignHotspot:owned:')?record:null);
  const get=await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${token}`));
  const post=await login(request('/api/login',{mac,ssid:'Open',portalSessionId:token}));
  expect(get.status).toBe(403);expect(post.status).toBe(403);expect((await get.json()).success).toBe(false);expect((await post.json()).success).toBe(false);expect(m.authorize).not.toHaveBeenCalled();
 });
 it('reads ownership by the exact default connection/site key',async()=>{
  await session();expect(m.db.systemSetting.findUnique).toHaveBeenCalledWith({where:{key:'campaignHotspot:owned:conn:s1'}});
 });
});

describe('newly associated clients awaiting controller visibility',()=>{
 it('renders while association is pending, but does not grant until the same live client appears',async()=>{
  const initial=m.request.getMockImplementation()!;
  let visible=false;
  m.request.mockImplementation(async(path:string)=>path==='stat/sta'&&!visible?{data:[]}:initial(path));
  const pending=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));
  expect(pending.status).toBe(200);
  const body=await pending.json();expect(body.data.connectionPending).toBe(true);expect(body.data.layout).toBeTruthy();expect(m.authorize).not.toHaveBeenCalled();
  const clicked=await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${body.data.portalSessionId}`));expect(clicked.status).toBe(202);expect(await clicked.text()).toContain('Đang xác thực kết nối WiFi');expect(m.authorize).not.toHaveBeenCalled();
  const timeout=await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${body.data.portalSessionId}&_wifiRetry=20`));expect(timeout.status).toBe(408);expect(await timeout.text()).not.toContain('http-equiv="refresh"');
  visible=true;
  const ready=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));
  expect(ready.status).toBe(200);expect((await ready.json()).data.portalSessionId).toEqual(expect.any(String));expect(m.authorize).not.toHaveBeenCalled();
 });
 it('keeps definitive identity mismatches forbidden rather than retrying or authorizing them',async()=>{
  client.ap_mac='22:22:33:44:55:66';
  const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));
  expect(response.status).toBe(403);expect((await response.json()).code).not.toBe('UNIFI_CLIENT_PENDING');expect(m.authorize).not.toHaveBeenCalled();
 });
 it('does not wait for an unknown client on a WLAN without durable campaign ownership',async()=>{
  const initial=m.request.getMockImplementation()!;
  m.request.mockImplementation(async(path:string)=>path==='stat/sta'?{data:[]}:initial(path));m.db.systemSetting.findUnique.mockResolvedValue(null);
  const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));
  expect(response.status).toBe(403);expect((await response.json()).code).not.toBe('UNIFI_CLIENT_PENDING');expect(m.authorize).not.toHaveBeenCalled();
 });
});

function approvedRecord(){return {key:`unifi:portal-exempt:conn:s1:${mac}`,value:{version:1,connectionId:'conn',site:'s1',mac,ownerName:'Approved',deviceName:'Laptop',enabled:true,approvedAt:1,approvedBy:'admin',createdAt:1,updatedAt:1}};}
it('skips portal gates only for an approved MAC verified against the owned live WLAN',async()=>{
 m.db.systemSetting.findUnique.mockImplementation(async({where}:any)=>where.key===ownedRecord().key?ownedRecord():where.key===approvedRecord().key?approvedRecord():null);
 m.watched.mockResolvedValue(false);
 const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1&redirectUrl=https://evil.example`));
 expect(response.status).toBe(200);expect((await response.json()).data).toEqual({bypass:true,redirectUrl:campaign.redirectUrl});expect(m.authorize).toHaveBeenCalledWith(mac,1440,ap);
 client.essid='Password';expect((await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`))).status).toBe(403);
});
it('cannot request exemption through query parameters or without live network identity',async()=>{
 const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1&bypass=true`));expect((await response.json()).data.bypass).toBeUndefined();expect(m.authorize).not.toHaveBeenCalled();
});
it('renders the published portal immediately while the station is pending, without authorizing it',async()=>{
 m.request.mockImplementation(async(path:string)=>({data:path==='stat/sta'?[]:path==='rest/wlanconf'?[wlan]:[{key:'guest_access',portal_enabled:true,auth:'custom',custom_ip:'192.168.1.253'}]}));
 const response=await portal(request(`/api/portal?mac=${mac}&ssid=Open&apMac=${ap}&unifiSite=s1`));expect(response.status).toBe(200);const data=(await response.json()).data;expect(data.layout).toBeTruthy();expect(data.connectionPending).toBe(true);expect(m.authorize).not.toHaveBeenCalled();
});
it('invalidates a portal token after Reset WiFi and requires a fresh explicit connect',async()=>{
 const token=await session();const original=m.db.systemSetting.findUnique.getMockImplementation()!;
 m.db.systemSetting.findUnique.mockImplementation(async(args:any)=>args.where.key==='campaignHotspot:reset:c1'?{value:{version:1,epoch:'reset-1'}}:original(args));
 const response=await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${token}`));expect(response.status).not.toBe(200);expect(m.authorize).not.toHaveBeenCalled();
 const fresh=await session();expect(fresh).not.toBe(token);expect((await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${fresh}`))).status).toBe(302);
});


it('connects and redirects in one click when the AP sees the client before stat/sta does',async()=>{
 const initial=m.request.getMockImplementation()!;
 m.request.mockImplementation(async(path:string)=>path==='stat/sta'?{data:[]}:path==='stat/device'?{data:[{type:'uap',state:1,mac:ap,ip:'192.168.0.80'}]}:path==='get/setting'?{data:[...(await initial(path)).data,{key:'mgmt',x_ssh_username:'admin',x_ssh_password:'secret'}]}:initial(path));
 m.apRead.mockImplementation(async()=>({mac:ap,vap_table:[{id:'w1',essid:'Open',up:true,state:'RUN',sta_table:[{mac,authorized}]}]}));
 const token=await session();
 const response=await connect(request(`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${token}`));
 expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('https://example.org/thanks');
 expect(await response.text()).toBe('');
});

it('resumes the same accepted grant across pending HTTP pages and redirects only after readback',async()=>{
 const store=new Map<string,any>();const original=m.db.systemSetting.findUnique.getMockImplementation()!;
 m.db.systemSetting.findUnique.mockImplementation(async(args:any)=>store.get(args.where.key)||original(args));
 m.db.systemSetting.upsert.mockImplementation(async({where,create,update}:any)=>{store.set(where.key,{key:where.key,value:structuredClone(store.has(where.key)?update.value:create.value)});});
 m.authorize.mockImplementation(async()=>true);
 const token=await session(),url=`/api/connect?mac=${mac}&ssid=Open&portalSessionId=${token}`;
 expect((await connect(request(url))).status).toBe(202);const first=store.get(`campaignHotspot:session:conn:s1:${mac}`).value;
 expect((await connect(request(url+'&_wifiRetry=1'))).status).toBe(202);expect(m.authorize).toHaveBeenCalledTimes(1);
 authorized=true;const final=await connect(request(url+'&_wifiRetry=2'));expect(final.status).toBe(302);expect(final.headers.get('location')).toBe(campaign.redirectUrl);expect(m.authorize).toHaveBeenCalledTimes(1);
 expect(store.get(`campaignHotspot:session:conn:s1:${mac}`).value.expiresAt).toBe(first.expiresAt);
});
it('bounds the total pending time and gives a readable recovery screen on a controller refusal',async()=>{
 const token=await session();const original=m.request.getMockImplementation()!;m.request.mockImplementation(async(path:string)=>path==='stat/sta'?{data:[]}:original(path));
 const timed=await connect(request(`/api/connect?mac=${mac}&portalSessionId=${token}&_wifiStarted=${Date.now()-46000}`));expect(timed.status).toBe(408);expect(await timed.text()).not.toContain('http-equiv="refresh"');
 m.request.mockImplementation(original);m.authorize.mockResolvedValue(false);
 const refused=await connect(request(`/api/connect?mac=${mac}&portalSessionId=${token}`));expect(refused.status).toBe(502);expect(refused.headers.get('content-type')).toContain('text/html');expect(await refused.text()).toContain('Thử lại kết nối');
});
