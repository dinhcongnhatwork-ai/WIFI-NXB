import { describe, expect, it } from "vitest";
import { sampleTrafficPath } from "@/components/network/topology/traffic-path-sampling";

const corner = 5013;
const path = {
  getAttribute: () => `M 0 0 L ${corner} 0 L ${corner} ${10000-corner}`,
  getTotalLength: () => 10000,
  getPointAtLength: (at: number) => at <= corner ? { x: at, y: 0 } : { x: corner, y: at - corner },
};

function interpolatedCorner(points: { x: number; y: number }[]) {
  const index = corner / path.getTotalLength() * (points.length - 1);
  const low = Math.floor(index), high = Math.ceil(index), fraction = index - low;
  return { x: points[low].x + (points[high].x - points[low].x) * fraction, y: points[low].y + (points[high].y - points[low].y) * fraction };
}

describe("long traffic cable sampling", () => {
  it("keeps interpolated motion within two flow pixels at long outside-bus corners", () => {
    const point = interpolatedCorner(sampleTrafficPath(path));
    expect(Math.hypot(point.x - corner, point.y)).toBeLessThan(2);
  });
  it("samples rounded generated paths without synchronous native geometry calls", () => {
    const points = sampleTrafficPath({ getAttribute: () => "M 0 0 L 4984 0 Q 5000 0 5000 16 L 5000 5000", getTotalLength: () => { throw Error("native length should not be read"); }, getPointAtLength: () => { throw Error("native sampling should not be called"); } });
    expect(points.length).toBeGreaterThan(2000);
    expect(points[points.length - 1]).toEqual({ x: 5000, y: 5000 });
  });
  it("bounds sampling memory while retaining exact endpoints", () => {
    const points = sampleTrafficPath({ getAttribute: () => "M 0 0 L 1000000 0", getTotalLength: () => 1000000, getPointAtLength: (at: number) => ({ x: at, y: 0 }) });
    expect(points.length).toBeLessThanOrEqual(8193);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 1000000, y: 0 });
  });
});
