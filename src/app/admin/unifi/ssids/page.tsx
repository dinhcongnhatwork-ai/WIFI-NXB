'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
} from 'lucide-react';
import { getSecurityTypeLabel } from '@/lib/unifi';

interface UnifiSsid {
  _id: string;
  name: string;
  ssid: string;
  security: string;
  enabled: boolean;
  isGuest: boolean;
  hiddenSSID?: boolean;
  wpaPsk?: string;
  wpaCipher?: string;
  wpaVersion?: string;
  vlanId?: number;
  vlanEnabled?: boolean;
  userGroupId?: string;
  userGroupName?: string;
  macFilterEnabled?: boolean;
  macFilterList?: string[];
  macFilterPolicy?: string;
  scheduleEnabled?: boolean;
  schedule?: string;
  minRSSI?: number;
  loadBalancingEnabled?: boolean;
  isolateClients?: boolean;
  dtim?: number;
  beaconInterval?: number;
  wlanBand?: string;
  wlangroupId?: string;
  wlangroupName?: string;
  authPortal?: string;
  captivePortalBypassEnabled?: boolean;
  portalEnabled?: boolean;
  wpa3Transition?: boolean;
}

const SECURITY_OPTIONS = [
  { value: 'open', label: 'Open (Không mật khẩu)' },
  { value: 'wpa2psk', label: 'WPA2 Personal' },
  { value: 'wpawpa2psk', label: 'WPA / WPA2 Personal' },
  { value: 'wpa3', label: 'WPA3 Personal' },
  { value: 'wpaeap', label: 'WPA Enterprise' },
];

const BAND_OPTIONS = [
  { value: '2g', label: '2.4 GHz' },
  { value: '5g', label: '5 GHz' },
  { value: '6g', label: '6 GHz' },
  { value: 'both', label: '2.4 GHz + 5 GHz' },
];

interface SsidModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

function SsidModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  loading,
  children,
}: SsidModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {submitLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function UnifiSsidsPage() {
  const [ssids, setSsids] = useState<UnifiSsid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSsid, setSelectedSsid] = useState<UnifiSsid | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; ssid: UnifiSsid | null }>({ open: false, ssid: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    security: 'open',
    passphrase: '',
    hiddenSSID: false,
    isGuest: false,
    enabled: true,
    vlanEnabled: false,
    vlanId: '',
    wlanBand: 'both',
    isolateClients: false,
    macFilterEnabled: false,
    macFilterList: '',
    macFilterPolicy: 'allow',
    minRSSI: 0,
    loadBalancingEnabled: false,
    scheduleEnabled: false,
    wpa3Transition: false,
  });

  const fetchSsids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/unifi/ssids');
      const json = await res.json();

      if (json.success) {
        setSsids(json.data);
      } else {
        setError(json.error || 'Failed to fetch SSIDs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSsids();
  }, [fetchSsids]);

  const handleSsidAction = async (id: string, action: string, data?: Record<string, unknown>) => {
    try {
      setActionLoading(id);
      const res = await fetch('/api/unifi/ssids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, ...data }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchSsids();
      } else {
        alert(json.error || 'Action failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSsid = async () => {
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên SSID');
      return;
    }
    if (formData.security !== 'open' && (!formData.passphrase || formData.passphrase.length < 8)) {
      alert('Mật khẩu bảo mật phải có ít nhất 8 ký tự');
      return;
    }

    try {
      setActionLoading('creating');
      const payload = {
        name: formData.name.trim(),
        security: formData.security,
        passphrase: formData.security === 'open' ? undefined : formData.passphrase,
        hideSsid: formData.hiddenSSID,
        isGuest: formData.isGuest,
        enabled: formData.enabled,
        vlanId: formData.vlanEnabled && formData.vlanId ? parseInt(formData.vlanId) : undefined,
        vlanEnabled: formData.vlanEnabled,
        wlanBand: formData.wlanBand,
        isolateClients: formData.isolateClients,
        macFilterEnabled: formData.macFilterEnabled,
        macFilterList: formData.macFilterList ? formData.macFilterList.split('\n').map(s => s.trim()).filter(Boolean) : [],
        macFilterPolicy: formData.macFilterPolicy,
        minRSSI: formData.minRSSI,
        loadBalancingEnabled: formData.loadBalancingEnabled,
        scheduleEnabled: formData.scheduleEnabled,
        wpa3Transition: formData.wpa3Transition,
      };

      const res = await fetch('/api/unifi/ssids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...payload }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchSsids();
        setCreateModal(false);
        resetForm();
      } else {
        alert(json.error || 'Không thể tạo SSID');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể tạo SSID');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateSsid = async () => {
    if (!editModal.ssid) return;
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên SSID');
      return;
    }
    if (formData.passphrase && formData.passphrase.length < 8) {
      alert('Mật khẩu mới phải có ít nhất 8 ký tự (hoặc để trống nếu không đổi)');
      return;
    }

    try {
      setActionLoading(editModal.ssid._id);
      const payload = {
        name: formData.name.trim(),
        security: formData.security,
        passphrase: formData.passphrase || undefined,
        hideSsid: formData.hiddenSSID,
        isGuest: formData.isGuest,
        enabled: formData.enabled,
        vlanId: formData.vlanEnabled && formData.vlanId ? parseInt(formData.vlanId) : undefined,
        vlanEnabled: formData.vlanEnabled,
        wlanBand: formData.wlanBand,
        isolateClients: formData.isolateClients,
        macFilterEnabled: formData.macFilterEnabled,
        macFilterList: formData.macFilterList ? formData.macFilterList.split('\n').map(s => s.trim()).filter(Boolean) : [],
        macFilterPolicy: formData.macFilterPolicy,
        minRSSI: formData.minRSSI,
        loadBalancingEnabled: formData.loadBalancingEnabled,
        scheduleEnabled: formData.scheduleEnabled,
        wpa3Transition: formData.wpa3Transition,
      };

      const res = await fetch('/api/unifi/ssids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: editModal.ssid._id, ...payload }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchSsids();
        setEditModal({ open: false, ssid: null });
        resetForm();
      } else {
        alert(json.error || 'Không thể cập nhật SSID');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật SSID');
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      security: 'open',
      passphrase: '',
      hiddenSSID: false,
      isGuest: false,
      enabled: true,
      vlanEnabled: false,
      vlanId: '',
      wlanBand: 'both',
      isolateClients: false,
      macFilterEnabled: false,
      macFilterList: '',
      macFilterPolicy: 'allow',
      minRSSI: 0,
      loadBalancingEnabled: false,
      scheduleEnabled: false,
      wpa3Transition: false,
    });
  };

  const openEditModal = (ssid: UnifiSsid) => {
    setFormData({
      name: ssid.ssid,
      security: ssid.security,
      passphrase: ssid.wpaPsk || '',
      hiddenSSID: ssid.hiddenSSID || false,
      isGuest: ssid.isGuest,
      enabled: ssid.enabled,
      vlanEnabled: ssid.vlanEnabled || false,
      vlanId: ssid.vlanId?.toString() || '',
      wlanBand: ssid.wlanBand || 'both',
      isolateClients: ssid.isolateClients || false,
      macFilterEnabled: ssid.macFilterEnabled || false,
      macFilterList: ssid.macFilterList?.join('\n') || '',
      macFilterPolicy: ssid.macFilterPolicy || 'allow',
      minRSSI: ssid.minRSSI || 0,
      loadBalancingEnabled: ssid.loadBalancingEnabled || false,
      scheduleEnabled: ssid.scheduleEnabled || false,
      wpa3Transition: ssid.wpa3Transition || false,
    });
    setEditModal({ open: true, ssid });
  };

  const filteredSsids = ssids.filter(ssid =>
    !search ||
    ssid.ssid.toLowerCase().includes(search.toLowerCase()) ||
    ssid.security.toLowerCase().includes(search.toLowerCase())
  );

  const activeSsids = ssids.filter(s => s.enabled).length;

  if (loading && ssids.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Đang tải SSID...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SSID / WiFi</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý mạng WiFi</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSsids}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Tạo SSID mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{ssids.length}</p>
          <p className="text-xs text-slate-500">Tổng SSID</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeSsids}</p>
          <p className="text-xs text-slate-500">Đang hoạt động</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{ssids.length - activeSsids}</p>
          <p className="text-xs text-slate-500">Tắt</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{ssids.filter(s => s.isGuest).length}</p>
          <p className="text-xs text-slate-500">Guest Network</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm SSID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* SSID List */}
      <div className="space-y-4">
        {filteredSsids.map((ssid) => (
          <motion.div
            key={ssid._id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`bg-white rounded-xl border overflow-hidden ${
              ssid.enabled ? 'border-slate-200' : 'border-slate-300 opacity-75'
            }`}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    ssid.enabled ? 'bg-purple-100' : 'bg-slate-100'
                  }`}>
                    <Wifi className={`w-7 h-7 ${ssid.enabled ? 'text-purple-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{ssid.ssid}</h3>
                      {ssid.hiddenSSID && (
                        <EyeOff className="w-4 h-4 text-slate-400" aria-label="Hidden SSID" />
                      )}
                      {ssid.isGuest && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          Guest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        {getSecurityTypeLabel(ssid.security)}
                      </span>
                      {ssid.wlanBand && (
                        <span>{BAND_OPTIONS.find(b => b.value === ssid.wlanBand)?.label || ssid.wlanBand}</span>
                      )}
                      {ssid.vlanEnabled && ssid.vlanId && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          VLAN {ssid.vlanId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSsidAction(ssid._id, ssid.enabled ? 'disable' : 'enable')}
                    disabled={actionLoading === ssid._id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      ssid.enabled
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {ssid.enabled ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                    {ssid.enabled ? 'Enabled' : 'Disabled'}
                  </button>

                  <button
                    onClick={() => openEditModal(ssid)}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Xóa SSID này?')) {
                        handleSsidAction(ssid._id, 'delete');
                      }
                    }}
                    disabled={actionLoading === ssid._id}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Show password toggle */}
              {ssid.wpaPsk && (ssid.security === 'wpa2psk' || ssid.security === 'wpapsk+ wpa2psk') && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Mật khẩu:</span>
                      <code className="text-sm font-mono text-slate-700">
                        {showPassword === ssid._id ? ssid.wpaPsk : '••••••••••'}
                      </code>
                    </div>
                    <button
                      onClick={() => setShowPassword(showPassword === ssid._id ? null : ssid._id)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      {showPassword === ssid._id ? (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Additional info */}
              <button
                onClick={() => setSelectedSsid(selectedSsid?._id === ssid._id ? null : ssid)}
                className="mt-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${selectedSsid?._id === ssid._id ? 'rotate-180' : ''}`} />
                {selectedSsid?._id === ssid._id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
              </button>

              <AnimatePresence>
                {selectedSsid?._id === ssid._id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500">MAC Filter</p>
                        <p className="text-sm font-medium text-slate-700">
                          {ssid.macFilterEnabled ? `${ssid.macFilterPolicy?.toUpperCase()} (${ssid.macFilterList?.length || 0} MACs)` : 'Disabled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Isolate Clients</p>
                        <p className="text-sm font-medium text-slate-700">
                          {ssid.isolateClients ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Load Balancing</p>
                        <p className="text-sm font-medium text-slate-700">
                          {ssid.loadBalancingEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      {ssid.minRSSI !== undefined && ssid.minRSSI > 0 && (
                        <div>
                          <p className="text-xs text-slate-500">Min RSSI</p>
                          <p className="text-sm font-medium text-slate-700">{ssid.minRSSI} dBm</p>
                        </div>
                      )}
                      {ssid.dtim && (
                        <div>
                          <p className="text-xs text-slate-500">DTIM</p>
                          <p className="text-sm font-medium text-slate-700">{ssid.dtim}</p>
                        </div>
                      )}
                      {ssid.beaconInterval && (
                        <div>
                          <p className="text-xs text-slate-500">Beacon Interval</p>
                          <p className="text-sm font-medium text-slate-700">{ssid.beaconInterval} ms</p>
                        </div>
                      )}
                      {ssid.wpa3Transition && (
                        <div>
                          <p className="text-xs text-slate-500">WPA3 Transition</p>
                          <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                            <ShieldCheck className="w-4 h-4" /> Enabled
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredSsids.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Wifi className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">Không có SSID nào</h3>
          <p className="text-slate-500 mb-4">Tạo SSID mới để bắt đầu</p>
          <button
            onClick={() => setCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Tạo SSID mới
          </button>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {createModal && (
          <SsidModal
            title="Tạo SSID mới"
            onClose={() => {
              setCreateModal(false);
              resetForm();
            }}
            onSubmit={handleCreateSsid}
            submitLabel={actionLoading === 'creating' ? 'Đang tạo...' : 'Tạo SSID'}
            submitDisabled={
              !formData.name.trim() ||
              (formData.security !== 'open' && (!formData.passphrase || formData.passphrase.length < 8)) ||
              actionLoading !== null
            }
            loading={actionLoading === 'creating'}
          >
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Thông tin cơ bản</h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên SSID *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="WiFi Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bảo mật</label>
                    <select
                      value={formData.security}
                      onChange={(e) => setFormData({ ...formData, security: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {SECURITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Band</label>
                    <select
                      value={formData.wlanBand}
                      onChange={(e) => setFormData({ ...formData, wlanBand: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {BAND_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!['open'].includes(formData.security) && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Mật khẩu * (ít nhất 8 ký tự)</label>
                      {formData.passphrase.length > 0 && formData.passphrase.length < 8 && (
                        <span className="text-xs text-rose-500 font-medium">Còn thiếu {8 - formData.passphrase.length} ký tự</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formData.passphrase.length > 0 && formData.passphrase.length < 8
                          ? 'border-rose-300 focus:ring-rose-500'
                          : 'border-slate-200 focus:ring-purple-500'
                      }`}
                      placeholder="Ít nhất 8 ký tự"
                    />
                    {formData.passphrase.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Mật khẩu WiFi yêu cầu tối thiểu 8 ký tự</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isGuest}
                      onChange={(e) => setFormData({ ...formData, isGuest: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Guest Network</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hiddenSSID}
                      onChange={(e) => setFormData({ ...formData, hiddenSSID: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Hidden SSID</span>
                  </label>
                </div>
              </div>

              {/* VLAN */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">VLAN</h4>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.vlanEnabled}
                    onChange={(e) => setFormData({ ...formData, vlanEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700">Enable VLAN</span>
                </label>

                {formData.vlanEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VLAN ID</label>
                    <input
                      type="number"
                      value={formData.vlanId}
                      onChange={(e) => setFormData({ ...formData, vlanId: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="1-4094"
                      min="1"
                      max="4094"
                    />
                  </div>
                )}
              </div>

              {/* Advanced */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Nâng cao</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isolateClients}
                      onChange={(e) => setFormData({ ...formData, isolateClients: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Isolate Clients</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.loadBalancingEnabled}
                      onChange={(e) => setFormData({ ...formData, loadBalancingEnabled: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Load Balancing</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MAC Filter</label>
                  <select
                    value={formData.macFilterEnabled ? formData.macFilterPolicy : 'disabled'}
                    onChange={(e) => setFormData({
                      ...formData,
                      macFilterEnabled: e.target.value !== 'disabled',
                      macFilterPolicy: e.target.value === 'disabled' ? 'allow' : e.target.value
                    })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="disabled">Disabled</option>
                    <option value="allow">Allow (chỉ cho phép MAC trong danh sách)</option>
                    <option value="deny">Deny (chặn MAC trong danh sách)</option>
                  </select>
                </div>

                {formData.macFilterEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">MAC Addresses (mỗi dòng 1 MAC)</label>
                    <textarea
                      value={formData.macFilterList}
                      onChange={(e) => setFormData({ ...formData, macFilterList: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={4}
                      placeholder="AA:BB:CC:DD:EE:FF&#10;11:22:33:44:55:66"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min RSSI (0 = disabled)</label>
                  <input
                    type="number"
                    value={formData.minRSSI}
                    onChange={(e) => setFormData({ ...formData, minRSSI: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                    min="0"
                    max="-20"
                  />
                </div>

                {(formData.security === 'wpa3' || formData.security === 'wpa3-ent') && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.wpa3Transition}
                      onChange={(e) => setFormData({ ...formData, wpa3Transition: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">WPA3 Transition Mode (cho phép WPA2 clients)</span>
                  </label>
                )}
              </div>
            </div>
          </SsidModal>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal.open && (
          <SsidModal
            title={`Chỉnh sửa: ${editModal.ssid?.ssid}`}
            onClose={() => {
              setEditModal({ open: false, ssid: null });
              resetForm();
            }}
            onSubmit={handleUpdateSsid}
            submitLabel={actionLoading === editModal.ssid?._id ? 'Đang lưu...' : 'Lưu thay đổi'}
            submitDisabled={
              !formData.name.trim() ||
              (Boolean(formData.passphrase) && formData.passphrase.length < 8) ||
              actionLoading !== null
            }
            loading={actionLoading === editModal.ssid?._id}
          >
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Thông tin cơ bản</h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên SSID *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bảo mật</label>
                    <select
                      value={formData.security}
                      onChange={(e) => setFormData({ ...formData, security: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {SECURITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Band</label>
                    <select
                      value={formData.wlanBand}
                      onChange={(e) => setFormData({ ...formData, wlanBand: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {BAND_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!['open'].includes(formData.security) && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Mật khẩu mới (để trống nếu không đổi)</label>
                      {formData.passphrase.length > 0 && formData.passphrase.length < 8 && (
                        <span className="text-xs text-rose-500 font-medium">Còn thiếu {8 - formData.passphrase.length} ký tự</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formData.passphrase.length > 0 && formData.passphrase.length < 8
                          ? 'border-rose-300 focus:ring-rose-500'
                          : 'border-slate-200 focus:ring-purple-500'
                      }`}
                      placeholder="Ít nhất 8 ký tự"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isGuest}
                      onChange={(e) => setFormData({ ...formData, isGuest: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Guest Network</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hiddenSSID}
                      onChange={(e) => setFormData({ ...formData, hiddenSSID: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Hidden SSID</span>
                  </label>
                </div>
              </div>

              {/* VLAN */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">VLAN</h4>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.vlanEnabled}
                    onChange={(e) => setFormData({ ...formData, vlanEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700">Enable VLAN</span>
                </label>

                {formData.vlanEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VLAN ID</label>
                    <input
                      type="number"
                      value={formData.vlanId}
                      onChange={(e) => setFormData({ ...formData, vlanId: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="1-4094"
                      min="1"
                      max="4094"
                    />
                  </div>
                )}
              </div>

              {/* Advanced */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Nâng cao</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isolateClients}
                      onChange={(e) => setFormData({ ...formData, isolateClients: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Isolate Clients</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.loadBalancingEnabled}
                      onChange={(e) => setFormData({ ...formData, loadBalancingEnabled: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">Load Balancing</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MAC Filter</label>
                  <select
                    value={formData.macFilterEnabled ? formData.macFilterPolicy : 'disabled'}
                    onChange={(e) => setFormData({
                      ...formData,
                      macFilterEnabled: e.target.value !== 'disabled',
                      macFilterPolicy: e.target.value === 'disabled' ? 'allow' : e.target.value
                    })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="disabled">Disabled</option>
                    <option value="allow">Allow (chỉ cho phép MAC trong danh sách)</option>
                    <option value="deny">Deny (chặn MAC trong danh sách)</option>
                  </select>
                </div>

                {formData.macFilterEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">MAC Addresses (mỗi dòng 1 MAC)</label>
                    <textarea
                      value={formData.macFilterList}
                      onChange={(e) => setFormData({ ...formData, macFilterList: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={4}
                      placeholder="AA:BB:CC:DD:EE:FF"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min RSSI (0 = disabled)</label>
                  <input
                    type="number"
                    value={formData.minRSSI}
                    onChange={(e) => setFormData({ ...formData, minRSSI: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    max="-20"
                  />
                </div>

                {(formData.security === 'wpa3' || formData.security === 'wpa3-ent') && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.wpa3Transition}
                      onChange={(e) => setFormData({ ...formData, wpa3Transition: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">WPA3 Transition Mode</span>
                  </label>
                )}
              </div>
            </div>
          </SsidModal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
