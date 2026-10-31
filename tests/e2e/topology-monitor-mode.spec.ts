import {test, expect, type Page} from '@playwright/test';
async function setup(page: Page, provider: string, fallback = false) {
  const state = { fresh: true };
  await page.addInitScript(({fallback}) => {
    localStorage.setItem('token', `test.${btoa(JSON.stringify({id:'monitor-test',username:'monitor-test',role:'VIEWER',exp:4102444800}))}.test`);
    if(fallback) Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:()=>Promise.reject(Error('unsupported'))});
    const stats = {arcs:0,strokes:[] as {color:string,dx:number,dy:number}[]};
    (window as any).trafficDrawing = stats;
    const proto = CanvasRenderingContext2D.prototype;
    const arc=proto.arc, stroke=proto.stroke, move=proto.moveTo,line=proto.lineTo;
    proto.arc=function(...args:Parameters<typeof arc>){if(this.canvas.getAttribute('role')==='img') stats.arcs++;return arc.apply(this,args);};
    proto.moveTo=function(x,y){(this as any).startX=x;(this as any).startY=y;return move.call(this,x,y);};
    proto.lineTo=function(x,y){(this as any).endX=x;(this as any).endY=y;return line.call(this,x,y);};
    proto.stroke=function(...args:any[]){if(this.canvas.getAttribute('role')==='img' && stats.strokes.length<300)stats.strokes.push({color:String(this.strokeStyle),dx:(this as any).endX-(this as any).startX,dy:(this as any).endY-(this as any).startY});return (stroke as any).apply(this,args);};
  }, {fallback});
  const sample = () => ({downloadBps: state.fresh?123000:0,uploadBps:state.fresh?32000:0,downloadBytes:10000,uploadBytes:4000,perspective:provider==='mikrotik'?'interface':'user',sampledAt:new Date().toISOString(),source:'test interface'});
  await page.route('**/api/**', route=>{
    const path = new URL(route.request().url()).pathname;
    let data: any=[];
    if(path==='/api/auth/me') data={id:'monitor-test',username:'monitor-test',role:'VIEWER'};
    else if(path==='/api/network/connections') data=[{id:'fixture',provider:provider.toUpperCase(),name:'Fixture',isDefault:true,config:{site:'default'}}];
    else if(path==='/api/unifi/info') data=[{name:'default',desc:'Office'}];
    else if(path.endsWith('/topology/traffic')) data={nodes:{root:sample(),child:sample()},links:{cable:sample()},sampledAt:new Date().toISOString(),source:'test',warnings:[]};
    else if(path.endsWith('/topology')) data={nodes:[
      {id:'root',name:'Root',type:'gateway',status:'online',meta:{provider,managed:true,connectionId:'fixture'},traffic:sample()},
      {id:'child',name:'Child',type:provider==='mikrotik'?'switch':'ap',status:'online',meta:{provider,managed:true,connectionId:'second'},traffic:sample()},
    ],links:[{id:'cable',source:'root',target:'child',type:'neighbor',layer:'physical',evidence:'/ip/neighbor',sourcePort:'ether7',targetPort:'sfp1',traffic:sample()}],warnings:[],observedAt:new Date().toISOString()};
    return route.fulfill({json:{success:true,data}});
  });
  return state;
}
for(const provider of ['unifi','mikrotik']) for(const fallback of [false,true]) {
  test(`${provider} ${fallback?'fallback':'native'} fullscreen shows only banner and topology`,async({page})=>{
    await page.setViewportSize({width:1366,height:768});
    await setup(page,provider,fallback);
    await page.goto(`/admin/${provider}/topology?connectionId=fixture&siteId=default`);
    await expect(page.locator('.react-flow__node[data-id="root"],.react-flow__node[data-id="child"]')).toHaveCount(2);
    const banner=page.getByRole('img',{name:'Hệ thống giám sát WiFi — Nhà xuất bản Chính trị quốc gia Sự thật'});
    await expect(banner).toBeVisible();
    await expect(page.locator(".network-canvas-panel .network-monitor-banner img")).toBeVisible();
    await expect.poll(()=>banner.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(2172);
    const opener=page.getByRole('button',{name:'Toàn màn hình',exact:true});
    await opener.click();
    await expect(page.locator('.network-workspace')).toHaveClass(/is-fullscreen/);
    for(const selector of ['.network-workspace-header','.network-summary-strip','.network-toolbar','.network-filter-bar','.network-workspace-footer']) await expect(page.locator(selector)).toBeHidden();
    await expect(banner).toBeVisible();
    await expect(page.getByRole('button',{name:'Thoát toàn màn hình',exact:true})).toBeVisible();
    await expect.poll(async()=>Math.round((await page.locator('.network-workspace').boundingBox())!.width)).toBe(1366);
    const box=(await page.locator('.network-canvas-panel').boundingBox())!;
    expect(box.height).toBeGreaterThan(600);expect(box.y+box.height).toBeLessThanOrEqual(769);
    await page.screenshot({path:`.tmp/topology-monitor-20261029/${provider}-${fallback?'fallback':'native'}-fullscreen.png`});
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect(page.locator('.network-summary-strip')).toBeVisible();
  });
}
for(const provider of ['unifi','mikrotik']) test(`${provider} traffic draws blue and green lines without particle circles and respects pause/reduced motion`,async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await setup(page,provider);
  await page.goto(`/admin/${provider}/topology?connectionId=fixture&siteId=default`);
  const canvas=page.getByRole('img',{name:/^Lưu lượng trực tiếp:/});
  await expect(canvas).toHaveAttribute('aria-label',/vệt line/);
  await expect.poll(()=>page.evaluate(()=> (window as any).trafficDrawing.strokes.length)).toBeGreaterThan(2);
  const drawing=await page.evaluate(()=> (window as any).trafficDrawing);
  expect(drawing.arcs).toBe(0);
  expect(drawing.strokes.some((s:any)=>s.color==='#2563eb')).toBe(true);
  expect(drawing.strokes.some((s:any)=>s.color==='#10b981')).toBe(true);
  if(provider==='mikrotik') {
    expect(drawing.strokes.some((s:any)=>s.color==='#2563eb' && (s.dx<0 || s.dy<0))).toBe(true);
    expect(drawing.strokes.some((s:any)=>s.color==='#10b981' && (s.dx>0 || s.dy>0))).toBe(true);
  }
  await page.getByRole('button',{name:'Tạm dừng chuyển động'}).click();
  await expect(canvas).toHaveAttribute('aria-label','Lưu lượng trực tiếp: không có line đang chạy');
  await page.getByRole('button',{name:'Bật chuyển động lưu lượng'}).click();
  await expect(canvas).toHaveAttribute('aria-label',/vệt line/);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(canvas).toHaveAttribute('aria-label','Lưu lượng trực tiếp: không có line đang chạy');
});

