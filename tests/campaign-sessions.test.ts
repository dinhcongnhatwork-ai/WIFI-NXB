import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rows:new Map<string,any>(),set:vi.fn(),eval:vi.fn(),upsert:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{systemSetting:{findUnique:async({where}:any)=>m.rows.get(where.key)||null,upsert:m.upsert}}}));
vi.mock('@/lib/redis',()=>({redis:{set:m.set,eval:m.eval}}));
import {authorizeTimedGuest,expireTimedGuest,releaseTimedGuest,sessionKey} from '@/lib/network/campaign-sessions';
import {sessionPolicyKey,validateSessionMinutes} from '@/lib/network/campaign-session-policy';
const scope={campaignId:'c1',connectionId:'conn',site:'s1',wlanId:'w1',ssid:'Open',mac:'aa:bb:cc:dd:ee:ff',apMac:'11:22:33:44:55:66'};
const now=new Date('2026-10-29T05:00:00Z');const end=new Date('2026-10-30T05:00:00Z');
let live:any;let client:any;
beforeEach(()=>{
 vi.resetAllMocks();m.rows.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);
 live={mac:scope.mac,essid:'Open',ap_mac:scope.apMac,is_wired:false,authorized:false};
 m.set.mockResolvedValue('OK');m.eval.mockResolvedValue(1);
 m.upsert.mockImplementation(async({where,create,update}:any)=>{const row={key:where.key,value:structuredClone(m.rows.has(where.key)?update.value:create.value)};m.rows.set(where.key,row);return row;});
 client={authorizeGuest:vi.fn(async()=>{live.authorized=true;return true;}),unauthorizeGuest:vi.fn(async()=>{if(live)live.authorized=false;return true;}),kickClient:vi.fn(async()=>true),siteRequest:vi.fn(async()=>({data:live?[live]:[]}))};
});
afterEach(()=>vi.useRealTimers());
const grant=()=>authorizeTimedGuest(scope,client,end,async()=>live);
describe('campaign session limits',()=>{
 it.each([30,60])('persists intent before granting exactly %i minutes and survives a process restart',async minutes=>{
  m.rows.set(sessionPolicyKey('c1'),{value:{version:1,sessionMinutes:minutes}});await grant();
  expect(client.authorizeGuest).toHaveBeenCalledWith(scope.mac,minutes,scope.apMac);
  expect(m.upsert.mock.invocationCallOrder[0]).toBeLessThan(client.authorizeGuest.mock.invocationCallOrder[0]);
  const stored=m.rows.get(sessionKey(scope)).value;expect(stored.state).toBe('active');expect(stored.expiresAt-stored.authorizedAt).toBe(minutes*60000);
  vi.setSystemTime(stored.expiresAt);expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');
  expect(client.unauthorizeGuest).toHaveBeenCalledWith(scope.mac);expect(client.kickClient).toHaveBeenCalledWith(scope.mac);
 });
 it('does not extend the expiry when the connect request is repeated',async()=>{
  await grant();const expiry=m.rows.get(sessionKey(scope)).value.expiresAt;vi.setSystemTime(now.getTime()+60000);await grant();
  expect(client.authorizeGuest).toHaveBeenCalledTimes(1);expect(m.rows.get(sessionKey(scope)).value.expiresAt).toBe(expiry);
 });
 it('keeps the default at 240 minutes and caps a configured duration at campaign end',async()=>{
  await authorizeTimedGuest(scope,client,new Date(now.getTime()+30*60000),async()=>live);expect(client.authorizeGuest).toHaveBeenCalledWith(scope.mac,30,scope.apMac);
 });
 it('never grants if durable persistence fails or another process holds the lock',async()=>{
  m.upsert.mockRejectedValueOnce(Error('DB unavailable'));await expect(grant()).rejects.toThrow();expect(client.authorizeGuest).not.toHaveBeenCalled();
  m.set.mockResolvedValue(null);await expect(grant()).rejects.toThrow();expect(client.authorizeGuest).not.toHaveBeenCalled();
 });
 it('retains an uncertain authorization as pending so the worker can revoke it',async()=>{
  client.authorizeGuest.mockRejectedValueOnce(Error('timeout'));await expect(grant()).rejects.toThrow();expect(m.rows.get(sessionKey(scope)).value.state).toBe('pending');
  expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');vi.setSystemTime(now.getTime()+45001);expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');
 });
 it('does not revoke early, kick another SSID, or touch a wired client',async()=>{
  await grant();expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');
  vi.setSystemTime(now.getTime()+240*60000);live.essid='Password';expect(await expireTimedGuest(sessionKey(scope),client)).toBe('skipped');expect(client.unauthorizeGuest).not.toHaveBeenCalled();expect(client.kickClient).not.toHaveBeenCalled();
  live.essid='Open';live.is_wired=true;expect(await expireTimedGuest(sessionKey(scope),client)).toBe('skipped');
 });
 it('retains an expired offline session, then revokes and kicks on its next association',async()=>{
  await grant();vi.setSystemTime(now.getTime()+240*60000);const connected=live;live=null;
  expect(await expireTimedGuest(sessionKey(scope),client)).toBe('waiting');expect(client.kickClient).not.toHaveBeenCalled();
  live={...connected,authorized:false};expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');expect(client.kickClient).toHaveBeenCalledWith(scope.mac);
 });
 it('retries a refused revoke and stops all mutation after losing the lease',async()=>{
  await grant();vi.setSystemTime(now.getTime()+240*60000);client.unauthorizeGuest.mockResolvedValue(false);
  await expect(expireTimedGuest(sessionKey(scope),client)).rejects.toThrow();expect(m.rows.get(sessionKey(scope)).value.state).not.toBe('revoked');expect(client.kickClient).not.toHaveBeenCalled();
  m.eval.mockResolvedValue(0);client.unauthorizeGuest.mockClear();await expect(expireTimedGuest(sessionKey(scope),client)).rejects.toThrow();expect(client.unauthorizeGuest).not.toHaveBeenCalled();
 });
 it.each([0,-1,1.5,1441,'30',null,Infinity])('rejects invalid duration %s',input=>expect(()=>validateSessionMinutes(input)).toThrow());
});

