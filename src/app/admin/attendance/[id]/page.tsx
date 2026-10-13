'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AttendanceSessionDto,
  AttendanceRegistrationDto,
  AttendanceLogDto,
  AttendanceUnregisteredClientDto,
  AttendanceRegistrationStatus,
  FormFieldDefinition,
} from '@/types/attendance';
import { STATUS_CONFIG, detectDeviceVendor } from '@/lib/attendance/constants';
import { formatVietnamTime, formatDurationMinutes } from '@/lib/attendance/excel';
import {
  UserCheck,
  ArrowLeft,
  RefreshCw,
  FileSpreadsheet,
  StopCircle,
  Radio,
  Server,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Smartphone,
  Edit,
  History,
  Activity,
  X,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Wifi,
  WifiOff,
  LogIn,
  LogOut,
} from 'lucide-react';

/**
 * Live second-by-second countdown for attendees with TEMPORARY_ABSENT status
 */
function AbsentCountdown({
  absentStartedAt,
  thresholdMinutes = 15,
}: {
  absentStartedAt?: string | null;
  thresholdMinutes?: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!absentStartedAt) return thresholdMinutes * 60;
    const elapsed = Math.floor((Date.now() - new Date(absentStartedAt).getTime()) / 1000);
    return Math.max(0, thresholdMinutes * 60 - elapsed);
  });

  useEffect(() => {
    if (!absentStartedAt) return;
    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - new Date(absentStartedAt).getTime()) / 1000);
      const rem = Math.max(0, thresholdMinutes * 60 - elapsed);
      setSecondsLeft(rem);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [absentStartedAt, thresholdMinutes]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (secondsLeft === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
        <AlertTriangle className="w-3 h-3" />
        Hết 15p (Vắng)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shadow-sm">
      <Clock className="w-3 h-3 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
      Đếm ngược: {formatted}
    </span>
  );
}

