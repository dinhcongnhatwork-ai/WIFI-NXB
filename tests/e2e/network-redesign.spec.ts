import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";

type Graph = { nodes: any[]; links: any[]; observedAt: string; warnings: string[] };
type Feed = "fresh" | "missing" | "null" | "zero" | "failed";
const aps = Array.from({ length: 37 }, (_, i) => ({
  id: `ap${i}`, type: "ap", name: `AP${Math.floor(i / 3) + 1}.${i % 3 + 1}`,
  ip: `192.168.0.${i + 10}`, mac: `aa:bb:cc:dd:ee:${String(i).padStart(2, "0")}`,
  status: i < 30 ? "online" : "offline", meta: { model: "U6 Pro" },
}));
const clients = Array.from({ length: 111 }, (_, i) => ({
  id: `client${i}`, type: "client", name: i % 2 ? `Laptop ${i}` : `Điện thoại ${i}`,
  ip: `10.0.0.${i + 1}`, status: "observed",
  meta: { osName: i % 2 ? "Windows 11" : "Android", ssid: "Office", apName: aps[i % 37].name, signal: -55 },
}));
const fixture: Graph = { nodes: [...aps, ...clients], links: clients.map((client, i) => ({
  id: `l${i}`, source: aps[i % 37].id, target: client.id, type: "wireless", layer: "physical", evidence: "client.ap_mac",
})), observedAt: new Date().toISOString(), warnings: [] };
const url = "/admin/unifi/topology?connectionId=controller&siteId=default";
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const particles = (page: Page) => page.getByRole("img", { name: /^Lưu lượng trực tiếp:/ });
const noParticles = "Lưu lượng trực tiếp: không có line đang chạy";

