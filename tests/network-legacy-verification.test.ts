import { describe, it, expect } from 'vitest';
import { legacyReadUrl, verifyLegacyChange } from '@/lib/network/legacy-verification';
describe('legacy network read-back verification',()=>{
 it('verifies observed toggles but rejects stale or contradictory read-back',()=>{
  const before=[{id:'*1',disabled:false}];
  expect(verifyLegacyChange('MIKROTIK','/api/mikrotik/interfaces',{action:'disable',id:'*1'},before,[{id:'*1',disabled:true}])).toBe(true);
  expect(verifyLegacyChange('MIKROTIK','/api/mikrotik/interfaces',{action:'disable',id:'*1'},before,before)).toBe(false);
 });
 it('verifies deletion only when a known before-record disappeared',()=>{
  expect(verifyLegacyChange('UNIFI','/api/unifi/ssids',{action:'delete',id:'a'},[{_id:'a'}],[])).toBe(true);
  expect(verifyLegacyChange('UNIFI','/api/unifi/ssids',{action:'delete',id:'a'},[],[])).toBe(false);
 });
 it('leaves commands and secret changes uncertain',()=>{
  expect(verifyLegacyChange('UNIFI','/api/unifi/devices',{action:'reboot',deviceId:'a'},[{_id:'a'}],[{_id:'a'}])).toBe(false);
  expect(verifyLegacyChange('UNIFI','/api/unifi/ssids',{action:'update',id:'a',name:'WiFi',passphrase:'secret'},[{_id:'a'}],[{_id:'a',name:'WiFi'}])).toBe(false);
 });
 it('verifies normalized UniFi block state and scopes settings reads to the changed resource',()=>{
  expect(verifyLegacyChange('UNIFI','/api/unifi/clients',{action:'block',mac:'AA'},[],[{mac:'aa',isBlocked:true}])).toBe(true);
  const url=new URL(legacyReadUrl('http://app/api/unifi/settings?connectionId=controller&siteId=site',{type:'usergroup'}));expect(url.searchParams.get('type')).toBe('usergroups');expect(url.searchParams.get('siteId')).toBe('site');
 });
});
