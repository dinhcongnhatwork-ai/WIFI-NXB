import { test, expect } from "@playwright/test";

test.use({ video: "on" });

for (const width of [1280, 1440, 1920]) {
  test(`administrative design system has consistent surfaces at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.addInitScript(() => {
      localStorage.setItem(
        "token",
        `test.${btoa(JSON.stringify({ id: "ui-test", username: "kiemthu", role: "VIEWER", exp: 4102444800 }))}.test`,
      );
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { id: "ui-test", username: "kiemthu", role: "VIEWER" },
        },
      }),
    );
    await page.route("**/api/dashboard**", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            stats: {
              templates: 12,
              campaigns: 7,
              activeCampaigns: 3,
              totalUsers: 152,
              todayLogins: 24,
            },
            charts: {
              dailyGrowth: [
                {
                  date: "2026-10-22",
                  label: "22/10",
                  logins: 18,
                  uniqueUsers: 14,
                  newUsers: 3,
                },
                {
                  date: "2026-10-23",
                  label: "23/10",
                  logins: 24,
                  uniqueUsers: 20,
                  newUsers: 5,
                },
              ],
            },
            recentLogs: [],
          },
        },
      }),
    );
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Tổng quan", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("heading", { name: "Tổng quan", exact: true }),
    ).toHaveCSS("font-size", "28px");
    await expect(page.locator(".admin-brand-link small")).toHaveCSS(
      "font-size",
      "12px",
    );
    expect(
      await page
        .locator(".admin-shell")
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("Inter");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.tmp/ui-redesign/admin-${width}.png`,
      fullPage: true,
    });
  });
}
