'use client';
import { DeviceIcon } from '@/components/network/DeviceIcon';
import { networkFetch } from '@/components/network/client';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Signal,
  Monitor,
  Smartphone,
  Laptop,
  Tv,
  Watch,
  Tablet,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Radio,
  Clock,
  HardDrive,
  Edit3,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  ExternalLink,
  Info,
} from 'lucide-react';
import { formatBytes, formatUptime, getSignalColor } from '@/lib/network/format';

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
  radio?: string;
  radioProto?: string;
  txRate?: number;
  rxRate?: number;
  satisfaction?: number;
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
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Note & Rename Modal
  const [editModal, setEditModal] = useState<{ open: boolean; client: UnifiClient | null }>({
    open: false,
    client: null,
  });
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/unifi/clients?force=true');
      const json = await res.json();

      if (json.success) {
        setClients(json.data);
        // If a client is currently selected in drawer, update its data
        setSelectedClient((prev) => {
          if (!prev) return null;
          return json.data.find((c: UnifiClient) => c.mac === prev.mac) || prev;
        });
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

  const handleClientAction = async (mac: string, action: string, extraData?: Record<string, unknown>) => {
    try {
      setActionLoading(mac);
      const res = await networkFetch('/api/unifi/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, mac, ...extraData }),
      });
      const json = await res.json();

      if (json.success) {
        let actionLabel = action;
        if (action === 'block') actionLabel = 'Đã chặn thiết bị thành công';
        else if (action === 'unblock') actionLabel = 'Đã bỏ chặn thiết bị thành công';
        else if (action === 'kick' || action === 'reconnect') actionLabel = 'Đã gửi lệnh Reconnect / Kick đến Controller';
        else if (action === 'authorize') actionLabel = 'Đã cấp quyền truy cập (Authorize) khách';
        else if (action === 'unauthorize') actionLabel = 'Đã hủy quyền truy cập (Unauthorize) khách';
        else if (action === 'update' || action === 'note' || action === 'rename') actionLabel = 'Đã lưu tên & ghi chú vào Controller';

        showToast('success', actionLabel);
        await fetchClients();
      } else {
        showToast('error', json.error || 'Thao tác không thành công');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối Controller');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal.client) return;
    try {
      setIsSavingEdit(true);
      await handleClientAction(editModal.client.mac, 'update', {
        name: editName.trim(),
        note: editNote.trim(),
      });
      setEditModal({ open: false, client: null });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (client.hostname && client.hostname.toLowerCase().includes(q)) ||
        (client.name && client.name.toLowerCase().includes(q)) ||
        client.mac.toLowerCase().includes(q) ||
        (client.ip && client.ip.includes(q)) ||
        (client.ssid && client.ssid.toLowerCase().includes(q)) ||
        (client.apName && client.apName.toLowerCase().includes(q)) ||
        (client.oui && client.oui.toLowerCase().includes(q));

      const matchesType =
        filterType === 'all' ||
        (filterType === 'wireless' && client.isWireless) ||
        (filterType === 'wired' && client.isWired) ||
        (filterType === 'guest' && client.isGuest);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'blocked' && client.isBlocked) ||
        (filterStatus === 'active' && !client.isBlocked);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [clients, search, filterType, filterStatus]);

  const getDeviceIcon = (hostname?: string, osName?: string, oui?: string) => {
    const text = `${hostname || ''} ${osName || ''} ${oui || ''}`.toLowerCase();
    if (text.includes('iphone') || text.includes('android') || text.includes('samsung') || text.includes('xiaomi') || text.includes('huawei') || text.includes('oppo') || text.includes('pixel'))
      return Smartphone;
    if (text.includes('ipad') || text.includes('tablet')) return Tablet;
    if (text.includes('macbook') || text.includes('laptop') || text.includes('notebook') || text.includes('thinkpad')) return Laptop;
    if (text.includes('tv') || text.includes('roku') || text.includes('apple tv') || text.includes('firestick')) return Tv;
    if (text.includes('watch')) return Watch;
    return Monitor;
  };

  const getSignalLabel = (signal?: number): { text: string; color: string; percent: number } => {
    if (signal === undefined || signal === 0) return { text: 'Không rõ', color: 'text-slate-500', percent: 0 };
    // -30dBm = 100%, -90dBm = 0%
    const percent = Math.min(100, Math.max(5, Math.round(((signal + 90) / 60) * 100)));
    if (signal >= -55) return { text: 'Tuyệt vời', color: 'text-emerald-500', percent };
    if (signal >= -67) return { text: 'Tốt', color: 'text-sky-500', percent };
    if (signal >= -78) return { text: 'Khá', color: 'text-amber-500', percent };
    return { text: 'Yếu', color: 'text-rose-500', percent };
  };

  const totalRx = filteredClients.reduce((sum, c) => sum + (c.rxBytes || 0), 0);
  const totalTx = filteredClients.reduce((sum, c) => sum + (c.txBytes || 0), 0);
  const guestCount = filteredClients.filter((c) => c.isGuest).length;
  const activeCount = filteredClients.filter((c) => !c.isBlocked).length;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="relative pb-16">
      {/* Toast Alert */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thiết bị khách</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {clients.length} thiết bị
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý và điều khiển trực tiếp client đang kết nối qua UniFi Controller
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchClients}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg  transition-all text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 ">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên thiết bị, MAC, IP, SSID, AP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">Tất cả loại kết nối</option>
              <option value="wireless">Không dây (WiFi)</option>
              <option value="wired">Có dây (Wired LAN)</option>
              <option value="guest">Khách vãng lai (Guest)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Không bị chặn</option>
              <option value="blocked">Đã bị chặn (Blocked)</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 ">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng kết nối</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{filteredClients.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 ">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Không bị chặn</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4 ">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Guest Portal</span>
            <Wifi className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{guestCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 ">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng TX (gửi)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-slate-900">{formatBytes(totalTx)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 ">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng RX (nhận)</span>
            <ArrowDownLeft className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-xl font-bold text-slate-900">{formatBytes(totalRx)}</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Thiết bị</th>
                <th className="px-5 py-3.5">IP / MAC</th>
                <th className="px-5 py-3.5">Loại</th>
                <th className="px-5 py-3.5">SSID / AP</th>
                <th className="px-5 py-3.5">Sóng & Signal</th>
                <th className="px-5 py-3.5">Tổng lưu lượng</th>
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-center">Thao tác Controller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredClients.map((client) => {
                const Icon = getDeviceIcon(client.hostname, client.osName, client.oui);
                const sig = getSignalLabel(client.signal);
                const isSelected = selectedClient?.mac === client.mac;

                return (
                  <tr
                    key={client._id || client.mac}
                    onClick={() => setSelectedClient(client)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-slate-600">
                          <DeviceIcon device={{ type: "client", name: client.name || client.hostname, meta: { hostname: client.hostname, osName: client.osName, osClass: client.osClass, oui: client.oui } }} size={36} fallback={<Icon className="w-6 h-6" />} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-semibold text-slate-900 leading-tight">
                              {client.name || client.hostname || 'Thiết bị không rõ'}
                            </p>
                            {client.name && (
                              <span className="text-[11px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">
                                {client.hostname}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {client.oui || client.osName || 'Standard Client'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-mono text-xs font-semibold text-slate-700">{client.ip || '-'}</p>
                      <p className="font-mono text-[11px] text-slate-500 mt-0.5">{client.mac}</p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        {client.isWired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            <WifiOff className="w-3 h-3 text-slate-500" /> Wired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-100">
                            <Wifi className="w-3 h-3 text-sky-500" /> WiFi
                          </span>
                        )}
                        {client.isGuest && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Guest
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {client.ssid ? (
                        <div>
                          <p className="text-xs font-medium text-slate-800">{client.ssid}</p>
                          <p className="text-[11px] text-blue-600 mt-0.5 font-medium">
                            {client.apName || client.apMac || '-'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {client.signal ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Signal className={`w-3.5 h-3.5 ${sig.color}`} />
                            <span className="text-xs font-semibold text-slate-800">{client.signal} dBm</span>
                            <span className={`text-[11px] font-medium ${sig.color}`}>({sig.text})</span>
                          </div>
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sig.percent > 70 ? 'bg-emerald-500' : sig.percent > 40 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${sig.percent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1 text-emerald-600 font-medium">
                          <span>↑</span>
                          <span>{formatBytes(client.txBytes || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sky-600 font-medium">
                          <span>↓</span>
                          <span>{formatBytes(client.rxBytes || 0)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {client.uptime > 0 ? formatUptime(client.uptime) : '-'}
                    </td>

                    <td className="px-5 py-4">
                      {client.isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="w-3 h-3 text-rose-500" /> Chặn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Không bị chặn
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Chi tiết button */}
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Xem toàn bộ chi tiết"
                        >
                          <Info className="w-4 h-4" />
                        </button>

                        {/* Block/Unblock */}
                        <button
                          onClick={() => {
                            if (confirm(client.isBlocked ? `Bỏ chặn cho ${client.mac}?` : `Chặn thiết bị ${client.mac}?`)) {
                              handleClientAction(client.mac, client.isBlocked ? 'unblock' : 'block');
                            }
                          }}
                          disabled={actionLoading === client.mac}
                          className={`p-1.5 rounded-lg transition-colors ${
                            client.isBlocked
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-rose-600 hover:bg-rose-50'
                          }`}
                          title={client.isBlocked ? 'Bỏ chặn (Unblock)' : 'Chặn (Block)'}
                        >
                          {client.isBlocked ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                        </button>

                        {/* Kick / Reconnect */}
                        <button
                          onClick={() => {
                            if (confirm(`Yêu cầu Controller ngắt & kết nối lại client ${client.mac}?`)) {
                              handleClientAction(client.mac, 'reconnect');
                            }
                          }}
                          disabled={actionLoading === client.mac}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Reconnect / Kick client"
                        >
                          <RefreshCcw className={`w-4 h-4 ${actionLoading === client.mac ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Edit Note & Name */}
                        <button
                          onClick={() => {
                            setEditModal({ open: true, client });
                            setEditName(client.name || client.hostname || '');
                            setEditNote(client.note || '');
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Đổi tên & Ghi chú"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && !loading && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Không tìm thấy thiết bị kết nối</h3>
            <p className="text-slate-500 text-xs mt-1">Vui lòng thử tìm kiếm khác hoặc kiểm tra lại bộ lọc</p>
          </div>
        )}
      </div>

      {/* Slide-over Detailed Drawer for Client */}
      <AnimatePresence>
        {selectedClient && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClient(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200"
              >
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600  shrink-0">
                      {(() => {
                        const Icon = getDeviceIcon(selectedClient.hostname, selectedClient.osName, selectedClient.oui);
                        return <DeviceIcon device={{ type: "client", name: selectedClient.name || selectedClient.hostname, meta: { hostname: selectedClient.hostname, osName: selectedClient.osName, osClass: selectedClient.osClass, oui: selectedClient.oui } }} size={52} fallback={<Icon className="w-8 h-8" />} />;
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">
                          {selectedClient.name || selectedClient.hostname || 'Thiết bị khách'}
                        </h2>
                        {selectedClient.isBlocked ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">
                            BLOCKED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700">
                            KHÔNG BỊ CHẶN
                          </span>
                        )}
                        {selectedClient.isGuest && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700">
                            GUEST
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        IP: {selectedClient.ip || 'Chưa có IP'} &bull; MAC: {selectedClient.mac}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Nhà sản xuất: {selectedClient.oui || 'Chưa nhận diện'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedClient(null)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Quick Action Controller Bar */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                      Lệnh điều khiển Controller
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => {
                          if (confirm(`Gửi lệnh Reconnect / Kick thiết bị ${selectedClient.mac}?`)) {
                            handleClientAction(selectedClient.mac, 'reconnect');
                          }
                        }}
                        disabled={actionLoading === selectedClient.mac}
                        className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-700 text-xs font-semibold transition-all "
                      >
                        <RefreshCcw className={`w-4 h-4 text-amber-500 mb-1 ${actionLoading === selectedClient.mac ? 'animate-spin' : ''}`} />
                        Kick / Reconnect
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(selectedClient.isBlocked ? 'Bỏ chặn client này?' : 'Chặn client này truy cập WiFi?')) {
                            handleClientAction(selectedClient.mac, selectedClient.isBlocked ? 'unblock' : 'block');
                          }
                        }}
                        disabled={actionLoading === selectedClient.mac}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold transition-all  ${
                          selectedClient.isBlocked
                            ? 'hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700'
                            : 'hover:bg-rose-50 hover:border-rose-300 text-rose-700'
                        }`}
                      >
                        {selectedClient.isBlocked ? (
                          <>
                            <UserCheck className="w-4 h-4 text-emerald-500 mb-1" />
                            Bỏ chặn (Unblock)
                          </>
                        ) : (
                          <>
                            <UserX className="w-4 h-4 text-rose-500 mb-1" />
                            Chặn (Block)
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          handleClientAction(selectedClient.mac, selectedClient.authorized ? 'unauthorize' : 'authorize');
                        }}
                        disabled={actionLoading === selectedClient.mac}
                        className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-700 text-xs font-semibold transition-all "
                      >
                        <ShieldCheck className="w-4 h-4 text-blue-500 mb-1" />
                        {selectedClient.authorized ? 'Hủy Guest Auth' : 'Cấp Guest Auth'}
                      </button>

                      <button
                        onClick={() => {
                          setEditModal({ open: true, client: selectedClient });
                          setEditName(selectedClient.name || selectedClient.hostname || '');
                          setEditNote(selectedClient.note || '');
                        }}
                        className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all "
                      >
                        <Edit3 className="w-4 h-4 text-slate-500 mb-1" />
                        Đổi tên & Note
                      </button>
                    </div>
                  </div>

                  {/* Section 1: WiFi & Signal Performance */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Signal className="w-4 h-4 text-blue-600" />
                        <h3 className="font-bold text-slate-900 text-sm">Chất lượng sóng & Tín hiệu WiFi</h3>
                      </div>
                      <span className="text-xs font-bold text-slate-600">
                        {selectedClient.channel ? `Kênh: ${selectedClient.channel}` : 'WiFi LAN'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-xs text-slate-500 block mb-1">Cường độ RSSI</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold text-slate-900">{selectedClient.signal} dBm</span>
                          <span className={`text-xs font-semibold ${getSignalLabel(selectedClient.signal).color}`}>
                            {getSignalLabel(selectedClient.signal).text}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${getSignalLabel(selectedClient.signal).percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-xs text-slate-500 block mb-1">Tỷ lệ hài lòng (Satisfaction)</span>
                        <span className="text-xl font-bold text-slate-900">
                          {selectedClient.satisfaction !== undefined ? `${selectedClient.satisfaction}%` : 'Chưa có dữ liệu'}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">Chỉ số do Controller cung cấp</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-xs text-slate-500 block mb-1">Tốc độ liên kết TX</span>
                        <span className="text-sm font-bold text-slate-800">
                          {selectedClient.txRate ? `${Math.round(selectedClient.txRate / 1000)} Mbps` : 'Chưa có dữ liệu'}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-xs text-slate-500 block mb-1">Băng tần (Band)</span>
                        <span className="text-sm font-bold text-slate-800">
                          {selectedClient.radio || (selectedClient.channel ? `Kênh ${selectedClient.channel}` : 'Chưa có dữ liệu')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: AP & Network Connection */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Radio className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Điểm phát sóng (AP) & Mạng kết nối</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Access Point liên kết</span>
                        <p className="font-bold text-slate-800 text-sm">{selectedClient.apName || '-'}</p>
                        <p className="font-mono text-slate-500 text-[11px]">{selectedClient.apMac}</p>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Tên mạng (SSID)</span>
                        <p className="font-bold text-slate-800 text-sm">{selectedClient.ssid || '-'}</p>
                        <p className="font-mono text-slate-500 text-[11px]">{selectedClient.bssid || '-'}</p>
                      </div>

                      <div className="pt-2">
                        <span className="text-slate-500 block mb-0.5">Địa chỉ IP</span>
                        <p className="font-mono font-bold text-slate-800">{selectedClient.ip || 'Chưa cấp IP'}</p>
                      </div>

                      <div className="pt-2">
                        <span className="text-slate-500 block mb-0.5">Địa chỉ MAC vật lý</span>
                        <p className="font-mono font-bold text-slate-800">{selectedClient.mac}</p>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Phân loại mạng</span>
                        <p className="font-semibold text-slate-800">{selectedClient.networkName || 'Chưa có dữ liệu'}</p>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Thời gian hoạt động (Uptime)</span>
                        <p className="font-semibold text-slate-800">
                          {selectedClient.uptime ? formatUptime(selectedClient.uptime) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Traffic & Packets */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <HardDrive className="w-4 h-4 text-sky-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Lưu lượng & Gói tin chi tiết</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1">
                          <ArrowUpRight className="w-4 h-4" /> Tổng TX (gửi)
                        </div>
                        <p className="text-lg font-bold text-slate-900">{formatBytes(selectedClient.txBytes || 0)}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedClient.txPackets ? selectedClient.txPackets.toLocaleString() : 0} gói tin (packets)
                        </p>
                      </div>

                      <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100">
                        <div className="flex items-center gap-1.5 text-sky-700 font-bold text-xs mb-1">
                          <ArrowDownLeft className="w-4 h-4" /> Tổng RX (nhận)
                        </div>
                        <p className="text-lg font-bold text-slate-900">{formatBytes(selectedClient.rxBytes || 0)}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedClient.rxPackets ? selectedClient.rxPackets.toLocaleString() : 0} gói tin (packets)
                        </p>
                      </div>
                    </div>

                    {selectedClient.note && (
                      <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                        <span className="font-bold text-amber-900 block mb-1">Ghi chú quản trị:</span>
                        <p className="text-amber-800">{selectedClient.note}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">UniFi Network Controller Sync</span>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Đóng chi tiết
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Note & Alias Modal */}
      <AnimatePresence>
        {editModal.open && editModal.client && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setEditModal({ open: false, client: null })}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Đổi tên & Ghi chú client</h3>
                </div>
                <button
                  onClick={() => setEditModal({ open: false, client: null })}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tên gợi nhớ (Alias / Name)
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="VD: iPhone Giám Đốc, Laptop Kế Toán..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tên này sẽ hiển thị thay thế cho hostname trong Controller
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Ghi chú chi tiết (Note)
                  </label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    placeholder="Nhập thông tin nhân viên, phòng ban, phòng họp..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setEditModal({ open: false, client: null })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold  transition-all disabled:opacity-50"
                  >
                    {isSavingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Lưu vào Controller
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
