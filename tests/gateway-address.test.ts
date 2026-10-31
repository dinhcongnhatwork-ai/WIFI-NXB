import {describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/network/mikrotik-fleet',()=>({getMikrotikFleetTopology:vi.fn()}));
import {gatewayAddresses} from '@/lib/network/gateway-address';
import {buildUnifiTopology,buildMikrotikTopology} from '@/lib/network/topology';
describe('observed gateway addresses',()=>{
 it('resolves gateway MAC to its LAN bridge address rather than the router WAN address',()=>{
  const topology:any={nodes:[{id:'r',type:'gateway',status:'online',ip:'203.0.113.5',meta:{managed:true,connectionId:'r',portTable:[{mac:'D0:EA:11:CC:55:E9',name:'ether15'},{mac:'D0:EA:11:CC:55:E9',name:'bridge',ip:'192.168.0.1'}]}}],links:[],warnings:[],observedAt:'now'};
  expect(gatewayAddresses(topology).get('d0:ea:11:cc:55:e9')?.ip).toBe('192.168.0.1');
 });
 it('does not choose offline hardware or resolve conflicting MAC addresses',()=>{
  const node=(ip:string,status='online')=>({status,meta:{managed:true,portTable:[{mac:'aa:bb:cc:dd:ee:ff',ip}]}});
  expect(gatewayAddresses({nodes:[node('192.168.0.1','offline')]} as any).size).toBe(0);
  expect(gatewayAddresses({nodes:[node('192.168.0.1'),node('192.168.1.1')]} as any).size).toBe(0);
 });
 it('prefers active AP gateway identity and never assigns a fallback IP when only the MAC is known',()=>{
  const topology=buildUnifiTopology([{mac:'old',type:'uap',status:'offline',gateway_mac:'old-gateway',config_network:{gateway:'192.168.1.1'}},{mac:'new',type:'uap',status:'online',gateway_mac:'d0:ea:11:cc:55:e9'}],[]);
  expect(topology.nodes.find(n=>n.type==='gateway')).toMatchObject({mac:'d0:ea:11:cc:55:e9'});
  expect(topology.nodes.find(n=>n.type==='gateway')?.ip).toBeUndefined();
 });
 it('uses an enabled LAN bridge address for the MikroTik card instead of the first WAN address',()=>{
  const graph=buildMikrotikTopology({},[{name:'bridge',type:'bridge'},{name:'pppoe-out1',type:'pppoe-out'}],[],[],[],'now',[],[],[{interface:'pppoe-out1',address:'203.0.113.5/32'},{interface:'bridge',address:'192.168.0.1/22'}]);
  expect(graph.nodes.find(n=>n.id==='router:local')?.ip).toBe('192.168.0.1');
 });
});
