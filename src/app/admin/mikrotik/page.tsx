'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  Wifi,
  Network,
  Shield,
  Globe,
  Router,
  Users,
} from 'lucide-react';
import type { MikrotikOverview } from '@/types/mikrotik';

function formatBytes(value?: number): string {
  if (!value || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const normalized = value / 1024 ** index;
  return `${normalized.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export default function MikrotikOverviewPage() {
  const [data, setData] = useState<MikrotikOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/mikrotik/overview');
      const json = (await res.json()) as { success: boolean; data?: MikrotikOverview; error?: string };

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải dữ liệu MikroTik');
      }

      setData(json.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối MikroTik');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
    const timer = setInterval(() => void fetchOverview(), 30000);
    return () => clearInterval(timer);
  }, [fetchOverview]);

  const stats = useMemo(() => {
    const interfaces = data?.interfaces || [];
    const runningInterfaces = interfaces.filter((item) => item.running && !item.disabled).length;
    const firewallEnabled = (data?.firewallRules || []).filter((item) => !item.disabled).length;
    const hotspotOnline = data?.hotspotActive.length || 0;

    return {
      interfaces: interfaces.length,
      runningInterfaces,
      addresses: data?.addresses.length || 0,
      firewallEnabled,
      hotspotUsers: data?.hotspotUsers.length || 0,
      hotspotOnline,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">MikroTik Router</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data?.connection.host || '192.168.1.200'} - {data?.identity?.name || 'RouterOS'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400">Cập nhật: {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => void fetchOverview()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Interfaces" value={stats.interfaces} icon={Network} color="text-sky-600" bg="bg-sky-50" />
        <StatCard label="Đang chạy" value={stats.runningInterfaces} icon={Activity} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="IP Address" value={stats.addresses} icon={Globe} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Firewall Rule" value={stats.firewallEnabled} icon={Shield} color="text-rose-600" bg="bg-rose-50" />
        <StatCard label="Hotspot User" value={stats.hotspotUsers} icon={Users} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Online" value={stats.hotspotOnline} icon={Wifi} color="text-violet-600" bg="bg-violet-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Interface traffic</h2>
            <Link href="/admin/mikrotik/interfaces" className="text-sm text-emerald-600 hover:text-emerald-700">
              Quản lý interfaces
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">RX</th>
                  <th className="px-5 py-3">TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.interfaces || []).slice(0, 8).map((item) => (
                  <tr key={item.id || item.name} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{item.type || '-'}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.running && !item.disabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {item.running && !item.disabled ? 'RUNNING' : item.disabled ? 'DISABLED' : 'DOWN'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatBytes(item.rxByte)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatBytes(item.txByte)}</td>
                  </tr>
                ))}
                {(data?.interfaces.length || 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">
                      Không có dữ liệu interface
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">System</h2>
            <div className="space-y-2 text-sm">
              <InfoLine label="Router" value={data?.identity?.name || '-'} />
              <InfoLine label="Version" value={data?.resource?.version || '-'} />
              <InfoLine label="Uptime" value={data?.resource?.uptime || '-'} />
              <InfoLine label="CPU Load" value={data?.resource?.cpuLoad !== undefined ? `${data.resource.cpuLoad}%` : '-'} />
              <InfoLine
                label="Memory"
                value={
                  data?.resource?.freeMemory !== undefined && data.resource.totalMemory !== undefined
                    ? `${formatBytes(data.resource.freeMemory)} / ${formatBytes(data.resource.totalMemory)}`
                    : '-'
                }
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Quản lý nhanh</h2>
            <div className="grid grid-cols-2 gap-3">
              <QuickLink href="/admin/mikrotik/interfaces" label="Interfaces" icon={Network} />
              <QuickLink href="/admin/mikrotik/ip" label="IP & DHCP" icon={Globe} />
              <QuickLink href="/admin/mikrotik/firewall" label="Firewall" icon={Shield} />
              <QuickLink href="/admin/mikrotik/hotspot" label="Hotspot" icon={Router} />
              <QuickLink href="/admin/mikrotik/raw" label="Raw API" icon={Activity} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-sm font-medium text-slate-700 flex items-center gap-2">
      <Icon className="w-4 h-4 text-emerald-600" />
      <span>{label}</span>
    </Link>
  );
}
