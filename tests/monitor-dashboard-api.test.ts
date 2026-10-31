import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fixture = vi.hoisted(() => ({
  targets: [] as any[],
  cacheKeys: [] as string[],
  findMany: vi.fn(),
  items: vi.fn(),
  history: vi.fn(),
  call: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { monitoringTarget: { findMany: fixture.findMany } },
}));
vi.mock("@/lib/api-access", () => ({
  withPermission: (_level: string, handler: any) => handler,
}));
vi.mock("@/lib/monitor/api", () => ({
  targetWhere: (req: NextRequest) =>
    req.nextUrl.searchParams.get("connectionId")
      ? { connectionId: req.nextUrl.searchParams.get("connectionId") }
      : {},
  cachedSource: async (_key: string, load: () => Promise<any>) => {
    fixture.cacheKeys.push(_key);
    try {
      return { success: true, quality: "fresh", data: await load() };
    } catch (e) {
      return {
        success: false,
        quality: "unavailable",
        data: null,
        error: (e as Error).message,
      };
    }
  },
}));
vi.mock("@/lib/monitor/zabbix", () => ({
  zabbix: {
    items: fixture.items,
    history: fixture.history,
    call: fixture.call,
  },
}));
import {
  metricsBatch,
  summary,
  top,
  histogram,
} from "@/lib/monitor/dashboard-api";
import { metricSeries } from "@/lib/monitor/metric-series";
const req = (path: string) =>
  new NextRequest("http://localhost/api/monitor/" + path);
