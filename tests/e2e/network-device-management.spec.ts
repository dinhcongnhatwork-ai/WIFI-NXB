import { test, expect, type Page } from "@playwright/test";

const devices = [
  {
    _id: "ap",
    name: "AP Tầng 1",
    type: "uap",
    status: "online",
    model: "U6 Pro",
    mac: "aa:bb:cc:dd:ee:01",
    ipAddress: "192.168.1.10",
    uptime: 7200,
    userNumSta: 7,
    guestNumSta: 2,
    numSta: 9,
    cpuUsage: 0,
    memUsage: 25,
  },
  {
    _id: "sw",
    name: "Switch Tầng 2",
    type: "usw",
    status: "offline",
    model: "USW-24",
    mac: "aa:bb:cc:dd:ee:02",
    uptime: 0,
    numSta: 0,
  },
];
const connections = [
  {
    id: "c1",
    provider: "MIKROTIK",
    name: "Router Chính",
    baseUrl: "https://192.168.1.1",
    username: "admin",
    isDefault: true,
    status: "online",
    version: "7.20",
    hasCredentials: true,
    config: {
      deviceRole: "router",
      operatingSystem: "routeros",
      model: "CCR2004",
    },
  },
  {
    id: "c2",
    provider: "MIKROTIK",
    name: "Switch Tầng 2",
    baseUrl: "https://192.168.1.2",
    username: "admin",
    isDefault: false,
    status: "error",
    version: null,
    hasCredentials: true,
    config: {
      deviceRole: "access-switch",
      operatingSystem: "routeros",
      model: "CRS328",
      location: "Tầng 2",
    },
  },
];

