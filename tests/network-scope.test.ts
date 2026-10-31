import { describe, expect, it } from 'vitest';
import { networkScopeHref } from '@/lib/network/scope';
describe('network navigation scope', () => {
 it('keeps the selected nondefault router on legacy and sidebar links', () => {
  expect(networkScopeHref('/admin/mikrotik/interfaces', '/admin/mikrotik', new URLSearchParams('connectionId=router-b&resource=addresses'))).toBe('/admin/mikrotik/interfaces?connectionId=router-b');
 });
 it('keeps a UniFi controller and site across its pages', () => {
  expect(networkScopeHref('/admin/unifi/ssids', '/admin/unifi', new URLSearchParams('connectionId=controller-b&siteId=branch'))).toBe('/admin/unifi/ssids?connectionId=controller-b&siteId=branch');
 });
 it('does not carry credentials or scope between providers and preserves explicit targets', () => {
  const params=new URLSearchParams('connectionId=router-b&siteId=branch&token=secret');
  expect(networkScopeHref('/admin/unifi/devices','/admin/mikrotik',params)).toBe('/admin/unifi/devices');
  expect(networkScopeHref('/admin/mikrotik/interfaces?connectionId=router-a#details','/admin/mikrotik',params)).toBe('/admin/mikrotik/interfaces?connectionId=router-a#details');
 });
});
