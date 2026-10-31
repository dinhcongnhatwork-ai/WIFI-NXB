import {it,expect} from 'vitest';
import {adoptUserNodes,getEdgePosition} from '@xyflow/system';
import {buildNetworkLayout} from '@/components/network/topology/network-layout';
const graph={observedAt:'2026-10-30T00:00:00Z',warnings:[],nodes:[{id:'gw',type:'gateway',name:'Gateway'},{id:'ap',type:'ap',name:'AP'}],links:[{id:'up',source:'gw',target:'ap',type:'uplink',layer:'physical' as const,evidence:'observed',observedAt:'2026-10-30T00:00:00Z'}]};
it('retains cable endpoints when a measurement update replaces controlled nodes without resizing their DOM',()=>{
 const layout=buildNetworkLayout(graph,{expanded:new Set()});const lookup=new Map(),parents=new Map();adoptUserNodes(layout.nodes,lookup,parents);
 // Simulate the initial DOM measurement. A clock/traffic update does not resize these cards.
 for(const n of Array.from(lookup.values()) as any[]){n.measured={width:260,height:148};n.internals.handleBounds={source:[{x:256,y:70,width:8,height:8,position:'right',type:'source',nodeId:n.id}],target:[{x:-4,y:70,width:8,height:8,position:'left',type:'target',nodeId:n.id}]};}
 const refreshed=layout.nodes.map(n=>({...n,data:{...n.data,clock:Date.now(),traffic:undefined}}));
 adoptUserNodes(refreshed,lookup,parents);
 expect(getEdgePosition({id:'up',sourceNode:lookup.get('gw'),targetNode:lookup.get('ap'),sourceHandle:null,targetHandle:null,connectionMode:'strict' as any})).not.toBeNull();
});
