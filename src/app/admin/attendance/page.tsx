'use client';
import { authenticatedFetch } from '@/lib/api';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminMutationLink from '@/components/admin/AdminMutationLink';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import toast from 'react-hot-toast';
import {
  AttendanceSessionDto,
  AttendanceSessionStatus,
} from '@/types/attendance';
import { formatVietnamTime } from '@/lib/attendance/excel';
import {
  UserCheck,
  Plus,
  Search,
  Calendar,
  MapPin,
  Wifi,
  Users,
  AlertTriangle,
  Play,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Edit,
  Activity,
  ArrowUpRight,
  Clock,
  Radio,
  Sparkles,
} from 'lucide-react';

const STATUS_TABS: Array<{ status: AttendanceSessionStatus | 'ALL'; label: string }> = [
  { status: 'ALL', label: 'Tất cả' },
  { status: 'ACTIVE', label: 'Đang diễn ra' },
  { status: 'READY', label: 'Sẵn sàng' },
  { status: 'ENDED', label: 'Đã kết thúc' },
  { status: 'DRAFT', label: 'Bản nháp' },
];

export default function AttendanceSessionsPage() {
  const router = useRouter();
  const { token, canOperate } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<AttendanceSessionStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeStatus !== 'ALL') params.set('status', activeStatus);
      if (search.trim()) params.set('search', search.trim());

      const res = await authenticatedFetch(`/api/attendance/sessions?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) {
        setSessions(json.data);
      } else {
        toast.error(json.error || 'Không thể tải danh sách buổi điểm danh');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, search, token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStartSession = async (id: string, name: string) => {
    if (!canOperate) return;
    if (!confirm(`Bắt đầu buổi họp "${name}" và kích hoạt chế độ giám sát trực tiếp?`)) return;
    try {
      setActionLoadingId(id);
      const res = await authenticatedFetch(`/api/attendance/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã bắt đầu buổi họp!');
        router.push(`/admin/attendance/${id}`);
      } else {
        toast.error(json.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEndSession = async (id: string, name: string) => {
    if (!canOperate) return;
    if (!confirm(`Kết thúc buổi họp "${name}" và chốt số liệu điểm danh? Thao tác này sẽ đóng toàn bộ phiên hiện diện.`)) return;
    try {
      setActionLoadingId(id);
      const res = await authenticatedFetch(`/api/attendance/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'ENDED' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã kết thúc và chốt số liệu buổi họp');
        fetchSessions();
      } else {
        toast.error(json.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteSession = async (id: string, name: string) => {
    if (!canOperate) return;
    if (!confirm(`Xóa buổi họp "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      setActionLoadingId(id);
      const res = await authenticatedFetch(`/api/attendance/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã xóa buổi họp');
        fetchSessions();
      } else {
        toast.error(json.error || 'Không thể xóa');
      }
    } catch {
      toast.error('Lỗi khi xóa');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="animate-fade-in max-w-6xl pb-20 space-y-8">
      {/* Header with High-End Agency Aesthetics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="rounded-full px-3 py-0.5 text-[10px] uppercase tracking-[0.2em] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-sm">
              Hội trường Tầng 11
            </span>
            <span className="text-xs text-slate-400 font-medium">• Hệ thống WiFi & Điểm danh</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-blue-600" />
            Điểm danh họp Tầng 11
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Quản lý các buổi họp, giám sát hiện diện theo thời gian thực qua AP UniFi và xuất báo cáo Excel 3 trang chuyên nghiệp.
          </p>
        </div>

        {/* Create Session Button - Island / Button-in-Button */}
        <AdminMutationLink
          href="/admin/attendance/new"
          className="group inline-flex items-center justify-between gap-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2.5 px-5 shadow-lg shadow-blue-500/25 transition-all duration-300 active:scale-[0.98] self-start md:self-auto"
        >
          <span>Tạo buổi họp mới</span>
          <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:rotate-90">
            <Plus className="w-4 h-4" />
          </span>
        </AdminMutationLink>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/80 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.status}
              onClick={() => setActiveStatus(tab.status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeStatus === tab.status
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {tab.status === 'ACTIVE' && (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1.5 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên buổi, địa điểm, SSID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-medium">Đang tải danh sách buổi họp...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Chưa có buổi họp nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || activeStatus !== 'ALL'
              ? 'Không tìm thấy buổi họp khớp với bộ lọc.'
              : 'Hãy bắt đầu bằng việc tạo buổi họp mới và chọn SSID phát sóng trên 2 AP tầng 11.'}
          </p>
          <div className="mt-4">
            <AdminMutationLink
              href="/admin/attendance/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Tạo buổi họp đầu tiên
            </AdminMutationLink>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions.map((session) => {
            const isActive = session.status === 'ACTIVE';
            const isEnded = session.status === 'ENDED';
            const isReady = session.status === 'READY';
            const isDraft = session.status === 'DRAFT';

            return (
              /* Double-Bezel Card Architecture */
              <div
                key={session.id}
                className={`group rounded-[2rem] p-1.5 transition-all duration-300 ${
                  isActive
                    ? 'bg-blue-600 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/5'
                    : 'bg-slate-100/70 ring-1 ring-slate-200/80 hover:shadow-md hover:ring-slate-300'
                }`}
              >
                <div className="rounded-[calc(2rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between h-full space-y-5">
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status Badge */}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1'
                                : isEnded
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : isReady
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            {isActive
                              ? 'Đang diễn ra'
                              : isEnded
                                ? 'Đã kết thúc'
                                : isReady
                                  ? 'Sẵn sàng'
                                  : 'Bản nháp'}
                          </span>

                          <span className="text-[11px] font-semibold text-slate-400">
                            Ngưỡng vắng: {session.warningThresholdMinutes}p
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 tracking-tight pt-1 truncate">
                          {session.name}
                        </h3>
                      </div>

                      {/* SSID Pill */}
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-bold text-slate-700 flex-shrink-0">
                        <Radio className="w-3 h-3 text-blue-600" />
                        <span>{session.ssid}</span>
                      </div>
                    </div>

                    {/* Metadata items */}
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-500">
                      <div className="flex items-center gap-2 truncate">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{formatVietnamTime(session.startTime)}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{session.location || 'Hội trường Tầng 11'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-4 gap-2 py-3 px-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Đã ĐK</p>
                      <p className="text-base font-black text-slate-900">{session.stats?.totalRegistered || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-emerald-600">Hiện diện</p>
                      <p className="text-base font-black text-emerald-600">{session.stats?.presentCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-amber-600">Tạm vắng</p>
                      <p className="text-base font-black text-amber-600">{session.stats?.temporaryAbsentCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-rose-600">Cảnh báo</p>
                      <p className="text-base font-black text-rose-600">{session.stats?.totalWarnings || 0}</p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {/* Excel Export Button */}
                      <a
                        href={`/api/attendance/sessions/${session.id}/export`}
                        download
                        className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors"
                        title="Tải Báo cáo Excel (.xlsx)"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </a>

                      {/* Edit Button */}
                      {!isEnded && (
                        <Link
                          href={`/admin/attendance/${session.id}/edit`}
                          className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors"
                          title="Chỉnh sửa buổi họp"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      )}

                      {/* Delete Button */}
                      {(isDraft || (session.stats?.totalRegistered === 0 && !isActive)) && (
                        <button
                          type="button"
                          disabled={!canOperate}
                          onClick={() => handleDeleteSession(session.id, session.name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                          title="Xóa buổi họp"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Primary Actions based on status */}
                      {isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEndSession(session.id, session.name)}
                            disabled={!canOperate || actionLoadingId === session.id}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors"
                          >
                            Kết thúc buổi
                          </button>
                          <Link
                            href={`/admin/attendance/${session.id}`}
                            className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                          >
                            <Activity className="w-3.5 h-3.5 animate-pulse" />
                            <span>Vào giám sát</span>
                            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </Link>
                        </>
                      ) : isEnded ? (
                        <Link
                          href={`/admin/attendance/${session.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Xem báo cáo</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartSession(session.id, session.name)}
                          disabled={!canOperate || actionLoadingId === session.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Bắt đầu buổi họp</span>
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
    </div>
  );
}
