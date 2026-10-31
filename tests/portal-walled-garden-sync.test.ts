import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({lookup:vi.fn(),rows:new Map<string,any>(),save:vi.fn()}));vi.mock('@/lib/prisma',()=>({prisma:{systemSetting:{findUnique:async({where}:any)=>m.rows.get(where.key)||null,upsert:m.save}}}));
vi.mock('node:dns/promises',()=>({lookup:m.lookup}));
vi.mock('@/lib/network/campaign-hotspot',()=>({controllerRows:(r:any)=>r.data}));
import {syncPortalWalledGarden} from '@/lib/network/portal-walled-garden-sync';
let settings:any;let client:any;let lease:any;
beforeEach(()=>{vi.resetAllMocks();m.rows.clear();m.save.mockImplementation(async({where,create}:any)=>{m.rows.set(where.key,create);return create;});process.env.NEXT_PUBLIC_APP_URL='https://solutionai.com.vn';process.env.UNIFI_PORTAL_SERVER='192.168.1.253';settings={key:'guest_access',portal_enabled:true,auth:'custom',custom_ip:'192.168.1.253',allowed_subnet_1:'192.168.1.253/32',allowed_subnet_2:'solutionai.com.vn'};lease=vi.fn(async()=>{});m.lookup.mockResolvedValue([{address:'104.21.51.90',family:4},{address:'172.67.177.252',family:4}]);client={siteRequest:vi.fn(async(path:string,method:string,patch:any)=>{if(method==='POST'){Object.assign(settings,patch);return {meta:{rc:'ok'}};}return {data:[{...settings}]};})};});
it('patches only missing exact portal addresses, verifies readback, and avoids repeated config writes',async()=>{
 await syncPortalWalledGarden('campaignHotspot:owned:first:site',client,lease);expect(client.siteRequest.mock.calls.filter((c:any)=>c[1]==='POST')).toEqual([['set/setting/guest_access','POST',{allowed_subnet_3:'104.21.51.90/32',allowed_subnet_4:'172.67.177.252/32'}]]);expect(lease).toHaveBeenCalledTimes(3);
 client.siteRequest.mockClear();await syncPortalWalledGarden('campaignHotspot:owned:first:site',client,lease);expect(client.siteRequest).not.toHaveBeenCalled();
});
it('never writes when the lease is lost, configuration is not owned, or DNS fails',async()=>{
 lease.mockRejectedValue(Error('Lease lost'));await expect(syncPortalWalledGarden('campaignHotspot:owned:lease:site',client,lease)).rejects.toThrow();expect(client.siteRequest.mock.calls.filter((c:any)=>c[1]==='POST')).toHaveLength(0);
 settings.custom_ip='other';await expect(syncPortalWalledGarden('campaignHotspot:owned:other:site',client,lease)).rejects.toThrow();
 settings.custom_ip='192.168.1.253';m.lookup.mockRejectedValue(Error('DNS'));await expect(syncPortalWalledGarden('campaignHotspot:owned:dns:site',client,lease)).rejects.toThrow();expect(client.siteRequest.mock.calls.filter((c:any)=>c[1]==='POST')).toHaveLength(0);
});
it('leaves manual preauthorization policy alone if the portal domain is not explicitly allowed',async()=>{
 delete settings.allowed_subnet_2;await syncPortalWalledGarden('campaignHotspot:owned:manual:site',client,lease);expect(m.lookup).not.toHaveBeenCalled();expect(client.siteRequest.mock.calls.filter((c:any)=>c[1]==='POST')).toHaveLength(0);
});

it('recovers service ownership after restart/ambiguous write and removes retired addresses only',async()=>{
 settings.allowed_subnet_3='104.21.51.90/32';settings.allowed_subnet_4='203.0.113.8/32';
 m.rows.set('campaignHotspot:portalAddresses:restart:site',{value:{version:1,hostname:'solutionai.com.vn',entries:[{field:'allowed_subnet_3',value:'104.21.51.90/32'},{field:'allowed_subnet_3',value:'104.21.51.91/32'}]}});
 m.lookup.mockResolvedValue([{address:'104.21.51.91',family:4}]);await syncPortalWalledGarden('campaignHotspot:owned:restart:site',client,lease);
 expect(settings.allowed_subnet_3).toBe('104.21.51.91/32');expect(settings.allowed_subnet_4).toBe('203.0.113.8/32');expect(m.rows.get('campaignHotspot:portalAddresses:restart:site').value.entries).toEqual([{field:'allowed_subnet_3',value:'104.21.51.91/32'}]);
});

it('keeps write-ahead ownership retryable after a controller timeout rather than silently abandoning addresses',async()=>{
 const original=client.siteRequest.getMockImplementation();let first=true;
 client.siteRequest.mockImplementation(async(...args:any[])=>{const result=await original(...args);if(args[1]==='POST'&&first){first=false;throw Error('Ambiguous timeout');}return result;});
 await expect(syncPortalWalledGarden('campaignHotspot:owned:retry:site',client,lease)).rejects.toThrow();expect(m.rows.get('campaignHotspot:portalAddresses:retry:site').value.entries).toHaveLength(2);
 await syncPortalWalledGarden('campaignHotspot:owned:retry:site',client,lease);expect(settings.allowed_subnet_3).toBe('104.21.51.90/32');expect(settings.allowed_subnet_4).toBe('172.67.177.252/32');
});
