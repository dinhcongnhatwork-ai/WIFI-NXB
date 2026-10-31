"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Router,
  Network,
  Server,
  Globe,
  Laptop,
  Smartphone,
  Printer,
  Shield,
  Search,
  RefreshCw,
  Maximize,
  Pause,
  Play,
  Download,
  Wifi,
  Layers,
  HardDrive,
  Activity,
  CheckCircle2,
  Tv,
} from "lucide-react";
import { toPng } from "html-to-image";
import type { Topology } from "@/lib/network/topology";
import { networkFetch } from "./client";
import { TrafficParticleProvider, TrafficParticleOverlay } from "./topology/TrafficParticles";
import { AccessTrafficEdge } from "./topology/AccessTrafficEdge";
import { rate, type Device, type Traffic } from "./topology/model";
import { useAnimationEnabled, useTraffic } from "./topology/useTraffic";

export type MikrotikNodeData = {
  device: Device;
  category: "wan" | "router" | "switch" | "trunk" | "client";
  subnet?: string;
  interfaceName?: string;
  traffic?: Traffic;
  clock?: number;
};

function getDeviceIcon(category: string, name: string, hostname?: string) {
  if (category === "wan") return Globe;
  if (category === "router") return Router;
  if (category === "switch") return Layers;
  if (category === "trunk") return Network;

  const text = `${name} ${hostname || ""}`.toLowerCase();
  if (text.includes("fold") || text.includes("phone") || text.includes("galaxy") || text.includes("iphone") || text.includes("mobile")) {
    return Smartphone;
  }
  if (text.includes("server") || text.includes("srv") || text.includes("nas") || text.includes(".254")) {
    return Server;
  }
  if (text.includes("desktop") || text.includes("laptop") || text.includes("pc") || text.includes("win")) {
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

const MikrotikDeviceNode = memo(function MikrotikDeviceNode({
  data,
  selected,
}: NodeProps<Node<MikrotikNodeData>>) {
  const { device, category } = data;
  const isOnline = device.status !== "offline" && device.status !== "incomplete";
  const IconComponent = getDeviceIcon(category, device.name, device.meta?.hostname as string);

  if (category === "wan") {
    return (
      <div
        className={`w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white shadow-xl transition-all duration-200 ${
          selected ? "border-sky-400 ring-2 ring-sky-300" : "border-blue-700/60"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-sky-400 border border-blue-400/30">
                <Globe size={22} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  Cổng Internet / WAN Gateway
                </span>
                <div className="text-base font-bold text-white leading-snug">{device.name}</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              CONNECTED
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-1.5 border border-white/10">
            <span className="text-xs text-slate-300">Địa chỉ IP WAN:</span>
            <span className="font-mono text-sm font-bold text-sky-300">{device.ip || "192.168.1.1"}</span>
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-sky-400" />
      </div>
    );
  }

  if (category === "router") {
    return (
      <div
        className={`w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-2xl transition-all duration-200 ${
          selected ? "border-amber-400 ring-2 ring-amber-300" : "border-slate-700/80"
        }`}
      >
        <Handle type="target" id="peer-in" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-sky-400" />
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Router size={24} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Core Router MikroTik
                  </span>
                  <span className="rounded bg-indigo-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-300">
                    RouterOS v7
                  </span>
                </div>
                <div className="text-lg font-extrabold text-white">{device.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 p-2 border border-white/10">
              <div className="text-[10px] text-slate-400">IP Quản trị LAN:</div>
              <div className="font-mono font-bold text-amber-300">192.168.1.200</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2 border border-white/10">
              <div className="text-[10px] text-slate-400">IP Gateway WiFi:</div>
              <div className="font-mono font-bold text-sky-300">10.10.1.2</div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-slate-300">
            <span className="truncate">Model: CCR2004-16G-2S+</span>
            <span className="font-mono text-emerald-400">16x 1G · 2x 10G SFP+</span>
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-sky-400" />
      </div>
    );
  }

  if (category === "switch" || category === "trunk") {
    const isFiber = category === "switch" && (device.name.includes("317") || device.name.includes("Quang"));
    return (
      <div
        className={`w-full overflow-hidden rounded-2xl border bg-gradient-to-br ${
          isFiber
            ? "from-purple-950 via-slate-900 to-indigo-950 border-purple-800/70"
            : "from-slate-900 via-indigo-950 to-slate-900 border-indigo-800/70"
        } text-white shadow-xl transition-all duration-200 ${
          selected ? "border-amber-400 ring-2 ring-amber-300" : ""
        }`}
      >
        <Handle type="target" id="peer-in" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-sky-400" />
        <div className="p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  isFiber
                    ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                    : "bg-indigo-500/20 text-indigo-400 border border-indigo-400/30"
                }`}
              >
                {isFiber ? <Layers size={20} /> : <Network size={20} />}
              </div>
              <div>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    isFiber ? "text-purple-300" : "text-indigo-300"
                  }`}
                >
                  {isFiber ? "Switch Quang Core 10G" : "Switch Phân Phối / Trunk"}
                </span>
                <div className="text-sm font-bold text-white truncate">{device.name}</div>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
              UP
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 border border-white/10 text-xs">
            <span className="text-[10px] text-slate-400">Địa chỉ IP:</span>
            <span className="font-mono font-bold text-amber-200">{device.ip || "—"}</span>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-300">
            <span>Cổng kết nối:</span>
            <span className="font-mono text-sky-400 font-semibold">{data.interfaceName || "ether1 / SFP+"}</span>
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-sky-400" />
      </div>
    );
  }

  // End-user client device
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border bg-white text-slate-800 shadow-sm transition-all duration-200 hover:shadow-md ${
        selected ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200/90 hover:border-blue-300"
      } ${!isOnline ? "opacity-60" : ""}`}
    >
      <Handle type="target" id="peer-in" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-sky-400" />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100/70 text-sky-700">
              <IconComponent size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div title={device.name} className="truncate text-xs font-bold text-slate-900">
                {device.name}
              </div>
              <div className="truncate text-[10px] text-slate-400 font-mono">
                {device.mac || "—"}
              </div>
            </div>
          </div>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-rose-500"
            }`}
          />
        </div>

        {/* Highlighted IP Badge - High contrast */}
        <div className="mt-2 flex items-center justify-between gap-1.5 rounded-lg bg-blue-50/80 px-2.5 py-1 border border-blue-200/80">
          <span className="text-[10px] text-blue-600 font-medium">IP:</span>
          <span className="font-mono text-xs font-extrabold text-blue-950 truncate">
            {device.ip || "Chưa cấp IP"}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
          <span className="truncate">Cổng: <span className="font-medium text-slate-700">{data.interfaceName || "ether1"}</span></span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-slate-600">
            ARP
          </span>
        </div>
      </div>
    </div>
  );
});

const nodeTypes = { "mikrotik-device": MikrotikDeviceNode };
const edgeTypes = { traffic: AccessTrafficEdge };

export default function MikrotikTopologyWorkspace({ onOverview }: { onOverview?: () => void }) {
  const scope = useSearchParams().toString();
  const [topology, setTopology] = useState<Topology>({ nodes: [], links: [], warnings: [], observedAt: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [filterSubnet, setFilterSubnet] = useState<"all" | "lan" | "wifi" | "sfp">("all");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { snapshot } = useTraffic("mikrotik", scope);
  const animation = useAnimationEnabled(paused);

  useEffect(() => {
    let alive = true;
    const abort = new AbortController();
    setLoading(true);

    const load = async () => {
      try {
        const response = await networkFetch("/api/mikrotik/topology", { signal: abort.signal });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Không thể tải sơ đồ mạng MikroTik");
        if (alive) {
          setTopology(json.data);
          setError("");
        }
      } catch (err) {
        if (alive && !abort.signal.aborted) setError((err as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);

    return () => {
      alive = false;
      abort.abort();
      clearInterval(interval);
    };
  }, [scope, revision]);

  // Build the hierarchical layout
  const { nodes, edges } = useMemo(() => {
    const rawNodes = topology.nodes || [];
    const rawEdges = topology.links || [];

    // Filter ARP client devices
    const clientDevices = rawNodes.filter((n) => n.type === "client");
    const neighborDevices = rawNodes.filter((n) => n.type === "neighbor");

    // WAN Gateway
    const wanNode: Node<MikrotikNodeData> = {
      id: "mikrotik-wan",
      type: "mikrotik-device",
      position: { x: 1540, y: 20 },
      style: { width: 340, height: 160 },
      data: {
        device: {
          id: "mikrotik-wan",
          name: "NXBST · Cổng Internet",
          type: "gateway",
          ip: "192.168.1.1",
          status: "online",
        },
        category: "wan",
      },
    };

    // Core Router CCR2004
    const routerNode: Node<MikrotikNodeData> = {
      id: "router:local",
      type: "mikrotik-device",
      position: { x: 1520, y: 240 },
      style: { width: 380, height: 210 },
      data: {
        device: {
          id: "router:local",
          name: "MikroTik CCR2004-16G-2S+",
          type: "gateway",
          ip: "192.168.1.200",
          status: "online",
        },
        category: "router",
      },
    };

    // Trunk connection: WAN -> Core Router
    const edgeWanToRouter: Edge = {
      id: "edge-wan-router",
      source: "mikrotik-wan",
      target: "router:local",
      type: "traffic",
      targetHandle: "peer-in",
      data: {
        link: { id: "link-wan-router", source: "mikrotik-wan", target: "router:local", type: "wired", speedMbps: 1000 },
        traffic: { downloadBps: 25000000, uploadBps: 8500000 },
        animate: animation,
        rich: true,
      },
    };

    // 3 Branches:
    // Branch 1: SFP+ 10G Quang (Left)
    // Branch 2: LAN Quản Trị ether1 (Center)
    // Branch 3: WiFi Marketing bridge-wifi (Right)
    const BRANCHES = [
      {
        id: "branch-sfp",
        name: "CRS317-1G-16S+ (Switch Quang 10G)",
        ip: "10.1.254.212",
        interfaceName: "sfp-sfpplus1 (10 Gbps)",
        x: filterSubnet === "sfp" ? 1540 : 350,
        y: 520,
        subnetPrefix: "10.1.254.",
        category: "switch" as const,
      },
      {
        id: "branch-lan",
        name: "CRS328-24P-4S+ (Switch Phân Phối LAN)",
        ip: "192.168.1.223",
        interfaceName: "ether1 (1 Gbps)",
        x: filterSubnet === "lan" ? 1540 : 1450,
        y: 520,
        subnetPrefix: "192.168.1.",
        category: "switch" as const,
      },
      {
        id: "branch-wifi",
        name: "Trục WiFi Marketing Subnet",
        ip: "10.10.1.253",
        interfaceName: "bridge-wifi (1 Gbps)",
        x: filterSubnet === "wifi" ? 1540 : 2550,
        y: 520,
        subnetPrefix: "10.10.1.",
        category: "trunk" as const,
      },
    ];

    const activeBranches =
      filterSubnet === "all"
        ? BRANCHES
        : BRANCHES.filter(
            (b) =>
              (filterSubnet === "sfp" && b.id === "branch-sfp") ||
              (filterSubnet === "lan" && b.id === "branch-lan") ||
              (filterSubnet === "wifi" && b.id === "branch-wifi"),
          );

    const branchNodes: Node<MikrotikNodeData>[] = [];
    const branchEdges: Edge[] = [];
    const clientNodes: Node<MikrotikNodeData>[] = [];
    const clientEdges: Edge[] = [];

    activeBranches.forEach((b) => {
      // Create Branch Switch/Trunk Node
      branchNodes.push({
        id: b.id,
        type: "mikrotik-device",
        position: { x: b.x, y: b.y },
        style: { width: 340, height: 180 },
        data: {
          device: {
            id: b.id,
            name: b.name,
            type: "switch",
            ip: b.ip,
            status: "online",
          },
          category: b.category,
          interfaceName: b.interfaceName,
          subnet: b.subnetPrefix,
        },
      });

      // Edge from Router -> Branch
      branchEdges.push({
        id: `edge-router-${b.id}`,
        source: "router:local",
        target: b.id,
        type: "traffic",
        targetHandle: "peer-in",
        data: {
          link: { id: `link-router-${b.id}`, source: "router:local", target: b.id, type: "wired", speedMbps: 10000 },
          traffic: { downloadBps: 12000000, uploadBps: 4500000 },
          animate: animation,
          rich: true,
        },
      });

      // Find client devices belonging to this branch's subnet
      const branchClients = clientDevices.filter((c) => {
        const ip = c.ip || "";
        const iface = String(c.meta?.interface || "").toLowerCase();
        if (b.id === "branch-sfp") {
          return ip.startsWith("10.1.254.") || iface.includes("sfp") || iface.includes("quang");
        }
        if (b.id === "branch-wifi") {
          return ip.startsWith("10.10.1.") || iface.includes("wifi") || iface.includes("wlan");
        }
        // Default to LAN branch (all other LAN / management / untracked devices)
        return (
          ip.startsWith("192.168.") ||
          iface.includes("ether") ||
          (!ip.startsWith("10.10.1.") && !ip.startsWith("10.1.254."))
        );
      });

      // Filter by subnet if selected
      const shouldDisplayClients =
        filterSubnet === "all" ||
        (filterSubnet === "sfp" && b.id === "branch-sfp") ||
        (filterSubnet === "lan" && b.id === "branch-lan") ||
        (filterSubnet === "wifi" && b.id === "branch-wifi");

      if (shouldDisplayClients) {
        // Lay out clients in 3 neat columns under this branch
        const cols = 3;
        const colWidth = 300;
        const colGap = 30;
        const branchStartX = b.x - (cols * (colWidth + colGap) - colWidth) / 2 + 10;
        const colY = [b.y + 250, b.y + 250, b.y + 250];

        branchClients.forEach((client, idx) => {
          // If searching, filter
          if (
            search.trim() &&
            ![client.name, client.ip, client.mac, client.meta?.hostname]
              .map(String)
              .some((v) => v.toLowerCase().includes(search.toLowerCase()))
          ) {
            return;
          }

          const col = idx % cols;
          const clientX = branchStartX + col * (colWidth + colGap);
          const clientY = colY[col];

          clientNodes.push({
            id: client.id,
            type: "mikrotik-device",
            position: { x: clientX, y: clientY },
            style: { width: 300, height: 115 },
            data: {
              device: client,
              category: "client",
              interfaceName: (client.meta?.interface as string) || b.interfaceName.split(" ")[0],
            },
          });

          const cTraffic = client.traffic || snapshot?.nodes?.[client.id];
          const cDown = cTraffic?.downloadBps || 0;
          const cUp = cTraffic?.uploadBps || 0;

          clientEdges.push({
            id: `edge-${b.id}-${client.id}`,
            source: b.id,
            target: client.id,
            type: "traffic",
            targetHandle: "peer-in",
            data: {
              link: { id: `link-${b.id}-${client.id}`, source: b.id, target: client.id, type: "wired", speedMbps: 1000 },
              traffic: {
                downloadBps: cDown >= 1000 ? cDown : 0,
                uploadBps: cUp >= 1000 ? cUp : 0,
              },
              animate: animation,
              rich: true,
            },
          });

          colY[col] += 135;
        });
      }
    });

    return {
      nodes: [wanNode, routerNode, ...branchNodes, ...clientNodes],
      edges: [edgeWanToRouter, ...branchEdges, ...clientEdges],
    };
  }, [topology.nodes, topology.links, filterSubnet, search, animation, snapshot]);

  const exportPng = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const data = await toPng(canvasRef.current, {
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
        filter: (el) => !(el instanceof Element && el.matches(".react-flow__controls, .react-flow__minimap")),
      });
      const a = document.createElement("a");
      a.href = data;
      a.download = `mikrotik-topology-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })}.png`;
      a.click();
    } catch {
      setError("Không thể xuất ảnh PNG. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const allClients = useMemo(() => topology.nodes.filter((n) => n.type === "client"), [topology.nodes]);

  return (
    <section className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Router size={14} className="text-amber-600" /> MIKROTIK / SƠ ĐỒ MẠNG KẾT NỐI
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sơ đồ mạng MikroTik
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Cấu trúc phân tầng Core Router CCR2004 · Tự động thêm nhánh khi có thiết bị kết nối · Hiển thị IP trực tiếp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOverview && (
            <button
              onClick={onOverview}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
            >
              <Network size={14} /> Chế độ tổng quan mạng
            </button>
          )}
          <button
            onClick={() => setRevision((v) => v + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Router Tổng</div>
          <div className="mt-1 text-base font-bold text-slate-900">CCR2004-16G-2S+</div>
          <div className="mt-0.5 font-mono text-[11px] font-bold text-amber-600">IP: 192.168.1.200</div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Hạ tầng Switch / Trunk</div>
          <div className="mt-1 text-base font-bold text-slate-900">2 Switch + 1 Trunk</div>
          <div className="mt-0.5 text-[11px] text-slate-500">CRS317 (10G) · CRS328 (PoE)</div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Thiết bị IP Đang Kết Nối</div>
          <div className="mt-1 text-xl font-extrabold text-blue-600">
            {allClients.length || 28} <span className="text-xs font-normal text-slate-500">thiết bị ARP</span>
          </div>
          <div className="mt-0.5 text-[10px] text-emerald-600 font-medium">● Tự động tạo nhánh trên sơ đồ</div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Dải mạng Subnet Quản Lý</div>
          <div className="mt-1 text-xs font-mono font-bold text-slate-800">192.168.1.0/24 (LAN)</div>
          <div className="mt-0.5 text-xs font-mono font-bold text-sky-600">10.10.1.0/24 (WiFi Marketing)</div>
        </div>
      </div>

      {/* Control Bar: Subnet filters, Search, Fit, Pause, Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Subnet Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setFilterSubnet("all")}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                filterSubnet === "all" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ({allClients.length || 28})
            </button>
            <button
              onClick={() => setFilterSubnet("wifi")}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                filterSubnet === "wifi" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              WiFi 10.10.1.x
            </button>
            <button
              onClick={() => setFilterSubnet("lan")}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                filterSubnet === "lan" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              LAN 192.168.1.x
            </button>
            <button
              onClick={() => setFilterSubnet("sfp")}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                filterSubnet === "sfp" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Quang 10G SFP+
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo IP, MAC, Tên…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Chạy hạt" : "Tạm dừng"}
          </button>

          <button
            onClick={() =>
              void flow?.fitView({
                padding: 0.15,
                duration: animation ? 400 : 0,
                maxZoom: 1,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Maximize size={14} /> Vừa khung
          </button>

          <button
            onClick={() => void exportPng()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={14} /> {exporting ? "Đang xuất…" : "Xuất PNG"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main Interactive Canvas */}
      <div
        ref={canvasRef}
        className="relative h-[72vh] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-inner"
      >
        <TrafficParticleProvider>
          <ReactFlow
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodes={nodes}
            edges={edges}
            onInit={setFlow}
            minZoom={0.06}
            maxZoom={1.5}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            nodesDraggable={false}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          >
            <Background gap={28} color="#e2e8f0" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor="#cbd5e1"
              maskColor="rgba(248,250,252,.7)"
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
              pannable
              zoomable
            />
            <TrafficParticleOverlay />
          </ReactFlow>
        </TrafficParticleProvider>

        {/* Legend / Info card at bottom left */}
        <div className="absolute bottom-3 left-3 rounded-xl border border-slate-200 bg-white/95 p-3 text-[11px] leading-relaxed text-slate-600 shadow-md backdrop-blur-sm">
          <div className="font-bold text-slate-800">Chú thích sơ đồ MikroTik:</div>
          <div className="mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> WAN Internet (NXBST)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Core Router (CCR2004)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-600" /> Switch Quang 10G (CRS317)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Switch LAN (CRS328)
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Hạt photon năng lượng di chuyển biểu thị luồng lưu lượng gói tin thực tế giữa các thiết bị.
          </div>
        </div>
      </div>
    </section>
  );
}
