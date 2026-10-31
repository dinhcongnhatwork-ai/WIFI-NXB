import { test, expect } from '@playwright/test';
import { createPresetDocument, TEMPLATE_PRESETS } from '../../src/lib/template-presets';

test('all five starter backgrounds load without distortion on Mobile, Tablet and PC', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    localStorage.setItem('token', `audit.${btoa(JSON.stringify({exp:4102444800}))}.audit`);
    localStorage.setItem('username', 'audit');
  });
  let layoutJson = createPresetDocument('van-hoa-doc');
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET');
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({json:{success:true,data:path === '/api/auth/me'
      ? {id:'audit',username:'audit',role:'ADMIN'}
      : path === '/api/templates/audit' ? {id:'audit',name:'Kiểm tra nền',layoutJson} : []}});
  });
  for (const preset of TEMPLATE_PRESETS) {
    layoutJson = createPresetDocument(preset.id);
    for (const [device, label] of [['mobile','Mobile'],['tablet','Tablet'],['desktop','PC']]) {
      await page.goto(`/admin/templates/audit/preview?screen=portal&device=${device}`);
      const frame = page.frameLocator(`iframe[title="Xem trước ${label}"]`);
      const bg = frame.locator('[data-portal-background="preset"]');
      await expect(bg).toHaveCSS('background-size', 'cover');
      const dimensions = await bg.evaluate(async element => {
        const image = new Image();
        image.src = getComputedStyle(element).backgroundImage.slice(5,-2);
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      });
      expect(dimensions).toEqual(device === 'desktop' ? [1920,1080] : [1080,1920]);
      await page.screenshot({path:`.tmp/background-${preset.id}-${device}.png`,fullPage:true});
    }
  }
});
