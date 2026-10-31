'use client';
import { DeviceIcon } from '@/components/network/DeviceIcon';
import { networkFetch } from '@/components/network/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/network/ScopedNetworkLink';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  Wifi,
  Shield,
  Globe,
  Router,
  Users,
  Cpu,
  HardDrive,
  Power,
  SlidersHorizontal,
  Cable,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  FileText,
} from 'lucide-react';
import type { MikrotikOverview, MikrotikSystemLog } from '@/types/mikrotik';
import { formatBytes } from '@/lib/network/format';

export default function MikrotikOverviewPage() {
  const [data, setData] = useState<MikrotikOverview | null>(null);
  const [logs, setLogs] = useState<MikrotikSystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootModal, setRebootModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [resOverview, resSys] = await Promise.all([
        networkFetch('/api/mikrotik/overview'),
        networkFetch('/api/mikrotik/system').catch(() => null),
      ]);

      const jsonOverview = (await resOverview.json()) as {
        success: boolean;
        data?: MikrotikOverview;
        error?: string;
      };

      if (!jsonOverview.success || !jsonOverview.data) {
        throw new Error(jsonOverview.error || 'Không thể tải dữ liệu MikroTik');
      }

      setData(jsonOverview.data);

      if (resSys) {
        const jsonSys = await resSys.json();
        if (jsonSys.success && jsonSys.data?.logs) {
          setLogs(jsonSys.data.logs.slice(0, 10));
        }
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối MikroTik RouterOS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
    const timer = setInterval(() => void fetchOverview(), 20000);
    return () => clearInterval(timer);
  }, [fetchOverview]);

  const handleReboot = async () => {
    try {
      setIsRebooting(true);
      const res = await networkFetch('/api/mikrotik/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reboot' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Lệnh khởi động lại router đã được gửi thành công!');
        setRebootModal(false);
      } else {
        showToast('error', json.error || 'Không thể khởi động lại router');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối hệ thống');
    } finally {
      setIsRebooting(false);
    }
  };

  const stats = useMemo(() => {
    const interfaces = data?.interfaces || [];
    const runningInterfaces = interfaces.filter((item) => item.running && !item.disabled).length;
    const firewallEnabled = (data?.firewallRules || []).filter((item) => !item.disabled).length;
    const natEnabled = (data?.natRules || []).filter((item) => !item.disabled).length;
    const hotspotOnline = data?.hotspotActive.length || 0;
    const hotspotUsers = data?.hotspotUsers.length || 0;

    return {
      interfaces: interfaces.length,
      runningInterfaces,
      addresses: data?.addresses.length || 0,
      firewallEnabled,
      natEnabled,
      hotspotUsers,
      hotspotOnline,
    };
  }, [data]);

  const res = data?.resource;
  const rb = data?.routerboard;
  const ramPercent = res?.totalMemory && res?.freeMemory !== undefined
    ? Math.round(((res.totalMemory - res.freeMemory) / res.totalMemory) * 100)
    : 0;
  const hddPercent = res?.totalHddSpace && res?.freeHddSpace !== undefined
    ? Math.round(((res.totalHddSpace - res.freeHddSpace) / res.totalHddSpace) * 100)
    : 0;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Đang kết nối MikroTik RouterOS REST API...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-16">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${
              toastMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm ">
              ROS
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MikroTik RouterOS</h1>
              <p className="text-xs text-slate-500">
                {rb?.model || res?.boardName || 'Chưa có dữ liệu phần cứng'} &bull; RouterOS v{res?.version || '—'} &bull; IP:{' '}
                {data?.connection.host || '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-500 font-mono">
              Cập nhật: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => void fetchOverview()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold  transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={() => setRebootModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all"
          >
            <Power className="w-3.5 h-3.5" />
            Khởi động lại
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RouterOS Hardware & Resource Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Hardware Card */}
        <div className="bg-white text-slate-900 rounded-xl p-5 border border-slate-200  flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Hardware RouterBOARD</span>
              <DeviceIcon device={{ type: "router", name: data?.identity?.name, meta: { provider: "mikrotik", model: rb?.model || res?.boardName } }} size={56} fallback={<Router className="w-12 h-12 text-slate-500" />} />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 leading-tight">
              {rb?.model || res?.boardName || 'Chưa có dữ liệu phần cứng'}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-1">S/N: {rb?.serialNumber || '—'}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500">CPU:</span>
              <span className="font-semibold">{res?.cpuCount ?? "—"} nhân · {res?.cpuFrequency ? `${res.cpuFrequency} MHz` : "Chưa có tần số"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Uptime:</span>
              <span className="font-semibold">{res?.uptime || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Firmware:</span>
              <span className="font-semibold text-emerald-400">{rb?.currentFirmware || res?.version}</span>
            </div>
          </div>
        </div>

        {/* CPU Load Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200  flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tải CPU (Load)</span>
            <Cpu className="w-4 h-4 text-blue-500" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-slate-900">{res?.cpuLoad !== undefined ? `${res.cpuLoad}%` : "—"}</span>
            <div className="w-full h-2.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (res?.cpuLoad || 0) > 80 ? 'bg-rose-500' : (res?.cpuLoad || 0) > 50 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, res?.cpuLoad || 0)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Dữ liệu CPU do RouterOS cung cấp
          </p>
        </div>

        {/* RAM Usage Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200  flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Bộ nhớ RAM</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{res?.totalMemory && res?.freeMemory !== undefined ? `${ramPercent}%` : "—"}</span>
              <span className="text-xs text-slate-500">
                ({formatBytes((res?.totalMemory || 0) - (res?.freeMemory || 0))} / {formatBytes(res?.totalMemory || 0)})
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ramPercent)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Còn trống {formatBytes(res?.freeMemory || 0)} bộ nhớ khả dụng
          </p>
        </div>

        {/* Storage / HDD Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200  flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Bộ nhớ Flash / HDD</span>
            <HardDrive className="w-4 h-4 text-sky-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{res?.totalHddSpace && res?.freeHddSpace !== undefined ? `${hddPercent}%` : "—"}</span>
              <span className="text-xs text-slate-500">
                ({formatBytes((res?.totalHddSpace || 0) - (res?.freeHddSpace || 0))} / {formatBytes(res?.totalHddSpace || 0)})
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, hddPercent)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Còn trống {formatBytes(res?.freeHddSpace || 0)} bộ nhớ lưu trữ
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Link
          href="/admin/mikrotik/interfaces"
          className="bg-white rounded-xl border border-slate-200 p-4  hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 group-hover:text-emerald-600">
            <span className="text-[11px] font-bold uppercase">Cổng kết nối</span>
            <Cable className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.interfaces}</p>
          <span className="text-[11px] text-emerald-600 font-semibold">{stats.runningInterfaces} đang chạy</span>
        </Link>

        <Link
          href="/admin/mikrotik/ip"
          className="bg-white rounded-xl border border-slate-200 p-4  hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 group-hover:text-blue-600">
            <span className="text-[11px] font-bold uppercase">IP Addresses</span>
            <Globe className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.addresses}</p>
          <span className="text-[11px] text-slate-500">Cấu hình IP</span>
        </Link>

        <Link
          href="/admin/mikrotik/firewall"
          className="bg-white rounded-xl border border-slate-200 p-4  hover:border-rose-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 group-hover:text-rose-600">
            <span className="text-[11px] font-bold uppercase">Firewall Rules</span>
            <Shield className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.firewallEnabled}</p>
          <span className="text-[11px] text-rose-600 font-semibold">{stats.natEnabled} NAT Rules</span>
        </Link>

        <Link
          href="/admin/mikrotik/hotspot"
          className="bg-white rounded-xl border border-slate-200 p-4  hover:border-amber-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 group-hover:text-amber-600">
            <span className="text-[11px] font-bold uppercase">Hotspot Online</span>
            <Wifi className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.hotspotOnline}</p>
          <span className="text-[11px] text-slate-500">Session xác thực</span>
        </Link>

        <Link
          href="/admin/mikrotik/hotspot"
          className="bg-white rounded-xl border border-slate-200 p-4  hover:border-sky-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 group-hover:text-sky-600">
            <span className="text-[11px] font-bold uppercase">Hotspot Users</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.hotspotUsers}</p>
          <span className="text-[11px] text-slate-500">Tài khoản cục bộ</span>
        </Link>

        <Link
          href="/admin/mikrotik/queues"
          className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 group-hover:text-blue-600">
            <span className="text-[11px] font-bold uppercase">Hàng đợi QoS</span>
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-blue-600">Simple</p>
          <span className="text-[11px] text-slate-500">Giới hạn băng thông</span>
        </Link>
      </div>

      {/* Interface status from RouterOS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5  space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Trạng thái interface</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.interfaces} interface do RouterOS báo cáo
            </p>
          </div>
          <Link
            href="/admin/mikrotik/interfaces"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            Quản lý chi tiết cổng &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 xl:grid-cols-10 gap-2.5">
          {(data?.interfaces || []).map((iface) => {
            const isUp = iface.running && !iface.disabled;

            return (
              <div
                key={iface.id || iface.name}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isUp
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="font-bold font-mono text-[11px]">
                    {iface.type || 'Interface'}
                  </span>
                </div>
                <DeviceIcon device={{ type: "interface", name: iface.name, meta: { provider: "mikrotik", interfaceType: iface.type } }} size={48} className="mx-auto mb-2" fallback={<Cable className="mx-auto mb-2 h-12 w-12 text-slate-500" />} />
                <p className="text-[15px] font-medium truncate" title={iface.name}>
                  {iface.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isUp ? 'Running' : iface.disabled ? 'Disabled' : 'Link down'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Split: Interfaces Traffic & Recent RouterOS Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interfaces Traffic Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden  flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm">Lưu lượng cổng mạng hoạt động</h3>
            <Link href="/admin/mikrotik/interfaces" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Xem tất cả
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Cổng</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Tổng nhận (RX)</th>
                  <th className="px-4 py-3">Tổng gửi (TX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.interfaces || [])
                  .filter((item) => item.running && !item.disabled)
                  .slice(0, 8)
                  .map((item) => (
                    <tr key={item.id || item.name} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><DeviceIcon device={{ type: "interface", name: item.name, meta: { provider: "mikrotik", interfaceType: item.type } }} size={32} fallback={<Cable className="h-8 w-8 text-slate-500" />} /><span className="text-[15px] font-medium text-slate-800">{item.name}</span></div></td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                          RUNNING
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sky-600 font-semibold">
                        {item.rxByte != null ? formatBytes(item.rxByte) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-600 font-semibold">
                        {item.txByte != null ? formatBytes(item.txByte) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live RouterOS System Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden  flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Nhật ký hệ thống RouterOS (System Logs)</h3>
            </div>
            <Link href="/admin/mikrotik/manage" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Quản lý router
            </Link>
          </div>

          <div className="p-4 overflow-y-auto max-h-[360px] space-y-2 flex-1 font-mono text-xs">
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-emerald-700 uppercase">{log.topics}</span>
                    <span>{log.time}</span>
                  </div>
                  <p className="text-slate-800 break-words leading-relaxed">{log.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Chưa có sự kiện log mới
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reboot Confirm Modal */}
      <AnimatePresence>
        {rebootModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setRebootModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Xác nhận khởi động lại router?</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                Thao tác này sẽ gửi lệnh Reboot trực tiếp tới router MikroTik đang chọn. Toàn bộ kết nối Internet và
                Hotspot sẽ bị gián đoạn trong khoảng 45-60 giây.
              </p>

              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setRebootModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleReboot}
                  disabled={isRebooting}
                  className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold  transition-all disabled:opacity-50"
                >
                  {isRebooting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Khởi động lại ngay
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