it('does not revoke a session whose WLAN changed since the worker snapshot',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);
 expect(await expireTimedGuest(sessionKey(scope),client,{...scope,wlanId:'previous-wlan'})).toBe('not-due');
 expect(client.unauthorizeGuest).not.toHaveBeenCalled();
});
it('preserves the original deadline when a reconnect is reported unauthorized',async()=>{
 m.rows.set(sessionPolicyKey('c1'),{value:{version:1,sessionMinutes:30}});await grant();const original=structuredClone(m.rows.get(sessionKey(scope)).value);
 vi.setSystemTime(now.getTime()+10*60000);live.authorized=false;await grant();
 expect(client.authorizeGuest).toHaveBeenLastCalledWith(scope.mac,20,scope.apMac);expect(m.rows.get(sessionKey(scope)).value.expiresAt).toBe(original.expiresAt);expect(m.rows.get(sessionKey(scope)).value.authorizedAt).toBe(original.authorizedAt);
});
it('does not kick a device that switches to a password SSID during unauthorization',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);client.unauthorizeGuest.mockImplementation(async()=>{live.essid='Password';return true;});
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('skipped');expect(client.kickClient).not.toHaveBeenCalled();
});

it('retires a session after ownership cleanup without controller mutation, but preserves a newer grant',async()=>{
 await grant();const old=structuredClone(m.rows.get(sessionKey(scope)).value);
 await releaseTimedGuest(sessionKey(scope),old);expect(m.rows.get(sessionKey(scope)).value.state).toBe('released');expect(client.unauthorizeGuest).not.toHaveBeenCalled();
 vi.setSystemTime(now.getTime()+60000);await grant();
 const current=structuredClone(m.rows.get(sessionKey(scope)).value);await releaseTimedGuest(sessionKey(scope),old);expect(m.rows.get(sessionKey(scope)).value).toEqual(current);
});
it('does not kick when duplicate MAC observations appear during unauthorization',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);let ambiguous=false;
 client.unauthorizeGuest.mockImplementation(async()=>{ambiguous=true;return true;});
 client.siteRequest.mockImplementation(async()=>({data:ambiguous?[live,{...live,essid:'Password'}]:[live]}));
 await expect(expireTimedGuest(sessionKey(scope),client)).rejects.toThrow();expect(client.kickClient).not.toHaveBeenCalled();
});

