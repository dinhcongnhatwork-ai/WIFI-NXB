import { mikrotikInfrastructureTopology } from "./mikrotik-infrastructure";
import { prisma } from "@/lib/prisma";
import { getSampledTopology } from "./traffic-service";
import {
  mergeMikrotikFleet,
  type FleetConnection,
  type FleetObservation,
} from "./mikrotik-fleet-model";
/** Query only saved endpoints, with bounded concurrency; no scanning or credential propagation. */
export async function getMikrotikFleetTopology(req: Request) {
  const rows = await prisma.networkConnection.findMany({
    where: { provider: "MIKROTIK" },
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      config: true,
    },
    orderBy: [{ name: "asc" }],
  });
  const observations: FleetObservation[] = [];
  const scopedRequest = (connectionId: string, siteId?: string) => {
    const url = new URL(req.url);
    url.search = "";
    url.searchParams.set("connectionId", connectionId);
    if (siteId) url.searchParams.set("siteId", siteId);
    return new Request(url, { headers: req.headers });
  };
  const tasks = rows
    .filter((row) => row.provider === "MIKROTIK")
    .map((row) => async () => {
      const connection: FleetConnection = {
        id: row.id,
        name: row.name,
        baseUrl: row.baseUrl,
        config: (row.config || {}) as Record<string, unknown>,
      };
      if (connection.config.operatingSystem === "swos") {
        observations.push({
          connection,
          error:
            "SwOS: chưa có bộ thu thập cổng; thiết bị đang ở chế độ danh mục.",
        });
        return;
      }
      try {
        const topology = await getSampledTopology(
          "MIKROTIK",
          scopedRequest(row.id),
          { infrastructureOnly: true },
        );
        observations.push({ connection, topology });
      } catch {
        observations.push({
          connection,
          error:
            "Không đọc được RouterOS. Kiểm tra địa chỉ, tài khoản REST và kết nối thiết bị.",
        });
      }
    });
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      await task();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, tasks.length) }, () => worker()),
  );
  const result = mergeMikrotikFleet(
    observations.sort((a, b) => a.connection.id.localeCompare(b.connection.id)),
  );
  return mikrotikInfrastructureTopology(result);
}
