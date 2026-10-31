import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/network/connections", () => ({ resolveConnection: vi.fn() }));
import {
  sampleTraffic,
  unifiCounters,
  mikrotikCounters,
} from "@/lib/network/traffic";
import { sampleTopology } from "@/lib/network/traffic-service";
import {
  buildMikrotikTopology,
  buildUnifiTopology,
} from "@/lib/network/topology";
const first = "2026-10-23T01:00:00.000Z";
const second = "2026-10-23T01:00:05.000Z";
describe("honest traffic normalization", () => {
  it("keeps first and missing observations unknown; preserves real zero", () => {
    const initial = sampleTraffic(
      { downloadBytes: 100, uploadBytes: 0 },
      "UniFi",
      first,
    );
    expect(initial).toMatchObject({
      downloadBytes: 100,
      downloadBps: null,
      uploadBps: null,
      reason: "first-sample",
    });
    expect(sampleTraffic({}, "UniFi", second, initial)).toMatchObject({
      downloadBytes: null,
      downloadBps: null,
      uploadBps: null,
      reason: "missing-counters",
    });
    expect(
      sampleTraffic(
        { downloadBytes: 100, uploadBytes: 0 },
        "UniFi",
        second,
        initial,
      ),
    ).toMatchObject({ downloadBps: 0, uploadBps: 0 });
  });
  it("maps station and Hotspot directions and converts byte deltas to bits/sec", () => {
    const station = sampleTraffic(
      unifiCounters({ tx_bytes: 100, rx_bytes: 20 }),
      "UniFi",
      first,
    );
    expect(
      sampleTraffic(
        unifiCounters({ tx_bytes: 725, rx_bytes: 145 }),
        "UniFi",
        second,
        station,
      ),
    ).toMatchObject({ downloadBps: 1000, uploadBps: 200 });
    const hotspot = sampleTraffic(
      mikrotikCounters({ "bytes-out": "100", "bytes-in": "20" }, true),
      "MikroTik",
      first,
    );
    expect(hotspot).toMatchObject({ downloadBytes: 100, uploadBytes: 20 });
    expect(
      mikrotikCounters({ "tx-byte": "100", "rx-byte": "20" }),
    ).toMatchObject({ downloadBytes: "100", uploadBytes: "20" });
  });
  it("uses explicit measured rates without a previous sample", () => {
    expect(
      sampleTraffic(
        unifiCounters({ "tx_bytes-r": 125, "rx_bytes-r": 25 }),
        "UniFi",
        first,
      ),
    ).toMatchObject({ downloadBps: 1000, uploadBps: 200 });
  });
  it("drops negative deltas and changed sessions, then resumes on next sample", () => {
    const previous = sampleTraffic(
      { downloadBytes: 1000, uploadBytes: 100, sessionId: "old" },
      "UniFi",
      first,
    );
    const reset = sampleTraffic(
      { downloadBytes: 10, uploadBytes: 10, sessionId: "new" },
      "UniFi",
      second,
      previous,
    );
    expect(reset).toMatchObject({
      downloadBps: null,
      uploadBps: null,
      reason: "counter-reset",
    });
    expect(
      sampleTraffic(
        { downloadBytes: 20, uploadBytes: 20, sessionId: "new" },
        "UniFi",
        "2026-10-23T01:00:10.000Z",
        reset,
      ).downloadBps,
    ).toBe(16);
  });
  it("rejects stale observations and invalid counters", () => {
    const previous = sampleTraffic(
      { downloadBytes: 100, uploadBytes: 0 },
      "UniFi",
      first,
    );
    expect(
      sampleTraffic(
        { downloadBytes: 1000, uploadBytes: 0 },
        "UniFi",
        "2026-10-23T01:01:00.000Z",
        previous,
      ),
    ).toMatchObject({ downloadBps: null, reason: "stale-sample" });
    expect(
      sampleTraffic({ downloadBytes: -1, uploadBytes: NaN }, "UniFi", first),
    ).toMatchObject({ downloadBytes: null, uploadBytes: null });
  });
  it("retains metadata and samples links without treating uplink device totals as link counters", () => {
    const devices = [
      {
        mac: "aa",
        type: "usw",
        port_table: [
          {
            port_idx: 4,
            speed: 1000,
            poe_power: 6.2,
            tx_bytes: 500,
            rx_bytes: 100,
          },
        ],
      },
      {
        mac: "bb",
        type: "uap",
        tx_bytes: 999,
        rx_bytes: 500,
        uplink: { mac: "aa" },
        radio_table: [{ channel: 36 }],
      },
    ];
    const previous = sampleTopology(
      buildUnifiTopology(
        devices,
        [{ mac: "cc", ap_mac: "bb", tx_bytes: 10, rx_bytes: 5 }],
        first,
      ),
    );
    const graph = buildUnifiTopology(
      devices,
      [{ mac: "cc", ap_mac: "bb", tx_bytes: 635, rx_bytes: 130 }],
      second,
    );
    const next = sampleTopology(graph, previous);
    expect(next.nodes["client:cc"].downloadBps).toBe(1000);
    expect(Object.values(next.links).some((t) => t.downloadBps === 1000)).toBe(
      true,
    );
    expect(
      graph.nodes.find((n) => n.id === "device:bb")?.meta?.radioTable,
    ).toEqual([{ channel: 36 }]);
    expect(
      graph.links.find((e) => e.type === "uplink")?.traffic?.downloadBps,
    ).toBeNull();
  });
  it("adds Hotspot counters to known bridge hosts and leaves unknown sessions isolated", () => {
    const graph = buildMikrotikTopology(
      { name: "R" },
      [{ name: "ether1" }],
      [],
      [{ "mac-address": "AA", "on-interface": "ether1" }],
      [],
      first,
      [],
      [
        {
          "mac-address": "AA",
          address: "10.0.0.2",
          "bytes-out": "500",
          "bytes-in": "200",
        },
        { "mac-address": "BB", "bytes-out": "100" },
      ],
    );
    expect(graph.nodes.find((n) => n.id === "client:aa")).toMatchObject({
      ip: "10.0.0.2",
      traffic: { downloadBytes: 500, uploadBytes: 200 },
    });
    expect(graph.nodes.find((n) => n.id === "client:bb")?.group).toBe(
      "unknown",
    );
    expect(graph.links.some((e) => e.target === "client:bb")).toBe(false);
  });
});