for(const provider of ['unifi','mikrotik']) for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]) {
 test(`${provider} sign hugs its image and gateway stays centered below it at ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);await setup(page,provider);
  if(provider==='unifi') await page.route('**/api/unifi/topology?**',route=>route.fulfill({json:{success:true,data:{
    nodes:[{id:'root',type:'gateway',name:'Gateway',status:'online',ip:'192.168.0.1',meta:{inferredFromGatewayMac:true}},
    {id:'ap',type:'ap',name:'AP',status:'online'},
    ...Array.from({length:111},(_,i)=>({id:`stress-client-${i}`,type:'client',name:`Client ${i}`,status:'online'}))],
    links:[{id:'up',source:'root',target:'ap',type:'uplink',layer:'physical',evidence:'observed'},...Array.from({length:111},(_,i)=>({id:`client-link-${i}`,source:'ap',target:`stress-client-${i}`,type:'wireless',layer:'physical',evidence:'client.ap_mac'}))],warnings:[],observedAt:new Date().toISOString()
  }}}));
  await page.goto(`/admin/${provider}/topology?connectionId=fixture&siteId=default`);
  const banner=page.locator('.network-monitor-banner'),img=banner.locator('img'),root=page.locator('.react-flow__node[data-id="root"]');
  await expect(root).toBeVisible();
  const check=async()=>{
   const b=(await banner.boundingBox())!,i=(await img.boundingBox())!,g=(await root.boundingBox())!,c=(await page.locator('.network-canvas-panel').boundingBox())!;
   return {extraWidth:Math.abs(b.width-i.width),center:Math.abs(b.x+b.width/2-(c.x+c.width/2)),gap:g.y-(b.y+b.height),gatewayCenter:Math.abs(g.x+g.width/2-(b.x+b.width/2))};
  };
  await expect.poll(async()=>(await check()).extraWidth).toBeLessThan(1);
  await expect.poll(async()=>(await check()).center).toBeLessThan(1);
  await expect.poll(async()=>(await check()).gap).toBeGreaterThan(15);
  await expect.poll(async()=>(await check()).gatewayCenter).toBeLessThan(2);
  await page.getByRole('button',{name:'Về mức phóng 100%'}).click();
  await expect.poll(async()=>(await check()).gap).toBeGreaterThan(15);
  await page.getByRole('button',{name:'Vừa khung',exact:true}).click();
  await expect.poll(async()=>(await check()).gatewayCenter).toBeLessThan(2);
  await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();
  await expect.poll(async()=>(await check()).center).toBeLessThan(1);
  await expect.poll(async()=>(await check()).gap).toBeGreaterThan(15);
  await expect.poll(async()=>(await check()).gatewayCenter).toBeLessThan(2);
  await page.screenshot({path:`.tmp/banner-anchor-20261029/${provider}-${viewport.width}-fullscreen.png`});
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await check()).gatewayCenter).toBeLessThan(2);
 });
}

for(const provider of ['unifi','mikrotik']) for(const fallback of [false,true]) {
 test(`${provider} ${fallback?'fallback':'native'} fullscreen hides bottom controls and opens device/link info`,async({page})=>{
  await page.setViewportSize({width:fallback?1920:1366,height:fallback?1080:768});
  await setup(page,provider,fallback);
  await page.goto(`/admin/${provider}/topology?connectionId=fixture&siteId=default`);
  const root=page.locator('.react-flow__node[data-id="root"]');await expect(root).toBeVisible();
  const details=page.getByRole('complementary',{name:'Chi tiết quan sát'});
  await root.click();await expect(details).toBeVisible();
  await page.getByRole('button',{name:'Toàn màn hình',exact:true}).click();
  await expect(details).toBeVisible();await expect(details.getByRole('heading',{name:'Root',exact:true})).toBeVisible();
  for(const selector of ['.react-flow__controls','.react-flow__minimap','.network-map-legend']) await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('.network-fullscreen-tools button')).toHaveCount(1);
  await expect(page.locator('.network-fullscreen-tools')).toBeVisible();
  const tools=(await page.locator('.network-fullscreen-tools').boundingBox())!;expect(tools.y).toBeLessThan(40);expect(tools.height).toBeLessThan(40);
  await page.getByRole('button',{name:'Bỏ lựa chọn',exact:true}).click();await expect(details).toHaveCount(0);
  await page.locator('.react-flow__node[data-id="child"]').click();
  await expect(details.getByRole('heading',{name:'Child',exact:true})).toBeVisible();
  await details.getByRole('tab',{name:'Lưu lượng',exact:true}).click();
  await expect(details.getByRole('tab',{name:'Lưu lượng',exact:true})).toHaveAttribute('aria-selected','true');
  const panel=(await details.boundingBox())!;expect(panel.y).toBeGreaterThan(100);expect(panel.y+panel.height).toBeLessThanOrEqual(fallback?1080:768);
  await page.screenshot({path:`.tmp/fullscreen-details-20261029/${provider}-${fallback?'fallback':'native'}-device.png`});
  await page.getByRole('button',{name:'Bỏ lựa chọn',exact:true}).click();
  const point=await page.locator('.react-flow__edge[data-id="cable"] .react-flow__edge-interaction').evaluate((path:SVGPathElement)=>{
    const middle=path.getPointAtLength(path.getTotalLength()/2),matrix=path.getScreenCTM()!;
    return {x:matrix.a*middle.x+matrix.c*middle.y+matrix.e,y:matrix.b*middle.x+matrix.d*middle.y+matrix.f};
  });
  await page.mouse.click(point.x,point.y);
  await expect(details.getByRole('heading',{name:'Chi tiết liên kết',exact:true})).toBeVisible();
  await expect(details).toContainText('ether7');await expect(details).toContainText('sfp1');
  await page.getByRole('button',{name:'Thoát toàn màn hình',exact:true}).click();
  await expect(page.locator('.react-flow__controls')).toBeVisible();await expect(page.locator('.react-flow__minimap')).toBeVisible();
  await expect(page.locator('.network-map-legend')).toBeVisible();await expect(details).toBeVisible();
 });
}
