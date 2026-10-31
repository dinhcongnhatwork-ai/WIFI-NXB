import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/api-access";
import { targetWhere, cachedSource } from "./api";
import {
  fingerprint,
  timeRange,
  monitorWindow,
  dataQuality,
  finite,
  mapLimited,
} from "./core";
import { zabbix } from "./zabbix";
import { METRICS, metricSeries } from "./metric-series";

export const metricsBatch = withPermission("read", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const ids = Array.from(
    new Set((q.get("targetIds") || "").split(",").filter(Boolean)),
  );
  const metrics = Array.from(
    new Set((q.get("metrics") || "cpu.percent,memory.percent").split(",")),
  );
  if (
    !ids.length ||
    ids.length > 24 ||
    metrics.some((m) => !METRICS.includes(m)) ||
    ids.length * metrics.length > 96
  )
    return NextResponse.json(
      {
        success: false,
        error: "Tối đa 24 đối tượng, 96 chuỗi; chỉ hỗ trợ chỉ số đã công bố",
      },
      { status: 400 },
    );
  const targets = await prisma.monitoringTarget.findMany({
    where: { ...targetWhere(req), id: { in: ids } },
  });
  if (targets.length !== ids.length)
    return NextResponse.json(
      { success: false, error: "Đối tượng không thuộc phạm vi bộ lọc" },
      { status: 404 },
    );
  const window = monitorWindow(q);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const itemRequests = new Map<string, ReturnType<typeof zabbix.items>>();
  const pairs = targets.flatMap((target) =>
    metrics.map((metric) => ({ target, metric })),
  );
  const results = await mapLimited(pairs, 4, async ({ target, metric }) => {
    const result = await cachedSource(
      fingerprint({ batch: target.id, metric, seconds, end }),
      async () => {
        let items: any = undefined;
        if (target.zabbixHostId && process.env.ZABBIX_API_URL && process.env.ZABBIX_API_TOKEN) {
          try {
            if (!itemRequests.has(target.id))
              itemRequests.set(target.id, zabbix.items(target.zabbixHostId));
            items = await itemRequests.get(target.id);
          } catch {}
        }
        return metricSeries(target, metric, seconds, items, end);
      },
      15,
    );
    if (metric === "available" && q.get("slaTargetId") === target.id) {
      const slaResult = await cachedSource(
        fingerprint({ sla30d: target.id }),
        async () => {
          const series = await metricSeries(
            target,
            "available",
            2592000,
            await itemRequests.get(target.id),
          );
          return {
            availability: series.availability,
            estimated: series.availabilityEstimated,
            reason: series.availabilityReason,
            quality: series.quality,
            sampledAt: series.lastAt,
          };
        },
        60,
      );
      if (result.data)
        return {
          targetId: target.id,
          metric,
          ...result,
          data: { ...(result.data as object), sla30d: slaResult },
        };
    }
    return { targetId: target.id, metric, ...result };
  });
  return NextResponse.json({
    success: true,
    data: results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    source: "zabbix",
    sampledAt: new Date().toISOString(),
  });
});

