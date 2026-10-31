import {describe,it,expect} from 'vitest';
import {buildNetworkLayout} from '@/components/network/topology/network-layout';
import type {Topology} from '@/lib/network/topology';
const at='2026-10-30T00:00:00Z';
const graph=(n=60):Topology=>({observedAt:at,warnings:[],nodes:[{id:'gateway',type:'gateway',name:'Gateway',status:'online'},...Array.from({length:n},(_,i)=>({id:`ap${i}`,type:'ap',name:`AP${i+1}`,status:'online'}))],links:Array.from({length:n},(_,i)=>({id:`uplink${i}`,source:'gateway',target:`ap${i}`,type:'uplink',layer:'physical',evidence:'observed',observedAt:at}))});
describe('operational multi-row overview',()=>{
  it.each([36,60])('keeps %i APs in six columns with no overlaps and all original uplinks',count=>{
    const g=graph(count),layout=buildNetworkLayout(g,{expanded:new Set()});
    const aps=layout.nodes.filter(n=>n.data.device.type==='ap');
    expect(aps).toHaveLength(count);
    expect(new Set(aps.map(n=>n.position.y)).size).toBe(Math.ceil(count/6));
    expect(new Set(aps.map(n=>n.position.x)).size).toBe(6);
    expect(Math.max(...aps.map(n=>n.position.x))-Math.min(...aps.map(n=>n.position.x))).toBeLessThan(1800);
    expect(layout.edges.map(e=>e.id)).toEqual(g.links.map(e=>e.id));
    for(const a of layout.nodes) for(const b of layout.nodes) if(a.id!==b.id) expect(a.position.x+Number(a.style?.width)<=b.position.x || b.position.x+Number(b.style?.width)<=a.position.x || a.position.y+Number(a.style?.height)<=b.position.y || b.position.y+Number(b.style?.height)<=a.position.y).toBe(true);
    const secondRow=aps.find(n=>n.position.y>aps[0].position.y)!;
    const edge=layout.edges.find(e=>e.target===secondRow.id)!;
    expect(edge.data?.routePoints?.some(p=>p.x<Math.min(...aps.map(n=>n.position.x)))).toBe(true);
  });
  it('routes later AP rows down both outer sides without changing observations',()=>{
    const g=graph(36),r=buildNetworkLayout(g,{expanded:new Set()});
    const aps=r.nodes.filter(n=>n.data.device.type==='ap');
    const firstY=Math.min(...aps.map(n=>n.position.y));
    const left=Math.min(...aps.map(n=>n.position.x));
    const right=Math.max(...aps.map(n=>n.position.x+Number(n.style?.width)));
    for(const y of Array.from(new Set(aps.map(n=>n.position.y))).filter(y=>y>firstY)){
      const edges=r.edges.filter(e=>aps.some(n=>n.id===e.target&&n.position.y===y));
      expect(edges.some(e=>e.data?.routePoints?.some(p=>p.x<left))).toBe(true);
      expect(edges.some(e=>e.data?.routePoints?.some(p=>p.x>right))).toBe(true);
    }
    expect(r.edges.map(e=>e.id)).toEqual(g.links.map(e=>e.id));
  });
  it('uses smaller infrastructure cards and compact nearly square client cards in overview and AP scope',()=>{
    const g=graph(6);g.nodes.push({id:'phone',type:'client',name:'Phone'});g.links.push({id:'wifi',source:'ap0',target:'phone',type:'wireless',layer:'physical',evidence:'observed',observedAt:at});
    for(const focusApId of [undefined,'ap0']){
      const r=buildNetworkLayout(g,{expanded:new Set(['ap0']),focusApId});
      const ap=r.nodes.find(n=>n.id==='ap0')!,client=r.nodes.find(n=>n.id==='phone')!;
      expect(Number(ap.style?.width)).toBeLessThanOrEqual(260);expect(Number(ap.style?.height)).toBeLessThanOrEqual(148);
      expect(Number(client.style?.width)).toBeLessThanOrEqual(180);expect(Number(client.style?.height)).toBeLessThanOrEqual(140);
      expect(Number(client.style?.width)/Number(client.style?.height)).toBeLessThan(1.4);
    }
  });
  it('retains 120 hidden clients and reveals every child without pushing APs into one row',()=>{
    const g=graph();for(let i=0;i<120;i++){g.nodes.push({id:`c${i}`,type:'client',name:`Client ${i}`});g.links.push({id:`w${i}`,source:`ap${i%60}`,target:`c${i}`,type:'wireless',layer:'physical',evidence:'association',observedAt:at});}
    const closed=buildNetworkLayout(g,{expanded:new Set()});expect(closed.nodes).toHaveLength(61);expect(closed.nodes.find(n=>n.id==='ap0')?.data.clientCount).toBe(2);
    const open=buildNetworkLayout(g,{expanded:new Set(['ap0'])});expect(open.nodes).toHaveLength(63);expect(open.nodes.filter(n=>n.data.device.type==='ap')).toHaveLength(60);
    const focused=buildNetworkLayout(g,{expanded:new Set(),focusApId:'ap0'});expect(focused.nodes.map(n=>n.id).sort()).toEqual(['ap0','c0','c60']);
  });
  it('lays out cyclic MikroTik peers as a display forest without losing extra observations',()=>{
    const g:Topology={observedAt:at,warnings:[],nodes:Array.from({length:5},(_,i)=>({id:`r${i}`,name:`Router ${i}`,type:'gateway',status:'online',meta:{managed:true,provider:'mikrotik'}})),links:[]};
    for(const a of g.nodes)for(const b of g.nodes)if(a.id!==b.id)g.links.push({id:`${a.id}-${b.id}`,source:a.id,target:b.id,type:'neighbor',layer:'physical',evidence:'/ip/neighbor',observedAt:at});
    const layout=buildNetworkLayout(g,{expanded:new Set()});expect(layout.nodes).toHaveLength(5);expect(layout.edges).toHaveLength(20);expect(layout.edges.filter(e=>!e.data?.secondary)).toHaveLength(4);
    expect(new Set(layout.nodes.map(n=>n.position.x)).size).toBeGreaterThan(1);
    expect(new Set(layout.nodes.map(n=>n.position.y)).size).toBe(2);
  });
  it('allows four or eight APs per display row without altering observed relationships',()=>{const g=graph();for(const columns of [4,8]){const r=buildNetworkLayout(g,{expanded:new Set(),columns});const aps=r.nodes.filter(n=>n.data.device.type==='ap');expect(new Set(aps.map(n=>n.position.y)).size).toBe(Math.ceil(60/columns));expect(r.edges).toHaveLength(60);}});
});
