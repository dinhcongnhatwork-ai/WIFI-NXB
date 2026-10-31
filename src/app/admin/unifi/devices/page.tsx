"use client";
import styles from "@/components/network/DeviceManagement.module.css";
import { useAuth } from "@/components/auth/AuthProvider";
import { DeviceIcon } from "@/components/network/DeviceIcon";
import { networkFetch } from "@/components/network/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  Wifi,
  Radio,
  RefreshCw,
  Search,
  Edit2,
  Monitor,
  X,
  Zap,
  Activity,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Cable,
  List,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { formatBytes, formatUptime } from "@/lib/network/format";

interface UnifiDevice {
  _id: string;
  deviceId?: string;
  name: string;
  type: string;
  status: string;
  mac: string;
  serialNumber?: string;
  ipAddress?: string;
  model?: string;
  firmwareVersion?: string;
  uptime: number;
  userNumSta?: number;
  guestNumSta?: number;
  numSta?: number;
  txBytes?: number;
  rxBytes?: number;
  cpuUsage?: number;
  memUsage?: number;
  radioTable?: Array<{
    radio: string;
    name?: string;
    channel?: number;
    txPower?: number;
    isEnabled?: boolean;
    antennaGain?: number;
    ht?: string;
  }>;
  portTable?: Array<{
    port_idx: number;
    name?: string;
    enable?: boolean;
    up?: boolean;
    poe?: boolean;
    poe_power?: string;
    speed?: number;
    mac?: string;
    ip?: string;
    full_duplex?: boolean;
  }>;
  vapTable?: Array<{
    name: string;
    bssid: string;
    radio: string;
    num_sta?: number;
    essid?: string;
  }>;
  uplink?: {
    uplinkType?: string;
    ip?: string;
    mac?: string;
    name?: string;
    speed?: number;
    full_duplex?: boolean;
  };
  locating?: boolean;
}

const clientCount = (device: UnifiDevice) =>
  device.numSta ?? (device.userNumSta ?? 0) + (device.guestNumSta ?? 0);
const isOnline = (device: UnifiDevice) =>
  device.status === "online" || device.status === "connected";
const statusLabel = (device: UnifiDevice) =>
  isOnline(device)
    ? "Trực tuyến"
    : device.status === "offline" || device.status === "disconnected"
      ? "Ngoại tuyến"
      : device.status || "Chưa rõ";

