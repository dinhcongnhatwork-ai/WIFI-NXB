'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  Activity,
  FileSpreadsheet,
  Megaphone,
  TrendingUp,
  Users,
  AlertCircle,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Wifi,
  Download,
  Filter,
  BarChart3,
  Layers,
  Clock,
  ChevronRight,
  ExternalLink,
  Search,
  X,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface ReportData {
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalLogins: number;
    avgDailyLogins: number;
    uniqueVisitors: number;
    allTimeLogins: number;
    totalWifiUsers: number;
    totalMeetings: number;
    avgAttendanceRate: number;
    totalMeetingAttendees: number;
    onlineAPs: number;
    totalAPs: number;
  };
  charts: {
    dailyGrowth: Array<{
      date: string;
      label: string;
      logins: number;
      uniqueUsers: number;
    }>;
    hourlyActivity: Array<{ hour: number; label: string; logins: number }>;
    topCampaigns: Array<{
      id: string;
      name: string;
      ssid: string;
      active: boolean;
      visits: number;
      uniqueUsers: number;
      conversionRate: number;
      meetingSessionsCount: number;
      templateName: string;
    }>;
    ssidUsage: Array<{ ssid: string; visits: number; percentage: number }>;
    meetingSessions: Array<{
      id: string;
      name: string;
      location: string;
      startTime: string;
      endTime: string;
      status: string;
      campaignName: string;
      totalParticipants: number;
      presentCount: number;
      absentCount: number;
      attendanceRate: number;
    }>;
    topAPs: Array<{
      id: string;
      name: string;
      model: string;
      clients: number;
      status: string;
    }>;
  };
  recentLogs: Array<{
    id: string;
    mac: string;
    phone: string | null;
    loginTime: string;
    campaign: { id: string; name: string; ssid: string } | null;
  }>;
  updatedAt: string;
}

const numberFormatter = new Intl.NumberFormat('vi-VN');
function fmt(val: number | undefined | null): string {
  return numberFormatter.format(Number(val || 0));
}

type TabKey = 'overview' | 'campaigns' | 'meetings' | 'logs' | 'infrastructure';

