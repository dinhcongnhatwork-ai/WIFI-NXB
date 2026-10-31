import { test, expect } from '@playwright/test';
import { createDocument } from '../../src/lib/template-document';

test('opening the CMS from a template card keeps its editor and canvas in the viewport', async ({ page }) => {
  const layoutJson = createDocument();
  const template = { id: 'cms-navigation', name: 'Mẫu điều hướng', status: 'draft', draftVersion: 1, layoutJson, campaigns: [], _count: { campaigns: 0 }, updatedAt: '2026-10-28T00:00:00Z' };
  const writes: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('token', `audit.${btoa(JSON.stringify({ exp: 4102444800 }))}.audit`);
    localStorage.setItem('username', 'audit');
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(path);
    if (path === '/api/auth/me') return route.fulfill({ json: { success: true, data: { id: 'audit', username: 'audit', role: 'ADMIN' } } });
    if (path === '/api/templates') return route.fulfill({ json: { success: true, data: [template] } });
    if (path === '/api/templates/cms-navigation') return route.fulfill({ json: { success: true, data: template } });
    return route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/admin/templates');
  const edit = page.locator('a[title="Chỉnh sửa"][href="/admin/templates/cms-navigation/builder"]');
  await edit.hover();
  await edit.click();
  await expect(page).toHaveURL(/\/admin\/templates\/cms-navigation\/builder$/);
  const navigation = page.getByRole('navigation', { name: 'Màn hình thiết kế' });
  await expect(navigation).toBeVisible();
  // Rendered text alone missed this bug: a transformed zero-height ancestor
  // collapsed the fixed editor while its DOM and iframe remained populated.
  const editor = page.locator('#admin-main .fixed.inset-0').first();
  await expect.poll(async () => (await editor.boundingBox())?.height || 0).toBe(1100);
  await expect.poll(async () => (await editor.boundingBox())?.width || 0).toBe(1440);
  await expect(navigation).toBeInViewport();
  const canvas = page.locator('iframe[title="Canvas thiết kế"]');
  await expect(canvas).toBeInViewport();
  await expect(page.frameLocator('iframe[title="Canvas thiết kế"]').locator('[data-screen="portal"]')).toBeVisible();

  await page.getByRole('link', { name: 'Về danh sách mẫu' }).click();
  await expect(page.getByRole('heading', { name: 'Mẫu giao diện', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});
