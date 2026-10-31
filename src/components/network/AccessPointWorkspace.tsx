"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Download,
  Expand,
  Minimize2,
  Maximize,
  Search,
  RefreshCw,
  Pause,
  Play,
  List,
  GitBranch,
  Wifi,
  Info,
  LayoutGrid,
} from "lucide-react";
import { toPng } from "html-to-image";
import type { Topology } from "@/lib/network/topology";
import { networkFetch } from "./client";
import { DeviceIcon } from "./DeviceIcon";
import { SourceStamp } from "@/components/ui/operations";
import { AccessDeviceNode } from "./topology/AccessDeviceNode";
import { AccessViewport } from "./topology/AccessViewport";
import { TrafficEdge } from "./topology/TrafficEdge";
import {
  TrafficParticleProvider,
  TrafficParticleOverlay,
} from "./topology/TrafficParticles";
import { useAnimationEnabled, useTraffic } from "./topology/useTraffic";
import { useFullscreen } from "./topology/useFullscreen";
import { DetailDrawer } from "./topology/DetailDrawer";
import {
  accessPointLayout,
  allAccessPointsLayout,
  clientsOf,
  duration,
  radioLabel,
  latestTraffic,
} from "./topology/ap-model";
import { aggregate, rate, isOffline, type Device } from "./topology/model";
const nodeTypes = { "access-device": AccessDeviceNode },
  edgeTypes = { traffic: TrafficEdge };
