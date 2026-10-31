import { describe, it, expect } from "vitest";
import { buildLayout } from "@/components/network/topology/layout";
import {
  aggregate,
  particleCount,
  particleDuration,
} from "@/components/network/topology/model";
import type { Topology } from "@/lib/network/topology";
const at = "2026-10-23T01:00:00Z";
const fixture = (count = 40): Topology => ({
  observedAt: at,
  warnings: [],
  nodes: [
    { id: "gw", type: "gateway", name: "GW" },
    { id: "ap", type: "ap", name: "AP" },
    ...Array.from({ length: count }, (_, i) => ({
      id: `c${String(i).padStart(3, "0")}`,
      type: "client",
      name: `Client ${i}`,
      meta: { ssid: "Office" },
    })),
    { id: "unknown", type: "client", name: "Unknown", group: "unknown" },
  ],
  links: [
    {
      id: "gw-ap",
      source: "gw",
      target: "ap",
      type: "uplink",
      layer: "physical",
      evidence: "device.uplink",
      observedAt: at,
    },
    ...Array.from({ length: count }, (_, i) => ({
      id: `edge${i}`,
      source: "ap",
      target: `c${String(i).padStart(3, "0")}`,
      type: "wireless",
      layer: "physical" as const,
      evidence: "client.ap_mac",
      observedAt: at,
    })),
  ],
});
const options = {
  hideClients: false,
  layer: "all",
  grouping: "ap",
  expanded: new Set<string>(),
};
describe("production topology presentation", () => {
  it("collapses 300 clients into a readable AP cluster without inventing unknown links", () => {
    const layout = buildLayout(fixture(300), options);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.clusters.get("cluster:ap")).toHaveLength(300);
    expect(layout.edges).toHaveLength(2);
    expect(layout.edges.some((e) => e.target === "unknown")).toBe(false);
  });
  it("caps expanded clients at 30 while keeping all members available in the drawer", () => {
    const layout = buildLayout(fixture(), {
      ...options,
      expanded: new Set(["cluster:ap"]),
    });
    expect(
      layout.nodes.filter((n) => n.data.device.type === "client"),
    ).toHaveLength(30);
    expect(layout.clusters.get("cluster:ap")).toHaveLength(40);
  });
  it("keeps role order and stable positions across source-order and counter changes", () => {
    const topology = fixture();
    const a = buildLayout(topology, options);
    const b = buildLayout(
      {
        ...topology,
        nodes: [...topology.nodes].reverse(),
        links: [...topology.links].reverse(),
      },
      options,
    );
    expect(a.nodes.map((n) => [n.id, n.position])).toEqual(
      b.nodes.map((n) => [n.id, n.position]),
    );
    expect(a.nodes.find((n) => n.id === "gw")!.position.y).toBeLessThan(
      a.nodes.find((n) => n.id === "ap")!.position.y,
    );
  });
  it("groups by SSID and hides all client clusters when requested", () => {
    expect(
      buildLayout(fixture(), { ...options, grouping: "ssid" }).clusters.has(
        "cluster:ssid:Office",
      ),
    ).toBe(true);
    expect(
      buildLayout(fixture(), { ...options, hideClients: true }).nodes,
    ).toHaveLength(2);
  });
  it("contains bidirectional AP uplinks without inflating ranks or dropping observed edges", () => {
    const graph: Topology = {
      observedAt: at, warnings: [],
      nodes: [{ id: "a", type: "ap", name: "AP A" }, { id: "b", type: "ap", name: "AP B" }, { id: "c", type: "client", name: "Phone" }],
      links: [["a", "b"], ["b", "a"], ["b", "c"]].map(([source, target]) => ({ id: `${source}-${target}`, source, target, type: "uplink", layer: "physical", evidence: "fixture", observedAt: at })),
    };
    const layout = buildLayout(graph, options);
    const a = layout.nodes.find(n => n.id === "a")!;
    const b = layout.nodes.find(n => n.id === "b")!;
    const cluster = layout.nodes.find(n => n.id === "cluster:b")!;
    expect(a.position.y).toBe(b.position.y);
    expect(cluster.position.y).toBeGreaterThan(b.position.y);
    expect(Math.max(...layout.nodes.map(n => n.position.y))).toBeLessThan(1000);
    expect(layout.edges.filter(e => ["a-b", "b-a"].includes(e.id))).toHaveLength(2);
  });
  it("centers each tree parent above its own children instead of packing devices in rows", () => {
    const graph: Topology = { observedAt: at, warnings: [], nodes: [
      {id: "gateway", type: "gateway", name: "Gateway"},
      ...["a", "b", "c"].map(id => ({id, type:"switch", name:id})),
    ], links: ["a", "b", "c"].map(id => ({id, source:"gateway", target:id, type:"uplink", layer:"physical", evidence:"fixture", observedAt:at})) };
    const nodes = buildLayout(graph, options).nodes;
    const center = (id: string) => { const node = nodes.find(n => n.id === id)!; return node.position.x + Number(node.style?.width) / 2; };
    expect(center("gateway")).toBeCloseTo((center("a") + center("c")) / 2, 1);
    expect(nodes.find(n => n.id === "gateway")!.position.y).toBeLessThan(nodes.find(n => n.id === "a")!.position.y);
  });
  it("groups unmapped AP branches explicitly and never invents a physical gateway", () => {
    const graph: Topology = { observedAt: at, warnings: [], nodes: Array.from({length:37}, (_,i) => ({id:`ap${i}`,type:"ap",name:`AP ${i}`})), links:[] };
    const collapsed = buildLayout(graph, options);
    expect(collapsed.clusters.get("branch:unmapped")).toHaveLength(37);
    expect(collapsed.nodes.some(n => ["gateway", "switch", "wan"].includes(n.data.device.type))).toBe(false);
    expect(collapsed.edges.every(e => (e.data?.link as {layer:string}).layer === "logical")).toBe(true);
    const expanded = buildLayout(graph, {...options, expanded:new Set(["branch:unmapped"])});
    expect(expanded.nodes.filter(n => n.data.device.type === "ap")).toHaveLength(37);
    expect(expanded.edges.every(e => (e.data?.link as {layer:string}).layer === "logical")).toBe(true);
  });
  it("keeps animation bounded for extreme traffic without animating missing values", () => {
    expect(particleCount(null)).toBe(0);
    expect(particleCount(0)).toBe(0);
    expect(particleCount(1e4)).toBeGreaterThan(0);
    expect(particleCount(1e12)).toBeLessThanOrEqual(5);
    expect(particleCount(1e12)).toBeGreaterThanOrEqual(particleCount(1e4));
    expect(particleDuration(1e12)).toBeLessThanOrEqual(particleDuration(1));
    expect(particleDuration(1e12)).toBeGreaterThanOrEqual(0.8);
    expect(particleDuration(1)).toBeLessThanOrEqual(10);
  });
  it("does not turn unknown totals into zero or combine different sources", () => {
    const sample = {
      downloadBytes: 10,
      uploadBytes: 20,
      downloadBps: 100,
      uploadBps: 200,
      source: "UniFi",
      sampledAt: at,
    };
    expect(aggregate([sample, undefined])).toBeUndefined();
    expect(
      aggregate([sample, { ...sample, source: "Hotspot" }]),
    ).toBeUndefined();
    expect(
      aggregate([sample, { ...sample, downloadBps: null }])?.downloadBps,
    ).toBeNull();
    expect(aggregate([sample, sample])?.downloadBps).toBe(200);
  });
});
