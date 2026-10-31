import { test, expect } from '@playwright/test';
import { createDocument } from '../../src/lib/template-document';
const context='mac=aa:bb:cc:dd:ee:ff&apMac=11:22:33:44:55:66&ssid=Open&unifiSite=s1';
function ready(){return {success:true,data:{layout:createDocument(),params:{mac:'aa:bb:cc:dd:ee:ff',apMac:'11:22:33:44:55:66',ssid:'Open',unifiSite:'s1',device:'mobile'},campaignId:'c1',portalSessionId:'signed-test'}};}
test('waits for a new UniFi station to become visible, then renders the portal without granting Internet',async({page})=>{
 let reads=0;const writes:string[]=[];
 await page.route('**/api/**',route=>{if(route.request().method()!=='GET')writes.push(new URL(route.request().url()).pathname);reads++;return reads<=2?route.fulfill({status:409,headers:{'Retry-After':'1'},json:{success:false,code:'UNIFI_CLIENT_PENDING',error:'Đang chờ điểm phát WiFi cập nhật kết nối của bạn.'}}):route.fulfill({json:ready()});});
 await page.goto('/portal?'+context);
 await expect(page.getByRole('status')).toContainText('Đang chờ điểm phát WiFi');
 await expect(page.locator('[data-screen="portal"]')).toBeVisible({timeout:12000});
 expect(reads).toBe(3);expect(writes).toEqual([]);await expect(page.locator('p[role="alert"]')).toHaveCount(0);
});
test('keeps a definite identity mismatch as an error and allows an explicit retry',async({page})=>{
 let reads=0;
 await page.route('**/api/portal?**',route=>{reads++;return reads===1?route.fulfill({status:403,json:{success:false,error:'Thông tin kết nối WiFi đã thay đổi.'}}):route.fulfill({json:ready()});});
 await page.goto('/portal?'+context);await expect(page.locator('p[role="alert"]')).toContainText('Thông tin kết nối WiFi đã thay đổi.');
 await page.waitForTimeout(1500);expect(reads).toBe(1);
 await page.getByRole('button',{name:'Thử lại',exact:true}).click();await expect(page.locator('[data-screen="portal"]')).toBeVisible();expect(reads).toBe(2);
});
test('bounds waiting for an absent client instead of polling forever',async({page})=>{
 await page.clock.install();
 await page.route('**/api/portal?**',route=>route.fulfill({status:409,headers:{'Retry-After':'2'},json:{success:false,code:'UNIFI_CLIENT_PENDING',error:'Đang chờ điểm phát WiFi cập nhật kết nối của bạn.'}}));
 await page.goto('/portal?'+context);await expect(page.getByRole('status')).toContainText('Đang chờ điểm phát WiFi');
 await page.clock.fastForward(61000);await expect(page.locator('p[role="alert"]')).toContainText('Chưa xác minh được kết nối WiFi');await expect(page.getByRole('button',{name:'Thử lại',exact:true})).toBeVisible();
});
test('shows the portal immediately while live association is still pending and never grants automatically',async({page})=>{
 let reads=0;const grants:string[]=[];
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;if(p!=='/api/portal')grants.push(p);reads++;return route.fulfill({json:{...ready(),data:{...ready().data,connectionPending:reads<3}}});});
 await page.goto('/portal?'+context);await expect(page.locator('[data-screen="portal"]')).toBeVisible({timeout:4000});expect(grants).toEqual([]);await expect.poll(()=>reads).toBeGreaterThanOrEqual(3);expect(grants).toEqual([]);
});
