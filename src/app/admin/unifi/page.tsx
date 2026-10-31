"use client";
import { DeviceIcon } from '@/components/network/DeviceIcon';
import { SourceStamp } from "@/components/ui/operations";
import { networkFetch } from "@/components/network/client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/network/ScopedNetworkLink";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Globe,
  Radio,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Signal,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  formatBytes,
  formatUptime,
  getSignalColor,
} from "@/lib/network/format";

interface UnifiOverviewData {
  warnings?: string[];
  devices: Array<{
    _id: string;
    name: string;
    type: string;
    status: string;
    mac: string;
    ipAddress?: string;
    model?: string;
    uptime: number;
    userNumSta?: number;
    guestNumSta?: number;
    txBytes?: number;
    rxBytes?: number;
    cpuUsage?: number;
    memUsage?: number;
  }>;
  ssids: Array<{
    _id: string;
    name: string;
    ssid: string;
    security: string;
    enabled: boolean;
    isGuest: boolean;
  }>;
  clients: Array<{
    _id: string;
    mac: string;
    hostname?: string;
    ip?: string;
    ssid?: string;
    isGuest: boolean;
    isWired: boolean;
    signal: number;
    uptime: number;
    rxBytes: number;
    txBytes: number;
  }>;
  alerts: Array<{
    _id: string;
    key: string;
    name: string;
    message: string;
    datetime: number;
    severity: string;
  }>;
  stats?: {
    siteId?: string;
    siteName?: string;
    deviceCount?: number;
    onlineDevices?: number;
    offlineDevices?: number;
    userCount?: number;
    guestCount?: number;
    activeUsers?: number;
    totalRxBytes?: number;
    totalTxBytes?: number;
    uptime?: number;
  } | null;
  networks?: Array<{
    _id: string;
    name: string;
    purpose: string;
    numStations?: number;
  }>;
  topology?: {
    nodes: Array<{ id: string; type: string; name: string }>;
    links: Array<{ source: string; target: string; type: string }>;
    summary: {
      gateways: number;
      switches: number;
      accessPoints: number;
      networks: number;
      clients: number;
    };
  };
  charts?: {
    deviceDistribution: Array<{ label: string; value: number }>;
    signalBuckets: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
    trafficByClientType: Array<{
      label: string;
      upload: number;
      download: number;
    }>;
    stationsByNetwork: Array<{ name: string; stations: number }>;
  };
  connection: {
    controllerUrl: string;
    username: string;
    site: string;
    connected: boolean;
  };
}

const numberFormatter = new Intl.NumberFormat("vi-VN");

function formatNumber(value: number | undefined): string {
  return numberFormatter.format(Number(value || 0));
}

