import {test,expect,type Page} from '@playwright/test';
const root='.tmp/topology-compact-20261030';
async function setup(page:Page,provider='unifi'){
 const state={mode:'fresh' as 'fresh'|'zero'|'missing'|'stale'};
 await page.addInitScript(()=>{localStorage.setItem('token',`test.${btoa(JSON.stringify({id:'qa',username:'qa',role:'VIEWER',exp:4102444800}))}.test`);Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:()=>Promise.reject(Error('fixture fallback'))});});
 await page.emulateMedia({reducedMotion:'no-preference'});
 const nodes:any[]=provider==='unifi'?[{id:'gateway',type:'gateway',name:'Gateway thực',ip:'192.168.0.1',status:'online'},...Array.from({length:60},(_,i)=>({id:`ap${i}`,type:'ap',name:`AP${i+1}`,status:'online',ip:`192.168.0.${i+10}`})),...Array.from({length:120},(_,i)=>({id:`c${i}`,type:'client',name:`Máy khách ${i}`,status:'observed',ip:`10.0.0.${i+1}`}))]:Array.from({length:5},(_,i)=>({id:`r${i}`,type:i?'switch':'gateway',name:`Thiết bị ${i}`,ip:`192.168.0.${i+1}`,status:'online',meta:{provider:'mikrotik',managed:true,deviceRole:i?'access-switch':'router'}}));
 const links:any[]=provider==='unifi'?[...Array.from({length:60},(_,i)=>({id:`u${i}`,source:'gateway',target:`ap${i}`,type:'uplink'})),...Array.from({length:120},(_,i)=>({id:`w${i}`,source:`ap${i%60}`,target:`c${i}`,type:'wireless'}))]:nodes.flatMap(a=>nodes.filter(b=>b.id!==a.id).map(b=>({id:`${a.id}-${b.id}`,source:a.id,target:b.id,type:'neighbor',sourcePort:'ether2',targetPort:'ether3'})));
 const sample=()=>state.mode==='missing'?undefined:({downloadBps:state.mode==='zero'?0:1200000,uploadBps:state.mode==='zero'?0:340000,downloadBytes:1200000,uploadBytes:340000,sampledAt:new Date(Date.now()-(state.mode==='stale'?60000:0)).toISOString(),source:'observed fixture',perspective:provider==='unifi'?'user':'interface'});
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;let data:any=[];
  if(path==='/api/auth/me')data={id:'qa',username:'qa',role:'VIEWER'};
  else if(path==='/api/network/connections')data=[{id:'fixture',name:'Fixture',provider:provider.toUpperCase(),isDefault:true,config:{site:'default'}}];
  else if(path==='/api/unifi/info')data=[{name:'default',desc:'Office'}];
  else if(path.endsWith('/topology/traffic'))data={nodes:Object.fromEntries(nodes.map(n=>[n.id,sample()])),links:Object.fromEntries(links.map(e=>[e.id,sample()])),sampledAt:new Date().toISOString()};
  else if(path.endsWith('/topology'))data={nodes:nodes.map(n=>({...n,traffic:sample()})),links:links.map(e=>({...e,layer:'physical',evidence:'/ip/neighbor',observedAt:new Date().toISOString(),traffic:sample()})),observedAt:new Date().toISOString(),warnings:[]};
  return route.fulfill({json:{success:true,data}});
 });
 return state;
}

