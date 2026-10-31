import { test, expect } from '@playwright/test';
import { TEMPLATE_PRESETS, createPresetDocument } from '../../src/lib/template-presets';
import { DEVICE_KEYS, DEVICES } from '../../src/lib/template-document';
import fs from 'node:fs';
import path from 'node:path';

test('inspect starter templates across PC, Tablet, and Mobile', async ({ page }) => {
  const outputDir = path.join(process.cwd(), '.tmp/template-inspections');
  fs.mkdirSync(outputDir, { recursive: true });

  await page.addInitScript(() => {
    localStorage.setItem('token', `audit.${btoa(JSON.stringify({ exp: 4102444800 }))}.audit`);
    localStorage.setItem('username', 'audit');
  });

  await page.route('**/api/auth/me', route => route.fulfill({json:{success:true,data:{id:'audit',username:'audit',role:'ADMIN'}}}));

  for (const preset of TEMPLATE_PRESETS) {
    const document = createPresetDocument(preset.id);
    await page.route(`**/api/templates/${preset.id}`, async route => {
      return route.fulfill({
        json: {
          success: true,
          data: {
            id: preset.id,
            name: preset.name,
            layoutJson: document,
            status: 'draft',
            draftVersion: 1,
            campaigns: [],
          },
        },
      });
    });

    for (const device of DEVICE_KEYS) {
      const vp = DEVICES[device].presets[0];
      await page.setViewportSize({ width: Math.max(vp.width + 100, 1000), height: Math.max(vp.height + 200, 800) });
      await page.goto(`/admin/templates/${preset.id}/preview?screen=portal&device=${device}`);
      const frame = page.frameLocator(`iframe[title="Xem trước ${DEVICES[device].label}"]`);
      await frame.locator('[data-screen="portal"]').waitFor();

      const screenPath = path.join(outputDir, `${preset.id}-${device}.png`);
      await frame.locator('[data-screen="portal"]').screenshot({ path: screenPath });
      console.log(`Captured: ${screenPath}`);
    }
  }
});