function MiniBarList({
  items,
  tone = "indigo",
}: {
  items: Array<{ label: string; value: number; subLabel?: string }>;
  tone?: "indigo" | "emerald" | "blue";
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const color = "bg-blue-600";

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {item.label}
              </p>
              {item.subLabel && (
                <p className="text-xs font-semibold text-slate-500">
                  {item.subLabel}
                </p>
              )}
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {formatNumber(item.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 5 : 0)}%`,
              }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="py-8 text-center text-sm font-semibold text-slate-500">
          Chưa có dữ liệu
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  sampledAt,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "indigo" | "blue" | "emerald" | "amber" | "rose";
  sampledAt?: Date | null;
}) {
  const toneMap = {
    indigo: "bg-slate-50 text-slate-600",
    blue: "bg-slate-50 text-slate-600",
    emerald: "bg-slate-50 text-slate-600",
    amber: "bg-slate-50 text-slate-600",
    rose: "bg-slate-50 text-slate-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white p-5 "
    >
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${toneMap[tone]}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
        {hint}
      </p>
      <div className="mt-2">
        <SourceStamp source="UniFi" sampledAt={sampledAt?.toISOString()} />
      </div>
    </motion.div>
  );
}

export default function UnifiDashboardPage() {
  const [data, setData] = useState<UnifiOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch("/api/unifi/overview");
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date());
      } else {
        const rawErr = json.error;
        const msg =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message ||
              (rawErr ? JSON.stringify(rawErr) : "Không thể kết nối UniFi");
        setError(msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kết nối UniFi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onlineDevices =
    data?.devices.filter((device) => ["online", "connected"].includes(device.status)).length || 0;
  const totalDevices = data?.devices.length || 0;
  const totalClients = data?.clients.length || 0;
  const wiredClients =
    data?.clients.filter((client) => client.isWired).length || 0;
  const wirelessClients =
    data?.clients.filter((client) => !client.isWired).length || 0;
  const guestClients =
    data?.clients.filter((client) => client.isGuest).length || 0;
  const activeSsids = data?.ssids.filter((ssid) => ssid.enabled).length || 0;
  const totalSsids = data?.ssids.length || 0;
  const clientsRx =
    data?.clients.reduce((sum, client) => sum + (client.rxBytes || 0), 0) || 0;
  const clientsTx =
    data?.clients.reduce((sum, client) => sum + (client.txBytes || 0), 0) || 0;
  const devicesRx =
    data?.devices.reduce((sum, device) => sum + (device.rxBytes || 0), 0) || 0;
  const devicesTx =
    data?.devices.reduce((sum, device) => sum + (device.txBytes || 0), 0) || 0;
  const totalRx = clientsRx > 0 ? clientsRx : (data?.stats?.totalRxBytes || devicesRx);
  const totalTx = clientsTx > 0 ? clientsTx : (data?.stats?.totalTxBytes || devicesTx);
  const criticalAlerts =
    data?.alerts.filter((alert) => alert.severity === "critical").length || 0;

  const deviceDistribution = useMemo(() => {
    const source = data?.charts?.deviceDistribution || [];
    if (source.length > 0)
      return source.map((item) => ({ label: item.label, value: item.value }));

    const accessPoints =
      data?.devices.filter((device) => device.type === "uap").length || 0;
    const switches =
      data?.devices.filter((device) => device.type === "usw").length || 0;
    const gateways =
      data?.devices.filter(
        (device) => device.type === "ugw" || device.type === "udm",
      ).length || 0;
    return [
      { label: "Access Point", value: accessPoints },
      { label: "Switch", value: switches },
      { label: "Gateway", value: gateways },
    ];
  }, [data]);

  const signalBuckets = data?.charts?.signalBuckets || {
    excellent:
      data?.clients.filter((client) => client.signal >= -50).length || 0,
    good:
      data?.clients.filter(
        (client) => client.signal < -50 && client.signal >= -60,
      ).length || 0,
    fair:
      data?.clients.filter(
        (client) => client.signal < -60 && client.signal >= -70,
      ).length || 0,
    poor: data?.clients.filter((client) => client.signal < -70).length || 0,
  };

  const stationsByNetwork = data?.charts?.stationsByNetwork || [];
  const topSsids = (data?.ssids || [])
    .map((ssid) => ({
      label: ssid.ssid,
      value:
        data?.clients.filter((client) => client.ssid === ssid.ssid).length || 0,
      subLabel: ssid.enabled ? "Đang bật" : "Đang tắt",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-500">
            Đang kết nối UniFi Controller...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Báo cáo UniFi
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Kết nối và quản lý trực tiếp hệ thống mạng
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-8 ">
          <div className="flex flex-col items-center text-center">
            <XCircle className="mb-4 h-16 w-16 text-rose-400" />
            <h2 className="mb-2 text-xl font-semibold text-slate-900">
              Không thể kết nối UniFi
            </h2>
            <p className="mb-5 max-w-xl text-sm font-semibold text-slate-500">
              {error}
            </p>
            <button
              onClick={fetchData}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white  transition hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-7"
    >
      {data?.warnings?.length ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          {data.warnings.join(" · ")}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Báo cáo UniFi
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
            <span>{data?.connection.controllerUrl}</span>
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Site {data?.connection.site || "default"}
            </span>
            <span>
              Cập nhật:{" "}
              {lastRefresh ? lastRefresh.toLocaleString("vi-VN") : "-"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700  transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <Link
            href="/admin/unifi/settings"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white  transition hover:bg-blue-700"
          >
            <Settings className="h-4 w-4" />
            Cấu hình
          </Link>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          sampledAt={lastRefresh}
          label="Thiết bị Online"
          value={`${onlineDevices}/${totalDevices}`}
          hint="Lấy trực tiếp từ stat/device"
          icon={Server}
          tone="indigo"
        />
        <StatCard
          sampledAt={lastRefresh}
          label="Client kết nối"
          value={formatNumber(totalClients)}
          hint={`${formatNumber(wirelessClients)} WiFi / ${formatNumber(wiredClients)} wired`}
          icon={Users}
          tone="blue"
        />
        <StatCard
          sampledAt={lastRefresh}
          label="SSID Active"
          value={`${activeSsids}/${totalSsids}`}
          hint={`${formatNumber(guestClients)} client guest`}
          icon={Radio}
          tone="emerald"
        />
        <StatCard
          sampledAt={lastRefresh}
          label="Cảnh báo"
          value={formatNumber(data?.alerts.length || 0)}
          hint={`${formatNumber(criticalAlerts)} critical`}
          icon={AlertCircle}
          tone={criticalAlerts > 0 ? "rose" : "amber"}
        />
        <StatCard
          sampledAt={lastRefresh}
          label="Tổng RX (nhận)"
          value={formatBytes(totalRx)}
          hint={clientsRx > 0 ? "UniFi · rxBytes từ client" : "UniFi · rxBytes từ phía AP"}
          icon={ArrowUpRight}
          tone="emerald"
        />
        <StatCard
          sampledAt={lastRefresh}
          label="Tổng TX (gửi)"
          value={formatBytes(totalTx)}
          hint={clientsTx > 0 ? "UniFi · txBytes từ client" : "UniFi · txBytes từ phía AP"}
          icon={ArrowDownRight}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 ">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Phân bổ thiết bị
          </h2>
          <MiniBarList items={deviceDistribution} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 ">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Chất lượng sóng
          </h2>
          <div className="space-y-3">
            {[
              {
                label: "Excellent",
                value: signalBuckets.excellent,
                color: "bg-emerald-500",
              },
              {
                label: "Good",
                value: signalBuckets.good,
                color: "bg-blue-500",
              },
              {
                label: "Fair",
                value: signalBuckets.fair,
                color: "bg-amber-500",
              },
              {
                label: "Poor",
                value: signalBuckets.poor,
                color: "bg-rose-500",
              },
            ].map((bucket) => (
              <div
                key={bucket.label}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${bucket.color}`}
                  />
                  {bucket.label}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatNumber(bucket.value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 ">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Topology tổng quan
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Gateway</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatNumber(data?.topology?.summary.gateways || 0)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Switch</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatNumber(data?.topology?.summary.switches || 0)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">AP</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatNumber(data?.topology?.summary.accessPoints || 0)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Links
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatNumber(data?.topology?.links.length || 0)}
              </p>
            </div>
          </div>
          <Link
            href="/admin/unifi/networks"
            className="mt-5 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Xem topology chi tiết
          </Link>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white ">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                Thiết bị UniFi
              </h2>
            </div>
            <Link
              href="/admin/unifi/devices"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Quản lý
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Thiết bị
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Loại
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Trạng thái
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Client
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Uptime
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.devices.slice(0, 10).map((device) => (
                  <tr
                    key={device._id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <DeviceIcon device={{ type: device.type, name: device.name || "Unnamed", meta: { provider: "unifi", model: device.model } }} size={36} fallback={<Server className="h-8 w-8 text-slate-500" />} />
                        <div><p className="text-[15px] font-semibold text-slate-900">{device.name || "Unnamed"}</p>
                        <p className="font-mono text-xs text-slate-500">{device.mac}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {device.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${["online", "connected"].includes(device.status) ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${["online", "connected"].includes(device.status) ? "bg-emerald-500" : "bg-rose-500"}`}
                        />
                        {["online", "connected"].includes(device.status) ? "Online" : device.status || "Chưa rõ"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                      {formatNumber(
                        (device.userNumSta || 0) + (device.guestNumSta || 0),
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                      {device.uptime > 0 ? formatUptime(device.uptime) : "-"}
                    </td>
                  </tr>
                ))}
                {(!data?.devices || data.devices.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm font-semibold text-slate-500"
                    >
                      Không có thiết bị
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 ">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Thao tác nhanh
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  href: "/admin/unifi/devices",
                  label: "Thiết bị",
                  icon: Server,
                  tone: "text-slate-600 bg-slate-50",
                },
                {
                  href: "/admin/unifi/clients",
                  label: "Clients",
                  icon: Users,
                  tone: "text-slate-600 bg-slate-50",
                },
                {
                  href: "/admin/unifi/ssids",
                  label: "SSID",
                  icon: Radio,
                  tone: "text-slate-600 bg-slate-50",
                },
                {
                  href: "/admin/unifi/networks",
                  label: "Mạng",
                  icon: Globe,
                  tone: "text-slate-600 bg-slate-50",
                },
                {
                  href: "/admin/unifi/firewall",
                  label: "Firewall",
                  icon: Shield,
                  tone: "text-slate-600 bg-slate-50",
                },
                {
                  href: "/admin/unifi/settings",
                  label: "Cấu hình",
                  icon: Settings,
                  tone: "text-slate-600 bg-slate-50",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-slate-100 p-4 transition hover:border-blue-100 hover:bg-slate-50"
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.label}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 ">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Cảnh báo</h2>
              {criticalAlerts > 0 && (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  {criticalAlerts} critical
                </span>
              )}
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {data?.alerts.slice(0, 5).map((alert) => (
                <div key={alert._id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex gap-3">
                    <AlertCircle
                      className={`mt-0.5 h-4 w-4 ${alert.severity === "critical" ? "text-rose-500" : alert.severity === "warning" ? "text-amber-500" : "text-blue-500"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {alert.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.alerts || data.alerts.length === 0) && (
                <div className="py-6 text-center">
                  <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-500">
                    Không có cảnh báo
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 ">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              SSID theo client
            </h2>
            <Link
              href="/admin/unifi/ssids"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Quản lý SSID
            </Link>
          </div>
          <MiniBarList items={topSsids} tone="emerald" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white ">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                Clients đang kết nối
              </h2>
            </div>
            <Link
              href="/admin/unifi/clients"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Client
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Loại
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Signal
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Tổng lưu lượng
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.clients.slice(0, 8).map((client) => (
                  <tr
                    key={client._id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <DeviceIcon device={{ type: "client", name: client.hostname || "Unknown", meta: { hostname: client.hostname } }} size={36} fallback={<Users className="h-8 w-8 text-slate-500" />} />
                        <div><p className="text-[15px] font-semibold text-slate-900">{client.hostname || "Unknown"}</p>
                        <p className="font-mono text-xs text-slate-500">{client.mac}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {client.isWired ? "Wired" : "WiFi"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-2 text-sm font-semibold ${getSignalColor(client.signal)}`}
                      >
                        <Signal className="h-4 w-4" />
                        {client.isWired || !client.signal ? "—" : `${client.signal} dBm`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                      {formatBytes(
                        (client.rxBytes || 0) + (client.txBytes || 0),
                      )}
                    </td>
                  </tr>
                ))}
                {(!data?.clients || data.clients.length === 0) && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm font-semibold text-slate-500"
                    >
                      Không có client đang kết nối
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
