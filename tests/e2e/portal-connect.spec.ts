import {NextRequest} from 'next/server';
import {portalConnectionPending} from '../../src/lib/network/portal-connection-pending';
import {test,expect} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {createPresetDocument} from '../../src/lib/template-presets';
import {wifiConnectionSuccess} from '../../src/lib/network/portal-success';
let website:Server;
let destination:string;
// A real destination server also exercises redirected requests that bypass browser route mocks.
test.beforeAll(async()=>{
 website=createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end('<h1>Website Nhà xuất bản</h1>');});
 await new Promise<void>(resolve=>website.listen(0,'127.0.0.1',resolve));
 destination=`http://127.0.0.1:${(website.address() as AddressInfo).port}/configured-destination`;
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>website.close(error=>error?reject(error):resolve()));});
test('Mẫu 4 without extra gates connects once and goes straight to the configured website',async({page})=>{
 const layout=createPresetDocument('trien-lam');for(const variant of Object.values(layout.variants))for(const node of Object.values(variant.flow))if(node)node.element.enabled=false;
 let connects=0;const mutations:string[]=[];const context='mac=aa:bb:cc:dd:ee:ff&apMac=11:22:33:44:55:66&ssid=TEST+WIFI+MARKETING&unifiSite=s1';const redirect=wifiConnectionSuccess(destination);
 await page.route('**/api/**',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET')mutations.push(u.pathname);if(u.pathname==='/api/portal')return r.fulfill({json:{success:true,data:{layout,params:{mac:'aa:bb:cc:dd:ee:ff',apMac:'11:22:33:44:55:66',ssid:'TEST WIFI MARKETING',unifiSite:'s1',device:'mobile'},campaignId:'c1',portalSessionId:'signed-test',redirectUrl:destination}}});if(u.pathname==='/api/connect'){connects++;expect(u.searchParams.get('portalSessionId')).toBe('signed-test');return r.fulfill({status:redirect.status,headers:Object.fromEntries(redirect.headers),body:''});}return r.fulfill({json:{success:true,data:[]}});});
 await page.goto('/portal?'+context);await expect(page.locator('[data-screen="portal"]')).toBeVisible();await expect(page.locator('[data-flow-content]')).toHaveCount(0);await page.locator('button.portal-connect-button').click();await expect(page).toHaveURL(destination,{timeout:10000});await expect(page.getByRole('heading',{name:'Website Nhà xuất bản'})).toBeVisible();await expect(page.getByRole('link',{name:'Tiếp tục',exact:true})).toHaveCount(0);expect(connects).toBe(1);expect(mutations).toEqual([]);
});

test('the connection redirect works without JavaScript in the captive browser',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 const redirect=wifiConnectionSuccess(destination);
 await page.route('**/api/connect?**',route=>route.fulfill({status:redirect.status,headers:Object.fromEntries(redirect.headers),body:''}));
 await page.goto(baseURL+'/api/connect?portalSessionId=verified-test');
 await expect(page).toHaveURL(destination);
 await expect(page.getByRole('heading',{name:'Website Nhà xuất bản'})).toBeVisible();
 await context.close();
});

test('an accepted delayed grant shows progress and reaches the target without a second user click',async({page})=>{
 const layout=createPresetDocument('trien-lam');for(const variant of Object.values(layout.variants))for(const node of Object.values(variant.flow))if(node)node.element.enabled=false;
 let checks=0;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/portal')return route.fulfill({json:{success:true,data:{layout,params:{mac:'aa:bb:cc:dd:ee:ff',ssid:'Open',unifiSite:'s1'},campaignId:'c1',portalSessionId:'signed-test'}}});
  if(url.pathname==='/api/connect'){
   checks++;const response=checks<3?portalConnectionPending(new NextRequest(url)):wifiConnectionSuccess(destination);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  return route.fulfill({json:{success:true,data:[]}});
 });
 await page.goto('/portal?mac=aa:bb:cc:dd:ee:ff&ssid=Open&unifiSite=s1');await page.locator('button.portal-connect-button').click();
 await expect(page.getByRole('heading',{name:'Đang xác thực kết nối WiFi'})).toBeVisible();
 await expect(page).toHaveURL(destination,{timeout:20000});await expect(page.getByRole('heading',{name:'Website Nhà xuất bản'})).toBeVisible();expect(checks).toBe(3);
});

