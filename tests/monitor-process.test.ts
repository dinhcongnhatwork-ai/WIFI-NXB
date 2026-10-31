import { afterEach, describe, expect, it, vi } from "vitest";
const snapshots = vi.hoisted(() => ({ set: vi.fn(async () => "OK") }));
vi.mock("../src/lib/redis", () => ({ redis: snapshots }));
vi.mock("../src/lib/monitor/logs", () => ({
  enqueueLog: vi.fn(),
  redactLog: (v: unknown) => v,
}));
import {
  recordApiRequest,
  startProcessSampler,
} from "../src/lib/monitor/process";
afterEach(() => {
  const state = globalThis as any;
  clearInterval(state.monitorSampler);
  delete state.monitorSampler;
  vi.unstubAllEnvs();
});
describe("application process measurements", () => {
  it("publishes actual process CPU/memory and request health under its server tag without fabricating event loop data", async () => {
    vi.stubEnv("APP_SERVER_MODE", "frontend");
    recordApiRequest(20, 200);
    recordApiRequest(80, 500);
    startProcessSampler();
    await Promise.resolve();
    expect(snapshots.set).toHaveBeenCalledTimes(1);
    const [key, raw, expiry, ttl] = snapshots.set.mock.calls[0] as any;
    expect(key).toBe("monitor:process:frontend");
    expect(expiry).toBe("EX");
    expect(ttl).toBe(120);
    const snapshot = JSON.parse(raw),
      metrics = snapshot.metrics;
    expect(snapshot.pid).toBe(process.pid);
    expect(metrics["memory.rss.bytes"]).toBeGreaterThan(0);
    expect(metrics["memory.heap.bytes"]).toBeGreaterThan(0);
    expect(metrics["memory.percent"]).toBeGreaterThan(0);
    expect(metrics["cpu.percent"]).toBeGreaterThanOrEqual(0);
    expect(metrics["cpu.percent"]).toBeLessThanOrEqual(100);
    expect(metrics["http.requests.count"]).toBe(2);
    expect(metrics["http.errors.count"]).toBe(1);
    expect(metrics["http.latency.mean.ms"]).toBe(50);
    expect(metrics["eventloop.ms"]).toBeUndefined();
    startProcessSampler();
    expect(snapshots.set).toHaveBeenCalledTimes(1);
  });
});