const exemptionKeyForScope=()=>`unifi:portal-exempt:${scope.connectionId}:${scope.site}:${scope.mac}`;
function approve(){m.rows.set(exemptionKeyForScope(),{key:exemptionKeyForScope(),value:{version:1,connectionId:scope.connectionId,site:scope.site,mac:scope.mac,ownerName:'Person',deviceName:'Laptop',enabled:true,approvedAt:now.getTime(),approvedBy:'admin',createdAt:now.getTime(),updatedAt:now.getTime()}});}
it('automatically grants an approved device and renews without campaign expiry limits',async()=>{
 approve();await authorizeTimedGuest(scope,client,new Date(now.getTime()+60000),async()=>live);
 expect(client.authorizeGuest).toHaveBeenCalledWith(scope.mac,1440,scope.apMac);expect(m.rows.get(sessionKey(scope)).value.accessMode).toBe('exempt');
 await grant();expect(client.authorizeGuest).toHaveBeenCalledTimes(1);
 vi.setSystemTime(now.getTime()+13*60*60000);await grant();expect(client.authorizeGuest).toHaveBeenCalledTimes(2);
});
it('never expires an approved device, including a previously timed grant',async()=>{
 await grant();approve();vi.setSystemTime(now.getTime()+240*60000);
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');expect(client.unauthorizeGuest).not.toHaveBeenCalled();
 await grant();expect(m.rows.get(sessionKey(scope)).value.accessMode).toBe('exempt');
});
it('revokes an exemption immediately after approval is removed, despite its future native expiry',async()=>{
 approve();await grant();m.rows.delete(exemptionKeyForScope());
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');expect(client.kickClient).toHaveBeenCalledWith(scope.mac);
});
it('cannot use the automatic grant path after approval was withdrawn',async()=>{
 await expect(authorizeTimedGuest(scope,client,end,async()=>live,true)).rejects.toThrow();expect(client.authorizeGuest).not.toHaveBeenCalled();
});

it('moves a stale exempt ledger to the verified current campaign before revoking, without overwriting a newer generation',async()=>{
 approve();await grant();const old=structuredClone(m.rows.get(sessionKey(scope)).value);m.rows.delete(exemptionKeyForScope());
 const next={...scope,campaignId:'c2',wlanId:'w2',ssid:'Open2'};live.essid='Open2';
 const {retargetExemptSession}=await import('@/lib/network/campaign-sessions');
 const moved=await retargetExemptSession(sessionKey(scope),old,next,async()=>live);expect(moved?.wlanId).toBe('w2');
 expect(await retargetExemptSession(sessionKey(scope),old,{...next,wlanId:'stale'},async()=>live)).toBeNull();
 expect(await expireTimedGuest(sessionKey(scope),client,next)).toBe('revoked');
});
it('clears a previous campaign guest grant on a non-guest SSID without kicking that SSID',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);live.essid='Password';live.is_guest=false;
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('waiting');expect(client.unauthorizeGuest).toHaveBeenCalledWith(scope.mac);expect(client.kickClient).not.toHaveBeenCalled();
 live.essid='Open';live.is_guest=true;expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');expect(client.kickClient).toHaveBeenCalled();
});
it('forced reset prevents exemption auto-grant but allows a subsequent explicit connect',async()=>{
 approve();await grant();const key=sessionKey(scope);const old=m.rows.get(key);old.value={...old.value,state:'pending',resetRequired:true,expiresAt:0};
 await expect(authorizeTimedGuest(scope,client,end,async()=>live,true)).rejects.toThrow();
 expect(await expireTimedGuest(key,client)).toBe('revoked');
 await grant();expect(m.rows.get(key).value.resetRequired).not.toBe(true);
});
it('does not report reset complete if the controller still lists the guest grant as active',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);client.siteRequest.mockImplementation(async(path:string)=>({data:path==='stat/guest'?[{mac:scope.mac,expired:false}]:[live]}));
 await expect(expireTimedGuest(sessionKey(scope),client)).rejects.toThrow();expect(client.kickClient).not.toHaveBeenCalled();expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');
});

