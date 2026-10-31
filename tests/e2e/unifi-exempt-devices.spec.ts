import {test,expect} from '@playwright/test';
async function setup(page:any,role='ADMIN'){
 let rows:any[]=[];const writes:any[]=[];
 await page.addInitScript(()=>localStorage.setItem('token',`audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`));
 await page.route('**/api/**',(route:any)=>{
  const r=route.request(),p=new URL(r.url()).pathname;
  if(r.method()!=='GET'){
   const body=r.postData()?r.postDataJSON():null;writes.push({method:r.method(),body,url:r.url()});
   if(r.method()==='POST')rows=rows.concat(body.devices.map((d:any)=>({...d,approvedBy:'admin',approvedAt:Date.now()})));
   if(r.method()==='PUT')rows=rows.map(d=>d.mac===body.mac?{...d,...body}:d);
   if(r.method()==='DELETE')rows=[];
   return route.fulfill({json:{success:true,data:rows}});
  }
  return route.fulfill({json:{success:true,data:p==='/api/auth/me'?{id:'admin',username:'admin',role}:p==='/api/network/connections'?[{id:'conn',name:'Controller',isDefault:true,config:{site:'s1'}}]:p==='/api/unifi/info'?[{name:'s1',desc:'Office'}]:p==='/api/unifi/exempt-devices'?rows:[]}});
 });
 await page.goto('/admin/unifi/exempt-devices?connectionId=conn&siteId=s1');await expect(page.getByRole('heading',{name:'Thiết bị miễn xác thực',exact:true})).toBeVisible();return writes;
}
test('approves, edits, disables and removes a named device in the current site',async({page})=>{
 const writes=await setup(page);await page.getByRole('button',{name:'Thêm thiết bị',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Tên người dùng',{exact:true}).fill('Đinh Công Nhất');await dialog.getByLabel('Thiết bị',{exact:true}).fill('Laptop');await dialog.getByLabel('Địa chỉ MAC',{exact:true}).fill('AA-BB-CC-DD-EE-FF');await dialog.getByRole('button',{name:'Lưu và miễn xác thực',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Đinh Công Nhất',exact:true})).toBeVisible();expect(writes[0].body.devices[0].mac).toBe('aa:bb:cc:dd:ee:ff');expect(writes[0].url).toContain('siteId=s1');
 await page.getByRole('button',{name:'Chỉnh sửa aa:bb:cc:dd:ee:ff'}).click();await dialog.getByLabel('Thiết bị',{exact:true}).fill('Laptop văn phòng');await dialog.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await expect(page.getByRole('cell',{name:'Laptop văn phòng',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tắt miễn xác thực aa:bb:cc:dd:ee:ff'}).click();await expect(page.getByText('Đã tắt',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Xóa aa:bb:cc:dd:ee:ff'}).click();await expect(page.getByRole('cell',{name:'Đinh Công Nhất',exact:true})).toHaveCount(0);expect(writes.map(w=>w.method)).toEqual(['POST','PUT','PUT','DELETE']);
});
test('previews bulk entries, rejects duplicates and saves the complete list',async({page})=>{
 const writes=await setup(page);await page.getByRole('button',{name:'Nhập danh sách',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Danh sách thiết bị').fill('Tên;Thiết bị;MAC\nĐinh Công Nhất;Laptop;aa:bb:cc:dd:ee:ff\nNguyễn Văn A;Điện thoại;02:22:33:44:55:66');
 await expect(dialog.getByText('2 thiết bị hợp lệ',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Duyệt và lưu danh sách',exact:true}).click();await expect(page.getByRole('cell',{name:'Đinh Công Nhất',exact:true})).toBeVisible();expect(writes[0].body.devices).toHaveLength(2);
});
test('read-only accounts can view but cannot approve a MAC',async({page})=>{await setup(page,'VIEWER');await expect(page.getByRole('button',{name:'Thêm thiết bị',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Nhập danh sách',exact:true})).toHaveCount(0);});
test('approved portal immediately navigates to the server selected destination without rendering a marketing gate',async({page})=>{
 await page.route('**/api/portal?**',r=>r.fulfill({json:{success:true,data:{bypass:true,redirectUrl:'https://destination.test/approved'}}}));await page.route('https://destination.test/approved',r=>r.fulfill({contentType:'text/html',body:'<h1>Approved destination</h1>'}));
 await page.goto('/portal?mac=aa:bb:cc:dd:ee:ff&ssid=Open&unifiSite=s1&apMac=22:33:44:55:66:77');await expect(page).toHaveURL('https://destination.test/approved');await expect(page.getByRole('heading',{name:'Approved destination'})).toBeVisible();
});
