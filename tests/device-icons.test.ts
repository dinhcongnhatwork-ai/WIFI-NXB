import { describe, expect, it } from "vitest";
import { buildUnifiTopology } from "@/lib/network/topology";
import { deviceIcon } from "@/lib/network/device-icons";

describe("device icon identity", () => {
  it("recognizes observed Galaxy phone model hostnames without assuming Galaxy Book is a phone", () => {
    expect(
      deviceIcon({ type: "client", name: "Galaxy-Note9-cua-Khang" })?.src,
    ).toBe("/device-icons/phone.png");
    expect(deviceIcon({ type: "client", name: "Galaxy-S21-FE-5G" })?.src).toBe(
      "/device-icons/phone.png",
    );
    expect(deviceIcon({ type: "client", name: "Galaxy Book" })?.src).toBe(
      "/device-icons/laptop.png",
    );
  });
  it("preserves controller identity evidence through the topology API model", () => {
    const graph = buildUnifiTopology(
      [],
      [
        {
          mac: "AA",
          hostname: "Guest",
          fingerprint_os: "Android",
          dev_cat_name: "smartphone",
        },
        { mac: "BB", hostname: "Workstation", os_name: "Windows 11" },
      ],
      "2026-10-24T00:00:00Z",
    );
    expect(deviceIcon(graph.nodes.find((n) => n.mac === "AA")!)?.src).toBe(
      "/device-icons/phone.png",
    );
    expect(deviceIcon(graph.nodes.find((n) => n.mac === "BB")!)?.src).toBe(
      "/device-icons/laptop.png",
    );
  });
  it.each(["iOS", "Android 14", "iPhone", "Windows Phone"])(
    "recognizes phone OS %s",
    (osName) => {
      expect(deviceIcon({ type: "client", meta: { osName } })?.src).toBe(
        "/device-icons/phone.png",
      );
    },
  );
  it.each(["Windows 11", "macOS", "MacBook Pro", "Ubuntu Desktop", "laptop"])(
    "recognizes computer %s",
    (model) => {
      expect(deviceIcon({ type: "client", meta: { model } })?.src).toBe(
        "/device-icons/laptop.png",
      );
    },
  );
  it("recognizes UniFi access points in topology and monitor targets", () => {
    expect(deviceIcon({ type: "ap" })?.src).toBe("/device-icons/unifi-ap.png");
    expect(
      deviceIcon({ kind: "ap", metadata: { provider: "UNIFI" } })?.src,
    ).toBe("/device-icons/unifi-ap.png");
  });
  it("does not guess an unknown client or Linux appliance is a laptop", () => {
    expect(
      deviceIcon({ type: "client", name: "a0:01:02:03:04:05" }),
    ).toBeNull();
    expect(
      deviceIcon({ type: "client", meta: { osName: "Linux" } }),
    ).toBeNull();
    expect(deviceIcon({ type: "gateway", name: "Android gateway" })).toBeNull();
    expect(
      deviceIcon({ kind: "ap", metadata: { provider: "MIKROTIK" } }),
    ).toBeNull();
  });
  it("uses supplied fingerprint text and hostname when OS is absent", () => {
    expect(
      deviceIcon({ type: "client", meta: { deviceCategory: "smartphone" } })
        ?.src,
    ).toBe("/device-icons/phone.png");
    expect(deviceIcon({ type: "client", name: "iPhone-cua-An" })?.src).toBe(
      "/device-icons/phone.png",
    );
    expect(deviceIcon({ type: "client", name: "DESKTOP-ABC123" })?.src).toBe(
      "/device-icons/laptop.png",
    );
  });
});
