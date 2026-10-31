import { test, expect, type Page } from '@playwright/test';

const fleetUrl = '/admin/mikrotik/topology?scope=fleet';
const rootId = (id: string) => `mikrotik:${id}:router:local`;
const diagramNode = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

async function setupFleet(page: Page, role = 'ADMIN') {
  const rows = Array.from({ length: 7 }, (_, i) => ({
    id: `c${i + 1}`, provider: 'MIKROTIK', name: i < 2 ? `Router ${i + 1}` : i === 2 ? 'Core switch' : `Access switch ${i - 2}`,
    baseUrl: `https://192.168.10.${i + 1}`, username: 'inventory-admin', isDefault: i === 0,
    status: 'online', version: '7.20', hasCredentials: true,
    config: { deviceRole: i < 2 ? 'router' : i === 2 ? 'core-switch' : 'access-switch', operatingSystem: 'routeros', model: i < 2 ? 'CCR2004' : 'CRS328', location: 'Tủ mạng tầng 1' },
  }));
  const state = { requests: [] as URL[], writes: [] as any[], rows };
  await page.addInitScript(({ role }) => {
    localStorage.setItem('token', `test.${btoa(JSON.stringify({ id: 'fleet-test', username: 'fleet-test', role, exp: 4102444800 }))}.test`);
    localStorage.setItem('username', 'fleet-test');
  }, { role });
  const graph = () => {
    const nodes: any[] = rows.map(row => ({ id: rootId(row.id), type: row.config.deviceRole === 'router' ? 'gateway' : 'switch', name: row.name, ip: new URL(row.baseUrl).hostname, status: row.status, meta: { ...row.config, provider: 'mikrotik', managed: true, connectionId: row.id, connectedApPorts: 0, connectedPeerCount: row.id === 'c4' ? 1 : 0, portConnections: row.id === 'c4' ? [{ localPort: 'ether7', remotePort: null, peerId: rootId('c5'), peerName: 'Access switch 2', peerType: 'switch', evidence: 'RouterOS LLDP', observedAt: new Date().toISOString() }] : [] } }));
    nodes.push(...Array.from({length:976}, (_,i)=>({id:`client${i}`,type:'client',name:`Client ${i}`,status:'online'})), {id:'offline',type:'switch',name:'Offline switch',status:'offline',meta:{managed:true,provider:'mikrotik'}}, { id: 'mikrotik:c4:interface:*1', type: 'interface', name: 'ether7', status: 'online', meta: { provider: 'mikrotik' } }, { id: 'mikrotik:c4:interface:*2', type: 'interface', name: 'ether8 idle', status: 'offline', meta: { provider: 'mikrotik' } }, { id: 'ap1', type: 'ap', name: 'AP Tầng 1', status: 'online', meta: { provider: 'unifi', model: 'U6 Pro' } });
    const links: any[] = rows.slice(1).map((row, i) => ({ id: `fleet-${row.id}`, source: rootId(i < 2 ? 'c1' : 'c3'), target: rootId(row.id), type: 'neighbor', layer: 'physical', sourcePort:'ether7', targetPort:'sfp1', evidence: 'RouterOS LLDP' }));
    links.push({ id: 'port-attached', source: rootId('c4'), target: 'mikrotik:c4:interface:*1', type: 'interface', evidence: 'RouterOS interface' }, { id: 'port-idle', source: rootId('c4'), target: 'mikrotik:c4:interface:*2', type: 'interface', evidence: 'RouterOS interface' }, { id: 'ap-port', source: 'mikrotik:c4:interface:*1', target: 'ap1', type: 'neighbor', sourcePort: 'ether7', evidence: 'RouterOS LLDP' });
    return { nodes, links, warnings: [], observedAt: new Date().toISOString() };
  };
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    state.requests.push(url);
    if (!request.headers().authorization) return route.fulfill({ status: 401, json: { success: false, error: 'Authentication required' } });
    if (path === '/api/auth/me') return route.fulfill({ json: { success: true, data: { id: 'fleet-test', username: 'fleet-test', role } } });
    if (path === '/api/network/connections') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); state.writes.push(body);
        const row = { ...body, id: body.id || `c${rows.length + 1}`, status: 'online', version: null, hasCredentials: true };
        rows.push(row);
        return route.fulfill({ json: { success: true, data: row } });
      }
      const provider = url.searchParams.get('provider');
      return route.fulfill({ json: { success: true, data: provider ? rows.filter(r => r.provider === provider) : rows, encryptionConfigured: true } });
    }
    if (path.endsWith('/topology/traffic')) {
      const current = graph(), sample = { downloadBytes: 12000, uploadBytes: 32000, downloadBps: 100000, uploadBps: 260000, perspective: 'interface', source: 'RouterOS fixture', sampledAt: new Date().toISOString() };
      return route.fulfill({ json: { success: true, data: { nodes: Object.fromEntries(current.nodes.map(n => [n.id, sample])), links: Object.fromEntries(current.links.map(l => [l.id, sample])), sampledAt: sample.sampledAt, source: sample.source } } });
    }
    if (path.endsWith('/topology')) return route.fulfill({ json: { success: true, data: graph() } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return state;
}

test('fleet renders only seven online MikroTik devices from a 976-client mixed response and preserves fullscreen and port details', async ({ page }) => {
  const state = await setupFleet(page);
  await page.goto(fleetUrl);
  await expect(page.getByLabel('Router', { exact: true })).toHaveValue('fleet');
  await expect(page).toHaveURL(/scope=fleet/);
  await expect(page.getByText('7 thiết bị MikroTik', { exact: true })).toBeVisible();
  await expect(page.locator('.network-device-type').filter({ hasText: 'MikroTik · Router' })).toHaveCount(2);
  await expect(page.locator('.network-device-type').filter({ hasText: 'MikroTik · Core switch' })).toHaveCount(1);
  await expect(page.locator('.network-device-type').filter({ hasText: 'MikroTik · Access switch' })).toHaveCount(4);
  await expect(page.locator('.react-flow__node')).toHaveCount(7);
  await expect(diagramNode(page, 'ap1')).toHaveCount(0);
  await expect(diagramNode(page, 'offline')).toHaveCount(0);
  await expect(page.getByLabel('Hiện tất cả cổng')).toHaveCount(0);
  await expect(page.getByLabel('Lọc trạng thái')).toHaveCount(0);
  await expect(page.getByText('Chỉ MikroTik trực tuyến · Không hiển thị máy khách')).toBeVisible();
  expect(state.requests.filter(url=>url.pathname.endsWith('/topology/traffic'))).toHaveLength(0);
  await page.getByRole('button', {name:/Danh sách/}).click();
  await expect(page.locator('.network-inventory tbody tr')).toHaveCount(7);
  await page.getByRole('button', {name:'Sơ đồ kết nối', exact:true}).click();
  const zoom = await page.getByRole('button', { name: 'Về mức phóng 100%' }).innerText();
  await page.getByRole('button', { name: 'Toàn màn hình', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thoát toàn màn hình', exact: true })).toBeVisible();
  await expect(page.locator('.network-zoom')).toHaveText(zoom);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toàn màn hình', exact: true })).toBeVisible();
  await expect(page.locator('.network-zoom')).toHaveText(zoom);
  await diagramNode(page, rootId('c4')).click();
  await page.getByRole('tab', { name: 'Cổng & kết nối', exact: true }).click();
  const details = page.getByRole('complementary', { name: 'Chi tiết quan sát' });
  await expect(details).toContainText('ether7');
  await expect(details).toContainText('Access switch 2');
  await expect(details).toContainText('RouterOS LLDP');
  await page.screenshot({ path: '.tmp/mikrotik-online/online-port-after.png', fullPage: true });
  await page.getByRole('button', { name: 'Bỏ lựa chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '.tmp/mikrotik-online/online-after.png', fullPage: true });
  const managedBoxes = await page.locator('.react-flow__node[data-id$="router:local"]').evaluateAll(elements => elements.map(el => {
    const box = el.getBoundingClientRect();
    return { id: el.getAttribute('data-id'), left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }));
  const overlaps: string[] = [];
  for (let a = 0; a < managedBoxes.length; a++) for (let b = a + 1; b < managedBoxes.length; b++) {
    const x = managedBoxes[a], y = managedBoxes[b];
    if (Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1) overlaps.push(`${x.id} overlaps ${y.id}`);
  }
  expect(overlaps, 'Managed device cards must not hide each other').toEqual([]);
});

test('admin adds an eighth RouterOS device and returns to updated aggregate fleet without reloading', async ({ page }) => {
  const state = await setupFleet(page);
  await page.goto(fleetUrl);
  await expect(diagramNode(page, rootId('c1'))).toBeVisible();
  await page.getByRole('link', { name: 'Thêm thiết bị', exact: true }).click();
  await expect(page).toHaveURL(/inventory\?add=1/);
  await expect(page.getByLabel('Nhà cung cấp')).toBeDisabled();
  await expect(page.getByLabel('Nhà cung cấp')).toHaveValue('MIKROTIK');
  await expect(page.getByRole('heading', { name: 'UniFi Controller', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Hệ điều hành')).toHaveValue('routeros');
  await page.getByLabel('Tên kết nối', { exact: true }).fill('Access switch 5');
  await page.getByLabel('Địa chỉ thiết bị').fill('https://192.168.10.8');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('inventory-admin');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('fixture-password');
  await page.getByLabel('Vai trò thiết bị').selectOption('access-switch');
  await page.getByLabel('Model (tùy chọn)').fill('CRS328');
  await page.getByRole('button', { name: 'Lưu kết nối', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/mikrotik\/topology\?scope=fleet$/);
  await expect(page.getByText('8 thiết bị MikroTik', { exact: true })).toBeVisible();
  await expect(diagramNode(page, rootId('c8'))).toHaveCount(1);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].config).toMatchObject({ deviceRole: 'access-switch', operatingSystem: 'routeros', model: 'CRS328' });
  expect(state.requests.filter(u => u.pathname.endsWith('/topology/traffic'))).toHaveLength(0);
  for (const request of state.requests.filter(u => u.pathname.startsWith('/api/mikrotik/topology'))) expect(request.searchParams.get('scope')).toBe('fleet');
});

test('viewer sees aggregate inventory and cannot add devices', async ({ page }) => {
  await setupFleet(page, 'VIEWER');
  await page.goto(fleetUrl);
  await expect(page.getByText('7 thiết bị MikroTik', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Thêm thiết bị', exact: true })).toHaveCount(0);
  await page.goto('/admin/mikrotik/inventory?add=1');
  await expect(page.getByText('Chỉ quản trị viên được quản lý kết nối.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu kết nối', exact: true })).toHaveCount(0);
});

for (const viewport of [{width:1366,height:768},{width:1920,height:1080}]) {
  test(`online-only inventory survives offline/recovery updates at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    const state = await setupFleet(page);
    await page.goto(fleetUrl);
    await expect(page.locator('.react-flow__node')).toHaveCount(7);
    const zoomButton = page.getByRole('button',{name:'Về mức phóng 100%'});
    await expect(zoomButton).toHaveText(/^(?:[6-9]\d|100)%$/); // Compact fleets may already fit at 100%.
    await zoomButton.click();
    await expect(zoomButton).toHaveText('100%');
    const zoom = '100%';
    state.rows[0].status='offline';
    await page.getByLabel('Làm mới sơ đồ').click();
    await expect(page.locator('.react-flow__node[data-id^="mikrotik:"]')).toHaveCount(6);
    await expect(diagramNode(page,rootId('c1'))).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Về mức phóng 100%'})).toHaveText(zoom);
    state.rows[0].status='online';
    await page.getByLabel('Làm mới sơ đồ').click();
    await expect(page.locator('.react-flow__node')).toHaveCount(7);
    await expect(page.getByRole('button',{name:'Về mức phóng 100%'})).toHaveText(zoom);
    await page.screenshot({path:`.tmp/mikrotik-online/online-${viewport.width}.png`,fullPage:true});
    await page.getByRole('button',{name:/Danh sách/}).click();
    await expect(page.locator('.network-inventory tbody tr')).toHaveCount(7);
    expect(state.requests.filter(url=>url.pathname.endsWith('/topology/traffic'))).toHaveLength(0);
  });
}
