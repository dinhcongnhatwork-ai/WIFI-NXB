import { describe, it, expect, vi } from "vitest";
import {
  counterRate,
  percentUsed,
  dataQuality,
  withLease,
  mapLimited,
  csvCell,
  RELEASE_LOCK,
} from "../src/lib/monitor/core";
describe("monitor data integrity", () => {
  it("does not invent samples for missing or invalid resources", () => {
    expect(percentUsed(undefined, 100)).toBeUndefined();
    expect(percentUsed(10, 0)).toBeUndefined();
    expect(percentUsed(110, 100)).toBeUndefined();
    expect(percentUsed(25, 100)).toBe(75);
    expect(dataQuality(null)).toBe("missing");
    expect(dataQuality(new Date(0), 100000)).toBe("stale");
  });
  it("handles interface reset, reboot, stale data, clock reversal and initial baseline", () => {
    expect(counterRate(null, 10, 2000)).toBeNull();
    const p = { value: 100, at: 1000, boot: "a" };
    expect(counterRate(p, 300, 2000, "a")).toBe(200);
    expect(counterRate(p, 50, 2000, "a")).toBeNull();
    expect(counterRate(p, 300, 2000, "b")).toBeNull();
    expect(counterRate(p, 300, 1000, "a")).toBeNull();
    expect(counterRate(p, 300, 100000, "a")).toBeNull();
  });
  it("neutralizes spreadsheet formula injection including whitespace", () => {
    expect(csvCell(' =HYPERLINK("x")')).toBe('"\' =HYPERLINK(""x"")"');
    expect(csvCell("hello,world")).toBe('"hello,world"');
  });
  it("does not execute when another collector owns lease", async () => {
    const task = vi.fn();
    await withLease({ set: async () => null, eval: vi.fn() }, "lock", task);
    expect(task).not.toHaveBeenCalled();
  });
  it("releases lease by token comparison after task failure", async () => {
    const evalMock = vi.fn(async () => 1);
    await expect(
      withLease({ set: async () => "OK", eval: evalMock }, "lock", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(evalMock).toHaveBeenCalledWith(
      RELEASE_LOCK,
      1,
      "lock",
      expect.any(String),
    );
    expect(RELEASE_LOCK).toContain("== ARGV[1]");
  });
  it("caps concurrent device requests and preserves failures", async () => {
    let active = 0,
      peak = 0;
    const result = await mapLimited([1, 2, 3, 4, 5], 2, async (v) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      if (v === 3) throw new Error("failure");
      return v;
    });
    expect(peak).toBe(2);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(result).toHaveLength(5);
  });
});