export default function AttendanceLiveDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<AttendanceSessionDto | null>(null);
  const [registrations, setRegistrations] = useState<AttendanceRegistrationDto[]>([]);
  const [logs, setLogs] = useState<AttendanceLogDto[]>([]);
  const [unregisteredClients, setUnregisteredClients] = useState<AttendanceUnregisteredClientDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filters & search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceRegistrationStatus | 'ALL'>('ALL');

  // Selected attendee drawer
  const [selectedAttendee, setSelectedAttendee] = useState<AttendanceRegistrationDto | null>(null);

  // Device MAC change modal
  const [swapMacModal, setSwapMacModal] = useState<{
    open: boolean;
    registration: AttendanceRegistrationDto | null;
    newMac: string;
    reason: string;
    submitting: boolean;
  }>({ open: false, registration: null, newMac: '', reason: '', submitting: false });

  // End session modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);

  // SSE connection
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchSessionDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/sessions/${id}`);
      const json = await res.json();
      if (json.success) {
        setSession(json.data);
        setRegistrations(json.data.registrations || []);
        setLogs(json.data.logs || []);
        setUnregisteredClients(json.data.unregisteredClients || []);
      } else {
        toast.error(json.error || 'Không thể tải buổi điểm danh');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  // Connect SSE for real-time updates
  useEffect(() => {
    if (!id) return;

    try {
      const es = new EventSource(`/api/attendance/sessions/${id}/stream`);
      eventSourceRef.current = es;

      es.addEventListener('attendance_update', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.sessionId === id) {
            if (payload.registrations) {
              setRegistrations(payload.registrations);
            }
            if (payload.logs) {
              setLogs(payload.logs);
            }
            if (payload.unregisteredClients) {
              setUnregisteredClients(payload.unregisteredClients);
            }
            setSession((prev) => (prev ? { ...prev, stats: payload.stats, status: payload.status } : null));
          }
        } catch {
          // parse error ignored
        }
      });

      es.onerror = () => {
        // SSE error fallback
      };
    } catch {
      // EventSource not supported
    }

    // Secondary fallback polling every 4 seconds to guarantee updates
    const fallbackPoll = setInterval(async () => {
      try {
        await fetch('/api/attendance/monitor/tick', { method: 'POST' });
        await fetchSessionDetails();
      } catch {
        // network error ignored
      }
    }, 4000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearInterval(fallbackPoll);
    };
  }, [id, fetchSessionDetails]);

  // Trigger manual tick
  const handleTriggerTick = async () => {
    try {
      setScanning(true);
      await fetch('/api/attendance/monitor/tick', { method: 'POST' });
      await fetchSessionDetails();
      toast.success('Đã hoàn tất chu kỳ quét UniFi!');
    } catch {
      toast.error('Lỗi khi quét');
    } finally {
      setScanning(false);
    }
  };

  // End meeting
  const handleEndSession = async () => {
    setEnding(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ENDED' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã kết thúc buổi họp và chốt dữ liệu báo cáo');
        setShowEndModal(false);
        fetchSessionDetails();
      } else {
        toast.error(json.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setEnding(false);
    }
  };

  // Execute MAC swap
  const handleConfirmSwapMac = async () => {
    if (!swapMacModal.registration || !swapMacModal.newMac.trim()) {
      toast.error('Vui lòng nhập địa chỉ MAC mới');
      return;
    }
    if (!swapMacModal.reason.trim()) {
      toast.error('Vui lòng nhập lý do đổi thiết bị');
      return;
    }

    setSwapMacModal((p) => ({ ...p, submitting: true }));

    try {
      const res = await fetch(`/api/attendance/sessions/${id}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: swapMacModal.registration.id,
          newMac: swapMacModal.newMac.trim(),
          reason: swapMacModal.reason.trim(),
          performedBy: 'Admin / Chủ trì',
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Đã đổi thiết bị cho ${swapMacModal.registration.displayName}`);
        setSwapMacModal({ open: false, registration: null, newMac: '', reason: '', submitting: false });
        await fetchSessionDetails();
      } else {
        toast.error(json.error || 'Đổi thiết bị thất bại');
      }
    } catch {
      toast.error('Lỗi máy chủ');
    } finally {
      setSwapMacModal((p) => ({ ...p, submitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400 font-medium">Đang tải bảng điều khiển giám sát...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">Không tìm thấy buổi điểm danh này.</p>
        <Link href="/admin/attendance" className="mt-3 inline-block text-xs font-bold text-blue-600">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isSessionActive = session.status === 'ACTIVE';
  const isSessionEnded = session.status === 'ENDED';

  // Filter registrations
  const filteredRegistrations = registrations.filter((reg) => {
    const matchStatus = statusFilter === 'ALL' || reg.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      reg.displayName.toLowerCase().includes(q) ||
      reg.identityValue.toLowerCase().includes(q) ||
      reg.primaryMac.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="animate-fade-in max-w-7xl pb-24 space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVIGATION & CONTROLS BAR (Double-Bezel)
      ────────────────────────────────────────────────────────────── */}
      <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
        <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/attendance"
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-extrabold border ${
                    isSessionActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5'
                      : isSessionEnded
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {isSessionActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  {isSessionActive
                    ? 'Đang diễn ra (Giám sát Realtime)'
                    : isSessionEnded
                      ? 'Đã kết thúc (Đã chốt số liệu)'
                      : 'Sẵn sàng'}
                </span>

                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-blue-600" />
                  SSID: <strong className="text-slate-800">{session.ssid}</strong>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                {session.name}
              </h1>

              <p className="text-xs text-slate-500 mt-0.5">
                {session.location || 'Hội trường Tầng 11'} •{' '}
                {formatVietnamTime(session.startTime)} - {formatVietnamTime(session.endTime)}
              </p>
            </div>
          </div>

          {/* Controls button group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Manual Tick Button */}
            {isSessionActive && (
              <button
                type="button"
                onClick={handleTriggerTick}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                title="Quét UniFi Controller ngay lập tức"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-blue-600' : ''}`} />
                <span>Quét ngay</span>
              </button>
            )}

            {/* Excel Download Button */}
            <a
              href={`/api/attendance/sessions/${session.id}/export`}
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Xuất Excel (.xlsx)</span>
            </a>

            {/* End Session Button */}
            {isSessionActive && (
              <button
                type="button"
                onClick={() => setShowEndModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition-all active:scale-95"
              >
                <StopCircle className="w-4 h-4" />
                <span>Kết thúc buổi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TOP 5 METRIC CARDS (High-End Visual Design)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Đã đăng ký */}
        <div className="rounded-2xl p-1 bg-slate-100/80 ring-1 ring-slate-200 shadow-sm">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white p-4 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Đã đăng ký</span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </p>
            <p className="text-2xl font-black text-slate-900">{session.stats?.totalRegistered || 0}</p>
            <p className="text-[10px] text-slate-400">Người hoàn tất form</p>
          </div>
        </div>

        {/* 2. Đang hiện diện (Xanh) */}
        <div className="rounded-2xl p-1 bg-emerald-500/10 ring-1 ring-emerald-500/20 shadow-sm">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white p-4 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 flex items-center justify-between">
              <span>Đang hiện diện</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </p>
            <p className="text-2xl font-black text-emerald-600">{session.stats?.presentCount || 0}</p>
            <p className="text-[10px] text-emerald-600/80 font-medium">Kết nối đúng AP phòng họp</p>
          </div>
        </div>

        {/* 3. Tạm mất kết nối (Vàng) */}
        <div className="rounded-2xl p-1 bg-amber-500/10 ring-1 ring-amber-500/20 shadow-sm">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white p-4 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 flex items-center justify-between">
              <span>Tạm mất kết nối</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </p>
            <p className="text-2xl font-black text-amber-600">{session.stats?.temporaryAbsentCount || 0}</p>
            <p className="text-[10px] text-amber-600/80 font-medium">Mất tín hiệu &lt; {session.warningThresholdMinutes}p</p>
          </div>
        </div>

        {/* 4. Cảnh báo đỏ (Đỏ) */}
        <div className="rounded-2xl p-1 bg-rose-500/10 ring-1 ring-rose-500/20 shadow-sm">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white p-4 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 flex items-center justify-between">
              <span>Cảnh báo đỏ (≥15p)</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            </p>
            <p className="text-2xl font-black text-rose-600">{session.stats?.alertAbsentCount || 0}</p>
            <p className="text-[10px] text-rose-600/80 font-medium">Vắng mặt quá ngưỡng quy định</p>
          </div>
        </div>

        {/* 5. Chưa điền biểu mẫu */}
        <div className="rounded-2xl p-1 bg-slate-100/80 ring-1 ring-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white p-4 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Chưa điền biểu mẫu</span>
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            </p>
            <p className="text-2xl font-black text-slate-700">{session.stats?.unregisteredCount || 0}</p>
            <p className="text-[10px] text-slate-400">Thiết bị đang ở AP họp</p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. MAIN SECTION: PARTICIPANTS TABLE & REALTIME STREAM
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Participants Table (col-span-2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Table Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            {/* Status Filter Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Tất cả ({registrations.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PRESENT')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'PRESENT'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Hiện diện ({session.stats?.presentCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('TEMPORARY_ABSENT')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'TEMPORARY_ABSENT'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Tạm vắng ({session.stats?.temporaryAbsentCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ALERT_ABSENT')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  statusFilter === 'ALERT_ABSENT'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Cảnh báo ({session.stats?.alertAbsentCount || 0})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã NV, MAC..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-[1.5rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-white overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Người tham dự</th>
                    <th className="py-3 px-3">Thiết bị chính</th>
                    <th className="py-3 px-3">Hiện diện</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Chưa có người tham dự nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((reg) => {
                      const cfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.PRESENT;
                      const isAlert = reg.status === 'ALERT_ABSENT';
                      return (
                        <tr
                          key={reg.id}
                          className={`transition-colors ${
                            isAlert
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Attendee Name & Code */}
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm">{reg.displayName}</p>
                              <p className="text-[11px] font-mono text-slate-500 font-medium">
                                Mã: {reg.identityValue}
                              </p>
                            </div>
                          </td>

                          {/* Device & MAC */}
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <p className="font-mono text-[11px] text-slate-800 font-bold">
                                {reg.primaryMac}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {reg.deviceVendor || 'WiFi Device'} • AP: {reg.currentApMac || '-'}
                              </p>
                              {reg.status === 'TEMPORARY_ABSENT' && reg.absentStartedAt && (
                                <p className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                                  <LogOut className="w-2.5 h-2.5" />
                                  Rời phòng: {new Date(reg.absentStartedAt).toLocaleTimeString('vi-VN')}
                                </p>
                              )}
                              {reg.status === 'PRESENT' && reg.lastSeenAt && (
                                <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                                  <LogIn className="w-2.5 h-2.5" />
                                  Có mặt: {new Date(reg.lastSeenAt).toLocaleTimeString('vi-VN')}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Presence Time & Warnings */}
                          <td className="py-3 px-3">
                            <div>
                              <p className="font-extrabold text-slate-800">
                                {formatDurationMinutes(reg.totalPresentSeconds)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Vắng: {formatDurationMinutes(reg.totalAbsentSeconds)}
                                {reg.warningCount > 0 && (
                                  <span className="text-rose-600 font-bold ml-1">
                                    • {reg.warningCount} cảnh báo
                                  </span>
                                )}
                              </p>
                            </div>
                          </td>

                          {/* Status Badge & Countdown */}
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                                {cfg.label}
                              </span>
                              {reg.status === 'TEMPORARY_ABSENT' && (
                                <div>
                                  <AbsentCountdown
                                    absentStartedAt={reg.absentStartedAt}
                                    thresholdMinutes={session?.warningThresholdMinutes || 15}
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => setSelectedAttendee(reg)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              Chi tiết
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSwapMacModal({
                                  open: true,
                                  registration: reg,
                                  newMac: '',
                                  reason: '',
                                  submitting: false,
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Đổi thiết bị MAC"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Activity Feed & Unregistered Clients (col-span-1) */}
        <div className="space-y-6">
          {/* Live Activity Stream Feed */}
          <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
            <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
                  Nhật ký Realtime
                </h3>
                <span className="text-[10px] font-bold text-slate-400">Tự động cập nhật qua SSE</span>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {logs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Chưa có sự kiện nào.</p>
                ) : (
                  logs.slice(0, 30).map((log) => {
                    const isAlert = log.type === 'ALERT_TRIGGERED';
                    const isRegister = log.type === 'REGISTER';
                    const isRoam = log.type === 'ROAM_AP';
                    const isDeviceChange = log.type === 'DEVICE_CHANGE';
                    const isReconnect = log.type === 'RECONNECT' || log.type === 'RECOVERED';
                    const isDisconnect = log.type === 'DISCONNECT';
                    const isSync = log.type === 'SYSTEM_SYNC';

                    const badgeLabel =
                      isDisconnect
                        ? 'RỜI PHÒNG / MẤT KẾT NỐI'
                        : isReconnect
                          ? 'KẾT NỐI LẠI'
                          : log.type === 'CONNECT'
                            ? 'KẾT NỐI MỚI'
                            : isAlert
                              ? 'CẢNH BÁO ĐỎ (≥ 15P)'
                              : isSync
                                ? 'THU HỒI IP / MIKROTIK'
                                : isRegister
                                  ? 'ĐĂNG KÝ MỚI'
                                  : isDeviceChange
                                    ? 'ĐỔI THIẾT BỊ'
                                    : log.type;

                    const containerBg =
                      isAlert
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : isDisconnect
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : isReconnect || log.type === 'CONNECT'
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                            : isSync
                              ? 'bg-blue-50 border-blue-100 text-blue-900'
                              : isRegister
                                ? 'bg-indigo-50/50 border-indigo-100 text-indigo-900'
                                : isDeviceChange
                                  ? 'bg-purple-50 border-purple-200 text-purple-900'
                                  : 'bg-slate-50 border-slate-100 text-slate-700';

                    const badgeBg =
                      isAlert
                        ? 'bg-rose-200 text-rose-900'
                        : isDisconnect
                          ? 'bg-amber-200 text-amber-900'
                          : isReconnect || log.type === 'CONNECT'
                            ? 'bg-emerald-200 text-emerald-900'
                            : isSync
                              ? 'bg-blue-200 text-blue-900'
                              : isRegister
                                ? 'bg-indigo-200 text-indigo-900'
                                : 'bg-slate-200 text-slate-800';

                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-xl border text-xs space-y-0.5 ${containerBg}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${badgeBg}`}
                          >
                            {badgeLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                        <p className="font-medium text-xs pt-0.5 leading-snug">{log.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Unregistered Clients on APs Panel */}
          <div className="rounded-[1.75rem] bg-slate-50 p-1.5 ring-1 ring-slate-200 shadow-sm">
            <div className="rounded-[calc(1.75rem-0.375rem)] bg-white p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  Chưa điền biểu mẫu ({unregisteredClients.length})
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Các thiết bị đang bắt WiFi tại AP phòng họp nhưng chưa hoàn tất đăng ký điểm danh.
              </p>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {unregisteredClients.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Không có thiết bị lạ trên AP.</p>
                ) : (
                  unregisteredClients.map((c) => (
                    <div
                      key={c.id || c.mac}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between font-mono"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{c.mac}</p>
                        <p className="text-[10px] text-slate-400">
                          IP: {c.ip || '-'} • AP: {c.apMac || '-'}
                        </p>
                      </div>
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                        Chưa ĐK
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. ATTENDEE DETAIL DRAWER
      ────────────────────────────────────────────────────────────── */}
      {selectedAttendee && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setSelectedAttendee(null)}
          />

          <div className="relative w-full max-w-md bg-white h-full shadow-2xl z-10 flex flex-col justify-between overflow-y-auto p-6 space-y-6">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    Hồ sơ người tham dự
                  </span>
                  <h2 className="text-xl font-black text-slate-900 mt-1">
                    {selectedAttendee.displayName}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">Mã: {selectedAttendee.identityValue}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAttendee(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Trạng thái hiện tại</p>
                  <p className="text-sm font-black text-slate-900">
                    {STATUS_CONFIG[selectedAttendee.status]?.label || selectedAttendee.status}
                  </p>
                  {selectedAttendee.status === 'TEMPORARY_ABSENT' && (
                    <div className="mt-1.5">
                      <AbsentCountdown
                        absentStartedAt={selectedAttendee.absentStartedAt}
                        thresholdMinutes={session?.warningThresholdMinutes || 15}
                      />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Hiện diện</p>
                  <p className="text-sm font-black text-emerald-600">
                    {formatDurationMinutes(selectedAttendee.totalPresentSeconds)}
                  </p>
                </div>
              </div>

              {/* Device Info */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  Thiết bị & Kết nối
                </h3>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Địa chỉ MAC chính:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedAttendee.primaryMac}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nhà sản xuất:</span>
                    <span className="text-slate-800">{selectedAttendee.deviceVendor || 'Không rõ'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AP đang kết nối:</span>
                    <span className="text-slate-800">{selectedAttendee.currentApMac || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lần đầu vào:</span>
                    <span className="text-slate-800">{formatVietnamTime(selectedAttendee.firstSeenAt)}</span>
                  </div>
                  {selectedAttendee.absentStartedAt && (
                    <div className="flex justify-between text-amber-700 font-semibold">
                      <span>Thời điểm rời phòng:</span>
                      <span>{formatVietnamTime(selectedAttendee.absentStartedAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lần thấy cuối:</span>
                    <span className="text-slate-800">{formatVietnamTime(selectedAttendee.lastSeenAt)}</span>
                  </div>
                </div>
              </div>

              {/* Form Answers */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Câu trả lời biểu mẫu
                </h3>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                  {Object.entries(selectedAttendee.formAnswers || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-slate-500 capitalize">{key}:</span>
                      <span className="font-semibold text-slate-800 text-right">{String(val || '-')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intervals timeline */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Lịch sử các khoảng hiện diện
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(selectedAttendee.intervals || []).map((interval) => (
                    <div
                      key={interval.id}
                      className="p-2.5 rounded-xl border border-slate-200/80 bg-white text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800">
                          {formatVietnamTime(interval.joinedAt)} → {interval.leftAt ? formatVietnamTime(interval.leftAt) : 'Hiện tại'}
                        </p>
                        <p className="text-[10px] text-slate-400">AP: {interval.apMac || '-'}</p>
                      </div>
                      <span className="text-xs font-black text-emerald-600">
                        {interval.durationSeconds ? formatDurationMinutes(interval.durationSeconds) : 'Đang mở'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Device History */}
              {(selectedAttendee.deviceHistories || []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-600" />
                    Lịch sử đổi thiết bị
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {selectedAttendee.deviceHistories?.map((dh) => (
                      <div key={dh.id} className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-900">
                        <p className="font-bold">
                          {dh.oldMac} → {dh.newMac}
                        </p>
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          Lý do: {dh.reason || 'Không rõ'} • Bởi: {dh.performedBy}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Swap Device */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSwapMacModal({
                    open: true,
                    registration: selectedAttendee,
                    newMac: '',
                    reason: '',
                    submitting: false,
                  });
                }}
                className="w-full py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors"
              >
                Đổi địa chỉ MAC thiết bị chính
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MAC SWAP CONFIRMATION MODAL
      ────────────────────────────────────────────────────────────── */}
      {swapMacModal.open && swapMacModal.registration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSwapMacModal((p) => ({ ...p, open: false }))}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Xác nhận đổi thiết bị chính
              </h3>
              <button
                type="button"
                onClick={() => setSwapMacModal((p) => ({ ...p, open: false }))}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Bạn đang thực hiện đổi thiết bị điểm danh chính cho <strong>{swapMacModal.registration.displayName}</strong>.
              Thao tác này sẽ ghi nhận vào nhật ký kiểm toán.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Địa chỉ MAC mới</label>
                <input
                  type="text"
                  value={swapMacModal.newMac}
                  onChange={(e) => setSwapMacModal((p) => ({ ...p, newMac: e.target.value }))}
                  placeholder="VD: AA:BB:CC:11:22:33"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do thay đổi</label>
                <input
                  type="text"
                  value={swapMacModal.reason}
                  onChange={(e) => setSwapMacModal((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="VD: Hết pin đổi sang iPad, đổi điện thoại cá nhân"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSwapMacModal((p) => ({ ...p, open: false }))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={swapMacModal.submitting}
                onClick={handleConfirmSwapMac}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all"
              >
                {swapMacModal.submitting ? 'Đang lưu...' : 'Xác nhận đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. END MEETING MODAL
      ────────────────────────────────────────────────────────────── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowEndModal(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl z-10 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <StopCircle className="w-5 h-5 text-rose-600" />
              Kết thúc buổi họp & Chốt dữ liệu?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hành động này sẽ chốt mốc thời gian kết thúc buổi họp, tự động đóng toàn bộ các khoảng hiện diện đang mở
              của người tham dự và chuyển phiên họp sang trạng thái <strong>Đã kết thúc</strong>. Sau khi kết thúc, bạn có thể xuất báo cáo Excel hoàn chỉnh.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={ending}
                onClick={handleEndSession}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all"
              >
                {ending ? 'Đang chốt...' : 'Xác nhận kết thúc'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
