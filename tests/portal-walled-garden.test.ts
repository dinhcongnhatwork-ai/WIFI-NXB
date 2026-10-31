import {expect,it} from 'vitest';
import {portalAddressPatch} from '@/lib/network/portal-walled-garden';
const settings={portal_enabled:true,auth:'custom',custom_ip:'192.168.1.253',allowed_subnet_1:'192.168.1.253/32',allowed_subnet_2:'solutionai.com.vn'};
it('allows every resolved IPv4 without relying on an AP DNS cache or overwriting existing entries',()=>{
 expect(portalAddressPatch(settings,['104.21.51.90','172.67.177.252'])).toEqual({allowed_subnet_3:'104.21.51.90/32',allowed_subnet_4:'172.67.177.252/32'});
 const updated={...settings,allowed_subnet_3:'104.21.51.90/32',allowed_subnet_4:'172.67.177.252/32'};expect(portalAddressPatch(updated,['172.67.177.252','104.21.51.90'])).toEqual({});
});
it('preserves unrelated rules, recognizes an explicit address and deduplicates DNS',()=>{
 expect(portalAddressPatch({...settings,allowed_subnet_3:'104.21.51.90',allowed_subnet_5:'10.10.0.0/16'},['104.21.51.90','172.67.177.252','172.67.177.252'])).toEqual({allowed_subnet_4:'172.67.177.252/32'});
});
it('rejects empty, excessive or invalid DNS results without any changes',()=>{
 for(const ips of [[],['0.0.0.0'],['127.0.0.1'],['224.0.0.1'],['::1'],['1.2.3'],Array.from({length:9},(_,i)=>`104.21.51.${i+1}`)])expect(()=>portalAddressPatch(settings,ips)).toThrow();
});

it('retires only owned addresses on DNS rotation, reuses slots, and preserves manual rules',async()=>{
 const {portalAddressPlan}=await import('@/lib/network/portal-walled-garden');
 const current={...settings,allowed_subnet_3:'104.21.51.90/32',allowed_subnet_4:'172.67.177.252/32',allowed_subnet_5:'203.0.113.8/32'};
 const owned=[{field:'allowed_subnet_3',value:'104.21.51.90/32'},{field:'allowed_subnet_4',value:'172.67.177.252/32'}];
 const plan=portalAddressPlan(current,['104.21.51.91'],owned);expect(plan.patch).toEqual({allowed_subnet_3:'104.21.51.91/32',allowed_subnet_4:''});expect(plan.entries).toEqual([{field:'allowed_subnet_3',value:'104.21.51.91/32'}]);expect(plan.patch).not.toHaveProperty('allowed_subnet_5');
 const edited=portalAddressPlan({...current,allowed_subnet_3:'203.0.113.9/32'},['172.67.177.252'],owned);expect(edited.patch).toEqual({});expect(edited.entries).toEqual([{field:'allowed_subnet_4',value:'172.67.177.252/32'}]);
});
