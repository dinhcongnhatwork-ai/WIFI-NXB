'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { DEFAULT_FORM_FIELDS, DEFAULT_WARNING_THRESHOLD_MINUTES } from '@/lib/attendance/constants';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Radio,
  Server,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Settings2,
  Save,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  UserCheck,
} from 'lucide-react';

interface CampaignOption {
  id: string;
  name: string;
  ssid: string;
  wlanConfId?: string | null;
  unifiSite?: string | null;
  templateId: string;
  template?: {
    id: string;
    name: string;
    status: string;
  };
  active: boolean;
}

interface UnifiDeviceOption {
  _id: string;
  name: string;
  model: string;
  mac: string;
  status: string;
}

export default function NewAttendanceSessionPage() {
  const router = useRouter();
  const { token } = useAuth();

  // Campaign states
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Meeting Form states
  const [name, setName] = useState('');
  const [location, setLocation] = useState('Hội trường Tầng 11');
  const [warningThresholdMinutes, setWarningThresholdMinutes] = useState(DEFAULT_WARNING_THRESHOLD_MINUTES);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // UniFi AP states
  const [unifiDevices, setUnifiDevices] = useState<UnifiDeviceOption[]>([]);
  const [selectedApMacs, setSelectedApMacs] = useState<string[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [saving, setSaving] = useState(false);

  // Default times (current time + 10 mins to + 3 hours)
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 10 * 60000);
    const end = new Date(now.getTime() + 180 * 60000);

    const formatForInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setStartTime(formatForInput(start));
    setEndTime(formatForInput(end));
  }, []);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingCampaigns(true);
      const res = await api.get<{ data: CampaignOption[] }>('/api/campaigns', token);
      if (res && Array.isArray(res.data)) {
        setCampaigns(res.data);
        if (res.data.length > 0 && !selectedCampaignId) {
          // Pre-select first active campaign or first campaign
          const activeFirst = res.data.find((c) => c.active) || res.data[0];
          setSelectedCampaignId(activeFirst.id);
        }
      }
    } catch {
      toast.error('Không thể tải danh sách chiến dịch');
    } finally {
      setLoadingCampaigns(false);
    }
  }, [token, selectedCampaignId]);

  // Fetch UniFi AP devices
  const fetchDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      const res = await fetch('/api/unifi/devices').then((r) => r.json()).catch(() => ({ success: false }));
      if (res.success && Array.isArray(res.data)) {
        setUnifiDevices(res.data);
        // Pre-select APs matching U6 or Tầng 11
        if (selectedApMacs.length === 0) {
          const defaultAps = res.data
            .filter((d: any) =>
              (d.model || '').toLowerCase().includes('u6') ||
              (d.name || '').toLowerCase().includes('11') ||
              (d.name || '').toLowerCase().includes('uap')
            )
            .slice(0, 2)
            .map((d: any) => d.mac);

          if (defaultAps.length > 0) {
            setSelectedApMacs(defaultAps);
          } else if (res.data.length > 0) {
            setSelectedApMacs(res.data.slice(0, 2).map((d: any) => d.mac));
          }
        }
      }
    } catch {
      // offline fallback
    } finally {
      setLoadingDevices(false);
    }
  }, [selectedApMacs.length]);

  useEffect(() => {
    fetchCampaigns();
    fetchDevices();
  }, [fetchCampaigns, fetchDevices]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const toggleApSelection = (mac: string) => {
    const clean = mac.toLowerCase();
    if (selectedApMacs.includes(clean)) {
      setSelectedApMacs(selectedApMacs.filter((m) => m !== clean));
    } else {
      setSelectedApMacs([...selectedApMacs, clean]);
    }
  };

  const handleSave = async (initialStatus: 'READY' | 'ACTIVE' = 'READY') => {
    if (!selectedCampaign) {
      toast.error('Vui lòng chọn Chiến dịch WiFi Marketing trước.');
      return;
    }
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên buổi họp / sự kiện.');
      return;
    }
    if (!selectedCampaign.ssid) {
      toast.error('Chiến dịch đã chọn chưa có SSID. Vui lòng cập nhật SSID trong Chiến dịch.');
      return;
    }
    if (selectedApMacs.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 Access Point phát sóng (khuyến nghị 2 AP U6 Pro tầng 11)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          campaignId: selectedCampaign.id,
          ssid: selectedCampaign.ssid.trim(),
          wlanConfId: selectedCampaign.wlanConfId || null,
          unifiSite: selectedCampaign.unifiSite || 'default',
          targetApMacs: selectedApMacs,
          formSchema: DEFAULT_FORM_FIELDS,
          nameFieldKey: 'fullname',
          idFieldKey: 'fullname',
          dialogTitle: 'Điểm danh cuộc họp',
          dialogDescription: 'Vui lòng hoàn tất biểu mẫu để xác thực điểm danh và nhận quyền truy cập WiFi.',
          confirmButtonText: 'Xác nhận điểm danh và kết nối',
          successMessage: 'Điểm danh thành công! Đang cấp quyền truy cập Internet...',
          warningThresholdMinutes,
          status: initialStatus,
          startTime,
          endTime,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          initialStatus === 'ACTIVE'
            ? 'Đã tạo và kích hoạt giám sát trực tiếp!'
            : 'Đã tạo buổi họp thành công!'
        );
        router.push(initialStatus === 'ACTIVE' ? `/admin/attendance/${json.data.id}` : '/admin/attendance');
      } else {
        toast.error(json.error || 'Tạo buổi họp thất bại');
      }
    } catch {
      toast.error('Lỗi khi lưu buổi họp');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl pb-24 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/attendance"
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <span className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            Hội trường Tầng 11
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Tạo buổi họp điểm danh mới</h1>
          <p className="text-xs text-slate-500">
            Liên kết với Chiến dịch WiFi Marketing có sẵn (SSID & Mẫu hiển thị) và chọn AP UniFi phát sóng.
          </p>
        </div>
      </div>

      {/* Guide Callout */}
      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-blue-950">Quy trình Điểm danh WiFi Marketing chuẩn:</p>
          <p className="text-blue-800 leading-relaxed">
            1. Quản trị viên tạo <strong>Chiến dịch</strong> trước (chọn SSID UniFi và Mẫu hiển thị). <br />
            2. Tại đây, chọn <strong>Chiến dịch</strong> để liên kết toàn bộ cấu hình mạng & giao diện hiển thị. <br />
            3. Biểu mẫu điểm danh gồm <strong>02 trường thông tin: Họ và tên, Phòng ban</strong> — được cấu hình trực quan tại <strong>Mẫu hiển thị (Luồng WiFi Marketing &rarr; Điểm danh họp)</strong>.
          </p>
        </div>
      </div>

      {/* SECTION 1: CHỌN CHIẾN DỊCH */}
      <div className="rounded-[2rem] bg-slate-50 p-2 ring-1 ring-slate-200/80 shadow-sm">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              1. Liên kết Chiến dịch WiFi Marketing <span className="text-rose-500">*</span>
            </h2>
            <Link
              href="/admin/campaigns/new"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo chiến dịch mới
            </Link>
          </div>

          {loadingCampaigns ? (
            <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Đang tải danh sách chiến dịch...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
              <p className="text-xs font-semibold">
                Chưa có Chiến dịch WiFi Marketing nào trong hệ thống.
              </p>
              <p className="text-[11px] text-amber-700">
                Để điểm danh họp, trước tiên bạn cần tạo Chiến dịch, chọn SSID UniFi và chọn Mẫu hiển thị.
              </p>
              <Link
                href="/admin/campaigns/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Tạo Chiến dịch ngay
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chọn Chiến dịch áp dụng cho cuộc họp
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — [SSID: {c.ssid}] {c.template?.name ? `— [Mẫu: ${c.template.name}]` : ''} {c.active ? '(Đang chạy)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Campaign Info Card */}
              {selectedCampaign && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Thông tin liên kết từ Chiến dịch
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedCampaign.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedCampaign.active ? 'Chiến dịch đang hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] text-slate-400 font-medium">Tên Chiến dịch</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">
                        {selectedCampaign.name}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] text-slate-400 font-medium">SSID phát sóng (UniFi)</span>
                      <span className="font-bold text-blue-700 font-mono block mt-0.5">
                        {selectedCampaign.ssid}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] text-slate-400 font-medium">Mẫu hiển thị (Template)</span>
                        <span className="font-bold text-purple-700 truncate block mt-0.5">
                          {selectedCampaign.template?.name || 'Mặc định'}
                        </span>
                      </div>
                      {selectedCampaign.templateId && (
                        <Link
                          href={`/admin/templates/${selectedCampaign.templateId}/builder`}
                          target="_blank"
                          title="Mở trình thiết kế giao diện Mẫu"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors ml-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: THÔNG TIN BUỔI HỌP */}
      <div className="rounded-[2rem] bg-slate-50 p-2 ring-1 ring-slate-200/80 shadow-sm">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 sm:p-8 space-y-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            2. Thông tin buổi họp / Sự kiện
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên buổi họp / Sự kiện <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Họp giao ban Lãnh đạo Nhà xuất bản Quý III"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Địa điểm</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="VD: Hội trường Tầng 11"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ngưỡng cảnh báo vắng mặt liên tục (Phút)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={warningThresholdMinutes}
                    onChange={(e) => setWarningThresholdMinutes(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">phút (Mặc định 15p)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Thời gian bắt đầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Thời gian kết thúc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CHỌN ACCESS POINT UNIFI TẦNG 11 */}
      <div className="rounded-[2rem] bg-slate-50 p-2 ring-1 ring-slate-200/80 shadow-sm">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                3. Chọn Access Point phát sóng tính điểm danh (Khuyến nghị: 2 AP U6 Pro Tầng 11)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống chỉ tính hiện diện khi thiết bị kết nối vào các AP được tích chọn dưới đây.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchDevices}
              disabled={loadingDevices}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDevices ? 'animate-spin text-blue-600' : ''}`} />
              Làm mới AP
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Danh sách thiết bị AP (UniFi Controller)
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold">
                Đã chọn {selectedApMacs.length} AP
              </span>
            </div>

            {loadingDevices ? (
              <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                Đang kết nối UniFi Controller lấy danh sách AP...
              </div>
            ) : unifiDevices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unifiDevices.map((dev) => {
                  const isChecked = selectedApMacs.includes(dev.mac.toLowerCase());
                  return (
                    <div
                      key={dev._id || dev.mac}
                      onClick={() => toggleApSelection(dev.mac)}
                      className={`p-3.5 rounded-2xl border cursor-pointer select-none transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-400/30 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-0.5 pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800">{dev.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{dev.mac}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-500 font-medium">{dev.model}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              dev.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {dev.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 space-y-2">
                <p>Nhập địa chỉ MAC các AP phát sóng tầng 11 thủ công (ngăn cách bằng dấu phẩy):</p>
                <input
                  type="text"
                  value={selectedApMacs.join(', ')}
                  onChange={(e) =>
                    setSelectedApMacs(
                      e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
                    )
                  }
                  placeholder="VD: 70:a7:41:e8:a2:33, 70:a7:41:e8:a2:34"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: BIỂU MẪU ĐIỂM DANH (2 TRƯỜNG CỐ ĐỊNH TẠI MẪU) */}
      <div className="rounded-[2rem] bg-slate-50 p-2 ring-1 ring-slate-200/80 shadow-sm">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              4. Biểu mẫu điểm danh (02 trường thông tin chuẩn)
            </h2>
            {selectedCampaign?.templateId && (
              <Link
                href={`/admin/templates/${selectedCampaign.templateId}/builder`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Tùy biến Popup Điểm danh trong Mẫu ↗
              </Link>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Theo quy định, luồng điểm danh WiFi Marketing thu thập <strong>đúng 02 trường thông tin</strong> trước khi cấp quyền truy cập Internet. Giao diện hộp thoại popup (tiêu đề, lời nhắn, màu sắc, bóng mờ) được quản lý trực quan trong <strong>Mẫu hiển thị &rarr; Luồng WiFi Marketing &rarr; Điểm danh họp</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">Họ và tên</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Tên hiển thị người tham dự trên báo cáo trực tiếp</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                  Bắt buộc
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">Phòng ban / Đơn vị</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Đơn vị công tác để phân loại và tổng hợp danh sách</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                  Bắt buộc
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
        <Link
          href="/admin/attendance"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 text-center"
        >
          Hủy & Quay lại
        </Link>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('READY')}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors"
          >
            Lưu ở dạng Sẵn sàng
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('ACTIVE')}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            {saving ? 'Đang lưu...' : 'Lưu & Bắt đầu buổi họp ngay'}
          </button>
        </div>
      </div>
    </div>
  );
}
