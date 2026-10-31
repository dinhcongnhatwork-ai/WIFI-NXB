"use client";
import { memo, useEffect, useId, useMemo } from "react";
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { useParticleRegistry } from "./TrafficParticles";
import { rate, type Traffic, type Link, TRAFFIC_THRESHOLD_BPS } from "./model";

export const AccessTrafficEdge = memo(function AccessTrafficEdge(
  props: EdgeProps,
) {
  const data = props.data as {
    link: Link;
    traffic?: Traffic;
    clock: number;
    animate?: boolean;
    offline?: boolean;
    edgeIndex?: number;
  };
  const { traffic } = data;
  const registry = useParticleRegistry();
  const markerId = useId().replace(/:/g, "");

  // Calculate clean orthogonal trunk-and-branch / Manhattan path
  const { path, midX, midY } = useMemo(() => {
    const sx = props.sourceX;
    const sy = props.sourceY;
    const tx = props.targetX;
    const ty = props.targetY;
    const dx = tx - sx;
    const dy = ty - sy;

    // Pure straight vertical line if sourceX and targetX are virtually identical (e.g. single client right under AP)
    if (Math.abs(dx) < 2) {
      return {
        path: `M ${sx} ${sy} L ${tx} ${ty}`,
        midX: sx,
        midY: (sy + ty) / 2,
      };
    }

    // Bus level (horizontal trunk line Y coordinate)
    const busY = (data as { busY?: number }).busY != null ? (data as { busY?: number }).busY! : sy + dy * 0.45;
    const dir = dx > 0 ? 1 : -1;
    const r = Math.min(12, Math.abs(dx) / 2, Math.abs(busY - sy) / 2, Math.abs(ty - busY) / 2);

    let orthogonalPath: string;
    if (r > 1) {
      orthogonalPath = [
        `M ${sx} ${sy}`,
        `L ${sx} ${busY - r}`,
        `Q ${sx} ${busY} ${sx + dir * r} ${busY}`,
        `L ${tx - dir * r} ${busY}`,
        `Q ${tx} ${busY} ${tx} ${busY + r}`,
        `L ${tx} ${ty}`,
      ].join(" ");
    } else {
      orthogonalPath = `M ${sx} ${sy} L ${sx} ${busY} L ${tx} ${busY} L ${tx} ${ty}`;
    }

    // Position speed badge along the vertical drop segment leading directly into target device
    // This guarantees badges never collide with horizontal trunk or each other
    const mx = tx;
    const my = (busY + ty) / 2;

    return { path: orthogonalPath, midX: mx, midY: my };
  }, [props.sourceX, props.sourceY, props.targetX, props.targetY, (data as { busY?: number }).busY]);

  const stale =
    !traffic?.sampledAt || data.clock - Date.parse(traffic.sampledAt) > 30000;
  const unknown = traffic?.downloadBps == null || traffic?.uploadBps == null;

  const hasTraffic =
    (traffic?.downloadBps || 0) >= TRAFFIC_THRESHOLD_BPS ||
    (traffic?.uploadBps || 0) >= TRAFFIC_THRESHOLD_BPS;
  const isOffline = data.offline || unknown;

  useEffect(() => {
    if (!registry || !data.animate || stale || data.offline || !hasTraffic) return;
    return registry.register({
      id: props.id,
      path,
      downloadPath: path,
      uploadPath: path,
      downloadBps: traffic?.downloadBps,
      uploadBps: traffic?.uploadBps,
    });
  }, [
    registry,
    data.animate,
    data.offline,
    hasTraffic,
    stale,
    props.id,
    path,
    traffic?.downloadBps,
    traffic?.uploadBps,
  ]);

  return (
    <g className="transition-all duration-300">
      <title>{`AP → Thiết bị (tải xuống): ${rate(traffic?.downloadBps)}; Thiết bị → AP (tải lên): ${rate(traffic?.uploadBps)}${stale ? " · Dữ liệu cũ" : ""}`}</title>
      
      <defs>
        <linearGradient id={`${markerId}-gradient`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={props.selected ? "#2563eb" : "#3b82f6"} stopOpacity="0.9" />
          <stop offset="100%" stopColor={props.selected ? "#1d4ed8" : "#0ea5e9"} stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Invisible wider interaction area */}
      <BaseEdge
        id={props.id}
        path={path}
        interactionWidth={24}
        style={{ stroke: "transparent", strokeWidth: 20 }}
      />

      {/* Outer subtle glow sheath */}
      <path
        d={path}
        fill="none"
        stroke={
          props.selected
            ? "rgba(37, 99, 235, 0.35)"
            : isOffline
              ? "rgba(148, 163, 184, 0.15)"
              : hasTraffic
                ? "rgba(59, 130, 246, 0.22)"
                : "rgba(148, 163, 184, 0.18)"
        }
        strokeWidth={props.selected ? 6 : 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Core fiber optic connection cable */}
      <path
        d={path}
        fill="none"
        stroke={
          props.selected
            ? "#2563eb"
            : isOffline
              ? "#94a3b8"
              : `url(#${markerId}-gradient)`
        }
        strokeWidth={props.selected ? 2.5 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={isOffline ? "4 4" : undefined}
      />

      {/* Micro-badging for throughput on edge */}
      {hasTraffic && !isOffline && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-0.5 font-mono text-[10px] shadow-sm backdrop-blur-sm transition-all"
            style={{
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              zIndex: props.selected ? 20 : 5,
            }}
          >
            <span className="flex items-center gap-0.5 font-semibold text-blue-600">
              <span className="text-[9px]">↓</span>{rate(traffic?.downloadBps)}
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
              <span className="text-[9px]">↑</span>{rate(traffic?.uploadBps)}
            </span>
            {stale && (
              <span className="ml-0.5 rounded bg-amber-100 px-1 text-[8px] font-sans font-medium text-amber-700">
                cũ
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

