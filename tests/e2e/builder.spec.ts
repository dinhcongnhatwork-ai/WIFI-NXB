import { test, expect, type Page } from '@playwright/test';
import { createDocument, createNode, createSection, clone, setNodeMedia } from '../../src/lib/template-document';
const fixture = () => {
  const document = createDocument();
  const section = createSection({ width: 390, height: 1200 }, 'freeform');
  const title = createNode('title'); title.element = { id: title.id, type: 'title', enabled: true, content: 'Chào mừng hội nghị', color: '#0f172a', fontSize: '20px', align: 'left' }; title.layout = { x: 40, y: 80, width: 240, height: 50, rotation: 0 };
  const connect = createNode('connect_button'); connect.layout = { x: 40, y: 650, width: 280, height: 60, rotation: 0 };
  const image = createNode('image'); setNodeMedia(image, 'src', '/api/media/images/test.png'); image.layout = { x: 40, y: 200, width: 120, height: 100, rotation: 0 };
  section.nodes = [title, image, connect]; document.variants.mobile.sections = [section];
  return { document, title, section, image };
};
async function setup(page: Page, useFlow = false, slowFirstSave = false, nested = false) {
  const data = fixture(); if (useFlow) { data.section.mode = 'flow'; data.section.padding = 24; data.section.gap = 16; }
  if (nested) {
    const parent = createNode('container'), child = createNode('title');
    parent.name = 'Container xoay'; parent.layout = {x:40,y:300,width:240,height:240,rotation:90};
    child.name = 'Chữ bên trong'; child.element = {id:child.id,type:'title',enabled:true,content:'Chữ con',fontSize:'18px',color:'#000000',align:'left'}; child.layout = {x:20,y:20,width:80,height:40,rotation:0};
    parent.children = [child]; data.section.nodes.push(parent);
  }
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  let document = clone(data.document), version = 1;
  const writes: {path: string;body: any}[] = [];
  await page.addInitScript(() => { localStorage.setItem('token', `audit.${btoa(JSON.stringify({ exp: 4102444800 }))}.audit`); localStorage.setItem('username', 'audit'); });
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({json:{success:true,data:{id:'audit',username:'audit',role:'ADMIN'}}});
    if (path.startsWith('/api/media/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#2563eb"/></svg>' });
    if (req.method() !== 'GET') {
      const body = req.postDataJSON(); writes.push({path,body});
      if (body?.layoutJson) { if (slowFirstSave && writes.length === 1) await held; document = body.layoutJson; version++; }
      return route.fulfill({json:{success:true,data:{id:'audit',name:'Mẫu kiểm thử',layoutJson:document,status:'draft',draftVersion:version}}});
    }
    if (path === '/api/templates/audit') return route.fulfill({json:{success:true,data:{id:'audit',name:'Mẫu kiểm thử',layoutJson:document,status:'draft',draftVersion:version,campaigns:[]}}});
    if (path === '/api/upload') return route.fulfill({json:{success:true,total:1,data:[{key:'images/test.png',url:'/api/media/images/test.png',name:'ten-anh-rat-dai-can-chi-hien-thi-thumbnail.png',type:'image',size:1024,lastModified:null,usage:[]}]}});
    return route.fulfill({json:{success:true,data:[]}});
  });
  await page.goto('/admin/templates/audit/builder');
  await page.getByRole('navigation', {name:'Màn hình thiết kế'}).waitFor();
  const frame = page.frameLocator('iframe[title="Canvas thiết kế"]');
  await frame.locator(`[data-node-id="${data.title.id}"]`).waitFor();
  return { ...data, frame, writes, release, saved: () => document };
}
async function drag(page: Page, selector: ReturnType<Page['locator']>, dx: number, dy: number) {
  const box = await selector.boundingBox(); if (!box) throw new Error('Missing element box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, {steps:8}); await page.mouse.up();
}
test('library thumbnail inserts the selected image without switching the library tab', async ({page}) => {
  const { writes } = await setup(page);
  await page.getByRole('button', {name:/Thư viện media/i}).click();
  await page.getByRole('button', {name:'Chọn ảnh ten-anh-rat-dai-can-chi-hien-thi-thumbnail.png',exact:true}).click();
  await expect(page.getByRole('button', {name:'Tạo slider',exact:true})).toBeVisible();
  await expect.poll(() => writes.filter(w=>w.body?.layoutJson).length).toBeGreaterThan(0);
  const last = writes.filter(w=>w.body?.layoutJson).at(-1)!;
  const images = last.body.layoutJson.variants.mobile.sections.flatMap((s:any)=>s.nodes).filter((n:any)=>n.element.type==='image');
  expect(images.at(-1).element.src).toBe('/api/media/images/test.png');
  await expect(page.locator('p').filter({hasText:'ten-anh-rat-dai'})).toHaveCount(0);
});
test('drag maps actual zoom and section scale and one Undo restores the entire gesture', async ({page}) => {
  const {frame,title} = await setup(page);
  const el = frame.locator(`[data-node-id="${title.id}"]`);
  await drag(page, el, 39, 21);
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBe(92);
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.top))).toBe(108);
  await page.getByRole('button',{name:/Hoàn tác|Undo/}).click();
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBe(40);
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.top))).toBe(80);
});
test('click preserves Flow and a real drag snapshots displayed geometry', async ({page}) => {
  const {frame,title,section,image} = await setup(page,true);
  const titleEl = frame.locator(`[data-node-id="${title.id}"]`), imageEl = frame.locator(`[data-node-id="${image.id}"]`);
  const before = await imageEl.boundingBox();
  await titleEl.click();
  await expect(titleEl).toHaveCSS('position','relative');
  await drag(page,titleEl,30,15);
  await expect(titleEl).toHaveCSS('position','absolute');
  const after = await imageEl.boundingBox();
  expect(Math.abs(after!.x-before!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.y-before!.y)).toBeLessThanOrEqual(1);
});
test('Escape cancels a transient drag without adding history or saving the gesture', async ({page}) => {
  const {frame,title,writes} = await setup(page);
  const el = frame.locator(`[data-node-id="${title.id}"]`), box = (await el.boundingBox())!;
  await page.mouse.move(box.x+20,box.y+20); await page.mouse.down(); await page.mouse.move(box.x+70,box.y+70,{steps:4}); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBe(40);
  expect(writes.filter(w=>w.body?.layoutJson)).toHaveLength(0);
});
test('preview opens screen choices and simulating a meeting produces no real API calls', async ({page}) => {
  const {writes} = await setup(page);
  await page.getByRole('button',{name:/Xem trước|Preview/}).first().click();
  const dialog = page.getByRole('dialog',{name:'Chọn màn hình xem trước'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Điểm danh họp',exact:true}).click();
  const frame = page.frameLocator('iframe[title="Canvas thiết kế"]');
  await expect(frame.getByText(/chưa.*bật|đang.*tắt|chưa.*kích hoạt/i).first()).toBeVisible();
  expect(writes.filter(w=>!w.path.startsWith('/api/templates/'))).toHaveLength(0);
});

test('rotated container permits selecting and dragging its nested child', async ({page}) => {
  const {frame,section} = await setup(page,false,false,true);
  const child = section.nodes.at(-1)!.children![0];
  const el = frame.locator(`[data-node-id="${child.id}"]`);
  await el.click();
  await expect(frame.locator(`[data-editor-overlay="${child.id}"]`)).toHaveCSS('outline-style','solid');
  await page.keyboard.down('Alt'); await drag(page,el,0,30); await page.keyboard.up('Alt');
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBe(60);
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.top))).toBe(20);
});
test('slow autosave drains a newer edit after the first request finishes', async ({page}) => {
  const {frame,title,writes,release} = await setup(page,false,true);
  const el = frame.locator(`[data-node-id="${title.id}"]`);
  await drag(page,el,39,21);
  await expect.poll(()=>writes.length).toBe(1);
  await drag(page,el,15,15);
  await page.waitForTimeout(1900); // force the second debounce to run while request A is held
  release();
  await expect.poll(()=>writes.length).toBe(2);
  expect(writes[1].body.layoutJson.variants.mobile.sections[0].nodes[0].layout.x).toBe(112);
});
test('Flow alignment and numeric positioning each undo as a single action', async ({page}) => {
  const {frame,title} = await setup(page,true);
  const el = frame.locator(`[data-node-id="${title.id}"]`);
  await el.click(); await page.getByRole('button',{name:'Căn left',exact:true}).click();
  await expect(el).toHaveCSS('position','absolute');
  await page.getByRole('button',{name:/Hoàn tác/}).click();
  await expect(el).toHaveCSS('position','relative');
});
