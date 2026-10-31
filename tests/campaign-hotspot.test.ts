import { describe, expect, it } from 'vitest';
import * as policy from '@/lib/network/campaign-hotspot-policy';
const now = new Date('2026-10-28T12:00:00Z');
const wlan = { _id: 'w1', name: 'Open', enabled: true, security: 'open', is_guest: false };
const campaign = { id: 'c1', ssid: 'Open', unifiSite: 's1', wlanConfId: 'w1', active: true, startTime: new Date(now.getTime()-60000), endTime: new Date(now.getTime()+3600000), template: { publishedRevision: { id: 'r1' } } };
const eligible = (w: any = wlan, c: any[] = [campaign], ws: any[] = [w]) => policy.matchCampaign(w, ws, c, 's1', now);
describe('campaign WLAN policy', () => {
  it('enables only explicit open enabled WLANs with a published in-time matching campaign', () => {
    expect(eligible()?.id).toBe('c1');
    for (const patch of [{security:'wpapsk'}, {wpa_psk:'secret'}, {x_passphrase:'secret'}, {security:undefined}, {enabled:false}]) expect(eligible({...wlan,...patch})).toBeNull();
    for (const patch of [{active:false}, {startTime:new Date(now.getTime()+1)}, {endTime:now}, {unifiSite:'other'}, {wlanConfId:'other'}, {template:null}]) expect(eligible(wlan,[{...campaign,...patch}])).toBeNull();
  });
  it('allows exact name fallback only when unique and rejects overlapping campaigns', () => {
    const c = {...campaign,wlanConfId:null,unifiSite:null};
    expect(eligible(wlan,[c])?.id).toBe('c1');
    expect(eligible(wlan,[c],[wlan,{...wlan,_id:'w2'}])).toBeNull();
    expect(policy.matchCampaign(wlan,[wlan],[c],'s1',now,'other-default')).toBeNull();
    expect(eligible(wlan,[campaign,{...campaign,id:'c2'}])).toBeNull();
  });
});
function boundary(initial:any[]=[wlan], owned:any[]=[]){
  let rows=structuredClone(initial);let state=structuredClone(owned);const events:any[]=[];
  return {events, state:()=>state, rows:()=>rows, read:async()=>rows, save:async(value:any[])=>{state=structuredClone(value);events.push(['save',structuredClone(value)]);}, write:async(id:string,value:boolean)=>{events.push(['write',id,{is_guest:value}]);rows=rows.map((w:any)=>w._id===id?{...w,is_guest:value}:w);}};
}
describe('owned WLAN reconciliation',()=>{
  it('persists ownership before mutation and clears only its own flag after expiration/deletion',async()=>{
    const b=boundary([wlan,{...wlan,_id:'unmanaged',name:'Other',is_guest:true}]);
    await policy.reconcileGuestPolicy({site:'s1',campaigns:[campaign],owned:b.state(),now,portalReady:true,...b});
    expect(b.events[0][0]).toBe('save');expect(b.events[1]).toEqual(['write','w1',{is_guest:true}]);
    b.events.length=0;
    await policy.reconcileGuestPolicy({site:'s1',campaigns:[],owned:b.state(),now,portalReady:true,...b});
    expect(b.events.filter(e=>e[0]==='write')).toEqual([['write','w1',{is_guest:false}]]);
    expect(b.rows().find((w:any)=>w._id==='unmanaged').is_guest).toBe(true);expect(b.state()).toEqual([]);
  });
  it('does not acquire preexisting guest flags or write without eligibility or ready site portal',async()=>{
    for(const [rows,c,ready] of [[[wlan],[],true],[[{...wlan,security:'wpapsk'}],[campaign],true],[[{...wlan,is_guest:true}],[campaign],true],[[{...wlan,is_guest:'true'}],[campaign],true],[[wlan],[campaign],false]] as any){
      const b=boundary(rows);await policy.reconcileGuestPolicy({site:'s1',campaigns:c,owned:[],now,portalReady:ready,...b});expect(b.events).toEqual([]);
    }
  });
  it('cleans owned flags when secured and retains ownership when readback/mutation fails for retry',async()=>{
    const owned=[{wlanId:'w1',originalGuest:false as const}];const b=boundary([{...wlan,security:'wpapsk',is_guest:true}],owned);
    await policy.reconcileGuestPolicy({site:'s1',campaigns:[campaign],owned,now,portalReady:true,...b});expect(b.rows()[0].is_guest).toBe(false);
    const failed=boundary([{...wlan,is_guest:true}],owned);
    await expect(policy.reconcileGuestPolicy({site:'s1',campaigns:[],owned,now,portalReady:true,...failed,write:async()=>{throw Error('offline');}})).rejects.toThrow('offline');expect(failed.state()).toEqual(owned);
    const stale=boundary([wlan]);await expect(policy.reconcileGuestPolicy({site:'s1',campaigns:[campaign],owned:[],now,portalReady:true,...stale,write:async()=>{}})).rejects.toThrow('readback');expect(stale.state()).toHaveLength(1);
  });
});
describe('live guest identity and duration',()=>{
  const context={mac:'aa:bb:cc:dd:ee:ff',ssid:'Open',apMac:'11:22:33:44:55:66',unifiSite:'s1'};
  const client={mac:context.mac,essid:'Open',ap_mac:context.apMac,is_wired:false};
  it('rejects spoofed MAC, SSID, AP, site and wired or unidentified clients',()=>{
    expect(policy.validGuestClient(context,[client],'s1')).toEqual(client);
    for(const patch of [{mac:'bb:bb:cc:dd:ee:ff'},{ssid:'Other'},{apMac:'22:22:33:44:55:66'},{unifiSite:'s2'}]) expect(()=>policy.validGuestClient({...context,...patch},[client],'s1')).toThrow();
    for(const patch of [{is_wired:true},{is_wired:undefined},{ap_mac:undefined}]) expect(()=>policy.validGuestClient(context,[{...client,...patch}],'s1')).toThrow();
  });
  it('caps duration at campaign end and four hours and rejects under one minute',()=>{
    expect(policy.guestMinutes(campaign,now)).toBe(60);expect(policy.guestMinutes({...campaign,endTime:new Date(now.getTime()+86400000)},now)).toBe(240);
    expect(()=>policy.guestMinutes({...campaign,endTime:new Date(now.getTime()+59999)},now)).toThrow();
  });
});
it('keeps an owned effective campaign captive during a temporary portal outage',async()=>{
 const owned=[{wlanId:'w1',originalGuest:false as const}];const b=boundary([{...wlan,is_guest:true}],owned);
 await policy.reconcileGuestPolicy({site:'s1',campaigns:[campaign],owned,now,portalReady:false,...b});
 expect(b.events).toEqual([]);expect(b.rows()[0].is_guest).toBe(true);expect(b.state()).toEqual(owned);
});
it('does not acquire a missing guest flag from write-ahead ownership during a portal outage',async()=>{
 const owned=[{wlanId:'w1',originalGuest:false as const}];const b=boundary([wlan],owned);
 await policy.reconcileGuestPolicy({site:'s1',campaigns:[campaign],owned,now,portalReady:false,...b});expect(b.events).toEqual([]);expect(b.rows()[0].is_guest).toBe(false);
});
