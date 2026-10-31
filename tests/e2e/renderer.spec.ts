import { test, expect, type Page } from '@playwright/test';
import { createDocument } from '../../src/lib/template-document';
async function preview(page:Page,screen:string) {
  const document=createDocument(); const mobile=document.variants.mobile;
  mobile.flow.attendanceGate!.element.enabled=true;
  mobile.flow.videoGate!.element.enabled=true;
  if(mobile.flow.videoGate!.element.type==='video_gate')mobile.flow.videoGate!.element.skipAfter=2;
  const mutations:string[]=[];
  await page.addInitScript(()=>{localStorage.setItem('token',`audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`);localStorage.setItem('username','audit');});
  await page.route('**/api/**',async route=>{
    const request=route.request();const path=new URL(request.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({json:{success:true,data:{id:'audit',username:'audit',role:'ADMIN'}}});
    if(request.method()!=='GET')mutations.push(path);
    return route.fulfill({json:{success:true,data:path==='/api/templates/audit'?{id:'audit',name:'Mẫu xem trước',layoutJson:document}:[]}});
  });
  await page.goto(`/admin/templates/audit/preview?screen=${screen}`);
  const frame=page.frameLocator('iframe[title="Xem trước Mobile"]');
  await frame.locator(`[data-screen="${screen}"]`).waitFor();
  return {frame,mutations};
}
test('single attendance preview replays with reset fields and no API mutations',async({page})=>{
  const {frame,mutations}=await preview(page,'attendance_gate');
  const name=frame.getByRole('textbox',{name:'Họ và tên',exact:true});
  const department=frame.getByRole('textbox',{name:'Phòng ban / Đơn vị',exact:true});
  await name.fill('Nguyễn An');await department.fill('Biên tập');
  await frame.locator('[data-flow-content="attendance_gate"] button[type="submit"]').click();
  await expect(frame.getByRole('status')).toContainText('Màn hình đã hoàn tất');
  await frame.getByRole('button',{name:'Bắt đầu lại',exact:true}).click();
  await expect(name).toHaveValue('');await expect(department).toHaveValue('');
  await name.fill('Lê Bình');await department.fill('Vận hành');
  await frame.locator('[data-flow-content="attendance_gate"] button[type="submit"]').click();
  await expect(frame.getByRole('status')).toContainText('Màn hình đã hoàn tất');
  expect(mutations).toEqual([]);
});
test('single video preview restarts its countdown and stays isolated from completion APIs',async({page})=>{
  const {frame,mutations}=await preview(page,'video_gate');
  await expect(frame.getByRole('button',{name:'Đợi 2s để tiếp tục',exact:true})).toBeDisabled();
  const next=frame.getByRole('button',{name:'Tiếp tục kết nối WiFi',exact:true});
  await expect(next).toBeEnabled({timeout:6000});await next.click();
  await expect(frame.getByRole('status')).toContainText('Màn hình đã hoàn tất');
  await frame.getByRole('button',{name:'Bắt đầu lại',exact:true}).click();
  await expect(frame.getByRole('button',{name:'Đợi 2s để tiếp tục',exact:true})).toBeDisabled();
  await expect(next).toBeEnabled({timeout:6000});await next.click();
  expect(mutations).toEqual([]);
});
