import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { withPermission, getIdentity } from "@/lib/api-access";
import { recordAudit } from "@/lib/network/audit";
import {
  csvCell,
  dataQuality,
  fingerprint,
  timeRange,
  monitorWindow,
} from "./core";
import { zabbix } from "./zabbix";
import { metricSeries, METRICS } from "./metric-series";
export function targetWhere(
  req: NextRequest,
): Prisma.MonitoringTargetWhereInput {
  const q = req.nextUrl.searchParams;
  return {
    ...(q.get("connectionId") ? { connectionId: q.get("connectionId")! } : {}),
    ...(q.get("siteId") ? { siteId: q.get("siteId")! } : {}),
    ...(q.get("deviceId") ? { deviceId: q.get("deviceId")! } : {}),
  };
}
export async function cachedSource(
  key: string,
  load: () => Promise<unknown>,
  freshSeconds = 0,
) {
  if (freshSeconds > 0) {
    try {
      const raw = await redis.get(`monitor:cache:${key}`);
      if (raw) {
        const cached = JSON.parse(raw);
        if (
          Date.now() - new Date(cached.cachedAt).getTime() <
          freshSeconds * 1000
        )
          return {
            success: true,
            data: cached.data,
            quality: "fresh",
            source: "zabbix",
            cachedAt: cached.cachedAt,
          };
      }
    } catch {}
  }
  try {
    const data = await load();
    try {
      await redis.set(
        `monitor:cache:${key}`,
        JSON.stringify({ data, cachedAt: new Date().toISOString() }),
        "EX",
        86400,
      );
    } catch {}
    return { success: true, data, quality: "fresh", source: "zabbix" };
  } catch (error) {
    let cached: any = null;
    try {
      const raw = await redis.get(`monitor:cache:${key}`);
      if (raw) cached = JSON.parse(raw);
    } catch {}
    return {
      success: false,
      data: cached?.data ?? null,
      quality: cached ? "stale" : "unavailable",
      source: "zabbix",
      cachedAt: cached?.cachedAt,
      error: error instanceof Error ? error.message : "Nguồn dữ liệu tạm ngừng",
    };
  }
}
export const overview = withPermission("read", async (req: NextRequest) => {
  // Support on-demand refresh or initial collection if heartbeat missing
  if (req.nextUrl.searchParams.get("refresh") === "true") {
    try {
      const { collectOnce } = await import("./collector");
      await collectOnce();
    } catch {}
  }

  const [targets, allTargets, connections] = await Promise.all([
    prisma.monitoringTarget.findMany({
      where: targetWhere(req),
      orderBy: { name: "asc" },
    }),
    prisma.monitoringTarget.findMany({
      select: {
        id: true,
        name: true,
        kind: true,
        connectionId: true,
        siteId: true,
        deviceId: true,
        status: true,
        lastSeenAt: true,
        metadata: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.networkConnection.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        baseUrl: true,
        status: true,
        isDefault: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  const sites = Array.from(
    new Set(allTargets.map((t) => t.siteId).filter(Boolean) as string[]),
  );

  let heartbeat: any = null,
    zabbixError: any = null,
    worker: any = null,
    redisAvailable = true;
  try {
    const values = await redis.mget(
      "monitor:collector:heartbeat",
      "monitor:zabbix:error",
      "monitor:attendance:heartbeat",
    );
    [heartbeat, zabbixError, worker] = values.map((v) =>
      v ? JSON.parse(v) : null,
    );
  } catch {
    redisAvailable = false;
  }
  const quality = dataQuality(heartbeat ? new Date(heartbeat.at) : null);
  return NextResponse.json({
    success: true,
    data: {
      targets: targets.map((t) => ({
        ...t,
        quality: dataQuality(t.lastSeenAt),
      })),
      allTargets: allTargets.map((t) => ({
        ...t,
        quality: dataQuality(t.lastSeenAt),
      })),
      sites,
      connections,
      collector: { ...heartbeat, quality },
      worker: {
        ...worker,
        quality: dataQuality(worker?.at ? new Date(worker.at) : null),
      },
      zabbix: {
        configured: !!(
          process.env.ZABBIX_API_URL && process.env.ZABBIX_API_TOKEN
        ),
        error: zabbixError,
      },
      redisAvailable,
      updatedAt: new Date().toISOString(),
    },
  });
});
export const targetsGet = withPermission("read", async (req: NextRequest) =>
  NextResponse.json({
    success: true,
    data: (
      await prisma.monitoringTarget.findMany({
        where: targetWhere(req),
        orderBy: { name: "asc" },
      })
    ).map((t) => ({ ...t, quality: dataQuality(t.lastSeenAt) })),
  }),
);
export const targetsPost = withPermission("admin", async (req: NextRequest) => {
  const body = await req.json();
  if (
    typeof body.hostId !== "string" ||
    !/^\d+$/.test(body.hostId) ||
    typeof body.name !== "string" ||
    !body.name.trim()
  )
    return NextResponse.json(
      { success: false, error: "Cần hostId Zabbix và tên đối tượng" },
      { status: 400 },
    );
  const hosts = await zabbix.call<any[]>("host.get", {
    hostids: [body.hostId],
    output: ["hostid", "name"],
  });
  if (!hosts.length)
    return NextResponse.json(
      { success: false, error: "Không truy cập được host Zabbix" },
      { status: 404 },
    );
  const items = await zabbix.items(body.hostId),
    mapping = body.itemKeys || {};
  if (
    Object.entries(mapping).some(
      ([metric, key]) =>
        ![
          "cpu.percent",
          "memory.percent",
          "disk.percent",
          "uptime.seconds",
        ].includes(metric) ||
        typeof key !== "string" ||
        !items.some((i) => i.key_ === key),
    )
  )
    return NextResponse.json(
      { success: false, error: "Ánh xạ chỉ số không hợp lệ" },
      { status: 400 },
    );
  const key = `external.${body.hostId}`;
  const target = await prisma.monitoringTarget.upsert({
    where: { key },
    create: {
      key,
      name: body.name,
      kind: "host",
      zabbixHostId: body.hostId,
      metadata: { source: "zabbix-agent2", itemKeys: mapping },
    },
    update: {
      name: body.name,
      zabbixHostId: body.hostId,
      metadata: { source: "zabbix-agent2", itemKeys: mapping },
    },
  });
  const actor = await getIdentity(req);
  await recordAudit({
    actorId: actor.id,
    actorName: actor.username,
    action: "monitor.target.map",
    deviceId: target.id,
    status: "verified",
    after: { hostId: body.hostId, itemKeys: mapping },
  });
  return NextResponse.json({ success: true, data: target });
});
export const metrics = withPermission("read", async (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("targetId"),
    metric = req.nextUrl.searchParams.get("metric") || "cpu.percent";
  if (!id)
    return NextResponse.json(
      { success: false, error: "Cần targetId" },
      { status: 400 },
    );
  const target = await prisma.monitoringTarget.findUnique({ where: { id } });
  if (!target)
    return NextResponse.json(
      { success: false, error: "Không tìm thấy đối tượng" },
      { status: 404 },
    );
  const window = monitorWindow(req.nextUrl.searchParams);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const result = await cachedSource(
    fingerprint({ id, metric, seconds, end }),
    async () => {
      if (!METRICS.includes(metric))
        throw new Error("Chỉ số không được hỗ trợ");
      return metricSeries(target, metric, seconds, undefined, end);
    },
  );
  return NextResponse.json(result);
});
export const events = withPermission("read", async (req: NextRequest) => {
  const targets = await prisma.monitoringTarget.findMany({
    where: targetWhere(req),
  });
  const hostids = targets.map((t) => t.zabbixHostId).filter(Boolean);
  const window = monitorWindow(req.nextUrl.searchParams);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const now = Date.now();
  const windowEnd = end ?? now;
  const windowStart = windowEnd - seconds * 1000;

  if (hostids.length && process.env.ZABBIX_API_URL && process.env.ZABBIX_API_TOKEN) {
    try {
      const zabbixResult = await cachedSource(
        fingerprint({ events: hostids, seconds, end }),
        async () => {
          const params = {
            hostids,
            output: "extend",
            selectAcknowledges: "extend",
            selectHosts: ["hostid", "name"],
            sortfield: ["eventid"],
            sortorder: "DESC",
            limit: 200,
          };
          const [problems, history] = await Promise.all([
            zabbix.call("problem.get", { ...params, recent: true }),
            zabbix.call("event.get", {
              ...params,
              time_from: Math.floor(windowStart / 1000),
              ...(end === undefined ? {} : { time_till: Math.floor(end / 1000) }),
              source: 0,
              object: 0,
              value: 1,
            }),
          ]);
          return {
            problems: Array.isArray(problems) ? problems : [],
            history: Array.isArray(history) ? history : [],
            stateAsOf: "current",
          };
        },
        15,
      );
      if (zabbixResult.success && zabbixResult.data) {
        return NextResponse.json(zabbixResult);
      }
    } catch {}
  }

  // Synthesize anomalies from local targets and operational logs
  const syntheticProblems: any[] = [];
  const syntheticHistory: any[] = [];

  for (const t of targets) {
    const meta: any = t.metadata || {};
    const lastSeen = t.lastSeenAt ? new Date(t.lastSeenAt).getTime() : 0;
    const isOffline =
      t.status === "offline" ||
      t.status === "source-unavailable" ||
      (lastSeen > 0 && now - lastSeen > 95000);

    if (isOffline) {
      const clock = Math.floor((lastSeen || now - 60000) / 1000);
      if (clock * 1000 >= windowStart && clock * 1000 <= windowEnd) {
        syntheticProblems.push({
          eventid: `offline_${t.id}`,
          name: `Thiết bị ${t.name} (${t.kind.toUpperCase()}) mất kết nối hoặc ngoại tuyến`,
          severity: "4",
          clock: String(clock),
          r_clock: "0",
          acknowledged: "0",
          acknowledges: [],
          hosts: [{ hostid: t.zabbixHostId || t.id, name: t.name }],
        });
      }
    }

    const cpu = meta?.metrics?.["cpu.percent"];
    if (typeof cpu === "number" && cpu > 80) {
      const clock = Math.floor(now / 1000);
      syntheticProblems.push({
        eventid: `cpu_${t.id}`,
        name: `Cảnh báo tải CPU cao trên ${t.name} (${cpu.toFixed(1)}%)`,
        severity: cpu > 90 ? "4" : "3",
        clock: String(clock),
        r_clock: "0",
        acknowledged: "0",
        acknowledges: [],
        hosts: [{ hostid: t.zabbixHostId || t.id, name: t.name }],
      });
    }

    const mem = meta?.metrics?.["memory.percent"];
    if (typeof mem === "number" && mem > 85) {
      const clock = Math.floor(now / 1000);
      syntheticProblems.push({
        eventid: `mem_${t.id}`,
        name: `Cảnh báo bộ nhớ cao trên ${t.name} (${mem.toFixed(1)}%)`,
        severity: "3",
        clock: String(clock),
        r_clock: "0",
        acknowledged: "0",
        acknowledges: [],
        hosts: [{ hostid: t.zabbixHostId || t.id, name: t.name }],
      });
    }
  }

  try {
    const errorLogs = await prisma.operationalLog.findMany({
      where: {
        occurredAt: { gte: new Date(windowStart), lte: new Date(windowEnd) },
        severity: { in: ["error", "warning"] },
      },
      take: 50,
      orderBy: { occurredAt: "desc" },
    });
    for (const log of errorLogs) {
      const clock = Math.floor(new Date(log.occurredAt).getTime() / 1000);
      const isErr = log.severity === "error";
      syntheticHistory.push({
        eventid: `log_${log.id}`,
        name: `[${log.source.toUpperCase()}] ${log.message}`,
        severity: isErr ? "4" : "2",
        clock: String(clock),
        r_clock: String(clock + 300),
        acknowledged: "0",
        acknowledges: [],
        hosts: [{ hostid: log.deviceId || "system", name: log.source }],
      });
    }
  } catch {}

  return NextResponse.json({
    success: true,
    data: {
      problems: syntheticProblems,
      history: [...syntheticProblems, ...syntheticHistory],
      stateAsOf: "current",
    },
    quality: "fresh",
    source: "direct",
  });
});
export const acknowledge = withPermission(
  "operate",
  async (req: NextRequest, context: any) => {
    const id = context?.params?.id;
    if (!/^\d+$/.test(id || ""))
      return NextResponse.json(
        { success: false, error: "ID sự kiện không hợp lệ" },
        { status: 400 },
      );
    const body = await req.json();
    const message =
      typeof body.message === "string"
        ? body.message.trim().slice(0, 2000)
        : "";
    if (!message)
      return NextResponse.json(
        { success: false, error: "Cần ghi chú xác nhận" },
        { status: 400 },
      );
    const actor = await getIdentity(req);
    const event = await zabbix.call<any[]>("event.get", {
      eventids: [id],
      output: ["eventid"],
      selectHosts: ["hostid"],
    });
    if (!event.length)
      return NextResponse.json(
        { success: false, error: "Không truy cập được sự kiện" },
        { status: 404 },
      );
    const managed = await prisma.monitoringTarget.count({
      where: { zabbixHostId: { in: event[0].hosts.map((h: any) => h.hostid) } },
    });
    if (!managed)
      return NextResponse.json(
        { success: false, error: "Sự kiện không thuộc đối tượng được quản lý" },
        { status: 403 },
      );
    await zabbix.call("event.acknowledge", {
      eventids: [id],
      action: 6,
      message: `${actor.username}: ${message}`,
    });
    await recordAudit({
      actorId: actor.id,
      actorName: actor.username,
      action: "monitor.event.acknowledge",
      deviceId: id,
      status: "verified",
      after: { message },
    });
    return NextResponse.json({ success: true });
  },
);
export const logs = withPermission("read", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams,
    cursor = q.get("cursor"),
    window = monitorWindow(q);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const where: Prisma.OperationalLogWhereInput = {
    occurredAt: {
      gte: new Date((end ?? Date.now()) - seconds * 1000),
      ...(end === undefined ? {} : { lte: new Date(end) }),
    },
    ...(q.get("source") ? { source: q.get("source")! } : {}),
    ...(q.get("severity") ? { severity: q.get("severity")! } : {}),
    ...(q.get("search")
      ? {
          message: {
            contains: q.get("search")!.slice(0, 200),
            mode: "insensitive",
          },
        }
      : {}),
    ...(q.get("connectionId") ? { connectionId: q.get("connectionId")! } : {}),
    ...(q.get("deviceId") ? { deviceId: q.get("deviceId")! } : {}),
  };
  if (cursor && !/^[a-zA-Z0-9-]{1,100}$/.test(cursor))
    return NextResponse.json(
      { success: false, error: "Con trỏ phân trang không hợp lệ" },
      { status: 400 },
    );
  const csv = q.get("format") === "csv",
    take = csv ? 5000 : 100;
  const rows = await prisma.operationalLog.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const data = rows.slice(0, take),
    nextCursor = rows.length > take ? data.at(-1)!.id : null;
  if (csv) {
    const content = [
      ["time", "source", "severity", "message", "device"]
        .map(csvCell)
        .join(","),
      ...data.map((r) =>
        [
          r.occurredAt.toISOString(),
          r.source,
          r.severity,
          r.message,
          r.deviceId,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="monitor-logs.csv"',
        "X-Next-Cursor": nextCursor || "",
      },
    });
  }
  return NextResponse.json({ success: true, data, nextCursor });
});
