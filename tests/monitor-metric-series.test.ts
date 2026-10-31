import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ lrange: vi.fn(), history: vi.fn(), items: vi.fn(), call: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: { lrange: fixture.lrange } }));
vi.mock("@/lib/monitor/zabbix", () => ({ zabbix: { history: fixture.history, items: fixture.items, call: fixture.call } }));
import { metricSeries } from "@/lib/monitor/metric-series";
const end = 1700000000000;
const target = { id: "one", key: "one", name: "Router", lastSeenAt: new Date(end).toISOString(), metadata: { metrics: { "cpu.percent": 12, "rx.bytes_sec": 125000 } } };
beforeEach(() => { vi.clearAllMocks(); fixture.lrange.mockResolvedValue([]); fixture.history.mockResolvedValue([]); fixture.items.mockResolvedValue([]); fixture.call.mockResolvedValue([]); });
afterEach(() => vi.unstubAllEnvs());
describe("truthful monitor history", () => {
  it("does not turn a current metadata snapshot into historical samples or a fresh history", async () => {
    const result = await metricSeries(target, "cpu.percent", 3600, [], end);
    expect(result.points.every((p) => p.value === null)).toBe(true);
    expect(result.stats).toEqual({ average: null, max: null });
    expect(result.lastAt).toBeUndefined();
    expect(result.quality).toBe("missing");
    expect(result.thresholds).toEqual([]);
  });
  it("reports bytes/sec for direct collector samples", async () => {
    fixture.lrange.mockResolvedValue([JSON.stringify({ at: end - 30000, value: 125000 })]);
    const result = await metricSeries(target, "rx.bytes_sec", 3600, [], end);
    expect(result.units).toBe("B/s");
    expect(result.points.find((p) => p.value !== null)?.value).toBe(125000);
  });
  it("retains explicit Zabbix units only when Zabbix supplied the points", async () => {
    vi.stubEnv("ZABBIX_API_URL", "http://zabbix.test"); vi.stubEnv("ZABBIX_API_TOKEN", "test");
    const mapped = { ...target, zabbixHostId: "1" };
    const items = [{ itemid: "1", key_: "rx.bytes_sec", name: "RX", value_type: "0", units: "bps" }];
    fixture.history.mockResolvedValue([{ at: end - 30000, value: 1e6 }]);
    expect((await metricSeries(mapped, "rx.bytes_sec", 3600, items, end)).units).toBe("bps");
    fixture.history.mockResolvedValue([]);
    fixture.lrange.mockResolvedValue([JSON.stringify({ at: end - 30000, value: 125000 })]);
    const fallback = await metricSeries(mapped, "rx.bytes_sec", 3600, items, end);
    expect(fallback.source).toBe("telemetry");
    expect(fallback.units).toBe("B/s");
  });
});
