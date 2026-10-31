import { test, expect, type Page } from '@playwright/test';
import { createPresetDocument } from '../../src/lib/template-presets';
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
async function setup(page: Page, useFlow = false, slowFirstSave = false, nested = false, configure?: (doc: ReturnType<typeof fixture>['document']) => void) {
  const data = fixture(); if (useFlow) { data.section.mode = 'flow'; data.section.padding = 24; data.section.gap = 16; }
  if (nested) {
    const parent = createNode('container'), child = createNode('title');
    parent.name = 'Container xoay'; parent.layout = {x:40,y:300,width:240,height:240,rotation:90};
    child.name = 'Chữ bên trong'; child.element = {id:child.id,type:'title',enabled:true,content:'Chữ con',fontSize:'18px',color:'#000000',align:'left'}; child.layout = {x:20,y:20,width:80,height:40,rotation:0};
    parent.children = [child]; data.section.nodes.push(parent);
  }
  configure?.(data.document);
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
  await frame.locator('[data-screen="portal"]').waitFor();
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


test('media failure shows a retry action without an empty-state upload prompt and recovers', async ({page}) => {
  await setup(page);
  let failed = true;
  await page.route('**/api/upload?**', route => {
    return route.fulfill(failed ? {status:401,json:{error:'Vui lòng đăng nhập để tiếp tục.'}} : {json:{success:true,total:0,data:[],folders:[]}});
  });
  await page.getByRole('button',{name:/Thư viện media/i}).click();
  await expect(page.locator('.cms-media-library').getByRole('alert')).toContainText('đăng nhập');
  await expect(page.getByText('Chưa có tài nguyên nào trong thư mục này.')).toHaveCount(0);
  failed = false;
  await page.getByRole('button',{name:'Thử lại tải thư viện',exact:true}).click();
  await expect(page.getByText('Chưa có tài nguyên nào trong thư mục này.')).toBeVisible();
});

test('editing shared content synchronizes tablet and PC and one undo restores all three', async ({page}) => {
  const {frame,title,saved} = await setup(page,false,false,false,doc => {
    for (const device of ['tablet','desktop'] as const) {
      const node = clone(doc.variants.mobile.sections[0].nodes[0]);
      node.id = device + '-title'; node.element.id = node.id;
      node.layout.x = 80; (node.element as any).fontSize = '32px';
      doc.variants[device].sections[0].nodes = [node];
    }
  });
  await frame.locator(`[data-node-id="${title.id}"]`).click();
  const content = page.locator('aside textarea').first();
  await content.fill('Thông báo đồng bộ');
  await expect.poll(()=>(saved().variants.tablet.sections[0].nodes[0].element as any).content).toBe('Thông báo đồng bộ');
  expect((saved().variants.desktop.sections[0].nodes[0].element as any).content).toBe('Thông báo đồng bộ');
  expect(saved().variants.tablet.sections[0].nodes[0].layout.x).toBe(80);
  expect((saved().variants.tablet.sections[0].nodes[0].element as any).fontSize).toBe('32px');
  await page.getByRole('button',{name:/Hoàn tác/}).click();
  await expect.poll(()=>(saved().variants.tablet.sections[0].nodes[0].element as any).content).toBe('Chào mừng hội nghị');
});

test('comparison displays the selected design screen for all three devices', async ({page}) => {
  await setup(page);
  await page.getByRole('navigation',{name:'Màn hình thiết kế'}).getByRole('button',{name:'Thông báo'}).click();
  await page.getByRole('button',{name:'So sánh',exact:true}).click();
  for (const device of ['Mobile','Tablet','PC']) {
    const frame = page.frameLocator(`iframe[title^="So sánh ${device}"]`);
    await expect(frame.locator('[data-screen="announcement"]')).toBeVisible();
  }
});

test('image connect button supports keyboard and confirmation in isolated simulation', async ({page}) => {
  const {writes} = await setup(page,false,false,false,doc => {
    const button = doc.variants.mobile.sections[0].nodes.find(n=>n.element.type==='connect_button')!;
    Object.assign(button.element,{imageSrc:'/api/media/images/test.png',requireConfirm:true,termsText:'Điều khoản truy cập WiFi'});
    button.layout.height = 160;
  });
  await page.getByRole('button',{name:'Xem trước',exact:true}).click();
  await page.getByRole('dialog',{name:'Chọn màn hình xem trước'}).getByRole('button',{name:'Trang kết nối',exact:true}).click();
  const frame = page.frameLocator('iframe[title="Canvas thiết kế"]');
  const button = frame.getByRole('button',{name:'Kết nối WiFi ngay',exact:true});
  await expect(button).toBeDisabled();
  await frame.getByRole('checkbox',{name:/Tôi đồng ý/}).check();
  await button.focus(); await button.press('Enter');
  await expect(frame.getByRole('status')).toContainText(/mô phỏng/i);
  expect(writes.filter(w=>!w.path.startsWith('/api/templates/'))).toHaveLength(0);
});


test('failed autosave retains the document and retries without losing changes', async ({page}) => {
  const {frame,title,writes} = await setup(page);
  let fail = true;
  await page.route('**/api/templates/audit', async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    if (fail) return route.fulfill({status:503,json:{error:'Máy chủ đang gián đoạn.'}});
    return route.fallback();
  });
  await drag(page,frame.locator(`[data-node-id="${title.id}"]`),39,21);
  await expect(page.getByRole('button',{name:'Thử lưu lại',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Tải bản nháp dự phòng',exact:true})).toBeVisible();
  fail = false;
  await page.getByRole('button',{name:'Thử lưu lại',exact:true}).click();
  await expect.poll(()=>writes.filter(w=>w.body?.layoutJson).length).toBe(1);
  expect(writes[0].body.layoutJson.variants.mobile.sections[0].nodes[0].layout.x).toBe(92);
  await expect(page.getByRole('button',{name:'Thử lưu lại',exact:true})).toHaveCount(0);
});

test('numeric positioning rejects empty input and Escape and commits once on Enter', async ({page}) => {
  const {frame,title} = await setup(page);
  const el = frame.locator(`[data-node-id="${title.id}"]`);
  await el.click();
  const x = page.getByRole('spinbutton',{name:'Vị trí X',exact:true});
  await x.fill(''); await x.blur();
  await expect(x).toHaveValue('40');
  await x.fill('99'); await x.press('Escape'); await x.blur();
  await expect(x).toHaveValue('40');
  await x.fill('120'); await x.press('Enter');
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBe(120);
  await page.getByRole('button',{name:/Hoàn tác/}).click();
  await expect.poll(async()=>el.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBe(40);
});


test('institutional preset keeps editor tools within common desktop viewports', async ({page}) => {
  await page.setViewportSize({width:1440,height:1100});
  const errors: string[] = []; page.on('pageerror',e=>errors.push(e.message));
  const {frame} = await setup(page,false,false,false,doc=>Object.assign(doc,createPresetDocument('trien-lam')));
  await page.getByRole('button',{name:'Tablet',exact:true}).click();
  await frame.locator('[data-device-variant="tablet"]').waitFor();
  await page.screenshot({path:'.tmp/cms-review-tablet.png',fullPage:true});
  await page.getByRole('button',{name:/Thư viện media/i}).click();
  await page.getByRole('button',{name:'Chọn ảnh ten-anh-rat-dai-can-chi-hien-thi-thumbnail.png',exact:true}).waitFor();
  await page.screenshot({path:'.tmp/cms-review-library.png',fullPage:true});
  for (const width of [1366,1920]) {
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole('button',{name:'Xuất bản',exact:true})).toBeInViewport();
    await expect(page.getByRole('button',{name:'Đồng bộ ngay',exact:true})).toBeInViewport();
    const toolbar = await page.locator('.cms-topbar').boundingBox();
    expect(toolbar!.width).toBe(width);
    const boxes = await page.locator('.cms-topbar > div').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i],b=boxes[j];
      expect(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('button effects stay bounded and respect reduced motion in the device frame', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const {frame} = await setup(page,false,false,false,doc => {
    const button = doc.variants.mobile.sections[0].nodes.find(n=>n.element.type==='connect_button')!;
    Object.assign(button.element,{buttonEffect:'shimmer',buttonStyle:'gradient',gradient:{from:'#450a0a',to:'#b45309',css:'linear-gradient(160deg, #450a0a 0%, #991b1b 55%, #b45309 100%)'}});
  });
  await page.getByRole('button',{name:'Xem trước',exact:true}).click();
  await page.getByRole('dialog',{name:'Chọn màn hình xem trước'}).getByRole('button',{name:'Trang kết nối',exact:true}).click();
  const button = frame.getByRole('button',{name:'Kết nối WiFi ngay',exact:true});
  await expect(button).toHaveCSS('transform','none');
  await expect(frame.locator('.portal-connect-shimmer')).toHaveCSS('animation-name','none');
  await expect(frame.locator('.portal-connect-shimmer')).toHaveCSS('pointer-events','none');
  await expect(button).toHaveCSS('background-image',/160deg/);
});

test('duplicating a nested layer retains its container', async ({page}) => {
  const {frame,section,saved} = await setup(page,false,false,true);
  const parent = section.nodes.at(-1)!, child = parent.children![0];
  await frame.locator(`[data-node-id="${child.id}"]`).click();
  await page.locator('[aria-label="Thao tác phần tử"]').getByRole('button',{name:'Nhân bản',exact:true}).click();
  await expect.poll(()=>saved().variants.mobile.sections[0].nodes.find(n=>n.id===parent.id)?.children?.length).toBe(2);
  expect(saved().variants.mobile.sections[0].nodes.length).toBe(section.nodes.length);
  await page.getByRole('button',{name:/^Lớp/}).click();
  const row = page.locator(`[data-layer-node-id="${child.id}"]`);
  await expect(row.getByRole('button',{name:'Lên trên',exact:true})).toBeDisabled();
  await row.getByRole('button',{name:'Xuống dưới',exact:true}).click();
  await expect.poll(()=>saved().variants.mobile.sections[0].nodes.find(n=>n.id===parent.id)?.children?.[1].id).toBe(child.id);
});

test('publish errors navigate to the exact blank PC component',async({page})=>{
  let blankId='';
  const {frame}=await setup(page,false,false,false,doc=>{
    Object.assign(doc,createPresetDocument('trien-lam'));
    const blank=createNode('image');blankId=blank.id;doc.variants.desktop.sections[0].nodes.push(blank);
  });
  await page.getByRole('button',{name:'Xuất bản',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Kiểm tra & Xuất bản mẫu'});
  await expect(dialog).toContainText('Có 1 lỗi');
  await dialog.getByRole('button',{name:'Đến thành phần'}).first().click();
  await expect(dialog).toBeHidden();
  await expect(frame.locator('.portal-page')).toHaveAttribute('data-device-variant','desktop');
  await expect(frame.locator(`[data-node-id="${blankId}"]`)).toHaveAttribute('aria-selected','true');
});

test('redesign preview replaces all three variants, downloads backup and supports undo',async({page})=>{
  const {saved}=await setup(page,false,false,false,doc=>Object.assign(doc,createPresetDocument('trien-lam')));
  await page.getByRole('combobox',{name:'Chọn thiết kế mới'}).selectOption('xuat-ban-so');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Thay thiết kế cả 3 thiết bị');
  const downloadPromise=page.waitForEvent('download');
  await dialog.getByRole('button',{name:'Áp dụng Mẫu 2',exact:true}).click();
  expect((await downloadPromise).suggestedFilename()).toContain('cms-draft-audit.json');
  await expect.poll(()=>JSON.stringify(saved())).toContain('Đọc trên mọi thiết bị');
  await page.getByTitle('Hoàn tác (Ctrl+Z)').click();
  await expect.poll(()=>JSON.stringify(saved())).toContain('Dấu ấn trên từng trang sách');
});
