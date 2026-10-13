'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Radio, Plus, Server, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  status: string;
}

interface UnifiSsidOption {
  _id: string;
  name: string;
  ssid: string;
  enabled: boolean;
  security: string;
  isGuest: boolean;
}

interface UnifiDeviceOption {
  _id: string;
  name: string;
  model: string;
  mac: string;
  status: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [unifiSsids, setUnifiSsids] = useState<UnifiSsidOption[]>([]);
  const [unifiDevices, setUnifiDevices] = useState<UnifiDeviceOption[]>([]);
  const [loadingUnifi, setLoadingUnifi] = useState(false);

  const [name, setName] = useState('');
  const [ssidMode, setSsidMode] = useState<'unifi' | 'manual'>('unifi');
  const [selectedWlanId, setSelectedWlanId] = useState('');
  const [ssid, setSsid] = useState('');
  const [unifiSite, setUnifiSite] = useState('default');
  const [templateId, setTemplateId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUnifiData = useCallback(async () => {
    try {
      setLoadingUnifi(true);
      const [ssidsRes, devicesRes] = await Promise.all([
        fetch('/api/unifi/ssids').then((r) => r.json()).catch(() => ({ success: false })),
        fetch('/api/unifi/devices').then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (ssidsRes.success && Array.isArray(ssidsRes.data)) {
        setUnifiSsids(ssidsRes.data);
        if (ssidsRes.data.length > 0 && !selectedWlanId) {
          const first = ssidsRes.data[0];
          setSelectedWlanId(first._id);
          setSsid(first.name || first.ssid);
        }
      }

      if (devicesRes.success && Array.isArray(devicesRes.data)) {
        setUnifiDevices(devicesRes.data);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingUnifi(false);
    }
  }, [selectedWlanId]);

  useEffect(() => {
    if (!token) return;
    api
      .get<{ data: Template[] }>('/api/templates', token)
      .then((res) => setTemplates(res.data))
      .catch(console.error);

    fetchUnifiData();
  }, [token, fetchUnifiData]);

  const handleWlanSelect = (wlanId: string) => {
    setSelectedWlanId(wlanId);
    const found = unifiSsids.find((w) => w._id === wlanId);
    if (found) {
      setSsid(found.name || found.ssid);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ssid.trim()) {
      toast.error('Vui lòng chọn hoặc nhập tên SSID');
      return;
    }

    setLoading(true);
    try {
      await api.post(
        '/api/campaigns',
        {
          name,
          ssid: ssid.trim(),
          wlanConfId: ssidMode === 'unifi' ? selectedWlanId : null,
          unifiSite,
          templateId,
          startTime,
          endTime,
          redirectUrl,
          portalEnabled,
        },
        token!
      );
      toast.success('Tạo chiến dịch thành công');
      router.push('/admin/campaigns');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tạo thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/campaigns"
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold bg-blue-50 text-blue-700 border border-blue-100">
              WiFi Marketing
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Tạo chiến dịch mới</h1>
          <p className="text-slate-500 text-sm">Chuỗi lựa chọn: Controller → Site → SSID UniFi → Mẫu Portal</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Double-Bezel Card: Thông tin cơ bản */}
        <div className="rounded-[1.5rem] bg-slate-50 p-1.5 ring-1 ring-slate-200/80 shadow-sm">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] space-y-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              1. Thông tin chiến dịch
            </h2>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tên chiến dịch</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="VD: Hội nghị Khoa học Quý III"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mẫu giao diện Portal</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              >
                <option value="">-- Chọn mẫu giao diện --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Double-Bezel Card: Chọn Mạng UniFi (Controller → Site → SSID) */}
        <div className="rounded-[1.5rem] bg-slate-50 p-1.5 ring-1 ring-slate-200/80 shadow-sm">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500" />
                2. Mạng phát sóng & AP (UniFi Controller)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchUnifiData}
                  disabled={loadingUnifi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUnifi ? 'animate-spin text-blue-600' : ''}`} />
                  Làm mới
                </button>
                <Link
                  href="/admin/unifi/ssids"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo SSID trên UniFi
                </Link>
              </div>
            </div>

            {/* Mode selector */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSsidMode('unifi')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  ssidMode === 'unifi'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Đồng bộ từ UniFi Controller ({unifiSsids.length} SSID)
              </button>
              <button
                type="button"
                onClick={() => setSsidMode('manual')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  ssidMode === 'manual'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Nhập SSID thủ công
              </button>
            </div>

            {ssidMode === 'unifi' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Chọn SSID từ Controller
                  </label>
                  {unifiSsids.length > 0 ? (
                    <select
                      value={selectedWlanId}
                      onChange={(e) => handleWlanSelect(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      required
                    >
                      {unifiSsids.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name || w.ssid} [{w.security?.toUpperCase() || 'OPEN'}] — {w.enabled ? 'Đang bật' : 'Đang tắt'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      Chưa tìm thấy SSID nào từ UniFi Controller (hoặc Controller chưa kết nối). Bạn có thể chuyển sang &ldquo;Nhập SSID thủ công&rdquo;.
                    </div>
                  )}
                </div>

                {/* Display Broadcasting APs preview */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-blue-600" />
                      Danh sách AP phát sóng ({unifiDevices.length} AP khả dụng)
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">Site: {unifiSite}</span>
                  </div>
                  {unifiDevices.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {unifiDevices.map((dev) => (
                        <div
                          key={dev._id || dev.mac}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{dev.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{dev.mac}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              dev.status === 'online'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {dev.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Đang đọc thông tin thiết bị từ UniFi...</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tên SSID</label>
                <input
                  type="text"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: HOP_TANG_11"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Double-Bezel Card: Thời gian & Cấu hình Portal */}
        <div className="rounded-[1.5rem] bg-slate-50 p-1.5 ring-1 ring-slate-200/80 shadow-sm">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] space-y-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
              3. Thời gian hiệu lực & Tùy chọn
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian bắt đầu</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian kết thúc</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                URL chuyển hướng sau kết nối (Tùy chọn)
              </label>
              <input
                type="url"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://www.nxbctqg.org.vn/"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="portalEnabled"
                checked={portalEnabled}
                onChange={(e) => setPortalEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <label htmlFor="portalEnabled" className="text-sm font-medium text-slate-700 cursor-pointer">
                Đặt làm Chiến dịch Portal mặc định toàn hệ thống
              </label>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/campaigns"
            className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Hủy bỏ
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Đang tạo...' : 'Lưu chiến dịch'}
          </button>
        </div>
      </form>
    </div>
  );
}
