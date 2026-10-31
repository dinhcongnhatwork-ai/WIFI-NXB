import { test, expect } from "@playwright/test";

async function authenticate(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "token",
      `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, role: "VIEWER" }))}.test`,
    );
    localStorage.setItem("username", "viewer");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { id: "test", username: "viewer", role: "VIEWER" },
        user: { id: "test", username: "viewer", role: "VIEWER" },
      },
    }),
  );
}

function batchFixture(url: URL, targetId: string, stale = false) {
  const points = [
    { at: Date.now() - 120000, value: 38 },
    { at: Date.now() - 90000, value: 40 },
    { at: Date.now() - 60000, value: null },
    { at: Date.now() - 30000, value: 44 },
  ];
  return {
    success: true,
    data: (url.searchParams.get("metrics") || "cpu.percent,memory.percent")
      .split(",")
      .map((metric) => ({
        targetId,
        metric,
        success: !stale,
        quality: stale ? "stale" : "fresh",
        error: stale ? "Zabbix HTTP 503" : undefined,
        cachedAt: new Date().toISOString(),
        data: {
          name: "Server A",
          metric,
          points,
          quality: stale ? "stale" : "fresh",
          lastAt: points.at(-1)!.at,
          aggregation: "mẫu gốc",
        },
      })),
  };
}

test("alerts retain old active problems alongside recent resolved history and deduplicate current state", async ({
  page,
}) => {
  await authenticate(page);
  const now = Math.floor(Date.now() / 1000);
  await page.route("**/api/monitor/**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/events"))
      return route.fulfill({
        json: {
          success: true,
          quality: "fresh",
          data: {
            problems: [
              {
                eventid: "100",
                name: "Old active outage",
                clock: String(now - 172800),
                severity: "4",
                r_eventid: "0",
                acknowledged: "1",
              },
              {
                eventid: "200",
                name: "Current duplicate",
                clock: String(now - 100),
                severity: "3",
                r_eventid: "0",
                acknowledged: "1",
              },
            ],
            history: [
              {
                eventid: "200",
                name: "Current duplicate",
                clock: String(now - 100),
                severity: "3",
                r_eventid: "999",
                acknowledged: "0",
              },
              {
                eventid: "300",
                name: "Recent resolved outage",
                clock: String(now - 60),
                severity: "2",
                r_eventid: "301",
                acknowledged: "0",
              },
            ],
          },
        },
      });
    return route.fulfill({
      json: {
        success: true,
        data: {
          targets: [],
          collector: { quality: "fresh" },
          zabbix: { configured: true },
        },
      },
    });
  });
  await page.goto("/admin/monitor?tab=alerts&time=1h");
  await expect(
    page.getByText("Old active outage", { exact: true }),
  ).toBeVisible();
  const old = page
    .getByText("Old active outage", { exact: true })
    .locator("..");
  await expect(old).toContainText("Đang diễn ra");
  await expect(old).toContainText("Đã xác nhận");
  await expect(
    page.getByText("Current duplicate", { exact: true }),
  ).toHaveCount(1);
  const duplicate = page
    .getByText("Current duplicate", { exact: true })
    .locator("..");
  await expect(duplicate).toContainText("Đang diễn ra");
  await expect(duplicate).toContainText("Đã xác nhận");
  await expect(
    page.getByText("Recent resolved outage", { exact: true }).locator(".."),
  ).toContainText("Đã phục hồi");
});

