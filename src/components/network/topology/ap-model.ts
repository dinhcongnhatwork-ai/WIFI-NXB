import type { Topology } from "@/lib/network/topology";
import type { Device, Link, Traffic } from "./model";
import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./layout";
import { aggregate } from "./model";
export type AccessNodeData = NodeData & {
  accessPointName: string;
  clientCount?: number;
  clock?: number;
  onSelectAp?: (id: string) => void;
};
export const ACCESS_CARD = { width: 300, height: 205 };
export function clientsOf(topology: Topology, apId: string): Device[] {
  const ids = new Set(
    topology.links
      .filter((edge) => edge.source === apId)
      .map((edge) => edge.target),
  );
  return topology.nodes
    .filter((node) => node.type === "client" && ids.has(node.id))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
export function accessPointLayout(
  ap: Device,
  clients: Device[],
  links: Link[],
  columns: number,
  traffic: Record<string, Traffic> = {},
) {
  const cols = Math.max(1, Math.min(3, columns, Math.max(1, clients.length)));
  const width = cols * 360 + 24;
  const measured = clients.map((device) => ({
    ...device,
    traffic: latestTraffic(device.traffic, traffic[device.id]),
  }));
  const rootTraffic = aggregate(measured.map((device) => device.traffic));
  const makeNode = (
    device: Device,
    x: number,
    y: number,
    root = false,
  ): Node<AccessNodeData> => ({
    id: device.id,
    type: "access-device",
    position: { x, y },
    style: ACCESS_CARD,
    initialWidth: ACCESS_CARD.width,
    initialHeight: ACCESS_CARD.height,
    data: {
      device,
      traffic: root ? rootTraffic : device.traffic,
      accessPointName: ap.name,
      ...(root ? { clientCount: clients.length } : {}),
    },
    draggable: false,
  });
  const nodes = [
    makeNode(ap, (cols * 360 + 36) / 2 - 150, 24, true),
    ...measured.map((device, i) =>
      makeNode(device, (i % cols) * 360 + 48, 330 + Math.floor(i / cols) * 260),
    ),
  ];
  const edges: Edge[] = measured.flatMap((device, i) => {
    const link = links.find(
      (edge) => edge.source === ap.id && edge.target === device.id,
    );
    return link
      ? [
          {
            id: link.id,
            source: ap.id,
            target: device.id,
            type: "traffic",
            targetHandle: "peer-in",
            data: {
              link,
              traffic: device.traffic,
              rich: true,
              laneX: (i % cols) * 360 + 24,
              busY: 270,
            },
          },
        ]
      : [];
  });
  return { nodes, edges, width };
}

export function duration(seconds: unknown) {
  const value = typeof seconds === "number" ? seconds : NaN;
  if (!Number.isFinite(value) || value < 0) return "—";
  const total = Math.floor(value),
    days = Math.floor(total / 86400),
    hours = Math.floor((total % 86400) / 3600),
    minutes = Math.floor((total % 3600) / 60);
  return days
    ? `${days} ngày ${hours} giờ`
    : hours
      ? `${hours} giờ ${minutes} phút`
      : minutes
        ? `${minutes} phút`
        : `${total} giây`;
}
export function observedTime(raw: unknown) {
  if (typeof raw !== "number" || raw < 1e9) return "—";
  return new Date(raw > 1e12 ? raw : raw * 1000).toLocaleString("vi-VN", {
    timeZone: "Asia/Bangkok",
  });
}

export function radioLabel(meta?: Record<string, unknown>) {
  if (meta?.isWired) return "Có dây";
  return (
    (
      { na: "5 GHz", ng: "2.4 GHz", "6e": "6 GHz", "6g": "6 GHz" } as Record<
        string,
        string
      >
    )[String(meta?.radio || "")] || String(meta?.radio || "—")
  );
}
export function wifiStandard(protocol: unknown) {
  return (
    (
      {
        ac: "WiFi 5 · 802.11ac",
        ax: "WiFi 6 · 802.11ax",
        n: "WiFi 4 · 802.11n",
      } as Record<string, string>
    )[String(protocol || "")] || String(protocol || "—")
  );
}

/** The metadata response may contain a newer traffic sample than the traffic feed. */
export function latestTraffic(a?: Traffic, b?: Traffic) {
  if (!a) return b;
  if (!b) return a;
  return (Date.parse(b.sampledAt) || 0) >= (Date.parse(a.sampledAt) || 0)
    ? b
    : a;
}
