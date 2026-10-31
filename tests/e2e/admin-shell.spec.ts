import { test, expect, type Page } from "@playwright/test";
import { createDocument } from "../../src/lib/template-document";

test.use({ acceptDownloads: true });

const dashboard = {
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
        date: "2026-10-20",
        label: "20/10",
        logins: 18,
        uniqueUsers: 14,
        newUsers: 3,
      },
      {
        date: "2026-10-21",
        label: "21/10",
        logins: 24,
        uniqueUsers: 20,
        newUsers: 5,
      },
    ],
  },
  recentLogs: [
    {
      id: "login-1",
      mac: "AA:BB:CC:DD:EE:01",
      phone: "",
      loginTime: "2026-10-21T08:00:00Z",
      campaign: { name: "Hội nghị", ssid: "Khach" },
    },
  ],
};
async function authenticated(page: Page, role = "ADMIN") {
  await page.addInitScript((currentRole) => {
    localStorage.setItem(
      "token",
      `test.${btoa(JSON.stringify({ id: "test-user", username: "kiemthu", role: currentRole, exp: 4102444800 }))}.test`,
    );
    localStorage.setItem("username", "kiemthu");
    localStorage.setItem("role", currentRole);
  }, role);
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/dashboard")
      return route.fulfill({ json: { success: true, data: dashboard } });
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          success: true,
          data: { id: "test-user", username: "kiemthu", role },
        },
      });
    return route.fallback();
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tổng quan", exact: true }),
  ).toBeVisible();
}

