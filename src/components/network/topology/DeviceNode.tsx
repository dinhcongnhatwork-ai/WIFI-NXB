"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Globe, Router, Network, Wifi, Laptop, Users, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { DeviceIcon } from "../DeviceIcon";
import { isOffline, rate, typeLabel } from "./model";
import type { NodeData } from "./layout";

export const DeviceNode = memo(function DeviceNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const node = data.device;
  const Icon = {wan: Globe, gateway: Router, switch: Network, ap: Wifi, client: Laptop, cluster: Users, branch: Layers, site: Network}[node.type] || Network;
  const offline = isOffline(node.status);
  const known = /online|connected|running|^1$/.test(node.status || "");
  const layoutOnly = node.meta?.layoutOnly;
  const group = node.type === "cluster" || node.type === "branch";
  const iconSize = node.type === "ap" ? 60 : node.type === "client" ? 46 : 40;
  const caption = data.members
    ? `${data.members.length} ${node.type === "branch" ? "AP" : "máy khách"} · ${data.expanded ? "thu gọn" : "mở rộng"}`
    : node.meta?.description || node.ip || node.meta?.model || typeLabel(node.type);
  return (
    <div className={`flex h-full flex-col items-center rounded-xl border px-2 py-2 text-center ${selected ? "border-blue-300 bg-white ring-2 ring-blue-100" : "border-transparent hover:border-slate-200 hover:bg-white"} ${offline ? "opacity-60" : ""}`}
      title={layoutOnly ? node.meta?.description : data.traffic ? `${data.traffic.source} · ${new Date(data.traffic.sampledAt).toLocaleString("vi-VN")}` : "Nguồn chưa cung cấp lưu lượng"}>
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-slate-300" />
      <Handle type="target" id="peer-in" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-slate-300" />
      <div className={`relative flex shrink-0 items-center justify-center ${group || layoutOnly ? "h-12 w-14" : "h-16 w-16 rounded-2xl border border-slate-100 bg-white shadow-sm"}`}>
        <DeviceIcon device={node} size={iconSize} fallback={<Icon size={iconSize - 6} className={layoutOnly ? "text-slate-400" : "text-slate-600"} />} />
        {group ? <span className="absolute -bottom-0.5 -right-1 rounded-full border border-slate-200 bg-white p-0.5 text-slate-500">{data.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
          : !layoutOnly && <span title={offline ? "Ngoại tuyến" : known ? "Đã quan sát" : "Chưa rõ trạng thái"} className={`absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white ${offline ? "bg-red-600" : known ? "bg-green-600" : "bg-slate-400"}`} />}
      </div>
      <div title={node.name} className="mt-1.5 w-full truncate text-xs font-semibold text-slate-900">{node.name}</div>
      <div title={caption} className="mt-0.5 w-full truncate text-[10px] text-slate-500">{caption}</div>
      {!layoutOnly && <div className="mt-1 flex w-full justify-center gap-2 whitespace-nowrap font-mono text-[9px] tabular-nums">
        <span className="text-blue-600">{data.traffic?.perspective === "interface" ? "TX" : "↓"} {data.traffic?.reason === "first-sample" ? "Đang đo…" : rate(data.traffic?.downloadBps)}</span>
        <span className="text-slate-500">{data.traffic?.perspective === "interface" ? "RX" : "↑"} {rate(data.traffic?.uploadBps)}</span>
      </div>}
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-slate-300" />
      <Handle type="source" id="peer-out" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-slate-300" />
    </div>
  );
});
