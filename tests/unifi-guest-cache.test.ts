import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),purge:vi.fn()}));
vi.mock('@/lib/network/ap-ssh',()=>({purgeApGuestMac:m.purge}));
import {clearUniFiGuestCache} from '@/lib/network/unifi-guest-cache';
const scope={connectionId:'conn',site:'s1',campaignId:'c1',wlanId:'w1',ssid:'Open',mac:'aa:bb:cc:dd:ee:ff',apMac:'22:33:44:55:66:77'};
beforeEach(()=>{vi.resetAllMocks();m.purge.mockResolvedValue(undefined);m.read.mockImplementation(async(path:string)=>({data:path==='stat/device'?[{type:'uap',mac:'22:33:44:55:66:77',ip:'192.168.0.80',state:1,vap_table:[{id:'w1',essid:'Open',is_guest:true}]},{type:'uap',mac:'22:33:44:55:66:88',ip:'192.168.0.81',state:0,vap_table:[{id:'w1',essid:'Open',is_guest:true}]},{type:'uap',mac:'22:33:44:55:66:99',ip:'192.168.0.82',state:1,vap_table:[{id:'other',essid:'Other',is_guest:true}]}]:[{key:'mgmt',x_ssh_username:'admin',x_ssh_password:'secret'}]}));});
it('purges only one known guest MAC on APs hosting this WLAN and retains offline APs for retry',async()=>{
 expect(await clearUniFiGuestCache({siteRequest:m.read},scope)).toEqual(['22:33:44:55:66:88']);expect(m.purge).toHaveBeenCalledTimes(1);expect(m.purge.mock.calls[0][0]).toMatchObject({host:'192.168.0.80',apMac:'22:33:44:55:66:77',mac:scope.mac});
});
it('retains a failed online AP for retry and never sends an injected command',async()=>{
 m.purge.mockRejectedValue(Error('SSH failure'));expect(await clearUniFiGuestCache({siteRequest:m.read},{...scope,site:'s2'})).toEqual(['22:33:44:55:66:77','22:33:44:55:66:88']);
 await expect(clearUniFiGuestCache({siteRequest:m.read},{...scope,mac:'aa; reboot',site:'s3'})).rejects.toThrow();expect(m.purge).toHaveBeenCalledTimes(1);
});
it('keeps a pending AP whose metadata is temporarily absent and skips already verified APs',async()=>{
 expect(await clearUniFiGuestCache({siteRequest:m.read},scope,['22:33:44:55:66:88','22:33:44:55:66:aa'])).toEqual(['22:33:44:55:66:88','22:33:44:55:66:aa']);expect(m.purge).not.toHaveBeenCalled();
 expect(await clearUniFiGuestCache({siteRequest:m.read},scope,[])).toEqual([]);expect(m.read).toHaveBeenCalledTimes(2);
});
it('retains offline APs with missing VAP data until their WLAN can be verified',async()=>{
 m.read.mockImplementation(async(path:string)=>({data:path==='stat/device'?[{type:'uap',mac:'22:33:44:55:66:88',state:0,vap_table:[]}]:[{key:'mgmt',x_ssh_username:'admin',x_ssh_password:'secret'}]}));
 expect(await clearUniFiGuestCache({siteRequest:m.read},scope)).toEqual(['22:33:44:55:66:77','22:33:44:55:66:88']);expect(m.purge).not.toHaveBeenCalled();
});
it('waits for all started AP operations to settle before releasing the caller lease on failure',async()=>{
 m.read.mockImplementation(async(path:string)=>({data:path==='stat/device'?['77','88'].map(suffix=>({type:'uap',mac:'22:33:44:55:66:'+suffix,ip:'192.168.0.80',state:1,vap_table:[{id:'w1',essid:'Open',is_guest:true}]})):[{key:'mgmt',x_ssh_username:'admin',x_ssh_password:'secret'}]}));
 let finish!:()=>void,settled=false;m.purge.mockRejectedValueOnce(Error('first AP failed')).mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const request=clearUniFiGuestCache({siteRequest:m.read},scope,['22:33:44:55:66:77','22:33:44:55:66:88']).finally(()=>{settled=true;});
 await vi.waitFor(()=>expect(m.purge).toHaveBeenCalledTimes(2));expect(settled).toBe(false);finish();expect(await request).toEqual(['22:33:44:55:66:77']);expect(settled).toBe(true);
});
it('retains the recorded session AP even when another AP advertises the WLAN',async()=>{
 const missing='22:33:44:55:66:aa';
 expect(await clearUniFiGuestCache({siteRequest:m.read},{...scope,apMac:missing})).toEqual(['22:33:44:55:66:88',missing]);expect(m.purge).toHaveBeenCalledTimes(1);
});
it('prioritizes the connected AP and bounds cache cleanup so a timer does not wait for every AP',async()=>{
 const devices=Array.from({length:8},(_,i)=>({type:'uap',mac:`22:33:44:55:66:${String(i+70)}`,ip:`192.168.0.${i+80}`,state:1,vap_table:[{id:'w1',essid:'Open',is_guest:true}]}));
 const current=devices[7].mac;
 m.read.mockImplementation(async(path:string)=>({data:path==='stat/device'?devices:[{key:'mgmt',x_ssh_username:'admin',x_ssh_password:'secret'}]}));
 const pending=await clearUniFiGuestCache({siteRequest:m.read},{...scope,apMac:current});
 expect(m.purge.mock.calls[0][0].apMac).toBe(current);expect(m.purge.mock.calls.length).toBeLessThanOrEqual(3);expect(pending.length).toBeGreaterThanOrEqual(5);
});
