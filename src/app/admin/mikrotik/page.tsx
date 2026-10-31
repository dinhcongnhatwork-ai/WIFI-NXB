'use client';
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
  const ramPercent = res?.totalMemory && res?.freeMemory
    ? Math.round(((res.totalMemory - res.freeMemory) / res.totalMemory) * 100)
    : 0;
  const hddPercent = res?.totalHddSpace && res?.freeHddSpace
    ? Math.round(((res.totalHddSpace - res.freeHddSpace) / res.totalHddSpace) * 100)
    : 0;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 backdrop-blur-md'
                : 'bg-rose-950/90 text-rose-200 border-rose-500/40 backdrop-blur-md'
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
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ROS
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MikroTik RouterOS</h1>
              <p className="text-xs text-slate-500">
                {rb?.model || res?.boardName || 'CCR2004-16G-2S+'} &bull; RouterOS v{res?.version || '7.x'} &bull; IP:{' '}
                {data?.connection.host || '192.168.1.200'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400 font-mono">
              Cập nhật: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => void fetchOverview()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
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
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Hardware RouterBOARD</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white leading-tight">
              {rb?.model || res?.boardName || 'CCR2004-16G-2S+'}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1">S/N: {rb?.serialNumber || 'HMM0B2H5QEN'}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">CPU:</span>
              <span className="font-semibold">{res?.cpuCount || 4}x ARM64 @ {res?.cpuFrequency || 2000}MHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Uptime:</span>
              <span className="font-semibold">{res?.uptime || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Firmware:</span>
              <span className="font-semibold text-emerald-400">{rb?.currentFirmware || res?.version}</span>
            </div>
          </div>
        </div>

        {/* CPU Load Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tải CPU (Load)</span>
            <Cpu className="w-4 h-4 text-blue-500" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-slate-900">{res?.cpuLoad || 0}%</span>
            <div className="w-full h-2.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (res?.cpuLoad || 0) > 80 ? 'bg-rose-500' : (res?.cpuLoad || 0) > 50 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, res?.cpuLoad || 0)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            4 nhân ARM64 v8 đang xử lý các luồng gói tin NAT & định tuyến
          </p>
        </div>

        {/* RAM Usage Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Bộ nhớ RAM</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{ramPercent}%</span>
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
          <p className="text-[11px] text-slate-400">
            Còn trống {formatBytes(res?.freeMemory || 0)} bộ nhớ khả dụng
          </p>
        </div>

        {/* Storage / HDD Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Bộ nhớ Flash / HDD</span>
            <HardDrive className="w-4 h-4 text-sky-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{hddPercent}%</span>
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
          <p className="text-[11px] text-slate-400">
            Còn trống {formatBytes(res?.freeHddSpace || 0)} bộ nhớ lưu trữ
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Link
          href="/admin/mikrotik/interfaces"
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1 group-hover:text-emerald-600">
            <span className="text-[11px] font-bold uppercase">Cổng kết nối</span>
            <Cable className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.interfaces}</p>
          <span className="text-[11px] text-emerald-600 font-semibold">{stats.runningInterfaces} đang chạy</span>
        </Link>

        <Link
          href="/admin/mikrotik/ip"
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1 group-hover:text-blue-600">
            <span className="text-[11px] font-bold uppercase">IP Addresses</span>
            <Globe className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.addresses}</p>
          <span className="text-[11px] text-slate-400">Cấu hình IP</span>
        </Link>

        <Link
          href="/admin/mikrotik/firewall"
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-rose-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1 group-hover:text-rose-600">
            <span className="text-[11px] font-bold uppercase">Firewall Rules</span>
            <Shield className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.firewallEnabled}</p>
          <span className="text-[11px] text-rose-600 font-semibold">{stats.natEnabled} NAT Rules</span>
        </Link>

        <Link
          href="/admin/mikrotik/hotspot"
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-amber-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1 group-hover:text-amber-600">
            <span className="text-[11px] font-bold uppercase">Hotspot Online</span>
            <Wifi className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.hotspotOnline}</p>
          <span className="text-[11px] text-slate-400">Session xác thực</span>
        </Link>

        <Link
          href="/admin/mikrotik/hotspot"
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-sky-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1 group-hover:text-sky-600">
            <span className="text-[11px] font-bold uppercase">Hotspot Users</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.hotspotUsers}</p>
          <span className="text-[11px] text-slate-400">Tài khoản cục bộ</span>
        </Link>

        <Link
          href="/admin/mikrotik/queues"
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-indigo-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1 group-hover:text-indigo-600">
            <span className="text-[11px] font-bold uppercase">Hàng đợi QoS</span>
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">Simple</p>
          <span className="text-[11px] text-slate-400">Giới hạn băng thông</span>
        </Link>
      </div>

      {/* 20 Physical Ports Matrix on CCR2004 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Bảng cổng vật lý CCR2004-16G-2S+ (20 Ports)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              16 Cổng Gigabit Ethernet RJ45 &bull; 2 Cổng 10G SFP+
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
            const isSfp = iface.name.includes('sfp');

            return (
              <div
                key={iface.id || iface.name}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isUp
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="font-bold font-mono text-[9px] uppercase">
                    {isSfp ? '10G' : '1G'}
                  </span>
                </div>
                <p className="text-xs font-bold truncate" title={iface.name}>
                  {iface.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isUp ? (iface.lastLinkUpTime ? 'Running' : 'Up') : 'Link Down'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Split: Interfaces Traffic & Recent RouterOS Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interfaces Traffic Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
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
                  <th className="px-4 py-3">Tải về (RX)</th>
                  <th className="px-4 py-3">Tải lên (TX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.interfaces || [])
                  .filter((item) => item.running && !item.disabled)
                  .slice(0, 8)
                  .map((item) => (
                    <tr key={item.id || item.name} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          RUNNING
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sky-600 font-semibold">
                        {formatBytes(item.rxByte || 0)}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-600 font-semibold">
                        {formatBytes(item.txByte || 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live RouterOS System Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
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
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-emerald-700 uppercase">{log.topics}</span>
                    <span>{log.time}</span>
                  </div>
                  <p className="text-slate-800 break-words leading-relaxed">{log.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
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
                Thao tác này sẽ gửi lệnh Reboot trực tiếp tới phần cứng MikroTik CCR2004. Toàn bộ kết nối Internet và
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
                  className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
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