describe("traffic perspective and counter source regression", () => {
  it("maps child uplink RX as download and parent port TX as download", () => {
    const graph = buildUnifiTopology(
      [
        { mac: "aa", type: "usw" },
        {
          mac: "bb",
          type: "uap",
          uplink: {
            mac: "aa",
            rx_bytes: 900,
            tx_bytes: 100,
            "rx_bytes-r": 90,
            "tx_bytes-r": 10,
          },
        },
      ],
      [],
      first,
    );
    expect(graph.links[0].traffic).toMatchObject({
      downloadBytes: 900,
      uploadBytes: 100,
      downloadBps: 720,
      uploadBps: 80,
      perspective: "user",
    });
    const parentPort = buildUnifiTopology(
      [
        {
          mac: "aa",
          type: "usw",
          port_table: [{ port_idx: 4, tx_bytes: 800, rx_bytes: 200 }],
        },
        {
          mac: "bb",
          type: "uap",
          uplink: {
            mac: "aa",
            uplink_remote_port: 4,
            rx_bytes: 900,
            tx_bytes: 100,
          },
        },
      ],
      [],
      first,
    );
    expect(parentPort.links[0].traffic).toMatchObject({
      downloadBytes: 800,
      uploadBytes: 200,
      source: "UniFi · port_table",
    });
  });
  it("retains client and uplink measurements when a port only reports speed/PoE", () => {
    const devices = [
      {
        mac: "aa",
        type: "usw",
        port_table: [{ port_idx: 4, speed: 1000, poe_power: 6.2 }],
      },
      {
        mac: "bb",
        type: "uap",
        uplink: {
          mac: "aa",
          uplink_remote_port: 4,
          rx_bytes: 900,
          tx_bytes: 100,
          "rx_bytes-r": 90,
          "tx_bytes-r": 10,
        },
      },
    ];
    const graph = buildUnifiTopology(
      devices,
      [
        {
          mac: "cc",
          sw_mac: "aa",
          sw_port: 4,
          tx_bytes: 500,
          rx_bytes: 50,
          "tx_bytes-r": 50,
          "rx_bytes-r": 5,
        },
      ],
      first,
    );
    expect(graph.links.find((e) => e.type === "uplink")).toMatchObject({
      speedMbps: 1000,
      poeWatts: 6.2,
      traffic: { downloadBps: 720, uploadBps: 80 },
    });
    expect(graph.links.find((e) => e.type === "wired")).toMatchObject({
      speedMbps: 1000,
      poeWatts: 6.2,
      traffic: { downloadBps: 400, uploadBps: 40 },
    });
  });
  it("preserves raw MikroTik interface perspective across delta sampling", () => {
    const graph = (tx: number, rx: number, time: string) =>
      buildMikrotikTopology(
        { name: "R" },
        [{ name: "ether1", "tx-byte": tx, "rx-byte": rx }],
        [],
        [],
        [],
        time,
      );
    const previous = sampleTopology(graph(100, 200, first));
    const next = sampleTopology(graph(725, 1450, second), previous);
    expect(next.nodes["interface:ether1"]).toMatchObject({
      perspective: "interface",
      downloadBps: 1000,
      uploadBps: 2000,
    });
    expect(Object.values(next.links)[0].perspective).toBe("interface");
    expect(
      sampleTraffic(
        mikrotikCounters({ "bytes-out": 500, "bytes-in": 100 }, true),
        "MikroTik",
        first,
      ).perspective,
    ).toBe("user");
  });
  it("only creates a labelled inferred WAN for an active gateway WAN address", () => {
    const gateway = { mac: "aa", type: "ugw" };
    expect(
      buildUnifiTopology([gateway], [], first).nodes.some(
        (n) => n.type === "wan",
      ),
    ).toBe(false);
    expect(
      buildUnifiTopology(
        [{ ...gateway, wan1: { ip: "0.0.0.0", up: true } }],
        [],
        first,
      ).nodes.some((n) => n.type === "wan"),
    ).toBe(false);
    expect(
      buildUnifiTopology(
        [{ ...gateway, wan1: { ip: "192.0.2.1", up: false } }],
        [],
        first,
      ).nodes.some((n) => n.type === "wan"),
    ).toBe(false);
    const graph = buildUnifiTopology(
      [
        {
          ...gateway,
          wan1: { ip: "192.0.2.1", up: true, rx_bytes: 900, tx_bytes: 100 },
        },
      ],
      [],
      first,
    );
    expect(graph.nodes.find((n) => n.type === "wan")).toMatchObject({
      name: "Internet / WAN · suy ra",
      meta: { inferred: true, source: "device.wan1" },
    });
    expect(graph.links[0]).toMatchObject({
      inferred: true,
      source: "wan:device:aa",
      target: "device:aa",
      traffic: { downloadBytes: 900, uploadBytes: 100 },
    });
  });
});
