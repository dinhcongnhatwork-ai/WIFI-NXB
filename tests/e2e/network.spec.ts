import { test, expect, type Page } from "@playwright/test";
test.use({ video: "on" });
const connections = [
  { id: "router-a", name: "Router văn phòng", isDefault: true, config: {} },
  { id: "router-b", name: "Router kho", isDefault: false, config: {} },
];
async function setup(page: Page, role = "ADMIN", empty = false) {
  await page.addInitScript(
    ({ role }) => {
      localStorage.setItem(
        "token",
        `test.${btoa(JSON.stringify({ id: "test-user", username: "kiemthu", role, exp: 4102444800 }))}.test`,
      );
      localStorage.setItem("username", "kiemthu");
    },
    { role },
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (!route.request().headers().authorization)
      return route.fulfill({
        status: 401,
        json: { success: false, error: "Vui lòng đăng nhập để tiếp tục." },
      });
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          success: true,
          data: { id: "test-user", username: "kiemthu", role },
        },
      });
    if (path === "/api/network/connections")
      return route.fulfill({
        json: { success: true, data: empty ? [] : connections },
      });
    if (path === "/api/mikrotik/overview")
      return route.fulfill({
        json: {
          success: true,
          data: {
            connection: { host: "router-b" },
            identity: { name: "Router kho" },
            interfaces: [],
            addresses: [],
            firewallRules: [],
            hotspotUsers: [],
            hotspotActive: [],
          },
        },
      });
    if (path === "/api/mikrotik/interfaces")
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "*1",
              name:
                url.searchParams.get("connectionId") === "router-b"
                  ? "ether-kho"
                  : "ether-vanphong",
              running: true,
              disabled: false,
            },
          ],
        },
      });
    if (path === "/api/unifi/info")
      return route.fulfill({
        json: {
          success: true,
          data: [
            { name: "default", desc: "Default" },
            { name: "branch", desc: "Branch" },
          ],
        },
      });
    if (path === "/api/unifi/overview")
      return route.fulfill({
        json: {
          success: true,
          data: {
            devices: [],
            clients: [],
            ssids: [],
            alerts: [],
            connection: { site: "branch", connected: true },
          },
        },
      });
    if (path === "/api/unifi/ssids")
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              _id: "ssid-1",
              name:
                url.searchParams.get("siteId") === "branch"
                  ? "Branch WiFi"
                  : "Default WiFi",
              ssid:
                url.searchParams.get("siteId") === "branch"
                  ? "Branch WiFi"
                  : "Default WiFi",
              enabled: true,
              security: "wpapsk",
            },
          ],
        },
      });
    if (path === "/api/unifi/resources") {
      if (route.request().method() === "POST")
        return route.fulfill({
          json: { success: true, status: "verified", auditId: "ssid-audit" },
        });
      return route.fulfill({
        json: {
          success: true,
          data:
            url.searchParams.get("resource") === "ssids"
              ? [
                  {
                    _id: "ssid-1",
                    name: "Branch WiFi",
                    security: "wpapsk",
                    enabled: true,
                    ap_group_ids: ["group-a", "group-b"],
                  },
                ]
              : [],
          capability: { state: "available", write: "unverified" },
        },
      });
    }
    if (path === "/api/mikrotik/resources") {
      if (route.request().method() === "POST")
        return route.fulfill({
          json: { success: true, status: "verified", auditId: "audit-test" },
        });
      const resource = url.searchParams.get("resource");
      if (resource === "wireguard")
        return route.fulfill({
          json: {
            success: true,
            data: null,
            capability: {
              state: "unsupported",
              reason: "Router này chưa có WireGuard.",
            },
          },
        });
      if (resource === "pools")
        return route.fulfill({
          json: {
            success: true,
            data: [{ ".id": "*pool", name: "pool-main" }],
            capability: { state: "available" },
          },
        });
      const router = url.searchParams.get("connectionId");
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              ".id": "*1",
              name: router === "router-b" ? "ether-kho" : "ether-vanphong",
              address: "10.0.0.1/24",
              interface: "ether1",
              disabled: false,
            },
          ],
          capability: {
            state: "available",
            write: "unverified",
            reason: "Đã đọc từ thiết bị.",
          },
        },
      });
    }
    if (path.endsWith("/topology/traffic"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            nodes: {},
            links: {},
            sampledAt: new Date().toISOString(),
            source: "MikroTik",
          },
        },
      });
    if (path === "/api/mikrotik/topology")
      return route.fulfill({
        json: {
          success: true,
          data: {
            nodes: [
              { id: "router:local", type: "gateway", name: "Router văn phòng" },
              {
                id: "client:unknown",
                type: "client",
                name: "Máy khách chưa rõ",
                group: "unknown",
              },
            ],
            links: [],
            warnings: [],
            observedAt: "2026-10-21T08:00:00Z",
          },
        },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
}
test("URL router selector scopes reads, resource forms and navigation", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/mikrotik/manage?connectionId=router-a");
  await expect(
    page.getByRole("cell", { name: "ether-vanphong", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Router", exact: true })
    .selectOption("router-b");
  await expect(page).toHaveURL(/connectionId=router-b/);
  await expect(
    page.getByRole("cell", { name: "ether-kho", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Địa chỉ IP", exact: true }).click();
  await page.getByRole("button", { name: "Tạo mới", exact: true }).click();
  await page.getByLabel("Địa chỉ / tiền tố").fill("10.20.0.1/24");
  await page
    .getByLabel("Cổng mạng", { exact: false })
    .selectOption("ether-kho");
  await page
    .getByRole("button", { name: "Xem lại yêu cầu", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("10.20.0.1/24");
  const requestPromise = page.waitForRequest(
    (r) => r.url().includes("/api/mikrotik/resources") && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Xác nhận và áp dụng", exact: true })
    .click();
  const request = await requestPromise;
  expect(new URL(request.url()).searchParams.get("connectionId")).toBe(
    "router-b",
  );
  expect(request.postDataJSON()).toMatchObject({
    confirmed: true,
    resource: "addresses",
    operation: "create",
    fields: { address: "10.20.0.1/24", interface: "ether-kho" },
  });
  await expect(page.getByRole("status")).toContainText("audit-test");
  await page
    .getByRole("link", { name: "Sơ đồ mạng", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/topology\?.*connectionId=router-b/);
});
test("empty connections finish loading and offer configuration", async ({
  page,
}) => {
  await setup(page, "ADMIN", true);
  await page.goto("/admin/mikrotik/manage");
  await expect(
    page.getByText("Chưa có kết nối mạng được cấu hình."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Thêm kết nối mạng" }),
  ).toHaveAttribute("href", "/admin/settings/connections");
  await expect(page.getByText("Đang tải kết nối mạng…")).toHaveCount(0);
});
test("unsupported resource shows its reason and disables mutations", async ({
  page,
}) => {
  await setup(page);
  await page.goto(
    "/admin/mikrotik/manage?connectionId=router-a&resource=wireguard",
  );
  await expect(page.getByText("Router này chưa có WireGuard.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo mới", exact: true }),
  ).toBeDisabled();
});
test("viewer can browse topology but cannot submit forms or open advanced APIs", async ({
  page,
}) => {
  await setup(page, "VIEWER");
  await page.goto(
    "/admin/mikrotik/manage?connectionId=router-a&resource=addresses",
  );
  await expect(
    page.getByRole("button", { name: "Tạo mới", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Tài khoản Giám sát chỉ có quyền xem.", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Công cụ mạng" })
      .getByRole("link", { name: "API nâng cao" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Sơ đồ mạng", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Máy khách chưa rõ", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ẩn máy khách" }).click();
  await expect(
    page.getByText("Máy khách chưa rõ", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Hiện máy khách" }).click();
  await expect(
    page.getByText("Máy khách chưa rõ", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".tmp/network-upgrade/network-topology.png",
    fullPage: true,
  });
});

test("legacy overview and sidebar links keep the nondefault router for reads and writes", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/mikrotik?connectionId=router-b");
  await expect(
    page.getByRole("link", { name: "Quản lý interfaces", exact: true }),
  ).toHaveAttribute("href", "/admin/mikrotik/interfaces?connectionId=router-b");
  await page
    .getByRole("link", { name: "Quản lý interfaces", exact: true })
    .click();
  await expect(page).toHaveURL(/interfaces\?connectionId=router-b/);
  await expect(
    page.getByRole("cell", { name: "ether-kho", exact: true }),
  ).toBeVisible();
  const mutation = page.waitForRequest(
    (r) =>
      r.url().includes("/api/mikrotik/interfaces") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  expect(new URL((await mutation).url()).searchParams.get("connectionId")).toBe(
    "router-b",
  );
  const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });
  const overview = sidebar.locator(
    'a[href="/admin/mikrotik?connectionId=router-b"]',
  );
  await expect(overview).toHaveCount(1);
  await overview.click();
  await expect(page).toHaveURL(/mikrotik\?connectionId=router-b/);
});
test("legacy UniFi overview links keep controller and selected site", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/unifi?connectionId=router-b&siteId=branch");
  const link = page.getByRole("link", { name: "Quản lý SSID", exact: true });
  await expect(link).toHaveAttribute(
    "href",
    "/admin/unifi/ssids?connectionId=router-b&siteId=branch",
  );
  const read = page.waitForRequest((r) => r.url().includes("/api/unifi/ssids"));
  await link.click();
  const url = new URL((await read).url());
  expect(url.searchParams.get("connectionId")).toBe("router-b");
  expect(url.searchParams.get("siteId")).toBe("branch");
  await expect(page).toHaveURL(/ssids\?connectionId=router-b&siteId=branch/);
  await expect(
    page.getByText("Branch WiFi", { exact: true }).first(),
  ).toBeVisible();
});
test("editing an existing SSID keeps AP groups arrays and parses changed list fields", async ({
  page,
}) => {
  await setup(page);
  await page.goto(
    "/admin/unifi/manage?connectionId=router-b&siteId=branch&resource=ssids",
  );
  await page
    .getByRole("button", { name: "Sửa Branch WiFi", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên", { exact: false }).first().fill("Renamed WiFi");
  await page
    .getByRole("button", { name: "Xem lại yêu cầu", exact: true })
    .click();
  const mutation = page.waitForRequest(
    (r) => r.url().includes("/api/unifi/resources") && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Xác nhận và áp dụng", exact: true })
    .click();
  expect((await mutation).postDataJSON()).toMatchObject({
    fields: { name: "Renamed WiFi", ap_group_ids: ["group-a", "group-b"] },
  });
  await expect(page.getByRole("status")).toContainText("ssid-audit");
  await page
    .getByRole("button", { name: "Sửa Branch WiFi", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Mã nhóm AP" })
    .fill("group-c, group-d\ngroup-e");
  await page
    .getByRole("button", { name: "Xem lại yêu cầu", exact: true })
    .click();
  const changed = page.waitForRequest(
    (r) => r.url().includes("/api/unifi/resources") && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Xác nhận và áp dụng", exact: true })
    .click();
  expect((await changed).postDataJSON()).toMatchObject({
    fields: { ap_group_ids: ["group-c", "group-d", "group-e"] },
  });
});

test("connection failures are not reported as missing configuration and can be retried", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/network/connections?**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "Không tải được kết nối từ máy chủ." },
    }),
  );
  await page.goto("/admin/unifi");
  await expect(page.locator("#admin-main").getByRole("alert")).toContainText(
    "Không tải được kết nối",
  );
  await expect(
    page.getByText("Chưa có kết nối mạng được cấu hình."),
  ).toHaveCount(0);
  await page.unroute("**/api/network/connections?**");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Controller", exact: true }),
  ).toHaveValue("router-a");
  await expect(page.locator("#admin-main").getByRole("alert")).toHaveCount(0);
});

test.describe("Topology visual QA", () => {
  test("topology shows measured traffic, caps clusters and respects reduced motion", async ({
    page,
  }) => {
    await setup(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const stamp = new Date().toISOString();
    const traffic = {
      downloadBytes: 1240000000,
      uploadBytes: 86400000,
      downloadBps: 12300000,
      uploadBps: 800000,
      source: "UniFi stat/sta",
      sampledAt: stamp,
    };
    const clients = Array.from({ length: 35 }, (_, i) => ({
      id: `client:${i}`,
      type: "client",
      name: `Laptop-${i}`,
      mac: `aa:bb:cc:dd:ee:${i.toString(16).padStart(2, "0")}`,
      ip: `10.0.0.${i + 10}`,
      status: "observed",
      meta: { ssid: "Office", signal: -58, osName: i === 0 ? "iOS" : "Windows 11" },
      traffic,
    }));
    await page.route("**/api/unifi/topology?**", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            nodes: [
              { id: "ap", type: "ap", name: "AP Office", status: "online" },
              ...clients,
            ],
            links: clients.map((c) => ({
              id: `ap-${c.id}`,
              source: "ap",
              target: c.id,
              type: "wireless",
              layer: "physical",
              evidence: "client.ap_mac",
              observedAt: stamp,
            })),
            observedAt: stamp,
            warnings: [],
          },
        },
      }),
    );
    await page.route("**/api/unifi/topology/traffic?**", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            nodes: Object.fromEntries(clients.map((c) => [c.id, traffic])),
            links: Object.fromEntries(
              clients.map((c) => [`ap-${c.id}`, traffic]),
            ),
            sampledAt: stamp,
            source: "UniFi",
          },
        },
      }),
    );
    let contextReads = 0;
    await page.route("**/api/network/client-context?**", (route) => {
      contextReads++;
      return route.fulfill({
        json: {
          success: true,
          data: {
            mac: "aa:bb:cc:dd:ee:00",
            sampledAt: stamp,
            attendance: [
              {
                id: "registration-a",
                displayName: "Nguyễn An",
                status: "PRESENT",
                session: { id: "meeting-a", name: "Họp giao ban" },
              },
            ],
            hotspot: {
              status: "available",
              sources: [
                {
                  connectionId: "router-b",
                  name: "Router kho",
                  source: "MikroTik Hotspot Active",
                  sampledAt: stamp,
                  quality: "fresh",
                  sessions: [
                    {
                      id: "hs-a",
                      user: "an",
                      ip: "10.0.0.10",
                      uptime: "1h12m",
                      traffic: {
                        ...traffic,
                        downloadBytes: 620000000,
                        uploadBytes: 43200000,
                        source: "MikroTik Hotspot Active",
                        reason: "first-sample",
                        downloadBps: null,
                        uploadBps: null,
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      });
    });
    await page.goto(
      "/admin/unifi/topology?connectionId=router-a&siteId=default&view=network",
    );
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    const apIcon = page.getByRole("img", { name: "UniFi AP", exact: true });
    await expect(apIcon).toHaveAttribute("src", "/device-icons/unifi-ap.png");
    await expect.poll(() => apIcon.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.screenshot({
        path: `.tmp/network-upgrade/topology-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page
      .locator(".react-flow__node")
      .filter({ hasText: "Khách · AP Office" })
      .click();
    // React Flow mounts only nodes visible in the viewport. Pure layout tests assert the exact cap.
    await expect
      .poll(() => page.locator(".react-flow__node").count())
      .toBeGreaterThan(2);
    expect(await page.locator(".react-flow__node").count()).toBeLessThanOrEqual(
      32,
    );
    await expect(
      page.getByRole("img", {
        name: "Lưu lượng trực tiếp: không có hạt đang chạy",
      }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Liên quan", exact: true }).click();
    await expect(
      page.getByText("35 máy khách · sắp theo lưu lượng"),
    ).toBeVisible();
    const laptopIcon = page.getByRole("complementary", { name: "Chi tiết quan sát" }).getByRole("img", { name: "Máy tính / laptop", exact: true }).first();
    await expect(laptopIcon).toHaveAttribute("src", "/device-icons/laptop.png");
    await expect.poll(() => laptopIcon.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Laptop-0", exact: false })
      .last()
      .click();
    const drawer = page.getByRole("complementary", {
      name: "Chi tiết quan sát",
    });
    const phoneIcon = drawer.getByRole("img", { name: "Điện thoại", exact: true }).first();
    await expect(phoneIcon).toHaveAttribute("src", "/device-icons/phone.png");
    await expect.poll(() => phoneIcon.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(drawer).toContainText("1.24 GB");
    await expect(drawer).toContainText("12.3 Mbps");
    await page.screenshot({ path: ".tmp/device-icons-deploy/device-icons.png", fullPage: true });
    await expect(drawer.getByText("Dữ liệu gốc · quản trị viên")).toBeVisible();
    await page.getByRole("tab", { name: "Kết nối", exact: true }).click();
    await expect(drawer).toContainText("Office");
    await expect(drawer).toContainText("−58 dBm".replace("−", "-"));
    expect(contextReads).toBe(0);
    // A LAN HTTP console has no secure Clipboard API; the browser copy fallback still works.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      }),
    );
    await page.getByRole("tab", { name: "Tổng quan", exact: true }).click();
    const copyMac = drawer.getByRole("button", {
      name: "Sao chép MAC",
      exact: true,
    });
    await copyMac.click();
    await expect(copyMac).toHaveAttribute("title", "Đã sao chép");
    await page.getByRole("tab", { name: "Liên quan", exact: true }).click();
    await expect(
      drawer.getByRole("link", { name: "Họp giao ban →" }),
    ).toHaveAttribute("href", "/admin/attendance/meeting-a");
    await expect(drawer).toContainText("Nguyễn An");
    await expect(drawer).toContainText("Có mặt");
    await expect(drawer).toContainText("620.00 MB");
    await expect(drawer).toContainText("1.24 GB");
    await expect(drawer).toContainText("MikroTik Hotspot Active");
    await expect(drawer).toContainText("Chỉ đối chiếu bộ đếm phiên");
    await expect(drawer).not.toContainText("Đang đo tốc độ…");
    expect(contextReads).toBe(1);
    await page.getByRole("button", { name: "Bỏ lựa chọn" }).click();
    await expect(drawer).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(
      page.getByRole("img", {
        name: /Lưu lượng trực tiếp: \d+ liên kết, \d+ hạt/,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Tạm dừng hiệu ứng", exact: true })
      .click();
    await expect(
      page.getByRole("img", {
        name: "Lưu lượng trực tiếp: không có hạt đang chạy",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Chạy hiệu ứng", exact: true })
      .click();
    await expect(
      page.getByRole("img", {
        name: /Lưu lượng trực tiếp: \d+ liên kết, \d+ hạt/,
      }),
    ).toBeVisible();
  });
});

for (const height of [768, 900, 1100]) {
  test(`UniFi cyclic uplinks remain visible on a ${height}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height });
    await setup(page);
    const stamp = new Date().toISOString();
    const graph = {
      observedAt: stamp, warnings: [],
      nodes: [
        ...Array.from({ length: 37 }, (_, i) => ({ id: `ap:${i}`, type: "ap", name: `AP ${i}`, status: "online" })),
        { id: "client:phone", type: "client", name: "Phone", status: "observed", meta: { osName: "iOS" } },
      ],
      links: [["ap:0", "ap:1"], ["ap:1", "ap:0"], ["ap:1", "client:phone"]].map(([source, target]) => ({ id: `${source}-${target}`, source, target, type: "uplink", layer: "physical", evidence: "fixture", observedAt: stamp })),
    };
    await page.route("**/api/unifi/topology?**", route => route.fulfill({ json: { success: true, data: graph } }));
    await page.goto("/admin/unifi/topology?connectionId=router-a&siteId=default&view=network");
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(5);
    const allVisible = () => page.evaluate(() => {
      const canvas = document.querySelector(".react-flow")!.getBoundingClientRect();
      return Array.from(document.querySelectorAll(".react-flow__node")).every(node => {
        const rect = node.getBoundingClientRect();
        return rect.width >= 40 && rect.top >= canvas.top - 2 && rect.bottom <= canvas.bottom + 2 && rect.left >= canvas.left - 2 && rect.right <= canvas.right + 2;
      });
    });
    await expect.poll(allVisible).toBe(true);
    await page.getByRole("button", { name: "Vừa khung", exact: true }).click();
    await expect.poll(allVisible).toBe(true);
    await page.screenshot({ path: `.tmp/topology-debug/regression-${height}.png`, fullPage: true });
    await page.locator('.react-flow__node[data-id="branch:unmapped"]').click();
    const drawer = page.getByRole("complementary", {name: "Chi tiết quan sát"});
    await expect(drawer).toContainText("35 AP · sắp theo lưu lượng");
    await expect(page.locator('.react-flow__node[data-id^="ap:"]')).toHaveCount(37);
  });
}

test("topology centers each parent over its branches and keeps zoom on traffic polls", async ({ page }) => {
  await setup(page);
  const stamp = new Date().toISOString();
  const nodes = [
    {id:"gw",type:"gateway",name:"Gateway",status:"online"},
    {id:"sw-a",type:"switch",name:"Switch A",status:"online"},
    {id:"sw-b",type:"switch",name:"Switch B",status:"online"},
    {id:"ap-a",type:"ap",name:"AP A",status:"online"},
    {id:"ap-b",type:"ap",name:"AP B",status:"online"},
    {id:"phone",type:"client",name:"Phone",meta:{osName:"iOS"}},
    {id:"pc",type:"client",name:"Laptop",meta:{osName:"Windows 11"}},
  ];
  const links = [["gw","sw-a"],["gw","sw-b"],["sw-a","ap-a"],["sw-b","ap-b"],["ap-a","phone"],["ap-b","pc"]]
    .map(([source,target]) => ({id:`${source}-${target}`,source,target,type:"uplink",layer:"physical",evidence:"fixture",observedAt:stamp}));
  await page.route("**/api/unifi/topology?**", route => route.fulfill({json:{success:true,data:{nodes,links,observedAt:stamp,warnings:[]}}}));
  await page.goto("/admin/unifi/topology?connectionId=router-a&siteId=default&view=network");
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await expect.poll(() => page.evaluate(() => {
    const center = (id: string) => { const r = document.querySelector(`.react-flow__node[data-id="${id}"]`)!.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y}; };
    const root=center("gw"),left=center("sw-a"),right=center("sw-b"),ap=center("ap-a"),clients=center("cluster:ap-a");
    return Math.abs(root.x-(left.x+right.x)/2)<2 && root.y<left.y && left.y<ap.y && ap.y<clients.y;
  })).toBe(true);
  await page.screenshot({path:".tmp/topology-debug/tree-branching.png",fullPage:true});
  const viewport = page.locator(".react-flow__viewport");
  const before = await viewport.getAttribute("style");
  await page.locator(".react-flow__controls-zoomin").click();
  await expect(viewport).not.toHaveAttribute("style", before!);
  const zoomed = await viewport.getAttribute("style");
  await page.waitForResponse(response => response.url().includes("/api/unifi/topology/traffic"));
  await expect(viewport).toHaveAttribute("style", zoomed!);
});
