import { describe, it, expect } from "vitest";
import {
  buildNetworkLayout,
  revealAncestors,
  trafficDirections,
  filterNetworkTopology,
} from "@/components/network/topology/network-layout";
import type { Topology } from "@/lib/network/topology";
const at = "2026-10-27T10:00:00Z";
const fixture = (): Topology => ({
  observedAt: at,
  warnings: [],
  nodes: [
    { id: "r", type: "gateway", name: "Router" },
    { id: "ap", type: "ap", name: "AP 1" },
    { id: "c", type: "client", name: "Laptop An", ip: "10.0.0.12" },
  ],
  links: [
    {
      id: "r-ap",
      source: "r",
      target: "ap",
      type: "uplink",
      layer: "physical",
      evidence: "observed",
      observedAt: at,
    },
    {
      id: "ap-c",
      source: "ap",
      target: "c",
      type: "wireless",
      layer: "physical",
      evidence: "client.ap_mac",
      observedAt: at,
    },
  ],
});
describe("readable observed network tree", () => {
  it("collapses clients without losing observed infrastructure and counts hidden clients", () => {
    const r = buildNetworkLayout(fixture(), { expanded: new Set() });
    expect(r.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["r", "ap"]),
    );
    expect(r.nodes.some((n) => n.id === "c")).toBe(false);
    expect(r.nodes.find((n) => n.id === "ap")?.data.childCount).toBe(1);
  });
  it("expands every associated client with actual observed edge ids and left to right positioning", () => {
    const r = buildNetworkLayout(fixture(), { expanded: new Set(["ap"]) });
    expect(r.nodes).toHaveLength(3);
    expect(r.edges.map((e) => e.id)).toEqual(["r-ap", "ap-c"]);
    const p = Object.fromEntries(r.nodes.map((n) => [n.id, n.position]));
    expect(p.r.x).toBeLessThan(p.ap.x);
    expect(p.ap.x).toBeLessThan(p.c.x);
    expect(r.nodes.filter(n=>n.data.device.type!=="client").every(n=>Number(n.style?.width)===260)).toBe(true);
    expect(r.nodes.find(n=>n.id==="c")?.style).toMatchObject({width:176,height:132});
  });
  it("groups missing uplinks without creating a physical controller or synthetic link rates", () => {
    const g = fixture();
    g.nodes = g.nodes.filter((n) => n.id !== "r");
    g.links = g.links.filter((e) => e.id !== "r-ap");
    const r = buildNetworkLayout(g, { expanded: new Set() });
    expect(r.nodes.some((n) => n.data.device.type === "gateway")).toBe(false);
    const group = r.nodes.find((n) => n.data.device.meta?.layoutOnly);
    expect(group?.data.device.name).toBe("Chưa xác định uplink");
    expect(
      r.edges.every(
        (e) =>
          e.data?.link.layer === "logical" &&
          !e.data?.traffic &&
          !e.data?.link.speedMbps,
      ),
    ).toBe(true);
  });
  it("reveals all ancestors for search without looping on bidirectional uplinks", () => {
    const g = fixture();
    g.links.push({ ...g.links[0], id: "reverse", source: "ap", target: "r" });
    expect(Array.from(revealAncestors(g, "c")).sort()).toEqual(["ap", "r"]);
    const r = buildNetworkLayout(g, { expanded: new Set(["ap"]) });
    expect(
      r.nodes.every(
        (n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y),
      ),
    ).toBe(true);
    expect(r.edges.map((e) => e.id)).toContain("reverse");
  });
  it("keeps layout identical when only observed throughput changes", () => {
    const g = fixture();
    const a = buildNetworkLayout(g, { expanded: new Set(["ap"]) });
    g.nodes[1].traffic = {
      downloadBytes: 1,
      uploadBytes: 1,
      downloadBps: 99,
      uploadBps: 0,
      source: "UniFi",
      sampledAt: at,
    };
    const b = buildNetworkLayout(g, { expanded: new Set(["ap"]) });
    expect(b.nodes.map((n) => [n.id, n.position])).toEqual(
      a.nodes.map((n) => [n.id, n.position]),
    );
  });
  it("exposes TX/RX correctly from the existing interface contract, without relabeling as user download", () => {
    expect(
      trafficDirections({
        perspective: "interface",
        downloadBps: 800,
        uploadBps: 1600,
      }),
    ).toMatchObject({
      receive: 1600,
      send: 800,
      receiveLabel: "RX · Nhận",
      sendLabel: "TX · Gửi",
    });
    expect(
      trafficDirections({ downloadBps: 0, uploadBps: null }),
    ).toMatchObject({
      receive: 0,
      send: null,
      receiveLabel: "Tải xuống",
      sendLabel: "Tải lên",
    });
  });
  it("keeps every observed descendant when focusing an AP with a mesh child", () => {
    const g = fixture();
    g.nodes.push(
      { id: "mesh", type: "ap", name: "Mesh AP" },
      { id: "nested", type: "client", name: "Nested phone" },
    );
    g.links.push(
      { ...g.links[0], id: "ap-mesh", source: "ap", target: "mesh" },
      { ...g.links[1], id: "mesh-nested", source: "mesh", target: "nested" },
    );
    const r = buildNetworkLayout(g, { expanded: new Set(), focusApId: "ap" });
    expect(r.nodes.map((n) => n.id).sort()).toEqual([
      "ap",
      "c",
      "mesh",
      "nested",
    ]);
    expect(r.edges.map((e) => e.id)).toContain("mesh-nested");
  });
  it("exposes the organizational parent needed to reveal an unassociated client", () => {
    const g = fixture();
    g.nodes.push({ id: "unknown", type: "client", name: "Unknown phone" });
    const r = buildNetworkLayout(g, {
      expanded: new Set(["layout:unassociated"]),
    });
    expect(r.nodes.some((n) => n.id === "unknown")).toBe(true);
    expect(
      r.edges.some(
        (e) =>
          e.source === "layout:unassociated" &&
          e.target === "unknown" &&
          e.data?.link.type === "organization",
      ),
    ).toBe(true);
  });

  it("filters device status consistently while retaining the physical parent as context", () => {
    const g = fixture();
    g.nodes[1].status = "online";
    g.nodes[2].status = "offline";
    const offline = filterNetworkTopology(g, {
      status: "offline",
      floor: "all",
    });
    expect(offline.nodes.map((n) => n.id).sort()).toEqual(["ap", "c", "r"]);
    const online = filterNetworkTopology(g, { status: "online", floor: "all" });
    expect(online.nodes.map((n) => n.id).sort()).toEqual(["ap", "r"]);
  });
  it("filters floor membership through observed AP ancestors and preserves metadata over name inference", () => {
    const g = fixture();
    g.nodes[1].name = "AP9.1";
    g.nodes[1].meta = { floor: 2 };
    expect(
      filterNetworkTopology(g, { status: "all", floor: "2" })
        .nodes.map((n) => n.id)
        .sort(),
    ).toEqual(["ap", "c", "r"]);
    expect(
      filterNetworkTopology(g, { status: "all", floor: "9" }).nodes,
    ).toHaveLength(0);
  });
  it("does not count disconnected devices as online merely because the word contains connected", () => {
    const g = fixture();
    g.nodes[1].status = "disconnected";
    g.nodes[2].status = "observed";
    expect(
      filterNetworkTopology(g, { status: "online", floor: "all" }).nodes,
    ).toHaveLength(0);
  });
  it("arranges sibling APs into stable named columns and reserves room for expanded clients", () => {
    const g: Topology = {
      observedAt: at,
      warnings: [],
      nodes: [
        { id: "gw", type: "gateway", name: "Gateway Trung tâm", status: "online" },
        { id: "ap1", type: "ap", name: "AP1.1", status: "offline" },
        { id: "ap2", type: "ap", name: "AP1.2", status: "offline" },
        { id: "ap3", type: "ap", name: "AP3.2", status: "online" },
        { id: "ap4", type: "ap", name: "AP4.1", status: "online" },
        { id: "ap5", type: "ap", name: "AP5.2", status: "online" },
        { id: "ap6", type: "ap", name: "AP6.2", status: "online" },
        { id: "c1", type: "client", name: "iPhone", status: "observed" },
      ],
      links: [
        ...["ap1", "ap2", "ap3", "ap4", "ap5", "ap6"].map((target) => ({
          id: `gw-${target}`,
          source: "gw",
          target,
          type: "uplink",
          layer: "physical" as const,
          evidence: "device.uplink",
          observedAt: at,
        })),
        {
          id: "ap6-c1",
          source: "ap6",
          target: "c1",
          type: "wireless",
          layer: "physical" as const,
          evidence: "client.ap_mac",
          observedAt: at,
        },
      ],
    };
    const r = buildNetworkLayout(g, { expanded: new Set(["ap6"]) });
    const pos = Object.fromEntries(r.nodes.map((n) => [n.id, n.position]));
    const apXs = new Set(
      ["ap1", "ap2", "ap3", "ap4", "ap5", "ap6"].map((id) => pos[id].x),
    );
    expect(apXs.size).toBe(6);
    expect(pos.gw.y).toBeLessThan(pos.ap6.y);
    expect(pos.ap6.y).toBeLessThan(pos.c1.y);
    expect(pos.ap6.y).toBe(pos.ap1.y);
    expect(pos.ap1.x).toBeLessThan(pos.ap6.x);
  });
});