const empty: Topology = { nodes: [], links: [], warnings: [], observedAt: "" };
const button =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";
export default function AccessPointWorkspace({
  onOverview,
}: {
  onOverview: () => void;
}) {
  const scope = useSearchParams().toString();
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setClock(Date.now());
    };
    const timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const [topology, setTopology] = useState<Topology>(empty),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [apId, setApId] = useState(""),
    [floorFilter, setFloorFilter] = useState("all"),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [view, setView] = useState<"diagram" | "matrix" | "list">("diagram"),
    [paused, setPaused] = useState(false),
    [exporting, setExporting] = useState(false);
  const workspace = useRef<HTMLElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(workspace);
  const [allSites, setAllSites] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(1000),
    [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const { snapshot, history, error: trafficError } = useTraffic("unifi", scope);
  const animation = useAnimationEnabled(paused);
  useEffect(() => {
    let alive = true,
      pending = false;
    const abort = new AbortController();
    setLoading(true);
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await networkFetch("/api/unifi/topology", {
          signal: abort.signal,
        });
        const json = await response.json();
        if (!response.ok || !json.success)
          throw Error(json.error || "Không thể đọc dữ liệu UniFi");
        if (alive) {
          setTopology(json.data);
          setError("");
        }
      } catch (cause) {
        if (alive && !abort.signal.aborted) setError((cause as Error).message);
      } finally {
        pending = false;
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => {
      alive = false;
      abort.abort();
      clearInterval(timer);
    };
  }, [scope, revision]);
  useEffect(() => {
    setTopology(empty);
    setApId("");
    setSelected(null);
    setSearch("");
  }, [scope]);
  const accessPoints = useMemo(
    () =>
      topology.nodes
        .filter((node) => node.type === "ap")
        .sort(
          (a, b) =>
            clientsOf(topology, b.id).length -
              clientsOf(topology, a.id).length ||
            a.name.localeCompare(b.name, "vi"),
        ),
    [topology],
  );
  const isAll = apId === "all" || (!apId && accessPoints.length > 0);
  const activeAp = isAll
    ? null
    : accessPoints.find((node) => node.id === apId) || accessPoints[0];
  useEffect(() => {
    if (!apId && accessPoints.length > 0) {
      setApId("all");
    } else if (!isAll && activeAp && apId !== activeAp.id) {
      setApId(activeAp.id);
    }
  }, [accessPoints.length, activeAp?.id, apId, isAll]);
  const clients = useMemo(
    () => (activeAp ? clientsOf(topology, activeAp.id) : []),
    [topology, activeAp],
  );
  const rows = useMemo(
    () =>
      clients.map((device) => ({
        ...device,
        traffic: latestTraffic(device.traffic, snapshot?.nodes[device.id]),
      })),
    [clients, snapshot],
  );
  const siteRows = useMemo(
    () =>
      topology.nodes
        .filter((device) => device.type === "client")
        .map((device) => ({
          ...device,
          traffic: latestTraffic(device.traffic, snapshot?.nodes[device.id]),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [topology.nodes, snapshot],
  );
  const inventory = allSites ? siteRows : rows;
  const apForClient = useMemo(
    () =>
      new Map(
        topology.links.flatMap((edge) => {
          const owner = topology.nodes.find(
            (node) => node.id === edge.source && node.type === "ap",
          );
          return owner ? [[edge.target, owner] as const] : [];
        }),
      ),
    [topology],
  );
  const filtered = inventory.filter((device) =>
    [
      device.name,
      device.ip,
      device.mac,
      device.meta?.hostname,
      device.meta?.vendor,
      device.meta?.ssid,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  const totals = useMemo(() => {
    if (isAll) {
      return aggregate(siteRows.map((device) => device.traffic));
    }
    return aggregate(rows.map((device) => device.traffic));
  }, [isAll, siteRows, rows]);

  const columns = Math.max(
    1,
    Math.min(3, Math.floor((canvasWidth - 32) / 360)),
  );
  const layout = useMemo(() => {
    if (isAll) {
      return allAccessPointsLayout(
        topology,
        accessPoints,
        Math.max(2, Math.min(4, Math.floor((canvasWidth - 32) / 360))),
        snapshot?.nodes,
        floorFilter,
      );
    }
    return activeAp
      ? accessPointLayout(
          activeAp,
          rows,
          topology.links,
          columns,
          snapshot?.nodes,
        )
      : null;
  }, [isAll, topology, accessPoints, activeAp, rows, columns, canvasWidth, snapshot?.nodes, floorFilter]);

  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setCanvasWidth(entry.contentRect.width),
    );
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [view, isAll, !!activeAp]);

  const nodes = useMemo(
    () =>
      layout?.nodes.map((node) => ({
        ...node,
        selected: selected === node.id,
        data: {
          ...node.data,
          clock,
          onSelectAp: isAll ? (id: string) => selectAp(id) : undefined,
        },
      })) || [],
    [layout, selected, clock, isAll],
  );
  const edges = useMemo(
    () =>
      layout?.edges.map((edge) => {
        const targetDevice = isAll
          ? (topology.nodes.find((n: Device) => n.id === edge.target) ||
              accessPoints.find((ap: Device) => ap.id === edge.target))
          : rows.find((row: Device) => row.id === edge.target);
        return {
          ...edge,
          selected: selected === edge.target,
          data: {
            ...edge.data,
            clock,
            animate: animation,
            offline: isOffline(targetDevice?.status),
          },
        };
      }) || [],
    [layout, selected, animation, isAll, accessPoints, rows, clock, topology.nodes],
  );
  const inspect = useCallback((id: string) => setSelected(id), []),
    close = useCallback(() => setSelected(null), []);
  const selectedDevice = selected
    ? topology.nodes.find((device) => device.id === selected)
    : undefined;
  const unknown = topology.nodes.filter(
    (node) =>
      node.type === "client" &&
      !topology.links.some(
        (edge) =>
          edge.target === node.id &&
          topology.nodes.some(
            (ap) => ap.type === "ap" && ap.id === edge.source,
          ),
      ),
  );
  const exportPng = async () => {
    if (!canvas.current) return;
    setExporting(true);
    try {
      const image = await toPng(canvas.current, {
        pixelRatio: 2,
        backgroundColor: "#f8fafc",
        filter: (node) =>
          !(
            node instanceof Element &&
            node.matches(".react-flow__controls,.react-flow__attribution")
          ),
      });
      const link = document.createElement("a");
      link.href = image;
      link.download = `unifi-ap-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })}.png`;
      link.click();
    } catch {
      setError("Không thể xuất PNG. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };
  const selectAp = (id: string) => {
    setApId(id);
    setAllSites(false);
    setSelected(null);
    setSearch("");
  };
  return (
    <section
      ref={workspace}
      aria-label="Không gian giám sát kết nối AP"
      className={
        fullscreen.active
          ? "fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-slate-50 p-4"
          : "space-y-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Wifi size={14} /> UNIFI / KẾT NỐI THIẾT BỊ
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sơ đồ mạng
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Thiết bị theo AP · cập nhật kết nối 15 giây · lưu lượng 5 giây
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={onOverview}>
            <GitBranch size={15} />
            Toàn mạng
          </button>
          <button
            className={button}
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
          <button
            className={`${button} !border-blue-200 !text-blue-700`}
            aria-pressed={fullscreen.active}
            onClick={() => void fullscreen.toggle()}
          >
            {fullscreen.active ? <Minimize2 size={15} /> : <Expand size={15} />}{" "}
            {fullscreen.active ? "Thoát toàn màn hình" : "Toàn màn hình"}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
          {topology.observedAt ? " · Đang giữ dữ liệu lần đọc gần nhất." : ""}
        </p>
      )}
      {trafficError && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
        >
          Lưu lượng: {trafficError}. Mẫu cũ không chạy hiệu ứng.
        </p>
      )}
      {!activeAp && !isAll ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {loading
            ? "Đang đọc danh sách AP và thiết bị kết nối…"
            : "Chưa có AP trong site đang chọn."}
        </div>
      ) : (
        <>
          <div
            className={`mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 ${fullscreen.active ? "md:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(0,1fr))]" : "lg:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(0,1fr))]"}`}
          >
            <label className="text-xs font-medium text-slate-500">
              Điểm truy cập đang xem
              <select
                aria-label="Chọn AP"
                value={isAll ? "all" : (activeAp?.id || "")}
                onChange={(event) => selectAp(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">
                  🌐 Toàn bộ hệ thống AP ({accessPoints.length} APs · {siteRows.length} Clients)
                </option>
                <optgroup label="Từng điểm truy cập riêng lẻ">
                  {accessPoints.map((ap) => (
                    <option value={ap.id} key={ap.id}>
                      {ap.name} · {clientsOf(topology, ap.id).length} thiết bị {ap.ip ? `· ${ap.ip}` : ""} {isOffline(ap.status) ? "(Offline)" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
              {isAll ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Chế độ xem toàn hệ thống ({accessPoints.length} APs)
                  </span>
                </div>
              ) : activeAp ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectAp("all")}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    ← Quay lại toàn bộ ({accessPoints.length} AP)
                  </button>
                  <button
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-700 hover:underline"
                    onClick={() => inspect(activeAp.id)}
                    type="button"
                  >
                    <Info size={12} />
                    {activeAp.ip || "Chưa có IP"} · Thông số AP
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              ) : null}
            </label>
            <div className="border-slate-100 md:border-l md:pl-4">
              <p className="text-xs text-slate-500">
                {isAll ? "Thiết bị khách toàn mạng" : "Thiết bị đang kết nối"}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                {isAll ? siteRows.length : rows.length}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  thiết bị
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {isAll
                  ? `${accessPoints.filter(a => !isOffline(a.status)).length} AP Online · ${accessPoints.filter(a => isOffline(a.status)).length} Offline`
                  : `${accessPoints.length} AP trong site · quan hệ từ controller`}
              </p>
            </div>
            <div className="border-slate-100 md:border-l md:pl-4">
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <ArrowDown size={13} className="text-blue-600" />
                {isAll ? "Tổng tải xuống toàn mạng" : "Tải xuống của thiết bị"}
              </p>
              <p className="mt-2 font-mono text-xl font-semibold text-blue-600">
                {rate(totals?.downloadBps)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {isAll ? "Lưu lượng thời gian thực toàn site" : "Tổng các máy khách của AP"}
              </p>
            </div>
            <div className="border-slate-100 md:border-l md:pl-4">
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <ArrowUp size={13} />
                {isAll ? "Tổng tải lên toàn mạng" : "Tải lên của thiết bị"}
              </p>
              <p className="mt-2 font-mono text-xl font-semibold text-slate-700">
                {rate(totals?.uploadBps)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                bps / Kbps / Mbps / Gbps
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              <button
                aria-pressed={view === "diagram"}
                onClick={() => setView("diagram")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${view === "diagram" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                <GitBranch size={14} />
                Sơ đồ kết nối {isAll ? "(Toàn mạng)" : ""}
              </button>
              <button
                aria-pressed={view === "matrix"}
                onClick={() => setView("matrix")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${view === "matrix" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                <LayoutGrid size={14} />
                Lưới 37 AP ({accessPoints.length})
              </button>
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${view === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                <List size={14} />
                Danh sách thiết bị ({inventory.length})
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {view === "diagram" && (
                <>
                  <button
                    className={button}
                    onClick={() =>
                      void flow?.fitView({
                        includeHiddenNodes: true,
                        padding: 0.12,
                        maxZoom: 1,
                      })
                    }
                  >
                    <Maximize size={14} />
                    Vừa khung
                  </button>
                  <button
                    className={button}
                    onClick={() =>
                      void flow?.setViewport({
                        zoom: 1,
                        x: (canvasWidth - (layout?.width || 0)) / 2,
                        y: 20,
                      })
                    }
                  >
                    100%
                  </button>
                  <button
                    className={button}
                    aria-pressed={paused}
                    aria-label={paused ? "Chạy hiệu ứng" : "Tạm dừng hiệu ứng"}
                    onClick={() => setPaused((value) => !value)}
                  >
                    {paused ? <Play size={14} /> : <Pause size={14} />}
                    <span className="hidden xl:inline">
                      {paused ? "Chạy hiệu ứng" : "Tạm dừng"}
                    </span>
                  </button>
                  <button
                    className={button}
                    aria-label="Xuất PNG"
                    title="Xuất PNG"
                    disabled={exporting}
                    onClick={() => void exportPng()}
                  >
                    <Download size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
          {isAll && view === "diagram" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <span className="px-2 text-xs font-semibold text-slate-500">Phân vùng AP:</span>
              {[
                { id: "all", label: `🌐 Toàn mạng (${accessPoints.length} AP)` },
                {
                  id: "active",
                  label: `⚡ Đang có thiết bị (${accessPoints.filter((a: any) => clientsOf(topology, a.id).length > 0).length} AP · ${siteRows.length} Khách)`,
                  highlight: true,
                },
                { id: "f1-3", label: "🏢 Tầng 1 - 3" },
                { id: "f4-6", label: "🏢 Tầng 4 - 6" },
                { id: "f7-9", label: "🏢 Tầng 7 - 9" },
                { id: "f10-12", label: "🏢 Tầng 10 - 12" },
                { id: "online", label: `🟢 Chỉ AP Online (${accessPoints.filter((a: any) => a.status === "online").length})` },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    setFloorFilter(btn.id);
                    setTimeout(() => {
                      void flow?.fitView({
                        includeHiddenNodes: true,
                        padding: 0.15,
                        duration: 350,
                      });
                    }, 50);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    floorFilter === btn.id
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : btn.highlight
                        ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-semibold"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
          <div
            className={`mt-3 grid min-h-0 items-start gap-3 ${selectedDevice ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}
          >
            <div className="min-w-0">
              {view === "matrix" ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Lưới giám sát toàn bộ hệ thống AP ({accessPoints.length} điểm truy cập)
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {accessPoints.filter((a: any) => !isOffline(a.status)).length} Online · {accessPoints.filter((a: any) => isOffline(a.status)).length} Offline · {siteRows.length} Tổng thiết bị khách đang kết nối
                      </p>
                    </div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        value={search}
                        onChange={(e: any) => setSearch(e.target.value)}
                        placeholder="Tìm kiếm AP theo tên, IP, MAC, model…"
                        className="w-64 rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 max-h-[650px] overflow-auto p-1">
                    {accessPoints
                      .filter((ap: any) => !search || [ap.name, ap.ip, ap.mac, ap.meta?.model].some((v: any) => String(v || "").toLowerCase().includes(search.toLowerCase())))
                      .map((ap: any) => {
                        const apClients = clientsOf(topology, ap.id);
                        const apOffline = isOffline(ap.status);
                        const apTraffic = latestTraffic(ap.traffic, snapshot?.nodes[ap.id]);
                        return (
                          <div
                            key={ap.id}
                            className={`rounded-xl border p-4 transition-all hover:shadow-md ${selected === ap.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                  <Wifi size={22} />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="truncate text-sm font-semibold text-slate-900" title={ap.name}>
                                    {ap.name}
                                  </h3>
                                  <p className="text-[11px] text-slate-500">{String(ap.meta?.model || "UniFi AP")}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${apOffline ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${apOffline ? "bg-red-500" : "bg-emerald-500"}`} />
                                {apOffline ? "OFFLINE" : "ONLINE"}
                              </span>
                            </div>
                            <div className="mt-3 space-y-1 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span className="text-slate-400">IP:</span>
                                <span className="font-mono">{ap.ip || "—"}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span className="text-slate-400">MAC:</span>
                                <span className="font-mono text-[11px] text-slate-500">{ap.mac || "—"}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span className="text-slate-400">Khách kết nối:</span>
                                <span className="font-semibold text-blue-700">{apClients.length} thiết bị</span>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-[10px]">
                              <div>
                                <span className="text-slate-500">↓ Tải xuống</span>
                                <p className="font-mono font-semibold text-blue-600">{rate(apTraffic?.downloadBps)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">↑ Tải lên</span>
                                <p className="font-mono font-semibold text-slate-700">{rate(apTraffic?.uploadBps)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  selectAp(ap.id);
                                  setView("diagram");
                                }}
                                className="flex-1 rounded-lg bg-blue-50 py-1.5 text-center text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                              >
                                Sơ đồ kết nối
                              </button>
                              <button
                                type="button"
                                onClick={() => inspect(ap.id)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                                title="Thông số chi tiết"
                              >
                                <Info size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : view === "diagram" ? (
                <div
                  ref={canvas}
                  aria-label={isAll ? "Sơ đồ mạng toàn bộ hệ thống AP" : `Kết nối trực tiếp với ${activeAp?.name || "AP"}`}
                  className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${fullscreen.active ? "h-[calc(100dvh-340px)] min-h-[440px]" : "h-[650px] min-h-[500px]"}`}
                >
                  <TrafficParticleProvider>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      edgeTypes={edgeTypes}
                      onInit={setFlow}
                      minZoom={0.04}
                      maxZoom={2}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      onlyRenderVisibleElements={false}
                      onNodeClick={(_: any, node: any) => inspect(node.id)}
                      onPaneClick={close}
                    >
                      <AccessViewport
                        structureKey={`${isAll ? floorFilter : activeAp?.id || "root"}:${layout?.nodes.length || 0}:${layout?.width || 0}`}
                      />
                      <Background gap={24} color="#e2e8f0" />
                      <Controls
                        showInteractive={false}
                        fitViewOptions={{
                          includeHiddenNodes: true,
                          padding: 0.15,
                          maxZoom: 1,
                        }}
                      />
                      <TrafficParticleOverlay />
                    </ReactFlow>
                  </TrafficParticleProvider>
                  {!isAll && !rows.length && (
                    <div className="pointer-events-none absolute inset-x-6 top-72 text-center text-sm text-slate-500">
                      Chưa có máy khách đang kết nối vào AP này.
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-3 left-14 max-w-[calc(100%-80px)] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-medium text-blue-700">
                        ↓ AP → thiết bị: tải xuống (hạt xanh cyan)
                      </span>
                      <span className="font-medium text-emerald-600">
                        ↑ Thiết bị → AP: tải lên (hạt ngọc lục bảo)
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {isAll ? "Toàn bộ hệ thống 37 AP UniFi kết nối trực tiếp · Chọn AP để xem chi tiết hoặc sơ đồ riêng" : "Kéo sơ đồ để di chuyển · Cuộn để phóng to · Chọn thiết bị để xem đầy đủ thông số"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {isAll || allSites
                          ? "Thiết bị trong toàn bộ site"
                          : `Thiết bị đang kết nối với ${activeAp?.name || "AP"}`}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {inventory.length} thiết bị · nhấn tên để xem chi tiết
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={allSites}
                          onChange={(event) =>
                            setAllSites(event.target.checked)
                          }
                        />
                        Tất cả AP trong site
                      </label>
                      <label className="relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-2.5 text-slate-400"
                        />
                        <input
                          aria-label="Tìm thiết bị của AP"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Tên, IP, MAC, SSID…"
                          className="w-60 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="max-h-[650px] overflow-auto">
                    <table className="w-full min-w-[1080px] text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 text-slate-500">
                        <tr>
                          {[
                            "Thiết bị / hostname",
                            "IP / MAC",
                            "AP / SSID",
                            "Hệ điều hành / hãng",
                            "Băng tần / kênh",
                            "Tín hiệu",
                            "Tải xuống",
                            "Tải lên",
                            "Thời gian kết nối",
                          ].map((label) => (
                            <th
                              key={label}
                              className="whitespace-nowrap px-4 py-3 font-medium"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((device) => (
                          <tr
                            key={device.id}
                            className={`border-t border-slate-100 ${selected === device.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                          >
                            <td className="max-w-64 px-4 py-3">
                              <button
                                onClick={() => inspect(device.id)}
                                className="flex items-center gap-2 text-left font-semibold text-blue-700"
                              >
                                <DeviceIcon device={device} size={28} />
                                <span className="break-words">
                                  {device.name}
                                </span>
                              </button>
                              <p className="mt-1 text-[10px] text-slate-400">
                                {device.meta?.hostname ||
                                  "Controller chưa cung cấp hostname"}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-mono">
                              <div>{device.ip || "—"}</div>
                              <div className="mt-1 text-[10px] text-slate-400">
                                {device.mac || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">
                                {apForClient.get(device.id)?.name ||
                                  device.meta?.apName ||
                                  "Chưa xác định AP"}
                              </div>
                              <div className="mt-1 text-slate-500">
                                {device.meta?.ssid || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>{device.meta?.osName || "—"}</div>
                              <div className="mt-1 text-slate-500">
                                {device.meta?.vendor || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>{radioLabel(device.meta)}</div>
                              <div className="mt-1 text-slate-500">
                                {device.meta?.channel
                                  ? `Kênh ${device.meta.channel}`
                                  : "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono">
                              {device.meta?.signal != null
                                ? `${device.meta.signal} dBm`
                                : "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-blue-700">
                              {rate(device.traffic?.downloadBps)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">
                              {rate(device.traffic?.uploadBps)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {duration(device.meta?.uptime)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered.length && (
                      <p className="p-10 text-center text-sm text-slate-500">
                        {search
                          ? "Không có thiết bị khớp tìm kiếm."
                          : "AP này chưa có máy khách đang kết nối."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedDevice && (
              <div className="min-w-0 [&>aside]:!w-full">
                <DetailDrawer
                  device={selectedDevice}
                  devices={topology.nodes}
                  members={selectedDevice.type === "ap" ? clients : undefined}
                  traffic={latestTraffic(
                    selectedDevice.traffic,
                    snapshot?.nodes[selectedDevice.id],
                  )}
                  history={history[selectedDevice.id]}
                  onSelect={inspect}
                  onClose={close}
                  observedAt={topology.observedAt}
                />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <SourceStamp
              source="UniFi · quan hệ AP / máy khách"
              sampledAt={topology.observedAt}
              staleAfter={90}
            />
            <span>
              {unknown.length
                ? `${unknown.length} thiết bị chưa có quan hệ AP · xem Toàn mạng`
                : "Dấu —: chưa có thông số được xác nhận"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