async function fixtures(page: Page, role = "ADMIN") {
  const writes: any[] = [];
  await page.addInitScript(
    ({ role }) => {
      localStorage.setItem(
        "token",
        `test.${btoa(JSON.stringify({ id: "ui", username: "ui", role, exp: 4102444800 }))}.test`,
      );
      localStorage.setItem("username", "ui");
    },
    { role },
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: { success: true, data: { id: "ui", username: "ui", role } },
      });
    if (path === "/api/network/connections") {
      if (req.method() === "POST") {
        writes.push(req.postDataJSON());
        return route.fulfill({ json: { success: true, data: {} } });
      }
      return route.fulfill({
        json: {
          success: true,
          data:
            new URL(req.url()).searchParams.get("provider") === "UNIFI"
              ? [
                  {
                    id: "unifi",
                    name: "UniFi Controller",
                    provider: "UNIFI",
                    isDefault: true,
                    config: { site: "default" },
                  },
                ]
              : connections,
          encryptionConfigured: true,
        },
      });
    }
    if (path === "/api/unifi/info")
      return route.fulfill({
        json: {
          success: true,
          data: [{ name: "default", desc: "Mạng chính" }],
        },
      });
    if (path === "/api/unifi/devices")
      return route.fulfill({ json: { success: true, data: devices } });
    if (path === "/api/mikrotik/system")
      return route.fulfill({
        json: {
          success: true,
          data: {
            identity: { name: "Router Chính" },
            resource: {
              version: "7.20",
              cpuLoad: 0,
              cpuCount: 4,
              totalMemory: 1073741824,
              freeMemory: 536870912,
            },
            routerboard: { model: "CCR2004" },
            logs: [
              {
                id: "l1",
                time: "10:32:01",
                topics: "system,info",
                message: "RouterOS đã khởi động",
              },
              {
                id: "l2",
                time: "10:33:01",
                topics: "interface,warning",
                message: "ether2 link down",
              },
            ],
          },
        },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return writes;
}

test("UniFi inventory preserves client totals, filters, view and device details", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("/admin/unifi/devices");
  const list = page.getByRole("region", { name: "Danh sách thiết bị UniFi" });
  await expect(list.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByLabel("Thống kê thiết bị UniFi")).toContainText(
    "Máy khách được báo cáo9",
  );
  await page.screenshot({
    path: ".tmp/network-redesign/device-unifi-list.png",
    fullPage: true,
  });
  await page.getByLabel("Lọc trạng thái thiết bị UniFi").selectOption("online");
  await expect(list.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Thẻ thiết bị", { exact: true }).click();
  await expect(list.locator("article")).toHaveCount(1);
  await list.getByRole("button", { name: "Chi tiết →" }).click();
  const detail = page.getByRole("dialog", {
    name: "Chi tiết thiết bị UniFi",
    exact: true,
  });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Tải CPU0%");
  await expect(detail).not.toContainText("AABBCCDDEE01");
  await expect(
    detail.getByRole("button", { name: "Nháy đèn định vị" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".tmp/network-redesign/device-unifi-details.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
});

test("connection filters and blank edited credentials preserve save contract", async ({
  page,
}) => {
  const writes = await fixtures(page);
  await page.goto("/admin/settings/connections");
  const list = page.getByRole("region", { name: "Danh sách kết nối" });
  await expect(list.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("Lọc trạng thái kết nối").selectOption("other");
  await expect(list.locator("tbody tr")).toHaveCount(1);
  await list
    .getByRole("button", { name: "Sửa Switch Tầng 2", exact: true })
    .click();
  await expect(page.getByLabel("Hệ điều hành")).toHaveValue("routeros");
  await expect(page.getByLabel("Hệ điều hành").locator("option")).toHaveCount(
    1,
  );
  await expect(
    page.getByLabel("Mật khẩu mới (để trống để giữ nguyên)", { exact: true }),
  ).toHaveValue("");
  await page.screenshot({
    path: ".tmp/network-redesign/device-connections-form.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lưu kết nối", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu kết nối");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    id: "c2",
    credentials: {},
    config: {
      operatingSystem: "routeros",
      deviceRole: "access-switch",
      model: "CRS328",
    },
  });
  await page.route("**/api/network/connections/c2/test", (route) =>
    route.fulfill({
      status: 502,
      json: { success: false, error: "RouterOS không phản hồi" },
    }),
  );
  await list.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "RouterOS không phản hồi" }),
  ).toBeVisible();
  await expect(
    list.getByRole("button", { name: "Kiểm tra", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "RouterOS không phản hồi" }),
  ).toBeVisible();
});

test("mobile MikroTik system logs and UniFi viewer details remain usable without write controls", async ({
  page,
}) => {
  await fixtures(page, "VIEWER");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/mikrotik/manage");
  await expect(
    page.getByRole("heading", { name: "Router Chính", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Khởi động lại thiết bị", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Lọc chủ đề nhật ký").selectOption("warning");
  await expect(page.getByLabel("Nhật ký thiết bị")).toContainText(
    "ether2 link down",
  );
  await expect(page.getByLabel("Nhật ký thiết bị")).not.toContainText(
    "RouterOS đã khởi động",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".tmp/network-redesign/device-mikrotik-mobile.png",
    fullPage: true,
  });
  await page.goto("/admin/unifi/devices");
  await page.getByLabel("Chi tiết AP Tầng 1", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Chi tiết thiết bị UniFi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nháy đèn định vị" }),
  ).toHaveCount(0);
  const mobileDialog = page.getByRole("dialog", {
    name: "Chi tiết thiết bị UniFi",
    exact: true,
  });
  await expect
    .poll(async () => Math.round((await mobileDialog.boundingBox())?.x ?? -1))
    .toBe(0);
  const bounds = await mobileDialog.boundingBox();
  expect(bounds?.y).toBe(0);
  expect(bounds?.width).toBe(390);
  await page.screenshot({
    path: ".tmp/network-redesign/device-unifi-mobile.png",
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("UniFi connection errors show the failure and recover on refresh", async ({
  page,
}) => {
  await fixtures(page);
  let unavailable = true;
  await page.route("**/api/unifi/devices**", async (route) =>
    route.fulfill({
      json: unavailable
        ? { success: false, error: "Controller không phản hồi" }
        : { success: true, data: devices },
    }),
  );
  await page.goto("/admin/unifi/devices");
  await expect(
    page.getByRole("alert").filter({ hasText: "Controller không phản hồi" }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa tải được thiết bị", { exact: true }),
  ).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByLabel("Danh sách thiết bị UniFi").locator("tbody tr"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("alert").filter({ hasText: "Controller không phản hồi" }),
  ).toHaveCount(0);
});
