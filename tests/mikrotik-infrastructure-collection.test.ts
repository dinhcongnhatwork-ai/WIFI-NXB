import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({rawGet: vi.fn(), arp: vi.fn(), leases: vi.fn(), cache: new Map<string,string>()}));
vi.mock('@/lib/redis', () => ({redis: {
  get: vi.fn(async (key:string) => mocks.cache.get(key) || null),
  set: vi.fn(async () => 'OK'), eval: vi.fn(async () => 1),
  multi: () => {const transaction = {set: (key:string, value:string) => {mocks.cache.set(key,value); return transaction;},exec:async()=>[]}; return transaction;},
}}));
vi.mock('@/lib/network/connections', () => ({resolveConnection: async () => ({id:'router',name:'Router',baseUrl:'https://router.test',config:{}})}));
vi.mock('@/lib/mikrotik', () => ({createMikrotikClientFromRequest:async()=>({rawGet:mocks.rawGet,getArpEntries:mocks.arp,getDhcpLeases:mocks.leases})}));
import {getSampledTopology} from '@/lib/network/traffic-service';
beforeEach(()=>{mocks.cache.clear(); mocks.rawGet.mockReset();mocks.arp.mockReset();mocks.leases.mockReset();mocks.rawGet.mockImplementation(async (path:string)=>path==='/system/identity'?[{name:'Router'}]:path==='/interface'?[{name:'ether1',type:'ether',running:'true'}]:[]);mocks.arp.mockResolvedValue([]);mocks.leases.mockResolvedValue([]);});
describe('light MikroTik topology collection',()=>{
  it('does not read any client table and retains interface information for details',async()=>{
    const result=await getSampledTopology('MIKROTIK',new Request('https://app/api/mikrotik/topology'),{infrastructureOnly:true});
    const paths=mocks.rawGet.mock.calls.map(([path])=>path);
    expect(paths).toContain('/ip/neighbor');expect(paths).toContain('/interface');
    for(const path of ['/interface/bridge/host','/ip/hotspot/active','/ip/arp','/ip/dhcp-server/lease']) expect(paths).not.toContain(path);
    expect(mocks.arp).not.toHaveBeenCalled();expect(mocks.leases).not.toHaveBeenCalled();
    expect(result.nodes.find(n=>n.id==='router:local')?.meta?.portTable).toHaveLength(1);
  });
  it('isolates infrastructure caches from the full collector and keeps existing full mode available',async()=>{
    const req=new Request('https://app/api/mikrotik/topology');
    await getSampledTopology('MIKROTIK',req);
    expect(mocks.arp).toHaveBeenCalledTimes(1);expect(mocks.leases).toHaveBeenCalledTimes(1);
    mocks.rawGet.mockClear();
    await getSampledTopology('MIKROTIK',req,{infrastructureOnly:true});
    expect(mocks.rawGet).toHaveBeenCalled();
    mocks.rawGet.mockClear();
    await getSampledTopology('MIKROTIK',req,{infrastructureOnly:true});
    expect(mocks.rawGet).not.toHaveBeenCalled();
  });
});
