'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { formatBytes, formatUptime, getSignalColor } from '@/lib/unifi';

interface UnifiOverviewData {
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
    trafficByClientType: Array<{ label: string; upload: number; download: number }>;
    stationsByNetwork: Array<{ name: string; stations: number }>;
  };
  connection: {
    controllerUrl: string;
    username: string;
    site: string;
    connected: boolean;
  };
}

const numberFormatter = new Intl.NumberFormat('vi-VN');

function formatNumber(value: number | undefined): string {
  return numberFormatter.format(Number(value || 0));
}

function MiniBarList({
  items,
  tone = 'indigo',
}: {
  items: Array<{ label: string; value: number; subLabel?: string }>;
  tone?: 'indigo' | 'emerald' | 'blue';
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const color = tone === 'emerald' ? 'bg-emerald-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-indigo-500';

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{item.label}</p>
              {item.subLabel && <p className="text-xs font-semibold text-slate-400">{item.subLabel}</p>}
            </div>
            <span className="text-sm font-extrabold text-slate-900">{formatNumber(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 5 : 0)}%` }} />
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="py-8 text-center text-sm font-semibold text-slate-400">Chưa có dữ liệu</p>
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
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const toneMap = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60"
    >
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${toneMap[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-3xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-400">{hint}</p>
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
      const res = await fetch('/api/unifi/overview');
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date());
      } else {
        const rawErr = json.error;
        const msg = typeof rawErr === 'string' ? rawErr : (rawErr?.message || (rawErr ? JSON.stringify(rawErr) : 'Không thể kết nối UniFi'));
        setError(msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối UniFi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onlineDevices = data?.devices.filter((device) => device.status === 'online').length || 0;
  const totalDevices = data?.devices.length || 0;
  const totalClients = data?.clients.length || 0;
  const wiredClients = data?.clients.filter((client) => client.isWired).length || 0;
  const wirelessClients = data?.clients.filter((client) => !client.isWired).length || 0;
  const guestClients = data?.clients.filter((client) => client.isGuest).length || 0;
  const activeSsids = data?.ssids.filter((ssid) => ssid.enabled).length || 0;
  const totalSsids = data?.ssids.length || 0;
  const totalRx = data?.clients.reduce((sum, client) => sum + (client.rxBytes || 0), 0) || 0;
  const totalTx = data?.clients.reduce((sum, client) => sum + (client.txBytes || 0), 0) || 0;
  const criticalAlerts = data?.alerts.filter((alert) => alert.severity === 'critical').length || 0;

  const deviceDistribution = useMemo(() => {
    const source = data?.charts?.deviceDistribution || [];
    if (source.length > 0) return source.map((item) => ({ label: item.label, value: item.value }));

    const accessPoints = data?.devices.filter((device) => device.type === 'uap').length || 0;
    const switches = data?.devices.filter((device) => device.type === 'usw').length || 0;
    const gateways = data?.devices.filter((device) => device.type === 'ugw' || device.type === 'udm').length || 0;
    return [
      { label: 'Access Point', value: accessPoints },
      { label: 'Switch', value: switches },
      { label: 'Gateway', value: gateways },
    ];
  }, [data]);

  const signalBuckets = data?.charts?.signalBuckets || {
    excellent: data?.clients.filter((client) => client.signal >= -50).length || 0,
    good: data?.clients.filter((client) => client.signal < -50 && client.signal >= -60).length || 0,
    fair: data?.clients.filter((client) => client.signal < -60 && client.signal >= -70).length || 0,
    poor: data?.clients.filter((client) => client.signal < -70).length || 0,
  };

  const stationsByNetwork = data?.charts?.stationsByNetwork || [];
  const topSsids = (data?.ssids || [])
    .map((ssid) => ({
      label: ssid.ssid,
      value: data?.clients.filter((client) => client.ssid === ssid.ssid).length || 0,
      subLabel: ssid.enabled ? 'Đang bật' : 'Đang tắt',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-500">Đang kết nối UniFi Controller...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Báo cáo UniFi</h1>
          <p className="mt-2 text-sm font-semibold text-slate-400">Kết nối và quản lý trực tiếp hệ thống mạng</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-8 shadow-sm shadow-slate-200/60">
          <div className="flex flex-col items-center text-center">
            <XCircle className="mb-4 h-16 w-16 text-rose-400" />
            <h2 className="mb-2 text-xl font-extrabold text-slate-900">Không thể kết nối UniFi</h2>
            <p className="mb-5 max-w-xl text-sm font-semibold text-slate-500">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
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
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Báo cáo UniFi</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-400">
            <span>{data?.connection.controllerUrl}</span>
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Site {data?.connection.site || 'default'}
            </span>
            <span>Cập nhật: {lastRefresh ? lastRefresh.toLocaleString('vi-VN') : '-'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <Link
            href="/admin/unifi/settings"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
          >
            <Settings className="h-4 w-4" />
            Cấu hình
          </Link>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Thiết bị Online" value={`${onlineDevices}/${totalDevices}`} hint="Lấy trực tiếp từ stat/device" icon={Server} tone="indigo" />
        <StatCard label="Client kết nối" value={formatNumber(totalClients)} hint={`${formatNumber(wirelessClients)} WiFi / ${formatNumber(wiredClients)} wired`} icon={Users} tone="blue" />
        <StatCard label="SSID Active" value={`${activeSsids}/${totalSsids}`} hint={`${formatNumber(guestClients)} client guest`} icon={Radio} tone="emerald" />
        <StatCard label="Cảnh báo" value={formatNumber(data?.alerts.length || 0)} hint={`${formatNumber(criticalAlerts)} critical`} icon={AlertCircle} tone={criticalAlerts > 0 ? 'rose' : 'amber'} />
        <StatCard label="Upload" value={formatBytes(totalTx)} hint="Tổng txBytes clients" icon={ArrowUpRight} tone="emerald" />
        <StatCard label="Download" value={formatBytes(totalRx)} hint="Tổng rxBytes clients" icon={ArrowDownRight} tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60">
          <h2 className="mb-5 text-lg font-extrabold text-slate-900">Phân bổ thiết bị</h2>
          <MiniBarList items={deviceDistribution} />
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60">
          <h2 className="mb-5 text-lg font-extrabold text-slate-900">Chất lượng sóng</h2>
          <div className="space-y-3">
            {[
              { label: 'Excellent', value: signalBuckets.excellent, color: 'bg-emerald-500' },
              { label: 'Good', value: signalBuckets.good, color: 'bg-blue-500' },
              { label: 'Fair', value: signalBuckets.fair, color: 'bg-amber-500' },
              { label: 'Poor', value: signalBuckets.poor, color: 'bg-rose-500' },
            ].map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${bucket.color}`} />
                  {bucket.label}
                </span>
                <span className="text-sm font-extrabold text-slate-900">{formatNumber(bucket.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60">
          <h2 className="mb-5 text-lg font-extrabold text-slate-900">Topology tổng quan</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase text-indigo-500">Gateway</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatNumber(data?.topology?.summary.gateways || 0)}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase text-blue-500">Switch</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatNumber(data?.topology?.summary.switches || 0)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase text-emerald-500">AP</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatNumber(data?.topology?.summary.accessPoints || 0)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Links</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatNumber(data?.topology?.links.length || 0)}</p>
            </div>
          </div>
          <Link href="/admin/unifi/networks" className="mt-5 inline-flex text-sm font-bold text-indigo-600 hover:text-indigo-700">
            Xem topology chi tiết
          </Link>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-extrabold text-slate-900">Thiết bị UniFi</h2>
            </div>
            <Link href="/admin/unifi/devices" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Quản lý</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Thiết bị</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Loại</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Trạng thái</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.devices.slice(0, 10).map((device) => (
                  <tr key={device._id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-900">{device.name || 'Unnamed'}</p>
                      <p className="font-mono text-xs font-semibold text-slate-400">{device.mac}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{device.type.toUpperCase()}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${device.status === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {device.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatNumber((device.userNumSta || 0) + (device.guestNumSta || 0))}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-500">{device.uptime > 0 ? formatUptime(device.uptime) : '-'}</td>
                  </tr>
                ))}
                {(!data?.devices || data.devices.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">Không có thiết bị</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">Thao tác nhanh</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/admin/unifi/devices', label: 'Thiết bị', icon: Server, tone: 'text-indigo-600 bg-indigo-50' },
                { href: '/admin/unifi/clients', label: 'Clients', icon: Users, tone: 'text-blue-600 bg-blue-50' },
                { href: '/admin/unifi/ssids', label: 'SSID', icon: Radio, tone: 'text-emerald-600 bg-emerald-50' },
                { href: '/admin/unifi/networks', label: 'Mạng', icon: Globe, tone: 'text-amber-600 bg-amber-50' },
                { href: '/admin/unifi/firewall', label: 'Firewall', icon: Shield, tone: 'text-rose-600 bg-rose-50' },
                { href: '/admin/unifi/settings', label: 'Cấu hình', icon: Settings, tone: 'text-slate-600 bg-slate-50' },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="rounded-xl border border-slate-100 p-4 transition hover:border-indigo-100 hover:bg-slate-50">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{item.label}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">Cảnh báo</h2>
              {criticalAlerts > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{criticalAlerts} critical</span>}
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {data?.alerts.slice(0, 5).map((alert) => (
                <div key={alert._id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex gap-3">
                    <AlertCircle className={`mt-0.5 h-4 w-4 ${alert.severity === 'critical' ? 'text-rose-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{alert.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.alerts || data.alerts.length === 0) && (
                <div className="py-6 text-center">
                  <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-500">Không có cảnh báo</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">SSID theo client</h2>
            <Link href="/admin/unifi/ssids" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Quản lý SSID</Link>
          </div>
          <MiniBarList items={topSsids} tone="emerald" />
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-extrabold text-slate-900">Clients đang kết nối</h2>
            </div>
            <Link href="/admin/unifi/clients" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Xem tất cả</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Loại</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Signal</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.clients.slice(0, 8).map((client) => (
                  <tr key={client._id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-900">{client.hostname || 'Unknown'}</p>
                      <p className="font-mono text-xs font-semibold text-slate-400">{client.mac}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{client.isWired ? 'Wired' : 'WiFi'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 text-sm font-bold ${getSignalColor(client.signal)}`}>
                        <Signal className="h-4 w-4" />
                        {client.signal} dBm
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatBytes((client.rxBytes || 0) + (client.txBytes || 0))}</td>
                  </tr>
                ))}
                {(!data?.clients || data.clients.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">Không có client đang kết nối</td>
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