it('clears and verifies the AP authorization cache before kicking an expired guest',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);
 client.clearGuestCache=vi.fn(async(_scope:any,_pending:any,check:any)=>{await check();return ['22:33:44:55:66:88'];});
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('waiting');
 expect(m.rows.get(sessionKey(scope)).value.state).toBe('revoked');
 expect(client.clearGuestCache).toHaveBeenCalledWith(expect.objectContaining({mac:scope.mac}),undefined,expect.any(Function));
 expect(client.clearGuestCache.mock.invocationCallOrder[0]).toBeLessThan(client.kickClient.mock.invocationCallOrder[0]);
 expect(m.rows.get(sessionKey(scope)).value.cachePending).toEqual(['22:33:44:55:66:88']);
 client.clearGuestCache.mockResolvedValue([]);client.unauthorizeGuest.mockClear();client.kickClient.mockClear();
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');
 expect(client.clearGuestCache).toHaveBeenLastCalledWith(expect.anything(),['22:33:44:55:66:88'],expect.any(Function));
 expect(client.unauthorizeGuest).not.toHaveBeenCalled();expect(client.kickClient).not.toHaveBeenCalled();
 expect(m.rows.get(sessionKey(scope)).value.cachePending).toEqual([]);
});
it('retains revocation intent if the AP cache cannot be verified',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);client.clearGuestCache=vi.fn().mockRejectedValue(Error('AP cannot be reached'));
 await expect(expireTimedGuest(sessionKey(scope),client)).rejects.toThrow('AP cannot be reached');
 expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');expect(client.kickClient).not.toHaveBeenCalled();
});
it('retries only offline AP caches while an already revoked guest is disconnected',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);live=null;client.clearGuestCache=vi.fn().mockResolvedValue(['22:33:44:55:66:88']);
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('waiting');client.unauthorizeGuest.mockClear();client.clearGuestCache.mockResolvedValue([]);
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('waiting');
 expect(client.unauthorizeGuest).not.toHaveBeenCalled();expect(client.kickClient).not.toHaveBeenCalled();expect(m.rows.get(sessionKey(scope)).value.cachePending).toEqual([]);
});
it('verifies AP caches once for legacy waiting sessions without a cache ledger',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);live=null;await expireTimedGuest(sessionKey(scope),client);
 const record=m.rows.get(sessionKey(scope));delete record.value.cachePending;
 client.clearGuestCache=vi.fn().mockResolvedValue([]);client.unauthorizeGuest.mockClear();
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('waiting');expect(client.clearGuestCache).toHaveBeenCalledWith(expect.anything(),undefined,expect.any(Function));
 expect(client.unauthorizeGuest).not.toHaveBeenCalled();
});

