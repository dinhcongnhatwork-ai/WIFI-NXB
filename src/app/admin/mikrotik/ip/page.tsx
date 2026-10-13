'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  MikrotikDhcpLease,
  MikrotikDhcpServer,
  MikrotikIpAddress,
  MikrotikRoute,
} from '@/types/mikrotik';

interface IpResponse {
  addresses: MikrotikIpAddress[];
  dhcpServers: MikrotikDhcpServer[];
  dhcpLeases: MikrotikDhcpLease[];
  routes: MikrotikRoute[];
}

export default function MikrotikIpPage() {
  const [data, setData] = useState<IpResponse>({
    addresses: [],
    dhcpServers: [],
    dhcpLeases: [],
    routes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'addresses' | 'leases' | 'routes'>('addresses');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    address: '',
    interface: '',
    comment: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/mikrotik/ip');
      const json = (await res.json()) as { success: boolean; data?: IpResponse; error?: string };

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải dữ liệu IP');
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối IP');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const sortedLeases = useMemo(() => {
    return [...data.dhcpLeases].sort((a, b) => (a.dynamic === b.dynamic ? 0 : a.dynamic ? 1 : -1));
  }, [data.dhcpLeases]);

  const addAddress = async () => {
    try {
      if (!form.address || !form.interface) {
        alert('Vui lòng nhập address và interface');
        return;
      }

      setSubmitting(true);
      const res = await fetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-address',
          address: form.address,
          interface: form.interface,
          comment: form.comment,
        }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể thêm IP address');
      }

      setForm({ address: '', interface: '', comment: '' });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể thêm IP address');
    } finally {
      setSubmitting(false);
    }
  };

  const removeAddress = async (id: string) => {
    if (!id || !confirm('Xóa IP address này?')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-address', id }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error || 'Không thể xóa IP address');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể xóa IP address');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && data.addresses.length === 0) {
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
          <h1 className="text-2xl font-bold text-slate-900">IP & DHCP</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý IP addresses, DHCP lease và routing</p>
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

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Thêm IP Address</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            placeholder="192.168.10.1/24"
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={form.interface}
            onChange={(event) => setForm((prev) => ({ ...prev, interface: event.target.value }))}
            placeholder="bridge-hotspot"
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={form.comment}
            onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
            placeholder="Comment"
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => void addAddress()}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <TabButton active={activeTab === 'addresses'} onClick={() => setActiveTab('addresses')}>
          Addresses ({data.addresses.length})
        </TabButton>
        <TabButton active={activeTab === 'leases'} onClick={() => setActiveTab('leases')}>
          DHCP Leases ({data.dhcpLeases.length})
        </TabButton>
        <TabButton active={activeTab === 'routes'} onClick={() => setActiveTab('routes')}>
          Routes ({data.routes.length})
        </TabButton>
      </div>

      {activeTab === 'addresses' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Network</th>
                <th className="px-5 py-3">Interface</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.addresses.map((item) => (
                <tr key={item.id || item.address} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{item.address}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.network || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.interface || '-'}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      !item.disabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {item.dynamic ? 'DYNAMIC' : !item.disabled ? 'STATIC' : 'DISABLED'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!item.dynamic && item.id && (
                      <button
                        onClick={() => void removeAddress(item.id)}
                        disabled={submitting}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.addresses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    Không có IP address
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leases' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">MAC</th>
                <th className="px-5 py-3">Host</th>
                <th className="px-5 py-3">Server</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLeases.map((item) => (
                <tr key={item.id || `${item.address}-${item.macAddress || ''}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{item.address || '-'}</td>
                  <td className="px-5 py-3 text-sm font-mono text-slate-600">{item.macAddress || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.hostName || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.server || '-'}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.blocked ? 'bg-red-100 text-red-700' : item.dynamic ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.blocked ? 'BLOCKED' : item.dynamic ? 'DYNAMIC' : 'STATIC'}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedLeases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    Không có DHCP lease
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Gateway</th>
                <th className="px-5 py-3">Distance</th>
                <th className="px-5 py-3">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.routes.map((item) => (
                <tr key={item.id || `${item.dstAddress}-${item.gateway || ''}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{item.dstAddress || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.gateway || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{item.distance ?? '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {item.active ? 'A' : '-'} {item.dynamic ? 'D' : 'S'} {item.disabled ? 'X' : ''}
                  </td>
                </tr>
              ))}
              {data.routes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                    Không có route
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
