import { describe, it, expect } from "vitest";
import {
  accessPointLayout,
  clientsOf,
  duration,
  latestTraffic,
} from "@/components/network/topology/ap-model";
import type { Topology } from "@/lib/network/topology";
const graph: Topology = {
  observedAt: "2026-10-24T09:00:00Z",
  warnings: [],
  nodes: [
    { id: "ap1", type: "ap", name: "AP 1" },
    { id: "ap2", type: "ap", name: "AP 2" },
    { id: "phone", type: "client", name: "iPhone An" },
    { id: "pc", type: "client", name: "Laptop Bình" },
  ],
  links: [
    {
      id: "one",
      source: "ap1",
      target: "phone",
      type: "wireless",
      layer: "physical",
      evidence: "client.ap_mac",
      observedAt: "",
    },
    {
      id: "two",
      source: "ap2",
      target: "pc",
      type: "wireless",
      layer: "physical",
      evidence: "client.ap_mac",
      observedAt: "",
    },
  ],
};
describe("AP connection workspace", () => {
  it("prefers a fresher topology sample when the traffic stream lags", () => {
    const older = {
      downloadBytes: 1,
      uploadBytes: 1,
      downloadBps: 1,
      uploadBps: 1,
      source: "UniFi",
      sampledAt: "2026-10-24T10:00:00Z",
      perspective: "user" as const,
    };
    const newer = {
      ...older,
      downloadBps: 2,
      sampledAt: "2026-10-24T10:01:00Z",
    };
    expect(latestTraffic(newer, older)).toBe(newer);
    expect(latestTraffic(older, newer)).toBe(newer);
  });
  it("uses observed AP links rather than inferring membership from device names or SSIDs", () => {
    expect(clientsOf(graph, "ap1").map((d) => d.name)).toEqual(["iPhone An"]);
    expect(clientsOf(graph, "ap2").map((d) => d.name)).toEqual(["Laptop Bình"]);
  });
  it("shows every associated client directly with the actual AP as parent", () => {
    const clients = Array.from({ length: 45 }, (_, i) => ({
      id: `c${i}`,
      type: "client",
      name: `Device ${i}`,
    }));
    const links = clients.map((c) => ({
      ...graph.links[0],
      id: c.id,
      target: c.id,
    }));
    const result = accessPointLayout(graph.nodes[0], clients, links, 3);
    expect(result.nodes).toHaveLength(46);
    expect(result.edges).toHaveLength(45);
    expect(result.edges.every((e) => e.source === "ap1")).toBe(true);
    expect(result.nodes.every((n) => Number(n.style?.width) >= 300)).toBe(true);
  });
  it("centers the AP over the actual client branches when the viewport has spare columns", () => {
    const pair = [graph.nodes[2], graph.nodes[3]];
    const links = pair.map((c) => ({
      ...graph.links[0],
      id: c.id,
      target: c.id,
    }));
    const result = accessPointLayout(graph.nodes[0], pair, links, 3);
    const centers = result.nodes.map(
      (n) => n.position.x + Number(n.style?.width) / 2,
    );
    expect(centers[0]).toBe((centers[1] + centers[2]) / 2);
  });
  it("formats actual connected duration without treating epoch dates as uptime", () => {
    expect(duration(3660)).toBe("1 giờ 1 phút");
    expect(duration(undefined)).toBe("—");
  });
});
