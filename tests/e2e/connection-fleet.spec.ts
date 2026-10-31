import { test, expect } from '@playwright/test';

test('MikroTik inventory keeps fleet roles and SwOS metadata while preserving encrypted secrets on edit', async ({ page }) => {
  const rows: any[] = [];
  const writes: any[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('token', `test.${btoa(JSON.stringify({ id: 'admin', exp: 4102444800 }))}.test`);
    (window as any).fleetChanges = 0;
    window.addEventListener('network-connections-changed', () => (window as any).fleetChanges++);
  });
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { success: true, data: { id: 'admin', username: 'admin', role: 'ADMIN' } } });
    if (path === '/api/network/connections') {
      if (req.method() === 'POST') {
        expect(req.headers().authorization).toBeTruthy();
        const body = req.postDataJSON();
        writes.push(body);
        const row = { ...body, id: body.id || `device-${rows.length}`, status: 'unknown', hasCredentials: true };
        const index = rows.findIndex(r => r.id === row.id);
        if (index < 0) rows.push(row); else rows[index] = row;
        return route.fulfill({ json: { success: true, data: row } });
      }
      return route.fulfill({ json: { success: true, data: rows, encryptionConfigured: true } });
    }
    if (path === '/api/settings') return route.fulfill({ json: { success: true, data: { connections: rows, encryptionConfigured: true, monitoring: { configured: true } } } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/admin/settings');
  for (const [role, count] of [['router', 2], ['core-switch', 1], ['access-switch', 4]] as const) {
    for (let i = 0; i < count; i++) {
      await page.getByRole('button', { name: 'Thêm kết nối', exact: true }).click();
      await page.getByLabel('Tên kết nối', { exact: true }).fill(`${role} ${i + 1}`);
      await page.getByLabel('Địa chỉ thiết bị').fill(`https://${role}-${i + 1}.example.test`);
      await page.getByLabel('Tên đăng nhập', { exact: true }).fill('inventory-admin');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-secret');
      await page.getByLabel('Vai trò thiết bị').selectOption(role);
      await page.getByLabel('Model (tùy chọn)').fill(role === 'router' ? 'CCR2004' : 'CRS328');
      await page.getByLabel('Vị trí (tùy chọn)').fill('Tủ mạng tầng 1');
      if (role === 'access-switch' && i === 3) {
        await page.getByLabel('Hệ điều hành').selectOption('swos');
        await expect(page.getByRole('status').filter({ hasText: 'SwOS không cung cấp RouterOS REST API' })).toBeVisible();
      }
      await page.getByRole('button', { name: 'Lưu kết nối', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Đã lưu kết nối' })).toBeVisible();
    }
  }
  await expect(page.getByText('7 thiết bị · 2 router · 1 core switch · 4 access switch', { exact: true })).toBeVisible();
  expect(writes.filter(w => w.config.deviceRole === 'router')).toHaveLength(2);
  expect(writes.filter(w => w.config.deviceRole === 'core-switch')).toHaveLength(1);
  expect(writes.filter(w => w.config.deviceRole === 'access-switch')).toHaveLength(4);
  expect(writes[6].config).toMatchObject({ operatingSystem: 'swos', deviceRole: 'access-switch', model: 'CRS328', location: 'Tủ mạng tầng 1' });
  await expect(page.getByRole('link', { name: 'Xem sơ đồ toàn bộ thiết bị MikroTik →' })).toHaveAttribute('href', '/admin/mikrotik/topology?scope=fleet');
  await page.getByRole('row').filter({ hasText: 'access-switch 4' }).getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.getByLabel('Mật khẩu mới')).toHaveValue('');
  await expect(page.getByLabel('Hệ điều hành')).toHaveValue('swos');
  await page.getByRole('button', { name: 'Lưu kết nối', exact: true }).click();
  await expect.poll(() => writes.length).toBe(8);
  expect(writes[7].credentials.password).toBeUndefined();
  expect(writes[7].config.deviceRole).toBe('access-switch');
  await expect.poll(() => page.evaluate(() => (window as any).fleetChanges)).toBe(8);
});
