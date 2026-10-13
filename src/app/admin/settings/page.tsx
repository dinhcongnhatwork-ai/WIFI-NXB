'use client';

import { useState, useEffect } from 'react';
import {
  Server,
  Wifi,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Radio,
  ExternalLink,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // UniFi test status
  const [unifiTestStatus, setUnifiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [unifiTestMsg, setUnifiTestMsg] = useState('');

  // MikroTik test status
  const [mikrotikTestStatus, setMikrotikTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [mikrotikTestMsg, setMikrotikTestMsg] = useState('');

  const [unifiConfig, setUnifiConfig] = useState({
    controllerUrl: 'https://192.168.1.200:11443',
    username: 'congnhat',
    password: '',
    site: 'default',
  });

  const [mikrotikConfig, setMikrotikConfig] = useState({
    host: '192.168.1.200',
    port: 80,
    username: 'admin',
    password: '',
    allowInsecure: true,
  });

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.unifi) {
            setUnifiConfig((prev) => ({
              ...prev,
              controllerUrl: json.data.unifi.controllerUrl || prev.controllerUrl,
              username: json.data.unifi.username || prev.username,
              site: json.data.unifi.site || prev.site,
            }));
          }
          if (json.data.mikrotik) {
            setMikrotikConfig((prev) => ({
              ...prev,
              host: json.data.mikrotik.host || prev.host,
              port: json.data.mikrotik.port || prev.port,
              username: json.data.mikrotik.username || prev.username,
              allowInsecure: json.data.mikrotik.allowInsecure ?? prev.allowInsecure,
            }));
          }
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        toast.error('Không thể tải cấu hình hiện tại từ máy chủ');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleTestUnifi = async () => {
    try {
      setUnifiTestStatus('testing');
      setUnifiTestMsg('');
      const res = await fetch('/api/settings/test-unifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unifiConfig),
      });
      const json = await res.json();
      if (json.success) {
        setUnifiTestStatus('success');
        setUnifiTestMsg(
          `Kết nối thành công! Site "${json.details?.site}" (${json.details?.devicesCount || 0} thiết bị AP)`
        );
        toast.success('Kết nối UniFi Controller thành công!');
      } else {
        setUnifiTestStatus('error');
        setUnifiTestMsg(json.error || 'Kết nối thất bại');
        toast.error(json.error || 'Kết nối UniFi thất bại');
      }
    } catch (err) {
      setUnifiTestStatus('error');
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setUnifiTestMsg(msg);
      toast.error(msg);
    }
  };

  const handleTestMikrotik = async () => {
    try {
      setMikrotikTestStatus('testing');
      setMikrotikTestMsg('');
      const res = await fetch('/api/settings/test-mikrotik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mikrotikConfig),
      });
      const json = await res.json();
      if (json.success) {
        setMikrotikTestStatus('success');
        setMikrotikTestMsg(
          `Kết nối thành công! Router: ${json.details?.identity} (${json.details?.boardName || 'RouterOS'} v${json.details?.version || ''}, Uptime: ${json.details?.uptime || '-'})`
        );
        toast.success('Kết nối MikroTik RouterOS thành công!');
      } else {
        setMikrotikTestStatus('error');
        setMikrotikTestMsg(json.error || 'Kết nối thất bại');
        toast.error(json.error || 'Kết nối MikroTik thất bại');
      }
    } catch (err) {
      setMikrotikTestStatus('error');
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setMikrotikTestMsg(msg);
      toast.error(msg);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unifi: unifiConfig,
          mikrotik: mikrotikConfig,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        toast.success('Đã lưu cài đặt và áp dụng toàn hệ thống thành công!');
        // Clear entered passwords from state so placeholders show
        setUnifiConfig((prev) => ({ ...prev, password: '' }));
        setMikrotikConfig((prev) => ({ ...prev, password: '' }));
        setTimeout(() => setSaved(false), 4000);
      } else {
        toast.error(json.error || 'Lỗi khi lưu cài đặt');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cài đặt kết nối hệ thống</h1>
          <p className="text-slate-500 text-sm mt-1">
            Cấu hình trực tiếp UniFi Controller & MikroTik RouterOS — Không cần sửa code hay file .env
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Đang tải...
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* UniFi Controller Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <Server className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  UniFi Controller
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60">
                    WiFi Telemetry & APs
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Quản lý các trạm phát sóng WiFi và trạng thái kết nối đại biểu</p>
              </div>
            </div>
            <a
              href={unifiConfig.controllerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50/50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Mở UniFi OS <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                UniFi Controller URL (Kèm port)
              </label>
              <input
                type="text"
                value={unifiConfig.controllerUrl}
                onChange={(e) => setUnifiConfig({ ...unifiConfig, controllerUrl: e.target.value })}
                placeholder="https://192.168.1.200:11443 hoặc https://unifi.domain.com:8443"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Port mặc định: 11443 (UniFi OS / UDM / Cloud Gateway) hoặc 8443 (Software Controller).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tài khoản đăng nhập
                </label>
                <input
                  type="text"
                  value={unifiConfig.username}
                  onChange={(e) => setUnifiConfig({ ...unifiConfig, username: e.target.value })}
                  placeholder="congnhat"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={unifiConfig.password}
                  onChange={(e) => setUnifiConfig({ ...unifiConfig, password: e.target.value })}
                  placeholder="Để trống nếu giữ mật khẩu cũ"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Site Name
                </label>
                <input
                  type="text"
                  value={unifiConfig.site}
                  onChange={(e) => setUnifiConfig({ ...unifiConfig, site: e.target.value })}
                  placeholder="default"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                />
              </div>
            </div>

            {/* Test connection row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestUnifi}
                disabled={unifiTestStatus === 'testing' || !unifiConfig.controllerUrl || !unifiConfig.username}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold disabled:opacity-50"
              >
                {unifiTestStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    Đang kiểm tra kết nối...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    Kiểm tra kết nối UniFi
                  </>
                )}
              </button>

              {unifiTestStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  {unifiTestMsg}
                </span>
              )}

              {unifiTestStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  {unifiTestMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MikroTik Router Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <Wifi className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  MikroTik RouterOS
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/60">
                    DHCP Server & Hotspot
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Quản lý cấp phát IP, xác thực Hotspot và tự động thu hồi IP khi người dùng ra ngoài
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Host / Địa chỉ IP Router
                </label>
                <input
                  type="text"
                  value={mikrotikConfig.host}
                  onChange={(e) => setMikrotikConfig({ ...mikrotikConfig, host: e.target.value })}
                  placeholder="192.168.1.200"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Port REST API
                </label>
                <input
                  type="number"
                  value={mikrotikConfig.port}
                  onChange={(e) => setMikrotikConfig({ ...mikrotikConfig, port: Number(e.target.value) || 80 })}
                  placeholder="80"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tài khoản RouterOS
                </label>
                <input
                  type="text"
                  value={mikrotikConfig.username}
                  onChange={(e) => setMikrotikConfig({ ...mikrotikConfig, username: e.target.value })}
                  placeholder="admin"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={mikrotikConfig.password}
                  onChange={(e) => setMikrotikConfig({ ...mikrotikConfig, password: e.target.value })}
                  placeholder="Để trống nếu giữ mật khẩu cũ"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                />
              </div>
            </div>

            {/* Test connection row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestMikrotik}
                disabled={mikrotikTestStatus === 'testing' || !mikrotikConfig.host || !mikrotikConfig.username}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl hover:bg-emerald-100 transition-colors text-xs font-bold disabled:opacity-50"
              >
                {mikrotikTestStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    Đang kiểm tra kết nối...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    Kiểm tra kết nối MikroTik
                  </>
                )}
              </button>

              {mikrotikTestStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  {mikrotikTestMsg}
                </span>
              )}

              {mikrotikTestStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  {mikrotikTestMsg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Cài đặt được lưu trực tiếp vào cơ sở dữ liệu và tự động cập nhật cho các luồng xử lý nền.
          </div>

          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold animate-fade-in">
                <CheckCircle className="w-4 h-4" />
                Đã lưu thành công!
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu cài đặt...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu và áp dụng toàn hệ thống
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