it('directs a guest grant to the verified AP rather than waiting for the next inform',async()=>{
 let receivedAp:string|undefined;client.authorizeGuest=async(_mac:string,_minutes:number,apMac?:string)=>{receivedAp=apMac;live.authorized=apMac===scope.apMac;return true;};
 await grant();expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');expect(receivedAp).toBe(scope.apMac);
});
it('confirms a delayed AP grant across short requests without sending a second grant',async()=>{
 const {GuestClientPendingError}=await import('@/lib/network/campaign-hotspot-policy');let reads=0,grants=0;client.authorizeGuest=async()=>{grants++;return true;};
 const read=async()=>({...live,authorized:++reads>=6});
 for(let i=0;i<4;i++)await expect(authorizeTimedGuest(scope,client,end,read)).rejects.toBeInstanceOf(GuestClientPendingError);
 await authorizeTimedGuest(scope,client,end,read);expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');expect(grants).toBe(1);
});
it('tolerates a transient missing station after the single authorization command',async()=>{
 const {GuestClientPendingError}=await import('@/lib/network/campaign-hotspot-policy');let reads=0;
 const read=async()=>{if(++reads===2)throw new GuestClientPendingError();return live;};
 await expect(authorizeTimedGuest(scope,client,end,read)).rejects.toBeInstanceOf(GuestClientPendingError);
 await authorizeTimedGuest(scope,client,end,read);
 expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');
});

it('keeps a slow accepted grant pending without a server error, duplicate grants, or an extended deadline',async()=>{
 const {GuestClientPendingError}=await import('@/lib/network/campaign-hotspot-policy');let grants=0;
 client.authorizeGuest=async()=>{grants++;return true;};
 await expect(grant()).rejects.toBeInstanceOf(GuestClientPendingError);
 const first=structuredClone(m.rows.get(sessionKey(scope)).value);
 expect(first.authorizationPendingUntil).toBeGreaterThan(Date.now());
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');
 vi.setSystemTime(now.getTime()+5000);
 await expect(grant()).rejects.toBeInstanceOf(GuestClientPendingError);
 expect(grants).toBe(1);expect(m.rows.get(sessionKey(scope)).value.expiresAt).toBe(first.expiresAt);
 live.authorized=true;await grant();
 expect(grants).toBe(1);expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');expect(m.rows.get(sessionKey(scope)).value.expiresAt).toBe(first.expiresAt);
},20000);
it('revokes an unconfirmed grant after its confirmation window, while reset bypasses that window',async()=>{
 client.authorizeGuest=async()=>true;await grant().catch(()=>{});
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');
 const record=m.rows.get(sessionKey(scope));record.value={...record.value,expiresAt:0,resetRequired:true};
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');
},20000);
it('uses the current associated AP when expiring a device that roamed after login',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);live.ap_mac='22:33:44:55:66:88';let purgedAp='';
 client.clearGuestCache=async(s:any)=>{purgedAp=s.apMac;return [];};
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');expect(purgedAp).toBe('22:33:44:55:66:88');
});
it('recovers a successful grant after the browser stops polling, without kicking the connected guest',async()=>{
 client.authorizeGuest=async()=>true;await grant().catch(()=>{});live.authorized=true;vi.setSystemTime(now.getTime()+45001);
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('not-due');expect(m.rows.get(sessionKey(scope)).value.state).toBe('active');expect(client.kickClient).not.toHaveBeenCalled();
});

it('uses verified AP reconnect when controller loses the station after revocation',async()=>{
 await grant();vi.setSystemTime(now.getTime()+240*60000);
 client.unauthorizeGuest.mockImplementation(async()=>{live=null;return true;});
 client.reconnectGuest=vi.fn().mockResolvedValue('reconnected');
 expect(await expireTimedGuest(sessionKey(scope),client)).toBe('revoked');expect(client.reconnectGuest).toHaveBeenCalledWith(expect.objectContaining({mac:scope.mac,ssid:scope.ssid}),expect.any(Function));expect(client.kickClient).not.toHaveBeenCalled();
});
it('keeps reset pending when the controller accepts kick but the AP does not disconnect',async()=>{
 await grant();const row=m.rows.get(sessionKey(scope));row.value={...row.value,state:'pending',expiresAt:0,resetRequired:true};
 client.reconnectGuest=vi.fn().mockRejectedValue(Error('AP did not disconnect'));
 await expect(expireTimedGuest(sessionKey(scope),client)).rejects.toThrow('AP did not disconnect');expect(m.rows.get(sessionKey(scope)).value.state).toBe('pending');
});