export const summary = withPermission("read", async (req: NextRequest) => {
  const targets = await prisma.monitoringTarget.findMany({
    where: targetWhere(req),
  });
  // Keep controller/site and router observations separate: AP counts overlap
  // controller counts and independent providers can observe the same clients.
  const sources = targets
    .filter((t) => ["controller", "router"].includes(t.kind))
    .map((t) => {
      const m: any = t.metadata,
        fresh =
          dataQuality(t.lastSeenAt) === "fresh" &&
          t.status !== "source-unavailable";
      return {
        targetId: t.id,
        name: t.name,
        provider: m?.provider || m?.source,
        perspective: "device",
        sampledAt: t.lastSeenAt,
        quality: fresh ? "fresh" : "stale",
        clients: fresh ? (finite(m?.metrics?.["clients.count"]) ?? null) : null,
        rxBytesSec: fresh
          ? (finite(m?.metrics?.["rx.bytes_sec"]) ?? null)
          : null,
        txBytesSec: fresh
          ? (finite(m?.metrics?.["tx.bytes_sec"]) ?? null)
          : null,
      };
    });
  const availabilityTargets = targets
    .filter((t) => t.zabbixHostId)
    .slice(0, 24);
  const window = monitorWindow(req.nextUrl.searchParams);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const availabilityResults = await mapLimited(
    availabilityTargets,
    4,
    async (target) => ({
      targetId: target.id,
      name: target.name,
      ...(await cachedSource(
        fingerprint({ summary: target.id, seconds, end }),
        async () => {
          const series = await metricSeries(
            target,
            "available",
            seconds,
            undefined,
            end,
          );
          return {
            availability: series.availability,
            estimated: series.availabilityEstimated,
            reason: series.availabilityReason,
            quality: series.quality,
            sampledAt: series.lastAt,
          };
        },
        30,
      )),
    }),
  );
  const sla = availabilityResults.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );
  return NextResponse.json({
    success: true,
    source: "collector / zabbix",
    sampledAt: new Date().toISOString(),
    data: {
      sources,
      sla,
      coverage: {
        queried: availabilityTargets.length,
        total: targets.filter((t) => t.zabbixHostId).length,
      },
      hosts: {
        total: targets.length,
        online: targets.filter(
          (t) => t.status === "online" && dataQuality(t.lastSeenAt) === "fresh",
        ).length,
        unknown: targets.filter(
          (t) =>
            dataQuality(t.lastSeenAt) !== "fresh" ||
            ["unknown", "source-unavailable"].includes(t.status),
        ).length,
      },
    },
  });
});
export const top = withPermission("read", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams,
    metric = q.get("metric") || "cpu.percent";
  const limit = Math.min(10, Math.max(1, Number(q.get("limit")) || 5));
  if (!METRICS.includes(metric))
    return NextResponse.json(
      { success: false, error: "Chỉ số không hợp lệ" },
      { status: 400 },
    );
  const targets = await prisma.monitoringTarget.findMany({
    where: targetWhere(req),
  });
  if (targets.length > 96)
    return NextResponse.json(
      {
        success: false,
        error:
          "Hãy thu hẹp site/kết nối: tối đa 96 đối tượng mỗi truy vấn xếp hạng",
      },
      { status: 400 },
    );
  const window = monitorWindow(q);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const mode = q.get("aggregation") === "max" ? "max" : "avg";
  const results = await mapLimited(targets, 4, async (t) => {
    const response = await cachedSource(
      fingerprint({ top: t.id, metric, seconds, mode, end }),
      async () => {
        const series = await metricSeries(t, metric, seconds, undefined, end);
        const value = mode === "max" ? series.stats.max : series.stats.average;
        return {
          targetId: t.id,
          name: t.name,
          kind: t.kind,
          value,
          sampledAt: series.lastAt,
          source: "zabbix",
          quality: series.quality,
        };
      },
      15,
    );
    return response;
  });
  const responses = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value as any] : [],
  );
  const rows = responses.flatMap((r) =>
    r.data?.value != null
      ? [
          {
            ...r.data,
            quality: r.quality === "stale" ? "stale" : r.data.quality,
          },
        ]
      : [],
  );
  return NextResponse.json({
    success: true,
    data: rows.sort((a, b) => b.value - a.value).slice(0, limit),
    aggregation: mode,
    metric,
    missing: targets.length - rows.length,
    source: "zabbix",
  });
});
export const histogram = withPermission("read", async (req: NextRequest) => {
  const targets = await prisma.monitoringTarget.findMany({
    where: targetWhere(req),
    select: { zabbixHostId: true },
  });
  const hostids = targets.flatMap((t) =>
      t.zabbixHostId ? [t.zabbixHostId] : [],
    ),
    window = monitorWindow(req.nextUrl.searchParams);
  if (window.error)
    return NextResponse.json(
      { success: false, error: window.error },
      { status: 400 },
    );
  const { seconds, end } = window;
  const bucket = req.nextUrl.searchParams.get("bucket") || "1h";
  if (!["1h", "6h", "24h"].includes(bucket))
    return NextResponse.json(
      { success: false, error: "Khoảng nhóm không hợp lệ" },
      { status: 400 },
    );
  return NextResponse.json(
    await cachedSource(
      fingerprint({ histogram: hostids, seconds, bucket, end }),
      async () => {
        if (!hostids.length) throw new Error("Chưa cấu hình host Zabbix");
        const now = Math.floor((end ?? Date.now()) / 1000),
          width = { "1h": 3600, "6h": 21600, "24h": 86400 }[bucket]!;
        const rows = await zabbix.call<any[]>("event.get", {
          hostids,
          output: ["eventid", "clock", "severity"],
          time_from: Math.floor(now - seconds),
          ...(end === undefined ? {} : { time_till: now }),
          source: 0,
          object: 0,
          value: 1,
          sortfield: "eventid",
          sortorder: "DESC",
          limit: 10000,
        });
        const buckets = new Map<
          number,
          { at: number; info: number; warning: number; critical: number }
        >();
        for (
          let at = Math.floor((now - seconds) / width) * width;
          at <= now;
          at += width
        )
          buckets.set(at, { at: at * 1000, info: 0, warning: 0, critical: 0 });
        for (const event of rows) {
          const at = Math.floor(Number(event.clock) / width) * width,
            b = buckets.get(at);
          if (b)
            b[
              Number(event.severity) >= 4
                ? "critical"
                : Number(event.severity) >= 2
                  ? "warning"
                  : "info"
            ]++;
        }
        return {
          buckets: Array.from(buckets.values()),
          truncated: rows.length === 10000,
          source: "zabbix",
          sampledAt: new Date().toISOString(),
        };
      },
    ),
  );
});
