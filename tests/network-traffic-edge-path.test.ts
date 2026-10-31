import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import { networkTrafficPaths } from "@/components/network/topology/network-traffic-paths";
import { networkTrafficState } from "@/components/network/topology/network-traffic-state";

const endpoints = { sourceX: 100, sourceY: 100, targetX: 500, targetY: 500, sourcePosition: Position.Bottom, targetPosition: Position.Top };

describe("traffic cable routing", () => {
  it("keeps a multirow cable on its outside bus with rounded orthogonal corners", () => {
    const result = networkTrafficPaths({ ...endpoints, routePoints: [{ x: 100, y: 160 }, { x: 20, y: 160 }, { x: 20, y: 440 }, { x: 500, y: 440 }] });
    expect(result.path).toMatch(/^M 100 100 L 100 /);
    expect(result.path).toContain("Q 20 160 20 176");
    expect(result.path).toContain("Q 20 440 36 440");
    expect(result.path).toMatch(/L 500 500$/);
    expect(result.path).not.toContain("C");
    expect(result.downloadPath).toMatch(/^M 96.5 100 /);
    expect(result.uploadPath).toMatch(/^M 103.5 100 /);
    // The two sides of every bend remain parallel, including the outside bus.
    expect(result.downloadPath).toContain("Q 16.5 156.5 16.5 172.5");
    expect(result.uploadPath).toContain("Q 23.5 163.5 23.5 179.5");
  });

  it("routes ordinary cables with smoothstep turns", () => {
    const result = networkTrafficPaths({ ...endpoints, sourcePosition: Position.Right, targetPosition: Position.Left });
    expect(result.path).not.toContain("C");
    expect(result.path).toContain("Q");
    expect(result.downloadPath).toContain("M100 96.5");
    expect(result.uploadPath).toContain("M100 103.5");
  });

  it("keeps base and lane paths finite when an outside-bus route doubles back to a previous corner", () => {
    const result = networkTrafficPaths({ ...endpoints, targetX: 100, routePoints: [{ x: 100, y: 140 }, { x: 500, y: 140 }, { x: 100, y: 140 }] });
    for (const path of [result.path, result.downloadPath, result.uploadPath]) {
      expect(path).not.toMatch(/NaN|Infinity/);
    }
  });

  it("bounds lane joins when measured handle coordinates make a nearly reversing segment", () => {
    const result = networkTrafficPaths({ ...endpoints, sourceX: 100 + 1e-12, routePoints: [{ x: 100, y: 140 }, { x: 100, y: 100 }, { x: 500, y: 100 }] });
    for (const path of [result.path, result.downloadPath, result.uploadPath]) {
      expect(path).not.toMatch(/NaN|Infinity/);
      const numbers = path.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/g)!.map(Number);
      expect(Math.max(...numbers.map(Math.abs))).toBeLessThan(550);
    }
  });

  it("accepts duplicated and collinear bus points without invalid geometry", () => {
    const result = networkTrafficPaths({ ...endpoints, routePoints: [{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 100, y: 300 }, { x: 500, y: 300 }, { x: 500, y: 500 }] });
    expect(result.path).not.toMatch(/NaN|Infinity/);
    expect(result.path.match(/Q/g)).toHaveLength(2);
  });
});

const clock = Date.parse("2026-10-29T10:00:00Z");
const input = { link: { sourcePort: "ether7", evidence: "/ip/neighbor", type: "neighbor" }, traffic: { perspective: "interface", downloadBps: 123000, uploadBps: 32000, sampledAt: new Date(clock).toISOString() }, clock, animate: true } as any;
describe("observed traffic motion", () => {
  it("normalizes interface RX to the blue receive lane and TX to the green send lane once", () => {
    const state = networkTrafficState(input);
    expect(state.direction.receive).toBe(32000);
    expect(state.direction.send).toBe(123000);
    expect(state.reverse).toBe(true);
    expect(state.active).toBe(true);
  });

  it.each([
    { animate: false },
    { offline: true },
    { clock: clock + 30001 },
    { traffic: { ...input.traffic, sampledAt: "invalid" } },
    { traffic: { ...input.traffic, downloadBps: 0, uploadBps: 0 } },
    { link: { ...input.link, sourcePort: undefined } },
    { link: { ...input.link, type: "organization" } },
  ])("does not register motion for unavailable or disabled traffic: %o", (patch) => {
    expect(networkTrafficState({ ...input, ...patch }).active).toBe(false);
  });
});
