"use client";
import "./topology/network-monitor-mode.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Search,
  RefreshCw,
  Maximize,
  Minimize2,
  Expand,
  Download,
  Pause,
  Play,
  GitBranch,
  List,
  Wifi,
  Network,
  ChevronRight,
  Layers,
  Plus,
} from "lucide-react";
import { toPng } from "html-to-image";
import type { Provider } from "@/lib/network/resources";
import type { Topology } from "@/lib/network/topology";
import { networkFetch } from "./client";
import { DeviceIcon } from "./DeviceIcon";
import { NetworkDeviceNode } from "./topology/NetworkDeviceNode";
import { NetworkTrafficEdge } from "./topology/NetworkTrafficEdge";
import { rootViewport, fitRootViewport } from "./topology/root-viewport";
import { NetworkViewport } from "./topology/NetworkViewport";
import {
  TrafficParticleProvider,
  TrafficParticleOverlay,
} from "./topology/TrafficParticles";
import { mikrotikInfrastructureTopology } from "@/lib/network/mikrotik-infrastructure";
import { useAnimationEnabled, useTraffic } from "./topology/useTraffic";
import { useFullscreen } from "./topology/useFullscreen";
import { DetailDrawer } from "./topology/DetailDrawer";
import {
  buildNetworkLayout,
  revealAncestors,
  trafficDirections,
  filterNetworkTopology,
  deviceFloor as floorOf,
  type NetworkNodeData,
} from "./topology/network-layout";
import { latestTraffic } from "./topology/ap-model";
import {
  aggregate,
  isOffline,
  isOnline,
  rate,
  type Device,
  type Link,
} from "./topology/model";
const nodeTypes = { "network-device": NetworkDeviceNode },
  edgeTypes = { "network-traffic": NetworkTrafficEdge };
const empty: Topology = { nodes: [], links: [], observedAt: "", warnings: [] };

