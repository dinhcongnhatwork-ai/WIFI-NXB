'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { formatBytes } from '@/lib/unifi';
import {
  Download,
  Search,
  Wifi,
  Monitor,
  MonitorSmartphone,
  Smartphone,
  Server,
  RefreshCw,
  WifiOff,
  Shield,
  ShieldOff,
  UserCheck,
} from 'lucide-react';

interface UnifiClient {
  _id: string;
  mac: string;
  ip?: string;
  hostname?: string;
  firstSeen?: number;
  lastSeen?: number;
  isGuest: boolean;
  isWireless: boolean;
  isBlocked: boolean;
  isWired: boolean;
  authorized: boolean;
  apMac?: string;
  apName?: string;
  ssid?: string;
  bssid?: string;
  channel?: number;
  uptime: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  signal: number;
  noise?: number;
  networkName?: string;
  note?: string;
}

type FilterType = 'all' | 'wireless' | 'wired' | 'guest' | 'blocked';

export default function UsersPage() {
  const [clients, setClients] = useState<UnifiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchClients = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/unifi/clients');
      const json = await res.json();
      if (json.success) {
        setClients(json.data || []);
      } else {
        setError(json.error || 'Không thể kết nối UniFi');
      }
    } catch {
      setError('Không thể kết nối UniFi Controller');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClients();
    const interval = setInterval(fetchClients, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = clients.filter((c) => {
    const matchSearch =
      !search ||
      c.mac.toLowerCase().includes(search.toLowerCase()) ||
      (c.hostname && c.hostname.toLowerCase().includes(search.toLowerCase())) ||
      (c.ip && c.ip.includes(search)) ||
      (c.ssid && c.ssid.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === 'all' ||
      (filter === 'wireless' && c.isWireless && !c.isGuest) ||
      (filter === 'wired' && c.isWired) ||
      (filter === 'guest' && c.isGuest) ||
      (filter === 'blocked' && c.isBlocked);
    return matchSearch && matchFilter;
  });

  const totalTraffic = clients.reduce((sum, c) => sum + c.rxBytes + c.txBytes, 0);
  const activeClients = clients.filter((c) => c.authorized).length;
  const guestClients = clients.filter((c) => c.isGuest).length;
  const wiredClients = clients.filter((c) => c.isWired).length;
  const blockedClients = clients.filter((c) => c.isBlocked).length;

  const getSignalBadge = (signal: number) => {
    if (signal >= -50) return { label: 'Xuất sắc', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
    if (signal >= -60) return { label: 'Tốt', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' };
    if (signal >= -70) return { label: 'Trung bình', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
    return { label: 'Yếu', color: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' };
  };

  const exportCSV = () => {
    const rows = [
      ['MAC', 'Hostname', 'IP', 'SSID', 'Loại', 'Khách', 'Khóa', 'Tín hiệu', 'AP', 'Uptime', 'RX', 'TX'],
      ...filtered.map((c) => [
        c.mac,
        c.hostname || '',
        c.ip || '',
        c.ssid || '',
        c.isWired ? 'Wired' : 'WiFi',
        c.isGuest ? 'Có' : 'Không',
        c.isBlocked ? 'Có' : 'Không',
        c.signal.toString(),
        c.apName || '',
        c.uptime > 0 ? `${Math.floor(c.uptime / 3600)}h` : '0h',
        formatBytes(c.rxBytes),
        formatBytes(c.txBytes),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uniFi-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterTabs: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'Tất cả', count: clients.length },
    { id: 'wireless', label: 'WiFi', count: clients.filter((c) => c.isWireless && !c.isGuest).length },
    { id: 'wired', label: 'Wired', count: wiredClients },
    { id: 'guest', label: 'Khách', count: guestClients },
    { id: 'blocked', label: 'Khóa', count: blockedClients },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Người dùng</h1>
          <p className="text-slate-500 text-sm mt-1">Kết nối WiFi theo thời gian thực từ UniFi</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchClients()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{activeClients.toLocaleString('vi-VN')}</p>
          <p className="text-sm font-medium text-slate-500 mt-1">Đang kết nối</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {(clients.length - wiredClients).toLocaleString('vi-VN')}
          </p>
          <p className="text-sm font-medium text-slate-500 mt-1">Qua WiFi</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{wiredClients.toLocaleString('vi-VN')}</p>
          <p className="text-sm font-medium text-slate-500 mt-1">Wired</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{guestClients.toLocaleString('vi-VN')}</p>
          <p className="text-sm font-medium text-slate-500 mt-1">Khách</p>
        </div>
      </div>

      {/* Traffic */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">Lưu lượng tổng</span>
        </div>
        <p className="text-2xl font-extrabold text-slate-900">{formatBytes(totalTraffic)}</p>
        <p className="text-xs text-slate-400 mt-1">Tổng lưu lượng tất cả thiết bị đang kết nối</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                filter === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm MAC, hostname, IP, SSID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      {loading && clients.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Không thể kết nối UniFi</h3>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => void fetchClients()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />Thử lại
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Wifi className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">
            {search ? 'Không tìm thấy kết nối' : 'Chưa có kết nối nào'}
          </h3>
          <p className="text-slate-400 text-sm">
            {search ? 'Thử tìm kiếm khác' : 'Kết nối sẽ xuất hiện khi có thiết bị truy cập WiFi'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">Thiết bị</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">SSID</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">Loại</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">Tín hiệu</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">Lưu lượng</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">AP</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((client) => {
                  const signal = getSignalBadge(client.signal);
                  return (
                    <tr key={client._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                            {client.isWired ? (
                              <Server className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Smartphone className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-800">{client.mac}</p>
                            <p className="text-xs text-slate-400">{client.hostname || client.ip || 'Không có hostname'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {client.ssid ? (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                            <Wifi className="w-3 h-3 inline mr-1" />
                            {client.ssid}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {client.isWired ? (
                            <><Server className="w-4 h-4 text-slate-400" /><span className="text-xs font-medium text-slate-600">Wired</span></>
                          ) : client.isGuest ? (
                            <><Shield className="w-4 h-4 text-amber-400" /><span className="text-xs font-medium text-amber-600">Khách</span></>
                          ) : (
                            <><Smartphone className="w-4 h-4 text-slate-400" /><span className="text-xs font-medium text-slate-600">WiFi</span></>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg ${signal.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${signal.dot}`} />
                            {client.signal} dBm
                          </span>
                          <span className="text-xs text-slate-400">{signal.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-700">↓ {formatBytes(client.rxBytes)}</span>
                          <span className="mx-1 text-slate-300">/</span>
                          <span className="font-semibold text-slate-700">↑ {formatBytes(client.txBytes)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-slate-600">{client.apName || client.apMac?.slice(-6) || '-'}</span>
                      </td>
                      <td className="px-5 py-4">
                        {client.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700">
                            <ShieldOff className="w-3 h-3" />Khóa
                          </span>
                        ) : client.authorized ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700">
                            <UserCheck className="w-3 h-3" />Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-500">
                            Chờ duyệt
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">
              Hiển thị {filtered.length} / {clients.length} kết nối — Tự động cập nhật mỗi 30 giây
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
