'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Megaphone,
  MoreVertical,
  Calendar,
  Wifi,
  Eye,
  Globe,
  MonitorDot,
  RotateCcw,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  ssid: string;
  templateId: string;
  startTime: string;
  endTime: string;
  active: boolean;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; status: string };
  _count: { logs: number };
}

export default function CampaignsPage() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [resetTarget, setResetTarget] = useState<Campaign | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await api.get<{ data: Campaign[] }>(
        `/api/campaigns?${params}`,
        token
      );
      setCampaigns(res.data);
    } catch {
      toast.error('Không thể tải danh sách chiến dịch');
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuTriggerRef.current && menuTriggerRef.current.contains(e.target as Node)) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const openMenu = (id: string, buttonEl: HTMLButtonElement) => {
    const rect = buttonEl.getBoundingClientRect();
    setMenuAnchor({ top: rect.bottom + 4, left: rect.right - 160 });
    setOpenMenuId(id);
    menuTriggerRef.current = buttonEl;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa chiến dịch này?')) return;
    try {
      await api.delete(`/api/campaigns/${id}`, token!);
      toast.success('Đã xóa chiến dịch');
      fetchCampaigns();
    } catch {
      toast.error('Xóa thất bại');
    }
    setOpenMenuId(null);
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await api.put(`/api/campaigns/${id}`, { active: !active }, token!);
      toast.success(active ? 'Đã tạm dừng' : 'Đã kích hoạt');
      fetchCampaigns();
    } catch {
      toast.error('Cập nhật thất bại');
    }
    setOpenMenuId(null);
  };

  const handlePublishTemplate = async (templateId: string) => {
    try {
      await api.put(`/api/templates/${templateId}`, { status: 'published' }, token!);
      toast.success('Đã xuất bản mẫu giao diện');
      fetchCampaigns();
    } catch {
      toast.error('Xuất bản thất bại');
    }
    setOpenMenuId(null);
  };

  const handleTogglePortal = async (id: string, currentEnabled: boolean) => {
    try {
      await api.put(`/api/campaigns/${id}`, { portalEnabled: !currentEnabled }, token!);
      toast.success(currentEnabled ? 'Đã gỡ khỏi Portal' : 'Đã gán vào Portal');
      fetchCampaigns();
    } catch {
      toast.error('Cập nhật thất bại');
    }
  };

  const handleResetWifi = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    try {
      const res = await api.post<{ success: boolean; bindingsRemoved?: number }>(
        '/api/mikrotik/hotspot',
        { action: 'remove-all-active' },
        token!
      );
      if (res.success) {
        const msg = res.bindingsRemoved
          ? `Đã ngắt kết nối ${res.bindingsRemoved} thiết bị WiFi`
          : 'Đã ngắt kết nối tất cả thiết bị WiFi';
        toast.success(msg);
      } else {
        toast.error('Reset thất bại');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset thất bại. Kiểm tra kết nối Mikrotik.';
      toast.error(msg);
    } finally {
      setResetLoading(false);
      setResetTarget(null);
      setOpenMenuId(null);
    }
  };

  const isActive = (c: Campaign) => {
    const now = new Date();
    return c.active && new Date(c.startTime) <= now && new Date(c.endTime) >= now;
  };

  const menuContent = openMenuId && menuAnchor && typeof document !== 'undefined' ? createPortal(
    <div
      style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left, zIndex: 99999 }}
      className="w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 animate-fade-in"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {(() => {
        const c = campaigns.find(x => x.id === openMenuId);
        if (!c) return null;
        return (
          <>
            <Link
              href={`/admin/campaigns/${c.id}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setOpenMenuId(null)}
            >
              <Edit3 className="w-4 h-4 text-slate-400" />
              Chỉnh sửa
            </Link>
            <Link
              href={`/admin/templates/${c.templateId}`}
              target="_blank"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setOpenMenuId(null)}
            >
              <Eye className="w-4 h-4 text-slate-400" />
              Xem mẫu
            </Link>
            <Link
              href={`/admin/templates/${c.templateId}/preview`}
              target="_blank"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setOpenMenuId(null)}
            >
              <Globe className="w-4 h-4 text-slate-400" />
              Xem trước
            </Link>
            {c.template?.status !== 'published' && (
              <button
                onMouseDown={() => handlePublishTemplate(c.templateId)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Globe className="w-4 h-4" />
                Xuất bản mẫu
              </button>
            )}
            <button
              onMouseDown={() => handleTogglePortal(c.id, c.portalEnabled)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                c.portalEnabled ? 'text-emerald-600' : 'text-slate-600'
              }`}
            >
              <MonitorDot className="w-4 h-4" />
              {c.portalEnabled ? 'Gỡ khỏi Portal' : 'Gán vào Portal'}
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              onMouseDown={() => setResetTarget(c)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset WiFi
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              onMouseDown={() => handleToggleActive(c.id, c.active)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {c.active ? (
                <>
                  <span className="text-slate-400 text-sm">⏸</span>
                  Tạm dừng
                </>
              ) : (
                <>
                  <span className="text-slate-400 text-sm">▶</span>
                  Kích hoạt
                </>
              )}
            </button>
            <button
              onMouseDown={() => { setOpenMenuId(null); handleDelete(c.id); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Xóa
            </button>
          </>
        );
      })()}
    </div>,
    document.body
  ) : null;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chiến dịch</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý chiến dịch WiFi marketing</p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tạo chiến dịch
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm chiến dịch hoặc SSID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Chưa có chiến dịch</h3>
            <p className="text-slate-500 text-sm mb-6">Tạo chiến dịch và gán vào SSID</p>
            <Link
              href="/admin/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Tạo chiến dịch
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Tên</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">SSID</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Mẫu</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Thời gian</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Trạng thái</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Portal</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Lượt</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-slate-900">{c.name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md whitespace-nowrap">
                        <Wifi className="w-3 h-3 flex-shrink-0" />
                        {c.ssid}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 whitespace-nowrap">{c.template?.name}</span>
                        {c.template?.status !== 'published' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-600 whitespace-nowrap">
                            Nháp
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {new Date(c.startTime).toLocaleDateString('vi-VN')} – {new Date(c.endTime).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-md whitespace-nowrap ${
                          isActive(c)
                            ? 'bg-emerald-50 text-emerald-700'
                            : c.active
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive(c) ? 'Đang chạy' : c.active ? 'Đã lên lịch' : 'Tạm dừng'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleTogglePortal(c.id, c.portalEnabled)}
                        title={c.portalEnabled ? 'Đang hiển thị trên Portal' : 'Chưa gán Portal'}
                        className={`relative inline-flex h-6 items-center w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          c.portalEnabled ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            c.portalEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{c._count.logs}</td>
                    <td className="px-3 py-3">
                      <button
                        ref={openMenuId === c.id ? menuTriggerRef : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          openMenu(c.id, e.currentTarget);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md hover:bg-slate-200 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resetTarget && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => !resetLoading && setResetTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reset WiFi</h3>
                <p className="text-sm text-slate-500">{resetTarget.name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Tất cả thiết bị đang kết nối WiFi sẽ bị ngắt và phải xác thực lại qua portal.
              Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetTarget(null)}
                disabled={resetLoading}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleResetWifi}
                disabled={resetLoading}
                className="flex-1 px-4 py-2.5 bg-orange-500 rounded-xl text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang reset...
                  </>
                ) : (
                  'Reset ngay'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {menuContent}
    </div>
  );
}