async function checkEdges(page:Page,count:number){
 await expect(page.locator('.react-flow__edge')).toHaveCount(count);
 await expect.poll(()=>page.locator('.react-flow__edge').evaluateAll(edges=>edges.filter(edge=>{
   const paths=Array.from(edge.querySelectorAll('path.network-edge-line')) as SVGPathElement[];
   return !paths.length || paths.some(path=>{const d=path.getAttribute('d')||'';return !d||/NaN|Infinity|undefined/.test(d)||path.getTotalLength()<=0||getComputedStyle(path).display==='none'||Number(getComputedStyle(path).opacity)<=0});
 }).map(edge=>edge.getAttribute('data-id')))).toEqual([]);
}
for(const width of [1366,1920])test(`compact AP/client cards retain every visible cable through grid transitions at ${width}`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:width===1366?768:1080});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await page.goto('/admin/unifi/topology?connectionId=fixture&siteId=default');
 await expect(page.locator('.react-flow__node')).toHaveCount(61);await checkEdges(page,60);
 await page.getByRole('button',{name:'Về mức phóng 100%'}).click();
 await page.getByRole('button',{name:'Mở nhánh AP2',exact:true}).click();await expect(page.locator('.react-flow__node[data-id^="c"]')).toHaveCount(2);await checkEdges(page,62);
 const sizes=await page.locator('.react-flow__node').evaluateAll(els=>els.filter(el=>['ap1','c1'].includes(el.getAttribute('data-id')||'')).map(el=>({id:el.getAttribute('data-id'),width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight})));
 expect(sizes.find(n=>n.id==='ap1')).toMatchObject({width:260,height:148});expect(sizes.find(n=>n.id==='c1')).toMatchObject({width:176,height:132});
 for(const columns of ['4','8','6']){await page.getByLabel('Số AP mỗi hàng').selectOption(columns);await checkEdges(page,62);}
 await page.getByRole('button',{name:'Vừa khung',exact:true}).click();await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();await expect(page.locator('.network-workspace')).toHaveClass(/is-fullscreen/);await checkEdges(page,62);
 await page.getByRole('button',{name:'Thoát toàn màn hình',exact:true}).click();await page.getByRole('button',{name:'Về mức phóng 100%'}).click();await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();await page.screenshot({path:`${root}/compact-${width}-fullscreen.png`});
 await page.getByRole('button',{name:'Thoát toàn màn hình',exact:true}).click();await checkEdges(page,62);
 await page.getByRole('button',{name:'Về mức phóng 100%'}).click();await page.getByRole('button',{name:'Thu gọn AP2',exact:true}).click();await checkEdges(page,60);
 await page.getByRole('button',{name:'Hiện tất cả máy khách',exact:true}).click();await expect(page.locator('.react-flow__node[data-id^="c"]')).toHaveCount(120);await checkEdges(page,180);
 for(const columns of ['4','8','6']){await page.getByLabel('Số AP mỗi hàng').selectOption(columns);await checkEdges(page,180);}
 await page.getByRole('button',{name:'Vừa khung',exact:true}).click();await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();await checkEdges(page,180);await page.getByRole('button',{name:'Thoát toàn màn hình',exact:true}).click();
 await page.getByRole('button',{name:'Làm mới sơ đồ',exact:true}).click();await checkEdges(page,180);expect(errors).toEqual([]);
});

test('base cables persist across AP scope, missing/zero/stale measurements and restore after refresh',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();const state=await setup(page);await page.goto('/admin/unifi/topology?connectionId=fixture&siteId=default');await checkEdges(page,60);
 await page.getByLabel('Chọn AP',{exact:true}).selectOption('ap1');await checkEdges(page,2);
 await page.getByLabel('Chọn AP',{exact:true}).selectOption('all');await checkEdges(page,60);
 for(const mode of ['zero','missing','stale','fresh'] as const){state.mode=mode;await page.getByRole('button',{name:'Làm mới sơ đồ',exact:true}).click();await page.clock.fastForward(35000);await checkEdges(page,60);
 const base=page.locator('.react-flow__edge .react-flow__edge-path');await expect(base).toHaveCount(60);
 expect(await base.evaluateAll(paths=>paths.every(path=>getComputedStyle(path).stroke!=='transparent'&&Number(getComputedStyle(path).opacity)>0))).toBe(true);
 }
 await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();await checkEdges(page,60);expect(errors).toEqual([]);
});
