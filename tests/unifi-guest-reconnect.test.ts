import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn()}));vi.mock('@/lib/network/ap-ssh',()=>({readManagedApSnapshot:m.read}));
import {reconnectUniFiGuest} from '@/lib/network/unifi-guest-reconnect';
const scope={connectionId:'conn',campaignId:'c1',site:'s1',wlanId:'w1',ssid:'Open',mac:'aa:bb:cc:dd:ee:ff',apMac:'22:33:44:55:66:88'};
const dump=(uptime?:number,ssid='Open')=>({mac:scope.apMac,vap_table:[{id:'w1',essid:ssid,up:true,state:'RUN',sta_table:uptime===undefined?[]:[{mac:scope.mac,authorized:false,uptime}]}]});
let client:any;
beforeEach(()=>{vi.resetAllMocks();client={kickClient:vi.fn().mockResolvedValue(true),siteRequest:vi.fn(async(path:string)=>({data:path==='stat/device'?[{type:'uap',mac:scope.apMac,ip:'192.168.0.80',state:1,vap_table:[{id:'w1',essid:'Open',is_guest:true}]}]:[{key:'mgmt',x_ssh_username:'u',x_ssh_password:'p'}]}))};});
it('verifies physical departure after kicking even when controller station telemetry is missing',async()=>{
 m.read.mockResolvedValueOnce(dump(100)).mockResolvedValueOnce(dump());expect(await reconnectUniFiGuest(client,scope)).toBe('reconnected');expect(client.kickClient).toHaveBeenCalledWith(scope.mac);
});
it('accepts a fresh association after an immediate reconnect rather than requiring the device to stay disconnected',async()=>{
 m.read.mockResolvedValueOnce(dump(100)).mockResolvedValueOnce(dump(0));expect(await reconnectUniFiGuest(client,scope)).toBe('reconnected');
});
it('never kicks a missing device or a device that moved to another SSID',async()=>{
 m.read.mockResolvedValueOnce(dump());expect(await reconnectUniFiGuest(client,scope)).toBe('offline');expect(client.kickClient).not.toHaveBeenCalled();
 m.read.mockResolvedValueOnce(dump(100,'Password'));expect(await reconnectUniFiGuest(client,scope)).toBe('skipped');expect(client.kickClient).not.toHaveBeenCalled();
});
it('does not report an acknowledged command as successful when AP uptime never resets',async()=>{
 m.read.mockResolvedValue(dump(100));await expect(reconnectUniFiGuest(client,scope,undefined,async()=>{})).rejects.toMatchObject({status:502});expect(client.kickClient).toHaveBeenCalledTimes(1);
});
it('honors the lease and refuses ambiguous or unverified AP evidence',async()=>{
 m.read.mockResolvedValueOnce(dump(100));await expect(reconnectUniFiGuest(client,scope,async()=>{throw Error('lease lost')})).rejects.toThrow('lease lost');expect(client.kickClient).not.toHaveBeenCalled();
 const d=dump(100);d.vap_table.push(d.vap_table[0]);m.read.mockResolvedValueOnce(d);await expect(reconnectUniFiGuest(client,scope)).rejects.toThrow();expect(client.kickClient).not.toHaveBeenCalled();
});
