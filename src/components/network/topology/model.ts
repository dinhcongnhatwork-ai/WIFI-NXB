import type { TopologyNode, TopologyEdge } from "@/lib/network/topology";
export type Traffic = import("@/lib/network/traffic").TrafficSample;
export type Device = TopologyNode & { traffic?: Traffic };
export type Link = TopologyEdge & {
  traffic?: Traffic;
  speedMbps?: number;
  poeWatts?: number;
  channel?: number;
  radio?: string;
  signal?: number;
};
export type TrafficSnapshot = {
  nodes: Record<string, Traffic>;
  links: Record<string, Traffic>;
  sampledAt: string;
  source: string;
  warnings?: string[];
};
export type HistoryPoint = {
  at: number;
  download: number | null;
  upload: number | null;
};
export const typeLabel = (type: string) =>
  ({
    wan: "Internet / WAN",
    gateway: "Gateway",
    switch: "Switch",
    ap: "Điểm truy cập",
    client: "Máy khách",
    interface: "Cổng mạng",
    bridge: "Cầu nối",
    neighbor: "Thiết bị lân cận",
    device: "Thiết bị",
    cluster: "Cụm máy khách",
    branch: "Nhóm AP chưa rõ uplink",
    site: "Nhóm hiển thị",
  })[type] || type;
export function rate(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Gbps`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} Mbps`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(value)} bps`;
}
export function bytes(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (value >= 1000 && i < 4) {
    value /= 1000;
    i++;
  }
  return `${value.toFixed(i ? 2 : 0)} ${units[i]}`;
}
export function aggregate(
  samples: (Traffic | undefined)[],
): Traffic | undefined {
  if (
    !samples.length ||
    samples.some((s) => !s || s.perspective === "interface")
  )
    return undefined;
  const rows = samples as Traffic[];
  const sources = new Set(rows.map((s) => s.source));
  if (sources.size !== 1) return undefined;
  const sum = (
    key: "downloadBytes" | "uploadBytes" | "downloadBps" | "uploadBps",
  ) =>
    rows.some((s) => s[key] == null)
      ? null
      : rows.reduce((n, s) => n + (s[key] || 0), 0);
  return {
    downloadBytes: sum("downloadBytes"),
    uploadBytes: sum("uploadBytes"),
    downloadBps: sum("downloadBps"),
    uploadBps: sum("uploadBps"),
    source: rows[0].source,
    sampledAt: rows.map((s) => s.sampledAt).sort()[0],
  };
}
export const isOffline = (status?: string) =>
  /offline|disconnected|disabled|blocked|^0$/.test(status || "");

export const TRAFFIC_THRESHOLD_BPS = 1000;

export function particleCount(bps?: number | null) {
  if (bps == null || bps < TRAFFIC_THRESHOLD_BPS) return 0;
  if (bps < 50000) return 1;    // 1 Kbps - 50 Kbps: 1 gentle pulse
  if (bps < 500000) return 2;   // 50 Kbps - 500 Kbps: 2 pulses
  if (bps < 5000000) return 3;  // 500 Kbps - 5 Mbps: 3 pulses
  return 4;                     // > 5 Mbps: 4 pulses (readable, no clutter)
}

export function particleDuration(bps: number) {
  // Calm, graceful, easily observable velocity (4.0s - 6.5s)
  // Eliminates frantic flashes; higher bandwidth increases particle count, not supersonic speed
  const clamped = Math.max(1000, bps);
  const logBps = Math.log10(clamped);
  return Math.max(4.0, Math.min(6.5, 6.5 - (logBps - 3) * 0.45));
}
