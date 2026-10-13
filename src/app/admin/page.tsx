'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  FileText,
  Megaphone,
  Users,
  Activity,
  TrendingUp,
  Zap,
  AlertCircle,
  RefreshCw,
  TrendingDown,
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
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 40, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-2">
        <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-slate-400 text-sm">Chưa có dữ liệu hoạt động</p>
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
    <svg className="h-full min-h-[260px] w-full" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="dashArea" x1="0" x2="0" y1="0" y2="1">
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
      <path d={areaPath} fill="url(#dashArea)" />
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

export default function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; data: DashboardData; error?: string }>('/api/dashboard?days=7', token);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || 'Không thể tải dữ liệu');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = useMemo(() => (
    data?.charts?.dailyGrowth?.map((item) => ({
      label: item.label,
      primary: item.logins,
      secondary: item.uniqueUsers,
    })) || []
  ), [data]);

  const totalLogins = data?.charts?.dailyGrowth?.reduce((sum, item) => sum + item.logins, 0) || 0;
  const totalNewUsers = data?.charts?.dailyGrowth?.reduce((sum, item) => sum + item.newUsers, 0) || 0;

  const statCards = [
    { label: 'Templates', value: data?.stats?.templates || 0, icon: FileText, lightBg: 'bg-blue-50', textColor: 'text-blue-600' },
    { label: 'Campaigns', value: data?.stats?.campaigns || 0, icon: Megaphone, lightBg: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: 'Active', value: data?.stats?.activeCampaigns || 0, icon: Zap, lightBg: 'bg-amber-50', textColor: 'text-amber-600' },
    { label: 'Total Users', value: data?.stats?.totalUsers || 0, icon: Users, lightBg: 'bg-purple-50', textColor: 'text-purple-600' },
    { label: 'Today Logins', value: data?.stats?.todayLogins || 0, icon: TrendingUp, lightBg: 'bg-rose-50', textColor: 'text-rose-600' },
  ];

  const trendIcon = totalLogins > 0 ? TrendingUp : totalLogins < 0 ? TrendingDown : Activity;
  const trendColor = totalLogins > 0 ? 'text-emerald-600' : totalLogins < 0 ? 'text-red-600' : 'text-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of your WiFi marketing platform</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={fetchData} className="ml-auto underline font-medium hover:no-underline">Thử lại</button>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            whileHover={{ y: -4, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)' }}
            className="bg-white rounded-xl border border-slate-200 p-4 cursor-default"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.lightBg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
            </div>
            {loading && !data ? (
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Growth Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-xl border border-slate-200 p-5 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Hoạt động 7 ngày gần nhất</h2>
            <div className="flex items-center gap-4 mt-1 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />Lượt đăng nhập
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />Người dùng uniq
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {(() => {
              const Icon = trendIcon;
              return <Icon className={`w-4 h-4 ${trendColor}`} />;
            })()}
            <span className={`font-semibold ${trendColor}`}>{formatNumber(totalLogins)}</span>
            <span className="text-slate-400 text-xs">lượt / 7 ngày</span>
          </div>
        </div>
        {loading && !data ? (
          <div className="h-56 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <GrowthChart data={chartData} />
        )}
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Recent Logins</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">MAC</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SSID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.recentLogs && data.recentLogs.length > 0 ? (
                data.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{log.mac}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{log.phone || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{log.campaign?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm">
                      {log.campaign?.ssid && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">
                          {log.campaign.ssid}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {new Date(log.loginTime).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No login activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
