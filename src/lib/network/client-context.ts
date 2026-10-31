import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccessError, withPermission } from "@/lib/api-access";
import { redis } from "@/lib/redis";
import { mikrotikCounters, sampleTraffic } from "./traffic";

export function canonicalClientMac(value: string | null): string {
  if (!value || !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(value)) {
    throw new AccessError(
      400,
      "MAC phải gồm 6 cặp ký tự hex phân cách bằng dấu hai chấm.",
    );
  }
  return value.toLowerCase();
}
function matchingSessions(rows: any[], mac: string, sampledAt: string) {
  return rows
    .filter(
      (row) =>
        String(
          row["mac-address"] ?? row.macAddress ?? row.mac ?? "",
        ).toLowerCase() === mac,
    )
    .slice(0, 10)
    .map((row) => ({
      id: row[".id"] ?? row.id,
      user: row.user ?? row.username,
      ip: row.address ?? row.ipAddress ?? row.ip,
      uptime: row.uptime,
      traffic: sampleTraffic(
        mikrotikCounters(row, true),
        "MikroTik · /ip/hotspot/active",
        sampledAt,
      ),
    }));
}
const pending = new Map<string, Promise<{ rows: any[]; sampledAt: string }>>();
async function activeSessions(req: NextRequest, connectionId: string) {
  const key = `network:client-context:hotspot:v1:${connectionId}`;
  if (pending.has(key)) return pending.get(key)!;
  const work = (async () => {
    try {
      const cached = await redis.get(key);
      if (cached)
        return JSON.parse(cached) as { rows: any[]; sampledAt: string };
    } catch {}
    const { createMikrotikClientFromRequest } = await import("@/lib/mikrotik");
    const url = new URL(req.url);
    url.searchParams.set("connectionId", connectionId);
    const client = await createMikrotikClientFromRequest(new Request(url));
    const data = await client.rawGet("/ip/hotspot/active");
    if (!Array.isArray(data)) throw new Error("Invalid Hotspot response");
    const snapshot = { rows: data, sampledAt: new Date().toISOString() };
    try {
      await redis.set(key, JSON.stringify(snapshot), "EX", 3);
    } catch {}
    return snapshot;
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
export const clientContext = withPermission(
  "read",
  async (req: NextRequest) => {
    const mac = canonicalClientMac(req.nextUrl.searchParams.get("mac"));
    let explicit = req.nextUrl.searchParams.get("connectionId");
    if (explicit && !/^[a-zA-Z0-9_-]{1,100}$/.test(explicit))
      throw new AccessError(400, "ID kết nối không hợp lệ.");
    // UniFi topology carries its controller scope. That is not a router selection.
    if (explicit) {
      const selected = await prisma.networkConnection.findFirst({
        where: { id: explicit },
        select: { provider: true },
      });
      if (selected?.provider === "UNIFI") explicit = null;
    }
    const attendance = await prisma.attendanceRegistration.findMany({
      where: { primaryMac: { equals: mac, mode: "insensitive" } },
      select: {
        id: true,
        displayName: true,
        status: true,
        session: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const snapshots = await prisma.monitoringTarget.findMany({
      where: {
        kind: "router",
        ...(explicit ? { connectionId: explicit } : {}),
      },
      select: {
        connectionId: true,
        name: true,
        metadata: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
    });
    const sources: any[] = [];
    for (const snapshot of snapshots) {
      const meta = snapshot.metadata as any;
      const rows = [
        meta?.hotspotActive,
        meta?.hotspotSessions,
        meta?.sessions,
      ].find(Array.isArray);
      if (!rows) continue;
      const at = snapshot.lastSeenAt?.toISOString() ?? null;
      sources.push({
        connectionId: snapshot.connectionId,
        name: snapshot.name,
        source: "MikroTik · collector snapshot",
        sampledAt: at,
        quality: !at
          ? "missing"
          : Date.now() - Date.parse(at) > 95000
            ? "stale"
            : "fresh",
        sessions: matchingSessions(rows, mac, at ?? new Date(0).toISOString()),
      });
    }
    let hotspot: { status: string; sources: any[]; error?: string } = {
      status: "available",
      sources,
    };
    if (!sources.length) {
      // Resolve only an existing row. Never trigger legacy connection import for a detail lookup.
      const connection = await prisma.networkConnection.findFirst({
        where: { provider: "MIKROTIK", ...(explicit ? { id: explicit } : {}) },
        select: { id: true, name: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
      if (!connection)
        hotspot = {
          status: explicit ? "unavailable" : "not-configured",
          sources: [],
          error: explicit
            ? "Không tìm thấy kết nối MikroTik đã chọn."
            : "Chưa cấu hình kết nối MikroTik.",
        };
      else {
        try {
          const snapshot = await activeSessions(req, connection.id);
          hotspot.sources.push({
            connectionId: connection.id,
            name: connection.name,
            source: "MikroTik · /ip/hotspot/active",
            sampledAt: snapshot.sampledAt,
            quality: "fresh",
            sessions: matchingSessions(snapshot.rows, mac, snapshot.sampledAt),
          });
        } catch {
          hotspot = {
            status: "unavailable",
            sources: [],
            error:
              "Không đọc được phiên Hotspot: nguồn không khả dụng hoặc không có quyền đọc.",
          };
        }
      }
    }
    return NextResponse.json(
      {
        success: true,
        data: { mac, attendance, hotspot, sampledAt: new Date().toISOString() },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
);
