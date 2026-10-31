'use client';
import { networkFetch } from '@/components/network/client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Wifi,
  Radio,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Power,
  Trash2,
  CheckCircle,
  XCircle,
  Monitor,
  Settings,
  X,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Cpu,
  HardDrive,
  Lightbulb,
  Sliders,
  Users,
  Signal,
  CheckCircle2,
  AlertTriangle,
  Cable,
  Sparkles,
} from 'lucide-react';
import { formatBytes, formatUptime } from '@/lib/network/format';

interface UnifiDevice {
  _id: string;
  deviceId?: string;
  name: string;
  type: string;
  status: string;
  mac: string;
  serialNumber?: string;
  ipAddress?: string;
  model?: string;
  firmwareVersion?: string;
  uptime: number;
  userNumSta?: number;
  guestNumSta?: number;
  numSta?: number;
  txBytes?: number;
  rxBytes?: number;
  cpuUsage?: number;
  memUsage?: number;
  radioTable?: Array<{
    radio: string;
    name?: string;
    channel?: number;
    txPower?: number;
    isEnabled?: boolean;
    antennaGain?: number;
    ht?: string;
  }>;
  portTable?: Array<{
    port_idx: number;
    name?: string;
    enable?: boolean;
    up?: boolean;
    poe?: boolean;
    poe_power?: string;
    speed?: number;
    mac?: string;
    ip?: string;
    full_duplex?: boolean;
  }>;
  vapTable?: Array<{
    name: string;
    bssid: string;
    radio: string;
    num_sta?: number;
    essid?: string;
  }>;
  uplink?: {
    uplinkType?: string;
    ip?: string;
    mac?: string;
    name?: string;
    speed?: number;
    full_duplex?: boolean;
  };
  locating?: boolean;
}

