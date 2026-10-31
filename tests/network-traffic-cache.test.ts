import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  getTopology: vi.fn(),
  resolve: vi.fn(),
  writes: [] as any[],
  login: vi.fn(),
}));
vi.mock("@/lib/network/connections", () => ({
  resolveConnection: mocks.resolve,
}));
vi.mock("@/lib/settings", () => ({
  getUnifiClientFromRequest: vi.fn(async () => ({
    login: mocks.login,
    getTopology: mocks.getTopology,
  })),
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async (key: string) => mocks.store.get(key) || null),
    set: vi.fn(async (key: string, value: string, ...args: any[]) => {
      mocks.writes.push([key, value, ...args]);
      if (args.includes("NX") && mocks.store.has(key)) return null;
      mocks.store.set(key, value);
      return "OK";
    }),
    multi: () => {
      const queue: any[] = [];
      const chain: any = {
        set: (...args: any[]) => {
          queue.push(args);
          return chain;
        },
        exec: async () => {
          for (const [key, value, ...args] of queue) {
            mocks.store.set(key, value);
            mocks.writes.push([key, value, ...args]);
          }
          return [];
        },
      };
      return chain;
    },
    eval: vi.fn(
      async (_script: string, _count: number, key: string, token: string) => {
        if (mocks.store.get(key) === token) mocks.store.delete(key);
        return 1;
      },
    ),
  },
}));
import { getSampledTopology } from "@/lib/network/traffic-service";
import { buildUnifiTopology } from "@/lib/network/topology";
beforeEach(() => {
  mocks.store.clear();
  mocks.writes.length = 0;
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({
    id: "connection",
    baseUrl: "https://controller",
    config: { site: "default" },
  });
  mocks.getTopology.mockImplementation(async () =>
    buildUnifiTopology(
      [],
      [{ mac: "aa", tx_bytes: 100, rx_bytes: 10 }],
      "2026-10-23T01:00:00Z",
    ),
  );
});
describe("shared topology sample cache", () => {
  it("shares concurrent requests and caches snapshots for 3s, counter history for 120s", async () => {
    const req = new Request("https://app/api/unifi/topology");
    const [a, b] = await Promise.all([
      getSampledTopology("UNIFI", req),
      getSampledTopology("UNIFI", req),
    ]);
    expect(a).toEqual(b);
    expect(mocks.getTopology).toHaveBeenCalledTimes(1);
    await getSampledTopology("UNIFI", req);
    expect(mocks.getTopology).toHaveBeenCalledTimes(1);
    expect(
      mocks.writes.some(
        ([key, , unit, ttl]) =>
          key.endsWith(":cache") && unit === "EX" && ttl === 3,
      ),
    ).toBe(true);
    expect(
      mocks.writes.some(
        ([key, , unit, ttl]) =>
          key.endsWith(":samples") && unit === "EX" && ttl === 120,
      ),
    ).toBe(true);
  });
  it("isolates sites and uses history after the short snapshot expires", async () => {
    const req = new Request("https://app/api/unifi/topology?site=a");
    await getSampledTopology("UNIFI", req);
    for (const key of Array.from(mocks.store.keys()))
      if (key.endsWith(":cache")) mocks.store.delete(key);
    mocks.getTopology.mockResolvedValueOnce(
      buildUnifiTopology(
        [],
        [{ mac: "aa", tx_bytes: 725, rx_bytes: 135 }],
        "2026-10-23T01:00:05Z",
      ),
    );
    const next = await getSampledTopology("UNIFI", req);
    expect(next.nodes[0].traffic?.downloadBps).toBe(1000);
    const isolated = await getSampledTopology(
      "UNIFI",
      new Request("https://app/api/unifi/topology?site=b"),
    );
    expect(isolated.nodes[0].traffic?.downloadBps).toBeNull();
  });
});