export default function UnifiDevicesPage() {
  const { canOperate } = useAuth();
  const [view, setView] = useState<"list" | "cards">("list");
  const [devices, setDevices] = useState<UnifiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedDevice, setSelectedDevice] = useState<UnifiDevice | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<
    "overview" | "radios" | "ports" | "ssids"
  >("overview");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Rename Modal
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    device: UnifiDevice | null;
  }>({
    open: false,
    device: null,
  });
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch("/api/unifi/devices");
      const json = await res.json();

      if (json.success) {
        setDevices(json.data);
        // Sync selected device if drawer is open
        setSelectedDevice((prev) => {
          if (!prev) return null;
          return (
            json.data.find(
              (d: UnifiDevice) => d._id === prev._id || d.mac === prev.mac,
            ) || prev
          );
        });
      } else {
        setError(json.error || "Không thể tải danh sách thiết bị");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Lỗi kết nối UniFi Controller",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (!selectedDevice && !renameModal.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const currentDialog = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(
        -1,
      );
    const focusable = () =>
      Array.from(
        currentDialog()?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]',
        ) || [],
      );
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (renameModal.open) setRenameModal({ open: false, device: null });
        else setSelectedDevice(null);
      }
      if (event.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", close);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [selectedDevice?._id, renameModal.open]);

  const handleDeviceAction = async (
    deviceId: string,
    action: string,
    data?: Record<string, unknown>,
  ) => {
    if (!canOperate) return false;
    try {
      setActionLoading(deviceId);
      const res = await networkFetch("/api/unifi/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deviceId, ...data }),
      });
      const json = await res.json();

      if (json.success) {
        let actionMsg = `Thao tác ${action} thành công`;
        if (action === "restart" || action === "reboot")
          actionMsg = "Đã gửi lệnh Khởi động lại (Restart) tới Controller";
        else if (action === "locate")
          actionMsg = "Đã thay đổi trạng thái nháy đèn định vị (Locate LED)";
        else if (action === "force-provision" || action === "provision")
          actionMsg = "Đã kích hoạt đồng bộ cấu hình (Force Provision)";
        else if (action === "rename")
          actionMsg = "Đã đổi tên thiết bị thành công trong Controller";

        showToast("success", actionMsg);
        await fetchDevices();
        return true;
      } else {
        showToast("error", json.error || "Thao tác Controller thất bại");
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Lỗi kết nối Controller",
      );
    } finally {
      setActionLoading(null);
    }
    return false;
  };

  const handleRenameSubmit = async () => {
    if (!renameModal.device || !newName.trim()) return;
    try {
      setIsRenaming(true);
      const saved = await handleDeviceAction(renameModal.device._id, "rename", {
        name: newName.trim(),
      });
      if (saved) {
        setRenameModal({ open: false, device: null });
        setNewName("");
      }
    } finally {
      setIsRenaming(false);
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (device.name || "").toLowerCase().includes(q) ||
        device.mac.toLowerCase().includes(q) ||
        (device.ipAddress && device.ipAddress.includes(q)) ||
        (device.model && device.model.toLowerCase().includes(q));

      const matchesType =
        filterType === "all" ||
        device.type.toLowerCase() === filterType.toLowerCase() ||
        (filterType === "ugw" && device.type.toLowerCase() === "udm");

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "online" &&
          (device.status === "online" || device.status === "connected")) ||
        (filterStatus === "offline" &&
          device.status !== "online" &&
          device.status !== "connected");

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [devices, search, filterType, filterStatus]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter(
      (d) => d.status === "online" || d.status === "connected",
    ).length;
    const offline = total - online;
    const clients = devices.reduce((sum, d) => sum + clientCount(d), 0);
    return { total, online, offline, clients };
  }, [devices]);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "uap":
        return Wifi;
      case "usw":
        return Zap;
      case "ugw":
      case "udm":
        return Server;
      default:
        return Monitor;
    }
  };

  return (
    <div className={styles.page}>
      {/* Toast Alert */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>UniFi Network / Devices</span>
          <h1>Thiết bị UniFi</h1>
          <p>Theo dõi phần cứng và kết nối từ UniFi Controller.</p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className={styles.button}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </header>
      <div className={styles.stats} aria-label="Thống kê thiết bị UniFi">
        <div className={styles.stat}>
          <span>Tổng thiết bị</span>
          <strong>{loading && !devices.length ? "—" : stats.total}</strong>
        </div>
        <div className={styles.stat}>
          <span>
            <i className={`${styles.badge} ${styles.online}`} />
            Trực tuyến
          </span>
          <strong>{loading && !devices.length ? "—" : stats.online}</strong>
        </div>
        <div className={styles.stat}>
          <span>Không trực tuyến</span>
          <strong>{loading && !devices.length ? "—" : stats.offline}</strong>
        </div>
        <div className={styles.stat}>
          <span>Máy khách được báo cáo</span>
          <strong>{loading && !devices.length ? "—" : stats.clients}</strong>
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <section
        className={styles.panel}
        aria-label="Danh sách thiết bị UniFi"
        aria-busy={loading}
      >
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className="sr-only">Tìm thiết bị UniFi</span>
            <Search size={15} />
            <input
              placeholder="Tìm tên, model, MAC, địa chỉ IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Lọc loại thiết bị UniFi"
            className={styles.select}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Tất cả thiết bị</option>
            <option value="uap">Access point</option>
            <option value="usw">Switch</option>
            <option value="ugw">Gateway</option>
          </select>
          <select
            aria-label="Lọc trạng thái thiết bị UniFi"
            className={styles.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="online">Trực tuyến</option>
            <option value="offline">Không trực tuyến</option>
          </select>
          <span className={styles.results}>
            {filteredDevices.length} / {devices.length} thiết bị
          </span>
          <div
            className={styles.viewToggle}
            aria-label="Cách hiển thị thiết bị"
          >
            <button
              aria-label="Danh sách thiết bị"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={16} />
            </button>
            <button
              aria-label="Thẻ thiết bị"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
        {view === "list" ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên thiết bị</th>
                  <th>Trạng thái</th>
                  <th>Địa chỉ IP</th>
                  <th>Máy khách</th>
                  <th>Thời gian hoạt động</th>
                  <th>Tài nguyên</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => {
                  const Icon = getDeviceIcon(device.type);
                  return (
                    <tr key={device._id}>
                      <td>
                        <button
                          className={`${styles.identity} ${styles.identityButton}`}
                          onClick={() => {
                            setSelectedDevice(device);
                            setActiveTab("overview");
                          }}
                        >
                          <DeviceIcon
                            device={{
                              type:
                                device.type === "ugw" ? "gateway" : device.type,
                              name: device.name,
                              meta: { provider: "unifi", model: device.model },
                            }}
                            size={42}
                            fallback={
                              <Icon size={28} className="text-slate-400" />
                            }
                          />
                          <div>
                            <strong>
                              {device.name || "Thiết bị chưa đặt tên"}
                            </strong>
                            <small>
                              {device.model || device.type.toUpperCase()} ·{" "}
                              {device.mac || "Chưa có MAC"}
                            </small>
                          </div>
                        </button>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${isOnline(device) ? styles.online : styles.offline}`}
                        >
                          {statusLabel(device)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mono}>
                          {device.ipAddress || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mono}>
                          {clientCount(device)}
                        </span>
                      </td>
                      <td>
                        {device.uptime > 0 ? formatUptime(device.uptime) : "—"}
                      </td>
                      <td>
                        <span className={styles.mono}>
                          CPU{" "}
                          {device.cpuUsage != null
                            ? `${device.cpuUsage}%`
                            : "—"}
                        </span>
                        <small className={styles.muted}>
                          RAM{" "}
                          {device.memUsage != null
                            ? `${device.memUsage}%`
                            : "—"}
                        </small>
                      </td>
                      <td>
                        <button
                          className={styles.iconButton}
                          aria-label={`Chi tiết ${device.name || device.mac}`}
                          onClick={() => {
                            setSelectedDevice(device);
                            setActiveTab("overview");
                          }}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {filteredDevices.map((device) => {
              const Icon = getDeviceIcon(device.type);
              return (
                <article className={styles.deviceCard} key={device._id}>
                  <button
                    className={`${styles.identity} ${styles.identityButton}`}
                    onClick={() => {
                      setSelectedDevice(device);
                      setActiveTab("overview");
                    }}
                  >
                    <DeviceIcon
                      device={{
                        type: device.type === "ugw" ? "gateway" : device.type,
                        name: device.name,
                        meta: { provider: "unifi", model: device.model },
                      }}
                      size={44}
                      fallback={<Icon size={28} />}
                    />
                    <div>
                      <strong>{device.name || "Thiết bị chưa đặt tên"}</strong>
                      <small>{device.model || device.type.toUpperCase()}</small>
                    </div>
                  </button>
                  <dl className={styles.cardSpecs}>
                    <div>
                      <dt>Địa chỉ IP</dt>
                      <dd className={styles.mono}>{device.ipAddress || "—"}</dd>
                    </div>
                    <div>
                      <dt>Máy khách</dt>
                      <dd>{clientCount(device)}</dd>
                    </div>
                    <div>
                      <dt>MAC</dt>
                      <dd className={styles.mono}>{device.mac || "—"}</dd>
                    </div>
                    <div>
                      <dt>Thời gian hoạt động</dt>
                      <dd>
                        {device.uptime > 0 ? formatUptime(device.uptime) : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span
                      className={`${styles.badge} ${isOnline(device) ? styles.online : styles.offline}`}
                    >
                      {statusLabel(device)}
                    </span>
                    <button
                      className={styles.textButton}
                      onClick={() => {
                        setSelectedDevice(device);
                        setActiveTab("overview");
                      }}
                    >
                      Chi tiết →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!filteredDevices.length && (
          <div className={styles.empty}>
            <Wifi size={30} />
            <strong>
              {loading
                ? "Đang tải thiết bị…"
                : error
                  ? "Chưa tải được thiết bị"
                  : devices.length
                    ? "Không tìm thấy thiết bị phù hợp"
                    : "Chưa có thiết bị UniFi"}
            </strong>
            {!loading &&
              (devices.length ? (
                <button
                  className={styles.textButton}
                  onClick={() => {
                    setSearch("");
                    setFilterType("all");
                    setFilterStatus("all");
                  }}
                >
                  Xóa bộ lọc
                </button>
              ) : (
                "Kiểm tra kết nối và site đang chọn trong UniFi Controller."
              ))}
          </div>
        )}
      </section>
      {!canOperate && (
        <p className={styles.muted}>
          Tài khoản Giám sát có quyền xem thông tin thiết bị.
        </p>
      )}

      {/* Device Detailed Drawer */}
      <AnimatePresence>
        {selectedDevice && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDevice(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                role="dialog"
                aria-modal="true"
                aria-label="Chi tiết thiết bị UniFi"
                className={styles.drawer}
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600  shrink-0">
                      {(() => {
                        const Icon = getDeviceIcon(selectedDevice.type);
                        return (
                          <DeviceIcon
                            device={{
                              type:
                                selectedDevice.type === "ugw"
                                  ? "gateway"
                                  : selectedDevice.type,
                              name: selectedDevice.name,
                              meta: {
                                provider: "unifi",
                                model: selectedDevice.model,
                              },
                            }}
                            size={52}
                            fallback={<Icon className="w-8 h-8" />}
                          />
                        );
                      })()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">
                          {selectedDevice.name}
                        </h2>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            selectedDevice.status === "online" ||
                            selectedDevice.status === "connected"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {selectedDevice.status?.toUpperCase() || "UNKNOWN"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Model: {selectedDevice.model || "—"} &bull; MAC:{" "}
                        {selectedDevice.mac}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        IP: {selectedDevice.ipAddress || "—"} &bull; Firmware:{" "}
                        {selectedDevice.firmwareVersion || "—"}
                      </p>
                    </div>
                  </div>

                  <button
                    aria-label="Đóng chi tiết thiết bị"
                    onClick={() => setSelectedDevice(null)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Controller Action Bar */}
                {canOperate && (
                  <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Gửi lệnh Khởi động lại (Restart) thiết bị ${selectedDevice.name}?`,
                          )
                        ) {
                          handleDeviceAction(selectedDevice._id, "restart");
                        }
                      }}
                      disabled={actionLoading === selectedDevice._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-lg text-xs font-semibold  transition-all"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${actionLoading === selectedDevice._id ? "animate-spin" : ""}`}
                      />
                      Khởi động lại (Restart)
                    </button>

                    <button
                      onClick={() => {
                        handleDeviceAction(selectedDevice._id, "locate", {
                          locate: !selectedDevice.locating,
                        });
                      }}
                      disabled={actionLoading === selectedDevice._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold  transition-all"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      Nháy đèn định vị
                    </button>

                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Kích hoạt đồng bộ cấu hình (Force Provision) cho ${selectedDevice.name}?`,
                          )
                        ) {
                          handleDeviceAction(
                            selectedDevice._id,
                            "force-provision",
                          );
                        }
                      }}
                      disabled={actionLoading === selectedDevice._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold  transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Force Provision
                    </button>

                    <button
                      onClick={() => {
                        setRenameModal({ open: true, device: selectedDevice });
                        setNewName(selectedDevice.name || "");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold  transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Đổi tên thiết bị
                    </button>
                  </div>
                )}
                {/* Tabs */}
                <div
                  className={styles.drawerTabs}
                  role="tablist"
                  aria-label="Chi tiết thiết bị"
                >
                  {[
                    { id: "overview", label: "Tổng quan & Phần cứng" },
                    { id: "radios", label: "Radio & Sóng WiFi" },
                    { id: "ports", label: "Cổng & PoE" },
                    { id: "ssids", label: "Mạng phát (SSIDs)" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                        activeTab === tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Drawer Body Content */}
                <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === "overview" && (
                    <div className="space-y-5">
                      {/* Live System Gauges */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-500" /> Tài
                          nguyên hệ thống từ Controller
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-500 font-medium">
                                Tải CPU
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {selectedDevice.cpuUsage !== undefined
                                  ? `${selectedDevice.cpuUsage}%`
                                  : "—"}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (selectedDevice.cpuUsage || 0) > 80
                                    ? "bg-rose-500"
                                    : (selectedDevice.cpuUsage || 0) > 50
                                      ? "bg-amber-500"
                                      : "bg-blue-500"
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, selectedDevice.cpuUsage ?? 0))}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-500 font-medium">
                                Bộ nhớ RAM
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {selectedDevice.memUsage !== undefined
                                  ? `${selectedDevice.memUsage}%`
                                  : "—"}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, selectedDevice.memUsage ?? 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Device Identification */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2">
                          Thông tin phần cứng & Firmware
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 block mb-0.5">
                              Model thiết bị:
                            </span>
                            <span className="font-bold text-slate-800">
                              {selectedDevice.model || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5">
                              Số Serial (S/N):
                            </span>
                            <span className="font-mono font-bold text-slate-800">
                              {selectedDevice.serialNumber || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5">
                              Firmware Version:
                            </span>
                            <span className="font-mono text-slate-800">
                              {selectedDevice.firmwareVersion || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5">
                              Thời gian hoạt động (Uptime):
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {selectedDevice.uptime
                                ? formatUptime(selectedDevice.uptime)
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Uplink Connection */}
                      {selectedDevice.uplink && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
                            <Cable className="w-4 h-4 text-emerald-500" />{" "}
                            Uplink kết nối
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-500 block mb-0.5">
                                Loại liên kết:
                              </span>
                              <span className="font-bold text-slate-800">
                                {selectedDevice.uplink.uplinkType || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-0.5">
                                Tốc độ Uplink:
                              </span>
                              <span className="font-bold text-emerald-600">
                                {selectedDevice.uplink.speed
                                  ? `${selectedDevice.uplink.speed} Mbps`
                                  : "Chưa có dữ liệu"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-0.5">
                                Uplink MAC:
                              </span>
                              <span className="font-mono text-slate-700">
                                {selectedDevice.uplink.mac || "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-0.5">
                                Uplink IP:
                              </span>
                              <span className="font-mono text-slate-700">
                                {selectedDevice.uplink.ip || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Traffic stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                          <span className="text-xs font-bold text-emerald-700 block mb-1">
                            Tổng TX (gửi)
                          </span>
                          <span className="text-base font-semibold text-slate-900">
                            {selectedDevice.txBytes != null
                              ? formatBytes(selectedDevice.txBytes)
                              : "—"}
                          </span>
                        </div>
                        <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-xl">
                          <span className="text-xs font-bold text-sky-700 block mb-1">
                            Tổng RX (nhận)
                          </span>
                          <span className="text-base font-semibold text-slate-900">
                            {selectedDevice.rxBytes != null
                              ? formatBytes(selectedDevice.rxBytes)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: RADIOS */}
                  {activeTab === "radios" && (
                    <div className="space-y-4">
                      {selectedDevice.radioTable &&
                      selectedDevice.radioTable.length > 0 ? (
                        selectedDevice.radioTable.map((radio, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <div className="flex items-center gap-2">
                                <Radio className="w-4 h-4 text-blue-600" />
                                <h4 className="font-bold text-slate-900 text-sm">
                                  {radio.name || radio.radio.toUpperCase()} (
                                  {radio.radio === "na"
                                    ? "5 GHz"
                                    : radio.radio === "ng"
                                      ? "2.4 GHz"
                                      : "Chưa rõ"}
                                  )
                                </h4>
                              </div>
                              <span
                                className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                  radio.isEnabled !== false
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {radio.isEnabled !== false
                                  ? "Enabled"
                                  : "Disabled"}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="text-slate-500 block mb-0.5">
                                  Kênh (Channel):
                                </span>
                                <span className="font-bold text-slate-800">
                                  {radio.channel || "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block mb-0.5">
                                  Công suất TX:
                                </span>
                                <span className="font-bold text-slate-800">
                                  {radio.txPower
                                    ? `${radio.txPower} dBm`
                                    : "Auto"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block mb-0.5">
                                  Độ rộng kênh (HT):
                                </span>
                                <span className="font-bold text-slate-800">
                                  {radio.ht || "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-8 text-slate-500 text-xs">
                          Không có bảng radio cho thiết bị này
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: PORTS */}
                  {activeTab === "ports" && (
                    <div className="space-y-4">
                      {selectedDevice.portTable &&
                      selectedDevice.portTable.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedDevice.portTable.map((port) => (
                            <div
                              key={port.port_idx}
                              className={`p-3.5 rounded-xl border ${
                                port.up
                                  ? "bg-emerald-50/30 border-emerald-200"
                                  : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-800 text-xs">
                                  Port {port.port_idx}{" "}
                                  {port.name ? `(${port.name})` : ""}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                                    port.up
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {port.up ? "UP" : "DOWN"}
                                </span>
                              </div>

                              <div className="text-xs space-y-1 text-slate-600">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Tốc độ:
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {port.up && port.speed
                                      ? `${port.speed} Mbps`
                                      : "—"}
                                  </span>
                                </div>
                                {port.poe && (
                                  <div className="flex justify-between text-amber-700">
                                    <span>PoE Cấp nguồn:</span>
                                    <span className="font-bold">
                                      {port.poe_power || "Hoạt động"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-8 text-slate-500 text-xs">
                          Không có thông tin cổng kết nối (Port Table)
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: SSIDS / VAPS */}
                  {activeTab === "ssids" && (
                    <div className="space-y-3">
                      {selectedDevice.vapTable &&
                      selectedDevice.vapTable.length > 0 ? (
                        selectedDevice.vapTable.map((vap, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-slate-900 text-sm">
                                {vap.essid || vap.name}
                              </p>
                              <p className="font-mono text-xs text-slate-500 mt-0.5">
                                BSSID: {vap.bssid}
                              </p>
                              <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded mt-1 inline-block">
                                Radio:{" "}
                                {vap.radio === "na"
                                  ? "5 GHz"
                                  : vap.radio === "ng"
                                    ? "2.4 GHz"
                                    : vap.radio || "Chưa rõ"}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-xs text-slate-500 block mb-0.5">
                                Khách kết nối
                              </span>
                              <span className="text-lg font-bold text-blue-600">
                                {vap.num_sta || 0}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-8 text-slate-500 text-xs">
                          Không có danh sách VAP / SSID phát sóng trên thiết bị
                          này
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    UniFi Device Management
                  </span>
                  <button
                    onClick={() => setSelectedDevice(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Đóng chi tiết
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameModal.open && renameModal.device && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setRenameModal({ open: false, device: null })}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              role="dialog"
              aria-modal="true"
              aria-label="Đổi tên thiết bị UniFi"
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Đổi tên thiết bị UniFi
                  </h3>
                </div>
                <button
                  aria-label="Đóng biểu mẫu đổi tên"
                  onClick={() => setRenameModal({ open: false, device: null })}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="unifi-device-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tên thiết bị mới
                  </label>
                  <input
                    type="text"
                    id="unifi-device-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: AP10.1, AP_HoiTruong..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tên này sẽ được cập nhật trực tiếp vào UniFi Controller
                  </p>
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() =>
                      setRenameModal({ open: false, device: null })
                    }
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleRenameSubmit}
                    disabled={isRenaming || !newName.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold  transition-all disabled:opacity-50"
                  >
                    {isRenaming && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Lưu tên mới
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
