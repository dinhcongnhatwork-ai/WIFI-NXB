'use client';

import { useEffect, useState, useCallback } from 'react';
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
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Monitor,
  Settings,
  X,
  WifiOff,
  Zap,
} from 'lucide-react';
import { formatBytes, formatUptime, getDeviceStatusColor } from '@/lib/unifi';

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
  txBytes?: number;
  rxBytes?: number;
  cpuUsage?: number;
  memUsage?: number;
  radioTable?: Array<{
    radio: string;
    name: string;
    channel?: number;
    txPower?: number;
    isEnabled: boolean;
  }>;
  portTable?: Array<{
    port_idx: number;
    name: string;
    enable?: boolean;
    up?: boolean;
    poe?: boolean;
    speed?: number;
    mac?: string;
    ip?: string;
  }>;
  uplink?: {
    uplinkType: string;
    ip: string;
    mac: string;
  };
}

export default function UnifiDevicesPage() {
  const [devices, setDevices] = useState<UnifiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<UnifiDevice | null>(null);
  const [deviceMenu, setDeviceMenu] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{ open: boolean; device: UnifiDevice | null }>({ open: false, device: null });
  const [editName, setEditName] = useState('');

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/unifi/devices');
      const json = await res.json();

      if (json.success) {
        setDevices(json.data);
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
      const res = await fetch('/api/unifi/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, deviceId, ...data }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchDevices();
      } else {
        alert(json.error || 'Action failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
      setDeviceMenu(null);
    }
  };

  const handleRename = async () => {
    if (!editModal.device || !editName.trim()) return;
    await handleDeviceAction(editModal.device._id, 'rename', { name: editName.trim() });
    setEditModal({ open: false, device: null });
    setEditName('');
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = !search ||
      device.name.toLowerCase().includes(search.toLowerCase()) ||
      device.mac.toLowerCase().includes(search.toLowerCase()) ||
      (device.ipAddress && device.ipAddress.includes(search));

    const matchesType = filterType === 'all' ||
      device.type.toLowerCase() === filterType.toLowerCase();

    const matchesStatus = filterStatus === 'all' ||
      device.status.toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesType && matchesStatus;
  });

  const groupedDevices = {
    ap: filteredDevices.filter(d => d.type === 'uap'),
    switch: filteredDevices.filter(d => d.type === 'usw'),
    gateway: filteredDevices.filter(d => d.type === 'ugw' || d.type === 'udm'),
    other: filteredDevices.filter(d => !['uap', 'usw', 'ugw', 'udm'].includes(d.type)),
  };

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

  const DeviceCard = ({ device }: { device: UnifiDevice }) => {
    const Icon = getDeviceIcon(device.type);
    const isOnline = device.status === 'online';
    const totalClients = (device.userNumSta || 0) + (device.guestNumSta || 0);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-white rounded-xl border ${isOnline ? 'border-slate-200' : 'border-red-200'} overflow-hidden hover:shadow-md transition-shadow`}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isOnline ? 'bg-purple-100' : 'bg-red-100'
              }`}>
                <Icon className={`w-6 h-6 ${isOnline ? 'text-purple-600' : 'text-red-500'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{device.name || 'Unnamed'}</h3>
                <p className="text-sm text-slate-500">{device.model || device.type.toUpperCase()}</p>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setDeviceMenu(deviceMenu === device._id ? null : device._id)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>

              <AnimatePresence>
                {deviceMenu === device._id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10"
                  >
                    <button
                      onClick={() => {
                        setEditModal({ open: true, device });
                        setEditName(device.name || '');
                        setDeviceMenu(null);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="w-4 h-4" />
                      Đổi tên
                    </button>
                    <button
                      onClick={() => handleDeviceAction(device._id, 'led', { settings: { enabled: true } })}
                      disabled={actionLoading === device._id}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Power className="w-4 h-4" />
                      LED On/Off
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Reboot thiết bị này?')) {
                          handleDeviceAction(device._id, 'reboot');
                        }
                      }}
                      disabled={actionLoading === device._id}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Khởi động lại
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Nâng cấp firmware?')) {
                          handleDeviceAction(device._id, 'upgrade');
                        }
                      }}
                      disabled={actionLoading === device._id}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      <Zap className="w-4 h-4" />
                      Nâng cấp firmware
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        if (confirm('Xóa thiết bị khỏi controller?')) {
                          handleDeviceAction(device._id, 'forget');
                        }
                      }}
                      disabled={actionLoading === device._id}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa thiết bị
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Trạng thái</span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                isOnline
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {device.ipAddress && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">IP Address</span>
                <span className="text-sm font-mono text-slate-700">{device.ipAddress}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">MAC</span>
              <span className="text-sm font-mono text-slate-700">{device.mac}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Clients</span>
              <span className="text-sm font-medium text-slate-700">{totalClients}</span>
            </div>

            {device.uptime > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Uptime</span>
                <span className="text-sm text-slate-700">{formatUptime(device.uptime)}</span>
              </div>
            )}

            {device.firmwareVersion && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Firmware</span>
                <span className="text-sm text-slate-700">{device.firmwareVersion}</span>
              </div>
            )}

            {(device.txBytes || device.rxBytes) && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-500">Traffic</span>
                <span className="text-sm text-slate-700">
                  <span className="text-green-600">↑{formatBytes(device.txBytes || 0)}</span>
                  {' / '}
                  <span className="text-blue-600">↓{formatBytes(device.rxBytes || 0)}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setSelectedDevice(selectedDevice?._id === device._id ? null : device)}
          className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4" />
          {selectedDevice?._id === device._id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
        </button>

        <AnimatePresence>
          {selectedDevice?._id === device._id && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden border-t border-slate-200"
            >
              <div className="p-5 space-y-4">
                {device.radioTable && device.radioTable.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Radio Settings</h4>
                    <div className="space-y-2">
                      {device.radioTable.map((radio, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-medium">{radio.name || radio.radio}</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              radio.isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {radio.isEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            {radio.channel && <span>Channel: {radio.channel}</span>}
                            {radio.txPower && <span>Power: {radio.txPower} dBm</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {device.portTable && device.portTable.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Port Status</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {device.portTable.map((port) => (
                        <div
                          key={port.port_idx}
                          className={`p-2 rounded-lg text-center ${
                            port.up ? 'bg-green-50' : 'bg-slate-100'
                          }`}
                        >
                          <p className="text-xs font-medium text-slate-700">Port {port.port_idx}</p>
                          <p className={`text-xs ${port.up ? 'text-green-600' : 'text-slate-400'}`}>
                            {port.up ? `${port.speed || 'Up'} Mbps` : 'Down'}
                          </p>
                          {port.poe && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">
                              PoE
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {device.uplink && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Uplink</h4>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">{device.uplink.uplinkType}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">MAC:</span>
                        <span className="font-mono">{device.uplink.mac}</span>
                        <span className="text-slate-500">IP:</span>
                        <span className="font-mono">{device.uplink.ip}</span>
                      </div>
                    </div>
                  </div>
                )}

                {device.cpuUsage !== undefined && device.memUsage !== undefined && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">System Resources</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">CPU</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${device.cpuUsage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{device.cpuUsage}%</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Memory</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${device.memUsage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{device.memUsage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Đang tải thiết bị...</p>
        </div>
      </div>
    );
  }

  if (error && devices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8">
        <div className="flex flex-col items-center text-center">
          <WifiOff className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Không thể tải thiết bị</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <button
            onClick={fetchDevices}
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
          <h1 className="text-2xl font-bold text-slate-900">Thiết bị</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý thiết bị UniFi</p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm thiết bị..."
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
              <option value="uap">Access Points</option>
              <option value="usw">Switches</option>
              <option value="ugw">Gateways</option>
              <option value="udm">Dream Machine</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{devices.length}</p>
          <p className="text-xs text-slate-500">Tổng thiết bị</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{devices.filter(d => d.status === 'online').length}</p>
          <p className="text-xs text-slate-500">Online</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{devices.filter(d => d.status !== 'online').length}</p>
          <p className="text-xs text-slate-500">Offline</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {devices.reduce((sum, d) => sum + (d.userNumSta || 0) + (d.guestNumSta || 0), 0)}
          </p>
          <p className="text-xs text-slate-500">Tổng Clients</p>
        </div>
      </div>

      {/* Device List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDevices.map((device) => (
            <DeviceCard key={device._id} device={device} />
          ))}
        </AnimatePresence>
      </div>

      {filteredDevices.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Server className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">Không tìm thấy thiết bị</h3>
          <p className="text-slate-500">Thử thay đổi bộ lọc hoặc tìm kiếm</p>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditModal({ open: false, device: null })}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Đổi tên thiết bị</h3>
                <button
                  onClick={() => setEditModal({ open: false, device: null })}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên mới</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Nhập tên thiết bị"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setEditModal({ open: false, device: null })}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleRename}
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
