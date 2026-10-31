import {describe,it,expect} from 'vitest';
import {wifiConnectionSuccess} from '../src/lib/network/portal-success';
describe('verified WiFi connection redirect',()=>{
 it('navigates immediately using HTTP Location without an intermediate confirmation page',async()=>{
  const response=wifiConnectionSuccess('https://www.nxbctqg.org.vn/');
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('https://www.nxbctqg.org.vn/');
  expect(await response.text()).toBe('');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
 });
 it('preserves the configured path, query and fragment in the redirect',async()=>{
  const response=wifiConnectionSuccess('https://example.org/books?a=1&b=2#news');
  expect(response.headers.get('location')).toBe('https://example.org/books?a=1&b=2#news');
  expect(await response.text()).toBe('');
 });
 it.each(['javascript:alert(1)','data:text/html,test','https://username:password@example.org/'])('rejects unsafe destinations: %s',url=>expect(()=>wifiConnectionSuccess(url)).toThrow());
});
