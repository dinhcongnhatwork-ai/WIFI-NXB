import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      "token",
      `test.${btoa(JSON.stringify({ id: "ap-viewer", username: "viewer", role: "VIEWER", exp: 4102444800 }))}.test`,
    ),
  );
  const at = new Date().toISOString();
  const sample = {
    downloadBytes: 1240000000,
    uploadBytes: 86400000,
    downloadBps: 12300000,
    uploadBps: 800000,
    source: "UniFi · stat/sta",
    sampledAt: at,
    perspective: "user",
  };
  const nodes = [
    {
      id: "ap-a",
      type: "ap",
      name: "AP Tầng 1",
      ip: "10.0.0.2",
      mac: "aa:aa:aa:aa:aa:01",
      status: "online",
      meta: { model: "U6 Lite", cpuUsage: 15, memUsage: 34 },
    },
    {
      id: "ap-b",
      type: "ap",
      name: "AP Tầng 2",
      ip: "10.0.0.3",
      mac: "aa:aa:aa:aa:aa:02",
      status: "online",
      meta: { model: "U6 Pro" },
    },
    {
      id: "phone",
      type: "client",
      name: "Điện thoại An",
      ip: "10.0.0.10",
      mac: "bb:bb:bb:bb:bb:01",
      status: "observed",
      traffic: sample,
      meta: {
        hostname: "iPhone-cua-An",
        osName: "iOS",
        vendor: "Apple",
        ssid: "Office",
        apName: "AP Tầng 1",
        apMac: "aa:aa:aa:aa:aa:01",
        signal: -52,
        noise: -95,
        radio: "na",
        channel: 36,
        protocol: "ax",
        uptime: 3660,
        authorized: true,
        lastSeen: Date.now() / 1000,
      },
    },
    {
      id: "pc",
      type: "client",
      name: "Laptop Bình",
      ip: "10.0.0.11",
      mac: "bb:bb:bb:bb:bb:02",
      status: "observed",
      traffic: sample,
      meta: {
        hostname: "DESKTOP-BINH",
        osName: "Windows 11",
        vendor: "Dell",
        ssid: "Office",
        apName: "AP Tầng 1",
        signal: -61,
        radio: "na",
        channel: 36,
        uptime: 7200,
      },
    },
    {
      id: "other",
      type: "client",
      name: "Điện thoại Chi",
      ip: "10.0.0.12",
      mac: "bb:bb:bb:bb:bb:03",
      status: "observed",
      traffic: sample,
      meta: {
        hostname: "Android-Chi",
        osName: "Android",
        ssid: "Office",
        apName: "AP Tầng 2",
        signal: -58,
      },
    },
  ];
  const links = [
    ["ap-a", "phone"],
    ["ap-a", "pc"],
    ["ap-b", "other"],
  ].map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "wireless",
    layer: "physical",
    evidence: "client.ap_mac",
    observedAt: at,
    traffic: sample,
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === "/api/auth/me"
        ? { id: "ap-viewer", username: "viewer", role: "VIEWER" }
        : path === "/api/network/connections"
          ? [
              {
                id: "controller",
                name: "UniFi",
                isDefault: true,
                config: { site: "default" },
              },
            ]
          : path === "/api/unifi/info"
            ? [{ name: "default", desc: "Office" }]
            : path === "/api/unifi/topology"
              ? { nodes, links, observedAt: at, warnings: [] }
              : path === "/api/unifi/topology/traffic"
                ? {
                    nodes: Object.fromEntries(
                      nodes.map((node) => [node.id, sample]),
                    ),
                    links: Object.fromEntries(
                      links.map((link) => [link.id, sample]),
                    ),
                    source: "UniFi",
                    sampledAt: at,
                  }
                : [];
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto(
    "/admin/unifi/topology?connectionId=controller&siteId=default",
  );
  await expect(page.getByRole("combobox", { name: "Chọn AP" })).toHaveValue(
    "ap-a",
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
}
test("AP view shows named clients directly, readable cards and measured bidirectional traffic", async ({
  page,
}) => {
  await setup(page);
  const phone = page.locator('.react-flow__node[data-id="phone"]');
  await expect(phone).toContainText("Điện thoại An");
  await expect(phone).toContainText("10.0.0.10");
  await expect(phone).toContainText("AP: AP Tầng 1");
  await expect(phone).toContainText("12.3 Mbps");
  await expect(phone).toContainText("800.0 Kbps");
  await expect(
    phone.getByRole("img", { name: "Điện thoại", exact: true }),
  ).toHaveAttribute("src", "/device-icons/phone.png");
  await expect(
    page
      .locator('.react-flow__node[data-id="pc"]')
      .getByRole("img", { name: "Máy tính / laptop" }),
  ).toHaveAttribute("src", "/device-icons/laptop.png");
  await expect
    .poll(async () => (await phone.boundingBox())?.width || 0)
    .toBeGreaterThan(200);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge marker")).toHaveCount(4);
  await expect(page.locator('.react-flow__node[data-id="other"]')).toHaveCount(
    0,
  );
  await page.screenshot({
    path: ".tmp/topology-rich/ap-workspace.png",
    fullPage: true,
  });
  await phone.click();
  const drawer = page.getByRole("complementary", { name: "Chi tiết quan sát" });
  await expect(drawer).toContainText("iPhone-cua-An");
  await expect(drawer).toContainText("Apple");
  await expect(drawer).toContainText("AP Tầng 1");
  await expect(drawer).toContainText("1 giờ 1 phút");
  await page.getByRole("tab", { name: "Kết nối", exact: true }).click();
  await expect(drawer).toContainText("-52 dBm");
  await expect(drawer).toContainText("43 dB");
  await expect(drawer).toContainText("ax");
});
test("AP selection and detailed table preserve actual association even when SSIDs match", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("combobox", { name: "Chọn AP" }).selectOption("ap-b");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(
    page.locator('.react-flow__node[data-id="other"]'),
  ).toContainText("Điện thoại Chi");
  await expect(page.locator('.react-flow__node[data-id="phone"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /Danh sách thông số/ }).click();
  await expect(page.getByRole("table")).toContainText("Điện thoại Chi");
  await expect(page.getByRole("table")).toContainText("AP Tầng 2");
  await expect(page.getByRole("table")).not.toContainText("Điện thoại An");
  await page
    .getByRole("textbox", { name: "Tìm thiết bị của AP" })
    .fill("10.0.0.12");
  await expect(page.getByRole("table")).toContainText("Điện thoại Chi");
  await page
    .getByRole("textbox", { name: "Tìm thiết bị của AP" })
    .fill("missing");
  await expect(
    page.getByText("Không có thiết bị khớp tìm kiếm."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Tìm thiết bị của AP" }).fill("");
  await page.getByRole("checkbox", { name: "Tất cả AP trong site" }).check();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("table")).toContainText("Điện thoại An");
  await expect(page.getByRole("table")).toContainText("AP Tầng 1");
  await expect(page.getByRole("table")).toContainText("AP Tầng 2");
});
test("fullscreen works and retains selected AP on exit", async ({ page }) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Toàn màn hình", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Thoát toàn màn hình", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await page
            .getByRole("region", { name: "Không gian giám sát kết nối AP" })
            .boundingBox()
        )?.x,
    )
    .toBe(0);
  await page.screenshot({
    path: ".tmp/topology-rich/ap-fullscreen.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Thoát toàn màn hình", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Toàn màn hình", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Chọn AP" })).toHaveValue(
    "ap-a",
  );
});
test("fullscreen fallback closes with Escape and restores focus", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      value: undefined,
      configurable: true,
    }),
  );
  await setup(page);
  const button = page.getByRole("button", {
    name: "Toàn màn hình",
    exact: true,
  });
  await button.click();
  await expect(
    page.getByRole("button", { name: "Thoát toàn màn hình", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeVisible();
  await expect(button).toBeFocused();
});
test("traffic refresh preserves zoom instead of shrinking named clients", async ({
  page,
}) => {
  await setup(page);
  const viewport = page.locator(".react-flow__viewport");
  const initial = await viewport.getAttribute("style");
  await page.locator(".react-flow__controls-zoomin").click();
  await expect(viewport).not.toHaveAttribute("style", initial!);
  const zoomed = await viewport.getAttribute("style");
  await page.waitForResponse((response) =>
    response.url().includes("/topology/traffic"),
  );
  await expect(viewport).toHaveAttribute("style", zoomed!);
});

test("retained traffic stops animating after 30 seconds when both data feeds fail", async ({
  page,
}) => {
  await page.clock.install({ time: new Date() });
  await setup(page);
  const overlay = page.locator('canvas[aria-label^="Lưu lượng trực tiếp"]');
  await expect(overlay).toHaveAttribute("aria-label", /2 liên kết/);
  await page.route("**/api/unifi/topology**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "Controller unavailable" },
    }),
  );
  await page.clock.fastForward(35000);
  await expect(overlay).toHaveAttribute(
    "aria-label",
    "Lưu lượng trực tiếp: không có hạt đang chạy",
  );
  await expect(
    page.locator('.react-flow__node[data-id="phone"]'),
  ).toContainText("12.3 Mbps");
});
