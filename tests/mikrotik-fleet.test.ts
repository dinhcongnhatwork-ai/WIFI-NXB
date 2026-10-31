import { describe, it, expect } from "vitest";
import {
  mergeMikrotikFleet,
  type FleetObservation,
} from "@/lib/network/mikrotik-fleet-model";
import { buildMikrotikTopology, type Topology } from "@/lib/network/topology";
const at = "2026-10-27T12:00:00Z";
const connection = (id: string, role = "router") => ({
  id,
  name: `Device ${id}`,
  baseUrl: `https://10.0.0.${id}`,
  config: { deviceRole: role },
});
const observation = (
  id: string,
  role = "router",
): FleetObservation & { topology: Topology } => ({
  connection: connection(id, role),
  topology: buildMikrotikTopology(
    { name: `ROS ${id}`, model: role === "router" ? "RB5009" : "CRS326" },
    [
      {
        ".id": "*1",
        name: "ether1",
        "mac-address": `00:00:00:00:00:0${id}`,
        type: "ether",
        running: "true",
      },
    ],
    [],
    [],
    [],
    at,
    [],
    [],
    [{ interface: "ether1", address: `10.0.0.${id}/24` }],
  ),
});
describe("observed multi-device MikroTik topology", () => {
  it("includes all seven configured devices with distinct interface IDs and correct hardware roles", () => {
    const sources = Array.from({ length: 7 }, (_, i) =>
      observation(
        String(i + 1),
        i < 2 ? "router" : i === 2 ? "core-switch" : "access-switch",
      ),
    );
    const r = mergeMikrotikFleet(sources, [], at);
    expect(r.nodes.filter((n) => n.meta?.managed)).toHaveLength(7);
    expect(new Set(r.nodes.map((n) => n.id)).size).toBe(r.nodes.length);
    expect(r.nodes.filter((n) => n.type === "switch")).toHaveLength(5);
    expect(
      r.nodes.find((n) => n.id === "mikrotik:3:router:local")?.meta?.deviceRole,
    ).toBe("core-switch");
    expect(r.nodes.some((n) => n.ip === "192.168.1.200")).toBe(false);
  });
  it("resolves neighbor chassis MAC to a registered switch and retains actual local/remote ports", () => {
    const a = observation("1"),
      b = observation("2", "access-switch");
    a.topology.nodes.push({
      id: "neighbor:peer",
      type: "neighbor",
      name: "switch peer",
      mac: "00:00:00:00:00:02",
      ip: "10.0.0.2",
    });
    a.topology.links.push({
      id: "uplink",
      source: "interface:*1",
      target: "neighbor:peer",
      type: "neighbor",
      layer: "physical",
      evidence: "/ip/neighbor",
      sourcePort: "ether1",
      targetPort: "sfp-sfpplus1",
      observedAt: at,
    });
    const r = mergeMikrotikFleet([a, b], [], at);
    expect(r.nodes.some((n) => n.id.includes("neighbor:peer"))).toBe(false);
    expect(r.links.find((l) => l.id === "mikrotik:1:uplink")).toMatchObject({
      source: "mikrotik:1:interface:*1",
      target: "mikrotik:2:router:local",
      sourcePort: "ether1",
      targetPort: "sfp-sfpplus1",
    });
  });
  it("matches a discovered AP with UniFi identity and counts actual switch downlink ports", () => {
    const s = observation("1", "access-switch");
    s.topology.nodes.push({
      id: "neighbor:ap",
      type: "neighbor",
      name: "unknown AP",
      mac: "aa:bb:cc:dd:ee:01",
    });
    s.topology.links.push({
      id: "ap-port",
      source: "interface:*1",
      target: "neighbor:ap",
      type: "neighbor",
      layer: "physical",
      evidence: "/ip/neighbor",
      sourcePort: "ether7",
      observedAt: at,
    });
    const unifi: Topology = {
      observedAt: at,
      warnings: [],
      nodes: [
        {
          id: "device:ap",
          type: "ap",
          name: "AP Tầng 1",
          mac: "AA:BB:CC:DD:EE:01",
          status: "online",
        },
      ],
      links: [],
    };
    const r = mergeMikrotikFleet(
      [s],
      [{ connectionId: "unifi", siteId: "office", topology: unifi }],
      at,
    );
    expect(
      r.nodes.filter((n) => n.mac?.toLowerCase() === "aa:bb:cc:dd:ee:01"),
    ).toHaveLength(1);
    const root = r.nodes.find((n) => n.meta?.managed)!;
    expect(root.meta?.connectedApPorts).toBe(1);
    expect(root.meta?.portConnections[0]).toMatchObject({
      localPort: "ether7",
      peerName: "AP Tầng 1",
      peerType: "ap",
    });
  });
  it("keeps failed saved devices visible without fabricating online status or wires", () => {
    const r = mergeMikrotikFleet(
      [{ connection: connection("1"), error: "API unavailable" }],
      [],
      at,
    );
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0]).toMatchObject({
      status: "unknown",
      meta: { managed: true, collectionError: "API unavailable" },
    });
    expect(r.links).toHaveLength(0);
    expect(r.warnings.join(" ")).toContain("Device 1");
  });
  it("adds a newly registered device automatically and never joins equal interface IDs by name", () => {
    const initial = mergeMikrotikFleet([observation("1")], [], at);
    const next = mergeMikrotikFleet(
      [observation("1"), observation("2")],
      [],
      at,
    );
    expect(
      next.nodes.filter((n) => n.meta?.managed).length -
        initial.nodes.filter((n) => n.meta?.managed).length,
    ).toBe(1);
    expect(
      next.links.every(
        (l) => l.source.split(":")[1] === l.target.split(":")[1],
      ),
    ).toBe(true);
  });
  it("does not turn an ARP/FDB sighting into a direct cable to a registered device", () => {
    const a = observation("1"),
      b = observation("2");
    a.topology.nodes.push({
      id: "client:peer",
      type: "client",
      name: "same IP",
      ip: "10.0.0.2",
      mac: "00:00:00:00:00:02",
    });
    a.topology.links.push({
      id: "arp",
      source: "interface:*1",
      target: "client:peer",
      type: "arp-host",
      layer: "logical",
      evidence: "/ip/arp",
      observedAt: at,
    });
    const r = mergeMikrotikFleet([a, b], [], at);
    expect(r.links.some((l) => l.target === "mikrotik:2:router:local")).toBe(
      false,
    );
  });
  it("does not infer hardware/IP identity when the device provides no model or address", () => {
    const r = buildMikrotikTopology({}, [], [], [], [], at);
    expect(r.nodes.find((n) => n.id === "router:local")).toMatchObject({
      name: "MikroTik",
    });
    expect(r.nodes[0].ip).toBeUndefined();
    expect(r.nodes[0].meta?.model).toBeUndefined();
  });
  it("coalesces reciprocal neighbor reports into one downstream cable without creating a layout cycle", () => {
    const router = observation("1"),
      core = observation("2", "core-switch");
    for (const [from, to] of [
      [router, core],
      [core, router],
    ]) {
      const other = to.connection.id;
      from.topology.nodes.push({
        id: `neighbor:${other}`,
        type: "neighbor",
        name: other,
        ip: `10.0.0.${other}`,
      });
      from.topology.links.push({
        id: `n-${other}`,
        source: "interface:*1",
        target: `neighbor:${other}`,
        sourcePort: "ether1",
        targetPort: "ether1",
        type: "neighbor",
        layer: "physical",
        evidence: "/ip/neighbor",
        observedAt: at,
      });
    }
    const r = mergeMikrotikFleet([router, core], [], at);
    expect(r.links.filter((edge) => edge.type === "neighbor")).toHaveLength(1);
    expect(r.links.find((edge) => edge.type === "neighbor")?.target).toBe(
      "mikrotik:2:router:local",
    );
  });

  it("uses the physical port rather than bridge when a neighbor reports bridge and ethernet together", () => {
    const t = buildMikrotikTopology(
      { name: "switch" },
      [
        { name: "bridge", type: "bridge" },
        { name: "ether7", type: "ether" },
      ],
      [
        {
          identity: "AP",
          interface: "bridge,ether7",
          "mac-address": "aa:bb:cc:dd:ee:ff",
        },
      ],
      [],
      [],
      at,
    );
    expect(t.links.find((edge) => edge.type === "neighbor")).toMatchObject({
      source: "interface:ether7",
      sourcePort: "ether7",
      layer: "physical",
    });
  });
  it("does not join a reused management IP when observed chassis MAC contradicts the registered device MACs", () => {
    const a = observation("1"),
      b = observation("2");
    a.topology.nodes.push({
      id: "neighbor:wrong",
      type: "neighbor",
      name: "Other network",
      ip: "10.0.0.2",
      mac: "99:88:77:66:55:44",
    });
    a.topology.links.push({
      id: "wrong-peer",
      source: "interface:*1",
      target: "neighbor:wrong",
      type: "neighbor",
      layer: "physical",
      evidence: "/ip/neighbor",
      observedAt: at,
    });
    const result = mergeMikrotikFleet([a, b], [], at);
    expect(
      result.links.find((edge) => edge.id === "mikrotik:1:wrong-peer")?.target,
    ).toBe("mikrotik:1:neighbor:wrong");
  });
});
