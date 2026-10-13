'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Activity,
  Download,
  Megaphone,
  TrendingUp,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface DashboardData {
  stats: {
    templates: number;
    campaigns: number;
    activeCampaigns: number;
    totalUsers: number;
    todayLogins: number;
  };
  charts: {
    dailyGrowth: Array<{
      date: string;
      label: string;
      logins: number;
      uniqueUsers: number;
      newUsers: number;
    }>;
    topCampaigns: Array<{
      id: string;
      name: string;
      ssid: string;
      active: boolean;
      visits: number;
    }>;
    ssidUsage: Array<{ ssid: string; visits: number }>;
    hourlyLogins: Array<{ hour: number; label: string; logins: number }>;
  };
  recentLogs: Array<{
    id: string;
    mac: string;
    phone?: string;
    loginTime: string;
    campaign: { name: string; ssid: string } | null;
  }>;
}

const numberFormatter = new Intl.NumberFormat('vi-VN');

function formatNumber(value: number | undefined): string {
  return numberFormatter.format(Number(value || 0));
}

function buildPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function GrowthChart({ data }: { data: Array<{ label: string; primary: number; secondary: number }> }) {
  const width = 800;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3">
        <svg className="w-16 h-16 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-slate-400 text-sm font-medium">Chưa có dữ liệu biểu đồ trong khoảng thời gian này</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap((item) => [item.primary, item.secondary]), 1);
  const steps = [0, 0.5, 1].map((ratio) => Math.ceil(maxValue * ratio));

  const primaryPoints = data.map((item, index) => {
    const x = padding.left + (data.length === 1 ? chartWidth / 2 : (index / Math.max(data.length - 1, 1)) * chartWidth);
    const y = padding.top + chartHeight - (item.primary / maxValue) * chartHeight;
    return { x, y };
  });
  const secondaryPoints = data.map((item, index) => {
    const x = padding.left + (data.length === 1 ? chartWidth / 2 : (index / Math.max(data.length - 1, 1)) * chartWidth);
    const y = padding.top + chartHeight - (item.secondary / maxValue) * chartHeight;
    return { x, y };
  });
  const areaPath = `${buildPath(primaryPoints)} L ${primaryPoints[primaryPoints.length - 1]?.x || padding.left} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  return (
    <svg className="h-full min-h-[280px] w-full" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="reportArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {steps.map((step) => {
        const y = padding.top + chartHeight - (step / maxValue) * chartHeight;
        return (
          <g key={step}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-semibold">
              {formatNumber(step)}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#reportArea)" />
      <path d={buildPath(primaryPoints)} fill="none" stroke="#6366f1" strokeLinecap="round" strokeWidth="3" />
      <path d={buildPath(secondaryPoints)} fill="none" stroke="#10b981" strokeDasharray="6 4" strokeLinecap="round" strokeWidth="2" />
      {primaryPoints.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2.5" />
      ))}
      {data.map((item, index) => {
        const x = padding.left + (data.length === 1 ? chartWidth / 2 : (index / Math.max(data.length - 1, 1)) * chartWidth);
        return (
          <text key={index} x={x} y={height - 10} textAnchor="middle" className="fill-slate-400 text-[11px] font-bold">
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (days: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; data: DashboardData; error?: string }>(
        `/api/dashboard?days=${days}`,
        token
      );
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || 'Không thể tải dữ liệu báo cáo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData(dateRange);
  }, [fetchData, dateRange]);

  const chartData = useMemo(() => (
    data?.charts?.dailyGrowth?.map((item) => ({
      label: item.label,
      primary: item.logins,
      secondary: item.uniqueUsers,
    })) || []
  ), [data]);

  const totalLogins = data?.charts?.dailyGrowth?.reduce((sum, item) => sum + item.logins, 0) || 0;
  const totalNewUsers = data?.charts?.dailyGrowth?.reduce((sum, item) => sum + item.newUsers, 0) || 0;
  const avgDaily = totalLogins > 0 ? Math.round(totalLogins / Math.max(data?.charts?.dailyGrowth?.length || 1, 1)) : 0;

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Ngày', 'Lượt đăng nhập', 'Người dùng mới', 'Người dùng uniq'],
      ...(data.charts.dailyGrowth || []).map((d) => [d.date, d.logins.toString(), d.newUsers.toString(), d.uniqueUsers.toString()]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-wifi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative space-y-7 z-10"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Báo cáo</h1>
            <p className="text-slate-500 text-sm mt-1">Phân tích hiệu suất WiFi marketing</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="7">7 ngày gần nhất</option>
              <option value="14">14 ngày gần nhất</option>
              <option value="30">30 ngày gần nhất</option>
            </select>
            <button
              onClick={exportCSV}
              disabled={!data}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Xuất CSV
            </button>
            <button
              onClick={() => fetchData(dateRange)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Tổng lượt đăng nhập" value={formatNumber(totalLogins)} icon={Activity} color="bg-indigo-50 text-indigo-600" />
          <StatCard label="Người dùng mới" value={formatNumber(totalNewUsers)} icon={Users} color="bg-emerald-50 text-emerald-600" />
          <StatCard label="TB lượt/ngày" value={formatNumber(avgDaily)} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
          <StatCard label="Chiến dịch" value={formatNumber(data?.stats.campaigns)} icon={Megaphone} color="bg-amber-50 text-amber-600" />
        </div>

        {/* Growth Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Biểu đồ tăng trưởng</h2>
              <p className="text-sm text-slate-400 mt-1">Lượt đăng nhập và người dùng mới theo ngày</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />Lượt đăng nhập</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Người dùng uniq</span>
            </div>
          </div>
          {loading ? (
            <div className="h-72 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <GrowthChart data={chartData} />
          )}
        </div>

        {/* Two column: Campaigns + SSID */}
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">Top chiến dịch</h2>
            <div className="space-y-3">
              {(data?.charts.topCampaigns || []).map((c, i) => {
                const max = Math.max(...(data?.charts.topCampaigns || []).map(item => item.visits), 1);
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.ssid}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(c.visits / max) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 w-12 text-right">{formatNumber(c.visits)}</span>
                    </div>
                  </div>
                );
              })}
              {(!data?.charts.topCampaigns || data.charts.topCampaigns.length === 0) && (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">Top SSID</h2>
            <div className="space-y-3">
              {(data?.charts.ssidUsage || []).map((s, i) => {
                const max = Math.max(...(data?.charts.ssidUsage || []).map(item => item.visits), 1);
                return (
                  <div key={s.ssid} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.ssid}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.visits / max) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 w-12 text-right">{formatNumber(s.visits)}</span>
                    </div>
                  </div>
                );
              })}
              {(!data?.charts.ssidUsage || data.charts.ssidUsage.length === 0) && (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Lịch sử đăng nhập gần đây</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">MAC / SDT</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">SSID</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Chiến dịch</th>
                  <th className="px-5 py-3 text-left text-xs font-extrabold uppercase text-slate-400">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.recentLogs || []).slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-mono font-semibold text-slate-700">{log.mac}</p>
                      <p className="text-xs text-slate-400">{log.phone || '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{log.campaign?.ssid || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-600">{log.campaign?.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{new Date(log.loginTime).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
                {(!data?.recentLogs || data.recentLogs.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">Chưa có lịch sử đăng nhập</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
