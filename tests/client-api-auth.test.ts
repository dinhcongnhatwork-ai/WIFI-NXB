import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {api} from '@/lib/api';

describe('administration requests over HTTP without a secure cookie',()=>{
 const fetchMock=vi.fn();
 beforeEach(()=>{
  vi.stubGlobal('window',{location:{origin:'http://192.168.1.56:3000'},localStorage:{getItem:vi.fn(()=> 'saved-session')}});
  vi.stubGlobal('fetch',fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({success:true}),{status:200}));
 });
 afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
 it('sends the current session for settings reads and connection writes',async()=>{
  await api.get('/api/settings');
  await api.post('/api/network/connections',{provider:'UNIFI'});
  for(const [,options] of fetchMock.mock.calls)expect(new Headers(options.headers).get('Authorization')).toBe('Bearer saved-session');
 });
 it('retains explicitly supplied tokens and does not send a saved token to other origins or login',async()=>{
  await api.get('/api/settings','explicit-session');
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer explicit-session');
  await api.get('https://other.invalid/api/settings');
  await api.post('/api/auth/login',{username:'admin',password:'test'});
  expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBeNull();
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBeNull();
 });
});