test("polls current charts alerts and logs every thirty seconds and retains stale content on failure", async ({
  page,
}) => {
  await authenticate(page);
  await page.clock.install();
  const counts = { metrics: 0, events: 0, logs: 0 };
  let failing = false;
  const target = {
    id: "host",
    key: "external.host",
    name: "Server A",
    kind: "host",
    status: "online",
    quality: "fresh",
    metadata: {},
  };
  await page.route("**/api/monitor/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/overview"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            targets: [target],
            collector: { quality: "fresh" },
            zabbix: { configured: true },
          },
        },
      });
    if (path.endsWith("/metrics/batch")) {
      counts.metrics++;
      return route.fulfill({
        status: failing ? 503 : 200,
        json: failing
          ? { error: "Polling interrupted" }
          : batchFixture(new URL(route.request().url()), "host"),
      });
    }
    if (path.endsWith("/events")) {
      counts.events++;
      return route.fulfill({
        status: failing ? 503 : 200,
        json: failing
          ? { error: "Polling interrupted" }
          : {
              success: true,
              quality: "fresh",
              data: {
                problems: [
                  {
                    eventid: "100",
                    name: "Active polling alert",
                    clock: "1000",
                    r_eventid: "0",
                    acknowledged: "0",
                  },
                ],
                history: [],
              },
            },
      });
    }
    if (path.endsWith("/logs")) {
      counts.logs++;
      return route.fulfill({
        status: failing ? 503 : 200,
        json: failing
          ? { error: "Polling interrupted" }
          : {
              success: true,
              data: [
                {
                  id: "log",
                  occurredAt: new Date().toISOString(),
                  source: "syslog",
                  severity: "info",
                  message: "Retained polling log",
                },
              ],
              nextCursor: null,
            },
      });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto("/admin/monitor");
  await expect(
    page
      .getByRole("img", { name: "Biểu đồ lịch sử CPU (%)" })
      .locator("canvas"),
  ).toBeVisible();
  const initial = counts.metrics;
  failing = true;
  await page.clock.fastForward(30000);
  await expect.poll(() => counts.metrics).toBeGreaterThan(initial);
  await expect(
    page.getByRole("img", { name: "Biểu đồ lịch sử CPU (%)" }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Nguồn tạm ngừng. Đang hiển thị lịch sử đã lưu", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Cảnh báo", exact: true }).click();
  await expect(
    page.getByText("Active polling alert", { exact: true }),
  ).toBeVisible();
  const alerts = counts.events;
  failing = true;
  await page.clock.fastForward(30000);
  await expect.poll(() => counts.events).toBeGreaterThan(alerts);
  await expect(
    page.getByText("Active polling alert", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Polling interrupted. Cảnh báo đã lưu có thể đã cũ."),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Nhật ký", exact: true }).click();
  await expect(
    page.getByText("Retained polling log", { exact: true }),
  ).toBeVisible();
  const logs = counts.logs;
  failing = true;
  await page.clock.fastForward(30000);
  await expect.poll(() => counts.logs).toBeGreaterThan(logs);
  await expect(
    page.getByText("Retained polling log", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Polling interrupted" }),
  ).toBeVisible();
});

test("does not overlap slow polls or let an obsolete filter response replace current alerts", async ({
  page,
}) => {
  await authenticate(page);
  await page.clock.install();
  let held: import("@playwright/test").Route | undefined,
    oldRequests = 0;
  const response = (name: string) => ({
    success: true,
    quality: "fresh",
    data: {
      problems: [
        {
          eventid: "100",
          name,
          clock: "1000",
          r_eventid: "0",
          acknowledged: "0",
        },
      ],
      history: [],
    },
  });
  await page.route("**/api/monitor/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/events")) {
      if (url.searchParams.get("time") === "1h") {
        oldRequests++;
        held = route;
        return;
      }
      return route.fulfill({ json: response("Current filter alert") });
    }
    return route.fulfill({
      json: {
        success: true,
        data: {
          targets: [],
          collector: { quality: "fresh" },
          zabbix: { configured: true },
        },
      },
    });
  });
  await page.goto("/admin/monitor?tab=alerts&time=1h");
  await expect.poll(() => oldRequests).toBe(1);
  await page.clock.fastForward(90000);
  expect(oldRequests).toBe(1);
  await page.getByLabel("Khoảng thời gian").selectOption("24h");
  await expect(
    page.getByText("Current filter alert", { exact: true }),
  ).toBeVisible();
  const obsolete = page.waitForResponse(
    (response) =>
      response.url().includes("/api/monitor/events?") &&
      response.url().includes("time=1h"),
  );
  await held!.fulfill({ json: response("Obsolete filter alert") });
  await obsolete;
  await expect(
    page.getByText("Current filter alert", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Obsolete filter alert", { exact: true }),
  ).toHaveCount(0);
});

