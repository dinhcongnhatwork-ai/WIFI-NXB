import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, provider: string, fallback: boolean, receiveOnly = false, largeGrid = false, stale = false) {
  await page.addInitScript(({ fallback }) => {
    localStorage.setItem("token", `test.${btoa(JSON.stringify({ id: "traffic-test", username: "traffic-test", role: "VIEWER", exp: 4102444800 }))}.test`);
    if (fallback) Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: () => Promise.reject(Error("unsupported")) });
    const strokes: any[] = [];
    (window as any).cableStrokes = strokes;
    const prototype = CanvasRenderingContext2D.prototype;
    const lineTo = prototype.lineTo, stroke = prototype.stroke;
    prototype.lineTo = function (x, y) { (this as any).lastPoint = { x, y }; return lineTo.call(this, x, y); };
    prototype.stroke = function (...args: any[]) {
      if (this.canvas.getAttribute("role") === "img") {
        const point = (this as any).lastPoint;
        const color = String(this.strokeStyle);
        const path = document.querySelector(`.react-flow__edge[data-id="cable"] .network-edge-line[stroke="${color}"]`) as SVGPathElement | null;
        if (point && path) {
          // Capture the SVG route and camera in the same frame as the canvas stroke.
          // Later data freshness or camera changes cannot invalidate this reference.
          const matrix = path.getScreenCTM();
          if (matrix) {
            const box = this.canvas.getBoundingClientRect();
            const flowPoint = new DOMPoint(box.x + point.x, box.y + point.y).matrixTransform(matrix.inverse());
            strokes.push({ color, path: path.getAttribute("d"), flowX: flowPoint.x, flowY: flowPoint.y, zoom: Math.hypot(matrix.a, matrix.b), width: this.canvas.width, height: this.canvas.height });
          }
        }
        if (strokes.length > 10000) strokes.splice(0, 5000);
      }
      return (stroke as any).apply(this, args);
    };
  }, { fallback });
  const sample = () => ({ downloadBps: receiveOnly ? 0 : 123000, uploadBps: 32000, perspective: provider === "mikrotik" ? "interface" : "user", sampledAt: new Date(Date.now() - (stale ? 60000 : 0)).toISOString(), source: "observed fixture" });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: any = [];
    if (path === "/api/auth/me") data = { id: "traffic-test", username: "traffic-test", role: "VIEWER" };
    else if (path === "/api/network/connections") data = [{ id: "fixture", provider: provider.toUpperCase(), name: "Fixture", isDefault: true, config: { site: "default" } }];
    else if (path === "/api/unifi/info") data = [{ name: "default", desc: "Office" }];
    else if (path.endsWith("/topology/traffic")) data = { nodes: { root: sample(), child: sample() }, links: { cable: sample() }, sampledAt: new Date().toISOString(), warnings: [] };
    else if (path.endsWith("/topology")) data = { nodes: [
      { id: "root", name: "Root", type: "gateway", status: "online", meta: { provider, managed: true, connectionId: "fixture" }, traffic: sample() },
      { id: "child", name: "Child", type: provider === "mikrotik" ? "switch" : "ap", status: "online", meta: { provider, managed: true, connectionId: "second" }, traffic: sample() },
      ...(largeGrid ? Array.from({ length: 59 }, (_, i) => ({ id: `ap-${i}`, name: `AP${i + 1}`, type: "ap", status: "online", meta: { provider } })) : []),
    ], links: [{ id: "cable", source: "root", target: "child", type: "neighbor", layer: "physical", evidence: "/ip/neighbor", sourcePort: "ether7", targetPort: "sfp1", traffic: sample() }], observedAt: new Date().toISOString(), warnings: [] };
    if (largeGrid && path.endsWith("/topology")) {
      data.nodes.find((node: any) => node.id === "child").name = "AP60";
      data.links.push(...Array.from({ length: 59 }, (_, i) => ({ id: `other-${i}`, source: "root", target: `ap-${i}`, type: "uplink", layer: "physical", evidence: "observed" })));
    }
    return route.fulfill({ json: { success: true, data } });
  });
}

async function assertAlignedMotion(page: Page) {
  await page.evaluate(() => { (window as any).cableStrokes.length = 0; });
  await expect.poll(() => page.evaluate(() => (window as any).cableStrokes.length)).toBeGreaterThan(8);
  const geometryForFrame = () => page.evaluate(() => {
    const canvas = document.querySelector('canvas[role="img"]') as HTMLCanvasElement;
    const box = canvas.getBoundingClientRect();
    const probe = ((window as any).cableProbeContext ||= document.createElement("canvas").getContext("2d")) as CanvasRenderingContext2D;
    const paths = ((window as any).cablePathCache ||= new Map()) as Map<string, Path2D>;
    const distance = (stroke: any) => {
      if (!paths.has(stroke.path)) paths.set(stroke.path, new Path2D(stroke.path));
      probe.lineWidth = 6 / stroke.zoom;
      probe.lineJoin = "round";
      probe.lineCap = "round";
      return probe.isPointInStroke(paths.get(stroke.path)!, stroke.flowX, stroke.flowY) ? 0 : Infinity;
    };
    const strokes = ((window as any).cableStrokes as any[]).slice(-10);
    return { width: box.width, height: box.height, pixelWidth: canvas.width, pixelHeight: canvas.height, maxDistance: Math.max(...strokes.map(distance)), colors: Array.from(new Set(strokes.map((stroke) => stroke.color))) };
  });
  await expect.poll(async () => (await geometryForFrame()).maxDistance).toBeLessThan(3);
  const geometry = await geometryForFrame();
  expect(geometry.colors.sort()).toEqual(["#10b981", "#2563eb"]);
  expect(geometry.pixelWidth).toBe(Math.round(geometry.width));
  expect(geometry.pixelHeight).toBe(Math.round(geometry.height));
  expect(geometry.maxDistance).toBeLessThan(3);
}

