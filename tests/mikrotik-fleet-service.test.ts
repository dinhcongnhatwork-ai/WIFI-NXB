import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: [] as any[], read: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { networkConnection: { findMany: async () => mocks.rows } },
}));
vi.mock("@/lib/network/traffic-service", () => ({
  getSampledTopology: mocks.read,
}));
import { getMikrotikFleetTopology } from "@/lib/network/mikrotik-fleet";
const device = (id: string) => ({
  id,
  name: id,
  provider: "MIKROTIK",
  baseUrl: `https://${id}.test`,
  config: { deviceRole: "router" },
});
beforeEach(() => {
  mocks.rows = [device("r1"), device("r2")];
  mocks.read.mockReset();
  mocks.read.mockImplementation(async (_provider: string, req: Request) => ({
    nodes: [
      {
        id: "router:local",
        type: "gateway",
        status: "online",
        name: new URL(req.url).searchParams.get("connectionId"),
      },
    ],
    links: [],
    warnings: [],
    observedAt: "2026-10-27T01:00:00Z",
  }));
});
describe("configured MikroTik fleet collection", () => {
  it("reads current saved devices each time and explicitly scopes every device request", async () => {
    const req = new Request(
      "https://app/api/mikrotik/topology?scope=fleet&connectionId=old",
      { headers: { authorization: "Bearer viewer-fixture" } },
    );
    let result = await getMikrotikFleetTopology(req);
    expect(result.nodes.filter((n) => n.meta?.managed)).toHaveLength(2);
    expect(
      mocks.read.mock.calls
        .map(([, r]) => new URL(r.url).searchParams.get("connectionId"))
        .sort(),
    ).toEqual(["r1", "r2"]);
    expect(
      mocks.read.mock.calls.every(
        ([, r]) => !new URL(r.url).searchParams.has("scope"),
      ),
    ).toBe(true);
    mocks.rows.push(device("r3"));
    result = await getMikrotikFleetTopology(req);
    expect(result.nodes.filter((n) => n.meta?.managed)).toHaveLength(3);
  });
  it("does not discard healthy devices when one endpoint fails or expose transport errors", async () => {
    mocks.read.mockImplementation(async (_provider: string, req: Request) => {
      if (new URL(req.url).searchParams.get("connectionId") === "r2")
        throw Error("Basic fixture-private-secret");
      return {
        nodes: [
          {
            id: "router:local",
            type: "gateway",
            name: "good",
            status: "online",
          },
        ],
        links: [],
        warnings: [],
        observedAt: "now",
      };
    });
    const result = await getMikrotikFleetTopology(
      new Request("https://app/api/mikrotik/topology?scope=fleet"),
    );
    expect(result.nodes.filter((n) => n.meta?.managed)).toHaveLength(1);
    expect(result.nodes.find((n) => n.id === "mikrotik:r2:router:local")).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("fixture-private-secret");
  });
  it("never queries UniFi or imports APs and requests the infrastructure-only collection profile", async () => {
    mocks.rows.push({
      id: "u",
      name: "Controller",
      provider: "UNIFI",
      baseUrl: "https://controller.test",
      config: { sites: ["office", "warehouse"] },
    });
    mocks.read.mockImplementation(async (provider: string, req: Request) =>
      provider === "UNIFI"
        ? {
            nodes: [{ id: "device:ap", type: "ap", name: "AP" }],
            links: [],
            warnings: [],
            observedAt: "now",
          }
        : {
            nodes: [{ id: "router:local", type: "gateway", name: "router" }],
            links: [],
            warnings: [],
            observedAt: "now",
          },
    );
    const result = await getMikrotikFleetTopology(
      new Request(
        "https://app/api/mikrotik/topology?scope=fleet&siteId=injected",
      ),
    );
    expect(
      result.nodes
        .filter((n) => n.type === "ap")
        .map((n) => n.id)
        .sort(),
    ).toEqual([]);
    expect(mocks.read.mock.calls.every(([provider, , options]) => provider === "MIKROTIK" && options.infrastructureOnly === true)).toBe(true);
    expect(
      mocks.read.mock.calls
        .filter(([p]) => p === "MIKROTIK")
        .every(([, r]) => !new URL(r.url).searchParams.has("siteId")),
    ).toBe(true);
  });
  it("bounds concurrent managed endpoint reads to four", async () => {
    mocks.rows = Array.from({ length: 7 }, (_, i) => device(`r${i}`));
    let active = 0,
      maximum = 0;
    mocks.read.mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return {
        nodes: [{ id: "router:local", type: "gateway", name: "r" }],
        links: [],
        warnings: [],
        observedAt: "now",
      };
    });
    await getMikrotikFleetTopology(
      new Request("https://app/api/mikrotik/topology?scope=fleet"),
    );
    expect(maximum).toBeLessThanOrEqual(4);
    expect(mocks.read).toHaveBeenCalledTimes(7);
  });
});
