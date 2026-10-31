import { createHash, randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { resolveConnection } from "./connections";
import { sampleTraffic, type TrafficSample } from "./traffic";
import { buildMikrotikTopology, type Topology } from "./topology";

export interface TopologyTraffic {
  nodes: Record<string, TrafficSample>;
  links: Record<string, TrafficSample>;
  source: string;
  sampledAt: string;
  warnings: string[];
}
function updateSample(current: TrafficSample, previous?: TrafficSample) {
  return sampleTraffic(
    {
      perspective: current.perspective,
      downloadBytes: current.downloadBytes,
      uploadBytes: current.uploadBytes,
      downloadBytesPerSecond:
        current.downloadBps === null ? null : current.downloadBps / 8,
      uploadBytesPerSecond:
        current.uploadBps === null ? null : current.uploadBps / 8,
      sessionId: current.sessionId,
    },
    current.source,
    current.sampledAt,
    previous?.source === current.source &&
      previous?.perspective === current.perspective
      ? previous
      : undefined,
  );
}
export function sampleTopology(
  topology: Topology,
  previous?: TopologyTraffic,
): TopologyTraffic {
  const nodes: TopologyTraffic["nodes"] = {};
  const links: TopologyTraffic["links"] = {};
  for (const node of topology.nodes) {
    if (!node.traffic) continue;
    node.traffic = updateSample(node.traffic, previous?.nodes[node.id]);
    nodes[node.id] = node.traffic;
  }
  for (const edge of topology.links) {
    if (!edge.traffic) continue;
    edge.traffic = updateSample(edge.traffic, previous?.links[edge.id]);
    links[edge.id] = edge.traffic;
  }
  return {
    nodes,
    links,
    sampledAt: topology.observedAt,
    source: Object.values(nodes)[0]?.source?.split(" · ")[0] || "Network",
    warnings: [...topology.warnings],
  };
}
const pending = new Map<string, Promise<Topology>>();
/** Shared 3s snapshot and 120s counter history, scoped to resolved connection and site. */
export async function getSampledTopology(
  provider: "UNIFI" | "MIKROTIK",
  req: Request,
): Promise<Topology> {
  const connection = await resolveConnection(provider, req);
  const query = new URL(req.url).searchParams;
  const site =
    provider === "UNIFI"
      ? query.get("siteId") ||
        query.get("site") ||
        String(connection.config.site || "default")
      : "";
  const scope = createHash("sha256")
    .update(JSON.stringify([provider, connection.id, connection.baseUrl, site]))
    .digest("hex");
  const key = `topology:v2:${scope}`;
  if (pending.has(key)) return pending.get(key)!;
  const work = (async () => {
    let cacheAvailable = true;
    let acquired = false;
    const token = randomUUID();
    try {
      const cached = await redis.get(`${key}:cache`);
      if (cached) return JSON.parse(cached) as Topology;
      acquired =
        (await redis.set(`${key}:lock`, token, "EX", 30, "NX")) === "OK";
      if (!acquired) {
        // Another worker is collecting; share its result instead of hitting the device again.
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const shared = await redis.get(`${key}:cache`);
          if (shared) return JSON.parse(shared) as Topology;
        }
        throw new Error("Đang thu thập dữ liệu mạng, vui lòng thử lại.");
      }
    } catch (error) {
      if (
        !acquired &&
        error instanceof Error &&
        error.message.startsWith("Đang thu thập")
      )
        throw error;
      cacheAvailable = false;
    }
    try {
      let topology: Topology;
      if (provider === "UNIFI") {
        const { getUnifiClientFromRequest } = await import("@/lib/settings");
        const client = await getUnifiClientFromRequest(req);
        await client.login();
        topology = await client.getTopology();
      } else {
        const { createMikrotikClientFromRequest } =
          await import("@/lib/mikrotik");
        const client = await createMikrotikClientFromRequest(req);
        const warnings: string[] = [];
        const optional = async (path: string) => {
          try {
            const rows = await client.rawGet(path);
            return Array.isArray(rows) ? rows : [];
          } catch {
            warnings.push(`${path}: unavailable or forbidden`);
            return [];
          }
        };
        const [
          identity,
          interfaces,
          neighbors,
          hosts,
          ports,
          sessions,
          addresses,
          arp,
          leases,
        ] = await Promise.all([
          client.rawGet("/system/identity"),
          client.rawGet("/interface"),
          optional("/ip/neighbor"),
          optional("/interface/bridge/host"),
          optional("/interface/bridge/port"),
          optional("/ip/hotspot/active"),
          optional("/ip/address"),
          client.getArpEntries().catch(() => optional("/ip/arp")),
          client.getDhcpLeases().catch(() => optional("/ip/dhcp-server/lease")),
        ]);
        topology = buildMikrotikTopology(
          (Array.isArray(identity) ? identity[0] : identity) || {},
          interfaces as any[],
          neighbors,
          hosts,
          ports,
          new Date().toISOString(),
          warnings,
          sessions,
          addresses,
          arp,
          leases,
        );
      }
      let previous: TopologyTraffic | undefined;
      if (cacheAvailable) {
        try {
          const saved = await redis.get(`${key}:samples`);
          previous = saved ? JSON.parse(saved) : undefined;
        } catch {
          cacheAvailable = false;
        }
      }
      const traffic = sampleTopology(topology, previous);
      if (cacheAvailable) {
        try {
          await redis
            .multi()
            .set(`${key}:samples`, JSON.stringify(traffic), "EX", 120)
            .set(`${key}:cache`, JSON.stringify(topology), "EX", 3)
            .exec();
        } catch {
          cacheAvailable = false;
        }
      }
      if (!cacheAvailable)
        topology.warnings.push(
          "Redis không khả dụng: không lưu mẫu trước; tốc độ delta đang chờ đo.",
        );
      return topology;
    } finally {
      if (acquired)
        await redis
          .eval(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
            1,
            `${key}:lock`,
            token,
          )
          .catch(() => undefined);
    }
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
export function topologyTraffic(topology: Topology): TopologyTraffic {
  return {
    nodes: Object.fromEntries(
      topology.nodes.filter((n) => n.traffic).map((n) => [n.id, n.traffic!]),
    ),
    links: Object.fromEntries(
      topology.links.filter((e) => e.traffic).map((e) => [e.id, e.traffic!]),
    ),
    source:
      Object.values(topology.nodes)
        .find((n) => n.traffic)
        ?.traffic?.source.split(" · ")[0] || "Network",
    sampledAt: topology.observedAt,
    warnings: topology.warnings,
  };
}
