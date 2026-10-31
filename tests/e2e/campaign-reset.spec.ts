import {test,expect} from '@playwright/test';
const campaign={id:'reset-campaign',name:'TEST campaign',ssid:'TEST WIFI MARKETING',templateId:'t1',startTime:'2026-01-01T00:00:00Z',endTime:'2027-01-01T00:00:00Z',active:true,portalEnabled:true,template:{id:'t1',name:'Mẫu 4',status:'published'},_count:{logs:1}};
async function setup(page:any,notQueued=0){
 const writes:any[]=[];await page.addInitScript(()=>localStorage.setItem('token',`audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`));
 await page.route('**/api/**',(route:any)=>{const r=route.request(),path=new URL(r.url()).pathname;if(r.method()!=='GET'){writes.push(path);return route.fulfill({status:notQueued?202:200,json:{success:true,data:{queued:2,revoked:2,waiting:0,skipped:0,failed:notQueued,notQueued}}});}return route.fulfill({json:{success:true,data:path==='/api/auth/me'?{id:'admin',username:'admin',role:'ADMIN'}:path==='/api/campaigns'?[campaign]:[]}});});
 await page.goto('/admin/campaigns');await page.getByRole('button',{name:'Thao tác chiến dịch TEST campaign',exact:true}).click();await page.getByRole('button',{name:'Reset WiFi',exact:true}).click();await page.getByRole('dialog',{name:'Reset WiFi'}).getByRole('button',{name:'Reset ngay',exact:true}).click();return writes;
}
test('reset uses the forced endpoint and reports verified disconnects',async({page})=>{const writes=await setup(page);await expect(page.getByText(/Đã ngắt 2 thiết bị/)).toBeVisible();expect(writes).toEqual(['/api/campaigns/reset-campaign/reset-wifi']);});
test('a partial reset tells the operator to retry unqueued devices',async({page})=>{await setup(page,1);await expect(page.getByText(/1 thiết bị chưa được xử lý, cần bấm Reset lại/)).toBeVisible();});
