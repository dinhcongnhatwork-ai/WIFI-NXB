import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const fixture = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    monitoringTarget: { findMany: async () => [{ zabbixHostId: "1" }] },
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: { get: async () => null, set: async () => undefined },
}));
vi.mock("@/lib/api-access", () => ({
  withPermission: (_level: string, handler: any) => handler,
  getIdentity: vi.fn(),
}));
vi.mock("@/lib/network/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/monitor/zabbix", () => ({ zabbix: { call: fixture.call } }));
import { events } from "@/lib/monitor/api";
describe("custom event history boundary", () => {
  it("keeps pre-range active problems but excludes later-created current problems and identifies present state", async () => {
    const end = Date.now() - 86400000,
      start = end - 3600000;
    fixture.call.mockImplementation(async (method: string) =>
      method === "problem.get"
        ? [
            {
              eventid: "1",
              clock: String(Math.floor((start - 3600000) / 1000)),
              name: "Older still active",
              r_eventid: "0",
            },
            {
              eventid: "2",
              clock: String(Math.floor((end + 3600000) / 1000)),
              name: "Future relative to selected range",
              r_eventid: "0",
            },
          ]
        : [
            {
              eventid: "3",
              clock: String(Math.floor((start + 1800000) / 1000)),
              name: "In-range event",
            },
            {
              eventid: "4",
              clock: String(Math.floor((end + 10000) / 1000)),
              name: "Out of bounds",
            },
          ],
    );
    const q = new URLSearchParams({
      time: "custom",
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
    });
    const response = await events(
      new NextRequest(`http://localhost/api/monitor/events?${q}`),
    );
    const body = await response.json();
    expect(body.data.problems.map((e: any) => e.eventid)).toEqual(["1"]);
    expect(body.data.history.map((e: any) => e.eventid)).toEqual(["3"]);
    expect(body.data.stateAsOf).toBe("current");
    expect(body.data.stateNote).toContain("không phải ảnh chụp lịch sử");
    expect(fixture.call).toHaveBeenCalledWith(
      "event.get",
      expect.objectContaining({ time_till: Math.floor(end / 1000) }),
    );
  });
});