test("monitoring retains stale history, filters logs, and shows missing sources explicitly", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "token",
      `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, role: "VIEWER" }))}.test`,
    );
    localStorage.setItem("username", "viewer");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { id: "test", username: "viewer", role: "VIEWER" },
        user: { id: "test", username: "viewer", role: "VIEWER" },
      },
    }),
  );
  const target = {
    id: "target1",
    key: "router1",
    name: "Router A",
    kind: "router",
    status: "source-unavailable",
    quality: "stale",
    lastSeenAt: new Date(Date.now() - 300000).toISOString(),
    metadata: {
      model: "RouterBoard",
      metrics: { "cpu.percent": 38, "memory.percent": 54 },
      snmp: "unconfigured",
    },
  };
  await page.route("**/api/monitor/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/overview"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            targets: [target],
            collector: { quality: "stale" },
            zabbix: { configured: true, error: { message: "HTTP 503" } },
          },
        },
      });
    if (url.pathname.endsWith("/metrics/batch"))
      return route.fulfill({ json: batchFixture(url, "target1", true) });
    if (url.pathname.endsWith("/logs"))
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "l1",
              occurredAt: new Date().toISOString(),
              source: "syslog",
              severity: "warning",
              message: "Router link down",
            },
          ],
          nextCursor: null,
        },
      });
    if (url.pathname.endsWith("/events"))
      return route.fulfill({
        json: {
          success: false,
          quality: "unavailable",
          error: "Zabbix HTTP 503",
          data: null,
        },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto("/admin/monitor");
  await expect(
    page.getByRole("heading", { name: "Giám sát", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nguồn giám sát đang gián đoạn hoặc thiếu dữ liệu.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Biểu đồ lịch sử CPU (%)" }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Nguồn tạm ngừng. Đang hiển thị lịch sử đã lưu", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("img", { name: "Biểu đồ lịch sử CPU (%)" })
      .locator("canvas"),
  ).toBeVisible();
  await page.screenshot({
    path: ".tmp/network-upgrade/monitor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Thiết bị", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Router A", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tài nguyên", exact: true }).click();
  await expect(
    page.getByText("Nhịp hoạt động dịch vụ điểm danh:"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nhật ký", exact: true }).click();
  await expect(page.getByText("Router link down")).toBeVisible();
  await page.getByLabel("Mức độ nhật ký").selectOption("warning");
  await expect(page).toHaveURL(/severity=warning/);
  await page.getByRole("button", { name: "Cảnh báo", exact: true }).click();
  await expect(
    page.getByText("Zabbix HTTP 503. Cảnh báo đã lưu có thể đã cũ."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận", exact: true }),
  ).toHaveCount(0);
});

test("overview polls at most four endpoints and operator acknowledges through an audited modal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "token",
      `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, role: "OPERATOR" }))}.test`,
    );
    localStorage.setItem("username", "operator");
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { id: "operator", username: "operator", role: "OPERATOR" },
      },
    }),
  );
  const polls: string[] = [];
  let message = "";
  const target = {
    id: "target",
    name: "AP floor 1",
    kind: "ap",
    status: "online",
    quality: "fresh",
    metadata: { provider: "UNIFI", metrics: { "cpu.percent": 15 } },
  };
  await page.route("**/api/monitor/**", async (route) => {
    const url = new URL(route.request().url());
    polls.push(url.pathname);
    if (url.pathname.endsWith("/overview"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            targets: [target],
            collector: { quality: "fresh" },
            zabbix: { configured: true },
            redisAvailable: true,
          },
        },
      });
    if (url.pathname.endsWith("/metrics/batch"))
      return route.fulfill({ json: batchFixture(url, "target") });
    if (url.pathname.endsWith("/events"))
      return route.fulfill({
        json: {
          success: true,
          quality: "fresh",
          data: {
            problems: [
              {
                eventid: "900",
                name: "AP radio unavailable",
                clock: String(Math.floor(Date.now() / 1000)),
                severity: "4",
                acknowledged: "0",
                r_eventid: "0",
              },
            ],
            history: [],
          },
        },
      });
    if (url.pathname.endsWith("/acknowledge")) {
      message = route.request().postDataJSON().message;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({
      json: { success: true, quality: "fresh", data: { buckets: [] } },
    });
  });
  await page.goto("/admin/monitor");
  await expect(
    page
      .getByRole("img", { name: "Biểu đồ lịch sử CPU (%)" })
      .locator("canvas"),
  ).toBeVisible();
  await expect(
    page.getByText("AP radio unavailable", { exact: true }),
  ).toBeVisible();
  expect(
    polls.filter((p) => !p.endsWith("/acknowledge")).length,
  ).toBeLessThanOrEqual(4);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Xác nhận cảnh báo" }),
  ).toBeVisible();
  await page
    .getByLabel("Ghi chú", { exact: true })
    .fill("Đang kiểm tra radio tại tầng 1");
  await page.getByRole("button", { name: "Lưu xác nhận", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(message).toBe("Đang kiểm tra radio tại tầng 1");
});