test('a background portal poll cannot replace the connecting page with a server error during navigation',async({page})=>{
 const layout=createPresetDocument('trien-lam');for(const variant of Object.values(layout.variants))for(const node of Object.values(variant.flow))if(node)node.element.enabled=false;
 let polls=0,errors=0;let failPoll!:()=>void;const pollFailure=new Promise<void>(r=>{failPoll=r;});
 await page.exposeFunction('recordPortalError',()=>{errors++;});
 await page.addInitScript(()=>{
  new MutationObserver(()=>{if(document.querySelector('[role="alert"]')?.textContent?.includes('Lỗi kết nối máy chủ'))(window as any).recordPortalError();}).observe(document,{subtree:true,childList:true,characterData:true});
 });
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/api/portal'){
   polls++;if(polls>1){await pollFailure;try{await route.abort('failed');}catch{}return;}
   return route.fulfill({json:{success:true,data:{layout,connectionPending:true,params:{mac:'aa:bb:cc:dd:ee:ff',ssid:'Open',unifiSite:'s1',device:'mobile'},campaignId:'c1',portalSessionId:'signed-test'}}});
  }
  if(u.pathname==='/api/connect'){
   failPoll();await new Promise(r=>setTimeout(r,500));const response=wifiConnectionSuccess(destination);return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:''});
  }
  return route.fulfill({json:{success:true,data:[]}});
 });
 await page.goto('/portal?mac=aa:bb:cc:dd:ee:ff&ssid=Open&unifiSite=s1');await expect.poll(()=>polls).toBe(2);
 await page.locator('button.portal-connect-button').click();await expect(page).toHaveURL(destination,{timeout:10000});expect(errors).toBe(0);
});

test('initial portal loading recovers automatically from a network failure and a transient HTML gateway error',async({page})=>{
 const layout=createPresetDocument('trien-lam');for(const v of Object.values(layout.variants))for(const n of Object.values(v.flow))if(n)n.element.enabled=false;
 let reads=0,grants=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/portal'){
   reads++;if(reads===1)return route.abort('failed');if(reads===2)return route.fulfill({status:503,contentType:'text/html',body:'Temporary gateway failure'});
   return route.fulfill({json:{success:true,data:{layout,params:{mac:'aa:bb:cc:dd:ee:ff',ssid:'Open',unifiSite:'s1',device:'mobile'},portalSessionId:'signed-test'}}});
  }
  if(path==='/api/connect')grants++;return route.fulfill({json:{success:true,data:[]}});
 });
 await page.goto('/portal?mac=aa:bb:cc:dd:ee:ff&ssid=Open&unifiSite=s1');await expect(page.locator('[data-screen="portal"]')).toBeVisible({timeout:15000});expect(reads).toBe(3);expect(grants).toBe(0);await expect(page.locator('p[role="alert"]')).toHaveCount(0);
});
test('persistent portal failures stop retrying and show an actionable recovery message',async({page})=>{
 let reads=0;await page.route('**/api/portal?**',r=>{reads++;return r.fulfill({status:503,contentType:'text/html',body:'Unavailable'});});
 await page.goto('/portal?ssid=Open&unifiSite=s1');await expect(page.locator('p[role="alert"]')).toContainText('Chưa tải được trang WiFi',{timeout:15000});expect(reads).toBe(3);await expect(page.getByRole('button',{name:'Thử lại',exact:true})).toBeVisible();
});
