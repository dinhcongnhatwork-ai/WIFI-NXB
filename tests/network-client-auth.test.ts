import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {networkFetch} from '@/components/network/client';
describe('network pages with a token and no cookie',()=>{
 const mockedFetch=vi.fn();
 beforeEach(()=>{
  vi.stubGlobal('window',{location:{origin:'http://192.168.1.56:3000',search:'?connectionId=controller&siteId=m5npy6bn'},localStorage:{getItem:()=> 'saved-token'}});
  vi.stubGlobal('fetch',mockedFetch);mockedFetch.mockResolvedValue(new Response('{}'));
 });
 afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
 it('authenticates connection, site, overview, topology and mutation requests while retaining scope',async()=>{
  for(const path of ['/api/network/connections','/api/unifi/info?type=sites','/api/unifi/overview','/api/unifi/topology'])await networkFetch(path);
  await networkFetch('/api/mikrotik/resources',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"operation":"update"}'});
  for(const [url,init]of mockedFetch.mock.calls){expect(new URL(url).searchParams.get('connectionId')).toBe('controller');expect(new Headers(init.headers).get('authorization')).toBe('Bearer saved-token');}
  expect(mockedFetch.mock.calls.at(-1)?.[1]).toMatchObject({method:'POST',body:'{"operation":"update"}'});
 });
 it('never forwards session or device scope to another origin',async()=>{
  await networkFetch('https://other.invalid/api/unifi/devices');
  const [url,init]=mockedFetch.mock.calls[0];
  expect(new URL(url).search).toBe('');expect(new Headers(init?.headers).get('authorization')).toBeNull();
 });
});