export default function NetworkTopologyWorkspace({
  provider,
}: {
  provider: Provider;
}) {
  const params = useSearchParams();
  const isFleet =
    provider === "mikrotik" &&
    (params.get("scope") === "fleet" || !params.get("connectionId"));
  const { canAdmin } = useAuth();
  const scope = `${provider}:${isFleet ? "fleet" : params.get("connectionId") || ""}:${params.get("siteId") || ""}`;
  const [topology, setTopology] = useState<Topology>(empty),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(
      new Set(),
    ),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{
      kind: "node" | "edge";
      id: string;
    } | null>(null),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [focusId, setFocusId] = useState(""),
    [focusVersion, setFocusVersion] = useState(0);
  const [view, setView] = useState<"diagram" | "list">("diagram"),
    [apId, setApId] = useState("all"),
    [floor, setFloor] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [columns, setColumns] = useState(6),
    [showAdditional, setShowAdditional] = useState(false);
  const [paused, setPaused] = useState(false),
    [exporting, setExporting] = useState(false),
    [clock, setClock] = useState(Date.now),
    [zoom, setZoom] = useState(1),
    [flow, setFlow] = useState<ReactFlowInstance<Node<NetworkNodeData>> | null>(
      null,
    );
  const workspace = useRef<HTMLElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(workspace);
  const {
    snapshot,
    history,
    error: trafficError,
  } = useTraffic(provider, scope, provider !== "mikrotik");
  const animation = useAnimationEnabled(paused);
  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    window.addEventListener("network-connections-changed", changed);
    return () =>
      window.removeEventListener("network-connections-changed", changed);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setTopology(empty);
    setExpanded(new Set());
    setManuallyCollapsed(new Set());
    setCollapsed(new Set());
    setSelected(null);
    setQuery("");
    setApId("all");
    setFloor("all");
    setStatusFilter("all");
    setShowAdditional(false);
    setFocusId("");
  }, [scope]);
  useEffect(() => {
    let alive = true,
      pending = false;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const r = await networkFetch(`/api/${provider}/topology`, {
          signal: abort.signal,
        });
        const j = await r.json();
        if (!r.ok || !j.success)
          throw Error(j.error || "Không thể tải sơ đồ mạng");
        if (alive) {
          setTopology(provider === "mikrotik" ? mikrotikInfrastructureTopology(j.data) : j.data);
          setError("");
        }
      } catch (e) {
        if (alive && !abort.signal.aborted) setError((e as Error).message);
      } finally {
        pending = false;
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      abort.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scope, provider, revision]);
  const accessPoints = useMemo(
    () =>
      topology.nodes
        .filter((n) => n.type === "ap")
        .sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })),
    [topology.nodes],
  );
  const floors = useMemo(
    () =>
      Array.from(
        new Set(
          accessPoints
            .map((node) => floorOf(node)?.value)
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),
    [accessPoints],
  );
  const hasInferredFloor = accessPoints.some((node) => floorOf(node)?.inferred);
  const graph = useMemo(
    () => filterNetworkTopology(topology, { floor, status: statusFilter }),
    [topology, floor, statusFilter],
  );
  // Strip measurements from the structural dependency key; rates never trigger Dagre.
  const structureKey = JSON.stringify({
    nodes: graph.nodes.map((n) => [n.id, n.type, n.name, n.ip, n.status]),
    links: graph.links.map((e) => [
      e.id,
      e.source,
      e.target,
      e.type,
      e.layer,
      e.evidence,
      e.speedMbps,
    ]),
  });
  const stableGraph = useMemo(() => graph, [structureKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const apIdsWithClients = useMemo(() => {
    const ids = new Set<string>();
    const byId = new Map(stableGraph.nodes.map(node => [node.id, node]));
    for (const edge of stableGraph.links) {
      const targetNode = byId.get(edge.target);
      if (targetNode?.type === "client") {
        ids.add(edge.source);
      }
    }
    return ids;
  }, [stableGraph]);
  const effectiveExpanded = useMemo(() => {
    const next = new Set(expanded);
    for (const id of Array.from(manuallyCollapsed)) {
      next.delete(id);
    }
    return next;
  }, [expanded, manuallyCollapsed, apIdsWithClients]);
  const layout = useMemo(
    () =>
      buildNetworkLayout(stableGraph, {
        expanded: effectiveExpanded,
        collapsed,
        focusApId: apId === "all" ? undefined : apId,
        columns,
      }),
    [stableGraph, effectiveExpanded, collapsed, apId, columns],
  );
  const devices = useMemo(
    () =>
      topology.nodes.map((node) => ({
        ...node,
        traffic: latestTraffic(node.traffic, snapshot?.nodes[node.id]),
      })),
    [topology.nodes, snapshot],
  );
  const deviceMap = useMemo(
    () => new Map(devices.map((node) => [node.id, node])),
    [devices],
  );
  const linkMap = useMemo(
    () => new Map(topology.links.map((link) => [link.id, link])),
    [topology.links],
  );
  const selectedDevice =
    selected?.kind === "node"
      ? deviceMap.get(selected.id) ||
        layout.nodes.find((n) => n.id === selected.id)?.data.device
      : undefined;
  const selectedEdge =
    selected?.kind === "edge"
      ? topology.links.find((e) => e.id === selected.id)
      : undefined;
  const selectedPath = useMemo(
    () =>
      selected?.kind === "node"
        ? revealAncestors({ ...topology, links: layout.edges.filter(edge => !edge.data?.secondary).map(edge => edge.data!.link) }, selected.id)
        : new Set<string>(),
    [topology, layout.edges, selected],
  );
  const toggle = useCallback(
    (id: string) => {
      const node = topology.nodes.find((n) => n.id === id);
      if (
        (node?.type === "ap" && apIdsWithClients.has(id)) ||
        id === "layout:unassociated"
      ) {
        const isCurrentlyExpanded = effectiveExpanded.has(id);
        if (isCurrentlyExpanded) {
          setManuallyCollapsed(
            (before) => new Set([...Array.from(before), id]),
          );
          setExpanded((before) => {
            const next = new Set(before);
            next.delete(id);
            return next;
          });
        } else {
          setManuallyCollapsed((before) => {
            const next = new Set(before);
            next.delete(id);
            return next;
          });
          setExpanded((before) => new Set([...Array.from(before), id]));
        }
      } else
        setCollapsed((before) => {
          const next = new Set(before);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
    },
    [topology.nodes, apIdsWithClients, effectiveExpanded],
  );
  const nodes = useMemo(
    () =>
      layout.nodes.map((node) => ({
        ...node,
        selected: selected?.kind === "node" && selected.id === node.id,
        data: {
          ...node.data,
          device: deviceMap.get(node.id) || node.data.device,
          traffic: deviceMap.get(node.id)?.traffic,
          clock,
          onToggle: apId === "all" ? toggle : undefined,
        },
      })),
    [layout.nodes, deviceMap, clock, selected, toggle, apId],
  );
  const edges = useMemo(
    () =>
      layout.edges.filter((edge, index, all) => {
        if (!edge.data?.secondary || showAdditional || (selected?.kind === "edge" && edge.id === selected.id)) return true;
        if (selected?.kind !== "node" || (edge.source !== selected.id && edge.target !== selected.id)) return false;
        // Reciprocal discovery is useful evidence, but drawing both directions as separate cables obscures the same peer.
        const samePair = (other: typeof edge) => (other.source === edge.source && other.target === edge.target) || (other.source === edge.target && other.target === edge.source);
        return !all.some(other => !other.data?.secondary && samePair(other)) && all.findIndex(samePair) === index;
      }).map((edge) => {
        const link = edge.data?.link as Link;
        const offline =
          isOffline(deviceMap.get(edge.source)?.status) ||
          isOffline(deviceMap.get(edge.target)?.status);
        return {
          ...edge,
          selected: selected?.kind === "edge" && selected.id === edge.id,
          data: {
            ...edge.data,
            traffic: latestTraffic(
              linkMap.get(edge.id)?.traffic,
              snapshot?.links[edge.id],
            ),
            clock,
            animate: animation,
            offline,
            highlighted:
              selected?.kind === "node" &&
              (edge.target === selected.id || selectedPath.has(edge.target)),
          },
        };
      }),
    [
      layout.edges,
      snapshot,
      clock,
      animation,
      deviceMap,
      selected,
      selectedPath,
      linkMap,
      showAdditional,
    ],
  );
  const searchResults = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("vi");
    return text
      ? devices
          .filter((node) =>
            [node.name, node.ip, node.mac, node.meta?.hostname].some((value) =>
              String(value || "")
                .toLocaleLowerCase("vi")
                .includes(text),
            ),
          )
          .slice(0, 12)
      : [];
  }, [devices, query]);
  const inspect = useCallback(
    (id: string) => {
      const ancestors = revealAncestors(topology, id);
      if (
        !topology.links.some((edge) => edge.target === id) &&
        topology.nodes.find((node) => node.id === id)?.type === "client"
      )
        ancestors.add("layout:unassociated");
      setExpanded(
        (before) => new Set([...Array.from(before), ...Array.from(ancestors)]),
      );
      setManuallyCollapsed(
        (before) =>
          new Set(
            Array.from(before).filter((value) => !ancestors.has(value)),
          ),
      );
      setCollapsed(
        (before) =>
          new Set(
            Array.from(before).filter(
              (value) => !ancestors.has(value) && value !== "layout:unmapped",
            ),
          ),
      );
      setApId("all");
      setFloor("all");
      setStatusFilter("all");
      setSelected({ kind: "node", id });
      setFocusId(id);
      setFocusVersion((value) => value + 1);
      setSearchOpen(false);
      setQuery("");
    },
    [topology],
  );
  const close = useCallback(() => setSelected(null), []);
  const clients = devices.filter((n) => n.type === "client");
  const totals = aggregate(clients.map((n) => n.traffic));
  const inventory =
    apId === "all"
      ? devices.filter((node) =>
          graph.nodes.some((visible) => visible.id === node.id),
        )
      : devices.filter((node) =>
          layout.nodes.some((visible) => visible.id === node.id),
        );
  const filtered = inventory.filter(
    (node) =>
      !query ||
      [node.name, node.ip, node.mac, node.meta?.hostname].some((value) =>
        String(value || "")
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")),
      ),
  );

  const exportPng = async () => {
    if (!canvas.current) return;
    setExporting(true);
    try {
      const url = await toPng(canvas.current, {
        pixelRatio: 2,
        backgroundColor: "#f8fafc",
        filter: (node) =>
          !(
            node instanceof Element &&
            node.matches(
              ".react-flow__controls,.react-flow__minimap,.react-flow__attribution",
            )
          ),
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${provider}-topology-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })}.png`;
      a.click();
    } catch {
      setError("Không thể xuất PNG. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <section
      ref={workspace}
      className={`network-workspace ${fullscreen.active ? "is-fullscreen" : ""}`}
      aria-label={`Không gian giám sát ${provider === "unifi" ? "UniFi" : "MikroTik"}`}
    >
      <header className="network-workspace-header">
        <div>
          <p className="network-eyebrow">
            <Network size={13} />
            {provider === "unifi" ? "UNIFI NETWORK" : "MIKROTIK NETWORK"}
          </p>
          <h1>{isFleet ? "Sơ đồ toàn bộ MikroTik" : "Sơ đồ mạng"}</h1>
        </div>
        <div className="network-header-meta">
          {provider === "mikrotik" && (
            <>
              {!isFleet && (
                <NextLink
                  className="network-tool-button"
                  href="/admin/mikrotik/topology?scope=fleet"
                >
                  <Network size={15} />
                  Toàn bộ MikroTik
                </NextLink>
              )}
              {canAdmin && (
                <NextLink
                  className="network-tool-button network-primary-button"
                  href="/admin/mikrotik/inventory?add=1"
                >
                  <Plus size={15} />
                  Thêm thiết bị
                </NextLink>
              )}
            </>
          )}
          <span className="network-update-label">
            {loading
              ? "Đang tải…"
              : topology.observedAt
                ? `Cập nhật ${new Date(topology.observedAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Bangkok" })}`
                : "Chưa có dữ liệu"}
          </span>
          <button
            className="network-tool-button"
            onClick={() => setRevision((n) => n + 1)}
            aria-label="Làm mới sơ đồ"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            className="network-tool-button"
            onClick={() => { setView("diagram"); void fullscreen.toggle(); }}
            aria-label={
              fullscreen.active ? "Thoát toàn màn hình" : "Toàn màn hình"
            }
          >
            {fullscreen.active ? <Minimize2 size={16} /> : <Expand size={16} />}
            <span>
              {fullscreen.active ? "Thoát toàn màn hình" : "Toàn màn hình"}
            </span>
          </button>
        </div>
      </header>
      <div className="network-summary-strip">
        <div>
          <span>Thiết bị hạ tầng</span>
          <strong>
            {topology.observedAt
              ? devices.filter(
                  (n) => !["client", "interface", "bridge"].includes(n.type),
                ).length
              : "—"}
          </strong>
        </div>
        <div>
          <span>
            {provider === "unifi" ? "AP trực tuyến" : "Hạ tầng trực tuyến"}
          </span>
          <strong>
            {topology.observedAt
              ? (provider === "unifi"
                  ? accessPoints
                  : devices.filter(
                      (node) =>
                        !["client", "interface", "bridge"].includes(node.type),
                    )
                ).filter((node) => isOnline(node.status)).length
              : "—"}
            <small>
              {" "}
              /{" "}
              {provider === "unifi"
                ? accessPoints.length
                : devices.filter(
                    (node) =>
                      !["client", "interface", "bridge"].includes(node.type),
                  ).length}
            </small>
          </strong>
        </div>
        {provider === "unifi" ? <>
        <div>
          <span>Máy khách</span>
          <strong>{topology.observedAt ? clients.length : "—"}</strong>
        </div>
        <div>
          <span>Tổng khách · tải xuống</span>
          <strong className="network-receive">
            {rate(totals?.downloadBps)}
          </strong>
        </div>
        <div>
          <span>Tổng khách · tải lên</span>
          <strong className="network-send">{rate(totals?.uploadBps)}</strong>
        </div>
        </> : <>
          <div><span>Router trực tuyến</span><strong>{devices.filter(n => ["gateway", "router"].includes(n.type)).length}</strong></div>
          <div><span>Switch trực tuyến</span><strong>{devices.filter(n => n.type === "switch").length}</strong></div>
          <div><span>Liên kết thiết bị</span><strong>{topology.links.length}</strong></div>
        </>}
      </div>
      {(error || trafficError) && (
        <div role="alert" className="network-notice is-warning">
          {error || trafficError}{" "}
          {topology.nodes.length > 0 ? "Đang giữ dữ liệu gần nhất." : ""}
        </div>
      )}
      {topology.warnings.length > 0 && (
        <details className="network-source-warnings">
          <summary>{topology.warnings.length} lưu ý từ nguồn dữ liệu</summary>
          {topology.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </details>
      )}
      <div className="network-toolbar">
        <div className="network-view-tabs">
          <button
            className={view === "diagram" ? "is-active" : ""}
            onClick={() => setView("diagram")}
          >
            <GitBranch size={15} />
            Sơ đồ kết nối
          </button>
          <button
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
          >
            <List size={15} />
            Danh sách <span>{inventory.length}</span>
          </button>
        </div>
        <div className="network-search">
          <Search size={16} />
          <input
            aria-label="Tìm thiết bị"
            placeholder="Tìm tên, IP hoặc MAC…"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchResults[0]) {
                e.preventDefault();
                inspect(searchResults[0].id);
              }
              if (e.key === "Escape") setSearchOpen(false);
            }}
          />
          {searchOpen && query && view === "diagram" && (
            <div
              className="network-search-results"
              role="listbox"
              aria-label="Kết quả tìm thiết bị"
            >
              {searchResults.length ? (
                searchResults.map((node) => (
                  <button
                    key={node.id}
                    role="option"
                    aria-selected={selected?.id === node.id}
                    onClick={() => inspect(node.id)}
                  >
                    <DeviceIcon
                      device={node}
                      size={32}
                      fallback={<Network size={20} />}
                    />
                    <span>
                      <strong>{node.name}</strong>
                      <small>{node.ip || node.mac || "Chưa có địa chỉ"}</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))
              ) : (
                <p>Không tìm thấy thiết bị.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="network-filter-bar">
        {provider === "mikrotik" && (
          <>
            <span className="network-fleet-count">
              {topology.nodes.filter((node) => node.meta?.managed).length ||
                topology.nodes.filter(
                  (node) => node.type === "gateway" || node.type === "switch",
                ).length}{" "}
              thiết bị MikroTik
            </span>
            <span>Chỉ MikroTik trực tuyến · Không hiển thị máy khách</span>
          </>
        )}
        {provider === "unifi" && (
          <label>
            <Wifi size={14} />
            <select
              aria-label="Chọn AP"
              value={apId}
              onChange={(e) => {
                setApId(e.target.value);
                setSelected(null);
                setFocusId(e.target.value === "all" ? "" : e.target.value);
                setFocusVersion((value) => value + 1);
                if (e.target.value !== "all") {
                  setFloor("all");
                  setStatusFilter("all");
                }
              }}
            >
              <option value="all">Toàn mạng · {accessPoints.length} AP</option>
              {accessPoints.map((ap) => (
                <option key={ap.id} value={ap.id}>
                  {ap.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {provider === "unifi" && floors.length > 0 && (
          <label>
            <Layers size={14} />
            <select
              aria-label="Lọc tầng"
              value={floor}
              onChange={(e) => {
                setFloor(e.target.value);
                setApId("all");
              }}
            >
              <option value="all">Tất cả tầng</option>
              {floors.map((value) => (
                <option key={value} value={value}>
                  Tầng {value}
                </option>
              ))}
            </select>
            {hasInferredFloor && (
              <span title="Một số tầng được suy đoán từ tên AP, chỉ dùng để lọc">
                Theo tên / metadata
              </span>
            )}
          </label>
        )}
        {provider === "unifi" && (        <select
          aria-label="Lọc trạng thái"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Mọi trạng thái</option>
          <option value="online">Trực tuyến</option>
          <option value="offline">Ngoại tuyến</option>
        </select>)}
        {provider === "unifi" && apId === "all" && accessPoints.length > 3 && <label><Layers size={14}/><select aria-label="Số AP mỗi hàng" value={columns} onChange={e=>setColumns(Number(e.target.value))}><option value={4}>4 AP / hàng</option><option value={6}>6 AP / hàng</option><option value={8}>8 AP / hàng</option></select></label>}
        {layout.edges.some(edge=>edge.data?.secondary) && <button className="network-tool-button" aria-pressed={showAdditional} onClick={()=>setShowAdditional(v=>!v)}>{showAdditional ? "Ẩn" : "Hiện"} {layout.edges.filter(edge=>edge.data?.secondary).length} liên kết bổ sung</button>}
        <div className="network-canvas-actions">
          {apIdsWithClients.size > 0 && (
            <button
              className="network-tool-button"
              onClick={() => {
                const allExpanded = Array.from(apIdsWithClients).every((id) =>
                  effectiveExpanded.has(id),
                );
                if (allExpanded) {
                  setManuallyCollapsed(new Set(apIdsWithClients));
                  setExpanded(new Set());
                } else {
                  setManuallyCollapsed(new Set());
                  setExpanded(new Set(apIdsWithClients));
                }
              }}
              disabled={view !== "diagram"}
            >
              <GitBranch size={14} />
              <span>
                {Array.from(apIdsWithClients).every((id) =>
                  effectiveExpanded.has(id),
                )
                  ? "Thu gọn máy khách"
                  : "Hiện tất cả máy khách"}
              </span>
            </button>
          )}
          <button
            className="network-tool-button"
            onClick={() => {
              const surface = canvas.current?.querySelector(".network-map-surface");
              if (flow && surface) void flow.setViewport(fitRootViewport(flow.getNodes(), flow.getViewport(), surface.clientWidth, surface.clientHeight), {duration:280});
            }}
            disabled={view !== "diagram"}
          >
            <Maximize size={14} />
            <span>Vừa khung</span>
          </button>
          <button
            className="network-tool-button network-zoom"
            aria-label="Về mức phóng 100%"
            onClick={() => {
              const v = flow?.getViewport();
              if (v)
                void flow?.setViewport(rootViewport(flow.getNodes(), { ...v, zoom: 1 }, canvas.current?.querySelector(".network-map-surface")?.clientWidth || 0), { duration: 200 });
            }}
            disabled={view !== "diagram"}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="network-tool-button"
            aria-label={
              paused
                ? "Bật chuyển động lưu lượng"
                : "Tạm dừng chuyển động lưu lượng"
            }
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            className="network-tool-button"
            aria-label="Xuất PNG"
            onClick={() => void exportPng()}
            disabled={exporting || view !== "diagram"}
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      <div
        className={`network-canvas-layout ${selected ? "has-inspector" : ""}`}
      >
        <div
          className="network-canvas-panel"
          ref={canvas}
          data-lenis-prevent
        >
          {view === "diagram" && <div className="network-monitor-banner">
            <img src="/device-icons/Banner%20Monitor.png" alt="Hệ thống giám sát WiFi — Nhà xuất bản Chính trị quốc gia Sự thật" width={2172} height={724} />
          </div>}
          {fullscreen.active && (
            <div className="network-fullscreen-tools">
              <button className="network-tool-button" aria-label="Thoát toàn màn hình" title="Thoát toàn màn hình (Esc)" onClick={() => void fullscreen.toggle()}><Minimize2 size={16} /></button>
            </div>
          )}
          {loading && !topology.nodes.length ? (
            <div role="status" className="network-empty-state">
              <div className="network-loading-skeleton" />
              <p>Đang tải kết nối thiết bị…</p>
            </div>
          ) : !topology.nodes.length ? (
            <div className="network-empty-state">
              <Network size={38} />
              <h2>{error ? "Không thể tải dữ liệu" : "Chưa có thiết bị"}</h2>
              <p>
                {error || "Chọn kết nối hoặc kiểm tra dữ liệu từ controller."}
              </p>
              <button
                className="network-tool-button"
                onClick={() => setRevision((v) => v + 1)}
              >
                Thử lại
              </button>
            </div>
          ) : view === "diagram" && !nodes.length ? (
            <div className="network-empty-state">
              <Network size={32} />
              <p>Không có thiết bị phù hợp bộ lọc.</p>
            </div>
          ) : view === "diagram" ? (
            <TrafficParticleProvider>
              <div className="network-map-surface">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={setFlow}
                onMove={(_, viewport) => setZoom(viewport.zoom)}
                defaultViewport={{ x: 24, y: 24, zoom: 1 }}
                minZoom={0.08}
                maxZoom={2}
                onNodeClick={(_, node) =>
                  setSelected({ kind: "node", id: node.id })
                }
                onEdgeClick={(_, edge) => {
                  if ((edge.data?.link as Link)?.type !== "organization")
                    setSelected({ kind: "edge", id: edge.id });
                }}
                onPaneClick={() => {
                  setSearchOpen(false);
                }}
                nodesDraggable={false}
                nodesConnectable={false}
                panOnScroll
                zoomOnScroll={false}
                onlyRenderVisibleElements={false}
                zoomOnDoubleClick={false}
                proOptions={{ hideAttribution: true }}
              >
                <NetworkViewport
                  scope={scope}
                  presentation={fullscreen.active}
                  focusId={focusId}
                  focusVersion={focusVersion}
                />
                <Background color="#e2e8f0" gap={24} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) => {
                    const device = node.data.device as Device;
                    return device?.meta?.layoutOnly
                      ? "#cbd5e1"
                      : isOffline(device?.status)
                        ? "#94a3b8"
                        : "#93c5fd";
                  }}
                />
                <TrafficParticleOverlay />
              </ReactFlow>
              </div>
            </TrafficParticleProvider>
          ) : (
            <div className="network-inventory-scroll">
              <table className="network-inventory">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th>Địa chỉ IP</th>
                    <th>Trạng thái</th>
                    <th>{provider === "mikrotik" ? "RX theo interface" : "Nhận / Tải xuống"}</th>
                    <th>{provider === "mikrotik" ? "TX theo interface" : "Gửi / Tải lên"}</th>
                    <th>Kết nối</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((device) => {
                    const traffic = trafficDirections(device.traffic);
                    const parent = topology.links.find(
                      (e) => e.target === device.id,
                    );
                    return (
                      <tr
                        key={device.id}
                        onClick={() =>
                          setSelected({ kind: "node", id: device.id })
                        }
                      >
                        <td>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected({ kind: "node", id: device.id });
                            }}
                          >
                            <DeviceIcon
                              device={device}
                              size={40}
                              fallback={<Network size={25} />}
                            />
                            <span>
                              <strong>{device.name}</strong>
                              <small>{device.mac || "—"}</small>
                            </span>
                          </button>
                        </td>
                        <td className="font-mono">{device.ip || "—"}</td>
                        <td>
                          <span
                            className={`network-status ${isOffline(device.status) ? "is-offline" : isOnline(device.status) ? "is-online" : ""}`}
                          >
                            <i />
                            {isOffline(device.status)
                              ? "Ngoại tuyến"
                              : /online|connected|running|^1$/.test(
                                    device.status || "",
                                  )
                                ? "Trực tuyến"
                                : device.status === "observed"
                                  ? "Đã ghi nhận"
                                  : "Chưa rõ"}
                          </span>
                        </td>
                        <td className="network-receive font-mono">
                          {traffic.receiveLabel.startsWith("RX") ? "RX " : ""}
                          {rate(traffic.receive)}
                        </td>
                        <td className="network-send font-mono">
                          {traffic.sendLabel.startsWith("TX") ? "TX " : ""}
                          {rate(traffic.send)}
                        </td>
                        <td>
                          {parent
                            ? deviceMap.get(parent.source)?.name || "—"
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && (
                <p className="network-empty-state">
                  Không có thiết bị phù hợp bộ lọc.
                </p>
              )}
            </div>
          )}
          {view === "diagram" && topology.nodes.length > 0 && (
            <div className="network-map-legend">
              <span className="network-receive">{provider === "mikrotik" ? "● RX theo interface" : "● Nhận / Tải xuống"}</span>
              <span className="network-send">{provider === "mikrotik" ? "● TX theo interface" : "● Gửi / Tải lên"}</span>
              <span>┄ Nhóm / liên kết logic</span>
              <span>{provider === "mikrotik" ? "Bố cục theo quan sát · chọn thiết bị để xem cổng / liên kết bổ sung" : "Kéo để di chuyển · mở nhánh để xem khách"}</span>
            </div>
          )}
        </div>
        {selected && (
          <div className="network-inspector">
            <DetailDrawer
              device={selectedDevice}
              edge={selectedEdge}
              traffic={
                selectedDevice?.traffic ||
                (selectedEdge
                  ? latestTraffic(
                      selectedEdge.traffic,
                      snapshot?.links[selectedEdge.id],
                    )
                  : undefined)
              }
              history={selectedDevice ? history[selectedDevice.id] : undefined}
              devices={devices}
              members={
                selectedDevice
                  ? layout.members.get(selectedDevice.id) ||
                    (selectedDevice.meta?.layoutOnly
                      ? layout.edges
                      : topology.links
                    )
                      .filter((e) => e.source === selectedDevice.id)
                      .flatMap((e) =>
                        deviceMap.get(e.target) ||
                        layout.nodes.find((node) => node.id === e.target)?.data
                          .device
                          ? [
                              deviceMap.get(e.target) ||
                                layout.nodes.find(
                                  (node) => node.id === e.target,
                                )!.data.device,
                            ]
                          : [],
                      )
                  : undefined
              }
              onSelect={inspect}
              onClose={close}
              observedAt={topology.observedAt}
            />
          </div>
        )}
      </div>
      <footer className="network-workspace-footer">
        <span>{provider === "mikrotik" ? "Hạ tầng MikroTik trực tuyến · Cập nhật 15 giây" : "Kết nối 15 giây · Lưu lượng 5 giây"}</span>
        <span>
          {totals?.sampledAt && clock - Date.parse(totals.sampledAt) > 30000
            ? "Lưu lượng quá hạn · đang giữ mẫu gần nhất"
            : "Số liệu theo phạm vi kết nối / site đang chọn"}
        </span>
      </footer>
    </section>
  );
}