beforeEach(() => {
  vi.clearAllMocks();
  fixture.cacheKeys.length = 0;
  fixture.targets = [
    {
      id: "a",
      name: "AP",
      kind: "ap",
      connectionId: "one",
      zabbixHostId: "1",
      status: "online",
      lastSeenAt: new Date(),
      metadata: {
        provider: "UNIFI",
        metrics: { "cpu.percent": 25, "rx.bytes_sec": 100 },
      },
    },
  ];
  fixture.findMany.mockImplementation(async () => fixture.targets);
  fixture.items.mockResolvedValue([
    { itemid: "10", key_: "cpu.percent", name: "CPU", value_type: "0" },
    { itemid: "11", key_: "available", name: "Available", value_type: "0" },
  ]);
  fixture.history.mockResolvedValue([{ at: Date.now() - 30000, value: 25 }]);
  fixture.call.mockResolvedValue([]);
});
describe("bounded monitoring dashboard queries", () => {
  it("rejects oversized cross products and unsupported metrics before upstream work", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => String(i)).join(",");
    expect(
      (
        await metricsBatch(
          req(
            `metrics/batch?targetIds=${ids}&metrics=cpu.percent,memory.percent,disk.percent,available,uptime.seconds,response.ms,rx.bytes_sec,tx.bytes_sec,clients.count`,
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await metricsBatch(
          req("metrics/batch?targetIds=a&metrics=arbitrary.secret"),
        )
      ).status,
    ).toBe(400);
    expect(fixture.findMany).not.toHaveBeenCalled();
    expect(fixture.items).not.toHaveBeenCalled();
  });
  it("uses scoped managed targets and rejects any unmatched id", async () => {
    expect(
      (await metricsBatch(req("metrics/batch?connectionId=one&targetIds=a,b")))
        .status,
    ).toBe(404);
    expect(fixture.findMany).toHaveBeenCalledWith({
      where: { connectionId: "one", id: { in: ["a", "b"] } },
    });
    expect(fixture.items).not.toHaveBeenCalled();
  });
  it("returns partial unsupported series explicitly and fetches host items only once", async () => {
    const response = await metricsBatch(
      req("metrics/batch?targetIds=a&metrics=cpu.percent,memory.percent"),
    );
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(
      body.data
        .find((r: any) => r.metric === "cpu.percent")
        .data.points.some((p: any) => p.value === 25),
    ).toBe(true);
    expect(
      body.data.find((r: any) => r.metric === "memory.percent"),
    ).toMatchObject({ success: false, quality: "unavailable", data: null });
    expect(fixture.items).toHaveBeenCalledTimes(1);
  });
  it("keeps independent provider boundary snapshots separate with device perspective", async () => {
    fixture.targets = [
      ...fixture.targets,
      {
        ...fixture.targets[0],
        id: "c",
        kind: "controller",
        name: "Site controller",
        metadata: {
          provider: "UNIFI",
          metrics: { "clients.count": 10, "rx.bytes_sec": 100 },
        },
      },
      {
        ...fixture.targets[0],
        id: "r",
        kind: "router",
        name: "Hotspot router",
        metadata: {
          provider: "MIKROTIK",
          metrics: { "clients.count": 10, "rx.bytes_sec": 200 },
        },
      },
    ];
    const body = await (await summary(req("summary?time=30d"))).json();
    expect(body.data.sources).toHaveLength(2);
    expect(body.data.sources[0]).toMatchObject({
      clients: 10,
      rxBytesSec: 100,
      perspective: "device",
    });
    expect(body.data.sources[1]).toMatchObject({
      clients: 10,
      rxBytesSec: 200,
      perspective: "device",
    });
    expect(body.data).not.toHaveProperty("totalClients");
    expect(body.data.sources[0]).not.toHaveProperty("downloadBytesSec");
  });
  it("ranks original history averages rather than downsampled point averages", async () => {
    fixture.history.mockResolvedValue(
      Array.from({ length: 10000 }, (_, i) => ({
        at: Date.now() - i * 3000,
        value: i === 5000 ? 100 : 0,
      })).reverse(),
    );
    const body = await (
      await top(req("top?metric=cpu.percent&time=24h"))
    ).json();
    expect(body.aggregation).toBe("avg");
    expect(body.data[0].value).toBeCloseTo(0.01, 5);
  });
  it("exposes histogram truncation instead of claiming a complete event count", async () => {
    fixture.call.mockResolvedValue(
      Array.from({ length: 10000 }, (_, i) => ({
        eventid: String(i),
        clock: String(Math.floor(Date.now() / 1000)),
        severity: "4",
      })),
    );
    const body = await (
      await histogram(req("events/histogram?time=1h"))
    ).json();
    expect(body.data.truncated).toBe(true);
    expect(
      body.data.buckets.reduce((sum: number, b: any) => sum + b.critical, 0),
    ).toBe(10000);
  });
  it("rejects invalid custom ranges and includes end instants in history and cache identity", async () => {
    const end = Date.now() - 86400000,
      from = end - 3600000;
    fixture.history.mockResolvedValue([{ at: end - 30000, value: 25 }]);
    const first = new URLSearchParams({
      targetIds: "a",
      metrics: "cpu.percent",
      time: "custom",
      from: new Date(from).toISOString(),
      to: new Date(end).toISOString(),
    });
    expect((await metricsBatch(req(`metrics/batch?${first}`))).status).toBe(
      200,
    );
    expect(fixture.history).toHaveBeenLastCalledWith(
      expect.anything(),
      3600,
      end,
    );
    const key = fixture.cacheKeys.at(-1);
    first.set("from", new Date(from - 86400000).toISOString());
    first.set("to", new Date(end - 86400000).toISOString());
    await metricsBatch(req(`metrics/batch?${first}`));
    expect(fixture.cacheKeys.at(-1)).not.toBe(key);
    first.set("to", "bad-date");
    expect((await metricsBatch(req(`metrics/batch?${first}`))).status).toBe(
      400,
    );
  });
  it("uses actual trend maxima and retains incomplete hourly availability coverage", async () => {
    fixture.history.mockResolvedValue([
      { at: Date.now() - 3600000, value: 1, samples: 1, maximum: 95 },
    ]);
    const body = await (
      await top(req("top?metric=cpu.percent&time=7d&aggregation=max"))
    ).json();
    expect(body.data[0].value).toBe(95);
    const series = await metricSeries(fixture.targets[0], "available", 604800);
    expect(series.availability?.observedMs).toBe(30000);
    expect(series.availabilityEstimated).toBe(true);
  });
  it("only draws unambiguous thresholds for the actual item, including sustained guards", async () => {
    fixture.call.mockResolvedValue([
      {
        expression:
          "min(/host/cpu.percent,5m)>80 and count(/host/cpu.percent,5m)>=10",
        priority: "2",
        description: "CPU warning",
      },
      {
        expression:
          "min(/host/memory.percent,5m)>70 and min(/host/cpu.percent,5m)>90",
        priority: "4",
        description: "Compound",
      },
      {
        expression: "min(/host/memory.percent,5m)>75",
        priority: "2",
        description: "Other item",
      },
      {
        expression: "min(/host/cpu.percent,5m)>{$CPU_WARN}",
        priority: "2",
        description: "Unresolved macro",
      },
    ]);
    const series = await metricSeries(fixture.targets[0], "cpu.percent", 3600);
    expect(series.thresholds).toEqual([
      { value: 80, severity: "2", name: "CPU warning" },
    ]);
  });
});
