import {test,expect} from '@playwright/test';
const campaign={id:'session-campaign',name:'TEST campaign',ssid:'TEST WIFI MARKETING',templateId:'t1',startTime:'2026-01-01T00:00:00Z',endTime:'2027-01-01T00:00:00Z',active:true,portalEnabled:true,template:{id:'t1',name:'Mẫu 4',status:'published'},_count:{logs:1}};
async function setup(page:any,role='ADMIN'){
 const writes:Array<{path:string;method:string;body:any}>=[];
 await page.addInitScript(()=>{localStorage.setItem('token',`audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`);});
 await page.route('**/api/**',(route:any)=>{
  const r=route.request(),path=new URL(r.url()).pathname;
  if(r.method()!=='GET'){writes.push({path,method:r.method(),body:r.postDataJSON()});return route.fulfill({json:{success:true,data:{sessionMinutes:30,queued:2}}});}
  return route.fulfill({json:{success:true,data:path==='/api/auth/me'?{id:'admin',username:'admin',role}:path==='/api/campaigns'?[campaign]:path.endsWith('/session-policy')?{sessionMinutes:240}:[]}});
 });
 await page.goto('/admin/campaigns');await page.getByRole('button',{name:'Thao tác chiến dịch TEST campaign',exact:true}).click();
 return writes;
}
test('campaign menu saves duration and scopes an explicitly selected reset to this campaign',async({page})=>{
 const writes=await setup(page);await page.getByRole('button',{name:'Thời hạn phiên WiFi',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Thời hạn phiên WiFi'});await expect(dialog).toBeVisible();
 await dialog.getByLabel('Thời hạn phiên (phút)',{exact:true}).fill('30');await dialog.getByRole('button',{name:'Lưu thời hạn',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(writes).toEqual([{path:'/api/campaigns/session-campaign/session-policy',method:'PUT',body:{sessionMinutes:30}}]);
 await page.getByRole('button',{name:'Thao tác chiến dịch TEST campaign',exact:true}).click();await page.getByRole('button',{name:'Thời hạn phiên WiFi',exact:true}).click();
 await dialog.getByRole('button',{name:'1 giờ',exact:true}).click();await dialog.getByLabel('Ngắt các phiên hiện tại để áp dụng ngay').check();await dialog.getByRole('button',{name:'Lưu thời hạn',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(writes.slice(1)).toEqual([{path:'/api/campaigns/session-campaign/session-policy',method:'PUT',body:{sessionMinutes:60}},{path:'/api/campaigns/session-campaign/session-policy',method:'POST',body:{}}]);
});
test('read-only users cannot change the campaign session duration',async({page})=>{await setup(page,'VIEWER');await expect(page.getByRole('button',{name:'Thời hạn phiên WiFi',exact:true})).toBeDisabled();});
