"use client";
import { memo, useEffect } from "react";
import { useParticleRegistry } from "./TrafficParticles";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { AccessTrafficEdge } from "./AccessTrafficEdge";
import { rate, type Link, type Traffic, TRAFFIC_THRESHOLD_BPS } from "./model";
const NetworkTrafficEdge = memo(function NetworkTrafficEdge(props: EdgeProps) {
  const data = props.data as {
    link: Link;
    traffic?: Traffic;
    animate?: boolean;
    offline?: boolean;
    clock: number;
  };
  const { link, traffic } = data;
  const organization = link.type === "organization";
  const [path, x, y] = getSmoothStepPath({ ...props, borderRadius: 12, offset: 28 });
  const unknown = traffic?.downloadBps == null || traffic?.uploadBps == null;
  const stale =
    !traffic?.sampledAt || data.clock - Date.parse(traffic.sampledAt) > 30000;
  const registry = useParticleRegistry();
  const hasRealTraffic =
    (traffic?.downloadBps || 0) >= TRAFFIC_THRESHOLD_BPS ||
    (traffic?.uploadBps || 0) >= TRAFFIC_THRESHOLD_BPS;
  const animate =
    !organization &&
    !!data.animate &&
    traffic?.perspective !== "interface" &&
    !stale &&
    !data.offline &&
    hasRealTraffic;
  useEffect(() => {
    if (!registry || !animate) return;
    return registry.register({
      id: props.id,
      path,
      downloadBps: traffic?.downloadBps,
      uploadBps: traffic?.uploadBps,
    });
  }, [
    registry,
    animate,
    props.id,
    path,
    traffic?.downloadBps,
    traffic?.uploadBps,
  ]);
  const utilization =
    link.speedMbps && traffic && !unknown
      ? Math.max(traffic.downloadBps!, traffic.uploadBps!) /
        (link.speedMbps * 1e6)
      : null;
  const width =
    utilization == null ? 1.5 : Math.max(1, Math.min(4, 1 + utilization * 3));
  const label = [
    link.sourcePort && `Port ${link.sourcePort}`,
    link.speedMbps && `${link.speedMbps} Mbps`,
    link.poeWatts != null && `PoE ${link.poeWatts} W`,
    link.radio,
    link.channel && `ch ${link.channel}`,
    link.signal != null && `${link.signal} dBm`,
  ]
    .filter(Boolean)
    .join(" · ");
  const title = `${traffic?.perspective === "interface" ? "TX" : "↓"} ${rate(traffic?.downloadBps)} · ${traffic?.perspective === "interface" ? "RX" : "↑"} ${rate(traffic?.uploadBps)}${link.speedMbps ? ` · ${link.speedMbps} Mbps` : ""}${utilization != null ? ` · ${(utilization * 100).toFixed(1)}% sử dụng` : ""}\n${traffic ? `${traffic.source} · ${new Date(traffic.sampledAt).toLocaleString("vi-VN")}${stale ? " · Dữ liệu cũ" : ""}` : "Nguồn không cung cấp lưu lượng"}`;
  return (
    <g>
      <title>{organization ? "Nhóm hiển thị trong sơ đồ; không phải liên kết vật lý do controller báo cáo" : title}</title>
      <BaseEdge
        id={props.id}
        path={path}
        interactionWidth={22}
        style={{
          stroke: props.selected ? "#2563eb" : organization ? "#cbd5e1" : "#94a3b8",
          strokeWidth: width,
          strokeDasharray:
            organization ? "2 6" : unknown || data.offline
              ? "5 5"
              : link.layer === "logical"
                ? "2 5"
                : link.type === "wireless"
                  ? "6 4"
                  : undefined,
        }}
      />
      {(!data.animate || traffic?.perspective === "interface") && !unknown && (
        <EdgeLabelRenderer>
          <span
            className="pointer-events-none absolute rounded bg-white px-1 font-mono text-[9px]"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y - 17}px)`,
            }}
          >
            <span className="text-blue-600">
              {traffic?.perspective === "interface" ? "TX" : "↓"}{" "}
              {rate(traffic?.downloadBps)}
            </span>{" "}
            <span className="text-slate-500">
              {traffic?.perspective === "interface" ? "RX" : "↑"}{" "}
              {rate(traffic?.uploadBps)}
            </span>
          </span>
        </EdgeLabelRenderer>
      )}
      {label && (
        <EdgeLabelRenderer>
          <span
            className="pointer-events-none absolute rounded border border-slate-100 bg-white/95 px-1.5 py-0.5 text-[10px] text-slate-500"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
            }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

export const TrafficEdge = memo(function TrafficEdge(props: EdgeProps) {
  return props.data?.rich ? <AccessTrafficEdge {...props} /> : <NetworkTrafficEdge {...props} />;
});
