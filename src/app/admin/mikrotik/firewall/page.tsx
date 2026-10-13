'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import type { MikrotikFirewallRule } from '@/types/mikrotik';

export default function MikrotikFirewallPage() {
  const [rules, setRules] = useState<MikrotikFirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/mikrotik/firewall');
      const json = (await res.json()) as { success: boolean; data?: MikrotikFirewallRule[]; error?: string };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải firewall rules');
      }
      setRules(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải firewall');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rules;

    return rules.filter((item) => {
      return (
        (item.chain || '').toLowerCase().includes(keyword) ||
        (item.action || '').toLowerCase().includes(keyword) ||
        (item.protocol || '').toLowerCase().includes(keyword) ||
        (item.comment || '').toLowerCase().includes(keyword) ||
        (item.srcAddress || '').toLowerCase().includes(keyword) ||
        (item.dstAddress || '').toLowerCase().includes(keyword)
      );
    });
  }, [rules, search]);

  const toggleRule = async (item: MikrotikFirewallRule) => {
    try {
      setActionId(item.id);
      const res = await fetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.disabled ? 'enable' : 'disable', id: item.id }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể cập nhật firewall rule');
      }

      await fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật firewall rule');
    } finally {
      setActionId(null);
    }
  };

  if (loading && rules.length === 0) {
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
          <h1 className="text-2xl font-bold text-slate-900">MikroTik Firewall</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý filter rules</p>
        </div>
        <button
          onClick={() => void fetchRules()}
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
            placeholder="Tìm chain/action/protocol/IP/comment"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                <th className="px-5 py-3">Chain</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Protocol</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Comment</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id || `${item.chain}-${item.comment || ''}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-800">{item.chain || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.action || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.protocol || '-'}</td>
                  <td className="px-5 py-3 text-sm font-mono text-slate-600">{item.srcAddress || '-'}</td>
                  <td className="px-5 py-3 text-sm font-mono text-slate-600">{item.dstAddress || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.comment || '-'}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.disabled ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.disabled ? 'DISABLED' : item.dynamic ? 'DYNAMIC' : 'ENABLED'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!item.dynamic && (
                      <button
                        onClick={() => void toggleRule(item)}
                        disabled={!item.id || actionId === item.id}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          item.disabled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        } disabled:opacity-50`}
                      >
                        {item.disabled ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        {item.disabled ? 'Enable' : 'Disable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                    Không có firewall rule
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
