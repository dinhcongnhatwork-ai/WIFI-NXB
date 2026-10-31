"use client";
import { memo, useEffect, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import { useParticleRegistry } from "./TrafficParticles";
import { rate, type Link, type Traffic } from "./model";
import { networkTrafficPaths, type TrafficRoutePoint } from "./network-traffic-paths";
import { networkTrafficState } from "./network-traffic-state";

export const NetworkTrafficEdge = memo(function NetworkTrafficEdge(
  props: EdgeProps,
) {
  const data = props.data as {
    link: Link;
    traffic?: Traffic;
    clock: number;
    animate?: boolean;
    offline?: boolean;
    highlighted?: boolean;
    routePoints?: TrafficRoutePoint[];
  };
  const [hovered, setHovered] = useState(false);
  const registry = useParticleRegistry();
  const { link } = data;
  const organization = link.type === "organization";
  const logical = organization || link.layer === "logical";
  const { path, downloadPath: downPath, uploadPath: upPath, x, y } =
    networkTrafficPaths({ ...props, routePoints: data.routePoints });
  const { direction, old, active, measured, reverse } = networkTrafficState(data);
  useEffect(() => {
    if (!registry || !active) return;
    return registry.register({
      id: props.id,
      reverse,
      path,
      downloadPath: downPath,
      uploadPath: upPath,
      downloadBps: direction.receive,
      uploadBps: direction.send,
    });
  }, [
    registry,
    active,
    props.id,
    path,
    downPath,
    upPath,
    direction.receive,
    direction.send,
    reverse,
  ]);
  const highlighted = props.selected || data.highlighted || hovered;
  const title = organization
    ? "Nhóm hiển thị · không phải cáp vật lý"
    : `${direction.receiveLabel}: ${rate(direction.receive)}; ${direction.sendLabel}: ${rate(direction.send)}${old ? " · Chưa có mẫu mới" : ""}`;
  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <title>{title}</title>
      <BaseEdge
        id={props.id}
        path={path}
        interactionWidth={24}
        style={{ stroke: organization ? "#94a3b8" : data.offline ? "#94a3b8" : "#64748b", strokeWidth: 1.4, opacity: 0.85, strokeDasharray: logical ? "5 5" : undefined, vectorEffect: "non-scaling-stroke" }}
      />
      {measured ? (
        <>
          <path
            d={path}
            fill="none"
            stroke={highlighted ? "#bfdbfe" : "#e2e8f0"}
            strokeWidth={highlighted ? 6 : 4}
            opacity={0.45}
          />
          <path
            d={downPath}
            className="network-edge-line"
            fill="none"
            stroke="#2563eb"
            strokeWidth={highlighted ? 2.4 : 1.75}
            opacity={highlighted ? 1 : 0.72}
            strokeDasharray={logical ? "5 5" : undefined}
          />
          <path
            d={upPath}
            className="network-edge-line"
            fill="none"
            stroke="#10b981"
            strokeWidth={highlighted ? 2.4 : 1.75}
            opacity={highlighted ? 1 : 0.72}
            strokeDasharray={logical ? "5 5" : undefined}
          />
          <circle
            cx={props.sourceX}
            cy={props.sourceY}
            r={3.2}
            fill="#2563eb"
          />
          <circle
            cx={props.targetX}
            cy={props.targetY}
            r={3.2}
            fill="#10b981"
          />
        </>
      ) : (
        <path
          d={path}
          className="network-edge-line"
          fill="none"
          stroke={highlighted ? "#2563eb" : data.offline ? "#94a3b8" : "#64748b"}
          strokeWidth={highlighted ? 2.2 : 1.5}
          opacity={data.offline ? 0.8 : 0.85}
          strokeDasharray={logical || data.offline ? "5 5" : undefined}
        />
      )}
      {highlighted && (
        <EdgeLabelRenderer>
          <div
            className="network-edge-label"
            style={{
              transform: `translate(-50%,-50%) translate(${x}px,${y}px)`,
            }}
          >
            {organization ? (
              <span>Gom nhóm hiển thị</span>
            ) : (
              <>
                {(link.sourcePort || link.targetPort) && (
                  <span className="network-port-label">
                    {link.sourcePort || "Cổng chưa rõ"} →{" "}
                    {link.targetPort || "Thiết bị"}
                  </span>
                )}
                {highlighted && (
                  <>
                    <span className="network-receive">
                      ↓ {direction.receiveLabel} {rate(direction.receive)}
                    </span>
                    <span className="network-send">
                      ↑ {direction.sendLabel} {rate(direction.send)}
                    </span>
                  </>
                )}
                {link.speedMbps != null && highlighted && (
                  <span>{link.speedMbps} Mbps · tốc độ liên kết</span>
                )}
                {old && highlighted && (
                  <span className="text-amber-700">
                    {data.traffic ? "Dữ liệu cũ" : "Chưa có mẫu"}
                  </span>
                )}
              </>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});
