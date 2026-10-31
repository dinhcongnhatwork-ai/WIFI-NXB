"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { duration, observedTime, radioLabel, wifiStandard } from "./ap-model";
import { DeviceIcon } from "../DeviceIcon";
import { Copy, X } from "lucide-react";
import { SourceStamp } from "@/components/ui/operations";
import { ClientContextPanel } from "./ClientContextPanel";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  bytes,
  rate,
  typeLabel,
  isOffline,
  type Device,
  type Link as NetworkLink,
  type Traffic,
  type HistoryPoint,
} from "./model";
export function Source({
  traffic,
  fallback,
}: {
  traffic?: Traffic;
  fallback?: string;
}) {
  const detail = [
    traffic?.perspective === "interface"
      ? "TX / RX theo phía interface; chưa xác định chiều người dùng"
      : null,
    traffic?.reason
      ? {
          "first-sample": "Đang đo…",
          "counter-reset": "Bộ đếm vừa đặt lại",
          "missing-counters": "Nguồn không cung cấp lưu lượng",
          "stale-sample": "Mẫu quá hạn",
        }[traffic.reason]
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mt-2 break-words text-xs text-slate-500">
      {traffic ? (
        <SourceStamp
          source={traffic.source}
          sampledAt={traffic.sampledAt}
          detail={detail}
        />
      ) : (
        fallback || "Nguồn chưa cung cấp số liệu"
      )}
    </div>
  );
}
/** Clipboard API needs a secure context; LAN HTTP consoles use the browser copy command. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Fall through when the browser refuses the secure clipboard API. */
    }
  }
  const previous = document.activeElement as HTMLElement | null;
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;opacity:0";
  document.body.appendChild(input);
  try {
    input.select();
    input.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
    previous?.focus({ preventScroll: true });
  }
}
function Field({
  label,
  value,
  copy = false,
}: {
  label: string;
  value: unknown;
  copy?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="flex min-w-0 items-start gap-2 break-words text-right font-medium text-slate-700">
        <span className={copy ? "font-mono text-xs" : ""}>{text}</span>
        {copy && text !== "—" && (
          <button
            title={copied ? "Đã sao chép" : `Sao chép ${label}`}
            aria-label={`Sao chép ${label}`}
            onClick={() => void copyText(text).then(setCopied)}
          >
            <Copy size={13} />
          </button>
        )}
      </dd>
    </div>
  );
}
function History({ points }: { points: HistoryPoint[] }) {
  const valid = points.filter((p) => p.download != null || p.upload != null);
  if (valid.length < 2)
    return (
      <p className="py-7 text-center text-xs text-slate-500">
        Đang thu thập lịch sử · tối đa 15 phút trong trình duyệt.
      </p>
    );
  const start = points[0].at;
  const duration = Math.max(1, points[points.length - 1].at - start);
  const max = Math.max(
    1,
    ...points.flatMap((p) => [p.download || 0, p.upload || 0]),
  );
  const paths = (key: "download" | "upload") => {
    let d = "";
    let gap = true;
    points.forEach((p, i) => {
      if (p[key] == null || (i > 0 && p.at - points[i - 1].at > 15000)) {
        gap = true;
        if (p[key] == null) return;
      }
      d += `${gap ? "M" : "L"}${(((p.at - start) / duration) * 330).toFixed(1)},${(90 - (p[key]! / max) * 80).toFixed(1)} `;
      gap = false;
    });
    return d;
  };
  return (
    <div>
      <svg
        viewBox="0 0 330 105"
        role="img"
        aria-label="Lưu lượng 15 phút: download xanh, upload xám"
        className="mt-4 w-full"
      >
        <path d="M0 90H330" stroke="#e2e8f0" />
        <path
          d={paths("download")}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
        />
        <path
          d={paths("upload")}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>
          {new Date(start).toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Bangkok",
          })}
        </span>
        <span>{rate(max)}</span>
        <span>
          {new Date(points[points.length - 1].at).toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Bangkok",
          })}
        </span>
      </div>
    </div>
  );
}
function TrafficCard({
  traffic,
  history = [],
}: {
  traffic?: Traffic;
  history?: HistoryPoint[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Lưu lượng thực tế
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">
            {traffic?.perspective === "interface"
              ? "Đã truyền (TX)"
              : "Đã tải xuống"}
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900">
            {bytes(traffic?.downloadBytes)}
          </p>
          <p className="mt-2 font-mono text-xs text-blue-600">
            {traffic?.perspective === "interface" ? "TX" : "↓"}{" "}
            {rate(traffic?.downloadBps)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">
            {traffic?.perspective === "interface"
              ? "Đã nhận (RX)"
              : "Đã tải lên"}
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900">
            {bytes(traffic?.uploadBytes)}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500">
            {traffic?.perspective === "interface" ? "RX" : "↑"}{" "}
            {rate(traffic?.uploadBps)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Tổng từ bộ đếm của nguồn; có thể đặt lại khi thiết bị hoặc phiên kết nối
        khởi động lại.
      </p>
      <Source traffic={traffic} />
      <History points={history} />
    </div>
  );
}
export function DetailDrawer({
  device,
  edge,
  traffic,
  history,
  devices,
  members,
  onSelect,
  onClose,
  observedAt,
}: {
  device?: Device;
  edge?: NetworkLink;
  traffic?: Traffic;
  history?: HistoryPoint[];
  devices: Device[];
  members?: Device[];
  onSelect: (id: string) => void;
  onClose: () => void;
  observedAt: string;
}) {
  const { canAdmin } = useAuth();
  const defaultTab = device?.type === "branch" ? "related" : "overview";
  const [storedTab, setTab] = useState(defaultTab);
  const [tabOwner, setTabOwner] = useState(device?.id || edge?.id);
  const tab = tabOwner === (device?.id || edge?.id) ? storedTab : defaultTab;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setTabOwner(device?.id || edge?.id);
    setTab(device?.type === "branch" ? "related" : "overview");
    closeRef.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [device?.id, edge?.id, onClose]);
  if (!device && !edge) return null;
  const meta = device?.meta || {};
  const rows = members || [];
  const ports = Array.isArray(meta.portTable) ? meta.portTable : [];
  const radios = Array.isArray(meta.radioTable) ? meta.radioTable : [];
  const title = device?.name || "Chi tiết liên kết";
  const tabs = device?.type === "branch" ? [["related", "Thiết bị trong nhóm"]] : [
    ["overview", "Tổng quan"],
    ["connection", "Kết nối"],
    ["traffic", "Lưu lượng"],
    ["related", "Liên quan"],
  ];
  return (
    <aside
      aria-label="Chi tiết quan sát"
      className="flex max-h-[80vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white xl:w-[400px]"
    >
      <header className="border-b border-slate-200 p-5">
        <div className="flex items-start gap-3">
          {device && <DeviceIcon device={device} size={36} />} 
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {device ? typeLabel(device.type) : "Liên kết quan sát"}
            </p>
            <h2 className="break-words text-lg font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            aria-label="Bỏ lựa chọn"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={19} />
          </button>
        </div>
        {device && !meta.layoutOnly && (
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span
              className={`h-2 w-2 rounded-full ${isOffline(device.status) ? "bg-red-600" : /online|connected|running/.test(device.status || "") ? "bg-green-600" : "bg-slate-400"}`}
            />
            {isOffline(device.status)
              ? "Ngoại tuyến"
              : device.status
                ? "Đã quan sát"
                : "Chưa rõ trạng thái"}
            {meta.uptime != null
              ? ` · ${Math.floor(Number(meta.uptime) / 3600)} giờ ${Math.floor((Number(meta.uptime) % 3600) / 60)} phút`
              : ""}
          </p>
        )}
        <Source
          traffic={meta.layoutOnly ? undefined : traffic}
          fallback={meta.layoutOnly ? meta.description : `Quan sát · ${observedAt ? new Date(observedAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" }) : "—"}`}
        />
      </header>
      <div
        role="tablist"
        aria-label="Chi tiết thiết bị"
        className="grid grid-cols-4 border-b border-slate-200"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`topology-tab-${id}`}
            aria-controls="topology-detail-panel"
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const next =
                  tabs[
                    (tabs.findIndex((t) => t[0] === id) +
                      (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                      tabs.length
                  ][0];
                setTab(next);
                document.getElementById(`topology-tab-${next}`)?.focus();
              }
            }}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`border-b-2 px-1 py-3 text-xs font-medium ${tab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        id="topology-detail-panel"
        aria-labelledby={`topology-tab-${tab}`}
        role="tabpanel"
        className="space-y-4 overflow-y-auto p-5"
      >
        {(tab === "overview" || tab === "traffic") && !meta.layoutOnly && (
          <TrafficCard traffic={traffic} history={history} />
        )}
        {tab === "overview" && device && !meta.layoutOnly && (
          <dl>
            <Field label="Tên thiết bị" value={device.name} />
            <Field label="Hostname" value={meta.hostname} />
            <Field label="Tên do quản trị đặt" value={meta.alias} />
            <Field label="Hãng sản xuất" value={meta.vendor} />
            <Field
              label="Model / nền tảng"
              value={meta.model || meta.platform}
            />
            <Field label={device.type === "client" ? "Hệ điều hành" : "Firmware"} value={meta.osName || meta.version} />
            {device.type !== "client" && <Field label="Thời gian hoạt động" value={duration(meta.uptime)} />}
            <Field label="Địa chỉ IP" value={device.ip} copy />
            <Field label="MAC" value={device.mac} copy />
            {device.type === "client" && <>
              <Field label="Đang kết nối vào AP" value={meta.apName || meta.apMac} />
              <Field label="SSID" value={meta.ssid} />
              <Field label="Thời gian kết nối" value={duration(meta.uptime)} />
              <Field label="Được cấp quyền mạng" value={meta.authorized == null ? null : meta.authorized ? "Có" : "Chưa"} />
              <Field label="Mạng khách" value={meta.isGuest == null ? null : meta.isGuest ? "Có" : "Không"} />
              <Field label="Lần đầu ghi nhận" value={observedTime(meta.firstSeen)} />
              <Field label="Lần kết nối" value={observedTime(meta.assocTime)} />
              <Field label="Nhàn rỗi" value={duration(meta.inactivityTime)} />
              <Field label="Ghi nhận gần nhất" value={observedTime(meta.lastSeen)} />
            </>}
            {(device.type === "gateway" || device.type === "ap" || device.type === "switch") && (
              <div className="mt-3">
                <Field
                  label="CPU"
                  value={meta.cpuUsage != null ? `${meta.cpuUsage}%` : null}
                />
                <Field
                  label="RAM"
                  value={meta.memUsage != null ? `${meta.memUsage}%` : null}
                />
                <Link
                  href="/admin/monitor"
                  className="text-sm font-medium text-blue-600"
                >
                  CPU / RAM · Mở trang Giám sát →
                </Link>
              </div>
            )}
          </dl>
        )}
        {tab === "connection" && device && (
          <>
            <dl>
              <Field label="Điểm truy cập" value={meta.apName || meta.apMac} />
              <Field label="SSID" value={meta.ssid} />
              <Field
                label="Băng tần / kênh"
                value={[radioLabel(meta), meta.channel && `ch ${meta.channel}`]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Field
                label="Tín hiệu"
                value={
                  meta.signal != null
                    ? `${meta.signal} dBm · ${Number(meta.signal) >= -60 ? "Tốt" : Number(meta.signal) >= -75 ? "Khá" : "Yếu"}`
                    : null
                }
              />
              <Field label="Noise" value={meta.noise != null ? `${meta.noise} dBm` : null} />
              <Field label="SNR" value={meta.noise != null && meta.signal != null ? `${Math.round(meta.signal-meta.noise)} dB` : null} />
              <Field label="Chuẩn WiFi" value={wifiStandard(meta.protocol)} />
              <Field label="Gói nhận (RX)" value={meta.rxPackets} />
              <Field label="Gói truyền (TX)" value={meta.txPackets} />
              <Field label="TX retries" value={meta.txRetries} />
              <Field label="PHY RX" value={meta.rxPhyMbps != null ? `${meta.rxPhyMbps} Mbps` : null} />
              <Field label="PHY TX" value={meta.txPhyMbps != null ? `${meta.txPhyMbps} Mbps` : null} />
              <Field label="VLAN" value={meta.vlan} />
              <Field
                label="Uplink"
                value={
                  typeof meta.uplink === "object"
                    ? meta.uplink?.uplink_remote_mac ||
                      meta.uplink?.mac ||
                      meta.uplink?.name
                    : meta.uplink
                }
              />
            </dl>
            {(device.type === "gateway" || device.type === "ap" || device.type === "switch") && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Interface quan sát
                </h3>
                {devices
                  .filter((n) => n.type === "interface" || n.type === "bridge")
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onSelect(n.id)}
                      className="flex w-full justify-between border-b border-slate-100 py-2 text-left text-xs"
                    >
                      <span>{n.name}</span>
                      <span className="font-mono">{n.status || "—"}</span>
                    </button>
                  ))}
              </div>
            )}
            {radios.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Radio</h3>
                {radios.map((r: any, i: number) => (
                  <div
                    key={i}
                    className="border-b border-slate-100 py-2 text-xs text-slate-600"
                  >
                    {r.name || r.radio || `Radio ${i + 1}`} · kênh{" "}
                    {r.channel ?? "—"} · công suất {r.tx_power ?? "—"} dBm · sử
                    dụng {r.channel_utilization ?? "—"}%
                  </div>
                ))}
              </div>
            )}
            {ports.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold">Cổng mạng</h3>
                <div className="mb-3 grid grid-cols-8 gap-1">
                  {ports.map((p: any, i: number) => (
                    <span
                      key={i}
                      title={p.name || `Port ${p.port_idx ?? i + 1}`}
                      className={`rounded border p-1 text-center font-mono text-xs ${p.up ? "border-slate-400 bg-slate-100" : "border-slate-200 text-slate-400"}`}
                    >
                      {p.port_idx ?? i + 1}
                    </span>
                  ))}
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2">Cổng</th>
                      <th>Tốc độ</th>
                      <th>PoE</th>
                      <th>TX / RX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ports.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2">
                          {p.name || p.port_idx || i + 1}
                        </td>
                        <td>{p.speed != null ? `${p.speed} Mbps` : "—"}</td>
                        <td>
                          {p.poe_power != null ? `${p.poe_power} W` : "—"}
                        </td>
                        <td>
                          {bytes(p.tx_bytes)} / {bytes(p.rx_bytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {(tab === "overview" || tab === "connection") && edge && (
          <dl>
            <Field
              label="Thiết bị nguồn"
              value={
                devices.find((n) => n.id === edge.source)?.name || edge.source
              }
            />
            <Field
              label="Thiết bị đích"
              value={
                devices.find((n) => n.id === edge.target)?.name || edge.target
              }
            />
            <Field
              label="Cổng nguồn / đích"
              value={`${edge.sourcePort || "—"} / ${edge.targetPort || "—"}`}
            />
            <Field
              label="Tốc độ liên kết"
              value={edge.speedMbps ? `${edge.speedMbps} Mbps` : null}
            />
            <Field
              label="PoE"
              value={edge.poeWatts != null ? `${edge.poeWatts} W` : null}
            />
            <Field
              label="Bằng chứng"
              value={
                (
                  {
                    "device.uplink": "Cổng uplink do thiết bị báo cáo",
                    "client.ap_mac": "Máy khách báo cáo AP đang kết nối",
                    "client.sw_mac": "Máy khách báo cáo switch đang kết nối",
                    "device.port_table.lldp_table":
                      "Thiết bị lân cận được phát hiện qua LLDP",
                    "/interface/bridge/host": "Bảng MAC của bridge",
                    "/ip/neighbor": "Thiết bị lân cận do router quan sát",
                  } as Record<string, string>
                )[edge.evidence] || edge.evidence
              }
            />
          </dl>
        )}
        {tab === "related" && (
          <>
            <h3 className="text-sm font-semibold">
              {rows.length
                ? `${rows.length} ${device?.type === "branch" ? "AP" : "máy khách"} · sắp theo lưu lượng`
                : "Thông tin liên quan"}
            </h3>
            {rows.length ? (
              <div className="max-h-96 overflow-y-auto">
                {[...rows]
                  .sort(
                    (a, b) =>
                      (b.traffic?.downloadBps || 0) -
                      (a.traffic?.downloadBps || 0),
                  )
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onSelect(n.id)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-100 py-3 text-left text-xs"
                    >
                      <DeviceIcon device={n} size={24} />
                      <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
                      <span className="shrink-0 font-mono text-blue-600">
                        ↓ {rate(n.traffic?.downloadBps)}
                      </span>
                    </button>
                  ))}
              </div>
            ) : device?.type === "client" ? (
              <ClientContextPanel
                key={device.mac || device.id}
                device={device}
                traffic={traffic}
              />
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Thiết bị này chưa có dữ liệu liên quan từ nguồn quan sát.
              </p>
            )}
          </>
        )}
        {canAdmin && (
          <details className="border-t border-slate-200 pt-3">
            <summary className="cursor-pointer text-xs text-slate-500">
              Dữ liệu gốc · quản trị viên
            </summary>
            <pre className="mt-3 max-h-60 overflow-auto rounded bg-slate-50 p-3 text-[10px] text-slate-500">
              {JSON.stringify(device || edge, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </aside>
  );
}
