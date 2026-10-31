import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{systemSetting:{findUnique:m.find}}}));
import {guestMacDeleteInput,purgeApGuestMac} from '@/lib/network/ap-ssh';
const input={connectionId:'conn',site:'s1',apMac:'22:33:44:55:66:77',host:'192.168.0.80',username:'admin',password:'secret',mac:'aa:bb:cc:dd:ee:ff'};
beforeEach(()=>vi.resetAllMocks());
it('uses only a canonical unicast MAC as fixed-command stdin',()=>{
 expect(guestMacDeleteInput('AA:BB:CC:DD:EE:FF')).toBe('del guest_authorized_mac aa:bb:cc:dd:ee:ff\n');
 for(const mac of ['aa; reboot','aa:bb:cc:dd:ee:ff\nflush','ff:ff:ff:ff:ff:ff'])expect(()=>guestMacDeleteInput(mac)).toThrow();
});
it('rejects public or injected SSH destinations before reading credentials or opening a connection',async()=>{
 for(const host of ['8.8.8.8','172.32.0.1','127.0.0.1','192.168.0.80; reboot'])await expect(purgeApGuestMac({...input,host})).rejects.toThrow('Invalid managed AP connection');
 expect(m.find).not.toHaveBeenCalled();
});
it('refuses a malformed persisted SSH host identity before connecting',async()=>{
 m.find.mockResolvedValue({value:{sha256:'invalid'}});await expect(purgeApGuestMac(input)).rejects.toThrow('Invalid AP SSH host identity');
});
