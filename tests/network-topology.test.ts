import { describe, it, expect } from 'vitest';
import { buildUnifiTopology, buildMikrotikTopology } from '@/lib/network/topology';
const time='2026-10-21T10:00:00.000Z';
describe('observed network topology',()=>{
 it('keeps unknown attachments isolated and includes every node',()=>{
  const topology=buildUnifiTopology([{_id:'gw',mac:'AA',type:'ugw',name:'Gateway'},{_id:'ap',mac:'BB',type:'uap',uplink:{mac:'AA',port_idx:2}}],[{mac:'CC',hostname:'Known',ap_mac:'BB'},{mac:'DD',hostname:'Unknown'}],time);
  expect(topology.nodes).toHaveLength(4);
  expect(topology.links.map(e=>[e.source,e.target])).toEqual([['device:aa','device:bb'],['device:bb','client:cc']]);
  expect(topology.nodes.find(n=>n.id==='client:dd')?.group).toBe('unknown');
  expect(topology.links.every(e=>e.evidence&&e.observedAt===time&&e.layer==='physical')).toBe(true);
 });
 it('uses switch-port client evidence and stable IDs independent of list order',()=>{
  const devices=[{_id:'switch',mac:'AA',type:'usw'}];const clients=[{mac:'CC',is_wired:true,sw_mac:'AA',sw_port:4},{mac:'DD',is_wired:true}];
  const a=buildUnifiTopology(devices,clients,time),b=buildUnifiTopology(devices,[...clients].reverse(),time);
  expect(a.links[0]).toMatchObject({source:'device:aa',target:'client:cc',sourcePort:'4',evidence:'client.sw_mac',type:'wired'});
  expect(a.nodes.map(n=>n.id).sort()).toEqual(b.nodes.map(n=>n.id).sort());
  expect(a.links.some(e=>e.target==='client:dd')).toBe(false);
 });
 it('separates MikroTik interface membership from physical neighbor/bridge host evidence',()=>{
  const graph=buildMikrotikTopology({name:'R1'},[{'.id':'*1',name:'ether1',type:'ether'},{'.id':'*2',name:'bridge',type:'bridge'}],[{'mac-address':'AA',identity:'Switch',interface:'ether1'}],[{'mac-address':'BB','on-interface':'ether1'},{'mac-address':'CC','on-interface':'missing'},{'mac-address':'DD',local:'true'}],[{bridge:'bridge',interface:'ether1'}],time,['LLDP partial']);
  expect(graph.links.find(e=>e.type==='interface')?.layer).toBe('logical');
  expect(graph.links.find(e=>e.type==='neighbor')).toMatchObject({source:'interface:*1',target:'neighbor:aa',layer:'physical',evidence:'/ip/neighbor'});
  expect(graph.nodes.find(n=>n.id==='client:cc')?.group).toBe('unknown');
  expect(graph.nodes.find(n=>n.id==='client:dd')).toBeUndefined();
  expect(graph.warnings).toEqual(['LLDP partial']);
 });
});
