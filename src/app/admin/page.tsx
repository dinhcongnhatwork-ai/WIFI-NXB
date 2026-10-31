"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  FileText,
  Megaphone,
  RefreshCw,
  Users,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { SourceStamp } from "@/components/ui/operations";

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
  };
  recentLogs: Array<{
    id: string;
    mac: string;
    phone?: string;
    loginTime: string;
    campaign: { name: string; ssid: string } | null;
  }>;
}
const formatNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

function ActivityChart({
  data,
}: {
  data: DashboardData["charts"]["dailyGrowth"];
}) {
  if (!data.length)
    return (
      <div className="admin-empty-state">
        Chưa có dữ liệu hoạt động trong 7 ngày gần nhất.
      </div>
    );
  const maximum = Math.max(
    1,
    ...data.map((day) => Math.max(day.logins, day.uniqueUsers)),
  );
  return (
    <figure
      className="admin-activity-chart"
      aria-labelledby="activity-chart-title"
    >
      <figcaption id="activity-chart-title" className="admin-chart-legend">
        <span>
          <i className="admin-chart-key" />
          Lượt đăng nhập
        </span>
        <span>
          <i className="admin-chart-key secondary" />
          Người dùng duy nhất
        </span>
      </figcaption>
      <div className="admin-chart-columns">
        {data.map((day) => (
          <div key={day.date} className="admin-chart-day">
            <span className="admin-chart-value">
              {formatNumber(day.logins)}
            </span>
            <div className="admin-chart-bars" aria-hidden="true">
              <span style={{ height: `${(day.logins / maximum) * 100}%` }} />
              <span
                style={{ height: `${(day.uniqueUsers / maximum) * 100}%` }}
              />
            </div>
            <span className="admin-chart-label">{day.label}</span>
            <span className="sr-only">
              {day.label}: {day.logins} lượt đăng nhập, {day.uniqueUsers} người
              dùng duy nhất.
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{
        success: boolean;
        data: DashboardData;
        error?: string;
      }>("/api/dashboard?days=7", token);
      if (!response.success)
        throw new Error(response.error || "Không thể tải dữ liệu tổng quan.");
      setData(response.data);
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể kết nối đến máy chủ.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = [
    { label: "Mẫu hiển thị", value: data?.stats.templates, icon: FileText },
    { label: "Chiến dịch", value: data?.stats.campaigns, icon: Megaphone },
    {
      label: "Chiến dịch đang chạy",
      value: data?.stats.activeCampaigns,
      icon: Wifi,
    },
    { label: "Người dùng WiFi", value: data?.stats.totalUsers, icon: Users },
    {
      label: "Đăng nhập hôm nay",
      value: data?.stats.todayLogins,
      icon: Activity,
    },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-page-heading">
        <div>
          <h1>Tổng quan</h1>
          <p>Theo dõi chiến dịch và hoạt động truy cập WiFi.</p>
        </div>
        <button
          onClick={() => void fetchData()}
          className="admin-button"
          disabled={loading}
        >
          <RefreshCw aria-hidden="true" />
          {loading ? "Đang cập nhật…" : "Làm mới"}
        </button>
      </div>
      {error && (
        <div className="admin-error admin-error-banner" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>
            {error}
            {data && " Đang hiển thị dữ liệu tải thành công gần nhất."}
          </span>
          <button
            className="admin-text-button"
            onClick={() => void fetchData()}
            disabled={loading}
          >
            Thử lại
          </button>
        </div>
      )}
      <div
        className="admin-stat-grid"
        aria-label="Thống kê tổng quan"
        aria-busy={loading}
      >
        {stats.map((stat) => (
          <section key={stat.label} className="admin-stat">
            <div>
              <span>{stat.label}</span>
              <stat.icon aria-hidden="true" />
            </div>
            <strong>
              {stat.value === undefined ? "—" : formatNumber(stat.value)}
            </strong>
            <footer className="mt-3">
              <SourceStamp
                source="CSDL ứng dụng"
                sampledAt={updatedAt?.toISOString()}
                staleAfter={300}
              />
            </footer>
          </section>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Hoạt động 7 ngày gần nhất</h2>
          <span>
            {updatedAt
              ? `Cập nhật lúc ${updatedAt.toLocaleTimeString("vi-VN", { timeZone: "Asia/Bangkok" })}`
              : loading
                ? "Đang tải dữ liệu…"
                : "Chưa cập nhật"}
          </span>
        </div>
        {loading && !data ? (
          <div role="status" className="admin-empty-state">
            Đang tải thống kê hoạt động…
          </div>
        ) : data ? (
          <ActivityChart data={data.charts.dailyGrowth} />
        ) : (
          <div className="admin-empty-state">
            Chưa tải được thống kê hoạt động.
          </div>
        )}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Đăng nhập gần đây</h2>
          <Link href="/admin/unifi/clients">Xem thiết bị khách UniFi</Link>
        </div>
        <div className="admin-table-scroll">
          <table>
            <caption className="sr-only">
              Danh sách các lượt đăng nhập WiFi gần đây
            </caption>
            <thead>
              <tr>
                <th scope="col">Địa chỉ MAC</th>
                <th scope="col">Điện thoại</th>
                <th scope="col">Chiến dịch</th>
                <th scope="col">SSID</th>
                <th scope="col">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentLogs?.length ? (
                data.recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono">{log.mac}</td>
                    <td>{log.phone || "—"}</td>
                    <td>{log.campaign?.name || "—"}</td>
                    <td>{log.campaign?.ssid || "—"}</td>
                    <td>{new Date(log.loginTime).toLocaleString("vi-VN")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="admin-empty-cell">
                    {loading
                      ? "Đang tải lượt đăng nhập…"
                      : error && !data
                        ? "Chưa tải được lượt đăng nhập."
                        : "Chưa có lượt đăng nhập."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
