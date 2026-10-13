'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { DEFAULT_FORM_FIELDS } from '@/lib/attendance/constants';
import {
  ArrowLeft,
  Calendar,
  Radio,
  RefreshCw,
  Layers,
  Sparkles,
  ExternalLink,
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

export default function EditAttendanceSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campaign states
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Session fields
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [warningThresholdMinutes, setWarningThresholdMinutes] = useState(15);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [ssid, setSsid] = useState('');
  const [selectedApMacs, setSelectedApMacs] = useState<string[]>([]);

  // UniFi AP states
  const [unifiDevices, setUnifiDevices] = useState<UnifiDeviceOption[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/sessions/${id}`);
      const json = await res.json();
      if (json.success) {
        const s = json.data;
        setName(s.name);
        setLocation(s.location || '');
        setWarningThresholdMinutes(s.warningThresholdMinutes || 15);
        setStartTime(new Date(s.startTime).toISOString().slice(0, 16));
        setEndTime(new Date(s.endTime).toISOString().slice(0, 16));
        setSsid(s.ssid);
        if (s.campaignId) {
          setSelectedCampaignId(s.campaignId);
        }
        setSelectedApMacs((s.targetApMacs as string[]) || []);
      } else {
        toast.error(json.error || 'Không thể tải buổi họp');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingCampaigns(true);
      const res = await api.get<{ data: CampaignOption[] }>('/api/campaigns', token);
      if (res && Array.isArray(res.data)) {
        setCampaigns(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCampaigns(false);
    }
  }, [token]);

  const fetchDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      const res = await fetch('/api/unifi/devices').then((r) => r.json()).catch(() => ({ success: false }));
      if (res.success && Array.isArray(res.data)) {
        setUnifiDevices(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    fetchCampaigns();
    fetchDevices();
  }, [fetchSession, fetchCampaigns, fetchDevices]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const handleCampaignChange = (newCampaignId: string) => {
    setSelectedCampaignId(newCampaignId);
    const found = campaigns.find((c) => c.id === newCampaignId);
    if (found && found.ssid) {
      setSsid(found.ssid);
    }
  };

  const toggleApSelection = (mac: string) => {
    const clean = mac.toLowerCase();
    if (selectedApMacs.includes(clean)) {
      setSelectedApMacs(selectedApMacs.filter((m) => m !== clean));
    } else {
      setSelectedApMacs([...selectedApMacs, clean]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên buổi họp');
      return;
    }
    if (!ssid.trim()) {
      toast.error('Vui lòng chọn chiến dịch hoặc nhập SSID');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          campaignId: selectedCampaignId || null,
          ssid: ssid.trim(),
          wlanConfId: selectedCampaign?.wlanConfId || null,
          unifiSite: selectedCampaign?.unifiSite || 'default',
          targetApMacs: selectedApMacs,
          formSchema: DEFAULT_FORM_FIELDS,
          warningThresholdMinutes,
          startTime,
          endTime,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Cập nhật buổi họp thành công');
        router.push(`/admin/attendance`);
      } else {
        toast.error(json.error || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Đang tải thông tin buổi họp...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/attendance"
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Chỉnh sửa buổi điểm danh</h1>
          <p className="text-xs text-slate-500">Cập nhật liên kết Chiến dịch, mạng WiFi và thời gian họp.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* CARD 1: LIÊN KẾT CHIẾN DỊCH */}
        <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
          <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-6 space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              1. Liên kết Chiến dịch WiFi Marketing
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Chiến dịch WiFi Marketing
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => handleCampaignChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chưa liên kết Chiến dịch --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — [SSID: {c.ssid}] {c.template?.name ? `— [Mẫu: ${c.template.name}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedCampaign && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-medium">SSID áp dụng: </span>
                  <strong className="text-blue-700 font-mono">{selectedCampaign.ssid}</strong>
                  <span className="mx-2 text-slate-300">•</span>
                  <span className="text-slate-500 font-medium">Mẫu hiển thị: </span>
                  <strong className="text-purple-700">{selectedCampaign.template?.name || 'Mặc định'}</strong>
                </div>
                {selectedCampaign.templateId && (
                  <Link
                    href={`/admin/templates/${selectedCampaign.templateId}/builder`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200"
                  >
                    <Sparkles className="w-3 h-3" />
                    Sửa popup Điểm danh trong Mẫu
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: THÔNG TIN BUỔI HỌP */}
        <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
          <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-6 space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              2. Thông tin buổi họp
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên buổi họp</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa điểm</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ngưỡng cảnh báo vắng mặt (phút)</label>
                <input
                  type="number"
                  value={warningThresholdMinutes}
                  onChange={(e) => setWarningThresholdMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  min={1}
                  max={120}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian bắt đầu</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian kết thúc</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: MẠNG & APS */}
        <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
          <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-6 space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-600" />
              3. Mạng WiFi & AP UniFi phát sóng
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên SSID</label>
              <input
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  Các AP được chọn tính điểm danh ({selectedApMacs.length})
                </label>
                <button
                  type="button"
                  onClick={fetchDevices}
                  disabled={loadingDevices}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingDevices ? 'animate-spin text-blue-600' : ''}`} />
                  Làm mới AP
                </button>
              </div>

              {unifiDevices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unifiDevices.map((dev) => {
                    const isChecked = selectedApMacs.includes(dev.mac.toLowerCase());
                    return (
                      <div
                        key={dev._id || dev.mac}
                        onClick={() => toggleApSelection(dev.mac)}
                        className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-3 ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-400/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600 pointer-events-none"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{dev.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{dev.mac}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={selectedApMacs.join(', ')}
                  onChange={(e) =>
                    setSelectedApMacs(
                      e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              )}
            </div>
          </div>
        </div>

        {/* CARD 4: 2 TRƯỜNG THÔNG TIN CỐ ĐỊNH */}
        <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
          <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-6 space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              4. Biểu mẫu điểm danh (02 trường thông tin chuẩn)
            </h2>
            <p className="text-xs text-slate-500">
              Biểu mẫu gồm <strong>1. Họ và tên</strong> và <strong>2. Phòng ban / Đơn vị</strong>. Tùy biến giao diện được thực hiện trực tiếp tại Mẫu hiển thị trong mục <strong>Luồng WiFi Marketing &rarr; Điểm danh họp</strong>.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/admin/attendance"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy bỏ
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
}
