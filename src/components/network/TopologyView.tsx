"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  RefreshCw,
  Search,
  Users,
  Pause,
  Play,
  Maximize,
  Download,
} from "lucide-react";
import { toPng } from "html-to-image";
import type { Provider } from "@/lib/network/resources";
import type { Topology } from "@/lib/network/topology";
import AccessPointWorkspace from "./AccessPointWorkspace";
import MikrotikTopologyWorkspace from "./MikrotikTopologyWorkspace";
import { networkFetch } from "./client";
import { buildLayout } from "./topology/layout";
import { TopologyViewport } from "./topology/TopologyViewport";
import { DeviceNode } from "./topology/DeviceNode";
import { TrafficEdge } from "./topology/TrafficEdge";
import {
  TrafficParticleProvider,
  TrafficParticleOverlay,
} from "./topology/TrafficParticles";
import { DetailDrawer, Source } from "./topology/DetailDrawer";
import { useAnimationEnabled, useTraffic } from "./topology/useTraffic";
import {
  aggregate,
  isOffline,
  rate,
  type Device,
  type Link,
  type Traffic,
} from "./topology/model";
const nodeTypes = { device: DeviceNode };
const edgeTypes = { traffic: TrafficEdge };
const empty: Topology = { nodes: [], links: [], observedAt: "", warnings: [] };
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50";
/** Kept as a public helper for existing callers; text search now focuses rather than removing parents. */
export function layoutTopology(
  topology: Topology,
  hideClients: boolean,
  _search: string,
  layer: string,
) {
  return buildLayout(topology, {
    hideClients,
    layer,
    grouping: "ap",
    expanded: new Set(),
  });
}
export default function TopologyView({provider}:{provider:Provider}) {
  const params=useSearchParams();
  const [overview,setOverview]=useState(params.get("view")==="network");
  if(provider==="unifi"&&!overview)return <AccessPointWorkspace onOverview={()=>setOverview(true)}/>;
  if(provider==="mikrotik"&&!overview)return <MikrotikTopologyWorkspace onOverview={()=>setOverview(true)}/>;
  return (
    <>
      <div className="mb-2">
        {provider==="unifi"&&(
          <button className={button} onClick={()=>setOverview(false)}>
            ← Thiết bị theo AP
          </button>
        )}
        {provider==="mikrotik"&&(
          <button className={button} onClick={()=>setOverview(false)}>
            ← Sơ đồ phân nhánh MikroTik
          </button>
        )}
      </div>
      <TopologyOverview provider={provider}/>
    </>
  );
}
function TopologyOverview({ provider }: { provider: Provider }) {
  const params = useSearchParams();
  const scope = params.toString();
  const [topology, setTopology] = useState<Topology>(empty),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [hideClients, setHideClients] = useState(false),
    [layer, setLayer] = useState("all"),
    [grouping, setGrouping] = useState("ap"),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [paused, setPaused] = useState(false),
    [exporting, setExporting] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const [selected, setSelected] = useState<{
    kind: "node" | "edge";
    id: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(
    null,
  );
  const canvas = useRef<HTMLDivElement>(null);
  const {
    snapshot,
    history,
    error: trafficError,
  } = useTraffic(provider, scope);
  const animation = useAnimationEnabled(paused);
  useEffect(() => {
    let alive = true,
      pending = false;
    const controller = new AbortController();
    setError("");
    const load = async () => {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const response = await networkFetch(`/api/${provider}/topology`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw Error(data.error || "Không thể tải sơ đồ mạng");
        if (alive) {
          setTopology(data.data);
          setError("");
        }
      } catch (e) {
        if (alive && !controller.signal.aborted) setError((e as Error).message);
      } finally {
        pending = false;
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [provider, scope, revision]);
  useEffect(() => {
    setTopology(empty);
    setSelected(null);
    setExpanded(new Set());
  }, [provider, scope]);
  const layout = useMemo(
    () => buildLayout(topology, { hideClients, layer, grouping, expanded }),
    [topology, hideClients, layer, grouping, expanded],
  );
  const structuralKey = layout.nodes.map(n => `${n.id}:${n.position.x}:${n.position.y}`).join("|")
    + layout.edges.map(edge => `${edge.source}>${edge.target}`).join("|");
  const [fittedStructure, setFittedStructure] = useState("");
  const devices: Device[] = useMemo(
    () =>
      topology.nodes.map((n) => ({
        ...n,
        traffic: snapshot?.nodes[n.id] || (n as Device).traffic,
      })),
    [topology.nodes, snapshot],
  );
  const deviceMap = useMemo(
    () => new Map(devices.map((n) => [n.id, n])),
    [devices],
  );
  const trafficForCluster = useCallback(
    (id: string) =>
      aggregate(
        layout.clusters.get(id)?.map((n) => deviceMap.get(n.id)?.traffic) || [],
      ),
    [layout.clusters, deviceMap],
  );
  const rankedEdges = useMemo(
    () =>
      new Set(
        [...layout.edges]
          .sort((a, b) => {
            const score = (edge: typeof a) => {
              const link = edge.data?.link as Link;
              const t = snapshot?.links[edge.id] || link.traffic;
              return (
                (selected?.id === edge.source || selected?.id === edge.target
                  ? 1e20
                  : 0) +
                (t?.downloadBps || 0) +
                (t?.uploadBps || 0)
              );
            };
            return score(b) - score(a);
          })
          .slice(0, 150)
          .map((e) => e.id),
      ),
    [layout.edges, snapshot, selected],
  );
  const nodes = useMemo(
    () =>
      layout.nodes.map((n) => ({
        ...n,
        selected: selected?.kind === "node" && selected.id === n.id,
        data: {
          ...n.data,
          device: deviceMap.get(n.id) || n.data.device,
          traffic: layout.clusters.has(n.id)
            ? trafficForCluster(n.id)
            : deviceMap.get(n.id)?.traffic,
        },
      })),
    [layout.nodes, layout.clusters, deviceMap, trafficForCluster, selected],
  );
  const edges = useMemo(
    () =>
      layout.edges.map((e) => {
        const original = e.data?.link as Link;
        const traffic = e.id.startsWith("cluster-edge:")
          ? aggregate(
              (layout.clusters.get(e.target) || [])
                .filter((n) =>
                  topology.links.some(
                    (l) => l.source === e.source && l.target === n.id,
                  ),
                )
                .map((n) => deviceMap.get(n.id)?.traffic),
            )
          : snapshot?.links[e.id] || original.traffic;
        return {
          ...e,
          selected: selected?.kind === "edge" && selected.id === e.id,
          data: {
            link: original,
            traffic,
            clock,
            animate: animation && rankedEdges.has(e.id),
            offline:
              isOffline(deviceMap.get(e.source)?.status) ||
              isOffline(deviceMap.get(e.target)?.status),
          },
        };
      }),
    [
      layout.edges,
      layout.clusters,
      topology.links,
      snapshot,
      animation,
      rankedEdges,
      deviceMap,
      selected,
      clock,
    ],
  );
  const details =
    selected?.kind === "node"
      ? deviceMap.get(selected.id) ||
        nodes.find((n) => n.id === selected.id)?.data.device
      : undefined;
  const detailEdge =
    selected?.kind === "edge"
      ? ((edges.find((e) => e.id === selected.id)?.data.link ||
          topology.links.find((e) => e.id === selected.id)) as Link | undefined)
      : undefined;
  const detailTraffic = details
    ? layout.clusters.has(details.id)
      ? trafficForCluster(details.id)
      : details.traffic
    : detailEdge
      ? edges.find((e) => e.id === selected?.id)?.data.traffic ||
        snapshot?.links[detailEdge.id] ||
        detailEdge.traffic
      : undefined;
  const members = details
    ? layout.clusters.get(details.id)?.map((n) => deviceMap.get(n.id)!) ||
      (details.type === "ap"
        ? devices.filter(
            (n) =>
              topology.links.some(
                (e) => e.source === details.id && e.target === n.id,
              ) && n.type === "client",
          )
        : undefined)
    : undefined;
  const total = aggregate(
    devices.filter((n) => n.type === "client").map((n) => n.traffic),
  );
  const unknown = devices.filter(
    (n) => n.group === "unknown" && (!hideClients || n.type !== "client"),
  );
  const [unknownOpen, setUnknownOpen] = useState(true);
  const close = useCallback(() => setSelected(null), []);
  const selectDevice = useCallback(
    (id: string) => {
      setSelected({ kind: "node", id });
      const cluster = Array.from(layout.clusters.entries()).find(
        ([, members]) => members.some((n) => n.id === id),
      );
      if (cluster && cluster[1].slice(0, 30).some((n) => n.id === id))
        setExpanded(
          (previous) => new Set([...Array.from(previous), cluster[0]]),
        );
      const visible = nodes.find((n) => n.id === id);
      if (visible)
        void flowInstance?.fitView({
          nodes: [{ id }],
          includeHiddenNodes: true,
          duration: animation ? 350 : 0,
          padding: 1.2,
          maxZoom: 1.25,
        });
    },
    [nodes, flowInstance, animation, layout.clusters],
  );
  const searchMatch = search.trim()
    ? devices.find((n) =>
        [n.name, n.ip, n.mac].some((v) =>
          v?.toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : undefined;
  const focusSearch = () => {
    if (!searchMatch) return;
    selectDevice(searchMatch.id);
  };
  const exportPng = async () => {
    if (!canvas.current) return;
    setExporting(true);
    try {
      const data = await toPng(canvas.current, {
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
        filter: (node) =>
          !(
            node instanceof Element &&
            node.matches(
              ".react-flow__controls, .react-flow__minimap, .react-flow__attribution",
            )
          ),
      });
      const a = document.createElement("a");
      a.href = data;
      a.download = `${provider}-topology-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })}.png`;
      a.click();
    } catch {
      setError("Không thể xuất ảnh PNG. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sơ đồ mạng
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cây kết nối thiết bị · cấu trúc 60 giây · lưu lượng 5 giây
          </p>
          <Source
            traffic={
              snapshot
                ? ({
                    source: snapshot.source,
                    sampledAt: snapshot.sampledAt,
                  } as Traffic)
                : undefined
            }
            fallback={
              topology.observedAt
                ? `${provider === "unifi" ? "UniFi" : "MikroTik"} · ${new Date(topology.observedAt).toLocaleString("vi-VN")}`
                : "Đang chờ dữ liệu quan sát"
            }
          />
        </div>
        <button
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
          className={button}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Gateway", devices.filter((n) => n.type === "gateway").length],
          ["Switch", devices.filter((n) => n.type === "switch").length],
          ["Điểm truy cập", devices.filter((n) => n.type === "ap").length],
          ["Máy khách", devices.filter((n) => n.type === "client").length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold leading-none tabular-nums text-slate-900">
              {topology.observedAt ? count : "—"}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {provider === "unifi" ? "UniFi" : "MikroTik"} ·{" "}
              {topology.observedAt
                ? new Date(topology.observedAt).toLocaleTimeString("vi-VN")
                : "Chưa có mẫu"}
            </p>
          </div>
        ))}
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 lg:col-span-1">
          <p className="text-xs text-slate-500">Tổng lưu lượng máy khách</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
            <span className="font-semibold text-blue-600">↓ {rate(total?.downloadBps)}</span>
            <span className="text-slate-500">↑ {rate(total?.uploadBps)}</span>
          </div>
          <p className="mt-1 truncate text-[10px] text-slate-400" title={total ? `${total.source} · ${total.sampledAt}` : "Nguồn chưa cung cấp số liệu"}>
            {total ? `${total.source} · ${new Date(total.sampledAt).toLocaleTimeString("vi-VN", {timeZone: "Asia/Bangkok"})}` : "Nguồn chưa cung cấp số liệu"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <form
          className="relative flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            focusSearch();
          }}
        >
          <Search size={15} className="absolute left-3 text-slate-400" />
          <input
            aria-label="Tìm trong sơ đồ"
            placeholder="Tên, IP hoặc MAC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-40 rounded-lg border border-slate-200 py-2 pl-9 pr-2 text-xs"
          />
          <button className={button} disabled={!searchMatch} type="submit">
            Tìm
          </button>
        </form>
        <select
          aria-label="Lớp sơ đồ"
          value={layer}
          onChange={(e) => setLayer(e.target.value)}
          className={button}
        >
          <option value="all">Tất cả lớp</option>
          <option value="physical">Vật lý</option>
          <option value="logical">Logic</option>
        </select>
        <select
          aria-label="Gom cụm máy khách"
          value={grouping}
          onChange={(e) => {
            setGrouping(e.target.value);
            setExpanded(new Set());
          }}
          className={button}
        >
          <option value="ap">Gom theo AP / uplink</option>
          <option value="ssid">Gom theo SSID</option>
        </select>
        <button
          className={button}
          aria-pressed={hideClients}
          onClick={() => setHideClients((v) => !v)}
        >
          <Users size={15} />
          {hideClients ? "Hiện máy khách" : "Ẩn máy khách"}
        </button>
        <button
          className={button}
          aria-pressed={paused}
          aria-label={paused ? "Chạy hiệu ứng" : "Tạm dừng hiệu ứng"}
          onClick={() => setPaused((v) => !v)}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}{" "}
          {paused ? "Chạy hiệu ứng" : "Tạm dừng"}
        </button>
        <button
          className={button}
          onClick={() =>
            void flowInstance?.fitView({
              padding: 0.15,
              includeHiddenNodes: true,
              maxZoom: 1,
              duration: animation ? 300 : 0,
            })
          }
        >
          <Maximize size={15} />
          Vừa khung
        </button>
        <button
          className={button}
          disabled={exporting || !nodes.length}
          aria-label={exporting ? "Đang xuất…" : "Xuất PNG"}
          title="Xuất PNG"
          onClick={() => void exportPng()}
        >
          <Download size={15} />
          <span className="hidden 2xl:inline">{exporting ? "Đang xuất…" : "Xuất PNG"}</span>
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {trafficError && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
        >
          Lưu lượng: {trafficError}. Các mẫu quá 30 giây được đánh dấu cũ và
          dừng hiệu ứng.
        </p>
      )}
      {topology.warnings?.length > 0 && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
        >
          {topology.warnings.join(" · ")}
        </p>
      )}
      <div
        className={`grid items-start gap-4 ${details || detailEdge ? "xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}
      >
        <div
          ref={canvas}
          className="relative h-[68vh] min-h-[480px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          aria-label="Sơ đồ mạng quan sát được"
        >
          <TrafficParticleProvider>
            <ReactFlow
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodes={nodes}
              edges={edges}
              onInit={setFlowInstance}
              onlyRenderVisibleElements={!!structuralKey && fittedStructure === structuralKey}
              minZoom={0.08}
              maxZoom={2}
              onNodeClick={(_, node) => {
                if ((node.data.device as Device).type === "site") return;
                setSelected({ kind: "node", id: node.id });
                if (layout.clusters.has(node.id))
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.has(node.id)
                      ? next.delete(node.id)
                      : next.add(node.id);
                    return next;
                  });
              }}
              onEdgeClick={(_, edge) => {
                if ((edge.data?.link as Link)?.type !== "organization") setSelected({ kind: "edge", id: edge.id });
              }}
              onPaneClick={close}
              nodesDraggable={false}
            >
              <TopologyViewport structureKey={structuralKey} onFitted={setFittedStructure} />
              <Background gap={24} color="#e2e8f0" />
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
          {unknown.length > 0 && (
            <div className="absolute right-3 top-3 max-h-[50%] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <button
                className="w-full text-left text-xs font-semibold text-slate-700"
                onClick={() => setUnknownOpen((v) => !v)}
                aria-expanded={unknownOpen}
              >
                Chưa rõ kết nối · {unknown.length}
              </button>
              {unknownOpen && (
                <>
                  <p className="my-2 text-[10px] text-slate-500">
                    Không suy đoán đường nối
                  </p>
                  {unknown.slice(0, 12).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => selectDevice(n.id)}
                      className="block w-full truncate border-t border-slate-100 py-2 text-left text-xs text-slate-600"
                    >
                      {n.name}
                    </button>
                  ))}
                  {unknown.length > 12 && (
                    <p className="text-[10px] text-slate-500">
                      Còn {unknown.length - 12} thiết bị · dùng tìm kiếm để xem.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {!nodes.length && !loading && (
            <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-slate-500">
              {unknown.length
                ? "Thiết bị được hiển thị trong khay chưa rõ kết nối."
                : "Chưa có nút quan sát nào phù hợp."}
            </p>
          )}
          {loading && !nodes.length && (
            <p
              role="status"
              className="absolute inset-x-0 top-1/2 text-center text-sm text-slate-500"
            >
              Đang tải sơ đồ mạng…
            </p>
          )}
          <div className="absolute bottom-3 left-14 max-w-[65%] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] leading-5 text-slate-500">
            <div>— Có dây · ┄ Không dây · ··· Logic</div>
            <div>
              <span className="mr-3 text-blue-600">↓ Download</span>
              <span>↑ Upload</span>
            </div>
            <div>Không có số liệu: cạnh tĩnh · cụm mở tối đa 30 khách</div>
          </div>
        </div>
        {(details || detailEdge) && (
          <DetailDrawer
            device={details}
            edge={detailEdge}
            traffic={detailTraffic}
            history={details ? history[details.id] : undefined}
            devices={devices}
            members={members}
            observedAt={topology.observedAt}
            onSelect={selectDevice}
            onClose={close}
          />
        )}
      </div>
    </section>
  );
}
