import { test, expect } from "@playwright/test";

for (const fallback of [false, true]) {
  test(`monitor ${fallback ? "fallback" : "native"} fullscreen remains light and returns focus on Escape`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(({ fallback }) => {
      localStorage.setItem("token", `test.${btoa(JSON.stringify({ exp: 4102444800, role: "VIEWER" }))}.test`);
      if (fallback) Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: () => Promise.reject(new Error("Unavailable")) });
    }, { fallback });
    await page.route("**/api/**", route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/api/auth/me") return route.fulfill({ json: { success: true, data: { id: "qa", username: "qa", role: "VIEWER" } } });
      if (pathname.endsWith("/overview")) return route.fulfill({ json: { success: true, data: { targets: [], connections: [], sites: [], collector: { quality: "missing" } } } });
      if (pathname.endsWith("/events")) return route.fulfill({ json: { success: true, quality: "fresh", data: { history: [], problems: [] } } });
      return route.fulfill({ json: { success: true, data: [] } });
    });
    await page.goto("/admin/monitor");
    const dashboard = page.locator(".monitoring-dashboard");
    const button = page.getByRole("button", { name: "Toàn màn hình", exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Toàn màn hình");
    await button.click();
    await expect(dashboard).toHaveClass(/is-fullscreen/);
    if (!fallback) await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("monitoring-dashboard"))).toBe(true);
    await expect(dashboard).toHaveCSS("background-color", "rgb(248, 250, 252)");
    await expect(dashboard).toHaveCSS("overflow", "auto");
    await expect.poll(async () => Math.round((await dashboard.boundingBox())!.width)).toBe(1366);
    await page.keyboard.press("Tab");
    expect(await dashboard.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: `.tmp/network-fleet/monitor-fullscreen-${fallback ? "fallback" : "native"}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dashboard).not.toHaveClass(/is-fullscreen/);
    await expect(page.getByRole("button", { name: "Toàn màn hình", exact: true })).toBeFocused();
    await expect(page.getByRole("heading", { name: "Giám sát Hệ thống & Bất thường", exact: true })).toBeVisible();
  });
}

test("MikroTik management keeps hardware fields missing and light until the source supplies them", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("token", `test.${btoa(JSON.stringify({ exp: 4102444800, role: "VIEWER" }))}.test`));
  await page.route("**/api/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname === "/api/auth/me" ? { id: "qa", username: "qa", role: "VIEWER" }
      : pathname === "/api/network/connections" ? [{ id: "router", name: "Router nguồn", isDefault: true, config: {} }]
      : pathname === "/api/mikrotik/system" ? { resource: null, routerboard: null, identity: null, logs: [] } : [];
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/admin/mikrotik/manage?connectionId=router");
  await expect(page.getByRole("heading", { name: "Thông số RouterBOARD" })).toBeVisible();
  await expect(page.locator("#admin-main")).not.toContainText("CCR2004");
  await expect(page.locator("#admin-main")).not.toContainText("HMM0B2H5QEN");
  await expect(page.getByText("Model:", { exact: true }).locator("..")).toContainText("—");
  await expect(page.getByText("Tải CPU hiện tại:", { exact: true }).locator("..")).toContainText("—");
  await expect(page.getByText("Tổng bộ nhớ RAM:", { exact: true }).locator("..")).toContainText("—");
  await page.screenshot({ path: ".tmp/network-fleet/mikrotik-manage-missing.png", fullPage: true });
});
