import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('@/lib/network/ap-ssh',()=>({readManagedApSnapshot:m.read}));
import {readUnifiPortalAssociation,stationFromApSnapshot} from '@/lib/network/unifi-portal-association';
const context={mac:'aa:bb:cc:dd:ee:ff',apMac:'22:33:44:55:66:88',ssid:'Open',unifiSite:'s1'};
const station={mac:context.mac,authorized:false,ip:'192.168.0.100'};
const snapshot=()=>({mac:context.apMac,vap_table:[{id:'w1',essid:'Open',up:true,state:'RUN',sta_table:[{...station}]}]});
const controller=(stations:any[]=[])=>({siteRequest:async(path:string)=>({data:path==='stat/sta'?stations:path==='stat/device'?[{type:'uap',state:1,mac:context.apMac,ip:'192.168.0.80'}]:[{key:'mgmt',x_ssh_username:'admin',x_ssh_password:'secret'}]})});
beforeEach(()=>{vi.resetAllMocks();m.read.mockResolvedValue(snapshot());});
it('uses live AP evidence for the exact MAC and WLAN before controller association catches up',async()=>{
 const result=await readUnifiPortalAssociation(controller(),'conn',context,'w1');
 expect(result).toMatchObject({mac:context.mac,essid:'Open',ap_mac:context.apMac,wlanconf_id:'w1',is_wired:false,authorized:false});
});
it('reads authorization from the AP while the controller still reports unauthorized',async()=>{
 const dump=snapshot();dump.vap_table[0].sta_table[0].authorized=true;m.read.mockResolvedValue(dump);
 const result=await readUnifiPortalAssociation(controller([{...station,essid:'Open',ap_mac:context.apMac,is_wired:false}]),'conn',context,'w1');
 expect(result.authorized).toBe(true);
});
it('does not trust a bare successful grant or a MAC on a different WLAN, AP, or stopped radio',()=>{
 for(const alter of [(d:any)=>d.mac='22:33:44:55:66:99',(d:any)=>d.vap_table[0].id='other',(d:any)=>d.vap_table[0].essid='Password',(d:any)=>d.vap_table[0].up=false,(d:any)=>d.vap_table[0].sta_table=[]]){
  const d=snapshot();alter(d);expect(()=>stationFromApSnapshot(d,context,'w1')).toThrow();
 }
 const d=snapshot();d.vap_table.push(structuredClone(d.vap_table[0]));expect(()=>stationFromApSnapshot(d,context,'w1')).toThrow();
});
it('keeps absent clients pending when AP evidence is unavailable, and refuses definite controller mismatches',async()=>{
 m.read.mockRejectedValue(Error('offline'));await expect(readUnifiPortalAssociation(controller(),'conn',context,'w1')).rejects.toMatchObject({status:409});
 await expect(readUnifiPortalAssociation(controller([{...station,essid:'Password',ap_mac:context.apMac,is_wired:false}]),'conn',context,'w1')).rejects.toMatchObject({status:403});
});
it('refuses a different controller WLAN identity even when the SSID text matches',async()=>{
 await expect(readUnifiPortalAssociation(controller([{...station,essid:'Open',ap_mac:context.apMac,is_wired:false,wlanconf_id:'other'}]),'conn',context,'w1')).rejects.toMatchObject({status:403});
});
it('still verifies AP enforcement after a new grant even if the controller already says authorized',async()=>{
 const c=controller([{...station,essid:'Open',ap_mac:context.apMac,is_wired:false,authorized:true}]);
 expect((await readUnifiPortalAssociation(c,'conn',context,'w1',undefined,true)).authorized).toBe(false);
});
