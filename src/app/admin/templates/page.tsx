'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import AdminMutationLink from '@/components/admin/AdminMutationLink';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import PresetGallery from '@/components/templates/PresetGallery';
import toast from 'react-hot-toast';
import { isLegacyLocalUploadUrl } from '@/types';
import {
  Plus,
  Search,
  Edit3,
  Eye,
  Palette,
  MoreVertical,
  CheckSquare,
  Square,
  Trash2,
  X,
  UploadCloud,
  CheckCircle,
  EyeOff,
  Settings,
  Loader2,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  status: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  draftVersion?: number;
  publishedRevisionId?: string;
  _count: { campaigns: number };
}

interface MenuAnchor {
  showAbove: boolean;
  anchorTop: number;
  anchorBottom: number;
  left: number;
}

export default function TemplatesPage() {
  const { token, canOperate } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<{ data: Template[] }>(
        `/api/templates?${params}`,
        token
      );
      const fetched = res.data || [];
      setTemplates(fetched);
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const validIds = new Set(fetched.map((item) => item.id));
        return new Set(Array.from(prev).filter((id) => validIds.has(id)));
      });
    } catch {
      toast.error('Không thể tải danh sách mẫu');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuTriggerRef.current && menuTriggerRef.current.contains(e.target as Node)) return;
      setMenuOpen(null);
    };
    const handleScrollOrResize = () => setMenuOpen(null);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [menuOpen]);

  const openMenu = (id: string, buttonEl: HTMLButtonElement) => {
    const rect = buttonEl.getBoundingClientRect();
    const menuHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const showAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const menuWidth = 180;
    let left = rect.right - menuWidth;
    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }

    setMenuAnchor({
      showAbove,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
      left,
    });
    setMenuOpen(id);
    menuTriggerRef.current = buttonEl;
  };

  const handleDelete = async (id: string) => {
    if (!canOperate) return;
    if (!confirm('Xóa mẫu này? Thao tác không thể hoàn tác.')) return;
    try {
      await api.delete(`/api/templates/${id}`, token!);
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Đã xóa mẫu');
      fetchTemplates();
    } catch {
      toast.error('Xóa thất bại');
    }
    setMenuOpen(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (templates.length === 0) return;
    const allSelected = templates.every((item) => selectedIds.has(item.id));
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(templates.map((item) => item.id)));
  };

  const handleBulkDelete = async () => {
    if (!canOperate) return;
    if (!token || selectedIds.size === 0) return;
    if (!confirm(`Xóa ${selectedIds.size} mẫu? Thao tác không thể hoàn tác.`)) return;

    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => api.delete(`/api/templates/${id}`, token))
    );

    const successCount = results.filter((item) => item.status === 'fulfilled').length;
    const failedCount = ids.length - successCount;

    if (successCount > 0) toast.success(`Đã xóa ${successCount} mẫu`);
    if (failedCount > 0) toast.error(`Xóa thất bại ${failedCount} mẫu`);

    setMenuOpen(null);
    setSelectedIds(new Set());
    setSelectMode(false);
    fetchTemplates();
  };

  const handleStatusToggle = async (t: Template) => {
    if (!canOperate || publishingId) return;
    setPublishingId(t.id);
    try {
      if (t.status === 'published') {
        await api.put(`/api/templates/${t.id}`, { status: 'draft' }, token!);
        toast.success(`Đã chuyển mẫu "${t.name}" về bản nháp`);
      } else {
        let version = t.draftVersion;
        if (!version) {
          const detail = await api.get<{ data: { draftVersion?: number } }>(`/api/templates/${t.id}`, token!);
          version = detail.data?.draftVersion ?? 1;
        }
        await api.post(`/api/templates/${t.id}/publish`, { expectedVersion: version }, token!);
        toast.success(`Đã xuất bản mẫu "${t.name}" thành công!`);
      }
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || 'Cập nhật trạng thái thất bại');
    } finally {
      setPublishingId(null);
      setMenuOpen(null);
    }
  };

  const openMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  const menuContent = menuOpen && menuAnchor && typeof document !== 'undefined' ? createPortal(
    <div
      style={{
        position: 'fixed',
        ...(menuAnchor.showAbove
          ? { bottom: `${window.innerHeight - menuAnchor.anchorTop + 6}px` }
          : { top: `${menuAnchor.anchorBottom + 6}px` }),
        left: `${menuAnchor.left}px`,
        zIndex: 99999,
      }}
      className="admin-shell admin-popover w-44 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {(() => {
        const t = templates.find(x => x.id === menuOpen);
        if (!t) return null;
        return (
          <>
            <button
              disabled={!canOperate || publishingId === t.id}
              onClick={(e) => {
                e.stopPropagation();
                handleStatusToggle(t);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors disabled:opacity-50 text-left"
            >
              {publishingId === t.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Đang xử lý...</span>
                </>
              ) : t.status === 'published' ? (
                <>
                  <EyeOff className="w-4 h-4 text-amber-500" />
                  <span>Gỡ xuất bản</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Xuất bản</span>
                </>
              )}
            </button>
            <Link
              href={`/admin/templates/${t.id}/builder`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left"
              onClick={() => setMenuOpen(null)}
            >
              <Edit3 className="w-4 h-4 text-blue-500" />
              <span>Chỉnh sửa</span>
            </Link>
            <Link
              href={`/admin/templates/${t.id}/preview`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left"
              onClick={() => setMenuOpen(null)}
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>Xem trước</span>
            </Link>
            <Link
              href={`/admin/templates/${t.id}`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left"
              onClick={() => setMenuOpen(null)}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Cài đặt</span>
            </Link>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button
              disabled={!canOperate}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(null);
                handleDelete(t.id);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 text-left"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Xóa</span>
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
          <h1 className="text-2xl font-bold text-slate-900">Mẫu giao diện</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý mẫu trang chào WiFi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!selectMode ? (
            <button
              disabled={!canOperate}
              onClick={() => {
                if (!canOperate) return;
                setSelectMode(true);
                setSelectedIds(new Set());
                setMenuOpen(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              <CheckSquare className="w-4 h-4" />
              Chọn để xóa
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                {templates.length > 0 && templates.every((item) => selectedIds.has(item.id)) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {templates.length > 0 && templates.every((item) => selectedIds.has(item.id))
                  ? 'Bỏ chọn tất cả'
                  : 'Chọn tất cả'}
              </button>
              {selectedIds.size > 0 && (
                <button
                  disabled={!canOperate}
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa ({selectedIds.size})
                </button>
              )}
              <button
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Hủy
              </button>
            </>
          )}

          <AdminMutationLink
            href="/admin/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tạo mẫu mới
          </AdminMutationLink>
        </div>
      </div>

      <PresetGallery />

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Mẫu của bạn</h2>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm kiếm mẫu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Bản nháp</option>
          <option value="published">Đang xuất bản</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Palette className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Chưa có mẫu giao diện</h3>
          <p className="text-slate-500 text-sm mb-6">Tạo mẫu trang chào WiFi đầu tiên</p>
          <AdminMutationLink
            href="/admin/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tạo mẫu
          </AdminMutationLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isSelected = selectedIds.has(template.id);
            const hasValidThumbnail = !!template.thumbnail && !isLegacyLocalUploadUrl(template.thumbnail);

            return (
              <div
                key={template.id}
                className={`relative bg-white rounded-xl border group ${menuOpen === template.id ? 'z-10' : 'z-0'} ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
                onClick={() => {
                  if (selectMode) toggleSelect(template.id);
                }}
              >
                <div className="aspect-video bg-slate-100 border-b border-slate-200 relative overflow-hidden rounded-t-xl">
                  {hasValidThumbnail ? (
                    <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Palette className="w-12 h-12 text-slate-400" />
                    </div>
                  )}

                  {selectMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(template.id); }}
                      className="absolute top-2 left-2 z-10"
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/80 border-slate-300'}`}>
                        {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  )}

                  {!selectMode && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none">
                      {canOperate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusToggle(template);
                          }}
                          disabled={publishingId === template.id}
                          className={`p-2.5 rounded-lg shadow-lg transition-transform active:scale-95 pointer-events-auto ${
                            template.status === 'published'
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          title={template.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản mẫu'}
                        >
                          {publishingId === template.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : template.status === 'published' ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <Link
                        href={`/admin/templates/${template.id}/builder`}
                        className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors pointer-events-auto"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                      </Link>
                      <Link
                        href={`/admin/templates/${template.id}/preview`}
                        className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors pointer-events-auto"
                        title="Xem trước"
                      >
                        <Eye className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                      </Link>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{template.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {template._count.campaigns} chiến dịch ·{' '}
                        {new Date(template.updatedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canOperate) handleStatusToggle(template);
                        }}
                        disabled={!canOperate || publishingId === template.id}
                        title={canOperate ? (template.status === 'published' ? 'Bấm để gỡ xuất bản' : 'Bấm để xuất bản ngay') : undefined}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap transition-all active:scale-95 ${
                          template.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                        }`}
                      >
                        {publishingId === template.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        ) : template.status === 'published' ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                        <span>{template.status === 'published' ? 'Đã xuất bản' : 'Nháp'}</span>
                      </button>

                      {!selectMode && (
                        <button
                          aria-label={`Thao tác mẫu ${template.name}`} aria-expanded={menuOpen === template.id}
                          ref={openMenuBtnRef}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMenu(template.id, e.currentTarget);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {menuContent}
    </div>
  );
}
