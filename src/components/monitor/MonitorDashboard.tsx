"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DependencyList,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Activity,
  Expand,
  Minimize2,
  AlertTriangle,
  RefreshCw,
  Database,
  Download,
  Wifi,
  Cpu,
  ShieldAlert,
  Filter,
  CheckCircle2,
  XCircle,
  Radio,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  TimeChart,
  HistorySparkline,
  IncidentChart,
  AvailabilityChart,
} from "./MonitorCharts";
import { useFullscreen } from "@/components/network/topology/useFullscreen";
import "./monitoring.css";
import { eventDataState } from "./presentation-state";
import { trafficSeries } from "./chart-format";
import { DeviceIcon } from "@/components/network/DeviceIcon";
import { useAuth } from "@/components/auth/AuthProvider";

type Target = {
  id: string;
  key: string;
  name: string;
  kind: string;
  siteId?: string;
  connectionId?: string;
  deviceId?: string;
  status: string;
  lastSeenAt?: string;
  quality: string;
  metadata: any;
  zabbixHostId?: string;
};

type Connection = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  status: string;
  isDefault: boolean;
};

function Quality({ value }: { value: string }) {
  const isOk = value === "fresh" || value === "online" || value === "connected";
  const isErr = value === "offline" || value === "unavailable" || value === "failed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isOk
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
          : isErr
            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
            : "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOk ? "bg-emerald-500" : isErr ? "bg-rose-500" : "bg-amber-500"
        }`}
      />
      {(
        {
          fresh: "Mẫu mới",
          online: "Trực tuyến",
          offline: "Ngoại tuyến",
          connected: "Đã kết nối",
          failed: "Lỗi kết nối",
          stale: "Dữ liệu cũ",
          missing: "Thiếu dữ liệu",
          unavailable: "Tạm gián đoạn",
          "source-unavailable": "Nguồn gián đoạn",
          loading: "Đang tải",
          unknown: "Chưa rõ",
        } as Record<string, string>
      )[value] ||
        value ||
        "Thiếu"}
    </span>
  );
}

function useMonitorPolling(
  load: (isCurrent: () => boolean) => Promise<void>,
  dependencies: DependencyList,
) {
  const subscription = useRef<{
    dependencies: DependencyList;
    current: boolean;
    running: boolean;
  }>({ dependencies: [], current: true, running: false });

  useEffect(() => {
    let scope = subscription.current;
    if (
      !scope ||
      scope.dependencies.length !== dependencies.length ||
      dependencies.some((value, i) => !Object.is(value, scope!.dependencies[i]))
    ) {
      scope = {
        dependencies: [...dependencies],
        current: true,
        running: false,
      };
      subscription.current = scope;
    }
    const activeScope = scope;
    activeScope.current = true;

    const poll = async () => {
      if (activeScope.running) return;
      activeScope.running = true;
      try {
        await load(
          () => activeScope.current && subscription.current === activeScope,
        );
      } finally {
        activeScope.running = false;
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 30000);
    return () => {
      activeScope.current = false;
      clearInterval(interval);
    };
  }, dependencies);
}

function mergeAlerts(data: any): any[] {
  const merged = new Map<string, any>();
  for (const event of data?.history || [])
    merged.set(String(event.eventid), event);
  for (const event of data?.problems || [])
    merged.set(String(event.eventid), {
      ...merged.get(String(event.eventid)),
      ...event,
    });
  return Array.from(merged.values()).sort(
    (a, b) => Number(b.clock) - Number(a.clock),
  );
}

function localDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "T");
}

export default function MonitorDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(dashboardRef);
  const auth = useAuth(),
    params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const tab = params.get("tab") || "overview",
    time = params.get("time") || "24h";

  const [overview, setOverview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState(""),
    [charts, setCharts] = useState<any>({}),
    [events, setEvents] = useState<any>(null),
    [logs, setLogs] = useState<any[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [logError, setLogError] = useState(""),
    [search, setSearch] = useState(params.get("search") || ""),
    [histogram, setHistogram] = useState<any>(null),
    [ackId, setAckId] = useState(""),
    [ackMessage, setAckMessage] = useState(""),
    [ackBusy, setAckBusy] = useState(false),
    [ackError, setAckError] = useState(""),
    [severityFilter, setSeverityFilter] = useState(""),
    [stateFilter, setStateFilter] = useState(""),
    [ackFilter, setAckFilter] = useState(""),
    [bucketFilter, setBucketFilter] = useState<number | null>(null),
    [responseIds, setResponseIds] = useState<string[] | null>(null),
    [deviceKindFilter, setDeviceKindFilter] = useState<string>("all"),
    [deviceSearchText, setDeviceSearchText] = useState<string>(""),
    [inspectedTargetId, setInspectedTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!ackId) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !ackBusy) {
        event.preventDefault();
        setAckId("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [ackId, ackBusy]);

  const [customOpen, setCustomOpen] = useState(time === "custom"),
    [customFrom, setCustomFrom] = useState(() =>
      localDateInput(params.get("from")),
    ),
    [customTo, setCustomTo] = useState(() => localDateInput(params.get("to"))),
    [rangeError, setRangeError] = useState("");

  const applyRange = () => {
    const start = Date.parse(
        `${customFrom}${customFrom.length === 16 ? ":00" : ""}+07:00`,
      ),
      end = Date.parse(
        `${customTo}${customTo.length === 16 ? ":00" : ""}+07:00`,
      );
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end - start < 1000 ||
      end - start > 2592000000 ||
      end > Date.now()
    ) {
      setRangeError(
        "Chọn khoảng từ 1 giây đến 30 ngày, kết thúc không quá hiện tại",
      );
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.set("time", "custom");
    q.set("from", new Date(start).toISOString());
    q.set("to", new Date(end).toISOString());
    setRangeError("");
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  const update = (key: string, value: string) => {
    const q = new URLSearchParams(params.toString());
    if (key === "time" && value !== "custom") {
      q.delete("from");
      q.delete("to");
    }
    if (key === "connectionId" || key === "siteId") q.delete("deviceId");
    if (value) q.set(key, value);
    else q.delete(key);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const q = new URLSearchParams();
    if (tab) q.set("tab", tab);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`/api/monitor/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || `Yêu cầu thất bại (${response.status})`);
      return body;
    },
    [auth.token],
  );

  const filters = useMemo(() => {
    const q = new URLSearchParams(params.toString());
    q.delete("tab");
    return q;
  }, [params]);

  useMonitorPolling(
    async (isCurrent) => {
      if (!auth.token) return;
      setBusy(true);
      try {
        const refreshParam = refresh > 0 ? "&refresh=true" : "";
        const result = await api(`overview?${filters}${refreshParam}`);
        if (isCurrent()) {
          setOverview(result.data);
          setError("");
        }
      } catch (e) {
        if (isCurrent())
          setError(e instanceof Error ? e.message : "Giám sát tạm ngừng");
      } finally {
        if (isCurrent()) setBusy(false);
      }
    },
    [api, filters, refresh, auth.token],
  );

  const targets: Target[] = overview?.targets || [];
  const allTargetsList: Target[] = overview?.allTargets || overview?.targets || [];
  const connections: Connection[] = overview?.connections || [];
  const sitesList: string[] = overview?.sites || [];

  const selectedConnectionId = params.get("connectionId") || "";
  const selectedSiteId = params.get("siteId") || "";
  const selectedDeviceId = params.get("deviceId") || "";

  // Available devices based on selected connection and site
  const availableDevices = useMemo(() => {
    return allTargetsList.filter((t) => {
      if (selectedConnectionId && t.connectionId !== selectedConnectionId)
        return false;
      if (selectedSiteId && t.siteId !== selectedSiteId) return false;
      return true;
    });
  }, [allTargetsList, selectedConnectionId, selectedSiteId]);

  const chosen =
    (targets.some((t) => t.id === selected) ? selected : "") ||
    targets.find((t) => ["router", "gateway", "ap", "host"].includes(t.kind))
      ?.id ||
    targets[0]?.id;

  const chartTargets = useMemo(
    () =>
      Array.from(
        new Set(
          [
            chosen,
            ...targets.filter((t) => t.kind === "service").map((t) => t.id),
            ...targets.map((t) => t.id),
          ].filter(Boolean),
        ),
      ).slice(0, 10),
    [chosen, targets],
  );

  useMonitorPolling(
    async (isCurrent) => {
      if (
        !chosen ||
        !auth.token ||
        !["overview", "devices", "resources"].includes(tab)
      )
        return;
      const q = new URLSearchParams(filters.toString());
      q.set("targetIds", chartTargets.join(","));
      q.set("slaTargetId", chosen);
      q.set(
        "metrics",
        "cpu.percent,memory.percent,disk.percent,rx.bytes_sec,tx.bytes_sec,clients.count,response.ms,available,uptime.seconds",
      );
      try {
        const result = await api(`metrics/batch?${q}`);
        if (isCurrent()) {
          const next: any = {};
          for (const row of Array.isArray(result.data) ? result.data : [])
            next[`${row.targetId}:${row.metric}`] = row;
          setCharts(next);
        }
      } catch (e) {
        if (isCurrent())
          setCharts((old: any) =>
            Object.fromEntries(
              Object.entries(old).map(([key, value]: any) => [
                key,
                {
                  ...value,
                  success: false,
                  quality: "stale",
                  error: e instanceof Error ? e.message : "Nguồn gián đoạn",
                },
              ]),
            ),
          );
      }
    },
    [
      chosen,
      chartTargets.join(","),
      time,
      tab,
      api,
      refresh,
      auth.token,
      filters,
    ],
  );

  useMonitorPolling(
    async (isCurrent) => {
      if (!["overview", "alerts", "devices"].includes(tab) || !auth.token)
        return;
      try {
        const result = await api(`events?${filters}`);
        if (isCurrent()) setEvents(result);
      } catch (e) {
        if (isCurrent())
          setEvents((old: any) => ({
            ...old,
            success: false,
            quality: "stale",
            error: e instanceof Error ? e.message : "Unavailable",
          }));
      }
    },
    [tab, filters, api, refresh, auth.token],
  );

  useMonitorPolling(
    async (isCurrent) => {
      if (tab !== "overview" || !auth.token) return;
      try {
        const result = await api(`events/histogram?${filters}`);
        if (isCurrent()) setHistogram(result);
      } catch (e) {
        if (isCurrent())
          setHistogram((old: any) => ({
            ...old,
            quality: "stale",
            error: e instanceof Error ? e.message : "Nguồn gián đoạn",
          }));
      }
    },
    [tab, filters, api, refresh, auth.token],
  );

  const logScope = `${tab}:${filters.toString()}`,
    currentLogScope = useRef(logScope),
    logsRunning = useRef(new Set<string>());
  currentLogScope.current = logScope;

  const loadLogs = useCallback(
    async (next?: string, isCurrent: () => boolean = () => true) => {
      if (logsRunning.current.has(logScope)) return;
      logsRunning.current.add(logScope);
      const current = () => isCurrent() && currentLogScope.current === logScope;
      try {
        const q = new URLSearchParams(filters.toString());
        if (next) q.set("cursor", next);
        const result = await api(`logs?${q}`);
        if (current()) {
          setLogs((old) => (next ? [...old, ...result.data] : result.data));
          setCursor(result.nextCursor);
          setLogError("");
        }
      } catch (e) {
        if (current())
          setLogError(
            e instanceof Error ? e.message : "Nguồn nhật ký gián đoạn",
          );
      } finally {
        logsRunning.current.delete(logScope);
      }
    },
    [api, filters, logScope],
  );

  useMonitorPolling(
    async (isCurrent) => {
      if (tab === "logs" && auth.token) await loadLogs(undefined, isCurrent);
    },
    [tab, loadLogs, refresh, auth.token],
  );

  const allEvents = useMemo(() => mergeAlerts(events?.data), [events?.data]);
  const alertEvents = allEvents.filter(
    (event) =>
      (!severityFilter ||
        (Number(event.severity) >= 4
          ? "critical"
          : Number(event.severity) >= 2
            ? "warning"
            : "info") === severityFilter) &&
      (!stateFilter ||
        (event.r_eventid && event.r_eventid !== "0" ? "resolved" : "open") ===
          stateFilter) &&
      (!ackFilter || String(event.acknowledged) === ackFilter) &&
      (!bucketFilter ||
        (Number(event.clock) * 1000 >= bucketFilter &&
          Number(event.clock) * 1000 < bucketFilter + 3600000)),
  );

  const metric = (id: string, key: string, label?: string) => ({
    ...charts[`${id}:${key}`],
    label: label || key,
  });

  const selectedTarget = targets.find((t) => t.id === chosen);
  const inspectedTarget = allTargetsList.find((t) => t.id === inspectedTargetId);
  const slaSource = metric(chosen, "available").data?.sla30d;
  const sla = slaSource?.data?.availability;
  const eventState = eventDataState(events);
  const currentEvents = allEvents.filter(
    (e) => !e.r_eventid || e.r_eventid === "0",
  );

  const acknowledge = async () => {
    if (!ackId || !ackMessage.trim()) return;
    setAckBusy(true);
    setAckError("");
    try {
      await api(`events/${ackId}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ message: ackMessage }),
      });
      setAckId("");
      setAckMessage("");
      setRefresh((v) => v + 1);
    } catch (e) {
      setAckError(
        e instanceof Error ? e.message : "Không thể xác nhận cảnh báo",
      );
    } finally {
      setAckBusy(false);
    }
  };

  const download = async () => {
    try {
      const response = await fetch(`/api/monitor/logs?${filters}&format=csv`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!response.ok) throw new Error("Không thể xuất CSV");
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "monitor-logs.csv";
      a.click();
      URL.revokeObjectURL(url);
      if (response.headers.get("X-Next-Cursor"))
        setLogError(
          "Bản xuất giới hạn 5.000 dòng. Hãy thu hẹp thời gian hoặc bộ lọc.",
        );
    } catch (e) {
      setLogError(e instanceof Error ? e.message : "Xuất thất bại");
    }
  };

  // Live telemetry counts
  const statusCounts = {
    online: targets.filter(
      (t) => t.status === "online",
    ).length,
    offline: targets.filter(
      (t) => t.status === "offline",
    ).length,
    total: targets.length,
    apCount: targets.filter((t) => t.kind === "ap").length,
    routerCount: targets.filter((t) => t.kind === "router" || t.kind === "gateway").length,
    totalClients: targets.reduce((sum, t) => {
      const c = t.metadata?.metrics?.["clients.count"];
      return typeof c === "number" ? sum + c : sum;
    }, 0),
  };

  const filteredDevicesTab = useMemo(() => {
    return targets.filter((t) => {
      if (deviceKindFilter === "router" && !["router", "gateway"].includes(t.kind))
        return false;
      if (deviceKindFilter === "ap" && t.kind !== "ap") return false;
      if (deviceKindFilter === "switch" && t.kind !== "switch") return false;
      if (deviceKindFilter === "service" && !["service", "process", "host"].includes(t.kind))
        return false;
      if (deviceKindFilter === "offline" && t.status !== "offline") return false;
      if (deviceSearchText) {
        const text = deviceSearchText.toLowerCase();
        const matchName = t.name.toLowerCase().includes(text);
        const matchIp = t.metadata?.ip?.toLowerCase().includes(text);
        const matchMac = t.metadata?.mac?.toLowerCase().includes(text);
        const matchModel = t.metadata?.model?.toLowerCase().includes(text);
        if (!matchName && !matchIp && !matchMac && !matchModel) return false;
      }
      return true;
    });
  }, [targets, deviceKindFilter, deviceSearchText]);



  return (
    <div ref={dashboardRef} className={`monitoring-dashboard ${fullscreen.active ? "is-fullscreen" : ""} space-y-4 pb-8 text-slate-800`}>
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Activity size={15} /> VẬN HÀNH HẠ TẦNG
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Giám sát Hệ thống & Bất thường
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi thiết bị, lưu lượng mạng, tài nguyên và lịch sử sự cố theo phạm vi đã chọn
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void fullscreen.toggle()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" aria-label={fullscreen.active ? "Thoát toàn màn hình" : "Toàn màn hình"}>
            {fullscreen.active ? <Minimize2 size={16} /> : <Expand size={16} />}
            {fullscreen.active ? "Thoát toàn màn hình" : "Toàn màn hình"}
          </button>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Chu kỳ cập nhật 30 giây
          </div>
          <button
            onClick={() => setRefresh((v) => v + 1)}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            Làm mới dữ liệu
          </button>
        </div>
      </header>

      {/* ERROR ALERT IF ANY */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-900"
        >
          <XCircle size={18} className="text-rose-600 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">{error}</span>. {overview ? "Dữ liệu bộ nhớ đệm gần nhất đang được duy trì." : "Chưa có dữ liệu giám sát để hiển thị."}
          </div>
        </div>
      )}

      {/* SYSTEM TELEMETRY RESILIENCE STATUS BANNER */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/20">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  Nguồn dữ liệu giám sát
                </span>
                <Quality value={overview?.collector?.quality || "unknown"} />
              </div>
              <p className="text-xs text-slate-500">
                {statusCounts.online}/{statusCounts.total} đối tượng có trạng thái trực tuyến
                {overview?.collector?.at
                  ? ` · Cập nhật lúc ${new Date(overview.collector.at).toLocaleTimeString("vi-VN", { timeZone: "Asia/Bangkok" })}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-700">{connection.name}</span>
                <Quality value={connection.status || "unknown"} />
              </div>
            ))}
            {!connections.length && <span>Chưa có kết nối trong phạm vi này</span>}

          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <nav
        className="flex gap-2 overflow-x-auto border-b border-slate-200/80 pb-px"
        aria-label="Các mục giám sát"
      >
        {[
          { key: "overview", label: "Tổng quan", icon: Activity },
          { key: "devices", label: "Thiết bị", icon: Wifi, badge: statusCounts.total },
          { key: "resources", label: "Tài nguyên", icon: Cpu },
          { key: "alerts", label: "Cảnh báo & Bất thường", icon: AlertTriangle, badge: currentEvents.length || undefined, alert: currentEvents.length > 0 },
          { key: "logs", label: "Nhật ký vận hành", icon: Database },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.key;
          return (
            <button
              key={item.key}
              aria-current={isActive ? "page" : undefined}
              onClick={() => update("tab", item.key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? "border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.alert
                      ? "bg-rose-100 text-rose-700 animate-pulse"
                      : isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* FILTER BAR - FULL API LINKED DROPDOWNS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Time range selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Khoảng thời gian
            </label>
            <select
              aria-label="Khoảng thời gian"
              value={customOpen ? "custom" : time}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setCustomOpen(true);
                } else {
                  setCustomOpen(false);
                  setRangeError("");
                  update("time", e.target.value);
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="1h">1 giờ qua</option>
              <option value="6h">6 giờ qua</option>
              <option value="24h">24 giờ qua (Mặc định)</option>
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
              <option value="custom">Tùy chọn mốc thời gian...</option>
            </select>
          </div>

          {/* Router / Connection Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Router / Kết nối
            </label>
            <select
              aria-label="Lọc kết nối"
              value={selectedConnectionId}
              onChange={(e) => {
                update("connectionId", e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Tất cả Router & Kết nối ({connections.length})</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.provider}{c.baseUrl ? ` (${c.baseUrl})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* UniFi Site Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Site UniFi
            </label>
            <select
              aria-label="Lọc site"
              value={selectedSiteId}
              onChange={(e) => {
                update("siteId", e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Tất cả Site</option>
              {sitesList.map((site) => (
                <option key={site} value={site}>
                  Site: {site}
                </option>
              ))}
            </select>
          </div>

          {/* Device Dropdown - Filtered by connection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Thiết bị cụ thể
            </label>
            <select
              aria-label="Lọc thiết bị"
              value={selectedDeviceId}
              onChange={(e) => update("deviceId", e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Tất cả thiết bị ({availableDevices.length})</option>
              {availableDevices.map((d) => (
                <option key={d.id} value={d.deviceId || d.id}>
                  [{d.kind.toUpperCase()}] {d.name} {d.metadata?.ip ? `(${d.metadata.ip})` : ""} - {d.status === "online" ? "Trực tuyến" : d.status === "offline" ? "Ngoại tuyến" : "Chưa rõ"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {customOpen && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
            <span className="font-semibold text-slate-600">Từ (UTC+7):</span>
            <input
              aria-label="Bắt đầu tùy chọn"
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
            />
            <span className="font-semibold text-slate-600">Đến (UTC+7):</span>
            <input
              aria-label="Kết thúc tùy chọn"
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
            />
            <button
              onClick={applyRange}
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white shadow-xs hover:bg-blue-700"
            >
              Áp dụng mốc
            </button>
            {rangeError && (
              <span role="alert" className="text-rose-600 font-medium">
                {rangeError}
              </span>
            )}
          </div>
        )}

        {/* Active Filters Clear Button */}
        {(selectedConnectionId || selectedSiteId || selectedDeviceId || time !== "24h") && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <Filter size={13} />
              <span>Đang áp dụng bộ lọc:</span>
              {selectedConnectionId && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  Kết nối: {connections.find((c) => c.id === selectedConnectionId)?.provider || selectedConnectionId}
                </span>
              )}
              {selectedSiteId && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  Site: {selectedSiteId}
                </span>
              )}
              {selectedDeviceId && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  Thiết bị: {availableDevices.find((d) => d.deviceId === selectedDeviceId || d.id === selectedDeviceId)?.name || selectedDeviceId}
                </span>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="font-medium text-rose-600 hover:text-rose-700 hover:underline"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TỔNG QUAN (OVERVIEW) */}
      {/* ========================================================================= */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* 4 HIGH-END KPI CARDS */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Card 1: SLA Availability */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Khả dụng SLA 30 ngày
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <CheckCircle2 size={16} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {sla?.percent != null ? `${sla.percent.toFixed(2)}%` : "—"}
                </span>
                <span className="text-xs text-slate-500">{sla?.percent != null ? "Theo mẫu khả dụng" : "Chưa có dữ liệu"}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 truncate">
                {selectedTarget?.name || "Chưa chọn đối tượng"} · {statusCounts.online} nút trực tuyến
              </p>
            </div>

            {/* Card 2: Online Devices */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Thiết bị trực tuyến
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Wifi size={16} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {statusCounts.online}
                </span>
                <span className="text-sm font-medium text-slate-500 font-mono">
                  / {statusCounts.total} Nút
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {statusCounts.total ? `${Math.round(statusCounts.online / statusCounts.total * 100)}% trực tuyến` : "Chưa có đối tượng"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {statusCounts.routerCount} router · {statusCounts.apCount} điểm truy cập
              </p>
            </div>

            {/* Card 3: WiFi Clients */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Khách WiFi kết nối
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Radio size={16} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {targets.some((t) => typeof t.metadata?.metrics?.["clients.count"] === "number") ? statusCounts.totalClients : "—"}
                </span>
                <span className="text-xs font-medium text-blue-600">Khách đang truy cập</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 truncate">
                Đồng bộ từ Hotspot MikroTik & UniFi Clients
              </p>
            </div>

            {/* Card 4: Anomalies & Alerts */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Bất thường & Cảnh báo
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    !eventState.available
                      ? "bg-slate-100 text-slate-500"
                      : currentEvents.length > 0
                      ? "bg-amber-50 text-amber-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  <ShieldAlert size={16} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {eventState.available ? currentEvents.length : "—"}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    !eventState.available ? "text-slate-500" : currentEvents.length > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {!eventState.available ? eventState.label : currentEvents.length > 0 ? "Cần lưu ý" : "Không có sự cố được trả về"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {eventState.available ? `${currentEvents.filter((e) => Number(e.severity) >= 4).length} mức cao · Sự cố trong phạm vi đã chọn` : "Trạng thái sự cố chưa xác định"}
              </p>
            </div>
          </div>

          {/* ANOMALY STATUS BAR */}
          {!eventState.available ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600" role="status">{eventState.label}. Trạng thái sự cố chưa xác định.</div>
          ) : currentEvents.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-600" size={18} />
                  <h3 className="font-semibold text-amber-950 text-sm">
                    Phát hiện {currentEvents.length} bất thường cần lưu ý
                  </h3>
                </div>
                <button
                  onClick={() => update("tab", "alerts")}
                  className="text-xs font-semibold text-amber-900 hover:underline flex items-center gap-1"
                >
                  Xem chi tiết trong mục Cảnh báo <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {currentEvents.slice(0, 4).map((event: any) => (
                  <div
                    key={event.eventid}
                    className="flex items-center justify-between rounded-xl bg-white/80 p-3 ring-1 ring-amber-600/10 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{event.name}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Thiết bị: {(event.hosts || []).map((h: any) => h.name).join(", ") || "Hệ thống"}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      Mức {event.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-xs">
              <div className="flex items-center gap-2 text-emerald-900 font-medium">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>
                  {events?.data ? "Không có sự cố đang mở trong dữ liệu được trả về." : "Chưa có dữ liệu sự cố. Đang chờ phản hồi từ nguồn giám sát."}
                </span>
              </div>
              <span className="text-emerald-700 font-semibold font-mono">
                {events?.quality === "stale" ? "Dữ liệu cũ" : "Theo bộ lọc hiện tại"}
              </span>
            </div>
          )}

          {/* TARGET SELECTOR FOR REALTIME CHARTS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Lịch sử Tài nguyên & Lưu lượng Mạng
              </h2>
              <p className="text-xs text-slate-500">
                Lịch sử theo đối tượng đã chọn; RX là nhận và TX là gửi tại giao diện thiết bị
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {selectedTarget && <DeviceIcon device={selectedTarget} size={28} />}
              <select
                aria-label="Đối tượng biểu đồ"
                value={chosen || ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setCharts({});
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
              >
                <option value="" disabled>
                  Chọn thiết bị để vẽ biểu đồ
                </option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.kind.toUpperCase()}] {t.name} {t.metadata?.ip ? `(${t.metadata.ip})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div className="grid gap-5 xl:grid-cols-2">
            <TimeChart
              title="CPU (%) · Tải vi xử lý"
              unit="%"
              series={[metric(chosen, "cpu.percent", "Tải CPU")]}
            />
            <TimeChart
              title="RAM (%) · Dung lượng bộ nhớ"
              unit="%"
              series={[metric(chosen, "memory.percent", "RAM")]}
            />
            <TimeChart
              title="Lưu lượng mạng RX / TX · Băng thông thiết bị"
              unit="bit/s"
              area
              series={["rx.bytes_sec", "tx.bytes_sec"].map((key) =>
                trafficSeries(metric(chosen, key)),
              )}
            />
            <TimeChart
              title="Số khách WiFi kết nối"
              unit="khách"
              series={[metric(chosen, "clients.count", "Số khách")]}
            />
            <TimeChart
              title="Phản hồi Dịch vụ (Độ trễ Ping / API)"
              unit="ms"
              series={targets
                .filter(
                  (t) =>
                    t.kind === "service" &&
                    (responseIds !== null
                      ? responseIds.includes(t.id)
                      : targets
                          .filter((t) => t.kind === "service")
                          .slice(0, 3)
                          .some((v) => v.id === t.id)),
                )
                .map((t) => metric(t.id, "response.ms", t.name))}
            />
            <IncidentChart
              data={histogram}
              onBucket={(at) => {
                setBucketFilter(at);
                update("tab", "alerts");
              }}
            />
          </div>

          {/* AVAILABILITY OVER TIME */}
          <AvailabilityChart
            series={chartTargets.map((id) => metric(id, "available"))}
          />

          {/* TOP 5 RANKINGS */}
          <div className="grid gap-5 xl:grid-cols-3">
            {["cpu.percent", "memory.percent", "clients.count"].map(
              (key, i) => (
                <section
                  key={key}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <h3 className="text-sm font-bold text-slate-900">
                    {
                      ["Top 5 Tải CPU cao nhất", "Top 5 Sử dụng RAM", "Top 5 AP Đông Khách Nhất"][
                        i
                      ]
                    }
                  </h3>
                  <div className="mt-3 divide-y divide-slate-100">
                    {targets
                      .filter(
                        (t) =>
                          t.status !== "source-unavailable" &&
                          (i !== 2 || t.kind === "ap") &&
                          typeof t.metadata?.metrics?.[key] === "number",
                      )
                      .sort(
                        (a, b) =>
                          b.metadata.metrics[key] - a.metadata.metrics[key],
                      )
                      .slice(0, 5)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelected(t.id)}
                          className="flex w-full items-center justify-between py-2.5 text-left text-xs transition-colors hover:bg-slate-50/80 rounded-lg px-2"
                        >
                          <DeviceIcon device={t} size={22} />
                          <span className="min-w-0 flex-1 px-2.5 font-medium text-slate-800 truncate">
                            {t.name}
                            <small className="block text-[10px] text-slate-400 font-mono">
                              {t.metadata?.ip || t.metadata?.model || "Device"}
                            </small>
                          </span>
                          <span className="font-mono font-semibold text-slate-900">
                            {t.metadata.metrics[key].toLocaleString("vi-VN", {
                              maximumFractionDigits: 1,
                            })}
                            {i < 2 ? "%" : " khách"}
                          </span>
                        </button>
                      ))}
                  </div>
                  <p className="mt-3 text-[11px] text-slate-400">
                    Đo lường thời gian thực từ collector
                  </p>
                </section>
              ),
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: THIẾT BỊ (DEVICES) */}
      {/* ========================================================================= */}
      {tab === "devices" && (
        <div className="space-y-6">
          {/* FLEET COUNTERS */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tổng Thiết Bị
              </span>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
                {targets.length}
              </div>
              <p className="mt-1 text-xs text-slate-500">Toàn bộ hạ tầng mạng</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Router MikroTik Core
              </span>
              <div className="mt-2 text-2xl font-bold font-mono text-blue-600">
                {targets.filter((t) => ["router", "gateway"].includes(t.kind)).length}
              </div>
              <p className="mt-1 text-xs text-slate-500">Router / gateway trong phạm vi</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Access Point UniFi
              </span>
              <div className="mt-2 text-2xl font-bold font-mono text-blue-600">
                {targets.filter((t) => t.kind === "ap").length}
              </div>
              <p className="mt-1 text-xs text-slate-500">Điểm truy cập trong phạm vi</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Đang Hoạt Động
              </span>
              <div className="mt-2 text-2xl font-bold font-mono text-emerald-600">
                {statusCounts.online}
              </div>
              <p className="mt-1 text-xs text-slate-500">Trạng thái do nguồn cung cấp</p>
            </div>
          </div>

          {/* FILTER CONTROLS FOR DEVICES */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: `Tất cả (${targets.length})` },
                { id: "router", label: "Router MikroTik" },
                { id: "ap", label: "Điểm truy cập AP UniFi" },
                { id: "switch", label: "Switch" },
                { id: "service", label: "Máy chủ / Dịch vụ" },
                { id: "offline", label: "Ngoại tuyến" },
              ].map((k) => (
                <button
                  key={k.id}
                  onClick={() => setDeviceKindFilter(k.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    deviceKindFilter === k.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-60">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                aria-label="Tìm thiết bị"
                placeholder="Tìm tên, IP, MAC hoặc model..."
                value={deviceSearchText}
                onChange={(e) => setDeviceSearchText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* DEVICE GRID */}
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredDevicesTab.map((t) => {
              const cpu = t.metadata?.metrics?.["cpu.percent"];
              const mem = t.metadata?.metrics?.["memory.percent"];
              const clients = t.metadata?.metrics?.["clients.count"];
              const uptime = t.metadata?.metrics?.["uptime.seconds"];
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelected(t.id);
                    setInspectedTargetId(t.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(t.id); setInspectedTargetId(t.id); } }}
                  className={`group cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md ring-1 ring-slate-900/5 ${
                    chosen === t.id
                      ? "border-blue-500 bg-blue-50/20"
                      : "border-slate-200/80 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        <DeviceIcon device={t} size={52} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                          {t.name}
                        </h4>
                        <span className="inline-block font-mono text-[11px] text-slate-500">
                          {t.metadata?.ip || t.metadata?.model || t.kind}
                        </span>
                      </div>
                    </div>
                    <Quality value={t.status === "online" ? "online" : t.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px]">Tải CPU</span>
                      <div className="mt-1 flex items-center gap-2 font-mono font-medium text-slate-800">
                        <span>{typeof cpu === "number" ? `${cpu.toFixed(1)}%` : "—"}</span>
                        {typeof cpu === "number" && (
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cpu > 80 ? "bg-rose-500" : "bg-blue-600"}`}
                              style={{ width: `${Math.min(100, cpu)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px]">Bộ nhớ RAM</span>
                      <div className="mt-1 flex items-center gap-2 font-mono font-medium text-slate-800">
                        <span>{typeof mem === "number" ? `${mem.toFixed(1)}%` : "—"}</span>
                        {typeof mem === "number" && (
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${Math.min(100, mem)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px]">Khách kết nối</span>
                      <p className="mt-0.5 font-mono font-medium text-slate-800">
                        {typeof clients === "number" ? `${clients} khách` : "—"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px]">Thời gian chạy</span>
                      <p className="mt-0.5 font-mono font-medium text-slate-800">
                        {typeof uptime === "number"
                          ? `${Math.floor(uptime / 3600)} giờ`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                    <span>Nguồn: {t.metadata?.provider || t.metadata?.source || "Chưa rõ"}</span>
                    <span className="text-blue-600 font-medium group-hover:underline flex items-center gap-0.5">
                      Xem chi tiết <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!filteredDevicesTab.length && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Không có thiết bị phù hợp với bộ lọc hiện tại.</p>}

          {/* INSPECTION DRAWER/MODAL IF SELECTED */}
          {inspectedTarget && (
            <DeviceDetails
              target={inspectedTarget}
              onClose={() => setInspectedTargetId(null)}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TÀI NGUYÊN (RESOURCES) */}
      {/* ========================================================================= */}
      {tab === "resources" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[["cpu.percent", "Tải CPU"], ["memory.percent", "Bộ nhớ RAM"], ["disk.percent", "Ổ đĩa"]].map(([key, label]) => {
              const value = selectedTarget?.metadata?.metrics?.[key];
              return (
                <section key={key} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-medium text-slate-600">{label}</p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{typeof value === "number" ? `${value.toFixed(1)}%` : "—"}</p>
                  <p className="mt-2 text-xs text-slate-500">{selectedTarget?.name || "Chưa chọn đối tượng"}{typeof value !== "number" ? " · Chưa có mẫu" : ""}</p>
                </section>
              );
            })}
          </div>

          {/* RESOURCE CHARTS */}
          <div className="grid gap-5 xl:grid-cols-2">
            <TimeChart
              title="CPU (%) · Tiến trình thiết bị"
              unit="%"
              series={[metric(chosen, "cpu.percent", "Tải CPU")]}
            />
            <TimeChart
              title="RAM (%) · Bộ nhớ RAM"
              unit="%"
              series={[metric(chosen, "memory.percent", "RAM")]}
            />
            <TimeChart
              title="Ổ đĩa (%) · Dung lượng lưu trữ"
              unit="%"
              series={[metric(chosen, "disk.percent", "Ổ đĩa")]}
            />
            <TimeChart
              title="Lưu lượng mạng RX/TX (Bit/s)"
              unit="bit/s"
              area
              series={["rx.bytes_sec", "tx.bytes_sec"].map((key) =>
                trafficSeries(metric(chosen, key)),
              )}
            />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Dịch vụ trong phạm vi</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {targets.filter((t) => ["service", "process", "host"].includes(t.kind)).map((target) => (
                <div key={target.id} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center gap-3"><DeviceIcon device={target} size={36} /><span className="text-sm font-medium">{target.name}</span></div>
                  <Quality value={target.status || "unknown"} />
                </div>
              ))}
              {!targets.some((t) => ["service", "process", "host"].includes(t.kind)) && <p className="text-sm text-slate-500">Nguồn chưa cung cấp đối tượng dịch vụ trong phạm vi này.</p>}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CẢNH BÁO & BẤT THƯỜNG (ALERTS) */}
      {/* ========================================================================= */}
      {tab === "alerts" && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Trung tâm Giám sát Sự cố & Bất thường
              </h2>
              <p className="text-xs text-slate-500">
                Phát hiện bất thường mất kết nối, quá tải CPU/RAM và sự kiện vận hành hệ thống
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Quality value={events?.quality || "unknown"} />
            </div>
          </div>

          {events?.error && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {events.error}. {events.data ? "Cảnh báo đã lưu có thể đã cũ." : "Chưa có dữ liệu cảnh báo để hiển thị."}
            </p>
          )}

          {/* FILTER BAR FOR ALERTS */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Mức độ cảnh báo"
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">Tất cả mức độ</option>
              <option value="critical">🔴 Nghiêm trọng (Mức 4-5)</option>
              <option value="warning">🟡 Cảnh báo (Mức 2-3)</option>
              <option value="info">🔵 Thông tin (Mức 1)</option>
            </select>

            <select
              aria-label="Trạng thái cảnh báo"
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="open">Đang mở (Chưa phục hồi)</option>
              <option value="resolved">Đã phục hồi</option>
            </select>

            <select
              aria-label="Xác nhận cảnh báo"
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden"
              value={ackFilter}
              onChange={(e) => setAckFilter(e.target.value)}
            >
              <option value="">Tất cả xác nhận</option>
              <option value="1">Đã xác nhận</option>
              <option value="0">Chưa xác nhận</option>
            </select>

            {bucketFilter && (
              <button
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                onClick={() => setBucketFilter(null)}
              >
                Bỏ lọc theo khung giờ ✕
              </button>
            )}
          </div>

          {/* ALERTS LIST */}
          <div className="divide-y divide-slate-100">
            {alertEvents.map((event: any) => {
              const isResolved = event.r_eventid && event.r_eventid !== "0";
              const isHigh = Number(event.severity) >= 4;
              return (
                <div
                  key={event.eventid}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isHigh
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isHigh ? "Nghiêm trọng" : "Cảnh báo"}
                      </span>
                      <p className="font-semibold text-slate-900 text-sm">
                        {event.name}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      Thiết bị: {(event.hosts || []).map((h: any) => h.name || h.host).join(", ") || "Hệ thống"} ·{" "}
                      {new Date(Number(event.clock) * 1000).toLocaleString("vi-VN", {
                        timeZone: "Asia/Bangkok",
                      })} · {isResolved ? "🟢 Đã phục hồi" : "🔴 Đang diễn ra"}
                    </p>
                  </div>

                  {event.acknowledged === "1" && (
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Đã xác nhận</span>
                  )}
                  {auth.canOperate && event.acknowledged !== "1" && (
                    <button
                      onClick={() => {
                        setAckId(event.eventid);
                        setAckMessage("");
                        setAckError("");
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      Xác nhận xử lý
                    </button>
                  )}
                </div>
              );
            })}

            {!eventState.available && <p className="py-8 text-center text-sm text-slate-500" role="status">{eventState.label}</p>}
            {eventState.available && !alertEvents.length && (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  Không có cảnh báo hoặc bất thường nào trong khoảng thời gian này
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Kết quả phụ thuộc phạm vi lọc và dữ liệu nguồn trả về.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: NHẬT KÝ (LOGS) */}
      {/* ========================================================================= */}
      {tab === "logs" && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Nhật ký Vận hành Hệ thống
              </h2>
              <p className="text-xs text-slate-500">
                Tra cứu sự kiện truy cập, lỗi dịch vụ, cảnh báo mạng và kiểm toán hành động
              </p>
            </div>
            <button
              onClick={() => void download()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-all"
            >
              <Download size={14} /> Xuất file CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-52">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                aria-label="Tìm nhật ký"
                placeholder="Tìm kiếm nội dung thông báo nhật ký..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") update("search", search);
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>
            <button
              onClick={() => update("search", search)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Tìm kiếm
            </button>
            <select
              aria-label="Nguồn nhật ký"
              value={params.get("source") || ""}
              onChange={(e) => update("source", e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800"
            >
              <option value="">Tất cả nguồn</option>
              {["collector", "backend", "frontend", "syslog", "application"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Mức độ nhật ký"
              value={params.get("severity") || ""}
              onChange={(e) => update("severity", e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800"
            >
              <option value="">Tất cả mức độ</option>
              {["debug", "info", "notice", "warning", "error", "critical"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {logError && (
            <p role="alert" className="text-xs text-rose-600 font-medium">
              {logError}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Nguồn</th>
                  <th className="p-3">Mức độ</th>
                  <th className="p-3">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((row) => {
                  const isErr = row.severity === "error" || row.severity === "critical";
                  const isWarn = row.severity === "warning";
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="whitespace-nowrap p-3 font-mono text-slate-500">
                        {new Date(row.occurredAt).toLocaleString("vi-VN", {
                          timeZone: "Asia/Bangkok",
                        })}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5">
                          {row.source}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold text-[10px] ${
                            isErr
                              ? "bg-rose-100 text-rose-800"
                              : isWarn
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td className="max-w-xl break-words p-3 font-mono text-[11px] text-slate-800">
                        {row.message}
                      </td>
                    </tr>
                  );
                })}
                {!logs.length && !logError && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      Không có bản ghi nhật ký phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {cursor && (
            <button
              onClick={() => void loadLogs(cursor)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tải thêm bản ghi cũ hơn
            </button>
          )}
        </section>
      )}

      {/* ACKNOWLEDGE MODAL */}
      {ackId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
          onClick={() => !ackBusy && setAckId("")}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="ack-heading"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void acknowledge();
            }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id="ack-heading" className="text-base font-bold text-slate-900">
              Xác nhận Xử lý Cảnh báo
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Ghi chú xác nhận sẽ được lưu vào cơ sở dữ liệu và nhật ký kiểm toán vận hành.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">
              Ghi chú của người vận hành:
              <textarea
                autoFocus
                required
                maxLength={2000}
                placeholder="Ví dụ: Đã kiểm tra cáp uplink, thiết bị đã khởi động lại bình thường..."
                value={ackMessage}
                onChange={(e) => setAckMessage(e.target.value)}
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </label>
            {ackError && (
              <p role="alert" className="mt-2 text-xs text-rose-600 font-medium">
                {ackError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={ackBusy}
                onClick={() => setAckId("")}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                disabled={ackBusy || !ackMessage.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {ackBusy ? "Đang lưu..." : "Lưu xác nhận"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DeviceDetails({
  target,
  onClose,
}: {
  target?: Target;
  onClose?: () => void;
}) {
  if (!target) return null;
  const metadata = target.metadata || {};
  const groups = [
    {
      key: "interfaces",
      title: "Giao diện mạng",
      columns: [
        ["name", "Tên"],
        ["type", "Loại"],
        ["running", "Đang chạy"],
      ],
    },
    {
      key: "ports",
      title: "Cổng mạng / PoE",
      columns: [
        ["name", "Cổng"],
        ["port_idx", "Số cổng"],
        ["up", "Liên kết"],
        ["speed", "Tốc độ"],
        ["poe_power", "PoE W"],
        ["rx_bytes", "RX byte"],
        ["tx_bytes", "TX byte"],
      ],
    },
    {
      key: "radios",
      title: "Băng tần Radio 2.4GHz & 5GHz",
      columns: [
        ["name", "Tên Radio"],
        ["radio", "Băng tần"],
        ["channel", "Kênh phát"],
        ["tx_power", "Công suất phát"],
        ["cu_total", "Sử dụng %"],
      ],
    },
    {
      key: "clients",
      title: "Danh sách Thiết bị Khách Đang Kết Nối",
      columns: [
        ["hostname", "Tên khách"],
        ["mac", "Địa chỉ MAC"],
        ["ssid", "SSID WiFi"],
        ["signal", "Tín hiệu (dBm)"],
        ["channel", "Kênh"],
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <DeviceIcon device={target} size={36} />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {target.name} · Chi tiết Kỹ thuật
              </h3>
              <p className="font-mono text-xs text-slate-500">
                Model: {metadata.model || "Chưa có model"} · IP: {metadata.ip || "Chưa có IP"} · Phiên bản: {metadata.version || "Chưa có phiên bản"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Quality value={target.quality || "unknown"} />
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng ✕
              </button>
            )}
          </div>
        </div>

        {groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {group.title}
            </h4>
            {Array.isArray(metadata[group.key]) && metadata[group.key].length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      {group.columns.map(([key, label]) => (
                        <th className="p-2.5" key={key}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metadata[group.key].slice(0, 100).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        {group.columns.map(([key]) => (
                          <td className="p-2.5 font-mono text-[11px]" key={key}>
                            {typeof row[key] === "boolean"
                              ? row[key]
                                ? "🟢 Có"
                                : "🔴 Không"
                              : typeof row[key] === "number" || typeof row[key] === "string"
                                ? String(row[key])
                                : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Chưa có dữ liệu chi tiết cho mục này từ thiết bị.
              </p>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span>Nguồn cung cấp: {metadata.provider || metadata.source || "Chưa rõ"}</span>
          <span>
            {target.lastSeenAt
              ? `Mẫu gần nhất: ${new Date(target.lastSeenAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}`
              : ""}
          </span>
        </div>
      </section>
    </div>
  );
}
