import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_FORM_FIELDS} from '../../src/lib/attendance/constants';
function fixture(){
 const make=(id:string,name:string,status:string,startTime:string)=>({id,name,status,startTime,endTime:status==='ACTIVE'?'2099-10-29T03:00:00Z':startTime,createdAt:startTime,updatedAt:startTime,endedAt:status==='ENDED'?startTime:null,location:'Hội trường tầng 11',templateId:'template',templateName:'Mẫu hội nghị',effectiveTemplateId:'template',templateReadiness:{published:true,attendanceReady:true},campaignId:null,ssid:'Meeting',unifiSite:'default',wlanConfId:'ssid',targetApMacs:['aa:bb:cc:dd:ee:01'],targetAps:[{mac:'aa:bb:cc:dd:ee:01',name:'AP hội trường',status:'online'}],formSchema:DEFAULT_FORM_FIELDS,nameFieldKey:'fullname',idFieldKey:'fullname',dialogTitle:'Điểm danh',confirmButtonText:'Xác nhận',successMessage:'Đã điểm danh',warningThresholdMinutes:5,stats:{totalRegistered:1,presentCount:1,temporaryAbsentCount:0,alertAbsentCount:0,unknownCount:0,totalWarnings:0,unregisteredCount:0,syncHealth:'healthy',lastSyncTime:new Date().toISOString(),syncMessage:'Đã nhận dữ liệu từ UniFi Controller.'},registrations:[{id:'reg',sessionId:id,displayName:'Nguyễn Văn An',identityValue:'NV001',primaryMac:'aa:bb:cc:dd:ee:ff',currentApMac:'aa:bb:cc:dd:ee:01',status:'PRESENT',currentRssi:-54,formAnswers:{fullname:'Nguyễn Văn An',department:'Ban Biên tập'},totalPresentSeconds:1800,totalAbsentSeconds:0,totalUnknownSeconds:0,warningCount:0,firstSeenAt:startTime,lastSeenAt:new Date().toISOString(),createdAt:startTime,intervals:[{id:'interval',status:'PRESENT',joinedAt:startTime,leftAt:null}]}],logs:[{id:'log',message:'Đại biểu đã hoàn tất điểm danh.',createdAt:startTime,type:'REGISTER'}],unregisteredClients:[]});
 return [make('oct','Hội nghị giao ban tháng 10','ENDED','2026-10-20T01:00:00Z'),make('sep','Họp chuyên đề tháng 9','ENDED','2026-09-15T01:00:00Z'),make('live','Hội nghị đang diễn ra','ACTIVE','2026-10-28T01:00:00Z')];
}
async function setup(page:Page,role='ADMIN'){
 const sessions=fixture(),writes:any[]=[],reads:string[]=[],errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('token',`audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`);localStorage.setItem('username','audit');});
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;reads.push(url.pathname+url.search);
  if(path==='/api/auth/me')return route.fulfill({json:{success:true,data:{id:'audit',username:'audit',role}}});
  if(req.method()!=='GET'){
   const body=req.postData()?req.postDataJSON():{};writes.push({path,method:req.method(),body,headers:req.headers()});
   if(req.method()==='DELETE'){const index=sessions.findIndex(s=>path.endsWith(s.id));sessions.splice(index,1);return route.fulfill({json:{success:true}});}
   if(req.method()==='POST' && path==='/api/attendance/sessions'){const s={...fixture()[0],...body,id:'created-meeting',registrations:[]};sessions.push(s);return route.fulfill({json:{success:true,data:s}});}
   const session=sessions.find(s=>path.includes('/'+s.id));
   if(path.endsWith('/registrations') && session){Object.assign(session.registrations[0],{displayName:body.displayName,primaryMac:body.newMac});return route.fulfill({json:{success:true,data:session.registrations[0]}});}
   if(session)Object.assign(session,body);
   return route.fulfill({json:{success:true,data:session || {}}});
  }
  if(path==='/api/attendance/templates')return route.fulfill({json:{success:true,data:[{id:'template',name:'Mẫu hội nghị',publishedRevisionId:'rev',attendanceReady:true}]}});
  if(path==='/api/campaigns')return route.fulfill({json:{success:true,data:[]}});
  if(path==='/api/unifi/devices')return route.fulfill({json:{success:true,data:[{mac:'aa:bb:cc:dd:ee:01',name:'AP hội trường',model:'U6'}]}});
  if(path==='/api/unifi/ssids')return route.fulfill({json:{success:true,data:[{_id:'ssid',name:'Meeting'}]}});
  if(path.endsWith('/export'))return route.fulfill({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:Buffer.from('xlsx')});
  if(path.endsWith('/stream')){
   const session=sessions.find(s=>path.includes('/'+s.id))!;
   const data={...session,sessionId:session.id,registrations:session.registrations.map(r=>({...r,status:'TEMPORARY_ABSENT',absentStartedAt:new Date().toISOString()})),stats:{...session.stats,presentCount:0,temporaryAbsentCount:1}};
   return route.fulfill({contentType:'text/event-stream',body:`event: attendance_update\ndata: ${JSON.stringify(data)}\n\n`});
  }
  if(path==='/api/attendance/sessions'){
   let data=sessions.filter(s=>(!url.searchParams.get('status') || s.status===url.searchParams.get('status')) && (!url.searchParams.get('month') || s.startTime.startsWith(url.searchParams.get('month')!)) && (!url.searchParams.get('search') || s.name.toLowerCase().includes(url.searchParams.get('search')!.toLowerCase())));
   data=data.sort((a,b)=>b.startTime.localeCompare(a.startTime));
   return route.fulfill({json:{success:true,data,meta:{page:1,limit:25,total:data.length,totalPages:1}}});
  }
  const session=sessions.find(s=>path.endsWith('/'+s.id));
  return route.fulfill({json:{success:true,data:session || []}});
 });
 return {sessions,writes,reads,errors};
}
test('monthly archive filters, searches and clears filters with visible CRUD for ended meetings',async({page})=>{
 const {reads,errors}=await setup(page);await page.goto('/admin/attendance');
 await expect(page.getByRole('link',{name:'Sửa Hội nghị giao ban tháng 10',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Xóa Hội nghị giao ban tháng 10',exact:true})).toBeVisible();
 await expect(page.getByText('Tháng 09/2026',{exact:true})).toBeVisible();
 await page.getByLabel('Tháng tổ chức',{exact:true}).fill('2026-10');
 await expect(page.getByRole('link',{name:'Họp chuyên đề tháng 9',exact:true})).toHaveCount(0);
 await page.getByLabel('Trạng thái buổi họp',{exact:true}).selectOption('ENDED');
 await page.getByLabel('Tìm buổi họp',{exact:true}).fill('giao ban');
 await expect.poll(()=>reads.some(url=>url.includes('month=2026-10') && url.includes('status=ENDED') && url.includes('search=giao'))).toBe(true);
 await page.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();
 await expect(page.getByRole('link',{name:'Họp chuyên đề tháng 9',exact:true})).toBeVisible();expect(errors).toEqual([]);
 await page.screenshot({path:'.tmp/attendance-review-list.png',fullPage:true});
});
test('ended meeting metadata can be edited and deletion with registrations requires explicit confirmation',async({page})=>{
 const {writes}=await setup(page);await page.goto('/admin/attendance');
 await page.getByRole('link',{name:'Sửa Hội nghị giao ban tháng 10',exact:true}).click();
 await page.getByLabel('Tên buổi họp',{exact:true}).fill('Hội nghị đã hiệu chỉnh');
 await expect(page.getByLabel('SSID',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hội nghị đã hiệu chỉnh',exact:true})).toBeVisible();
 expect(writes.find(w=>w.method==='PATCH')?.body.status).toBe('ENDED');
 await page.goto('/admin/attendance');
 await page.getByRole('button',{name:'Xóa Hội nghị đã hiệu chỉnh',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Xóa buổi họp',exact:true});await expect(dialog).toContainText('1 bản ghi đại biểu');
 expect(writes.filter(w=>w.method==='DELETE')).toHaveLength(0);
 await dialog.getByRole('button',{name:'Xác nhận',exact:true}).click();
 await expect(page.getByRole('link',{name:'Hội nghị đã hiệu chỉnh',exact:true})).toHaveCount(0);
 expect(writes.filter(w=>w.method==='DELETE')).toHaveLength(1);
});
test('create validates required inputs and changing the site preserves the form and scopes API requests',async({page})=>{
 const {writes,reads}=await setup(page);await page.goto('/admin/attendance/new');
 await page.getByRole('button',{name:'Lưu và kích hoạt',exact:true}).click();expect(writes).toHaveLength(0);
 await page.getByLabel('Tên buổi họp',{exact:true}).fill('Họp mới');
 await page.getByLabel('Mẫu trực tiếp',{exact:true}).selectOption('template');
 await page.getByLabel('UniFi site',{exact:true}).fill('branch');
 await expect.poll(()=>reads.some(path=>path.includes('/api/unifi/devices?type=ap&siteId=branch'))).toBe(true);
 await expect(page.getByLabel('Tên buổi họp',{exact:true})).toHaveValue('Họp mới');
 await page.getByLabel('SSID',{exact:true}).fill('Meeting');
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Họp mới',exact:true})).toBeVisible();
 const create=writes.find(w=>w.method==='POST');expect(create.body.unifiSite).toBe('branch');expect(create.body.startTime).toMatch(/Z$/);
});
test('live attendance consumes authenticated updates, links the exact template and permits participant corrections',async({page})=>{
 const {writes,errors}=await setup(page);await page.goto('/admin/attendance/live');
 await expect(page.locator('.attendance-table').first().getByText('Mất kết nối',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Thiết kế',exact:true})).toHaveAttribute('href','/admin/templates/template/builder?screen=attendance_gate');
 await page.getByRole('button',{name:'Chi tiết Nguyễn Văn An',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Hồ sơ: Nguyễn Văn An',exact:true});
 await expect(dialog).toContainText('Ban Biên tập');
 await dialog.getByRole('button',{name:'Sửa thông tin / thiết bị',exact:true}).click();
 await dialog.getByLabel('Họ và tên đại biểu',{exact:true}).fill('Nguyễn Văn Bình');
 await dialog.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Hồ sơ: Nguyễn Văn Bình',exact:true})).toBeVisible();
 expect(writes.filter(w=>w.path==='/api/attendance/monitor/tick')).toHaveLength(0);expect(errors).toEqual([]);
 await page.getByRole('button',{name:'Đóng',exact:true}).click();
 await page.screenshot({path:'.tmp/attendance-review-live.png',fullPage:true});
});
test('viewer receives live updates without creating monitor ticks or mutation controls',async({page})=>{
 const {writes}=await setup(page,'VIEWER');await page.goto('/admin/attendance/live');
 await expect(page.getByRole('heading',{name:'Hội nghị đang diễn ra',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sửa buổi họp',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Đồng bộ ngay',exact:true})).toHaveCount(0);
 await page.waitForTimeout(4500);expect(writes).toHaveLength(0);
});
test('Excel export sends the current bearer token and downloads through an authenticated request',async({page})=>{
 await setup(page);let auth='';await page.route('**/api/attendance/sessions/oct/export',route=>{auth=route.request().headers().authorization;return route.fulfill({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:Buffer.from('xlsx')});});
 await page.goto('/admin/attendance/oct');const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Xuất báo cáo Excel',exact:true}).click();const download=await downloadPromise;
 expect(download.suggestedFilename()).toBe('diem-danh-oct.xlsx');expect(auth).toMatch(/^Bearer /);
});
