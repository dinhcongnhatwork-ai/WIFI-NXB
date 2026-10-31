import {it,expect} from 'vitest';
import {rootViewport,fitRootViewport} from '@/components/network/topology/root-viewport';
const nodes:any[]=[{id:'gateway',position:{x:4200,y:100},measured:{width:300},data:{device:{type:'gateway'}}},{id:'client',position:{x:0,y:5000},data:{device:{type:'client'}}}];
it('anchors the gateway below the sign instead of vertically centering an oversized tree',()=>{const v=rootViewport(nodes,{x:-500,y:-400,zoom:.25},1366);expect(100*v.zoom+v.y).toBe(20);expect((4200+150)*v.zoom+v.x).toBe(683);});
it('retains zoom and keeps the gateway in view at 100% and after fullscreen resizing',()=>{for(const width of [1366,1920])for(const zoom of [.25,1,2]){const v=rootViewport(nodes,{x:0,y:-200,zoom},width);expect(v.zoom).toBe(zoom);expect(nodes[0].position.y*zoom+v.y).toBe(20);expect((nodes[0].position.x+150)*zoom+v.x).toBe(width/2);}});
it('ignores display groups and is a no-op for an empty graph',()=>{const v={x:20,y:30,zoom:1};expect(rootViewport([],v,1000)).toBe(v);const n=[{id:'group',position:{x:0,y:0},data:{device:{meta:{layoutOnly:true}}}},...nodes];expect(rootViewport(n as any,v,1000)).toEqual(rootViewport(nodes,v,1000));});

it('fits tall multirow inventories under the sign without a minimum zoom cropping the last AP',()=>{
 const nodes=[{id:'gw',position:{x:870,y:32},data:{device:{type:'gateway'}}},...Array.from({length:60},(_,i)=>({id:`ap${i}`,position:{x:i%6*348,y:306+Math.floor(i/6)*274},data:{device:{type:'ap'}}}))];
 const view=fitRootViewport(nodes,{x:0,y:0,zoom:1},1000,400);
 expect(view.zoom).toBeLessThan(0.22);
 for(const node of nodes){expect(node.position.x*view.zoom+view.x).toBeGreaterThanOrEqual(0);expect((node.position.x+300)*view.zoom+view.x).toBeLessThanOrEqual(1000);expect((node.position.y+174)*view.zoom+view.y).toBeLessThanOrEqual(400);}
 expect((870+130)*view.zoom+view.x).toBe(500);expect(32*view.zoom+view.y).toBe(20);
});
it('fits asymmetric branches and keeps the gateway centered',()=>{
 const nodes=[{id:'r',position:{x:32,y:32},data:{device:{type:'gateway'}}},{id:'ap',position:{x:442,y:32},data:{device:{type:'ap'}}}];
 const view=fitRootViewport(nodes,{x:0,y:0,zoom:1},1000,500);
 expect((32+130)*view.zoom+view.x).toBe(500);expect((442+260)*view.zoom+view.x).toBeLessThan(1000);
});
