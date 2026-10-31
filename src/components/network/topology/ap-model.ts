import type { Topology } from "@/lib/network/topology";
import type { Device, Link, Traffic } from "./model";
import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./layout";
import { aggregate, TRAFFIC_THRESHOLD_BPS } from "./model";
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
    const dDownload = device.traffic?.downloadBps || 0;
    const dUpload = device.traffic?.uploadBps || 0;
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
              traffic: {
                ...device.traffic,
                downloadBps: dDownload >= TRAFFIC_THRESHOLD_BPS ? dDownload : 0,
                uploadBps: dUpload >= TRAFFIC_THRESHOLD_BPS ? dUpload : 0,
              },
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

function getApFloorNumber(name: string): number {
  const match = name.match(/AP(\d+)\./i);
  if (match) return parseInt(match[1], 10);
  return 99;
}

export function allAccessPointsLayout(
  topology: Topology,
  accessPoints: Device[],
  _columns: number,
  traffic: Record<string, Traffic> = {},
  floorFilter: string = "all",
) {
  const gateway = topology.nodes.find((n) => n.type === "gateway") || {
    id: "root-controller",
    name: "UniFi Network System",
    type: "gateway" as const,
    ip: "192.168.1.1",
    status: "online",
    meta: { model: "UniFi Network Controller" },
  };

  let filteredAps = accessPoints;
  if (floorFilter === "active") {
    filteredAps = accessPoints.filter(
      (ap) => clientsOf(topology, ap.id).length > 0,
    );
  } else if (floorFilter === "f1-3") {
    filteredAps = accessPoints.filter((ap) => {
      const f = getApFloorNumber(ap.name);
      return f >= 1 && f <= 3;
    });
  } else if (floorFilter === "f4-6") {
    filteredAps = accessPoints.filter((ap) => {
      const f = getApFloorNumber(ap.name);
      return f >= 4 && f <= 6;
    });
  } else if (floorFilter === "f7-9") {
    filteredAps = accessPoints.filter((ap) => {
      const f = getApFloorNumber(ap.name);
      return f >= 7 && f <= 9;
    });
  } else if (floorFilter === "f10-12") {
    filteredAps = accessPoints.filter((ap) => {
      const f = getApFloorNumber(ap.name);
      return f >= 10 && f <= 12;
    });
  } else if (floorFilter === "online") {
    filteredAps = accessPoints.filter((ap) => ap.status === "online");
  }

  // Sort APs naturally by Floor number then by AP Name
  const sortedAps = [...filteredAps].sort((a, b) => {
    const fA = getApFloorNumber(a.name);
    const fB = getApFloorNumber(b.name);
    if (fA !== fB) return fA - fB;
    return a.name.localeCompare(b.name, "vi", { numeric: true });
  });

  const apSlots = sortedAps.map((ap) => {
    const clients = clientsOf(topology, ap.id);
    const clientCount = clients.length;
    const slotWidth = clientCount <= 1 ? 320 : Math.max(560, clientCount * 270 + 40);
    return { ap, clients, clientCount, slotWidth };
  });

  const startX = 60;
  const slotGap = 28;
  let currentX = startX;

  const slotsWithPositions = apSlots.map((slot) => {
    const slotX = currentX;
    currentX += slot.slotWidth + slotGap;
    return { ...slot, slotX };
  });

  const totalWidth = Math.max(1400, currentX + startX - slotGap);
  const rootWidth = 340;
  const rootHeight = 205;
  const rootX = totalWidth / 2 - rootWidth / 2;
  const rootY = 20;

  const allClients = topology.nodes.filter((n) => n.type === "client");
  const allClientTraffic = aggregate(
    allClients.map((c) => latestTraffic(c.traffic, traffic[c.id])),
  );

  const rootNode: Node<AccessNodeData> = {
    id: gateway.id,
    type: "access-device",
    position: { x: rootX, y: rootY },
    style: { width: rootWidth, height: rootHeight },
    initialWidth: rootWidth,
    initialHeight: rootHeight,
    data: {
      device: gateway as Device,
      traffic: allClientTraffic,
      accessPointName: gateway.name,
      clientCount: allClients.length,
    },
    draggable: false,
  };

  const apY = 345;
  const clientY = 645;

  const apNodes: Node<AccessNodeData>[] = [];
  const clientNodes: Node<AccessNodeData>[] = [];
  const edges: Edge[] = [];

  slotsWithPositions.forEach(({ ap, clients, slotWidth, slotX }) => {
    const apCardWidth = 280;
    const apCardHeight = 205;
    const apX = slotX + (slotWidth - apCardWidth) / 2;

    const measuredClients = clients.map((c) =>
      latestTraffic(c.traffic, traffic[c.id]),
    );
    const apClientTraffic = aggregate(measuredClients);

    // Only APs with actual connected clients carry client traffic
    // Empty APs with 0 clients must NOT have artificial flows running
    const apTotalTraffic: Traffic | undefined = clients.length > 0
      ? (apClientTraffic?.downloadBps || apClientTraffic?.uploadBps ? apClientTraffic : latestTraffic(ap.traffic, apClientTraffic))
      : ap.traffic
        ? {
            ...ap.traffic,
            downloadBytes: 0,
            uploadBytes: 0,
            downloadBps: 0,
            uploadBps: 0,
            source: ap.traffic.source || "unifi",
            sampledAt: ap.traffic.sampledAt || new Date().toISOString(),
          }
        : undefined;

    const apDownload = apTotalTraffic?.downloadBps || 0;
    const apUpload = apTotalTraffic?.uploadBps || 0;
    const hasApRealTraffic = clients.length > 0 && (apDownload >= TRAFFIC_THRESHOLD_BPS || apUpload >= TRAFFIC_THRESHOLD_BPS);

    apNodes.push({
      id: ap.id,
      type: "access-device",
      position: { x: apX, y: apY },
      style: { width: apCardWidth, height: apCardHeight },
      initialWidth: apCardWidth,
      initialHeight: apCardHeight,
      data: {
        device: ap,
        traffic: apTotalTraffic,
        accessPointName: ap.name,
        clientCount: clients.length,
      },
      draggable: false,
    });

    // Direct wire: Controller -> AP (Trunk bus line at Y=285)
    // Only APs with actual measured throughput >= TRAFFIC_THRESHOLD_BPS will register active flow
    edges.push({
      id: `edge-${gateway.id}-${ap.id}`,
      source: gateway.id,
      target: ap.id,
      type: "traffic",
      targetHandle: "peer-in",
      data: {
        link: {
          id: `link-${gateway.id}-${ap.id}`,
          source: gateway.id,
          target: ap.id,
          type: "wired",
          speedMbps: 1000,
        },
        traffic: apTotalTraffic
          ? {
              ...apTotalTraffic,
              downloadBps: hasApRealTraffic && apDownload >= TRAFFIC_THRESHOLD_BPS ? apDownload : 0,
              uploadBps: hasApRealTraffic && apUpload >= TRAFFIC_THRESHOLD_BPS ? apUpload : 0,
            }
          : undefined,
        rich: true,
        busY: 285,
      },
    });

    // Client devices directly attached beneath parent AP
    if (clients.length === 1) {
      const c = clients[0];
      const clientTraffic = latestTraffic(c.traffic, traffic[c.id]);
      const cDownload = clientTraffic?.downloadBps || 0;
      const cUpload = clientTraffic?.uploadBps || 0;
      const hasClientRealTraffic = cDownload >= TRAFFIC_THRESHOLD_BPS || cUpload >= TRAFFIC_THRESHOLD_BPS;

      const clientWidth = 250;
      const clientHeight = 115;
      const clientX = slotX + (slotWidth - clientWidth) / 2;

      clientNodes.push({
        id: c.id,
        type: "access-device",
        position: { x: clientX, y: clientY },
        style: { width: clientWidth, height: clientHeight },
        initialWidth: clientWidth,
        initialHeight: clientHeight,
        data: {
          device: c,
          traffic: clientTraffic,
          accessPointName: ap.name,
        },
        draggable: false,
      });

      edges.push({
        id: `edge-${ap.id}-${c.id}`,
        source: ap.id,
        target: c.id,
        type: "traffic",
        targetHandle: "peer-in",
        data: {
          link: {
            id: `link-${ap.id}-${c.id}`,
            source: ap.id,
            target: c.id,
            type: "wireless",
            speedMbps: c.meta?.txPhyMbps ? Number(c.meta.txPhyMbps) : 866,
          },
          traffic: {
            ...clientTraffic,
            downloadBps: cDownload >= TRAFFIC_THRESHOLD_BPS ? cDownload : 0,
            uploadBps: cUpload >= TRAFFIC_THRESHOLD_BPS ? cUpload : 0,
          },
          rich: true,
          busY: 585,
        },
      });
    } else if (clients.length > 1) {
      const clientWidth = 250;
      const clientHeight = 115;
      const clientGap = 20;
      const totalClientsWidth =
        clients.length * clientWidth + (clients.length - 1) * clientGap;
      const startClientX = slotX + (slotWidth - totalClientsWidth) / 2;

      clients.forEach((c, idx) => {
        const clientX = startClientX + idx * (clientWidth + clientGap);
        const clientTraffic = latestTraffic(c.traffic, traffic[c.id]);
        const cDownload = clientTraffic?.downloadBps || 0;
        const cUpload = clientTraffic?.uploadBps || 0;
        const hasClientRealTraffic = cDownload >= TRAFFIC_THRESHOLD_BPS || cUpload >= TRAFFIC_THRESHOLD_BPS;

        clientNodes.push({
          id: c.id,
          type: "access-device",
          position: { x: clientX, y: clientY },
          style: { width: clientWidth, height: clientHeight },
          initialWidth: clientWidth,
          initialHeight: clientHeight,
          data: {
            device: c,
            traffic: clientTraffic,
            accessPointName: ap.name,
          },
          draggable: false,
        });

        edges.push({
          id: `edge-${ap.id}-${c.id}`,
          source: ap.id,
          target: c.id,
          type: "traffic",
          targetHandle: "peer-in",
          data: {
            link: {
              id: `link-${ap.id}-${c.id}`,
              source: ap.id,
              target: c.id,
              type: "wireless",
              speedMbps: c.meta?.txPhyMbps ? Number(c.meta.txPhyMbps) : 866,
            },
            traffic: {
              ...clientTraffic,
              downloadBps: cDownload >= TRAFFIC_THRESHOLD_BPS ? cDownload : 0,
              uploadBps: cUpload >= TRAFFIC_THRESHOLD_BPS ? cUpload : 0,
            },
            rich: true,
            busY: 585,
          },
        });
      });
    }
  });

  return {
    nodes: [rootNode, ...apNodes, ...clientNodes],
    edges,
    width: totalWidth,
  };
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
