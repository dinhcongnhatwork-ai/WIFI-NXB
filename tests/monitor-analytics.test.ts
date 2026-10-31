import { monitorWindow } from "../src/lib/monitor/core";
import { describe, expect, it } from "vitest";
import {
  availability,
  downsample,
  percentile,
} from "../src/lib/monitor/analytics";

describe("monitor dashboard data integrity", () => {
  it("bounds LTTB histories and preserves peaks, endpoints and null outage markers", () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({
      at: i * 30000,
      value: i === 2500 ? 1000 : i === 5000 ? null : Math.sin(i / 100),
    }));
    const sampled = downsample(rows);
    expect(sampled.length).toBeLessThanOrEqual(500);
    expect(sampled[0]).toEqual(rows[0]);
    expect(sampled.at(-1)).toEqual(rows.at(-1));
    expect(sampled.some((p) => p.value === 1000)).toBe(true);
    expect(sampled.some((p) => p.value === null)).toBe(true);
    for (let i = 1; i < sampled.length; i++)
      expect(sampled[i].at).toBeGreaterThan(sampled[i - 1].at);
  });
  it("never bridges missing data in highly fragmented samples", () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({
      at: i,
      value: i % 2 ? null : 1,
    }));
    const sampled = downsample(rows);
    expect(sampled.length).toBeLessThanOrEqual(500);
    expect(sampled.every((p) => p.value === null)).toBe(true);
  });
  it("reports time-weighted availability and separate unknown coverage", () => {
    const result = availability(
      [
        { at: 0, value: 1 },
        { at: 30000, value: 0 },
        { at: 60000, value: null },
        { at: 180000, value: 1 },
      ],
      0,
      300000,
      30000,
    );
    expect(result.observedMs).toBe(90000);
    expect(result.missingMs).toBe(210000);
    expect(result.percent).toBeCloseTo(66.6667, 3);
    expect(availability([], 0, 1000).percent).toBeNull();
  });
  it("weights hourly fractional trend availability without rounding it up", () => {
    expect(availability([{ at: 0, value: 0.5 }], 0, 3600000, 3600000)).toEqual({
      percent: 50,
      observedMs: 3600000,
      missingMs: 0,
    });
  });
  it("does not claim a complete observed hour from one trend sample", () => {
    expect(
      availability([{ at: 0, value: 1, samples: 1 }], 0, 3600000, 3600000),
    ).toEqual({ percent: 100, observedMs: 30000, missingMs: 3570000 });
    expect(
      availability([{ at: 0, value: 1, samples: 0 }], 0, 3600000, 3600000)
        .percent,
    ).toBeNull();
  });
  it("computes p95 from valid observations while retaining true zero", () => {
    expect(percentile([{ at: 0, value: null }])).toBeNull();
    expect(percentile([{ at: 0, value: 0 }])).toBe(0);
    expect(
      percentile(
        Array.from({ length: 100 }, (_, i) => ({ at: i, value: i + 1 })),
      ),
    ).toBe(95);
  });
});

describe("monitor custom time windows", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("keeps presets rolling and accepts bounded explicit instants with timezone", () => {
    expect(monitorWindow(new URLSearchParams("time=6h"), now)).toEqual({
      seconds: 21600,
    });
    expect(
      monitorWindow(
        new URLSearchParams({
          time: "custom",
          from: "2026-10-22T19:00:00+07:00",
          to: "2026-10-23T12:00:00Z",
        }),
        now,
      ),
    ).toEqual({ seconds: 86400, start: now - 86400000, end: now });
  });
  it("rejects incomplete, reversed, future, invalid calendar and longer than thirty day windows", () => {
    for (const params of [
      { time: "custom" },
      { from: "2026-10-22T12:00:00Z" },
      { from: "2026-10-22T12:00:00", to: "2026-10-23T12:00:00Z" },
      { from: "2026-10-23T12:00:00Z", to: "2026-10-22T12:00:00Z" },
      { from: "2026-09-01T12:00:00Z", to: "2026-10-23T12:00:00Z" },
      { from: "2026-10-23T12:00:00Z", to: "2026-10-24T12:00:00Z" },
      { from: "2026-02-31T12:00:00Z", to: "2026-03-02T12:00:00Z" },
    ])
      expect(
        monitorWindow(
          new URLSearchParams(
            Object.entries(params).map(([key, value]) => [key, value ?? ""]),
          ),
          now,
        ).error,
      ).toBeTruthy();
  });
});
