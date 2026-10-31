import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildUnifiTopology } from "@/lib/network/topology";
import { deviceIcon, classifyDevice, DEVICE_ICONS } from "@/lib/network/device-icons";

const fixtures = [
  [{ type: "client", meta: { model: "U6-Pro" } }, "ap"],
  [{ type: "client", meta: { model: "USW-24-POE" } }, "switch"],
  [{ type: "client", meta: { model: "UDM-Pro" } }, "router"],
  [{ type: "client", meta: { deviceFamily: "Apple iPhone" } }, "phone"],
  [{ type: "client", meta: { deviceType: "Multifunction Printer", osName: "Windows" } }, "printer"],
  [{ type: "ap", name: "Android" }, "ap"],
  [{ kind: "gateway", name: "iPhone" }, "router"],
  [{ type: "switch" }, "switch"],
  [{ type: "printer", meta: { osName: "Windows 11" } }, "printer"],
  [{ type: "client", meta: { deviceCategory: "server", osName: "Windows 11" } }, "server"],
  [{ type: "client", metadata: { deviceType: "Smart TV", osName: "Android" } }, "tv"],
  [{ type: "client", meta: { deviceCategory: "desktop", model: "iPhone" } }, "desktop"],
  [{ type: "client", name: "Galaxy-Note9-cua-Khang" }, "phone"],
  [{ type: "client", name: "Galaxy-S21-FE-5G" }, "phone"],
  [{ type: "client", name: "Galaxy Book" }, "laptop"],
  [{ type: "client", name: "DESKTOP-ABC123" }, "desktop"],
  [{ type: "client", meta: { model: "HP LaserJet Pro" } }, "printer"],
  [{ type: "client", meta: { osName: "Windows Server 2022" } }, "server"],
  [{ type: "client", meta: { model: "Samsung Smart TV", osName: "Android" } }, "tv"],
  [{ type: "client", meta: { osName: "Windows Phone" } }, "phone"],
  [{ type: "client", meta: { model: "MacBook Pro" } }, "laptop"],
  [{ type: "client", meta: { model: "iMac" } }, "desktop"],
  [{ type: "client", meta: { osName: "Windows 11" } }, "desktop"],
  [{ type: "client", meta: { osName: "Linux" } }, "generic-device"],
  [{ type: "client", name: "a0:01:02:03:04:05" }, "generic-device"],
  [{ type: "firewall", name: "Android gateway" }, "generic-device"],
  [{ kind: "ap", metadata: { provider: "MIKROTIK" } }, "ap"],
] as const;

describe("shared hardware artwork", () => {
  it.each(fixtures)("classifies %j as %s", (device, category) => {
    expect(classifyDevice(device)).toBe(category);
    expect(deviceIcon(device).src).toBe(`/device-icons/${category}-v2.png`);
  });
  it("preserves controller identity through topology", () => {
    const graph = buildUnifiTopology([], [{ mac: "AA", hostname: "Guest", fingerprint_os: "Android", dev_cat_name: "smartphone" }], "2026-10-24T00:00:00Z");
    expect(classifyDevice(graph.nodes.find((node) => node.mac === "AA")!)).toBe("phone");
  });
  it("ships all ten local transparent PNG assets", async () => {
    expect(Object.keys(DEVICE_ICONS)).toHaveLength(10);
    for (const icon of Object.values(DEVICE_ICONS)) {
      const source = sharp(`public${icon.src}`);
      const metadata = await source.metadata();
      expect(metadata.format).toBe("png");
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBeLessThanOrEqual(512);
      expect(metadata.height).toBeLessThanOrEqual(512);
      const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alpha = Array.from(data).filter((_, index) => index % info.channels === info.channels - 1);
      expect(alpha.filter((value) => value === 0).length / alpha.length).toBeGreaterThan(0.15);
      expect(alpha.some((value) => value === 255)).toBe(true);
      expect(data[info.channels - 1]).toBe(0);
    }
  });
});

const fleetFixtures = [
  [{ type: "gateway", meta: { provider: "mikrotik" } }, "router", "mikrotik-router-v3"],
  [{ type: "router", metadata: { vendor: "MikroTik" } }, "router", "mikrotik-router-v3"],
  [{ type: "switch", meta: { provider: "mikrotik", deviceRole: "core-switch" } }, "switch", "mikrotik-core-switch-v3"],
  [{ type: "switch", meta: { vendor: "MikroTik", deviceRole: "access-switch", model: "CCR2004" } }, "switch", "switch-v2"],
  [{ type: "gateway", meta: { provider: "mikrotik", deviceRole: "core-switch", model: "CCR2004" } }, "router", "mikrotik-core-switch-v3"],
  [{ type: "switch", meta: { provider: "mikrotik", model: "CRS326-24S+2Q+" } }, "switch", "switch-v2"],
  [{ type: "neighbor", meta: { provider: "mikrotik", model: "CRS326-24G-2S+" } }, "switch", "switch-v2"],
  [{ type: "device", meta: { vendor: "MikroTik", model: "CSS610-8G-2S+" } }, "switch", "switch-v2"],
  [{ type: "client", meta: { provider: "mikrotik", model: "CCR2116-12G-4S+" } }, "router", "mikrotik-router-v3"],
  [{ type: "neighbor", meta: { provider: "MIKROTIK", model: "RB5009UG+S+" } }, "router", "mikrotik-router-v3"],
  [{ type: "neighbor", name: "Android", meta: { provider: "mikrotik" } }, "generic-device", "generic-device-v2"],
  [{ type: "client", name: "CRS326", meta: { provider: "other" } }, "generic-device", "generic-device-v2"],
  [{ type: "switch", meta: { provider: "unifi", deviceRole: "core-switch" } }, "switch", "switch-v2"],
] as const;

describe("MikroTik fleet hardware artwork", () => {
  it.each(fleetFixtures)("uses observed role/vendor for %j", (device, category, asset) => {
    expect(classifyDevice(device)).toBe(category);
    expect(deviceIcon(device).src).toBe(`/device-icons/${asset}.png`);
  });
  it.each(["mikrotik-router-v3", "mikrotik-core-switch-v3"])("ships transparent rackmount asset %s", async (asset) => {
    const source = sharp(`public/device-icons/${asset}.png`);
    const metadata = await source.metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.hasAlpha).toBe(true);
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = Array.from(data).filter((_, index) => index % info.channels === info.channels - 1);
    expect(alpha.filter(value => value === 0).length / alpha.length).toBeGreaterThan(0.15);
    expect(alpha.some(value => value === 255)).toBe(true);
    expect(data[info.channels - 1]).toBe(0);
  });
});
