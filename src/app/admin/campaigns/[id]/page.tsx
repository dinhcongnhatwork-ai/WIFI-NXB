'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api, authenticatedFetch } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, RefreshCw, Radio } from 'lucide-react';

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
}

interface Campaign {
  id: string;
  name: string;
  ssid: string;
  wlanConfId?: string | null;
  unifiSite?: string | null;
  templateId: string;
  startTime: string;
  endTime: string;
  active: boolean;
  portalEnabled: boolean;
  redirectUrl?: string;
}

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, canOperate } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [ssid, setSsid] = useState('');
  const [ssidMode, setSsidMode] = useState<'unifi' | 'manual'>('unifi');
  const [selectedWlanId, setSelectedWlanId] = useState('');
  const [unifiSite, setUnifiSite] = useState('default');
  const [unifiSsids, setUnifiSsids] = useState<UnifiSsidOption[]>([]);
  const [loadingUnifi, setLoadingUnifi] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [active, setActive] = useState(true);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  const fetchUnifiData = useCallback(async () => {
    try {
      setLoadingUnifi(true);
      const res = await authenticatedFetch('/api/unifi/ssids');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUnifiSsids(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUnifi(false);
    }
  }, []);

  const handleWlanSelect = (wlanId: string) => {
    setSelectedWlanId(wlanId);
    const found = unifiSsids.find((w) => w._id === wlanId);
    if (found) {
      setSsid(found.name || found.ssid);
    }
  };

  const normalizeRedirectField = async () => {
    const raw = redirectUrl.trim();
    if (!raw || !token) return;

    try {
      const res = await api.post<{ data?: { redirectUrl?: string } }>(
        '/api/campaigns/normalize-redirect',
        { redirectUrl: raw },
        token
      );
      const normalized = res.data?.redirectUrl || '';
      if (normalized && normalized !== redirectUrl) {
        setRedirectUrl(normalized);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'URL chuyển hướng không hợp lệ');
    }
  };

  useEffect(() => {
    if (!token || !id) return;

    fetchUnifiData();

    Promise.all([
      api.get<{ data: Campaign }>(`/api/campaigns/${id}`, token),
      api.get<{ data: Template[] }>('/api/templates', token),
    ])
      .then(([cRes, tRes]) => {
        const c = cRes.data;
        setName(c.name);
        setSsid(c.ssid);
        if (c.wlanConfId) {
          setSelectedWlanId(c.wlanConfId);
          setSsidMode('unifi');
        }
        if (c.unifiSite) {
          setUnifiSite(c.unifiSite);
        }
        setTemplateId(c.templateId);
        setStartTime(new Date(c.startTime).toISOString().slice(0, 16));
        setEndTime(new Date(c.endTime).toISOString().slice(0, 16));
        setActive(c.active);
        setPortalEnabled(c.portalEnabled);
        setRedirectUrl(c.redirectUrl || '');
        setTemplates(tRes.data);
      })
      .catch(() => toast.error('Không thể tải chiến dịch'))
      .finally(() => setLoading(false));
  }, [token, id, fetchUnifiData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canOperate) return;
    setSaving(true);
    try {
      await api.put(
        `/api/campaigns/${id}`,
        {
          name,
          ssid: ssid.trim(),
          wlanConfId: ssidMode === 'unifi' ? selectedWlanId : null,
          unifiSite,
          templateId,
          startTime,
          endTime,
          active,
          portalEnabled,
          redirectUrl,
        },
        token!
      );
      toast.success('Cập nhật chiến dịch thành công');
      router.push('/admin/campaigns');
    } catch {
      toast.error('Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/campaigns"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chỉnh sửa chiến dịch</h1>
          <p className="text-slate-500 text-sm mt-1">Cập nhật cài đặt chiến dịch</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <fieldset disabled={!canOperate} className="min-w-0 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tên chiến dịch</label>
          <input
            type="text"
            defaultValue={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* UniFi SSID Selection */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-bold text-slate-800">
                Mạng phát sóng & SSID (UniFi Controller)
              </label>
              <p className="text-xs text-slate-500">Chọn SSID trực tiếp từ UniFi Controller hoặc nhập thủ công</p>
            </div>
            <button
              type="button"
              onClick={fetchUnifiData}
              disabled={loadingUnifi}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUnifi ? 'animate-spin text-blue-600' : ''}`} />
              Làm mới UniFi
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSsidMode('unifi')}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                ssidMode === 'unifi'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Chọn từ UniFi ({unifiSsids.length} SSID)
            </button>
            <button
              type="button"
              onClick={() => setSsidMode('manual')}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                ssidMode === 'manual'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Nhập SSID thủ công
            </button>
          </div>

          {ssidMode === 'unifi' ? (
            <div>
              {unifiSsids.length > 0 ? (
                <select
                  value={selectedWlanId}
                  onChange={(e) => handleWlanSelect(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Chọn SSID từ Controller --</option>
                  {unifiSsids.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name || w.ssid} [{w.security?.toUpperCase() || 'OPEN'}] — {w.enabled ? 'Đang phát sóng' : 'Đang tắt'}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  {loadingUnifi ? 'Đang tải danh sách SSID từ UniFi...' : 'Không tải được SSID từ UniFi Controller. Bạn có thể chọn "Nhập SSID thủ công".'}
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="VD: WiFi Marketing"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {ssid && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>SSID đang cấu hình: <strong>{ssid}</strong></span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Mẫu giao diện</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Chọn mẫu giao diện</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.status})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ngày bắt đầu</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ngày kết thúc</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-sm text-slate-700">Đang hoạt động</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={portalEnabled}
              onChange={(e) => setPortalEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <div>
            <span className="text-sm text-slate-700">Hiển thị trên Portal</span>
            <p className="text-xs text-slate-400">Khi bật, chiến dịch này sẽ hiển thị trên trang portal công khai</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">URL chuyển hướng sau khi kết nối</label>
          <input
            type="text"
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            onBlur={() => void normalizeRedirectField()}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://example.com (để trống nếu không cần)"
          />
          <p className="text-xs text-slate-400 mt-1">Hệ thống sẽ tự chuẩn hóa link khi bạn dán vào (ví dụ www.domain.com thành https://www.domain.com/)</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 transition-colors text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <Link
            href="/admin/campaigns"
            className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
          >
            Hủy
          </Link>
        </div>
      </fieldset>
      </form>
    </div>
  );
}
