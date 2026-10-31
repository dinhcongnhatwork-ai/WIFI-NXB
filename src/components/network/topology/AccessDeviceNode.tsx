"use client";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Network,
  Wifi,
  Router,
  Smartphone,
  Laptop,
  Tv,
  Printer,
  Server,
  Layers,
} from "lucide-react";
import { DeviceIcon } from "../DeviceIcon";
import { deviceIcon } from "@/lib/network/device-icons";
import { rate, isOffline } from "./model";
import type { AccessNodeData } from "./ap-model";

function getClientIcon(name: string, hostname?: string) {
  const text = `${name} ${hostname || ""}`.toLowerCase();
  if (text.includes("fold") || text.includes("phone") || text.includes("galaxy") || text.includes("moon")) {
    return Smartphone;
  }
  if (text.includes("desktop") || text.includes("laptop") || text.includes("pc")) {
    return Laptop;
  }
  if (text.includes("box") || text.includes("tv")) {
    return Tv;
  }
  if (text.includes("print") || text.includes("npi")) {
    return Printer;
  }
  return Laptop;
}

export const AccessDeviceNode = memo(function AccessDeviceNode({
  data,
  selected,
}: NodeProps<Node<AccessNodeData>>) {
  const device = data.device;
  const isAp = device.type === "ap";
  const isClient = device.type === "client";
  const isSwitch = device.type === "switch";
  const isGateway = device.type === "gateway";
  const offline = isOffline(device.status);
  const stale =
    !!data.traffic?.sampledAt &&
    (data.clock || Date.now()) - Date.parse(data.traffic.sampledAt) > 30000;

  // Custom client card rendering
  if (isClient) {
    const ClientIcon = getClientIcon(device.name, device.meta?.hostname);
    return (
      <div
        className={`w-full overflow-hidden rounded-xl border bg-gradient-to-b from-white to-slate-50/80 text-slate-800 shadow-sm transition-all duration-200 hover:shadow-md ${
          selected
            ? "border-sky-500 ring-2 ring-sky-200"
            : "border-slate-200/90 hover:border-sky-300"
        } ${offline ? "opacity-60" : ""}`}
      >
        <Handle
          type="target"
          id="peer-in"
          position={Position.Top}
          className="!h-1.5 !w-1.5 !border-0 !bg-sky-400"
        />
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100/70 text-sky-700">
                <ClientIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  title={device.name}
                  className="truncate text-xs font-bold text-slate-900"
                >
                  {device.name}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="truncate font-mono">{device.mac || "—"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`h-2 w-2 rounded-full ${
                  offline ? "bg-rose-500" : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                }`}
              />
              <span className="text-[9px] font-semibold text-slate-500">
                {offline ? "OFF" : "ON"}
              </span>
            </div>
          </div>

          {/* Highlighted IP Badge & Signal */}
          <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-lg bg-sky-50/80 px-2.5 py-1 border border-sky-100/80">
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-sky-900">
              <span className="text-[10px] text-sky-600 font-sans font-medium">IP:</span>
              <span>{device.ip || "Chưa cấp IP"}</span>
            </div>
            {device.meta?.signal != null && (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                {device.meta.signal} dBm
              </span>
            )}
          </div>

          {/* Traffic stats */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-500">
            <span className="truncate">
              AP: <span className="font-medium text-slate-700">{data.accessPointName}</span>
            </span>
            <div className="flex items-center gap-1 font-mono font-semibold">
              <span className="text-sky-600">↓ {rate(data.traffic?.downloadBps)}</span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-600">↑ {rate(data.traffic?.uploadBps)}</span>
            </div>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-1 !w-1 !border-0 !opacity-0"
        />
      </div>
    );
  }

  // Switch distribution node rendering
  if (isSwitch) {
    return (
      <div
        className={`h-full overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg transition-all duration-200 ${
          selected ? "border-amber-400 ring-2 ring-amber-300" : "border-indigo-800/60"
        }`}
      >
        <Handle
          type="target"
          id="peer-in"
          position={Position.Top}
          className="!h-2 !w-2 !border-0 !bg-amber-400"
        />
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Layers size={20} />
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90">
                  Switch Phân phối PoE
                </span>
                <div className="text-sm font-bold text-white">{device.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </div>
          </div>

          {/* IP and Ports badge */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 p-2 border border-white/10 text-xs">
            <div className="flex items-center gap-1 font-mono text-amber-200">
              <span className="text-[10px] text-slate-400 font-sans">IP:</span>
              <span className="font-bold">{device.ip || "192.168.0.x"}</span>
            </div>
            <span className="rounded bg-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-200 border border-indigo-400/30">
              {data.clientCount || 0} APs trực thuộc
            </span>
          </div>

          {/* Traffic stats */}
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-300 font-mono">
            <div>
              <span className="text-slate-400 font-sans">Tải xuống: </span>
              <span className="font-semibold text-sky-400">
                {rate(data.traffic?.downloadBps)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-sans">Tải lên: </span>
              <span className="font-semibold text-emerald-400">
                {rate(data.traffic?.uploadBps)}
              </span>
            </div>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !border-0 !bg-sky-400"
        />
      </div>
    );
  }

  // Gateway (Root Controller) Rendering
  if (isGateway) {
    return (
      <div
        className={`flex h-full flex-col justify-between rounded-2xl border bg-gradient-to-b from-white via-slate-50 to-blue-50/40 text-slate-800 shadow-md transition-all duration-200 ${
          selected
            ? "border-blue-600 ring-2 ring-blue-200"
            : "border-blue-200/90 shadow-blue-500/5 hover:border-blue-400"
        }`}
      >
        <div className="p-3.5 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20">
                <Router size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Controller Trung Tâm
                </div>
                <div className="truncate text-sm font-extrabold text-slate-900">
                  {device.name || "UniFi Network System"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 border border-emerald-200 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
              <span className="text-[10px] font-bold">ONLINE</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 border border-slate-200/80 text-xs shadow-sm">
            <div className="flex items-center gap-1 font-mono font-bold text-blue-900">
              <span className="text-[10px] font-sans font-medium text-slate-500">IP:</span>
              <span>{device.ip || "192.168.1.1"}</span>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/60">
              {data.clientCount || 0} Thiết bị khách
            </span>
          </div>
        </div>

        {/* Traffic measurements - CLEAR AND NEVER CLIPPED */}
        <div className="mx-3.5 mb-3 rounded-xl bg-white p-2.5 border border-slate-200/90 shadow-sm">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Lưu lượng toàn mạng thời gian thực
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-sky-50/80 p-2 border border-sky-100">
              <div className="text-[10px] font-medium text-sky-700">↓ Tải xuống</div>
              <div className="font-mono text-sm font-extrabold text-sky-800">
                {rate(data.traffic?.downloadBps)}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50/80 p-2 border border-emerald-100">
              <div className="text-[10px] font-medium text-emerald-700">↑ Tải lên</div>
              <div className="font-mono text-sm font-extrabold text-emerald-800">
                {rate(data.traffic?.uploadBps)}
              </div>
            </div>
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !border-0 !bg-blue-600"
        />
      </div>
    );
  }

  // AP Node rendering
  return (
    <div
      className={`flex h-full flex-col justify-between rounded-xl border bg-white text-slate-700 shadow-sm transition-all duration-200 hover:shadow-md ${
        selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"
      } ${offline ? "opacity-60" : ""}`}
    >
      <Handle
        type="target"
        id="peer-in"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border-0 !bg-sky-400"
      />
      <div className="p-3 pb-0">
        <div className="flex gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-inner">
            <DeviceIcon
              device={device}
              size={42}
              fallback={<Wifi size={24} className="text-blue-600" />}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <span>Điểm truy cập</span>
              <div className="flex items-center gap-1">
                <span
                  title={offline ? "Ngoại tuyến" : "Đã quan sát"}
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    offline ? "bg-red-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  }`}
                />
                <span className="text-[9px] font-semibold">{offline ? "OFFLINE" : "ONLINE"}</span>
              </div>
            </div>
            <div
              title={device.name}
              className="mt-0.5 line-clamp-1 text-sm font-bold leading-5 text-slate-900"
            >
              {device.name}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {device.mac || "—"}
            </div>
          </div>
        </div>

        {/* Prominent IP Badge & Model */}
        <div className="mt-2 flex items-center justify-between gap-1.5 rounded-lg bg-slate-50 px-2 py-1 border border-slate-100 text-xs">
          <div className="flex items-center gap-1 font-mono font-bold text-blue-900">
            <span className="text-[10px] font-sans font-medium text-slate-500">IP:</span>
            <span>{device.ip || "192.168.0.x"}</span>
          </div>
          <div className="text-[10px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            {data.clientCount || 0} máy khách
          </div>
        </div>

        {/* Bottom controls / AP view */}
        <div className="pt-1.5 text-[10px] text-slate-500 flex items-center justify-between">
          <span className="truncate text-slate-400">
            {device.meta?.model || "U7LR"}
          </span>
          {data.onSelectAp && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onSelectAp?.(device.id);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
            >
              Soi AP này →
            </button>
          )}
        </div>
      </div>

      {/* Traffic measurements - CLEAR AND NEVER CLIPPED */}
      <div className="relative mx-3 mb-2.5 rounded-lg bg-slate-50/80 px-2.5 py-1 text-[10px] border border-slate-100">
        {stale && (
          <span className="absolute right-1 top-0.5 rounded bg-amber-50 px-1 text-[9px] text-amber-700">
            Mẫu cũ
          </span>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-slate-400 text-[9px]">↓ Tải xuống</div>
            <div className="font-mono text-xs font-bold text-sky-600 truncate">
              {data.traffic?.reason === "first-sample"
                ? "Đang đo…"
                : rate(data.traffic?.downloadBps)}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[9px]">↑ Tải lên</div>
            <div className="font-mono text-xs font-bold text-emerald-600 truncate">
              {rate(data.traffic?.uploadBps)}
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border-0 !bg-sky-400"
      />
    </div>
  );
});
