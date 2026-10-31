import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiClient } from "@/lib/unifi";

const fixture = vi.hoisted(() => ({
  targets: new Map<string, any>(),
  connection: {} as any,
  pushed: [] as any[],
  items: [] as any[],
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    networkConnection: {
      findMany: async () => [{ id: "controller", provider: "UNIFI" }],
    },
    monitoringTarget: {
      findMany: async (query: any) =>
        Array.from(fixture.targets.values()).filter((target) =>
          query.where.connectionId
            ? target.connectionId === query.where.connectionId
            : target.key.startsWith("external."),
        ),
      upsert: async ({ where, create, update }: any) => {
        const target = {
          id: where.key,
          ...(fixture.targets.has(where.key) ? update : create),
        };
        fixture.targets.set(where.key, target);
        return target;
      },
      update: async ({ where, data }: any) => {
        const target = fixture.targets.get(where.id);
        Object.assign(target, data);
        return target;
      },
    },
    $queryRaw: async () => [{ value: 1 }],
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (key: string) =>
      key === "monitor:retention:last" ? String(Date.now()) : null,
    set: async () => "OK",
    eval: async () => 1,
    del: async () => 1,
    ping: async () => "PONG",
  },
}));
vi.mock("@/lib/network/connections", () => ({
  resolveConnection: async () => fixture.connection,
}));
vi.mock("@/lib/monitor/logs", () => ({
  drainLogs: async () => {},
  enqueueLog: async () => {},
  redactLog: (value: unknown) => value,
}));
vi.mock("@/lib/monitor/retention", () => ({ runRetention: async () => {} }));
vi.mock("@/lib/monitor/syslog", () => ({
  tailSyslog: async () => ({ available: true }),
}));
vi.mock("@/lib/monitor/zabbix", () => ({
  zabbix: {
    call: async () => "7.0.32",
    items: async () => fixture.items,
    provision: async (
      key: string,
      _name: string,
      metrics: Record<string, unknown>,
    ) => ({
      hostid: key,
      items: Object.keys(metrics).map((metric) => ({
        key_: metric,
        itemid: `${key}:${metric}`,
      })),
    }),
    push: async (samples: any[]) => {
      fixture.pushed.push(...samples);
    },
  },
}));
import { collectOnce } from "@/lib/monitor/collector";

const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
beforeEach(() => {
  fixture.targets.clear();
  fixture.pushed.length = 0;
  fixture.items = [];
  fixture.connection = {
    id: "controller",
    name: "Controller",
    baseUrl: "https://controller.test",
    username: "monitor",
    credentials: { password: "test-password" },
    config: { apiMode: "legacy", sites: ["office", "warehouse"] },
    version: "10.6.106",
  };
  vi.stubEnv("MONITOR_AGENT_ENABLED", "false");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  UnifiClient.clearSessionCache();
});

describe("UniFi monitoring collection", () => {
  it("authenticates legacy reads and records devices from every selected site", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init: RequestInit = {}) => {
        const url = new URL(input);
        if (url.hostname !== "controller.test") return json({});
        if (url.pathname === "/api/auth/login")
          return json({ meta: { rc: "ok" } }, 200, {
            "set-cookie": "unifises=authenticated; Path=/; Secure",
          });
        if (
          (init.headers as Record<string, string>)?.Cookie !==
          "unifises=authenticated"
        )
          return json({ message: "Authentication required" }, 401);
        const site = url.pathname.split("/")[3];
        if (url.pathname.endsWith("/stat/device"))
          return json({
            data: [
              {
                _id: `${site}-ap`,
                mac: `${site}-mac`,
                name: `${site} AP`,
                type: "uap",
                state: 1,
              },
            ],
          });
        if (url.pathname.endsWith("/stat/sta")) return json({ data: [] });
        return json({ message: "Unknown fixture endpoint" }, 404);
      }),
    );
    const result = await collectOnce();
    expect(result?.errors).not.toContain("Network collection failed");
    for (const site of ["office", "warehouse"]) {
      expect(
        fixture.targets.get(`unifi.controller.${site}.${site}-ap`),
      ).toMatchObject({
        siteId: site,
        status: "online",
        metadata: { metrics: { available: 1 } },
      });
    }
  });

  it("keeps missing device status unknown without publishing an offline availability sample", async () => {
    fixture.connection.credentials = { apiKey: "test-key" };
    fixture.connection.config = { apiMode: "official", sites: ["office"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.hostname !== "controller.test") return json({});
        if (url.pathname.endsWith("/info"))
          return json({ applicationVersion: "10.6.106" });
        if (url.pathname.endsWith("/devices"))
          return json({
            data: [
              {
                id: "unknown-ap",
                macAddress: "AA:BB",
                name: "AP without state",
              },
            ],
            totalCount: 1,
          });
        if (url.pathname.endsWith("/clients"))
          return json({ data: [], totalCount: 0 });
        return json({ message: "Unknown fixture endpoint" }, 404);
      }),
    );
    await collectOnce();
    const target = fixture.targets.get("unifi.controller.office.unknown-ap");
    expect(target?.status).toBe("unknown");
    expect(target.metadata.metrics.available).toBeUndefined();
    expect(
      fixture.pushed.filter(
        (sample) =>
          sample.itemid === "unifi.controller.office.unknown-ap:available",
      ),
    ).toEqual([]);
  });

  it("does not let a fresh Agent2 ping conceal stale CPU or missing RAM samples", async () => {
    fixture.targets.set("external.100", {
      id: "external.100",
      key: "external.100",
      zabbixHostId: "100",
      metadata: {
        itemKeys: {
          available: "agent.ping",
          "cpu.percent": "system.cpu.util",
          "memory.percent": "vm.memory.size",
        },
      },
    });
    const now = Math.floor(Date.now() / 1000),
      old = now - 300;
    fixture.items = [
      { key_: "agent.ping", lastvalue: "1", lastclock: String(now) },
      { key_: "system.cpu.util", lastvalue: "42", lastclock: String(old) },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({})),
    );
    await collectOnce();
    const target = fixture.targets.get("external.100");
    expect(target.status).toBe("unknown");
    expect(target.lastSeenAt).toBeNull();
    expect(target.metadata.metrics).toEqual({ available: 1 });
    expect(target.metadata.metricSamples).toMatchObject({
      available: {
        quality: "fresh",
        observedAt: new Date(now * 1000).toISOString(),
      },
      "cpu.percent": {
        quality: "stale",
        observedAt: new Date(old * 1000).toISOString(),
      },
      "memory.percent": { quality: "missing", observedAt: null },
    });
  });
});