test("custom monitoring interval validates locally and forwards explicit bounds to all history endpoints", async ({
  page,
}) => {
  await authenticate(page);
  const requests: URL[] = [];
  const target = {
    id: "target",
    name: "AP range test",
    kind: "ap",
    status: "online",
    quality: "fresh",
    metadata: { provider: "UNIFI", metrics: { "cpu.percent": 15 } },
  };
  await page.route("**/api/monitor/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.pathname.endsWith("/overview"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            targets: [target],
            collector: { quality: "fresh" },
            zabbix: { configured: true },
            redisAvailable: true,
          },
        },
      });
    if (url.pathname.endsWith("/metrics/batch"))
      return route.fulfill({ json: batchFixture(url, "target") });
    if (url.pathname.endsWith("/events"))
      return route.fulfill({
        json: { success: true, data: { problems: [], history: [] } },
      });
    return route.fulfill({ json: { success: true, data: { buckets: [] } } });
  });
  await page.goto("/admin/monitor");
  await page.getByLabel("Khoảng thời gian").selectOption("custom");
  await page.getByRole("button", { name: "Áp dụng khoảng" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Chọn khoảng từ 1 giây đến 30 ngày" }),
  ).toBeVisible();
  const end = new Date(Date.now() - 86400000),
    start = new Date(end.getTime() - 3600000);
  const input = (date: Date) => date.toISOString().slice(0, 16);
  await page.getByLabel("Bắt đầu tùy chọn").fill(input(start));
  await page.getByLabel("Kết thúc tùy chọn").fill(input(end));
  await page.getByRole("button", { name: "Áp dụng khoảng" }).click();
  await expect(page).toHaveURL(/time=custom/);
  await expect
    .poll(
      () =>
        requests.filter(
          (u) =>
            u.searchParams.get("time") === "custom" &&
            u.pathname.endsWith("/metrics/batch"),
        ).length,
    )
    .toBeGreaterThan(0);
  for (const path of ["/metrics/batch", "/events", "/events/histogram"]) {
    await expect
      .poll(() =>
        requests.some(
          (u) =>
            u.pathname.endsWith(path) &&
            u.searchParams.has("from") &&
            u.searchParams.has("to"),
        ),
      )
      .toBe(true);
  }
  await page.getByLabel("Khoảng thời gian").selectOption("6h");
  await expect(page).toHaveURL(/time=6h/);
  expect(new URL(page.url()).searchParams.has("from")).toBe(false);
});
