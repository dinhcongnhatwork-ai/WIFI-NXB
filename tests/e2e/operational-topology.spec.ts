import {test,expect,type Page} from '@playwright/test';
const root='.tmp/network-operations-20261030';
async function setup(page:Page,provider='unifi'){
 await page.addInitScript(()=>{localStorage.setItem('token',`test.${btoa(JSON.stringify({id:'qa',username:'qa',role:'VIEWER',exp:4102444800}))}.test`);Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:()=>Promise.reject(Error('fixture fallback'))});});
 await page.emulateMedia({reducedMotion:'no-preference'});
 const nodes:any[]=provider==='unifi'?[{id:'gateway',type:'gateway',name:'Gateway thực',ip:'192.168.0.1',status:'online'},...Array.from({length:60},(_,i)=>({id:`ap${i}`,type:'ap',name:`AP${i+1}`,status:'online',ip:`192.168.0.${i+10}`})),...Array.from({length:120},(_,i)=>({id:`c${i}`,type:'client',name:`Máy khách ${i}`,status:'observed',ip:`10.0.0.${i+1}`}))]:Array.from({length:5},(_,i)=>({id:`r${i}`,type:i?'switch':'gateway',name:`Thiết bị ${i}`,ip:`192.168.0.${i+1}`,status:'online',meta:{provider:'mikrotik',managed:true,deviceRole:i?'access-switch':'router'}}));
 const links:any[]=provider==='unifi'?[...Array.from({length:60},(_,i)=>({id:`u${i}`,source:'gateway',target:`ap${i}`,type:'uplink'})),...Array.from({length:120},(_,i)=>({id:`w${i}`,source:`ap${i%60}`,target:`c${i}`,type:'wireless'}))]:nodes.flatMap(a=>nodes.filter(b=>b.id!==a.id).map(b=>({id:`${a.id}-${b.id}`,source:a.id,target:b.id,type:'neighbor',sourcePort:'ether2',targetPort:'ether3'})));
 const sample=()=>({downloadBps:1200000,uploadBps:340000,downloadBytes:1200000,uploadBytes:340000,sampledAt:new Date().toISOString(),source:'observed fixture',perspective:provider==='unifi'?'user':'interface'});
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;let data:any=[];
  if(path==='/api/auth/me')data={id:'qa',username:'qa',role:'VIEWER'};
  else if(path==='/api/network/connections')data=[{id:'fixture',name:'Fixture',provider:provider.toUpperCase(),isDefault:true,config:{site:'default'}}];
  else if(path==='/api/unifi/info')data=[{name:'default',desc:'Office'}];
  else if(path.endsWith('/topology/traffic'))data={nodes:Object.fromEntries(nodes.map(n=>[n.id,sample()])),links:Object.fromEntries(links.map(e=>[e.id,sample()])),sampledAt:new Date().toISOString()};
  else if(path.endsWith('/topology'))data={nodes:nodes.map(n=>({...n,traffic:sample()})),links:links.map(e=>({...e,layer:'physical',evidence:'/ip/neighbor',observedAt:new Date().toISOString(),traffic:sample()})),observedAt:new Date().toISOString(),warnings:[]};
  return route.fulfill({json:{success:true,data}});
 });
}
for(const width of [1366,1920])test(`60 AP / 120 clients use bounded rows, responsive fullscreen and hidden-client search at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===1366?768:1080});await setup(page);await page.goto('/admin/unifi/topology?connectionId=fixture&siteId=default');
 const aps=page.locator('.react-flow__node[data-id^="ap"]'),clients=page.locator('.react-flow__node[data-id^="c"]');
 await expect(aps).toHaveCount(60);await expect(clients).toHaveCount(0);
 const rows=()=>aps.evaluateAll(els=>new Set(els.map(el=>Math.round(el.getBoundingClientRect().y))).size);
 await expect.poll(rows).toBe(10);await expect(page.getByRole('button',{name:'Về mức phóng 100%'})).not.toHaveText('25%');
 await page.getByLabel('Số AP mỗi hàng').selectOption('4');await expect.poll(rows).toBe(15);
 await page.getByLabel('Số AP mỗi hàng').selectOption('6');await expect.poll(rows).toBe(10);
 const viewport=page.locator('.react-flow__viewport');await page.waitForTimeout(200);const before=await viewport.getAttribute('style');
 await page.getByRole('button',{name:'Làm mới sơ đồ',exact:true}).click();await expect(viewport).toHaveAttribute('style',before!);
 await page.screenshot({path:`${root}/unifi-60-${width}-normal.png`,fullPage:true});
 await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();await expect(page.locator('.network-workspace')).toHaveClass(/is-fullscreen/);
 await expect(page.locator('.react-flow__edge')).toHaveCount(60);await expect(page.locator('.network-monitor-banner')).toBeVisible();await expect(page.locator('.network-map-legend')).toBeHidden();
 const gateway=page.locator('.react-flow__node[data-id="gateway"]');await gateway.click();await expect(page.getByRole('complementary',{name:'Chi tiết quan sát'})).toContainText('Gateway thực');await page.getByRole('button',{name:'Bỏ lựa chọn',exact:true}).click();
 await page.screenshot({path:`${root}/unifi-60-${width}-fullscreen.png`});await page.getByRole('button',{name:'Thoát toàn màn hình',exact:true}).click();
 await page.getByLabel('Tìm thiết bị',{exact:true}).fill('Máy khách 119');await page.getByLabel('Tìm thiết bị',{exact:true}).press('Enter');await expect(page.locator('.react-flow__node[data-id="c119"]')).toBeVisible();await expect(clients).toHaveCount(2);await expect(page.getByRole('complementary',{name:'Chi tiết quan sát'})).toContainText('Máy khách 119');
 await page.getByRole('button',{name:'Bỏ lựa chọn',exact:true}).click();await expect(page.getByLabel('Tìm thiết bị',{exact:true})).toHaveValue('');await expect(page.getByRole('listbox',{name:'Kết quả tìm thiết bị'})).toHaveCount(0);await page.getByRole('button',{name:'Vừa khung',exact:true}).click();
 await expect.poll(()=>page.locator('.network-map-surface').evaluate(surface=>{const bounds=surface.getBoundingClientRect();return Array.from(surface.querySelectorAll('.react-flow__node')).every(node=>{const r=node.getBoundingClientRect();return r.left>=bounds.left-1&&r.top>=bounds.top-1&&r.right<=bounds.right+1&&r.bottom<=bounds.bottom+1})})).toBe(true);
});
test('MikroTik cyclic observations are readable, retain every device and expose extra links on demand',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await setup(page,'mikrotik');await page.goto('/admin/mikrotik/topology?scope=fleet');await expect(page.locator('.react-flow__node')).toHaveCount(5);await expect(page.locator('.react-flow__edge')).toHaveCount(4);
 const rows=await page.locator('.react-flow__node').evaluateAll(els=>new Set(els.map(el=>Math.round(el.getBoundingClientRect().y))).size);expect(rows).toBe(2);
 await page.getByRole('button',{name:'Hiện 16 liên kết bổ sung'}).click();await expect(page.locator('.react-flow__edge')).toHaveCount(20);await page.getByRole('button',{name:'Ẩn 16 liên kết bổ sung'}).click();await expect(page.locator('.react-flow__edge')).toHaveCount(4);
 await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();await expect(page.locator('.react-flow__edge')).toHaveCount(4);await page.screenshot({path:`root/mikrotik-forest-fullscreen.png`.replace('root',root)});
 await page.locator('.react-flow__node[data-id="r0"]').click();await expect(page.getByRole('complementary',{name:'Chi tiết quan sát'})).toContainText('Thiết bị 0');await expect(page.locator('.network-map-legend')).toBeHidden();
});
