import { expect, test } from "@playwright/test";

test("time-series crosshairs synchronize after asynchronous history arrives", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "token",
      `test.${btoa(JSON.stringify({ id: "sync", username: "viewer", role: "VIEWER", exp: 4102444800 }))}.test`,
    ),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { id: "sync", username: "viewer", role: "VIEWER" },
      },
    }),
  );
  const now = Date.now();
  await page.route("**/api/monitor/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/overview"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            targets: [
              {
                id: "host",
                key: "test.host",
                name: "Chart fixture",
                kind: "host",
                status: "online",
                quality: "fresh",
                metadata: {},
              },
            ],
            collector: { quality: "fresh" },
            zabbix: { configured: true },
            redisAvailable: true,
          },
        },
      });
    if (url.pathname.endsWith("/metrics/batch"))
      return route.fulfill({
        json: {
          success: true,
          data: (url.searchParams.get("metrics") || "")
            .split(",")
            .map((metric) => ({
              targetId: "host",
              metric,
              success: true,
              quality: "fresh",
              data: {
                targetId: "host",
                name: "Chart fixture",
                metric,
                quality: "fresh",
                aggregation: "mẫu gốc",
                lastAt: now,
                points: [
                  { at: now - 120000, value: 20 },
                  { at: now - 60000, value: 35 },
                  { at: now, value: 28 },
                ],
              },
            })),
        },
      });
    if (url.pathname.endsWith("/events"))
      return route.fulfill({
        json: { success: true, data: { problems: [], history: [] } },
      });
    return route.fulfill({ json: { success: true, data: { buckets: [] } } });
  });
  await page.goto("/admin/monitor");
  const cpu = page.getByRole("img", {
    name: "Biểu đồ lịch sử CPU (%) · Tải vi xử lý",
    exact: true,
  });
  const memory = page.getByRole("img", {
    name: "Biểu đồ lịch sử RAM (%) · Dung lượng bộ nhớ",
    exact: true,
  });
  await expect(cpu.locator("canvas").first()).toBeVisible();
  await expect(memory.locator("canvas").first()).toBeVisible();
  await cpu.scrollIntoViewIfNeeded();
  const bitmap = () =>
    memory.locator("canvas").evaluateAll(async (elements) => {
      const pixels = elements
        .map((element) => (element as HTMLCanvasElement).toDataURL())
        .join("|");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(pixels),
      );
      return Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
    });
  await page.mouse.move(0, 0);
  const before = await bitmap();
  const bounds = await cpu.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.6,
    bounds!.y + bounds!.height * 0.5,
  );
  await expect
    .poll(bitmap, {
      message: "Hovering CPU should draw the matching crosshair on RAM",
      timeout: 4000,
    })
    .not.toBe(before);
});