export default function ReportsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [customRange, setCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<string>('current');
  const [exportDays, setExportDays] = useState('30');
  const [exporting, setExporting] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [isDark, setIsDark] = useState(false);

  // Synchronize dark mode state with HTML root class
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (customRange && fromDate) {
        q.set('from', fromDate);
        if (toDate) q.set('to', toDate);
      } else {
        q.set('days', dateRange);
      }
      if (campaignFilter) q.set('campaignId', campaignFilter);

      const res = await fetch(`/api/reports?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể tải báo cáo');
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống khi tải báo cáo');
    } finally {
      setLoading(false);
    }
  }, [token, dateRange, customRange, fromDate, toDate, campaignFilter]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // Handle Export Excel
  const handleExportExcel = async (targetScope?: string, targetDays?: string) => {
    const scopeToUse = targetScope || (exportScope === 'current' ? activeTab : exportScope);
    const daysToUse = targetDays || exportDays || dateRange;

    setExporting(true);
    try {
      const q = new URLSearchParams({
        scope: scopeToUse,
        days: daysToUse,
      });
      if (customRange && fromDate) {
        q.set('from', fromDate);
        if (toDate) q.set('to', toDate);
      }
      if (campaignFilter) q.set('campaignId', campaignFilter);

      const res = await fetch(`/api/reports/export?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Xuất tệp Excel thất bại');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = `BaoCao_${scopeToUse}_${daysToUse}ngay.xlsx`;
      if (disposition && disposition.includes('filename="')) {
        filename = disposition.split('filename="')[1].split('"')[0];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportModalOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Có lỗi khi xuất Excel');
    } finally {
      setExporting(false);
    }
  };

  // 1. Daily Growth Chart Config
  const dailyChartOption = useMemo(() => {
    if (!data?.charts?.dailyGrowth?.length) return {};
    const textCol = isDark ? '#94a3b8' : '#64748b';
    const splitLineCol = isDark ? '#1e293b' : '#f1f5f9';

    return {
      textStyle: { fontFamily: 'Inter, sans-serif' },
      grid: { left: 45, right: 20, top: 35, bottom: 35 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: textCol, fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: data.charts.dailyGrowth.map((d: { label: string }) => d.label),
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
        axisLabel: { color: textCol, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textCol, fontSize: 11 },
        splitLine: { lineStyle: { color: splitLineCol } },
      },
      series: [
        {
          name: 'Lượt đăng nhập WiFi',
          type: 'line',
          smooth: true,
          data: data.charts.dailyGrowth.map((d: { logins: number }) => d.logins),
          itemStyle: { color: '#2563eb' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(37, 99, 235, 0.28)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.01)' },
            ]),
          },
        },
        {
          name: 'Khách duy nhất (MAC)',
          type: 'line',
          smooth: true,
          data: data.charts.dailyGrowth.map((d: { uniqueUsers: number }) => d.uniqueUsers),
          itemStyle: { color: '#0d9488' },
        },
      ],
    };
  }, [data?.charts?.dailyGrowth, isDark]);

  // 2. Hourly Activity Chart Config
  const hourlyChartOption = useMemo(() => {
    if (!data?.charts?.hourlyActivity?.length) return {};
    const textCol = isDark ? '#94a3b8' : '#64748b';
    const splitLineCol = isDark ? '#1e293b' : '#f1f5f9';

    return {
      textStyle: { fontFamily: 'Inter, sans-serif' },
      grid: { left: 45, right: 15, top: 30, bottom: 35 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: data.charts.hourlyActivity.map((h: { label: string }) => h.label),
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
        axisLabel: { color: textCol, fontSize: 10, interval: 2 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textCol, fontSize: 11 },
        splitLine: { lineStyle: { color: splitLineCol } },
      },
      series: [
        {
          name: 'Lượt kết nối theo giờ',
          type: 'bar',
          data: data.charts.hourlyActivity.map((h: { logins: number }) => h.logins),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1d4ed8' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [data?.charts?.hourlyActivity, isDark]);

  // 3. SSID Distribution Donut Chart Config
  const ssidChartOption = useMemo(() => {
    if (!data?.charts?.ssidUsage?.length) return {};
    const textCol = isDark ? '#94a3b8' : '#64748b';

    return {
      textStyle: { fontFamily: 'Inter, sans-serif' },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} lượt ({d}%)',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textCol, fontSize: 11 },
      },
      series: [
        {
          name: 'SSID WiFi',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 2,
          },
          label: { show: false },
          data: data.charts.ssidUsage.map((s: { ssid: string; visits: number }) => ({
            name: s.ssid,
            value: s.visits,
          })),
        },
      ],
    };
  }, [data?.charts?.ssidUsage, isDark]);

  const summary = data?.summary;

  const tabLabels: Record<TabKey, string> = {
    overview: 'Tổng quan Hoạt động',
    campaigns: 'Chiến dịch WiFi Marketing',
    meetings: 'Điểm danh Cuộc họp',
    logs: 'Nhật ký Truy cập',
    infrastructure: 'Hạ tầng Thiết bị AP',
  };

  const filteredLogs = useMemo(() => {
    if (!data?.recentLogs) return [];
    if (!logSearch.trim()) return data.recentLogs;
    const q = logSearch.toLowerCase();
    return data.recentLogs.filter(
      (l) =>
        l.mac.toLowerCase().includes(q) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.campaign && l.campaign.name.toLowerCase().includes(q)),
    );
  }, [data?.recentLogs, logSearch]);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 animate-fade-in">
      {/* 1. STANDARDIZED PAGE HEADING */}
      <div className="admin-page-heading">
        <div>
          <h1>Báo cáo & Thống kê Vận hành</h1>
          <p>
            Tổng hợp dữ liệu thực tế từ chiến dịch WiFi Marketing, điểm danh cuộc họp đại biểu và hạ tầng mạng NXB
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setExportModalOpen(true)}
            className="admin-button admin-button-primary flex items-center gap-2 text-xs font-semibold shadow-xs"
            title="Cấu hình xuất báo cáo Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>Xuất Excel</span>
            <span className="rounded bg-blue-700/80 px-1.5 py-0.5 text-[10px] font-mono">
              .XLSX
            </span>
          </button>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="admin-button flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. ERROR BANNER */}
      {error && (
        <div role="alert" className="admin-error-banner admin-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            onClick={fetchReports}
            className="admin-text-button ml-auto text-xs"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 3. DATE RANGE & CAMPAIGN FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Date Range Select */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Kỳ báo cáo:</span>
            {!customRange ? (
              <select
                value={dateRange}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setCustomRange(true);
                  } else {
                    setDateRange(e.target.value);
                  }
                }}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="1">Hôm nay (24 giờ qua)</option>
                <option value="7">7 ngày gần nhất</option>
                <option value="14">14 ngày qua</option>
                <option value="30">30 ngày qua (Chuẩn báo cáo tháng)</option>
                <option value="60">60 ngày qua</option>
                <option value="90">Quý này (90 ngày)</option>
                <option value="custom">📅 Tùy chọn ngày cụ thể...</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <span>đến</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={() => {
                    setCustomRange(false);
                    setDateRange('30');
                  }}
                  className="rounded-md bg-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                >
                  Đặt lại
                </button>
              </div>
            )}
          </div>

          {/* Campaign Filter */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Filter size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Lọc chiến dịch:</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="max-w-xs rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Tất cả chiến dịch ({data?.charts.topCampaigns.length || 0})</option>
              {(data?.charts.topCampaigns || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.ssid})
                </option>
              ))}
            </select>
          </div>
        </div>

        {data?.updatedAt && (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            Đồng bộ CSDL lúc: {new Date(data.updatedAt).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>

      {/* 4. STANDARDIZED 5-COLUMN STAT GRID */}
      <div className="admin-stat-grid">
        {/* Stat 1: Total Logins */}
        <section className="admin-stat">
          <div>
            <span>LƯỢT ĐĂNG NHẬP</span>
            <TrendingUp size={18} />
          </div>
          <strong>{loading ? '…' : fmt(summary?.totalLogins)}</strong>
          <small className="block mt-1 text-slate-500 dark:text-slate-400">
            Trung bình {fmt(summary?.avgDailyLogins)} lượt/ngày
          </small>
        </section>

        {/* Stat 2: Unique Visitors */}
        <section className="admin-stat">
          <div>
            <span>KHÁCH DUY NHẤT (MAC)</span>
            <Users size={18} />
          </div>
          <strong>{loading ? '…' : fmt(summary?.uniqueVisitors)}</strong>
          <small className="block mt-1 text-slate-500 dark:text-slate-400">
            Tổng {fmt(summary?.totalWifiUsers)} thiết bị lưu CSDL
          </small>
        </section>

        {/* Stat 3: Active Campaigns */}
        <section className="admin-stat">
          <div>
            <span>CHIẾN DỊCH HOẠT ĐỘNG</span>
            <Megaphone size={18} />
          </div>
          <strong>
            {loading ? '…' : `${summary?.activeCampaigns || 0}/${summary?.totalCampaigns || 0}`}
          </strong>
          <small className="block mt-1 text-slate-500 dark:text-slate-400">
            Đang phát sóng trên Cổng chào
          </small>
        </section>

        {/* Stat 4: Meetings & Attendance */}
        <section className="admin-stat">
          <div>
            <span>CUỘC HỌP ĐIỂM DANH</span>
            <CheckCircle2 size={18} />
          </div>
          <strong>{loading ? '…' : `${summary?.totalMeetings || 0} phiên`}</strong>
          <small className="block mt-1 text-slate-500 dark:text-slate-400">
            Tỷ lệ điểm danh TB: {summary?.avgAttendanceRate || 0}%
          </small>
        </section>

        {/* Stat 5: AP Infrastructure */}
        <section className="admin-stat">
          <div>
            <span>HẠ TẦNG ACCESS POINT</span>
            <Wifi size={18} />
          </div>
          <strong>
            {loading ? '…' : `${summary?.onlineAPs || 0}/${summary?.totalAPs || 0}`}
          </strong>
          <small className="block mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
            Đo trực tiếp từ UniFi Site NXB
          </small>
        </section>
      </div>

      {/* 5. TAB NAVIGATION STRIP */}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800"
        aria-label="Các phân hệ báo cáo"
      >
        {[
          { key: 'overview', label: 'Tổng hợp Hoạt động', icon: Activity },
          { key: 'campaigns', label: 'Chiến dịch WiFi Marketing', icon: Megaphone, badge: data?.charts.topCampaigns.length },
          { key: 'meetings', label: 'Cuộc họp & Điểm danh', icon: CheckCircle2, badge: data?.charts.meetingSessions.length },
          { key: 'logs', label: 'Lịch sử Truy cập', icon: Clock, badge: summary?.totalLogins },
          { key: 'infrastructure', label: 'Hạ tầng Thiết bị AP', icon: Wifi, badge: summary?.totalAPs },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-semibold'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ===================================================================== */}
      {/* TAB 1: TỔNG QUAN (OVERVIEW) */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts Row: Trend & Hourly */}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="admin-panel lg:col-span-2 mb-0">
              <div className="admin-panel-heading">
                <h2>Xu hướng Đăng nhập & Khách truy cập ({dateRange} ngày qua)</h2>
                <span>Đơn vị: Lượt kết nối</span>
              </div>
              <div className="p-4">
                {dailyChartOption && Object.keys(dailyChartOption).length > 0 ? (
                  <ReactEChartsCore echarts={echarts} option={dailyChartOption} style={{ height: 280 }} />
                ) : (
                  <div className="admin-empty-state">Đang tải biểu đồ xu hướng...</div>
                )}
              </div>
            </section>

            <section className="admin-panel mb-0">
              <div className="admin-panel-heading">
                <h2>Cơ cấu SSID Phát WiFi</h2>
                <span>Tỷ lệ lượt kết nối</span>
              </div>
              <div className="p-4">
                {ssidChartOption && Object.keys(ssidChartOption).length > 0 ? (
                  <ReactEChartsCore echarts={echarts} option={ssidChartOption} style={{ height: 280 }} />
                ) : (
                  <div className="admin-empty-state">Chưa có số liệu SSID</div>
                )}
              </div>
            </section>
          </div>

          {/* Peak Hours Histogram */}
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>Khung Giờ Cao Điểm Trong Ngày (0h - 23h)</h2>
              <span>Phân bố lưu lượng truy cập mạng theo giờ</span>
            </div>
            <div className="p-4">
              {hourlyChartOption && Object.keys(hourlyChartOption).length > 0 ? (
                <ReactEChartsCore echarts={echarts} option={hourlyChartOption} style={{ height: 220 }} />
              ) : (
                <div className="admin-empty-state">Đang tải biểu đồ khung giờ...</div>
              )}
            </div>
          </section>

          {/* Top Campaigns & Meetings Summary Table with Interlinking */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="admin-panel mb-0">
              <div className="admin-panel-heading">
                <h2>Top Chiến Dịch Hiệu Quả Nhất</h2>
                <button
                  onClick={() => setActiveTab('campaigns')}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                >
                  Xem chi tiết tab Chiến dịch <ChevronRight size={13} />
                </button>
              </div>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Chiến dịch</th>
                      <th>SSID</th>
                      <th>Lượt truy cập</th>
                      <th>Chuyển đổi</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.charts.topCampaigns || []).slice(0, 5).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            onClick={() => {
                              setCampaignFilter(c.id);
                              setActiveTab('campaigns');
                            }}
                            className="text-left font-semibold hover:text-blue-600 dark:hover:text-blue-400"
                            title="Lọc báo cáo theo chiến dịch này"
                          >
                            {c.name}
                          </button>
                          <small className="block text-slate-500 dark:text-slate-400">
                            Mẫu: {c.templateName}
                          </small>
                        </td>
                        <td className="font-mono text-xs">{c.ssid}</td>
                        <td className="font-mono font-semibold">{fmt(c.visits)}</td>
                        <td>
                          <span className="rounded-md bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {c.conversionRate}%
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/admin/campaigns/${c.id}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                            title="Mở cấu hình chiến dịch"
                          >
                            <ExternalLink size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!data?.charts.topCampaigns.length && (
                      <tr>
                        <td colSpan={5} className="admin-empty-cell">Chưa có chiến dịch nào</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-panel mb-0">
              <div className="admin-panel-heading">
                <h2>Cuộc Họp & Phiên Điểm Danh Gần Nhất</h2>
                <button
                  onClick={() => setActiveTab('meetings')}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                >
                  Xem chi tiết tab Điểm danh <ChevronRight size={13} />
                </button>
              </div>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Cuộc họp</th>
                      <th>Thời gian</th>
                      <th>Đại biểu</th>
                      <th>Tỷ lệ</th>
                      <th>Phòng họp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.charts.meetingSessions || []).slice(0, 5).map((m) => (
                      <tr key={m.id}>
                        <td>
                          <Link
                            href={`/admin/attendance/${m.id}`}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {m.name}
                          </Link>
                          <small className="block text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {m.location}
                          </small>
                        </td>
                        <td className="font-mono text-xs">
                          {new Date(m.startTime).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="font-mono">{m.totalParticipants}</td>
                        <td>
                          <span className="rounded-md bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            {m.attendanceRate}%
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/admin/attendance/${m.id}`}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-900/40 px-2 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                          >
                            Vào phòng <ExternalLink size={11} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!data?.charts.meetingSessions.length && (
                      <tr>
                        <td colSpan={5} className="admin-empty-cell">Chưa có phiên họp nào</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CHIẾN DỊCH (CAMPAIGNS) */}
      {/* ===================================================================== */}
      {activeTab === 'campaigns' && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Báo cáo Chi tiết Chiến dịch WiFi Marketing</h2>
              <span>Đo lường hiệu quả quảng bá và thu thập dữ liệu khách hàng theo từng SSID</span>
            </div>
            <button
              onClick={() => handleExportExcel('campaigns')}
              className="admin-button flex items-center gap-2 text-xs"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Xuất Excel Chiến Dịch</span>
            </button>
          </div>
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tên chiến dịch</th>
                  <th>Tên SSID</th>
                  <th>Trạng thái</th>
                  <th>Mẫu hiển thị</th>
                  <th>Lượt truy cập</th>
                  <th>Khách duy nhất (MAC)</th>
                  <th>Tỷ lệ chuyển đổi</th>
                  <th>Cuộc họp liên kết</th>
                  <th>Liên kết nhanh</th>
                </tr>
              </thead>
              <tbody>
                {(data?.charts.topCampaigns || []).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{c.ssid}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.active
                          ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {c.active ? '🟢 Đang chạy' : '⚪ Tạm dừng'}
                      </span>
                    </td>
                    <td>{c.templateName}</td>
                    <td className="font-mono font-semibold">{fmt(c.visits)}</td>
                    <td className="font-mono">{fmt(c.uniqueUsers)}</td>
                    <td>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {c.conversionRate}%
                      </span>
                    </td>
                    <td className="font-mono">
                      {c.meetingSessionsCount > 0 ? (
                        <button
                          onClick={() => {
                            setCampaignFilter(c.id);
                            setActiveTab('meetings');
                          }}
                          className="rounded-md bg-purple-50 dark:bg-purple-900/40 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:underline"
                          title="Lọc danh sách cuộc họp theo chiến dịch này"
                        >
                          {c.meetingSessionsCount} cuộc họp →
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCampaignFilter(c.id);
                            setActiveTab('logs');
                          }}
                          className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          title="Xem nhật ký của chiến dịch"
                        >
                          Nhật ký
                        </button>
                        <Link
                          href={`/admin/campaigns/${c.id}`}
                          className="rounded border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          title="Chỉnh sửa cấu hình"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.charts.topCampaigns.length && (
                  <tr>
                    <td colSpan={9} className="admin-empty-cell">Không có chiến dịch nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CUỘC HỌP & ĐIỂM DANH (MEETINGS) */}
      {/* ===================================================================== */}
      {activeTab === 'meetings' && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Báo cáo Điểm danh Đại biểu & Cuộc họp</h2>
              <span>Đo lường thời gian thực từ AP UniFi liên kết với phòng họp</span>
            </div>
            <button
              onClick={() => handleExportExcel('meetings')}
              className="admin-button flex items-center gap-2 text-xs"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Xuất Excel Điểm Danh</span>
            </button>
          </div>
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tên cuộc họp / Hội nghị</th>
                  <th>Chiến dịch WiFi liên kết</th>
                  <th>Địa điểm</th>
                  <th>Thời gian bắt đầu</th>
                  <th>Trạng thái</th>
                  <th>Tổng đại biểu</th>
                  <th>Có mặt</th>
                  <th>Vắng mặt</th>
                  <th>Tỷ lệ điểm danh</th>
                  <th>Phòng giám sát</th>
                </tr>
              </thead>
              <tbody>
                {(data?.charts.meetingSessions || []).map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link
                        href={`/admin/attendance/${m.id}`}
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td>
                      <span className="rounded-md bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                        {m.campaignName}
                      </span>
                    </td>
                    <td>{m.location}</td>
                    <td className="font-mono text-xs">
                      {new Date(m.startTime).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        m.status === 'active' || m.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {m.status === 'active' || m.status === 'ACTIVE' ? '🟢 Đang diễn ra' : '⚪ Đã kết thúc'}
                      </span>
                    </td>
                    <td className="font-mono font-semibold">{m.totalParticipants}</td>
                    <td className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{m.presentCount}</td>
                    <td className="font-mono text-rose-600 dark:text-rose-400">{m.absentCount}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${Math.min(100, m.attendanceRate)}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold text-xs text-emerald-700 dark:text-emerald-400">
                          {m.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/admin/attendance/${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                      >
                        <span>Trực tiếp</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!data?.charts.meetingSessions.length && (
                  <tr>
                    <td colSpan={10} className="admin-empty-cell">Không có phiên họp nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: NHẬT KÝ TRUY CẬP (ACCESS LOGS) */}
      {/* ===================================================================== */}
      {activeTab === 'logs' && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Nhật ký Đăng nhập Khách WiFi</h2>
              <span>Dữ liệu thực tế xác thực qua Captive Portal NXB</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm MAC, SĐT, chiến dịch..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <button
                onClick={() => handleExportExcel('logs')}
                className="admin-button flex items-center gap-2 text-xs"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span>Xuất Excel Nhật Ký</span>
              </button>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Thời gian đăng nhập</th>
                  <th>Địa chỉ MAC</th>
                  <th>Số điện thoại</th>
                  <th>Chiến dịch áp dụng</th>
                  <th>SSID</th>
                  <th>Tra cứu thiết bị</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="font-mono text-xs">
                      {new Date(l.loginTime).toLocaleString('vi-VN')}
                    </td>
                    <td className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {l.mac}
                    </td>
                    <td className="font-mono text-xs">{l.phone || '—'}</td>
                    <td>{l.campaign?.name || 'Khách vãng lai'}</td>
                    <td className="font-mono text-xs">{l.campaign?.ssid || 'WIFI MARKETING'}</td>
                    <td>
                      <Link
                        href={`/admin/unifi/clients?search=${encodeURIComponent(l.mac)}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        title="Xem khách hàng này trong UniFi Controller"
                      >
                        <span>UniFi Client</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filteredLogs.length && (
                  <tr>
                    <td colSpan={6} className="admin-empty-cell">Không có bản ghi nhật ký phù hợp</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: HẠ TẦNG THIẾT BỊ AP (INFRASTRUCTURE) */}
      {/* ===================================================================== */}
      {activeTab === 'infrastructure' && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Báo cáo Tải & Hoạt động Access Point UniFi</h2>
              <span>Đo lường thời gian thực từ UniFi Controller (Site: NXB CTQG ST)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono">
                Tổng AP: {summary?.totalAPs || 37} · Online: {summary?.onlineAPs || 0}
              </span>
              <button
                onClick={() => handleExportExcel('infrastructure')}
                className="admin-button flex items-center gap-2 text-xs"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span>Xuất Excel Hạ Tầng AP</span>
              </button>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tên thiết bị AP</th>
                  <th>Model / Phần cứng</th>
                  <th>Trạng thái</th>
                  <th>Khách kết nối (Clients)</th>
                  <th>Giám sát chuyên sâu</th>
                </tr>
              </thead>
              <tbody>
                {(data?.charts.topAPs || []).map((ap) => (
                  <tr key={ap.id}>
                    <td>
                      <strong>{ap.name}</strong>
                    </td>
                    <td className="font-mono text-xs">{ap.model}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        ap.status === 'online'
                          ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                      }`}>
                        {ap.status === 'online' ? '🟢 Trực tuyến' : '🔴 Ngoại tuyến'}
                      </span>
                    </td>
                    <td className="font-mono font-semibold">
                      {ap.clients > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">{ap.clients} khách</span>
                      ) : (
                        '0 khách'
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/monitor?tab=devices&deviceId=${ap.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        title="Mở tab giám sát thiết bị"
                      >
                        <span>Chi tiết giám sát</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!data?.charts.topAPs.length && (
                  <tr>
                    <td colSpan={5} className="admin-empty-cell">Chưa có thông tin Access Point</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* EXCEL EXPORT MODAL / DIALOG */}
      {/* ===================================================================== */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => !exporting && setExportModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-base">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                <span>Cấu hình Xuất Báo cáo Excel (.xlsx)</span>
              </div>
              <button
                disabled={exporting}
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div>
                <label className="block font-semibold mb-1 text-slate-800 dark:text-slate-200">
                  Phân hệ cần xuất báo cáo (Tab):
                </label>
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="current">
                    ⭐ Tab Hiện Tại: {tabLabels[activeTab]}
                  </option>
                  <option value="campaigns">
                    📊 Báo cáo Hiệu quả Chiến dịch WiFi Marketing
                  </option>
                  <option value="meetings">
                    🏛️ Báo cáo Điểm danh Đại biểu Cuộc họp & Hội nghị
                  </option>
                  <option value="logs">
                    📱 Nhật ký Đăng nhập Khách WiFi
                  </option>
                  <option value="infrastructure">
                    📡 Báo cáo Danh mục & Hạ tầng Access Point
                  </option>
                  <option value="overview">
                    📈 Báo cáo Tổng quan Hoạt động Vận hành
                  </option>
                  <option value="all">
                    📑 Sổ tay Thống kê Toàn diện (Workbook Đa Sheet)
                  </option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  File Excel được tạo đúng chuẩn cơ quan: Tiêu đề NXB Sự Thật, bảng biểu zebra striping, định dạng số/ngày và công thức tổng cộng.
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-800 dark:text-slate-200">
                  Kỳ thời gian xuất dữ liệu:
                </label>
                <select
                  value={exportDays}
                  onChange={(e) => setExportDays(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="1">Hôm nay (24 giờ qua)</option>
                  <option value="7">7 ngày gần nhất</option>
                  <option value="14">14 ngày qua</option>
                  <option value="30">30 ngày qua (Chuẩn báo cáo tháng)</option>
                  <option value="90">Quý này (90 ngày qua)</option>
                  <option value="180">6 tháng gần nhất</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                disabled={exporting}
                onClick={() => setExportModalOpen(false)}
                className="admin-button text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => handleExportExcel()}
                className="admin-button admin-button-primary flex items-center gap-2 text-xs font-semibold disabled:opacity-50"
              >
                <Download size={14} className={exporting ? 'animate-bounce' : ''} />
                <span>{exporting ? 'Đang tạo file Excel...' : 'Tải File Excel Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
