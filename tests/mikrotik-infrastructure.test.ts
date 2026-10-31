import {describe,it,expect} from 'vitest';
import {mikrotikInfrastructureTopology} from '@/lib/network/mikrotik-infrastructure';
import type {Topology} from '@/lib/network/topology';
const at='2026-10-29T06:00:00Z';
function fixture():Topology{return {observedAt:at,warnings:[],nodes:[
{id:'r',type:'gateway',name:'Router',status:'online',meta:{provider:'mikrotik',managed:true,connectionId:'r'}},
{id:'s',type:'switch',name:'Access switch',status:'online',meta:{provider:'mikrotik',managed:true,connectionId:'s'}},
{id:'port',type:'interface',name:'ether7',status:'running',meta:{provider:'mikrotik',connectionId:'r'}},
{id:'offline',type:'switch',name:'Offline',status:'offline',meta:{provider:'mikrotik',managed:true}},
{id:'unknown',type:'switch',name:'Unknown',status:'unknown',meta:{provider:'mikrotik',managed:true}},
{id:'ap',type:'ap',name:'UniFi',status:'online',meta:{provider:'unifi'}},
{id:'foreign',type:'neighbor',name:'Cisco',status:'online',meta:{provider:'mikrotik',platform:'Cisco'}},
...Array.from({length:976},(_,i)=>({id:`client${i}`,type:'client',name:`Client ${i}`,status:'online',meta:{provider:'mikrotik'}}))],links:[
{id:'member',source:'r',target:'port',type:'interface',layer:'logical',evidence:'/interface',observedAt:at},
{id:'cable',source:'port',target:'s',type:'neighbor',layer:'physical',sourcePort:'ether7',targetPort:'sfp1',evidence:'/ip/neighbor',observedAt:at},
{id:'offline-cable',source:'r',target:'offline',type:'neighbor',layer:'physical',evidence:'/ip/neighbor',observedAt:at},
{id:'ap-cable',source:'s',target:'ap',type:'neighbor',layer:'physical',evidence:'/ip/neighbor',observedAt:at},
...Array.from({length:976},(_,i)=>({id:`edge${i}`,source:'port',target:`client${i}`,type:'bridge-host',layer:'logical' as const,evidence:'/interface/bridge/host',observedAt:at}))]};}
describe('MikroTik online hardware-only topology',()=>{
 it('reduces a 976-client mixed graph to online MikroTik hardware only in both graph and inventory data',()=>{const result=mikrotikInfrastructureTopology(fixture());expect(result.nodes.map(n=>n.id).sort()).toEqual(['r','s']);expect(result.links).toHaveLength(1);expect(result.nodes.every(n=>n.status==='online')).toBe(true);});
 it('contracts interface membership into the observed hardware link and keeps both physical port labels',()=>{const result=mikrotikInfrastructureTopology(fixture());expect(result.links[0]).toMatchObject({source:'r',target:'s',sourcePort:'ether7',targetPort:'sfp1',evidence:'/ip/neighbor',layer:'physical'});});
 it('does not mutate cached graphs or synthesize connections through offline devices',()=>{const graph=fixture();graph.links.push({id:'offline-uplink',source:'offline',target:'s',type:'neighbor',layer:'physical',evidence:'/ip/neighbor',observedAt:at});const count=graph.nodes.length;const result=mikrotikInfrastructureTopology(graph);expect(graph.nodes).toHaveLength(count);expect(graph.links.find(e=>e.id==='cable')?.source).toBe('port');expect(result.links.some(e=>e.id==='offline-uplink')).toBe(false);});
 it('keeps true online MikroTik AP hardware but excludes foreign devices even when collected by MikroTik',()=>{const graph=fixture();graph.nodes.push({id:'mt-ap',type:'ap',name:'cAP',status:'online',meta:{vendor:'MikroTik'}});expect(mikrotikInfrastructureTopology(graph).nodes.map(n=>n.id)).toContain('mt-ap');expect(mikrotikInfrastructureTopology(graph).nodes.map(n=>n.id)).not.toContain('foreign');});
 it('is idempotent and trims port peer lists to included online hardware',()=>{const graph=fixture();graph.nodes[0].meta!.portConnections=[{peerId:'s',peerType:'switch',localPort:'ether7'},{peerId:'ap',peerType:'ap',localPort:'ether8'},{peerId:'offline',localPort:'ether9'}];const result=mikrotikInfrastructureTopology(graph);expect(result.nodes[0].meta?.portConnections).toHaveLength(1);expect(mikrotikInfrastructureTopology(result)).toEqual(result);});
});
