import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  authenticated: true,
  registration: vi.fn(),
  targets: vi.fn(),
  connection: vi.fn(),
  rawGet: vi.fn(),
  createClient: vi.fn(),
  cache: new Map<string, string>(),
}));
vi.mock("@/lib/auth", () => ({
  authenticateRequest: () => (mocks.authenticated ? { id: "viewer" } : null),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    admin: {
      findUnique: async () => ({
        id: "viewer",
        username: "viewer",
        role: "VIEWER",
        disabled: false,
      }),
    },
    attendanceRegistration: { findMany: mocks.registration },
    monitoringTarget: { findMany: mocks.targets },
    networkConnection: { findFirst: mocks.connection },
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (key: string) => mocks.cache.get(key) || null,
    set: async (key: string, value: string) => mocks.cache.set(key, value),
  },
}));
vi.mock("@/lib/mikrotik", () => ({
  createMikrotikClientFromRequest: mocks.createClient,
}));
import { GET } from "@/app/api/network/client-context/route";
const req = (mac = "AA:BB:CC:DD:EE:FF", extra = "") =>
  new NextRequest(
    `https://app/api/network/client-context?mac=${encodeURIComponent(mac)}${extra}`,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cache.clear();
  mocks.authenticated = true;
  process.env.MONITOR_PROCESS_ENABLED = "false";
  mocks.registration.mockResolvedValue([]);
  mocks.targets.mockResolvedValue([]);
  mocks.connection.mockResolvedValue(null);
  mocks.createClient.mockResolvedValue({ rawGet: mocks.rawGet });
});
describe("client business context", () => {
  it("rejects unauthenticated requests before database/controller queries", async () => {
    mocks.authenticated = false;
    expect((await GET(req())).status).toBe(401);
    expect(mocks.registration).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects noncanonical MAC and invalid explicit connection IDs", async () => {
    for (const mac of [
      "aabbccddeeff",
      "aa-bb-cc-dd-ee-ff",
      "aa:bb:cc:dd:ee:gg",
      " AA:BB:CC:DD:EE:FF",
    ])
      expect((await GET(req(mac))).status).toBe(400);
    expect((await GET(req(undefined, "&connectionId=bad%2Fid"))).status).toBe(
      400,
    );
    expect(mocks.registration).not.toHaveBeenCalled();
  });
  it("returns an honest empty state and selects only minimal attendance fields", async () => {
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        mac: "aa:bb:cc:dd:ee:ff",
        attendance: [],
        hotspot: { status: "not-configured", sources: [] },
      },
    });
    expect(mocks.registration).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          primaryMac: { equals: "aa:bb:cc:dd:ee:ff", mode: "insensitive" },
        },
        take: 10,
        select: {
          id: true,
          displayName: true,
          status: true,
          session: { select: { id: true, name: true } },
        },
      }),
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("matches snapshot MAC case-insensitively, keeps source/time and never calls router", async () => {
    mocks.registration.mockResolvedValue([
      {
        id: "person",
        displayName: "Test",
        status: "PRESENT",
        session: { id: "meeting", name: "Meeting" },
      },
    ]);
    mocks.targets.mockResolvedValue([
      {
        connectionId: "r",
        name: "Router",
        lastSeenAt: new Date(),
        metadata: {
          hotspotActive: [
            {
              "mac-address": "AA:BB:CC:DD:EE:FF",
              "bytes-out": 1000,
              "bytes-in": 200,
              user: "guest",
            },
            { "mac-address": "11:22:33:44:55:66", "bytes-out": 999 },
          ],
        },
      },
    ]);
    const body = await (await GET(req())).json();
    expect(body.data.hotspot.sources[0].sessions).toHaveLength(1);
    expect(body.data.hotspot.sources[0].sessions[0]).toMatchObject({
      user: "guest",
      traffic: {
        downloadBytes: 1000,
        uploadBytes: 200,
        downloadBps: null,
        perspective: "user",
      },
    });
    expect(mocks.connection).not.toHaveBeenCalled();
  });
  it("reads only existing selected router once and shares cached active-session snapshots", async () => {
    mocks.connection.mockResolvedValue({ id: "router", name: "Router" });
    mocks.rawGet.mockResolvedValue([
      {
        "mac-address": "aa:bb:cc:dd:ee:ff",
        "bytes-out": "800",
        "bytes-in": "100",
      },
    ]);
    const a = await (await GET(req(undefined, "&connectionId=router"))).json();
    await GET(req(undefined, "&connectionId=router"));
    expect(mocks.rawGet).toHaveBeenCalledTimes(1);
    expect(mocks.rawGet).toHaveBeenCalledWith("/ip/hotspot/active");
    expect(
      new URL(mocks.createClient.mock.calls[0][0].url).searchParams.get(
        "connectionId",
      ),
    ).toBe("router");
    expect(a.data.hotspot.sources[0].sessions[0].traffic.downloadBytes).toBe(
      800,
    );
  });
  it("keeps attendance when Hotspot API fails and reports unavailable explicitly", async () => {
    mocks.connection.mockResolvedValue({ id: "router", name: "Router" });
    mocks.rawGet.mockRejectedValue(new Error("secret endpoint details"));
    const body = await (await GET(req())).json();
    expect(body.success).toBe(true);
    expect(body.data.hotspot.status).toBe("unavailable");
    expect(JSON.stringify(body)).not.toContain("secret endpoint");
  });
});

it("uses the existing default router when topology scope is a UniFi controller", async () => {
  mocks.connection.mockImplementation(async (query: any) =>
    query.where.id === "controller"
      ? { provider: "UNIFI" }
      : { id: "router", name: "Router" },
  );
  mocks.rawGet.mockResolvedValue([]);
  const body = await (
    await GET(req(undefined, "&connectionId=controller"))
  ).json();
  expect(body.data.hotspot.status).toBe("available");
  expect(
    new URL(mocks.createClient.mock.calls[0][0].url).searchParams.get(
      "connectionId",
    ),
  ).toBe("router");
});