export default function UnifiDevicesPage() {
  const [devices, setDevices] = useState<UnifiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<UnifiDevice | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'radios' | 'ports' | 'ssids'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Rename Modal
  const [renameModal, setRenameModal] = useState<{ open: boolean; device: UnifiDevice | null }>({
    open: false,
    device: null,
  });
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/unifi/devices');
      const json = await res.json();

      if (json.success) {
        setDevices(json.data);
        // Sync selected device if drawer is open
        setSelectedDevice((prev) => {
          if (!prev) return null;
          return json.data.find((d: UnifiDevice) => d._id === prev._id || d.mac === prev.mac) || prev;
        });
      } else {
        setError(json.error || 'Failed to fetch devices');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleDeviceAction = async (deviceId: string, action: string, data?: Record<string, unknown>) => {
    try {
      setActionLoading(deviceId);
      const res = await networkFetch('/api/unifi/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, deviceId, ...data }),
      });
      const json = await res.json();

      if (json.success) {
        let actionMsg = `Thao tác ${action} thành công`;
        if (action === 'restart' || action === 'reboot') actionMsg = 'Đã gửi lệnh Khởi động lại (Restart) tới Controller';
        else if (action === 'locate') actionMsg = 'Đã thay đổi trạng thái nháy đèn định vị (Locate LED)';
        else if (action === 'force-provision' || action === 'provision') actionMsg = 'Đã kích hoạt đồng bộ cấu hình (Force Provision)';
        else if (action === 'rename') actionMsg = 'Đã đổi tên thiết bị thành công trong Controller';

        showToast('success', actionMsg);
        await fetchDevices();
      } else {
        showToast('error', json.error || 'Thao tác Controller thất bại');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối Controller');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameModal.device || !newName.trim()) return;
    try {
      setIsRenaming(true);
      await handleDeviceAction(renameModal.device._id, 'rename', { name: newName.trim() });
      setRenameModal({ open: false, device: null });
      setNewName('');
    } finally {
      setIsRenaming(false);
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        device.name.toLowerCase().includes(q) ||
        device.mac.toLowerCase().includes(q) ||
        (device.ipAddress && device.ipAddress.includes(q)) ||
        (device.model && device.model.toLowerCase().includes(q));

      const matchesType =
        filterType === 'all' || device.type.toLowerCase() === filterType.toLowerCase();

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'online' && (device.status === 'online' || device.status === 'connected')) ||
        (filterStatus === 'offline' && device.status !== 'online' && device.status !== 'connected');

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [devices, search, filterType, filterStatus]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === 'online' || d.status === 'connected').length;
    const offline = total - online;
    const clients = devices.reduce((sum, d) => sum + (d.userNumSta || d.numSta || 0), 0);
    return { total, online, offline, clients };
  }, [devices]);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'uap':
        return Wifi;
      case 'usw':
        return Zap;
      case 'ugw':
      case 'udm':
        return Server;
      default:
        return Monitor;
    }
  };

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
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 backdrop-blur-md'
                : 'bg-rose-950/90 text-rose-200 border-rose-500/40 backdrop-blur-md'
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thiết bị UniFi</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {devices.length} thiết bị
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý phần cứng, giám sát tài nguyên và đồng bộ điều khiển UniFi Controller
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên AP, model, MAC, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">Tất cả loại thiết bị</option>
              <option value="uap">Access Points (UAP)</option>
              <option value="usw">Switches (USW)</option>
              <option value="ugw">Gateways (UGW/UDM)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng thiết bị</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Online</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.online}</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-100 p-4 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Offline</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600">{stats.offline}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng Clients phục vụ</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.clients}</p>
        </div>
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDevices.map((device) => {
          const isOnline = device.status === 'online' || device.status === 'connected';
          const Icon = getDeviceIcon(device.type);
          const totalClients = (device.userNumSta || device.numSta || 0) + (device.guestNumSta || 0);

          return (
            <motion.div
              key={device._id}
              layout
              className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden flex flex-col justify-between ${
                isOnline ? 'border-slate-200' : 'border-rose-200 bg-rose-50/10'
              }`}
            >
              <div className="p-5">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                        isOnline
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'bg-rose-50 border-rose-200 text-rose-500'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base leading-snug">
                          {device.name || 'Unnamed AP'}
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-medium text-slate-500">
                        {device.model || device.type.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${
                      isOnline
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}
                    />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                {/* Details specs */}
                <div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">IP Address:</span>
                    <span className="font-mono font-bold text-slate-800">{device.ipAddress || 'DHCP'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">MAC Address:</span>
                    <span className="font-mono text-slate-700">{device.mac}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Clients kết nối:</span>
                    <span className="font-bold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-md">
                      {totalClients} clients
                    </span>
                  </div>

                  {device.uptime > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Uptime:</span>
                      <span className="text-slate-700 font-medium">{formatUptime(device.uptime)}</span>
                    </div>
                  )}

                  {/* CPU / MEM Gauges */}
                  {(device.cpuUsage !== undefined || device.memUsage !== undefined) && (
                    <div className="pt-2 grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-2 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">CPU</span>
                          <span className="text-xs font-bold text-slate-800">{device.cpuUsage || 0}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, device.cpuUsage || 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase">RAM</span>
                          <span className="text-xs font-bold text-slate-800">{device.memUsage || 0}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, device.memUsage || 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setSelectedDevice(device);
                    setActiveTab('overview');
                  }}
                  className="flex-1 py-1.5 px-3 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Xem chi tiết & Cấu hình
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Gửi lệnh Khởi động lại (Restart) thiết bị ${device.name}?`)) {
                      handleDeviceAction(device._id, 'restart');
                    }
                  }}
                  disabled={actionLoading === device._id}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition-colors"
                  title="Khởi động lại AP"
                >
                  <RefreshCw className={`w-4 h-4 ${actionLoading === device._id ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={() => {
                    handleDeviceAction(device._id, 'locate', { locate: !device.locating });
                  }}
                  disabled={actionLoading === device._id}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                  title="Nháy đèn LED định vị"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setRenameModal({ open: true, device });
                    setNewName(device.name || '');
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Đổi tên thiết bị"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Device Detailed Drawer */}
      <AnimatePresence>
        {selectedDevice && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDevice(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200"
              >
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                      {(() => {
                        const Icon = getDeviceIcon(selectedDevice.type);
                        return <Icon className="w-7 h-7" />;
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">{selectedDevice.name}</h2>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            selectedDevice.status === 'online' || selectedDevice.status === 'connected'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {selectedDevice.status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Model: {selectedDevice.model || 'U7'} &bull; MAC: {selectedDevice.mac}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        IP: {selectedDevice.ipAddress || 'DHCP'} &bull; Firmware: {selectedDevice.firmwareVersion || 'v1.x'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedDevice(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Controller Action Bar */}
                <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (confirm(`Gửi lệnh Khởi động lại (Restart) thiết bị ${selectedDevice.name}?`)) {
                        handleDeviceAction(selectedDevice._id, 'restart');
                      }
                    }}
                    disabled={actionLoading === selectedDevice._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === selectedDevice._id ? 'animate-spin' : ''}`} />
                    Khởi động lại (Restart)
                  </button>

                  <button
                    onClick={() => {
                      handleDeviceAction(selectedDevice._id, 'locate', { locate: !selectedDevice.locating });
                    }}
                    disabled={actionLoading === selectedDevice._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Nháy đèn định vị
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Kích hoạt đồng bộ cấu hình (Force Provision) cho ${selectedDevice.name}?`)) {
                        handleDeviceAction(selectedDevice._id, 'force-provision');
                      }
                    }}
                    disabled={actionLoading === selectedDevice._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Force Provision
                  </button>

                  <button
                    onClick={() => {
                      setRenameModal({ open: true, device: selectedDevice });
                      setNewName(selectedDevice.name || '');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Đổi tên AP
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6 bg-white">
                  {[
                    { id: 'overview', label: 'Tổng quan & Phần cứng' },
                    { id: 'radios', label: 'Radio & Sóng WiFi' },
                    { id: 'ports', label: 'Cổng & PoE' },
                    { id: 'ssids', label: 'Mạng phát (SSIDs)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Drawer Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === 'overview' && (
                    <div className="space-y-5">
                      {/* Live System Gauges */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-500" /> Tài nguyên hệ thống thời gian thực
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-500 font-medium">Tải CPU</span>
                              <span className="text-sm font-bold text-slate-900">{selectedDevice.cpuUsage || 0}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (selectedDevice.cpuUsage || 0) > 80
                                    ? 'bg-rose-500'
                                    : (selectedDevice.cpuUsage || 0) > 50
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${selectedDevice.cpuUsage || 0}%` }}
                              />
                            </div>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-500 font-medium">Bộ nhớ RAM</span>
                              <span className="text-sm font-bold text-slate-900">{selectedDevice.memUsage || 0}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${selectedDevice.memUsage || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Device Identification */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2">
                          Thông tin phần cứng & Firmware
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Model thiết bị:</span>
                            <span className="font-bold text-slate-800">{selectedDevice.model || 'UniFi AP'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">Số Serial (S/N):</span>
                            <span className="font-mono font-bold text-slate-800">
                              {selectedDevice.serialNumber || selectedDevice.mac.replace(/:/g, '').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">Firmware Version:</span>
                            <span className="font-mono text-slate-800">{selectedDevice.firmwareVersion || '-'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">Thời gian hoạt động (Uptime):</span>
                            <span className="text-slate-800 font-semibold">
                              {selectedDevice.uptime ? formatUptime(selectedDevice.uptime) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Uplink Connection */}
                      {selectedDevice.uplink && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
                            <Cable className="w-4 h-4 text-emerald-500" /> Uplink kết nối
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5">Loại liên kết:</span>
                              <span className="font-bold text-slate-800">
                                {selectedDevice.uplink.uplinkType || 'Ethernet Wire'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5">Tốc độ Uplink:</span>
                              <span className="font-bold text-emerald-600">
                                {selectedDevice.uplink.speed ? `${selectedDevice.uplink.speed} Mbps` : '1000 Mbps Full Duplex'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5">Uplink MAC:</span>
                              <span className="font-mono text-slate-700">{selectedDevice.uplink.mac || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5">Uplink IP:</span>
                              <span className="font-mono text-slate-700">{selectedDevice.uplink.ip || '-'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Traffic stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                          <span className="text-xs font-bold text-emerald-700 block mb-1">Tổng Upload</span>
                          <span className="text-xl font-bold text-slate-900">
                            {formatBytes(selectedDevice.txBytes || 0)}
                          </span>
                        </div>
                        <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-xl">
                          <span className="text-xs font-bold text-sky-700 block mb-1">Tổng Download</span>
                          <span className="text-xl font-bold text-slate-900">
                            {formatBytes(selectedDevice.rxBytes || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: RADIOS */}
                  {activeTab === 'radios' && (
                    <div className="space-y-4">
                      {selectedDevice.radioTable && selectedDevice.radioTable.length > 0 ? (
                        selectedDevice.radioTable.map((radio, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <div className="flex items-center gap-2">
                                <Radio className="w-4 h-4 text-blue-600" />
                                <h4 className="font-bold text-slate-900 text-sm">
                                  {radio.name || radio.radio.toUpperCase()} (
                                  {radio.radio === 'na' ? '5 GHz' : '2.4 GHz'})
                                </h4>
                              </div>
                              <span
                                className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                  radio.isEnabled !== false
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {radio.isEnabled !== false ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="text-slate-400 block mb-0.5">Kênh (Channel):</span>
                                <span className="font-bold text-slate-800">{radio.channel || 'Auto'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Công suất TX:</span>
                                <span className="font-bold text-slate-800">
                                  {radio.txPower ? `${radio.txPower} dBm` : 'Auto'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Độ rộng kênh (HT):</span>
                                <span className="font-bold text-slate-800">
                                  {radio.ht || (radio.radio === 'na' ? 'HE80 / VHT80' : 'HT20')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-8 text-slate-400 text-xs">
                          Không có bảng radio cho thiết bị này
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: PORTS */}
                  {activeTab === 'ports' && (
                    <div className="space-y-4">
                      {selectedDevice.portTable && selectedDevice.portTable.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedDevice.portTable.map((port) => (
                            <div
                              key={port.port_idx}
                              className={`p-3.5 rounded-xl border ${
                                port.up ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-800 text-xs">
                                  Port {port.port_idx} {port.name ? `(${port.name})` : ''}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    port.up ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                  }`}
                                >
                                  {port.up ? 'UP' : 'DOWN'}
                                </span>
                              </div>

                              <div className="text-xs space-y-1 text-slate-600">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Tốc độ:</span>
                                  <span className="font-semibold text-slate-800">
                                    {port.up ? `${port.speed || 1000} Mbps` : '-'}
                                  </span>
                                </div>
                                {port.poe && (
                                  <div className="flex justify-between text-amber-700">
                                    <span>PoE Cấp nguồn:</span>
                                    <span className="font-bold">{port.poe_power || 'Hoạt động'}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-8 text-slate-400 text-xs">
                          Không có thông tin cổng kết nối (Port Table)
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: SSIDS / VAPS */}
                  {activeTab === 'ssids' && (
                    <div className="space-y-3">
                      {selectedDevice.vapTable && selectedDevice.vapTable.length > 0 ? (
                        selectedDevice.vapTable.map((vap, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{vap.essid || vap.name}</p>
                              <p className="font-mono text-xs text-slate-500 mt-0.5">BSSID: {vap.bssid}</p>
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded mt-1 inline-block">
                                Radio: {vap.radio === 'na' ? '5 GHz' : '2.4 GHz'}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-xs text-slate-400 block mb-0.5">Khách kết nối</span>
                              <span className="text-lg font-bold text-blue-600">{vap.num_sta || 0}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-8 text-slate-400 text-xs">
                          Không có danh sách VAP / SSID phát sóng trên thiết bị này
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-400">UniFi Device Management</span>
                  <button
                    onClick={() => setSelectedDevice(null)}
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

      {/* Rename Modal */}
      <AnimatePresence>
        {renameModal.open && renameModal.device && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setRenameModal({ open: false, device: null })}
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
                  <Edit2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Đổi tên thiết bị UniFi</h3>
                </div>
                <button
                  onClick={() => setRenameModal({ open: false, device: null })}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tên thiết bị mới
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: AP10.1, AP_HoiTruong..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tên này sẽ được cập nhật trực tiếp vào UniFi Controller
                  </p>
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setRenameModal({ open: false, device: null })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleRenameSubmit}
                    disabled={isRenaming}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isRenaming && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Lưu tên mới
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
