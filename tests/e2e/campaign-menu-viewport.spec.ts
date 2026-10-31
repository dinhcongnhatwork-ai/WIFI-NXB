import { expect, test, type Locator, type Page } from '@playwright/test';

async function setup(page: Page, status = 'draft') {
  await page.addInitScript(() => {
    localStorage.setItem('token', `audit.${btoa(JSON.stringify({ exp: 4102444800 }))}.audit`);
  });
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') throw new Error(`Unexpected write: ${request.method()} ${path}`);
    const data = path === '/api/auth/me' ? { id: 'admin', username: 'admin', role: 'ADMIN' }
      : path === '/api/campaigns' ? Array.from({ length: 12 }, (_, index) => ({
        id: `campaign-${index}`, name: `Campaign ${index}`, ssid: 'TEST WIFI', templateId: 'template-1',
        startTime: '2026-01-01T00:00:00Z', endTime: '2027-01-01T00:00:00Z', active: true,
        portalEnabled: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        template: { id: 'template-1', name: 'Test template', status }, _count: { logs: 0 },
      })) : path.endsWith('/session-policy') ? { sessionMinutes: 240 } : [];
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/admin/campaigns');
  await page.waitForLoadState('networkidle');
}

function menu(page: Page) {
  return page.getByRole('button', { name: 'Thời hạn phiên WiFi', exact: true }).locator('..');
}
async function expectWithinViewport(page: Page, element: Locator) {
  await expect(element).toBeVisible();
  await expect.poll(async () => element.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.top >= 7 && rect.left >= 7 && rect.bottom <= innerHeight - 7 && rect.right <= innerWidth - 7;
  })).toBe(true);
}
async function expectAligned(page: Page, trigger: Locator) {
  await expect.poll(async () => {
    const anchor = await trigger.boundingBox();
    const popup = await menu(page).boundingBox();
    if (!anchor || !popup) return false;
    const gap = Math.min(Math.abs(popup.y + popup.height - anchor.y), Math.abs(popup.y - anchor.y - anchor.height));
    return gap <= 5 && Math.abs(popup.x + popup.width - anchor.x - anchor.width) < 1;
  }).toBe(true);
}

// Catches the downward-only placement and the hard-coded 160px alignment.
test('campaign actions fit a short viewport and remain aligned after resize and scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await setup(page);
  const trigger = page.getByRole('button', { name: 'Thao tác chiến dịch Campaign 5', exact: true });
  await trigger.click();
  await expectWithinViewport(page, menu(page));
  await expectAligned(page, trigger);
  await page.setViewportSize({ width: 1380, height: 600 });
  await expectWithinViewport(page, menu(page));
  await expectAligned(page, trigger);
  await page.evaluate(() => window.scrollBy(0, 40));
  await expectWithinViewport(page, menu(page));
  await expectAligned(page, trigger);
  await expect(menu(page).getByRole('button', { name: 'Xóa', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Chiến dịch', exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
});

test('campaign actions scroll in a narrow landscape viewport and return focus with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 320 });
  await setup(page);
  const trigger = page.getByRole('button', { name: 'Thao tác chiến dịch Campaign 0', exact: true });
  await trigger.click();
  await expectWithinViewport(page, menu(page));
  await expect(menu(page).getByRole('button', { name: 'Thời hạn phiên WiFi', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu(page).getByRole('button', { name: 'Xóa', exact: true })).toBeFocused();
  await menu(page).getByRole('button', { name: 'Xóa', exact: true }).scrollIntoViewIfNeeded();
  await expectWithinViewport(page, menu(page).getByRole('button', { name: 'Xóa', exact: true }));
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(menu(page)).toHaveCount(0);
});

for (const action of ['Thời hạn phiên WiFi', 'Reset WiFi']) {
  test(`${action} dialog stays within a short viewport with reachable controls`, async ({ page }) => {
    await page.setViewportSize({ width: 560, height: 360 });
    await setup(page);
    await page.getByRole('button', { name: 'Thao tác chiến dịch Campaign 0', exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: action, exact: true });
    await expectWithinViewport(page, dialog);
    const close = dialog.getByRole('button', { name: action === 'Reset WiFi' ? 'Hủy' : 'Đóng', exact: true });
    await close.scrollIntoViewIfNeeded();
    await expectWithinViewport(page, close);
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thao tác chiến dịch Campaign 0', exact: true })).toBeFocused();
  });
}
