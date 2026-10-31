import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { resolveConnection } from "@/lib/network/connections";
import { UnifiClient } from "@/lib/unifi";
import { MikrotikClient } from "@/lib/mikrotik";
import {
  counterRate,
  dataQuality,
  finite,
  mapLimited,
  percentUsed,
  withLease,
} from "./core";
import { drainLogs, enqueueLog, redactLog } from "./logs";
import { runRetention } from "./retention";
import { tailSyslog } from "./syslog";
import { zabbix } from "./zabbix";
export interface Observation {
  key: string;
  name: string;
  kind: string;
  connectionId?: string;
  siteId?: string;
  deviceId?: string;
  metrics: Record<string, number | undefined>;
  metadata?: Record<string, any>;
  status?: string;
}
export function parseUptime(value: string | undefined) {
  if (!value) return undefined;
  let seconds = 0,
    matched = false;
  for (const part of Array.from(value.matchAll(/(\d+)(w|d|h|m|s)/g))) {
    matched = true;
    seconds +=
      Number(part[1]) *
      ((
        { w: 604800, d: 86400, h: 3600, m: 60, s: 1 } as Record<string, number>
      )[part[2]] || 0);
  }
  if (matched) return seconds;
  const clock = value.match(/^(\d+):(\d+):(\d+)$/);
  return clock
    ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
    : undefined;
}
async function rate(key: string, value: unknown, at: number, boot?: string) {
  const n = finite(value);
  if (n === undefined) return undefined;
  const previous = await redis.get(`monitor:counter:${key}`);
  const result = counterRate(
    previous ? JSON.parse(previous) : null,
    n,
    at,
    boot,
  );
  await redis.set(
    `monitor:counter:${key}`,
    JSON.stringify({ value: n, at, boot }),
    "EX",
    300,
  );
  return result ?? undefined;
}
export async function saveObservation(
  observation: Observation,
  assertLease = () => {},
) {
  assertLease();
  const { metrics, metadata: rawMetadata = {}, ...identity } = observation;
  const metadata = redactLog(rawMetadata);
  const now = new Date();
  const target = await prisma.monitoringTarget.upsert({
    where: { key: identity.key },
    create: {
      ...identity,
      status: identity.status || "online",
      lastSeenAt: now,
      metadata: {
        ...metadata,
        source: "collector",
        metrics,
        observedAt: now.toISOString(),
      },
    },
    update: {
      ...identity,
      status: identity.status || "online",
      lastSeenAt: now,
      metadata: {
        ...metadata,
        source: "collector",
        metrics,
        observedAt: now.toISOString(),
      },
    },
  });
  try {
    for (const [metricKey, metricVal] of Object.entries(metrics)) {
      const n = finite(metricVal);
      if (n !== undefined) {
        const point = JSON.stringify({ at: now.getTime(), value: n });
        await redis.lpush(`monitor:ts:${identity.key}:${metricKey}`, point);
        await redis.ltrim(`monitor:ts:${identity.key}:${metricKey}`, 0, 300);
        await redis.expire(`monitor:ts:${identity.key}:${metricKey}`, 172800);
        if (target.id) {
          await redis.lpush(`monitor:ts:${target.id}:${metricKey}`, point);
          await redis.ltrim(`monitor:ts:${target.id}:${metricKey}`, 0, 300);
          await redis.expire(`monitor:ts:${target.id}:${metricKey}`, 172800);
        }
      }
    }
  } catch {}

  try {
    if (process.env.ZABBIX_API_URL && process.env.ZABBIX_API_TOKEN) {
      assertLease();
      const { hostid, items } = await zabbix.provision(
        identity.key,
        identity.name,
        metrics,
      );
      await prisma.monitoringTarget.update({
        where: { id: target.id },
        data: { zabbixHostId: hostid },
      });
      assertLease();
      await zabbix.push(
        items
          .filter((i) => finite(metrics[i.key_]) !== undefined)
          .map((i) => ({
            itemid: i.itemid,
            value: metrics[i.key_]!,
            clock: Math.floor(now.getTime() / 1000),
          })),
      );
    }
  } catch (error) {
    await redis.set(
      "monitor:zabbix:error",
      JSON.stringify({
        at: Date.now(),
        message: error instanceof Error ? error.message : "Unavailable",
      }),
      "EX",
      300,
    );
  }
}
async function markSourceFailure(connectionId: string, error: unknown) {
  // Keep the last observation to render stale values; source failure is separate from device offline.
  const targets = await prisma.monitoringTarget.findMany({
    where: { connectionId },
  });
  for (const target of targets)
    await prisma.monitoringTarget.update({
      where: { id: target.id },
      data: {
        status: "source-unavailable",
        metadata: {
          ...(target.metadata as any),
          sourceError: "Connection collection failed",
          sourceFailedAt: new Date().toISOString(),
        },
      },
    });
  await enqueueLog({
    source: "collector",
    severity: "error",
    message: "Network source collection failed",
    connectionId,
    metadata: { error },
  });
}
async function collectConnection(
  id: string,
  provider: string,
  assertLease: () => void,
) {
  const c = await resolveConnection(
      provider as "UNIFI" | "MIKROTIK",
      undefined,
      id,
    ),
    at = Date.now();
  if (provider === "MIKROTIK") {
    const client = new MikrotikClient({
      host: c.baseUrl,
      username: c.username || "",
      password: c.credentials.password || "",
      allowInsecure: c.config.allowInsecure === true,
    });
    const [resource, identity, interfaces] = await Promise.all([
      client.getSystemResource(),
      client.getSystemIdentity(),
      client.getInterfaces(),
    ]);
    if (!resource) throw new Error("Router resource endpoint unavailable");
    const metrics: Record<string, number | undefined> = {
      available: 1,
      "cpu.percent": finite(resource.cpuLoad),
      "memory.percent": percentUsed(resource.freeMemory, resource.totalMemory),
      "memory.total.bytes": finite(resource.totalMemory),
      "disk.percent": percentUsed(
        resource.freeHddSpace,
        resource.totalHddSpace,
      ),
      "uptime.seconds": parseUptime(resource.uptime),
    };
    for (const iface of interfaces) {
      const prefix = `interface.${iface.id.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      metrics[`${prefix}.rx.bytes_sec`] = await rate(
        `${id}:${iface.id}:rx`,
        iface.rxByte,
        at,
        iface.lastLinkUpTime,
      );
      metrics[`${prefix}.tx.bytes_sec`] = await rate(
        `${id}:${iface.id}:tx`,
        iface.txByte,
        at,
        iface.lastLinkUpTime,
      );
      metrics[`${prefix}.running`] = iface.running ? 1 : 0;
    }
    await saveObservation(
      {
        key: `mikrotik.${id}`,
        name: identity?.name || c.name,
        kind: c.config.deviceRole === "core-switch" || c.config.deviceRole === "access-switch" ? "switch" : "router",
        connectionId: id,
        deviceId: id,
        metrics,
        metadata: {
          provider,
          deviceRole:c.config.deviceRole||"router",
          location:c.config.location,
          model: resource.boardName||c.config.model,
          version: resource.version,
          interfaces: interfaces.map((i) => ({
            id: i.id,
            name: i.name,
            running: i.running,
            type: i.type,
          })),
          snmp: c.config.snmpHostId ? "externally-managed" : "unconfigured",
          capabilities: {
            cpu: metrics["cpu.percent"] !== undefined,
            memory: metrics["memory.percent"] !== undefined,
          },
        },
      },
      assertLease,
    );
  } else {
    const sites = Array.isArray(c.config.sites)
      ? c.config.sites.map(String)
      : [String(c.config.site || "default")];
    for (const siteId of sites) {
      const client = new UnifiClient({
        controllerUrl: c.baseUrl,
        username: c.username || "",
        password: c.credentials.password || "",
        site: siteId,
        apiKey: c.credentials.apiKey,
        version: c.version,
        apiMode:
          c.config.apiMode === "legacy"
            ? "legacy"
            : c.config.apiMode === "official"
              ? "official"
              : undefined,
        apiPrefix:
          typeof c.config.apiPrefix === "string"
            ? c.config.apiPrefix
            : undefined,
        rejectUnauthorized: c.config.allowInsecure !== true,
      });
      await client.login();
      const devices = await client.getDevices();
      // Devices are still valid if client telemetry is unsupported; expose that capability separately.
      let clients: any[] | null = null;
      try {
        clients = await client.getClients();
      } catch {}
      await saveObservation(
        {
          key: `unifi.${id}.${siteId}`,
          name: `${c.name} / ${siteId}`,
          kind: "controller",
          connectionId: id,
          siteId,
          metrics: {
            available: 1,
            "devices.count": devices.length,
            ...(clients ? { "clients.count": clients.length } : {}),
          },
          metadata: {
            provider,
            clientsAvailable: clients !== null,
            snmp: "unconfigured",
          },
        },
        assertLease,
      );
      for (const device of devices as any[]) {
        const deviceId = String(device._id || device.mac);
        if (!deviceId) continue;
        const available =
          ["online", "connected"].includes(device.status) || device.state === 1
            ? 1
            : ["offline", "disconnected"].includes(device.status) ||
                device.state === 0
              ? 0
              : undefined;
        const metrics: Record<string, number | undefined> = {
          available: available,
          "cpu.percent": finite(device.cpuUsage ?? device.system_stats?.cpu),
          "memory.percent": finite(device.memUsage ?? device.system_stats?.mem),
          "uptime.seconds": finite(device.uptime),
          "rx.bytes_sec": await rate(
            `${id}:${deviceId}:rx`,
            device.rxBytes ?? device.rx_bytes,
            at,
          ),
          "tx.bytes_sec": await rate(
            `${id}:${deviceId}:tx`,
            device.txBytes ?? device.tx_bytes,
            at,
          ),
        };
        const ports = device.portTable || device.port_table || [],
          radios = device.radioTable || device.radio_table || [];
        const associated = clients?.filter(
          (c) => c.apMac === device.mac || c.ap_mac === device.mac,
        );
        if (device.type === "uap" && associated)
          metrics["clients.count"] = associated.length;
        await saveObservation(
          {
            key: `unifi.${id}.${siteId}.${deviceId}`,
            name: device.name || device.mac,
            kind:
              device.type === "usw"
                ? "switch"
                : device.type === "uap"
                  ? "ap"
                  : "gateway",
            connectionId: id,
            siteId,
            deviceId,
            status:
              available === undefined
                ? "unknown"
                : available
                  ? "online"
                  : "offline",
            metrics,
            metadata: {
              provider,
              model: device.model,
              version: device.version,
              ip: device.ipAddress || device.ip,
              ports,
              radios,
              clients: associated?.map((c) => ({
                mac: c.mac,
                hostname: c.hostname,
                signal: c.signal ?? c.rssi,
                channel: c.channel,
                radio: c.radio,
                ssid: c.ssid,
              })),
              snmp: "unconfigured",
            },
          },
          assertLease,
        );
      }
    }
  }
}
async function probe(
  key: string,
  name: string,
  url: string,
  assertLease: () => void,
) {
  const at = performance.now();
  let available = 0,
    status: number | undefined;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
      redirect: "error",
    });
    status = response.status;
    available = response.ok ? 1 : 0;
    await response.body?.cancel();
  } catch {}
  return saveObservation(
    {
      key,
      name,
      kind: "service",
      metrics: { available, "response.ms": performance.now() - at },
      status: available ? "online" : "offline",
      metadata: { url: new URL(url).origin, httpStatus: status },
    },
    assertLease,
  );
}
export async function collectOnce() {
  return withLease(redis, "monitor:collector:lease", async (assertLease) => {
    const started = Date.now(),
      errors: string[] = [];
    let zabbixVersion: string | undefined;
    try {
      const version = await zabbix.call<string>("apiinfo.version");
      zabbixVersion = version;
      if (!version.startsWith("7.")) throw new Error("Zabbix 7 required");
      await redis.del("monitor:zabbix:error");
    } catch (error) {
      errors.push("Zabbix unavailable");
      await redis.set(
        "monitor:zabbix:error",
        JSON.stringify({
          at: Date.now(),
          message: error instanceof Error ? error.message : "Unavailable",
        }),
        "EX",
        300,
      );
    }
    if (process.env.MONITOR_AGENT_ENABLED !== "false")
      try {
        assertLease();
        const agent = await zabbix.provisionAgentHost();
        const key = `external.${agent.hostid}`;
        await prisma.monitoringTarget.upsert({
          where: { key },
          create: {
            key,
            name: "Máy chủ ứng dụng",
            kind: "host",
            zabbixHostId: agent.hostid,
            metadata: { source: "zabbix-agent2", itemKeys: agent.itemKeys },
          },
          update: { zabbixHostId: agent.hostid },
        });
      } catch {
        errors.push("Không thể cấu hình nguồn Agent2 máy chủ");
      }
    const connections = await prisma.networkConnection.findMany({
      where: { provider: { in: ["UNIFI", "MIKROTIK"] } },
      select: { id: true, provider: true },
    });
    const results = await mapLimited(
      connections,
      Math.max(1, Math.min(8, Number(process.env.MONITOR_CONCURRENCY || 3))),
      async (c) => {
        try {
          await collectConnection(c.id, c.provider, assertLease);
        } catch (e) {
          await markSourceFailure(c.id, e);
          throw e;
        }
      },
    );
    errors.push(
      ...results
        .filter((r) => r.status === "rejected")
        .map(() => "Network collection failed"),
    );
    for (const mode of ["frontend", "backend", "collector"]) {
      const raw = await redis.get(`monitor:process:${mode}`);
      if (raw) {
        const snapshot = JSON.parse(raw);
        if (dataQuality(new Date(snapshot.at)) === "fresh") {
          try {
            await saveObservation(
              {
                key: `app.${mode}`,
                name: `Application ${mode}`,
                kind: "process",
                metrics: snapshot.metrics,
                metadata: {
                  pid: snapshot.pid,
                  source: "process.cpuUsage",
                  snapshotAt: snapshot.at,
                },
              },
              assertLease,
            );
          } catch {
            errors.push("Process history push failed");
          }
        } else errors.push(`${mode} process snapshot stale`);
      } else errors.push(`${mode} process snapshot missing`);
    }
    for (const [key, name, url] of [
      [
        "webui",
        "WebUI",
        process.env.MONITOR_WEBUI_URL || "http://127.0.0.1:3000/admin",
      ],
      [
        "backend",
        "Backend",
        process.env.MONITOR_BACKEND_URL ||
          "http://127.0.0.1:3001/api/monitor/health",
      ],
      [
        "minio",
        "MinIO",
        `${process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000"}/minio/health/live`,
      ],
    ]) {
      try {
        await probe(`service.${key}`, name, url, assertLease);
      } catch {
        errors.push(`${name} collection failed`);
      }
    }
    for (const [key, name, check] of [
      ["postgres", "PostgreSQL", () => prisma.$queryRaw`SELECT 1`],
      ["redis", "Redis", () => redis.ping()],
    ] as const) {
      const at = performance.now();
      let available = 1;
      try {
        await check();
      } catch {
        available = 0;
      }
      try {
        await saveObservation(
          {
            key: `service.${key}`,
            name,
            kind: "service",
            metrics: { available, "response.ms": performance.now() - at },
            status: available ? "online" : "offline",
          },
          assertLease,
        );
      } catch {
        errors.push(`${name} history push failed`);
      }
    }
    try {
      await drainLogs();
      const syslog = await tailSyslog();
      if (!syslog.available) errors.push("Syslog not configured or missing");
    } catch {
      errors.push("Log ingest failed");
    }
    if (process.env.ZABBIX_API_URL && process.env.ZABBIX_API_TOKEN && zabbixVersion && !zabbixVersion.includes('unavailable')) {
      const external = await prisma.monitoringTarget.findMany({
        where: { key: { startsWith: "external." } },
      });
      for (const target of external) {
        if (!target.zabbixHostId) continue;
        try {
          assertLease();
          const items = await zabbix.items(target.zabbixHostId),
          mapping = (target.metadata as any)?.itemKeys || {};
        const metrics: Record<string, number> = {},
          metricSamples: Record<
            string,
            { quality: string; observedAt: string | null }
          > = {};
        const clocks: number[] = [];
        let missing = false,
          stale = false;
        for (const [metric, itemKey] of Object.entries(mapping)) {
          const item = items.find((i) => i.key_ === itemKey),
            value = finite(item?.lastvalue),
            clock = Number(item?.lastclock || 0) * 1000;
          const observedAt = clock > 0 ? new Date(clock) : null;
          const quality =
            value === undefined || !observedAt
              ? "missing"
              : dataQuality(observedAt);
          metricSamples[metric] = {
            quality,
            observedAt: observedAt?.toISOString() || null,
          };
          if (quality === "fresh") metrics[metric] = value!;
          if (quality === "missing") missing = true;
          else clocks.push(clock);
          if (quality === "stale") stale = true;
        }
        const lastSeenAt =
          !missing && clocks.length ? new Date(Math.min(...clocks)) : null;
        await prisma.monitoringTarget.update({
          where: { id: target.id },
          data: {
            status:
              missing || !clocks.length
                ? "unknown"
                : stale
                  ? "stale"
                  : "online",
            lastSeenAt,
            metadata: { ...(target.metadata as any), metrics, metricSamples },
          },
        });
      } catch {
        await prisma.monitoringTarget.update({
          where: { id: target.id },
          data: { status: "source-unavailable" },
        });
        errors.push("Agent2 host source unavailable");
      }
    }
  }
    const retainedAt = Number((await redis.get("monitor:retention:last")) || 0);
    if (Date.now() - retainedAt > 86400000) {
      try {
        await runRetention();
        await redis.set("monitor:retention:last", String(Date.now()));
      } catch {
        errors.push("Retention job failed");
      }
    }
    await redis.set(
      "monitor:collector:heartbeat",
      JSON.stringify({
        at: Date.now(),
        durationMs: Date.now() - started,
        errors,
        zabbixVersion,
        connections: connections.length,
      }),
      "EX",
      300,
    );
    return { errors };
  });
}