test("login has explicit labels and announces a failed authentication", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: { error: "Invalid credentials" } }),
  );
  await page.goto("/admin");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("unknown");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator('.admin-error[role="alert"]')).toContainText(
    "Tên đăng nhập hoặc mật khẩu không chính xác",
  );
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("desktop navigation, live statistics and refresh failures preserve useful data", async ({
  page,
}) => {
  await authenticated(page);
  await expect(page.locator(".admin-sidebar")).toHaveCSS("width", "248px");
  await expect(
    page.getByRole("link", { name: "Tổng quan", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Tài khoản quản trị", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("AA:BB:CC:DD:EE:01")).toBeVisible();
  await page.route("**/api/dashboard?days=7", (route) =>
    route.fulfill({ status: 503, json: { error: "Máy chủ đang bảo trì" } }),
  );
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.locator('.admin-error[role="alert"]')).toContainText(
    "Đang hiển thị dữ liệu tải thành công gần nhất",
  );
  await expect(page.getByText("AA:BB:CC:DD:EE:01")).toBeVisible();
  await expect(page.locator(".admin-stat > strong").first()).toHaveText("12");
  const invalidTypography = await page
    .locator(".admin-shell")
    .evaluate((shell) => {
      return Array.from(shell.querySelectorAll("*"))
        .filter((element) => {
          if (
            element.closest(".portal-page") ||
            !element.getClientRects().length
          )
            return false;
          const hasOwnText = Array.from(element.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          );
          return (
            hasOwnText &&
            ![
              "12px",
              "14px",
              "16px",
              "20px",
              "24px",
              "28px",
              "30px",
              "36px",
              "48px",
            ].includes(getComputedStyle(element).fontSize)
          );
        })
        .map((element) => ({
          text: element.textContent,
          size: getComputedStyle(element).fontSize,
        }));
    });
  expect(invalidTypography).toEqual([]);
  await page.screenshot({
    path: ".tmp/network-upgrade/admin-desktop.png",
    fullPage: true,
  });
});

test("viewer navigation hides privileged settings and advanced APIs", async ({
  page,
}) => {
  await authenticated(page, "VIEWER");
  await expect(
    page.getByText("Chế độ chỉ xem.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Tài khoản quản trị", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "UniFi", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sơ đồ mạng", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "API nâng cao", exact: true }),
  ).toHaveCount(0);
});

test("mobile drawer traps focus, closes with Escape, and restores focus to its opener", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticated(page);
  const opener = page.getByRole("button", {
    name: "Mở trình đơn",
    exact: true,
  });
  await expect(page.locator(".admin-sidebar")).not.toBeVisible();
  await opener.click();
  const close = page.getByRole("button", {
    name: "Đóng trình đơn",
    exact: true,
  });
  await expect(close).toBeFocused();
  const brand = page.locator(".admin-brand-link");
  await brand.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("link", { name: "Tài khoản quản trị", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".admin-sidebar")).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".tmp/network-upgrade/admin-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await opener.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".admin-sidebar")).not.toHaveAttribute(
    "aria-modal",
    "true",
  );
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("admin style normalization preserves embedded portal typography and colors", async ({
  page,
}) => {
  await authenticated(page);
  await page.locator("#admin-main").evaluate((main) => {
    const preview = document.createElement("div");
    preview.className = "portal-page";
    preview.innerHTML =
      '<p>Default portal body</p><h1 class="text-4xl text-purple-600 rounded-xl shadow-lg" style="font-size:37px;color:rgb(120,33,160);border-radius:22px">Portal content</h1>';
    main.appendChild(preview);
    const device = document.createElement("div");
    device.className = "select-none";
    device.innerHTML =
      '<div class="shadow-2xl bg-gradient-to-b" style="box-shadow:rgb(0,0,0) 0px 4px 12px;background-image:linear-gradient(rgb(10,20,30),rgb(20,30,40))"><iframe title="Protected device frame"></iframe><p>Device preview chrome</p></div>';
    main.appendChild(device);
  });
  const portalHeading = page.getByRole("heading", { name: "Portal content" });
  await expect(portalHeading).toHaveCSS("font-size", "37px");
  await expect(page.getByText("Default portal body")).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(portalHeading).toHaveCSS("color", "rgb(120, 33, 160)");
  await expect(portalHeading).toHaveCSS("border-radius", "22px");
  await expect(
    page.getByRole("heading", { name: "Tổng quan", exact: true }),
  ).toHaveCSS("font-size", "28px");
  const device = page.locator(".select-none .shadow-2xl");
  await expect(device).toHaveCSS("box-shadow", "rgb(0, 0, 0) 0px 4px 12px 0px");
  await expect(device).toHaveCSS(
    "background-image",
    "linear-gradient(rgb(10, 20, 30), rgb(20, 30, 40))",
  );
  await expect(page.getByText("Device preview chrome")).toHaveCSS(
    "font-size",
    "16px",
  );
});

test("initial dashboard failure shows unavailable metrics rather than fabricated zeroes", async ({
  page,
}) => {
  await authenticated(page);
  await page.route("**/api/dashboard?days=7", (route) =>
    route.fulfill({ status: 503, json: { error: "Không thể tải tổng quan" } }),
  );
  await page.reload();
  await expect(page.locator('.admin-error[role="alert"]')).toContainText(
    "Không thể tải tổng quan",
  );
  await expect(page.locator(".admin-stat > strong")).toHaveText([
    "—",
    "—",
    "—",
    "—",
    "—",
  ]);
  await expect(
    page.getByText("Chưa tải được lượt đăng nhập.", { exact: true }),
  ).toBeVisible();
});

test("viewer can filter attendance and request report exports while session mutations stay disabled", async ({
  page,
}) => {
  await authenticated(page, "VIEWER");
  const writes: string[] = [];
  const filters: string[] = [];
  const session = {
    id: "session-ui",
    name: "Họp kiểm thử",
    status: "READY",
    ssid: "Khach",
    location: "Phòng họp",
    startTime: "2026-10-21T08:00:00Z",
    endTime: "2026-10-21T10:00:00Z",
    warningThresholdMinutes: 15,
    stats: {
      totalRegistered: 0,
      presentCount: 0,
      temporaryAbsentCount: 0,
      totalWarnings: 0,
    },
  };
  await page.context().route("**/api/attendance/**", (route) => {
    const request = route.request();
    if (request.method() !== "GET") writes.push(request.url());
    if (new URL(request.url()).pathname.endsWith("/export")) {
      return route.fulfill({
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: {
          "content-disposition": 'attachment; filename="attendance.xlsx"',
        },
        body: "export fixture",
      });
    }
    filters.push(request.url());
    return route.fulfill({ json: { success: true, data: [session] } });
  });
  await page.goto("/admin/attendance");
  const start = page.getByRole("button", {
    name: "Bắt đầu buổi họp",
    exact: true,
  });
  await expect(start).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Xóa buổi họp", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Tạo buổi họp mới", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await start.evaluate((element: HTMLButtonElement) => element.click());
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Sẵn sàng", exact: true }).click();
  await expect
    .poll(() =>
      filters.some(
        (url) => new URL(url).searchParams.get("status") === "READY",
      ),
    )
    .toBe(true);
  await page
    .getByPlaceholder("Tìm theo tên buổi, địa điểm, SSID...")
    .fill("Họp");
  await expect
    .poll(() =>
      filters.some((url) => new URL(url).searchParams.get("search") === "Họp"),
    )
    .toBe(true);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Tải Báo cáo Excel (.xlsx)", exact: true })
    .click();
  const exportFile = await downloaded;
  expect(exportFile.url()).toContain(
    "/api/attendance/sessions/session-ui/export",
  );
  // Download bytes require a real backend: Chromium download requests bypass mocked routes.
  await expect(
    page.getByRole("link", { name: "Tải Báo cáo Excel (.xlsx)", exact: true }),
  ).toHaveAttribute("download", "");
  expect(writes).toEqual([]);
});

test("viewer can inspect template settings while save fields are disabled", async ({
  page,
}) => {
  await authenticated(page, "VIEWER");
  await page.route("**/api/templates/read-only", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: "read-only",
          name: "Mẫu chỉ xem",
          status: "draft",
          createdAt: "2026-10-20T08:00:00Z",
          updatedAt: "2026-10-21T08:00:00Z",
        },
      },
    }),
  );
  await page.goto("/admin/templates/read-only");
  await expect(
    page.getByRole("heading", { name: "Cài đặt mẫu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu thay đổi", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("form input")).toBeDisabled();
  await expect(page.locator("form select")).toBeDisabled();
  await expect(page.locator("form input")).toHaveValue("Mẫu chỉ xem");
});

test("viewer builder opens the document without editing or autosave machinery", async ({
  page,
}) => {
  await authenticated(page, "VIEWER");
  const writes: string[] = [];
  await page.route("**/api/templates/readonly-builder", (route) => {
    if (route.request().method() !== "GET")
      writes.push(route.request().method());
    return route.fulfill({
      json: {
        success: true,
        data: {
          id: "readonly-builder",
          name: "Mẫu xem thiết kế",
          status: "draft",
          layoutJson: createDocument(),
          draftVersion: 1,
          campaigns: [],
        },
      },
    });
  });
  await page.goto("/admin/templates/readonly-builder/builder");
  await expect(
    page.getByRole("heading", { name: "Mẫu xem thiết kế", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".portal-page")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Xem trước đầy đủ", exact: true }),
  ).toHaveAttribute("href", "/admin/templates/readonly-builder/preview");
  await expect(
    page.getByRole("navigation", { name: "Màn hình thiết kế", exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("viewer can preview starter templates while all create actions remain disabled", async ({
  page,
}) => {
  await authenticated(page, "VIEWER");
  await page.route(/\/api\/templates(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.goto("/admin/templates");
  const usePreset = page.getByRole("button", { name: /^Dùng / });
  await expect(usePreset).toHaveCount(5);
  for (const button of await usePreset.all())
    await expect(button).toBeDisabled();
  await page
    .getByRole("button", { name: /^Xem trước .*: / })
    .first()
    .click();
  const preview = page.getByRole("dialog");
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("button", { name: /^Dùng / })).toBeDisabled();
  await expect(
    preview.getByRole("button", { name: "Đóng xem trước", exact: true }),
  ).toBeEnabled();
});
