import {test,expect} from '@playwright/test';

test('system settings saves both providers, keeps credentials private and tests the saved connection',async({page})=>{
 const rows:any[]=[];const writes:any[]=[];const tested:string[]=[];
 await page.addInitScript(()=>localStorage.setItem('token',`test.${btoa(JSON.stringify({id:'admin',exp:4102444800}))}.test`));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if((path==='/api/settings'||path.startsWith('/api/network/connections'))&&!request.headers().authorization)return route.fulfill({status:401,json:{success:false,error:'Unauthorized'}});
  if(path==='/api/auth/me')return route.fulfill({json:{success:true,data:{id:'admin',username:'admin',role:'ADMIN'}}});
  if(path==='/api/settings')return route.fulfill({json:{success:true,data:{connections:rows,encryptionConfigured:true,monitoring:{configured:true}}}});
  if(path==='/api/network/connections'){
   if(request.method()==='POST'){
    const body=request.postDataJSON();writes.push(body);
    const row={...body,id:body.id||`connection-${rows.length}`,status:'unknown',hasCredentials:true,credentials:undefined};
    const index=rows.findIndex(r=>r.id===row.id);if(index<0)rows.push(row);else rows[index]=row;
    return route.fulfill({json:{success:true,data:row}});
   }
   return route.fulfill({json:{success:true,data:rows,encryptionConfigured:true}});
  }
  if(path.endsWith('/test')){tested.push(path);return route.fulfill({json:{success:true,data:{version:'7.20'}}});}
  return route.fulfill({json:{success:true,data:[]}});
 });
 await page.goto('/admin/settings');
 await expect(page.getByRole('heading',{name:'Cài đặt hệ thống',exact:true})).toBeVisible();
 for(const [provider,name,url] of [['UniFi','UniFi cơ quan','https://unifi.example.test:8443'],['MikroTik','Router cơ quan','https://router.example.test:443']]){
  await page.getByRole('button',{name:`Thiết lập ${provider}`,exact:true}).click();
  await page.getByLabel('Tên kết nối',{exact:true}).fill(name);
  await page.getByLabel('Địa chỉ thiết bị').fill(url);
  await page.getByLabel('Tên đăng nhập',{exact:true}).fill('network-admin');
  await page.getByLabel('Mật khẩu',{exact:true}).fill('test-device-secret');
  await page.getByRole('button',{name:'Lưu kết nối',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu kết nối');
 }
 expect(writes.map(w=>w.provider)).toEqual(['UNIFI','MIKROTIK']);
 expect(writes[0].config.site).toBe('default');
 await page.reload();
 await page.getByRole('button',{name:'Chỉnh sửa UniFi',exact:true}).click();
 await expect(page.getByLabel('Địa chỉ thiết bị')).toHaveValue('https://unifi.example.test:8443');
 await expect(page.getByLabel('Mật khẩu mới')).toHaveValue('');
 await page.getByLabel('Địa chỉ thiết bị').fill('https://new-unifi.example.test');
 await page.getByRole('button',{name:'Lưu kết nối',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Đã lưu kết nối');
 expect(writes[2].id).toBe('connection-0');
 expect(writes[2].credentials.password).toBeUndefined();
 await page.getByRole('row').filter({hasText:'Router cơ quan'}).getByRole('button',{name:'Kiểm tra',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('đã kết nối');
 expect(tested).toEqual(['/api/network/connections/connection-1/test']);
});
