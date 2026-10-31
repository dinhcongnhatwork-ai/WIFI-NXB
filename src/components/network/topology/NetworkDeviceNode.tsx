"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ChevronRight, ChevronDown, Network, Wifi, Layers } from "lucide-react";
import { DeviceIcon } from "../DeviceIcon";
import { isOffline, isOnline, rate, typeLabel } from "./model";
import { trafficDirections, type NetworkNodeData } from "./network-layout";

export const NetworkDeviceNode = memo(function NetworkDeviceNode({
  data,
  selected,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}: NodeProps<Node<NetworkNodeData>>) {
  const { device, traffic } = data;
  const client = device.type === "client";
  const group = !!device.meta?.layoutOnly;
  const offline = isOffline(device.status);
  const known = isOnline(device.status);
  const status = offline
    ? "Ngoại tuyến"
    : known
      ? "Trực tuyến"
      : device.status === "observed"
        ? "Đã ghi nhận"
        : "Chưa rõ trạng thái";
  const stale =
    !!traffic?.sampledAt &&
    (!Number.isFinite(Date.parse(traffic.sampledAt)) ||
      (data.clock || Date.now()) - Date.parse(traffic.sampledAt) > 30000);
  const flow = trafficDirections(traffic);
  const Icon = group ? Layers : device.type === "ap" ? Wifi : Network;
  return (
    <article
      className={`network-device-card ${selected ? "is-selected" : ""} ${group ? "is-group" : ""} ${client ? "is-client" : ""}`}
      aria-label={device.name}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!h-2 !w-2 !border-2 !border-white !bg-slate-300"
      />
      <div className="network-device-heading">
        <div className="network-device-art">
          {group ? (
            <Icon size={38} />
          ) : (
            <DeviceIcon
              device={device}
              size={client ? 36 : 48}
              fallback={<Icon size={36} />}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="network-device-type">
            {group
              ? "Nhóm hiển thị"
              : device.meta?.deviceRole === "core-switch"
                ? "MikroTik · Core switch"
                : device.meta?.deviceRole === "access-switch"
                  ? "MikroTik · Access switch"
                  : device.meta?.provider === "mikrotik" &&
                      device.type === "gateway"
                    ? "MikroTik · Router"
                    : typeLabel(device.type)}
          </p>
          <h3 title={device.name}>{device.name}</h3>
          <p className="network-device-address">
            {group ? "Nhóm hiển thị" : device.ip || "Chưa có IP"}
          </p>
        </div>
      </div>
      <div className="network-device-meta">
        {group ? (
          <span title={String(device.meta?.description || "")}>
            Không phải thiết bị vật lý
          </span>
        ) : (
          <span
            className={`network-status ${offline ? "is-offline" : known ? "is-online" : ""}`}
          >
            <i />
            {status}
          </span>
        )}
        {!group && device.meta?.model && (
          <span className="truncate max-w-28" title={String(device.meta.model)}>
            {String(device.meta.model)}
          </span>
        )}
      </div>
      {!group && device.meta?.managed && (
        <div className="network-port-summary">
          <span>{device.meta.connectedPeerCount ?? "—"} láng giềng</span>
          <span>{device.meta.connectedApPorts ?? "—"} cổng nối AP</span>
        </div>
      )}
      {!group && !device.meta?.managed && (
        <div className="network-device-traffic">
          <div>
            <span>{flow.receiveLabel}</span>
            <strong className="network-receive">↓ {rate(flow.receive)}</strong>
          </div>
          <div>
            <span>{flow.sendLabel}</span>
            <strong className="network-send">↑ {rate(flow.send)}</strong>
          </div>
          {stale && <span className="network-stale">Dữ liệu cũ</span>}
        </div>
      )}
      {data.childCount > 0 && (!device.meta?.managed || device.type === "ap" || group) && (
        <button
          type="button"
          className="network-branch-button nodrag nopan"
          aria-label={`${data.expanded ? "Thu gọn" : "Mở nhánh"} ${device.name}`}
          aria-expanded={data.expanded}
          disabled={!data.onToggle}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle?.(device.id);
          }}
        >
          {data.expanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          <span>
            {data.clientCount || data.childCount}{" "}
            {data.clientCount ? "máy khách" : "thiết bị"}
          </span>
          <span className="ml-auto text-slate-400">
            {data.expanded ? "Thu gọn" : "Mở nhánh"}
          </span>
        </button>
      )}
      <Handle
        type="source"
        position={sourcePosition}
        className="!h-2 !w-2 !border-2 !border-white !bg-blue-500"
      />
    </article>
  );
});
