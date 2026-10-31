'use client';
import { networkFetch } from '@/components/network/client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import type { MikrotikInterface } from '@/types/mikrotik';

function formatBytes(value?: number): string {
  if (!value || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** idx).toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

export default function MikrotikInterfacesPage() {
  const [interfaces, setInterfaces] = useState<MikrotikInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchInterfaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/mikrotik/interfaces');
      const json = (await res.json()) as { success: boolean; data?: MikrotikInterface[]; error?: string };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải interfaces');
      }
      setInterfaces(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải interfaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInterfaces();
  }, [fetchInterfaces]);

  const handleToggle = async (item: MikrotikInterface) => {
    try {
      setActionId(item.id);
      const res = await networkFetch('/api/mikrotik/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.disabled ? 'enable' : 'disable', id: item.id }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể cập nhật trạng thái interface');
      }
      await fetchInterfaces();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái interface');
    } finally {
      setActionId(null);
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return interfaces;

    return interfaces.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        (item.type || '').toLowerCase().includes(keyword) ||
        (item.comment || '').toLowerCase().includes(keyword)
      );
    });
  }, [interfaces, search]);

  if (loading && interfaces.length === 0) {
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
          <h1 className="text-2xl font-bold text-slate-900">MikroTik Interfaces</h1>
          <p className="text-slate-500 text-sm mt-1">Bật/tắt và theo dõi traffic interface</p>
        </div>
        <button
          onClick={() => void fetchInterfaces()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên interface, type, comment"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">MAC</th>
                <th className="text-left px-5 py-3">MTU</th>
                <th className="text-left px-5 py-3">RX</th>
                <th className="text-left px-5 py-3">TX</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const running = item.running && !item.disabled;
                return (
                  <tr key={item.id || item.name} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      {item.comment && <p className="text-xs text-slate-400">{item.comment}</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{item.type || '-'}</td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{item.macAddress || '-'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{item.actualMtu || item.mtu || '-'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatBytes(item.rxByte)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatBytes(item.txByte)}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${running ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {running ? 'RUNNING' : item.disabled ? 'DISABLED' : 'DOWN'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => void handleToggle(item)}
                        disabled={!item.id || actionId === item.id}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          item.disabled
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        } disabled:opacity-50`}
                      >
                        {item.disabled ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        {item.disabled ? 'Enable' : 'Disable'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                    Không có interface phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
