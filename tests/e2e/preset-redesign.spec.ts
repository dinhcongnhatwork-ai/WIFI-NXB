import { test, expect, type Page } from '@playwright/test';
import { createPresetDocument, TEMPLATE_PRESETS } from '../../src/lib/template-presets';
import { DEVICE_KEYS, GATE_SCREENS, DEVICES, flowNode } from '../../src/lib/template-document';

async function mock(page: Page) {
  await page.addInitScript(()=>{localStorage.setItem('token',`audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`);localStorage.setItem('username','audit');});
  let document=createPresetDocument('van-hoa-doc');
  await page.route('**/api/**', route => {
    const request=route.request(), path=new URL(request.url()).pathname;
    expect(request.method()).toBe('GET');
    return route.fulfill({json:{success:true,data:path==='/api/auth/me'?{id:'audit',username:'audit',role:'ADMIN'}:path==='/api/templates/audit'?{id:'audit',name:'Mẫu kiểm tra',layoutJson:document,draftVersion:1,status:'draft',campaigns:[]}:[]}});
  });
  return { setDocument:(id:string)=>{document=createPresetDocument(id);return document;} };
}
for(const preset of TEMPLATE_PRESETS) test(`${preset.name} covers 12 device/screen combinations`,async({page})=>{
  test.setTimeout(180000);
  const {setDocument}=await mock(page);const document=setDocument(preset.id);
  for(const device of DEVICE_KEYS)for(const screen of GATE_SCREENS)flowNode(document.variants[device],screen)!.element.enabled=true;
  for(const device of DEVICE_KEYS)for(const screen of ['portal',...GATE_SCREENS]){
    await page.goto(`/admin/templates/audit/preview?screen=${screen}&device=${device}`);
    const frame=page.frameLocator(`iframe[title="Xem trước ${DEVICES[device].label}"]`);
    const root=frame.locator('.portal-page');
    await expect(root).toHaveAttribute('data-screen',screen);
    if(screen==='portal'){
      await expect(frame.getByRole('button',{name:/Kết nối WiFi/})).toBeVisible();
      await expect(frame.getByRole('heading').first()).toBeVisible();
      const images=await root.locator('img').evaluateAll(images=>Promise.all(images.map(async node=>{const img=node as HTMLImageElement;await img.decode();return img.naturalWidth>0;})));
      expect(images.every(Boolean)).toBe(true);
      await frame.locator('.portal-image-slider').getByRole('button',{name:'Ảnh tiếp theo'}).click();
      await expect(frame.locator('.portal-image-slider')).toContainText('2 / 3');
      await expect(frame.locator('.portal-image-slider img').nth(1)).toHaveCSS('opacity','1');
      await frame.getByRole('button',{name:/Kết nối WiFi/}).click();
      await expect(frame.getByRole('status')).toContainText('Đã kết nối thành công');
    }else{
      const core=frame.locator(`[data-flow-content="${screen}"]`);
      await expect(core).toBeVisible();
      expect(await core.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
      if(screen==='attendance_gate'){
        await frame.getByRole('textbox',{name:'Họ và tên',exact:true}).fill('Nguyễn An');
        await frame.getByRole('textbox',{name:'Phòng ban / Đơn vị',exact:true}).fill('Phòng Nghiên cứu');
        await core.locator('button[type="submit"]').click();
        await expect(frame.getByRole('status')).toContainText('Màn hình đã hoàn tất');
      }
      if(screen==='announcement'){
        await core.getByRole('button',{name:'Tiếp tục kết nối WiFi',exact:true}).click();
        await expect(frame.getByRole('status')).toContainText('Màn hình đã hoàn tất');
      }
    }
    expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    if(screen==='portal'){
      await frame.locator('.portal-page > div:last-child').evaluate(el=>(el as HTMLElement).style.display='none');
      await root.screenshot({path:`.tmp/redesign-${preset.id}-${device}.png`});
    }
  }
  await page.goto('/admin/templates/audit/preview?screen=portal&device=mobile');
  await page.getByRole('combobox',{name:'Kích thước',exact:true}).selectOption('2');
  const small=page.frameLocator('iframe[title="Xem trước Mobile"]').locator('.portal-page');
  await expect(small).toHaveAttribute('data-device-variant','mobile');
  expect(await small.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