for (const provider of ["unifi", "mikrotik"]) for (const fallback of [false, true]) {
  test(`${provider} traffic remains aligned through ${fallback ? "fallback" : "native"} fullscreen and resize`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1366, height: 768 });
    await setup(page, provider, fallback);
    await page.goto(`/admin/${provider}/topology?connectionId=fixture&siteId=default`);
    await expect(page.locator('.react-flow__edge[data-id="cable"]')).toBeVisible();
    await assertAlignedMotion(page);
    await page.getByRole("button", { name: "Toàn màn hình", exact: true }).click();
    await expect(page.locator(".network-workspace")).toHaveClass(/is-fullscreen/);
    await assertAlignedMotion(page);
    if (fallback) {
      await page.setViewportSize({ width: 1600, height: 900 });
      await assertAlignedMotion(page);
    }
    await page.getByRole("button", { name: "Thoát toàn màn hình", exact: true }).click();
    await expect(page.locator(".network-workspace")).not.toHaveClass(/is-fullscreen/);
    if (!fallback) await page.setViewportSize({ width: 1600, height: 900 });
    await assertAlignedMotion(page);
  });
}

test("an interface RX sample animates only the blue receive lane", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await setup(page, "mikrotik", false, true);
  await page.goto("/admin/mikrotik/topology?connectionId=fixture");
  await expect.poll(() => page.evaluate(() => (window as any).cableStrokes.length)).toBeGreaterThan(8);
  const colors = await page.evaluate(() => Array.from(new Set((window as any).cableStrokes.map((stroke: any) => stroke.color))));
  expect(colors).toEqual(["#2563eb"]);
});


test("60 AP outside-bus traffic follows rounded corners in fullscreen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await setup(page, "unifi", true, false, true);
  await page.goto("/admin/unifi/topology?connectionId=fixture&siteId=default");
  await expect(page.locator(".react-flow__node")).toHaveCount(61);
  const length = await page.locator('.react-flow__edge[data-id="cable"] .network-edge-line').first().evaluate((path: SVGPathElement) => path.getTotalLength());
  expect(length).toBeGreaterThan(3000);
  await page.getByRole("button", { name: "Toàn màn hình", exact: true }).click();
  await assertAlignedMotion(page);
  // Search centers the last row at readable scale, exposing its final rounded turn.
  const search = page.getByLabel("Tìm thiết bị", { exact: true });
  // Fullscreen hides the search toolbar; restore it, focus the last row, and enter again.
  await page.getByRole("button", { name: "Thoát toàn màn hình", exact: true }).click();
  await search.fill("AP60");
  await search.press("Enter");
  await expect(page.getByRole("complementary", { name: "Chi tiết quan sát" })).toContainText("AP60");
  await page.getByRole("button", { name: "Bỏ lựa chọn", exact: true }).click();
  // The focus animation explicitly lasts 250 ms.
  await page.waitForTimeout(300);
  await page.evaluate(() => { (window as any).cableStrokes.length = 0; });
  // One full observed traffic cycle ensures both lanes pass the final rounded turn.
  await page.waitForTimeout(6500);
  const distances = await page.evaluate(() => {
    const probe = document.createElement("canvas").getContext("2d")!;
    const paths = new Map<string, Path2D>();
    return ((window as any).cableStrokes as any[]).map(stroke => {
      if (!paths.has(stroke.path)) paths.set(stroke.path, new Path2D(stroke.path));
      probe.lineWidth = 6 / stroke.zoom;
      probe.lineJoin = "round";
      probe.lineCap = "round";
      return probe.isPointInStroke(paths.get(stroke.path)!, stroke.flowX, stroke.flowY) ? 0 : Infinity;
    });
  });
  expect(distances.length).toBeGreaterThan(10);
  expect(Math.max(...distances)).toBeLessThan(3);
});


test("hovering and selecting a stale cable shows its status without a runtime error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await setup(page, "unifi", false, false, false, true);
  await page.goto("/admin/unifi/topology?connectionId=fixture&siteId=default");
  const edge = page.locator('.react-flow__edge[data-id="cable"]');
  await expect(edge).toHaveCount(1);
  await expect(page.locator('.react-flow__node[data-id="child"]')).toBeVisible();
  await expect.poll(() => edge.locator(".react-flow__edge-interaction").evaluate((path: SVGPathElement) => path.getTotalLength())).toBeGreaterThan(0);
  await expect(page.getByRole("img", { name: /^Lưu lượng trực tiếp:/ })).toHaveAttribute("aria-label", "Lưu lượng trực tiếp: không có line đang chạy");
  const point = await edge.locator(".react-flow__edge-interaction").evaluate((path: SVGPathElement) => {
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    return new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!).toJSON();
  });
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".network-edge-label")).toContainText("Dữ liệu cũ");
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("complementary", { name: "Chi tiết quan sát" })).toContainText("Chi tiết liên kết");
  await expect(page.locator(".network-edge-label")).toContainText("Dữ liệu cũ");
  expect(errors).toEqual([]);
});
