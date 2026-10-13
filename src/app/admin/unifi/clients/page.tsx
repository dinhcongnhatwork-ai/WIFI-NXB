'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  RefreshCw,
  Search,
  Filter,
  Wifi,
  WifiOff,
  X,
  UserX,
  UserCheck,
  RefreshCcw,
  ChevronDown,
  Signal,
  Monitor,
  Smartphone,
  Laptop,
  Tv,
  Watch,
  Tablet,
} from 'lucide-react';
import { formatBytes, formatUptime, getSignalColor } from '@/lib/unifi';

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
  rssi?: number;
  assocTime?: number;
  inactivityTime?: number;
  txRetries?: number;
  name?: string;
  oui?: string;
  osName?: string;
  osClass?: string;
  networkName?: string;
  note?: string;
}

export default function UnifiClientsPage() {
  const [clients, setClients] = useState<UnifiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<UnifiClient | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ open: boolean; client: UnifiClient | null }>({ open: false, client: null });
  const [noteText, setNoteText] = useState('');

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/unifi/clients?force=true');
      const json = await res.json();

      if (json.success) {
        setClients(json.data);
      } else {
        setError(json.error || 'Failed to fetch clients');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleClientAction = async (mac: string, action: string) => {
    try {
      setActionLoading(mac);
      const res = await fetch('/api/unifi/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, mac }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchClients();
      } else {
        alert(json.error || 'Action failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = !search ||
      (client.hostname && client.hostname.toLowerCase().includes(search.toLowerCase())) ||
      client.mac.toLowerCase().includes(search.toLowerCase()) ||
      (client.ip && client.ip.includes(search)) ||
      (client.ssid && client.ssid.toLowerCase().includes(search.toLowerCase()));

    const matchesType = filterType === 'all' ||
      (filterType === 'wireless' && client.isWireless) ||
      (filterType === 'wired' && client.isWired) ||
      (filterType === 'guest' && client.isGuest);

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'blocked' && client.isBlocked) ||
      (filterStatus === 'active' && !client.isBlocked);

    return matchesSearch && matchesType && matchesStatus;
  });

  const getDeviceIcon = (hostname?: string, osName?: string) => {
    if (!hostname && !osName) return Monitor;
    const h = hostname?.toLowerCase() || '';
    const o = osName?.toLowerCase() || '';
    
    if (h.includes('iphone') || h.includes('android') || o.includes('android') || h.includes('samsung') || h.includes('xiaomi') || h.includes('huawei')) return Smartphone;
    if (h.includes('ipad') || h.includes('tablet')) return Tablet;
    if (h.includes('macbook') || h.includes('laptop') || h.includes('pc') || o.includes('windows') || o.includes('macos')) return Laptop;
    if (h.includes('tv') || h.includes('roku') || h.includes('firestick')) return Tv;
    if (h.includes('watch') || h.includes('watch')) return Watch;
    return Monitor;
  };

  const getSignalLabel = (signal: number): string => {
    if (signal >= -50) return 'Excellent';
    if (signal >= -60) return 'Good';
    if (signal >= -70) return 'Fair';
    return 'Poor';
  };

  const totalRx = filteredClients.reduce((sum, c) => sum + (c.rxBytes || 0), 0);
  const totalTx = filteredClients.reduce((sum, c) => sum + (c.txBytes || 0), 0);
  const guestCount = filteredClients.filter(c => c.isGuest).length;
  const blockedCount = filteredClients.filter(c => c.isBlocked).length;

  const ClientRow = ({ client }: { client: UnifiClient }) => {
    const Icon = getDeviceIcon(client.hostname, client.osName);
    const isOnline = client.lastSeen && (Date.now() - client.lastSeen * 1000) < 60000;

    return (
      <>
        <tr
          className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedClient?._id === client._id ? 'bg-purple-50' : ''}`}
          onClick={() => setSelectedClient(selectedClient?._id === client._id ? null : client)}
        >
          <td className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{client.hostname || client.name || 'Unknown'}</p>
                {client.osName && (
                  <p className="text-xs text-slate-400">{client.osName}</p>
                )}
              </div>
            </div>
          </td>
          <td className="px-5 py-4">
            <p className="text-sm font-mono text-slate-600">{client.mac}</p>
            {client.ip && (
              <p className="text-xs text-slate-400">{client.ip}</p>
            )}
          </td>
          <td className="px-5 py-4">
            <div className="flex items-center gap-1">
              {client.isWired ? (
                <WifiOff className="w-4 h-4 text-blue-500" />
              ) : (
                <Wifi className="w-4 h-4 text-green-500" />
              )}
              <span className="text-sm text-slate-600">
                {client.isWired ? 'Wired' : 'WiFi'}
              </span>
            </div>
            {client.isGuest && (
              <span className="ml-1 inline-flex px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md">
                Guest
              </span>
            )}
          </td>
          <td className="px-5 py-4">
            {client.ssid ? (
              <span className="inline-flex px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">
                {client.ssid}
              </span>
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
          </td>
          <td className="px-5 py-4">
            {client.signal !== undefined ? (
              <div className="flex items-center gap-2">
                <Signal className={`w-4 h-4 ${getSignalColor(client.signal)}`} />
                <div>
                  <p className={`text-sm font-medium ${getSignalColor(client.signal)}`}>
                    {client.signal} dBm
                  </p>
                  <p className="text-xs text-slate-400">{getSignalLabel(client.signal)}</p>
                </div>
              </div>
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
          </td>
          <td className="px-5 py-4">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="text-green-600">↑{formatBytes(client.txBytes)}</span>
              <span className="text-blue-600">↓{formatBytes(client.rxBytes)}</span>
            </div>
          </td>
          <td className="px-5 py-4">
            <span className="text-sm text-slate-500">
              {client.uptime > 0 ? formatUptime(client.uptime) : '-'}
            </span>
          </td>
          <td className="px-5 py-4">
            {client.isBlocked ? (
              <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-md">
                Blocked
              </span>
            ) : (
              <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-50 text-green-600 rounded-md">
                Active
              </span>
            )}
          </td>
          <td className="px-5 py-4">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(client.isBlocked ? 'Unblock this client?' : 'Block this client?')) {
                    handleClientAction(client.mac, client.isBlocked ? 'unblock' : 'block');
                  }
                }}
                disabled={actionLoading === client.mac}
                className={`p-2 rounded-lg transition-colors ${
                  client.isBlocked
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-red-600 hover:bg-red-50'
                }`}
                title={client.isBlocked ? 'Unblock' : 'Block'}
              >
                {client.isBlocked ? (
                  <UserCheck className="w-4 h-4" />
                ) : (
                  <UserX className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClientAction(client.mac, 'kick');
                }}
                disabled={actionLoading === client.mac}
                className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                title="Kick"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNoteModal({ open: true, client });
                  setNoteText(client.note || '');
                }}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                title="Add Note"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {selectedClient?._id === client._id && (
          <tr>
            <td colSpan={9} className="px-5 py-4 bg-purple-50/50 border-b border-purple-100">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">First Seen</p>
                  <p className="text-sm text-slate-700">
                    {client.firstSeen ? new Date(client.firstSeen * 1000).toLocaleString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Last Seen</p>
                  <p className="text-sm text-slate-700">
                    {client.lastSeen ? new Date(client.lastSeen * 1000).toLocaleString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">AP</p>
                  <p className="text-sm text-slate-700">{client.apName || client.apMac || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Channel</p>
                  <p className="text-sm text-slate-700">{client.channel || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Manufacturer</p>
                  <p className="text-sm text-slate-700">{client.oui || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Rx Packets</p>
                  <p className="text-sm text-slate-700">{client.rxPackets?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tx Packets</p>
                  <p className="text-sm text-slate-700">{client.txPackets?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Network</p>
                  <p className="text-sm text-slate-700">{client.networkName || '-'}</p>
                </div>
                {client.note && (
                  <div className="col-span-4">
                    <p className="text-xs text-slate-500 mb-1">Note</p>
                    <p className="text-sm text-slate-700 bg-white rounded-lg p-2">{client.note}</p>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Đang tải danh sách kết nối...</p>
        </div>
      </div>
    );
  }

  if (error && clients.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8">
        <div className="flex flex-col items-center text-center">
          <WifiOff className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Không thể tải danh sách</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Thiết bị kết nối</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý thiết bị đang kết nối</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchClients}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, MAC, IP, SSID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tất cả loại</option>
              <option value="wireless">Wireless</option>
              <option value="wired">Wired</option>
              <option value="guest">Guest</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{filteredClients.length}</p>
          <p className="text-xs text-slate-500">Tổng kết nối</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {filteredClients.filter(c => !c.isBlocked).length}
          </p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{guestCount}</p>
          <p className="text-xs text-slate-500">Guest</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{formatBytes(totalTx)}</p>
          <p className="text-xs text-slate-500">Tổng Upload</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{formatBytes(totalRx)}</p>
          <p className="text-xs text-slate-500">Tổng Download</p>
        </div>
      </div>

      {/* Client Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Thiết bị</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">MAC/IP</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Loại</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">SSID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Signal</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Traffic</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Thời gian</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => (
                <ClientRow key={client._id} client={client} />
              ))}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && !loading && (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Không có thiết bị kết nối</h3>
            <p className="text-slate-500">Thử thay đổi bộ lọc hoặc tìm kiếm</p>
          </div>
        )}
      </div>

      {/* Note Modal */}
      <AnimatePresence>
        {noteModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setNoteModal({ open: false, client: null })}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Ghi chú cho {noteModal.client?.hostname || noteModal.client?.mac}</h3>
                <button
                  onClick={() => setNoteModal({ open: false, client: null })}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                    placeholder="Nhập ghi chú..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setNoteModal({ open: false, client: null })}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      setNoteModal({ open: false, client: null });
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
