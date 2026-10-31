"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { DeviceIcon } from "@/components/network/DeviceIcon";
import {
  Plus,
  Save,
  RefreshCw,
  PlugZap,
  Trash2,
  X,
  Router,
  Search,
  Pencil,
} from "lucide-react";
import styles from "./DeviceManagement.module.css";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
interface Connection {
  id: string;
  provider: "UNIFI" | "MIKROTIK";
  name: string;
  baseUrl: string;
  username: string | null;
  isDefault: boolean;
  version: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  hasCredentials: boolean;
  config: {
    site?: string;
    sites?: string[];
    apiMode?: string;
    apiPrefix?: string;
    allowInsecure?: boolean;
    deviceRole?: "router" | "core-switch" | "access-switch";
    model?: string;
    location?: string;
    operatingSystem?: "routeros" | "swos";
  };
}
const blank = {
  id: "",
  provider: "MIKROTIK" as "UNIFI" | "MIKROTIK",
  name: "",
  baseUrl: "",
  username: "",
  password: "",
  apiKey: "",
  site: "default",
  monitoredSites: "",
  apiMode: "auto",
  apiPrefix: "",
  allowInsecure: false,
  isDefault: false,
  deviceRole: "router" as "router" | "core-switch" | "access-switch",
  model: "",
  location: "",
  operatingSystem: "routeros" as "routeros" | "swos",
};
export function ConnectionSettings({
  embedded = false,
  onSaved,
  providerFilter,
  autoCreate = false,
}: {
  embedded?: boolean;
  onSaved?: () => void;
  providerFilter?: "MIKROTIK" | "UNIFI";
  autoCreate?: boolean;
} = {}) {
  const { canAdmin } = useAuth();
  const [rows, setRows] = useState<Connection[]>([]),
    [loaded, setLoaded] = useState(false),
    [form, setForm] = useState({
      ...blank,
      provider: providerFilter || blank.provider,
    }),
    [editing, setEditing] = useState(autoCreate),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [warnings, setWarnings] = useState<string[]>([]),
    [encryption, setEncryption] = useState<boolean | null>(null),
    [removing, setRemoving] = useState<Connection | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const load = async () => {
    setLoadingRows(true);
    try {
      const r = await api.get<{
        data: Connection[];
        warnings?: string[];
        encryptionConfigured: boolean;
      }>("/api/network/connections");
      setRows(r.data);
      setWarnings(r.warnings || []);
      setEncryption(r.encryptionConfigured);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingRows(false);
    }
  };
  useEffect(() => {
    if (canAdmin) void load();
  }, [canAdmin]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const providerRows = rows.filter(
    (row) => !providerFilter || row.provider === providerFilter,
  );
  const visibleRows = providerRows.filter((row) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [row.name, row.baseUrl, row.config.model, row.config.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (statusFilter === "all" ||
        (statusFilter === "online"
          ? row.status === "online"
          : row.status !== "online")) &&
      (roleFilter === "all" ||
        (row.config.deviceRole || "router") === roleFilter)
    );
  });
  const roleLabel = (row: Connection) =>
    row.provider === "UNIFI"
      ? "Controller"
      : row.config.deviceRole === "core-switch"
        ? "Core switch"
        : row.config.deviceRole === "access-switch"
          ? "Access switch"
          : "Router";
  const startCreate = (provider = providerFilter || blank.provider) => {
    setForm({ ...blank, provider });
    setEditing(true);
    setNotice("");
    setError("");
  };
  const deviceIdentity = (row: Connection) => ({
    type:
      row.provider === "UNIFI"
        ? "controller"
        : row.config.deviceRole === "core-switch" ||
            row.config.deviceRole === "access-switch"
          ? "switch"
          : "router",
    name: row.name,
    meta: {
      provider: row.provider.toLowerCase(),
      model: row.config.model,
      deviceRole: row.config.deviceRole,
    },
  });
  const fleet = rows.filter((row) => row.provider === "MIKROTIK");
  const changed = () => {
    window.dispatchEvent(new Event("network-connections-changed"));
    onSaved?.();
  };
  useEffect(() => {
    if (autoCreate) {
      setForm({ ...blank, provider: providerFilter || blank.provider });
      setEditing(true);
    }
  }, [autoCreate, providerFilter]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      await api.post("/api/network/connections", {
        id: form.id || undefined,
        provider: form.provider,
        name: form.name,
        baseUrl: form.baseUrl,
        username: form.username,
        credentials: {
          password: form.password || undefined,
          apiKey: form.apiKey || undefined,
        },
        config: {
          site: form.site,
          sites: form.monitoredSites
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          apiMode: form.apiMode,
          apiPrefix: form.apiPrefix,
          allowInsecure: form.allowInsecure,
          ...(form.provider === "MIKROTIK"
            ? {
                deviceRole: form.deviceRole,
                model: form.model.trim(),
                location: form.location.trim(),
                operatingSystem: form.operatingSystem,
              }
            : {}),
        },
        isDefault: form.isDefault,
      });
      setEditing(false);
      setNotice(
        "Đã lưu kết nối. Có thể kiểm tra bằng thao tác đọc thông tin thiết bị.",
      );
      await load();
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const test = async (row: Connection) => {
    setBusy(row.id);
    setError("");
    setNotice("");
    try {
      const r = await api.post<any>(`/api/network/connections/${row.id}/test`);
      setNotice(
        `${row.name}: đã kết nối${r.data?.version ? `, phiên bản ${r.data.version}` : ""}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      await load();
    }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(removing.id);
    setError("");
    try {
      await api.delete(`/api/network/connections/${removing.id}`);
      setNotice("Đã xóa kết nối khỏi hệ thống quản trị.");
      setRemoving(null);
      await load();
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const edit = (row: Connection) => {
    setForm({
      ...blank,
      id: row.id,
      provider: row.provider,
      name: row.name,
      baseUrl: row.baseUrl,
      username: row.username || "",
      site: row.config.site || "default",
      monitoredSites: (row.config.sites || []).join(", "),
      apiMode: row.config.apiMode || "auto",
      apiPrefix: row.config.apiPrefix || "",
      allowInsecure: row.config.allowInsecure === true,
      isDefault: row.isDefault,
      deviceRole: row.config.deviceRole || "router",
      model: row.config.model || "",
      location: row.config.location || "",
      operatingSystem: "routeros",
    });
    setEditing(true);
    setError("");
  };
  if (!canAdmin)
    return (
      <p className="admin-error">Chỉ quản trị viên được quản lý kết nối.</p>
    );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Network / Connections</span>
          {embedded ? (
            <h2>
              {providerFilter === "MIKROTIK"
                ? "Thiết bị MikroTik"
                : providerFilter === "UNIFI"
                  ? "Kết nối UniFi"
                  : "Kết nối mạng"}
            </h2>
          ) : (
            <h1>
              {providerFilter === "MIKROTIK"
                ? "Thiết bị MikroTik"
                : providerFilter === "UNIFI"
                  ? "Kết nối UniFi"
                  : "Kết nối mạng"}
            </h1>
          )}
          <p>
            {providerFilter === "MIKROTIK"
              ? "Quản lý kết nối RouterOS của router, core switch và access switch."
              : "Quản lý kết nối thiết bị và Controller đang dùng để giám sát mạng."}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.button}
            disabled={Boolean(busy) || loadingRows}
            onClick={() => {
              setError("");
              void load();
            }}
          >
            <RefreshCw size={15} />
            Làm mới
          </button>
          <button
            className={`${styles.button} ${styles.primary}`}
            disabled={!loaded || Boolean(busy)}
            onClick={() => startCreate()}
          >
            <Plus size={15} />
            {providerFilter === "MIKROTIK" ? "Thêm thiết bị" : "Thêm kết nối"}
          </button>
        </div>
      </header>
      <div className={styles.stats} aria-label="Thống kê kết nối">
        <div className={styles.stat}>
          <span>
            Tổng {providerFilter === "MIKROTIK" ? "thiết bị" : "kết nối"}
          </span>
          <strong>{loaded ? providerRows.length : "—"}</strong>
        </div>
        <div className={styles.stat}>
          <span>
            <i className={`${styles.badge} ${styles.online}`} />
            Đã kết nối
          </span>
          <strong>
            {loaded
              ? providerRows.filter((row) => row.status === "online").length
              : "—"}
          </strong>
        </div>
        <div className={styles.stat}>
          <span>Cần kiểm tra</span>
          <strong>
            {loaded
              ? providerRows.filter((row) => row.status !== "online").length
              : "—"}
          </strong>
        </div>
        <div className={styles.stat}>
          <span>
            {providerFilter === "MIKROTIK" ? "Switch" : "Nhà cung cấp"}
          </span>
          <strong>
            {loaded
              ? providerFilter === "MIKROTIK"
                ? fleet.filter(
                    (row) =>
                      row.config.deviceRole === "core-switch" ||
                      row.config.deviceRole === "access-switch",
                  ).length
                : new Set(providerRows.map((row) => row.provider)).size
              : "—"}
          </strong>
        </div>
      </div>
      {encryption === false && (
        <div role="status" className={styles.notice}>
          Máy chủ chưa có khóa mã hóa kết nối. Chạy{" "}
          <code>npm run network:key</code> trên máy chủ rồi khởi động lại ứng
          dụng để cấu hình.
        </div>
      )}
      {warnings.map((w) => (
        <p className={styles.notice} key={w}>
          {w}
        </p>
      ))}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div className={styles.notice}>
          <p role="status">{notice}</p>
          {(providerFilter === "MIKROTIK" || fleet.length > 0) && (
            <Link
              className="mt-2 inline-block underline underline-offset-4"
              href="/admin/mikrotik/topology?scope=fleet"
            >
              Xem sơ đồ toàn bộ thiết bị MikroTik →
            </Link>
          )}
        </div>
      )}
      {editing && (
        <section className={styles.formPanel} aria-label="Biểu mẫu kết nối">
          <div className={styles.formHeader}>
            <div>
              <span className={styles.eyebrow}>
                {form.provider === "MIKROTIK"
                  ? "MikroTik / RouterOS"
                  : "UniFi / Controller"}
              </span>
              <h2>
                {form.id
                  ? "Chỉnh sửa kết nối"
                  : providerFilter === "MIKROTIK"
                    ? "Thêm thiết bị"
                    : "Thêm kết nối"}
              </h2>
            </div>
            <button
              className={styles.iconButton}
              aria-label="Đóng biểu mẫu kết nối"
              onClick={() => setEditing(false)}
            >
              <X size={17} />
            </button>
          </div>
          <form onSubmit={save} className={styles.formGrid}>
            <label>
              Nhà cung cấp
              <select
                disabled={Boolean(form.id) || Boolean(providerFilter)}
                className="border border-slate-300 p-2"
                value={form.provider}
                onChange={(e) =>
                  setForm({
                    ...form,
                    provider: e.target.value as typeof form.provider,
                  })
                }
              >
                <option value="MIKROTIK">MikroTik</option>
                <option
                  value="UNIFI"
                  disabled={
                    !form.id && rows.some((r) => r.provider === "UNIFI")
                  }
                >
                  UniFi
                </option>
              </select>
            </label>
            <label>
              Tên kết nối
              <input
                required
                maxLength={120}
                value={form.name}
                className="border border-slate-300 p-2"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Địa chỉ thiết bị
              <input
                required
                type="url"
                value={form.baseUrl}
                placeholder="https://192.168.1.1:443"
                className="border border-slate-300 p-2"
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
              <span className="text-xs text-slate-500">
                Gồm giao thức, IP/tên máy chủ và cổng; không thêm đường dẫn.
              </span>
            </label>
            <label>
              Tên đăng nhập
              <input
                value={form.username}
                autoComplete="off"
                className="border border-slate-300 p-2"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Mật khẩu{form.id ? " mới (để trống để giữ nguyên)" : ""}
              <input
                type="password"
                value={form.password}
                autoComplete="new-password"
                className="border border-slate-300 p-2"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            {form.provider === "UNIFI" && (
              <>
                <label>
                  UniFi API key{form.id ? " mới (tùy chọn)" : ""}
                  <input
                    type="password"
                    value={form.apiKey}
                    autoComplete="new-password"
                    className="border border-slate-300 p-2"
                    onChange={(e) =>
                      setForm({ ...form, apiKey: e.target.value })
                    }
                  />
                </label>
                <label>
                  Site mặc định
                  <input
                    required
                    value={form.site}
                    pattern="[a-zA-Z0-9_-]+"
                    className="border border-slate-300 p-2"
                    onChange={(e) => setForm({ ...form, site: e.target.value })}
                  />
                </label>
                <label>
                  Site cần giám sát
                  <textarea
                    value={form.monitoredSites}
                    placeholder="Để trống để giám sát site mặc định"
                    className="border border-slate-300 p-2"
                    onChange={(e) =>
                      setForm({ ...form, monitoredSites: e.target.value })
                    }
                  />
                  <span className="text-xs text-slate-500">
                    Nhập ID các site cách nhau bằng dấu phẩy hoặc xuống dòng. ID
                    nằm trong bộ chọn Site của UniFi.
                  </span>
                </label>
                <label>
                  Chế độ API
                  <select
                    className="border border-slate-300 p-2"
                    value={form.apiMode}
                    onChange={(e) =>
                      setForm({ ...form, apiMode: e.target.value })
                    }
                  >
                    <option value="auto">
                      Tự nhận diện theo thông tin xác thực
                    </option>
                    <option value="legacy">Controller API hiện có</option>
                    <option value="official">API chính thức với API key</option>
                  </select>
                </label>
                <label>
                  Loại Controller
                  <select
                    className="border border-slate-300 p-2"
                    value={form.apiPrefix}
                    onChange={(e) =>
                      setForm({ ...form, apiPrefix: e.target.value })
                    }
                  >
                    <option value="">Network Server trực tiếp</option>
                    <option value="/proxy/network">
                      UniFi OS (/proxy/network)
                    </option>
                  </select>
                </label>
              </>
            )}
            {form.provider === "MIKROTIK" && (
              <>
                <label>
                  Vai trò thiết bị
                  <select
                    value={form.deviceRole}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        deviceRole: e.target.value as typeof form.deviceRole,
                      })
                    }
                  >
                    <option value="router">Router</option>
                    <option value="core-switch">Core switch</option>
                    <option value="access-switch">Access switch</option>
                  </select>
                </label>
                <label>
                  Hệ điều hành
                  <select
                    value={form.operatingSystem}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        operatingSystem: e.target
                          .value as typeof form.operatingSystem,
                      })
                    }
                  >
                    <option value="routeros">RouterOS</option>
                  </select>
                </label>
                <label>
                  Model (tùy chọn)
                  <input
                    maxLength={120}
                    value={form.model}
                    onChange={(e) =>
                      setForm({ ...form, model: e.target.value })
                    }
                    placeholder="CCR2004, CRS328…"
                  />
                </label>
                <label>
                  Vị trí (tùy chọn)
                  <input
                    maxLength={160}
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="Tủ mạng tầng 1"
                  />
                </label>
              </>
            )}

            <div className={`${styles.formGroup} ${styles.full}`}>
              <label>
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  disabled={
                    rows.find((r) => r.id === form.id)?.isDefault === true
                  }
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                />
                Dùng làm kết nối mặc định
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.allowInsecure}
                  onChange={(e) =>
                    setForm({ ...form, allowInsecure: e.target.checked })
                  }
                />
                Cho phép chứng chỉ tự ký trên kết nối này
              </label>
            </div>
            <p className={`${styles.muted} ${styles.full}`}>
              Mật khẩu và API key được mã hóa khi lưu. Để trống thông tin xác
              thực khi chỉnh sửa để giữ giá trị hiện tại.
            </p>
            <div className={styles.formFooter}>
              <button
                disabled={!loaded || Boolean(busy) || encryption === false}
                className={`${styles.button} ${styles.primary}`}
              >
                <Save size={15} />
                {busy === "save" ? "Đang lưu…" : "Lưu kết nối"}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setEditing(false)}
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}
      {removing && (
        <section
          role="alertdialog"
          aria-label="Xác nhận xóa kết nối"
          className={styles.formPanel}
        >
          <div className="p-5">
            <h2 className="font-semibold">Xóa kết nối {removing.name}?</h2>
            <p className="my-3 text-slate-500">
              Các chức năng đang dùng kết nối này sẽ cần được chọn lại. Thao tác
              chỉ xóa cấu hình kết nối trong ứng dụng.
            </p>
            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.danger}`}
                disabled={Boolean(busy)}
                onClick={() => void remove()}
              >
                Xóa kết nối
              </button>
              <button
                className={styles.button}
                onClick={() => setRemoving(null)}
              >
                Hủy
              </button>
            </div>
          </div>
        </section>
      )}
      <section
        className={styles.panel}
        aria-label="Danh sách kết nối"
        aria-busy={loadingRows}
      >
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className="sr-only">Tìm kết nối</span>
            <Search size={15} />
            <input
              placeholder="Tìm tên, địa chỉ, model, vị trí…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {providerFilter === "MIKROTIK" && (
            <select
              aria-label="Lọc loại phần cứng"
              className={styles.select}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">Tất cả vai trò</option>
              <option value="router">Router</option>
              <option value="core-switch">Core switch</option>
              <option value="access-switch">Access switch</option>
            </select>
          )}
          <select
            aria-label="Lọc trạng thái kết nối"
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="online">Đã kết nối</option>
            <option value="other">Cần kiểm tra</option>
          </select>
          <span className={styles.results}>
            {loaded
              ? `${visibleRows.length} / ${providerRows.length} kết nối`
              : "Đang tải cấu hình…"}
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Thiết bị / Kết nối</th>
                <th>Địa chỉ</th>
                <th>Trạng thái</th>
                <th>Phiên bản</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className={styles.identity}>
                      <DeviceIcon
                        device={deviceIdentity(row)}
                        size={42}
                        fallback={
                          <Router size={30} className="text-slate-400" />
                        }
                      />
                      <div>
                        <strong>
                          {row.name}
                          {row.isDefault && (
                            <span className={styles.default}>Mặc định</span>
                          )}
                        </strong>
                        <small>
                          {[
                            row.provider === "MIKROTIK" ? "MikroTik" : "UniFi",
                            roleLabel(row),
                            row.config.model,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                        {row.config.location && (
                          <small>{row.config.location}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.mono}>{row.baseUrl}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${row.status === "online" ? styles.online : row.status === "error" || row.status === "offline" ? styles.offline : ""}`}
                    >
                      {row.status === "online"
                        ? "Đã kết nối"
                        : row.status === "error"
                          ? "Lỗi kết nối"
                          : row.status === "offline"
                            ? "Ngoại tuyến"
                            : "Chưa kiểm tra"}
                    </span>
                    {row.lastError && (
                      <p className={styles.rowError}>{row.lastError}</p>
                    )}
                  </td>
                  <td>
                    <span className={styles.mono}>{row.version || "—"}</span>
                    <small className={styles.muted}>
                      {row.provider === "MIKROTIK"
                        ? "RouterOS"
                        : "UniFi Network"}
                    </small>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        disabled={Boolean(busy)}
                        className={styles.textButton}
                        onClick={() => void test(row)}
                      >
                        <span className="inline-flex items-center gap-1">
                          <PlugZap size={14} />
                          {busy === row.id ? "Đang kiểm tra…" : "Kiểm tra"}
                        </span>
                      </button>
                      <button
                        disabled={Boolean(busy)}
                        className={styles.iconButton}
                        aria-label={`Sửa ${row.name}`}
                        title="Sửa kết nối"
                        onClick={() => edit(row)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        disabled={Boolean(busy)}
                        className={`${styles.iconButton} ${styles.danger}`}
                        aria-label={`Xóa ${row.name}`}
                        title="Xóa kết nối"
                        onClick={() => setRemoving(row)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleRows.length && (
          <div className={styles.empty}>
            <Router size={30} />
            <strong>
              {!loaded
                ? loadingRows
                  ? "Đang tải kết nối…"
                  : "Không thể tải cấu hình kết nối"
                : providerRows.length
                  ? "Không tìm thấy kết nối phù hợp"
                  : "Chưa có kết nối"}
            </strong>
            {providerRows.length ? (
              <button
                className={styles.textButton}
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
              >
                Xóa bộ lọc
              </button>
            ) : (
              "Thêm thiết bị để bắt đầu quản trị và giám sát."
            )}
          </div>
        )}
      </section>
    </div>
  );
}
