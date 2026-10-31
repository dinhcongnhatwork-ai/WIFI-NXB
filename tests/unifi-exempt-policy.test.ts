import {describe,it,expect} from 'vitest';
import {canonicalDeviceMac,deviceInput,exemptionKey,parseDeviceList,parseExemption} from '@/lib/network/unifi-exempt-policy';
describe('approved UniFi device policy',()=>{
 it.each(['AA-BB-CC-DD-EE-FF','aabb.ccdd.eeff','aabbccddeeff','aa:bb:cc:dd:ee:ff'])('normalizes %s',mac=>expect(canonicalDeviceMac(mac)).toBe('aa:bb:cc:dd:ee:ff'));
 it.each(['00:00:00:00:00:00','ff:ff:ff:ff:ff:ff','01:22:33:44:55:66','aabbccdd','aa:bb:cc:dd:ee:gg','aabb-ccdd.eeff'])('rejects invalid or group MAC %s',mac=>expect(()=>canonicalDeviceMac(mac)).toThrow());
 it('validates names and explicit enabled state',()=>{
  expect(deviceInput({ownerName:' Đinh Công Nhất ',deviceName:'Laptop',mac:'aabbccddeeff',enabled:true})).toEqual({ownerName:'Đinh Công Nhất',deviceName:'Laptop',mac:'aa:bb:cc:dd:ee:ff',enabled:true});
  for(const change of [{ownerName:''},{deviceName:''},{enabled:'true'},{ownerName:'a'.repeat(121)}])expect(()=>deviceInput({ownerName:'Name',deviceName:'Laptop',mac:'aabbccddeeff',enabled:true,...change})).toThrow();
 });
 it('imports quoted CSV or semicolon/tab rows, rejects duplicates and oversized batches',()=>{
  expect(parseDeviceList('Tên;Thiết bị;MAC\nĐinh Công Nhất;Laptop;aa-bb-cc-dd-ee-ff')).toHaveLength(1);
  expect(parseDeviceList('"Nguyễn, Văn A",Laptop,aa:bb:cc:dd:ee:ff')[0].ownerName).toBe('Nguyễn, Văn A');
  expect(()=>parseDeviceList('A;Laptop;aabbccddeeff\nB;Phone;AA-BB-CC-DD-EE-FF')).toThrow();
  expect(()=>parseDeviceList(Array(101).fill('A;Laptop;aabbccddeeff').join('\n'))).toThrow();
 });
 it('requires scoped server approval, rejects corrupt identities and approval metadata',()=>{
  const row={version:1,connectionId:'conn',site:'s1',...deviceInput({ownerName:'A',deviceName:'Laptop',mac:'aabbccddeeff',enabled:true}),approvedAt:1,approvedBy:'admin',createdAt:1,updatedAt:1};
  const key=exemptionKey(row);expect(parseExemption(key,row)).toEqual(row);
  for(const change of [{site:'other'},{approvedBy:null},{approvedAt:null},{version:2}])expect(()=>parseExemption(key,{...row,...change})).toThrow();
 });
});
