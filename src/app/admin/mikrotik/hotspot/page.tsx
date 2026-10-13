'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type {
  MikrotikHotspotActiveSession,
  MikrotikHotspotProfile,
  MikrotikHotspotServer,
  MikrotikHotspotUser,
} from '@/types/mikrotik';

interface HotspotResponse {
  profiles: MikrotikHotspotProfile[];
  servers: MikrotikHotspotServer[];
  users: MikrotikHotspotUser[];
  active: MikrotikHotspotActiveSession[];
}

function formatBytes(value?: number): string {
  if (!value || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** idx).toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

export default function MikrotikHotspotPage() {
  const [data, setData] = useState<HotspotResponse>({
    profiles: [],
    servers: [],
    users: [],
    active: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    password: '',
    profile: 'default',
    server: 'all',
    comment: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/mikrotik/hotspot');
      const json = (await res.json()) as { success: boolean; data?: HotspotResponse; error?: string };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải hotspot data');
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải hotspot data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const profileOptions = useMemo(() => {
    if (data.profiles.length === 0) {
      return ['default'];
    }
    return data.profiles.map((item) => item.name).filter((item) => item.length > 0);
  }, [data.profiles]);

  const addUser = async () => {
    try {
      if (!form.name) {
        alert('Vui lòng nhập username');
        return;
      }

      setActionId('create');
      const res = await fetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-user',
          name: form.name,
          password: form.password,
          profile: form.profile,
          server: form.server,
          comment: form.comment,
        }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể tạo user hotspot');
      }

      setForm({
        name: '',
        password: '',
        profile: profileOptions[0] || 'default',
        server: 'all',
        comment: '',
      });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể tạo user hotspot');
    } finally {
      setActionId(null);
    }
  };

  const toggleUser = async (item: MikrotikHotspotUser) => {
    try {
      setActionId(item.id);
      const res = await fetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.disabled ? 'enable-user' : 'disable-user', id: item.id }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể cập nhật hotspot user');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật hotspot user');
    } finally {
      setActionId(null);
    }
  };

  const removeUser = async (item: MikrotikHotspotUser) => {
    if (!item.id || !confirm(`Xóa user ${item.name}?`)) {
      return;
    }

    try {
      setActionId(item.id);
      const res = await fetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-user', id: item.id }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể xóa hotspot user');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể xóa hotspot user');
    } finally {
      setActionId(null);
    }
  };

  if (loading && data.users.length === 0) {
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
          <h1 className="text-2xl font-bold text-slate-900">MikroTik Hotspot</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý hotspot profile/server/user/session</p>
        </div>
        <button
          onClick={() => void fetchData()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Profiles" value={data.profiles.length} />
        <StatCard label="Servers" value={data.servers.length} />
        <StatCard label="Users" value={data.users.length} />
        <StatCard label="Online" value={data.active.length} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Tạo hotspot user</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="username"
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="password"
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={form.profile}
            onChange={(event) => setForm((prev) => ({ ...prev, profile: event.target.value }))}
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {profileOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            value={form.comment}
            onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
            placeholder="comment"
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => void addUser()}
            disabled={actionId === 'create'}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Hotspot users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Profile</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((item) => (
                  <tr key={item.id || item.name} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.comment && <p className="text-xs text-slate-400">{item.comment}</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{item.profile || '-'}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.disabled ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.disabled ? 'DISABLED' : 'ENABLED'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void toggleUser(item)}
                          disabled={!item.id || actionId === item.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                            item.disabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          } disabled:opacity-50`}
                        >
                          {item.disabled ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                          {item.disabled ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => void removeUser(item)}
                          disabled={!item.id || actionId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                      Không có hotspot user
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Active sessions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">IP/MAC</th>
                  <th className="px-5 py-3">Uptime</th>
                  <th className="px-5 py-3">Traffic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.active.map((item) => (
                  <tr key={item.id || `${item.user}-${item.address || ''}`} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{item.user || '-'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      <p>{item.address || '-'}</p>
                      <p className="text-xs font-mono text-slate-400">{item.macAddress || '-'}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{item.uptime || '-'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      <p>IN: {formatBytes(item.bytesIn)}</p>
                      <p>OUT: {formatBytes(item.bytesOut)}</p>
                    </td>
                  </tr>
                ))}
                {data.active.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                      Không có session đang hoạt động
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
