import { afterEach, describe, it, expect, vi } from 'vitest';
import { UnifiClient } from '@/lib/unifi';
import { MikrotikClient } from '@/lib/mikrotik';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{vi.unstubAllGlobals();UnifiClient.clearSessionCache();});
describe('network adapters',()=>{
 it('does not turn unauthorized device reads into a healthy empty list',async()=>{
  const fetch=vi.fn().mockResolvedValue(json({message:'Forbidden'},403));vi.stubGlobal('fetch',fetch);
  const client=new UnifiClient({controllerUrl:'https://controller.test',username:'u',password:'p',site:'selected'});
  await expect(client.getDevices()).rejects.toThrow('Forbidden');expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toContain('/api/s/selected/');
 });
 it('rejects writes once without protocol or route fallback',async()=>{
  const fetch=vi.fn().mockRejectedValue(new Error('fetch failed'));vi.stubGlobal('fetch',fetch);
  const mk=new MikrotikClient({host:'https://router.test',username:'u',password:'p',allowInsecure:false});
  await expect(mk.rawRequest('/ip/address','PUT',{address:'10.0.0.1/24'})).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockClear();const uf=new UnifiClient({controllerUrl:'https://controller.test',username:'u',password:'p'});
  await expect(uf.renameDevice('d1','Updated')).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('never falls back from an explicit invalid UniFi site',async()=>{
  const fetch=vi.fn().mockResolvedValue(json({message:'Missing site'},404));vi.stubGlobal('fetch',fetch);
  const client=new UnifiClient({controllerUrl:'https://controller.test',site:'nonexistent'});
  await expect(client.getDevices()).rejects.toThrow();expect(fetch.mock.calls.every(([url])=>String(url).includes('/s/nonexistent/'))).toBe(true);
 });
 it('detects official API version, uses API key, and honors server pagination',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(json({applicationVersion:'10.6.106'})).mockResolvedValueOnce(json({data:[{id:'1',macAddress:'AA',name:'AP',state:'ONLINE'}],limit:1,totalCount:2})).mockResolvedValueOnce(json({data:[{id:'2',macAddress:'BB',name:'Switch',state:'OFFLINE'}],limit:1,totalCount:2}));vi.stubGlobal('fetch',fetch);
  const client=new UnifiClient({controllerUrl:'https://controller.test',apiKey:'test-secret',site:'site-uuid'});await client.login();const rows=await client.getDevices();
  expect(client.version).toBe('10.6.106');expect(rows).toHaveLength(2);expect(rows[0].uptime).toBeUndefined();expect(rows[0].cpuUsage).toBeUndefined();expect(rows[0].status).toBe('online');
  expect(fetch.mock.calls[1][0]).toContain('/integration/v1/sites/site-uuid/devices?offset=0');expect(fetch.mock.calls[2][0]).toContain('offset=1');expect(fetch.mock.calls[1][1].headers['X-API-Key']).toBe('test-secret');
 });
 it('preserves missing UniFi status as unknown',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({data:[{_id:'d',mac:'AA',name:'Unknown'}]})));
  const client=new UnifiClient({controllerUrl:'https://controller.test',rejectUnauthorized:true});const rows=await client.getDevices();expect(rows[0].status).toBe('unknown');expect(rows[0].uptime).toBeUndefined();
 });
 it('fails MikroTik system resource reads explicitly',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({message:'No permission'},403)));
  const client=new MikrotikClient({host:'https://router.test',allowInsecure:false});await expect(client.getSystemResource()).rejects.toThrow('No permission');
 });
});