async function setup(page: Page, graph: Graph = fixture, provider = "unifi") {
  const state = { feed: "fresh" as Feed, stamp: Date.now(), frozen: false, topologyReads: 0, trafficReads: 0 };
  await page.addInitScript(() => {
    localStorage.setItem("token", `test.${btoa(JSON.stringify({ id: "qa", username: "qa", role: "VIEWER", exp: 4102444800 }))}.test`);
    localStorage.setItem("username", "qa");
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const sample = () => ({
    downloadBytes: 12340000, uploadBytes: 456000,
    downloadBps: state.feed === "null" ? null : state.feed === "zero" ? 0 : 12300000,
    uploadBps: state.feed === "null" ? null : state.feed === "zero" ? 0 : 800000,
    source: provider === "unifi" ? "UniFi test observation" : "MikroTik test observation",
    sampledAt: new Date(state.frozen ? state.stamp : Date.now()).toISOString(),
    perspective: provider === "unifi" ? "user" : "interface",
  });
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (!route.request().headers().authorization)
      return route.fulfill({ status: 401, json: { success: false, error: "Authentication required" } });
    if (pathname === "/api/auth/me")
      return route.fulfill({ json: { success: true, data: { id: "qa", username: "qa", role: "VIEWER" } } });
    if (pathname === "/api/network/connections")
      return route.fulfill({ json: { success: true, data: [{ id: provider === "unifi" ? "controller" : "router-office", name: provider === "unifi" ? "UniFi văn phòng" : "Router văn phòng", provider, isDefault: true, config: { site: "default" } }] } });
    if (pathname === "/api/unifi/info")
      return route.fulfill({ json: { success: true, data: [{ name: "default", desc: "Văn phòng" }] } });
    if (pathname.endsWith("/topology/traffic")) {
      state.trafficReads++;
      if (state.feed === "failed") return route.fulfill({ status: 503, json: { success: false, error: "Nguồn gián đoạn trong kiểm thử" } });
      const current = sample();
      return route.fulfill({ json: { success: true, data: {
        nodes: state.feed === "missing" ? {} : Object.fromEntries(graph.nodes.map(n => [n.id, current])),
        links: state.feed === "missing" ? {} : Object.fromEntries(graph.links.map(l => [l.id, current])),
        sampledAt: current.sampledAt, source: current.source,
      } } });
    }
    if (pathname.endsWith("/topology")) {
      state.topologyReads++;
      return route.fulfill({ json: { success: true, data: {
        ...graph, observedAt: new Date().toISOString(),
        nodes: graph.nodes.map(n => ({ ...n, traffic: state.feed === "missing" ? undefined : { ...sample(), sampledAt: new Date(state.stamp).toISOString() } })),
        links: graph.links.map(l => ({ ...l, traffic: state.feed === "missing" ? undefined : { ...sample(), sampledAt: new Date(state.stamp).toISOString() } })),
      } } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return state;
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`37 AP overview stays readable in bounded rows on ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page);
    await page.goto(url);
    await expect(page.locator('.react-flow__node[data-id^="ap"]')).toHaveCount(37);
    await expect(page.locator('.react-flow__node[data-id^="client"]')).toHaveCount(0);
    expect(Number((await page.getByRole("button", { name: "Về mức phóng 100%" }).innerText()).replace("%", ""))).toBeGreaterThanOrEqual(65);
    await expect(page.locator(".react-flow__minimap")).toBeVisible();
    expect(Math.round((await node(page, "ap0").boundingBox())!.width)).toBeGreaterThanOrEqual(169);
    const ids = await page.locator(".react-flow__node").evaluateAll(elements => elements.map(el => el.getAttribute("data-id")!));
    expect(ids.filter(id => !fixture.nodes.some(n => n.id === id)).every(id => id.startsWith("layout:"))).toBe(true);
    await expect(page.locator(".network-device-type").filter({ hasText: /gateway|router|cổng mạng/i })).toHaveCount(0);
    await page.screenshot({ path: `.tmp/network-redesign/after-${viewport.width}.png`, fullPage: true });
  });
}

test("AP branches, AP scope and hidden-client search reveal the real children", async ({ page }) => {
  await setup(page);
  await page.goto(url);
  await page.getByRole("button", { name: "Mở nhánh AP1.1", exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id^="client"]')).toHaveCount(3);
  for (const id of ["client0", "client37", "client74"]) await expect(node(page, id)).toHaveCount(1);
  await page.getByRole("button", { name: "Thu gọn AP1.1", exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id^="client"]')).toHaveCount(0);
  await page.getByLabel("Chọn AP", { exact: true }).selectOption("ap0");
  await expect(page.locator('.react-flow__node[data-id^="ap"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__node[data-id^="client"]')).toHaveCount(3);
  await page.getByRole("button", { name: /^Danh sách/ }).click();
  await expect(page.locator(".network-inventory tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Sơ đồ kết nối", exact: true }).click();
  await page.getByLabel("Chọn AP", { exact: true }).selectOption("all");
  const target = fixture.nodes.find(n => n.id === "client1")!;
  await expect(node(page, target.id)).toHaveCount(0);
  await page.getByLabel("Tìm thiết bị", { exact: true }).fill(target.name);
  await page.getByRole("option", { name: new RegExp(target.name) }).first().click();
  await expect(node(page, target.id)).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Chi tiết quan sát" })).toContainText(target.name);
  await page.getByRole("button", { name: "Bỏ lựa chọn", exact: true }).click();
  const keyboardTarget = fixture.nodes.find(n => n.id === "client2")!;
  await page.getByLabel("Tìm thiết bị", { exact: true }).fill(keyboardTarget.name);
  await page.getByLabel("Tìm thiết bị", { exact: true }).press("Enter");
  await expect(node(page, keyboardTarget.id)).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Chi tiết quan sát" })).toContainText(keyboardTarget.name);
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
  await page.screenshot({ path: ".tmp/network-redesign/after-hidden-client-search.png", fullPage: true });
});

test("traffic polls and topology refresh preserve zoom, pan and open branches", async ({ page }) => {
  const state = await setup(page);
  await page.goto(url);
  await page.getByRole("button", { name: "Mở nhánh AP1.1", exact: true }).click();
  const viewport = page.locator(".react-flow__viewport");
  await page.locator(".react-flow__controls-zoomin").click();
  await expect(page.getByRole("button", { name: "Về mức phóng 100%" })).not.toHaveText("100%");
  await page.waitForTimeout(300); // React Flow's explicit 200ms zoom animation.
  const flowBox = (await page.locator(".react-flow").boundingBox())!;
  await page.mouse.move(flowBox.x + 70, flowBox.y + flowBox.height - 110);
  await page.mouse.down(); await page.mouse.move(flowBox.x + 170, flowBox.y + flowBox.height - 85, { steps: 8 }); await page.mouse.up();
  const before = await viewport.getAttribute("style");
  const reads = state.trafficReads;
  await expect.poll(() => state.trafficReads, { timeout: 10000 }).toBeGreaterThan(reads);
  await expect(viewport).toHaveAttribute("style", before!);
  const topologyReads = state.topologyReads;
  await page.getByRole("button", { name: "Làm mới sơ đồ", exact: true }).click();
  await expect.poll(() => state.topologyReads).toBeGreaterThan(topologyReads);
  await expect(viewport).toHaveAttribute("style", before!);
  await expect(page.locator('.react-flow__node[data-id^="client"]')).toHaveCount(3);
});

for (const feed of ["missing", "null", "zero", "failed"] as const) {
  test(`${feed} traffic cannot keep particles running after samples expire`, async ({ page }) => {
    await page.clock.install();
    const state = await setup(page);
    await page.goto(url);
    await page.getByRole("button", {name:"Mở nhánh AP1.1",exact:true}).click();
    await expect(node(page, "client0")).toHaveCount(1);
    await expect(particles(page)).toHaveAttribute("aria-label", /Lưu lượng trực tiếp: [1-9]\d* liên kết, [1-9]\d* vệt line/);
    state.feed = feed;
    state.frozen = true;
    const previous = state.trafficReads;
    await page.clock.fastForward(35000);
    await expect.poll(() => state.trafficReads).toBeGreaterThan(previous);
    await expect(particles(page)).toHaveAttribute("aria-label", noParticles);
    if (feed === "failed") await expect(page.locator(".network-workspace").getByRole("alert")).toContainText("Nguồn gián đoạn trong kiểm thử");
  });
}

test("unchanged last sample becomes stale and stops particles after 30 seconds", async ({ page }) => {
  await page.clock.install();
  const state = await setup(page);
  state.frozen = true;
  await page.goto(url);
  await page.getByRole("button", {name:"Mở nhánh AP1.1",exact:true}).click();
  await expect(node(page, "client0")).toHaveCount(1);
  await expect(particles(page)).not.toHaveAttribute("aria-label", noParticles);
  await page.clock.fastForward(35000);
  await expect(particles(page)).toHaveAttribute("aria-label", noParticles);
  await expect(node(page, "client0")).toContainText("Dữ liệu cũ");
});

for (const fallback of [false, true]) {
  test(`${fallback ? "fallback" : "native"} fullscreen exits on Escape and restores focus`, async ({ page }) => {
    if (fallback) await page.addInitScript(() => Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: () => Promise.reject(new Error("Fullscreen unavailable")) }));
    await setup(page); await page.goto(url);
    await expect(node(page, "ap0")).toHaveCount(1);
    const opener = page.getByRole("button", { name: "Toàn màn hình", exact: true });
    await opener.click();
    await expect(page.locator(".network-workspace")).toHaveClass(/is-fullscreen/);
    if (!fallback) await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("network-workspace"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".network-workspace")).not.toHaveClass(/is-fullscreen/);
    await expect(page.getByRole("button", { name: "Toàn màn hình", exact: true })).toBeFocused();
  });
}

test("PNG export downloads a real PNG", async ({ page }) => {
  await setup(page); await page.goto(url);
  await expect(node(page, "ap0")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất PNG", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^unifi-topology-.*\.png$/);
  const file = ".tmp/network-redesign/export-topology.png";
  await download.saveAs(file);
  const bytes = await fs.readFile(file);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.length).toBeGreaterThan(1000);
});

test("MikroTik single-device view shows only online MikroTik hardware", async ({ page }) => {
  const graph: Graph = { nodes: [
    { id: "router-real", type: "gateway", name: "Router phòng họp", status: "online", ip: "10.20.0.1", meta: { model: "RB5009", provider:"mikrotik", managed:true } },
    { id: "interface-real", type: "interface", name: "ether-office", status: "running" },
    { id: "office-laptop", type: "client", name: "Laptop phòng họp", status: "observed", ip: "10.20.0.22", meta: { osName: "Windows 11" } },
  ], links: [
    { id: "router-port", source: "router-real", target: "interface-real", type: "wired", layer: "physical", evidence: "router.interfaces", speedMbps: 1000 },
    { id: "port-client", source: "interface-real", target: "office-laptop", type: "wired", layer: "physical", evidence: "dhcp.interface" },
  ], warnings: [], observedAt: new Date().toISOString() };
  await setup(page, graph, "mikrotik");
  await page.goto("/admin/mikrotik/topology?connectionId=router-office");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(node(page, "interface-real")).toHaveCount(0);
  await expect(node(page, "office-laptop")).toHaveCount(0);
  await expect(node(page, "router-real")).toContainText("RB5009");
  await expect(page.locator(".network-workspace")).not.toContainText("CCR2004");
  await page.screenshot({ path: ".tmp/network-redesign/after-mikrotik.png", fullPage: true });
});

test("search reveals an unassociated client from its collapsed display group", async ({ page }) => {
  const orphan = { id: "client-orphan", type: "client", name: "Máy khách chưa rõ AP", status: "observed", ip: "10.0.1.90", meta: { osName: "Android" } };
  await setup(page, { ...fixture, nodes: [...fixture.nodes, orphan] });
  await page.goto(url);
  await expect(node(page, "ap0")).toHaveCount(1);
  await expect(node(page, orphan.id)).toHaveCount(0);
  await page.getByLabel("Tìm thiết bị", { exact: true }).fill(orphan.name);
  await page.getByLabel("Tìm thiết bị", { exact: true }).press("Enter");
  await expect(node(page, orphan.id)).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Chi tiết quan sát" })).toContainText(orphan.name);
  await expect(node(page, "layout:unassociated")).toContainText("Không phải thiết bị vật lý");
});

test("AP scope includes mesh descendants and every attached client", async ({ page }) => {
  const graph: Graph = { nodes: [
    { id: "ap-root", type: "ap", name: "AP1.1", status: "online" },
    { id: "ap-mesh", type: "ap", name: "AP1.2", status: "online" },
    { id: "root-client", type: "client", name: "Laptop root", status: "observed" },
    { id: "mesh-client", type: "client", name: "Laptop mesh", status: "observed" },
  ], links: [
    { id: "root-mesh", source: "ap-root", target: "ap-mesh", type: "uplink", layer: "physical", evidence: "uplink.uplink_remote_mac" },
    { id: "root-client-link", source: "ap-root", target: "root-client", type: "wireless", layer: "physical", evidence: "client.ap_mac" },
    { id: "mesh-client-link", source: "ap-mesh", target: "mesh-client", type: "wireless", layer: "physical", evidence: "client.ap_mac" },
  ], observedAt: new Date().toISOString(), warnings: [] };
  await setup(page, graph); await page.goto(url);
  await page.getByLabel("Chọn AP", { exact: true }).selectOption("ap-root");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  for (const device of graph.nodes) await expect(node(page, device.id)).toHaveCount(1);
  await page.getByRole("button", { name: /^Danh sách/ }).click();
  await expect(page.locator(".network-inventory tbody tr")).toHaveCount(4);
  await expect(page.locator(".network-inventory")).toContainText("Laptop mesh");
});

test("repeating the same search result recenters the camera after a real pan", async ({ page }) => {
  await setup(page); await page.goto(url);
  const target = clients[1];
  const input = page.getByLabel("Tìm thiết bị", { exact: true });
  await input.fill(target.name); await input.press("Enter");
  await expect(node(page, target.id)).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Chi tiết quan sát" })).toContainText(target.name);
  await page.waitForTimeout(300); // Complete the explicit 250ms focus animation.
  const viewport = page.locator(".react-flow__viewport");
  const focused = await viewport.getAttribute("style");
  const box = (await page.locator(".react-flow").boundingBox())!;
  await page.mouse.move(box.x + 35, box.y + 35);
  await page.mouse.down();
  await page.mouse.move(box.x + 165, box.y + 115, { steps: 8 });
  await page.mouse.up();
  await expect(viewport).not.toHaveAttribute("style", focused!);
  const panned = await viewport.getAttribute("style");
  await input.fill(target.name); await input.press("Enter");
  await expect(viewport).not.toHaveAttribute("style", panned!);
  await expect(viewport).toHaveAttribute("style", focused!);
});
