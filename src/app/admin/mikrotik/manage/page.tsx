"use client";
import styles from "@/components/network/DeviceManagement.module.css";
import { DeviceIcon } from "@/components/network/DeviceIcon";
import { useAuth } from "@/components/auth/AuthProvider";
import { networkFetch } from "@/components/network/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Server,
  RefreshCw,
  Power,
  Search,
  AlertTriangle,
  Cpu,
  HardDrive,
  Terminal,
} from "lucide-react";
import type {
  MikrotikRouterboard,
  MikrotikSystemLog,
  MikrotikSystemResource,
} from "@/types/mikrotik";
import { formatBytes } from "@/lib/network/format";

interface SystemResponse {
  resource: MikrotikSystemResource | null;
  routerboard: MikrotikRouterboard | null;
  identity: { name: string } | null;
  logs: MikrotikSystemLog[];
}

export default function MikrotikManagePage() {
  const { canOperate } = useAuth();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [data, setData] = useState<SystemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchLog, setSearchLog] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [rebootModal, setRebootModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchSystemData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch("/api/mikrotik/system");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setUpdatedAt(new Date());
      } else {
        setError(json.error || "Không thể tải thông tin hệ thống MikroTik");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối RouterOS");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSystemData();
  }, [fetchSystemData]);

  const handleReboot = async () => {
    if (!canOperate) return;
    try {
      setActionLoading(true);
      const res = await networkFetch("/api/mikrotik/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reboot" }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("success", "Lệnh khởi động lại đã được gửi đến RouterOS");
        setRebootModal(false);
      } else {
        showToast("error", json.error || "Không thể khởi động lại router");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Lỗi kết nối");
    } finally {
      setActionLoading(false);
    }
  };

  const topicsList = useMemo(() => {
    const set = new Set<string>();
    (data?.logs || []).forEach((l) => {
      l.topics.split(",").forEach((t) => set.add(t.trim()));
    });
    return Array.from(set).filter(Boolean);
  }, [data?.logs]);

  const filteredLogs = useMemo(() => {
    const q = searchLog.toLowerCase();
    return (data?.logs || []).filter((log) => {
      const matchTopic =
        selectedTopic === "all" ||
        log.topics
          .split(",")
          .map((topic) => topic.trim())
          .includes(selectedTopic);
      return (
        matchTopic &&
        (!q ||
          log.message.toLowerCase().includes(q) ||
          log.topics.toLowerCase().includes(q))
      );
    });
  }, [data?.logs, searchLog, selectedTopic]);
  const res = data?.resource;
  const rb = data?.routerboard;
  const specs = [
    {
      title: "Phần cứng",
      icon: Server,
      rows: [
        ["Model", rb?.model || res?.boardName],
        ["Số serial", rb?.serialNumber],
        ["Revision", rb?.revision],
        ["Firmware hiện tại", rb?.currentFirmware || res?.version],
        ["Firmware nâng cấp", rb?.upgradeFirmware],
      ],
    },
    {
      title: "Vi xử lý & nền tảng",
      icon: Cpu,
      rows: [
        ["Kiến trúc", res?.architectureName],
        ["Số nhân CPU", res?.cpuCount],
        [
          "Tần số CPU",
          res?.cpuFrequency != null ? `${res.cpuFrequency} MHz` : undefined,
        ],
        ["Tải CPU", res?.cpuLoad != null ? `${res.cpuLoad}%` : undefined],
        ["Thời gian hoạt động", res?.uptime],
      ],
    },
    {
      title: "Bộ nhớ & lưu trữ",
      icon: HardDrive,
      rows: [
        [
          "Tổng RAM",
          res?.totalMemory != null ? formatBytes(res.totalMemory) : undefined,
        ],
        [
          "RAM khả dụng",
          res?.freeMemory != null ? formatBytes(res.freeMemory) : undefined,
        ],
        [
          "Tổng Flash",
          res?.totalHddSpace != null
            ? formatBytes(res.totalHddSpace)
            : undefined,
        ],
        [
          "Flash khả dụng",
          res?.freeHddSpace != null ? formatBytes(res.freeHddSpace) : undefined,
        ],
        ["Build time", res?.buildTime],
      ],
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>MikroTik / RouterOS</span>
          <h1>Quản lý thiết bị</h1>
          <p>
            Thông tin phần cứng, tài nguyên và nhật ký từ thiết bị đang chọn.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            onClick={() => void fetchSystemData()}
            disabled={loading}
            className={styles.button}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
          {canOperate && (
            <button
              disabled={loading || !data || actionLoading}
              onClick={() => setRebootModal(true)}
              className={`${styles.button} ${styles.danger}`}
            >
              <Power size={14} />
              Khởi động lại thiết bị
            </button>
          )}
        </div>
      </header>
      {toastMsg && (
        <p
          role={toastMsg.type === "error" ? "alert" : "status"}
          className={toastMsg.type === "error" ? styles.error : styles.notice}
        >
          {toastMsg.text}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <section
        className={styles.panel}
        aria-label="Thiết bị đang chọn"
        aria-busy={loading}
      >
        <div className={styles.summary}>
          <DeviceIcon
            device={{
              type: "router",
              name: data?.identity?.name,
              meta: {
                provider: "mikrotik",
                model: rb?.model || res?.boardName,
              },
            }}
            size={52}
            fallback={<Server size={36} className="text-slate-400" />}
          />
          <div>
            <h3>
              {data?.identity?.name ||
                (loading
                  ? "Đang tải thông tin thiết bị…"
                  : "Thiết bị đang chọn")}
            </h3>
            <p>
              {[
                rb?.model || res?.boardName,
                res?.version ? `RouterOS ${res.version}` : "RouterOS",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span
            className={`${styles.badge} ${error ? styles.offline : updatedAt ? styles.online : ""}`}
          >
            {loading
              ? "Đang cập nhật"
              : error
                ? "Không thể cập nhật"
                : updatedAt
                  ? "Đã nhận dữ liệu"
                  : "Chưa có dữ liệu"}
          </span>
          {updatedAt && (
            <small className={styles.muted}>
              Cập nhật {updatedAt.toLocaleTimeString("vi-VN")}
            </small>
          )}
        </div>
      </section>
      <div className={styles.hardware}>
        {specs.map((group) => (
          <section className={styles.panel} key={group.title}>
            <div className={styles.panelHeading}>
              <h2 className="flex items-center gap-2">
                <group.icon size={16} className="text-slate-400" />
                {group.title}
              </h2>
            </div>
            <dl className="space-y-4 p-5">
              {group.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-5 text-xs"
                >
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="max-w-[60%] text-right font-medium text-slate-600">
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <section className={styles.panel} aria-label="Nhật ký thiết bị">
        <div className={styles.panelHeading}>
          <div>
            <h2 className="flex items-center gap-2">
              <Terminal size={16} className="text-slate-400" />
              Nhật ký thiết bị
            </h2>
            <p>Các sự kiện được đọc từ RouterOS khi làm mới.</p>
          </div>
          <span className={styles.results}>
            {filteredLogs.length} / {data?.logs?.length || 0} sự kiện
          </span>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className="sr-only">Tìm nhật ký RouterOS</span>
            <Search size={15} />
            <input
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              placeholder="Tìm nội dung, chủ đề…"
            />
          </label>
          <select
            aria-label="Lọc chủ đề nhật ký"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className={styles.select}
          >
            <option value="all">Tất cả chủ đề</option>
            {topicsList.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          {(searchLog || selectedTopic !== "all") && (
            <button
              className={styles.textButton}
              onClick={() => {
                setSearchLog("");
                setSelectedTopic("all");
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
        <div className={styles.logs}>
          {filteredLogs.map((log) => (
            <div
              className={`${styles.logRow} ${/warning|error/.test(log.topics) ? styles.logWarning : ""}`}
              key={log.id}
            >
              <time className={styles.mono}>{log.time}</time>
              <span className="text-slate-500">{log.topics}</span>
              <p className={styles.mono}>{log.message}</p>
            </div>
          ))}
          {!filteredLogs.length && (
            <div className={styles.empty}>
              <Terminal size={28} />
              <strong>
                {loading ? "Đang tải nhật ký…" : "Không có sự kiện phù hợp"}
              </strong>
              {searchLog || selectedTopic !== "all"
                ? "Thử một chủ đề hoặc từ khóa khác."
                : "Thiết bị chưa trả về nhật ký."}
            </div>
          )}
        </div>
      </section>
      {!canOperate && (
        <p className={styles.muted}>
          Tài khoản Giám sát có quyền xem thông tin thiết bị.
        </p>
      )}
      {rebootModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={() => !actionLoading && setRebootModal(false)}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reboot-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-600" />
              <h2 id="reboot-title" className="font-semibold">
                Khởi động lại {data?.identity?.name || "thiết bị"}?
              </h2>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-slate-500">
              Lệnh được gửi trực tiếp đến RouterOS. Thiết bị và các kết nối đi
              qua thiết bị có thể bị gián đoạn trong khi khởi động lại.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className={styles.button}
                disabled={actionLoading}
                onClick={() => setRebootModal(false)}
              >
                Hủy bỏ
              </button>
              <button
                className={`${styles.button} ${styles.danger}`}
                disabled={actionLoading}
                onClick={() => void handleReboot()}
              >
                {actionLoading && (
                  <RefreshCw size={14} className="animate-spin" />
                )}
                Khởi động lại ngay
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