describe('legacy UniFi endpoint compatibility',()=>{
 it('reads Network Server 9 controller info from stat/sysinfo without requesting the bare site object',async()=>{
  const fetch=vi.fn().mockImplementation(async(url)=>String(url).endsWith('/stat/sysinfo')?json({meta:{rc:'ok'},data:[{name:'Network Server',version:'9.4.19'}]}):json({meta:{rc:'error',msg:'api.err.InvalidObject'}},400));vi.stubGlobal('fetch',fetch);
  await expect(new UnifiClient({controllerUrl:'https://controller.test',site:'m5npy6bn'}).getControllerInfo()).resolves.toMatchObject({version:'9.4.19'});
  expect(fetch.mock.calls[0][0]).toBe('https://controller.test/api/s/m5npy6bn/stat/sysinfo');
 });
 it('uses server_version from the status response when sysinfo is unavailable',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url)=>String(url).endsWith('/status')?json({meta:{rc:'ok',server_version:'9.4.19'},data:[]}):json({message:'Not found'},404)));
  await expect(new UnifiClient({controllerUrl:'https://controller.test'}).getControllerInfo()).resolves.toMatchObject({version:'9.4.19'});
 });
 it('tries a supported controller info endpoint after 404',async()=>{
  const fetch=vi.fn().mockImplementation(async(url)=>String(url).endsWith('/api/v1/info')?json({data:[{name:'Branch',version:'9.0'}]}):json({message:'Not found'},404));vi.stubGlobal('fetch',fetch);
  await expect(new UnifiClient({controllerUrl:'https://controller.test'}).getControllerInfo()).resolves.toMatchObject({name:'Branch'});
 });
 for(const [method,resource] of [['getWlanConfs','wlanconf'],['getNetworks','networkconf']] as const){
  it(`${method} retains a successful response when another variant is absent`,async()=>{
   vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url)=>String(url).includes(`/rest/${resource}`)?json({data:[{_id:'record',name:'Branch'}]}):json({message:'Not found'},404)));
   await expect(new UnifiClient({controllerUrl:'https://controller.test'})[method]()).resolves.toMatchObject([{_id:'record',name:'Branch'}]);
  });
  it(`${method} supports the second endpoint, but fails if all are absent or access is denied`,async()=>{
   const fetch=vi.fn().mockImplementation(async(url)=>String(url).includes(`/list/${resource}`)?json({data:[]}):json({message:'Not found'},404));vi.stubGlobal('fetch',fetch);
   const client=new UnifiClient({controllerUrl:'https://controller.test'});await expect(client[method]()).resolves.toEqual([]);
   fetch.mockImplementation(async()=>json({message:'Not found'},404));await expect(client[method]()).rejects.toThrow('Not found');
   fetch.mockImplementation(async()=>json({message:'Forbidden'},403));await expect(client[method]()).rejects.toThrow('Forbidden');
  });
 }
});
describe('legacy fixed-resource ID boundaries',()=>{
 for(const id of ['known/other','known?cmd=reset','known#fragment','../other','%2fother']){
  it(`rejects the supplied record ID ${id} before device traffic`,async()=>{
   const fetch=vi.fn().mockResolvedValue(json({data:[],meta:{rc:'ok'}}));vi.stubGlobal('fetch',fetch);
   const client=new UnifiClient({controllerUrl:'https://controller.test'});
   for(const call of [()=>client.getDevice(id),()=>client.getClient(id),()=>client.getSsidById(id),()=>client.getNetwork(id),()=>client.renameDevice(id,'Name'),()=>client.updateSsid(id,{name:'Name'}),()=>client.deleteNetwork(id)])await expect(call()).rejects.toThrow();
   expect(fetch).not.toHaveBeenCalled();
  });
 }
});

describe('legacy RouterOS supplied ID boundaries',()=>{
 it('never lets mutation record IDs introduce nested resource paths or query strings',async()=>{
  const fetch=vi.fn().mockResolvedValue(json({}));vi.stubGlobal('fetch',fetch);
  const client=new MikrotikClient({host:'https://router.test',allowInsecure:false});
  for(const id of ['known/other','known?cmd=reset','%2fother','../other']){
   expect(await client.setInterfaceDisabled(id,true)).toBe(false);
   expect(await client.removeIpAddress(id)).toBe(false);
  }
  expect(fetch).not.toHaveBeenCalled();
 });
});
