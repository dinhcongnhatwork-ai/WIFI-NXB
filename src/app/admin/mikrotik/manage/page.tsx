'use client';
import { networkFetch } from '@/components/network/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  RefreshCw,
  Power,
  Shield,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  X,
  Clock,
  Terminal,
} from 'lucide-react';
import type { MikrotikRouterboard, MikrotikSystemLog, MikrotikSystemResource } from '@/types/mikrotik';
import { formatBytes } from '@/lib/network/format';

interface SystemResponse {
  resource: MikrotikSystemResource | null;
  routerboard: MikrotikRouterboard | null;
  identity: { name: string } | null;
  logs: MikrotikSystemLog[];
}

export default function MikrotikManagePage() {
  const [data, setData] = useState<SystemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchLog, setSearchLog] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [rebootModal, setRebootModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchSystemData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/mikrotik/system');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || 'Không thể tải thông tin hệ thống MikroTik');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối RouterOS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSystemData();
  }, [fetchSystemData]);

  const handleReboot = async () => {
    try {
      setActionLoading(true);
      const res = await networkFetch('/api/mikrotik/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reboot' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Lệnh khởi động lại đã được gửi đến RouterOS');
        setRebootModal(false);
      } else {
        showToast('error', json.error || 'Không thể khởi động lại router');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(false);
    }
  };

  const topicsList = useMemo(() => {
    const set = new Set<string>();
    (data?.logs || []).forEach((l) => {
      l.topics.split(',').forEach((t) => set.add(t.trim()));
    });
    return Array.from(set).filter(Boolean);
  }, [data?.logs]);

  const filteredLogs = useMemo(() => {
    const q = searchLog.toLowerCase();
    return (data?.logs || []).filter((l) => {
      const matchTopic = selectedTopic === 'all' || l.topics.includes(selectedTopic);
      const matchSearch = !q || l.message.toLowerCase().includes(q) || l.topics.toLowerCase().includes(q);
      return matchTopic && matchSearch;
    });
  }, [data?.logs, searchLog, selectedTopic]);

  const res = data?.resource;
  const rb = data?.routerboard;

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trung tâm quản lý MikroTik RouterOS</h1>
          <p className="text-xs text-slate-500 mt-1">
            Thông số phần cứng RouterBOARD, nhật ký hệ thống thời gian thực và lệnh bảo trì phần cứng
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchSystemData()}
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
            Khởi động lại router
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Hardware Specs Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Server className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Thông số RouterBOARD</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="font-bold text-slate-800">{rb?.model || res?.boardName || 'CCR2004-16G-2S+'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số Serial:</span>
              <span className="font-mono font-bold text-slate-800">{rb?.serialNumber || 'HMM0B2H5QEN'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Revision:</span>
              <span className="font-mono text-slate-700">{rb?.revision || 'r3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Firmware hiện tại:</span>
              <span className="font-mono text-emerald-700 font-bold">{rb?.currentFirmware || res?.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Firmware nâng cấp:</span>
              <span className="font-mono text-blue-700 font-bold">{rb?.upgradeFirmware || '7.24.5'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Vi xử lý & Nền tảng</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Kiến trúc:</span>
              <span className="font-bold text-slate-800">{res?.architectureName || 'arm64'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số nhân CPU:</span>
              <span className="font-bold text-slate-800">{res?.cpuCount || 4} Cores</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tần số xung nhịp:</span>
              <span className="font-bold text-slate-800">{res?.cpuFrequency || 2000} MHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tải CPU hiện tại:</span>
              <span className="font-bold text-blue-600">{res?.cpuLoad || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Thời gian hoạt động (Uptime):</span>
              <span className="font-semibold text-slate-700">{res?.uptime || '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <HardDrive className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">Bộ nhớ & Lưu trữ</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Tổng bộ nhớ RAM:</span>
              <span className="font-bold text-slate-800">{formatBytes(res?.totalMemory || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">RAM Khả dụng:</span>
              <span className="font-bold text-emerald-600">{formatBytes(res?.freeMemory || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tổng bộ nhớ Flash:</span>
              <span className="font-bold text-slate-800">{formatBytes(res?.totalHddSpace || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Flash Khả dụng:</span>
              <span className="font-bold text-sky-600">{formatBytes(res?.freeHddSpace || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Build Time:</span>
              <span className="text-slate-500 font-mono text-[11px]">{res?.buildTime || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Logs Viewer */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Nhật ký sự kiện RouterOS (Live System Logs)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các sự kiện kết nối, khởi động, phân giải DHCP và cảnh báo bảo mật từ phần cứng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Tất cả chủ đề (Topics)</option>
              {topicsList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2 text-slate-400" />
              <input
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Tìm nội dung log..."
                className="w-56 rounded-lg border border-slate-200 py-1 pl-8 pr-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[500px] space-y-2 font-mono text-xs">
          {filteredLogs.map((log) => {
            const isWarn = log.topics.includes('warning') || log.topics.includes('error');
            return (
              <div
                key={log.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-2 transition-colors ${
                  isWarn
                    ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-emerald-800">
                      {log.topics}
                    </span>
                    <span className="text-slate-400">{log.time}</span>
                  </div>
                  <p className="break-words leading-relaxed text-slate-900 font-medium">{log.message}</p>
                </div>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              Không tìm thấy nhật ký phù hợp với bộ lọc
            </div>
          )}
        </div>
      </div>

      {/* Reboot Modal */}
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
                Lệnh Reboot sẽ được thực thi trực tiếp trên hệ thống MikroTik RouterOS. Mọi luồng kết nối Internet sẽ
                khởi động lại trong 45-60 giây.
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
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
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
