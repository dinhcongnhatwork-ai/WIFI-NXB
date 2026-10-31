import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({resolve:vi.fn(),request:vi.fn(),snapshot:vi.fn()}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:m.resolve}));
vi.mock('@/lib/network/campaign-hotspot',()=>({configuredHotspotSites:()=>['s1'],hotspotClient:()=>({siteRequest:m.request})}));
vi.mock('@/lib/network/ap-ssh',()=>({readManagedApSnapshot:m.snapshot}));
import {resolveCallbackSsid} from '@/lib/network/unifi-callback-context';
const mac='aa:bb:cc:dd:ee:ff',ap='22:33:44:55:66:88';
beforeEach(()=>{
 vi.resetAllMocks();m.resolve.mockResolvedValue({id:'conn'});
 m.request.mockImplementation(async(path:string)=>({data:path==='stat/device'?[{type:'uap',state:1,mac:ap,ip:'192.168.0.80',vap_table:[{id:'w1',essid:'Open',is_guest:true}]}]:[{key:'mgmt',x_ssh_username:'user',x_ssh_password:'secret'}]}));
 m.snapshot.mockResolvedValue({mac:ap,vap_table:[{id:'w1',essid:'Open',state:'RUN',up:true,sta_table:[{mac}]}]});
});
it('recovers omitted SSID only from the exact MAC on the authenticated AP guest WLAN',async()=>{expect(await resolveCallbackSsid('s1',mac,ap)).toBe('Open');expect(m.snapshot).toHaveBeenCalledTimes(1);});
it('rejects unknown sites before contacting an AP',async()=>{await expect(resolveCallbackSsid('other',mac,ap)).rejects.toMatchObject({status:403});expect(m.request).not.toHaveBeenCalled();});
it('does not guess an SSID when the device has not associated or is on a password WLAN',async()=>{
 m.snapshot.mockResolvedValueOnce({mac:ap,vap_table:[]});await expect(resolveCallbackSsid('s1',mac,ap)).rejects.toMatchObject({status:409});
 m.snapshot.mockResolvedValueOnce({mac:ap,vap_table:[{id:'other',essid:'Password',state:'RUN',up:true,sta_table:[{mac}]}]});await expect(resolveCallbackSsid('s1',mac,ap)).rejects.toMatchObject({status:403});
});
it('rejects duplicate associations, a wrong AP, and unavailable SSH',async()=>{
 const v={id:'w1',essid:'Open',state:'RUN',up:true,sta_table:[{mac}]};
 for(const d of [{mac:ap,vap_table:[v,v]},{mac:'22:33:44:55:66:99',vap_table:[v]}]){m.snapshot.mockResolvedValueOnce(d);await expect(resolveCallbackSsid('s1',mac,ap)).rejects.toMatchObject({status:403});}
 m.snapshot.mockRejectedValueOnce(Error('ssh'));await expect(resolveCallbackSsid('s1',mac,ap)).rejects.toMatchObject({status:409});
});
