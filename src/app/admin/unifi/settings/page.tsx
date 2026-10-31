'use client';
import { networkFetch } from '@/components/network/client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  RefreshCw,
  Server,
  Zap,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wifi,
  Shield,
  Gauge,
  Save,
} from 'lucide-react';

interface HealthMetric {
  name: string;
  status: string;
  value: number;
  unit: string;
}

interface ControllerInfo {
  name: string;
  version: string;
  baseUrl: string;
  countryCode?: string;
  timezone?: string;
}

export default function UnifiSettingsPage() {
  const [controllerInfo, setControllerInfo] = useState<ControllerInfo | null>(null);
  const [health, setHealth] = useState<{ subsystems: HealthMetric[] }>({ subsystems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dpiEnabled, setDpiEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [ctrlRes, healthRes] = await Promise.all([
        networkFetch('/api/unifi/info?type=controller'),
        networkFetch('/api/unifi/info?type=health'),
      ]);

      const [ctrlJson, healthJson] = await Promise.all([ctrlRes.json(), healthRes.json()]);

      if (ctrlJson.success) {
        setControllerInfo(ctrlJson.data);
      }
      if (healthJson.success) {
        setHealth(healthJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunSpeedtest = async () => {
    try {
      const res = await networkFetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'speedtest' }),
      });
      const json = await res.json();

      if (json.success) {
        alert('Speedtest đã được khởi động!');
      } else {
        alert(json.error || 'Failed to run speedtest');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to run speedtest');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await networkFetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dpi',
          enabled: dpiEnabled,
        }),
      });
      const json = await res.json();

      if (json.success) {
        alert('Cài đặt đã được lưu!');
      } else {
        alert(json.error || 'Failed to save settings');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'online':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-amber-600 bg-amber-50';
      case 'down':
      case 'offline':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'down':
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-slate-600" />;
    }
  };

  if (loading && !controllerInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Đang tải cấu hình...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cấu hình</h1>
          <p className="text-slate-500 text-sm mt-1">Cài đặt hệ thống UniFi</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Connection Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Controller Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Controller Info</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">URL</span>
              <span className="text-sm font-medium text-slate-700">
                {controllerInfo?.baseUrl || 'https://viettuans.synology.me:8443'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Version</span>
              <span className="text-sm font-medium text-slate-700">
                {controllerInfo?.version || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Site</span>
              <span className="text-sm font-medium text-slate-700">default</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Timezone</span>
              <span className="text-sm font-medium text-slate-700">
                {controllerInfo?.timezone || 'Asia/Ho_Chi_Minh'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-slate-500">Status</span>
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">System Status</h2>
          </div>

          <div className="space-y-2">
            {health.subsystems && health.subsystems.length > 0 ? (
              health.subsystems.map((subsystem, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${getStatusColor(subsystem.status)}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(subsystem.status)}
                    <span className="text-sm font-medium">{subsystem.name}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {subsystem.value.toFixed(1)} {subsystem.unit}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Internet</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Online</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">WiFi</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Security</span>
                  </div>
                  <span className="text-sm font-medium text-green-600">Protected</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <button
          onClick={handleRunSpeedtest}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900">Run Speedtest</p>
            <p className="text-xs text-slate-500">Kiểm tra tốc độ internet</p>
          </div>
        </button>

        <button className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900">Reboot Controller</p>
            <p className="text-xs text-slate-500">Khởi động lại controller</p>
          </div>
        </button>

        <button disabled title="Use per-device firmware action on the Devices page" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 opacity-50 hover:border-amber-300 hover:bg-amber-50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900">Update Firmware</p>
            <p className="text-xs text-slate-500">Cập nhật firmware cho thiết bị</p>
          </div>
        </button>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-slate-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Cài đặt hệ thống</h2>
        </div>

        <div className="space-y-6">
          {/* DPI Settings */}
          <div className="flex items-center justify-between py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-medium text-slate-900">DPI (Deep Packet Inspection)</h3>
              <p className="text-xs text-slate-500 mt-1">Cho phép kiểm tra sâu gói tin để phân tích traffic</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={dpiEnabled}
                onChange={(e) => setDpiEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Controller auto-upgrade, controller reboot, global DNS and NTP are unavailable through the configured adapter. Configure device LED and firmware actions on the Devices page.</p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
