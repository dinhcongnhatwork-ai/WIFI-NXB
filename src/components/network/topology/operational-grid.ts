import { Position } from '@xyflow/react';
import type { Device, Link } from './model';
export type Point = {x:number; y:number};
import { networkNodeSize } from './node-dimensions';
const priority = (node:Device) => node.meta?.layoutOnly ? -2 : node.meta?.inferredFromGatewayMac ? -1 : node.meta?.deviceRole === 'core-switch' ? 1 : node.type === 'gateway' || node.type === 'router' ? 0 : node.type === 'switch' ? 2 : node.type === 'ap' ? 3 : 4;
const compare = (a:Device,b:Device) => priority(a)-priority(b) || a.name.localeCompare(b.name,'vi',{numeric:true}) || a.id.localeCompare(b.id);
/** A display forest of actual observations. Extra/reverse/parallel observations remain available separately. */
export function observationForest(devices:Device[], links:Link[]) {
  const byId = new Map(devices.map(n=>[n.id,n]));
  const adjacency = new Map<string,Link[]>();
  const incoming = new Set(links.map(e=>e.target));
  for(const edge of links) {
    if(edge.source===edge.target || !byId.has(edge.source) || !byId.has(edge.target)) continue;
    for(const id of [edge.source,edge.target]) adjacency.set(id,[...(adjacency.get(id)||[]),edge]);
  }
  const roots:string[]=[];
  const children = new Map<string,string[]>();
  const primary = new Set<string>();
  const parent = new Map<string,string>();
  const visited=new Set<string>();
  const ordered=[...devices].sort((a,b)=>Number(incoming.has(a.id))-Number(incoming.has(b.id)) || compare(a,b));
  for(const root of ordered) {
    if(visited.has(root.id)) continue;
    roots.push(root.id);visited.add(root.id);
    const queue=[root.id];
    for(let i=0;i<queue.length;i++) {
      const source=queue[i];
      const neighbors=[...(adjacency.get(source)||[])].sort((a,b)=> {
        const an=byId.get(a.source===source?a.target:a.source)!;
        const bn=byId.get(b.source===source?b.target:b.source)!;
        return compare(an,bn) || Number(a.layer!=='physical')-Number(b.layer!=='physical') || Number(a.source!==source)-Number(b.source!==source) || a.id.localeCompare(b.id);
      });
      for(const edge of neighbors) {
        const target=edge.source===source?edge.target:edge.source;
        if(visited.has(target)) continue;
        visited.add(target);primary.add(edge.id);parent.set(target,source);
        children.set(source,[...(children.get(source)||[]),target]);queue.push(target);
      }
    }
  }
  return {roots,children,primary,parent};
}
/** Bounded rows of sibling branches; each block reserves room for its expanded descendants. */
export function operationalGrid(devices:Device[], links:Link[], columns=6) {
  const byId=new Map(devices.map(n=>[n.id,n]));
  const forest=observationForest(devices,links);
  const positions=new Map<string,Point>();
  const routes=new Map<string,Point[]>();
  type Block={width:number;height:number;points:Map<string,Point>};
  const build=(id:string):Block=> {
    const childIds=forest.children.get(id)||[];
    const size=networkNodeSize(byId.get(id));
    if(!childIds.length) return {width:size.width,height:size.height,points:new Map([[id,{x:0,y:0}]])};
    const blocks=childIds.map(build);
    const cols=Math.min(byId.get(id)?.type==='ap'?2:Math.max(2,columns),blocks.length);
    const rows=Array.from({length:Math.ceil(blocks.length/cols)},(_,i)=>blocks.slice(i*cols,(i+1)*cols));
    const rowWidth=(row:Block[])=>row.reduce((sum,b)=>sum+b.width,0)+(row.length-1)*32;
    const width=Math.max(...rows.map(rowWidth));
    const points=new Map<string,Point>([[id,{x:(width-size.width)/2,y:0}]]);
    let y=size.height+72;
    for(const row of rows) {
      let x=(width-rowWidth(row))/2;
      row.forEach((block)=> {
        for(const [key,p] of Array.from(block.points)) points.set(key,{x:p.x+x,y:p.y+y});
        x+=block.width+32;
      });
      y+=Math.max(...row.map(b=>b.height))+72;
    }
    return {width,height:y-72,points};
  };
  let offset=40;
  for(const root of forest.roots) {
    const block=build(root);
    for(const [id,p] of Array.from(block.points)) positions.set(id,{x:p.x+offset,y:p.y+32});
    offset+=block.width+160;
  }
  const bounds = new Map<string,{left:number;right:number}>();
  const subtreeBounds=(id:string):{left:number;right:number}=>{
    const cached=bounds.get(id);if(cached)return cached;
    const position=positions.get(id)!,size=networkNodeSize(byId.get(id));
    const children=(forest.children.get(id)||[]).map(subtreeBounds);
    const box={left:Math.min(position.x,...children.map(b=>b.left)),right:Math.max(position.x+size.width,...children.map(b=>b.right))};
    bounds.set(id,box);return box;
  };
  forest.roots.forEach(subtreeBounds);
  for(const edge of links) {
    const source=positions.get(edge.source),target=positions.get(edge.target);
    if(!source||!target) continue;
    const sourceSize=networkNodeSize(byId.get(edge.source)),targetSize=networkNodeSize(byId.get(edge.target));
    const sx=source.x+sourceSize.width/2,sy=source.y+sourceSize.height;
    const tx=target.x+targetSize.width/2,ty=target.y;
    const parentId=forest.parent.get(edge.target);
    const siblings=parentId ? forest.children.get(parentId)||[] : [];
    const firstRowY=siblings.length ? Math.min(...siblings.map(id=>positions.get(id)!.y)) : ty;
    if(!forest.primary.has(edge.id) || ty>firstRowY+1 || ty<sy) {
      const row=siblings.filter(id=>positions.get(id)!.y===ty).sort((a,b)=>positions.get(a)!.x-positions.get(b)!.x);
      const index=row.indexOf(edge.target);
      const useLeft=index>=0 ? index<Math.ceil(row.length/2) : tx<sx;
      const owner=bounds.get(parentId||edge.source)||{left:Math.min(source.x,target.x),right:Math.max(source.x+sourceSize.width,target.x+targetSize.width)};
      const bus=useLeft?owner.left-20:owner.right+20;
      routes.set(edge.id,[{x:sx,y:sy+24},{x:bus,y:sy+24},{x:bus,y:ty-24},{x:tx,y:ty-24}]);
    } else routes.set(edge.id,[{x:sx,y:sy+28},{x:tx,y:sy+28}]);
  }
  return {positions,routes,forest,sourcePosition:Position.Bottom,targetPosition:Position.Top};
}
