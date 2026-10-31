"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Settings2,
  ShieldCheck,
  Network,
  Terminal,
  LayoutDashboard,
  RefreshCw,
  Plus,
  Server,
} from "lucide-react";
import type { Provider } from "@/lib/network/resources";
import { networkFetch } from "./client";
import { useAuth } from "@/components/auth/AuthProvider";
type Connection = {
  id: string;
  name: string;
  isDefault: boolean;
  config: Record<string, unknown>;
};
export default function NetworkShell({
  provider,
  children,
}: {
  provider: Provider;
  children: React.ReactNode;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const { canAdmin, token } = useAuth();
  const [loading, setLoading] = useState(true),
    [connectionError, setConnectionError] = useState(""),
    [retry, setRetry] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]),
    [sites, setSites] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState("");
  const connectionId = params.get("connectionId") || "",
    siteId = params.get("siteId") || "";
  const topology = provider === "mikrotik" && pathname.endsWith("/topology"),
    inventory = provider === "mikrotik" && pathname.endsWith("/inventory");
  const fleet = topology && (params.get("scope") === "fleet" || !connectionId);
  useEffect(() => {
    const changed = () => setRetry((value) => value + 1);
    window.addEventListener("network-connections-changed", changed);
    return () =>
      window.removeEventListener("network-connections-changed", changed);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    networkFetch(`/api/network/connections?provider=${provider.toUpperCase()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.success)
          throw Error(j.error || "Không thể tải kết nối");
        if (!active) return;
        setConnections(j.data);
        setConnectionError("");
        const fallback = j.data.find((c: Connection) => c.isDefault);
        if (!connectionId && fallback && !topology && !inventory) {
          const q = new URLSearchParams(params.toString());
          q.set("connectionId", fallback.id);
          router.replace(`${pathname}?${q}`, { scroll: false });
        }
      })
      .catch((e) => active && setConnectionError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [provider, connectionId, token, retry, topology, inventory]);
  useEffect(() => {
    if (
      provider !== "unifi" ||
      !connectionId ||
      !connections.some((c) => c.id === connectionId)
    )
      return;
    let active = true;
    setSites([]);
    networkFetch(
      `/api/unifi/info?type=sites&connectionId=${encodeURIComponent(connectionId)}`,
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.success)
          throw Error(j.error || "Không thể tìm danh sách site");
        if (!active) return;
        const list = j.data.map((s: any) => ({
          id: s.name || s.id || s._id,
          name: s.desc || s.name || s.id,
        }));
        setSites(list);
        setError("");
        if (!siteId) {
          const configured = String(
            connections.find((c) => c.id === connectionId)?.config.site ||
              "default",
          );
          if (list.some((s: any) => s.id === configured)) {
            const q = new URLSearchParams(params.toString());
            q.set("siteId", configured);
            router.replace(`${pathname}?${q}`, { scroll: false });
          }
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [provider, connectionId, connections]);
  const choose = (key: string, value: string) => {
    const q = new URLSearchParams(params.toString());
    if (value === "fleet") {
      q.delete("connectionId");
      q.delete("siteId");
      q.set("scope", "fleet");
    } else {
      q.set(key, value);
      q.delete("scope");
      if (key === "connectionId") q.delete("siteId");
    }
    router.push(`${pathname}?${q}`, { scroll: false });
    setError("");
  };
  const links = [
    ["", "Tổng quan", LayoutDashboard],
    ["/manage", "Quản lý", Settings2],
    ["/topology", "Sơ đồ mạng", Network],
    ...(provider === "mikrotik"
      ? [["/inventory", "Thiết bị MikroTik", Server]]
      : [["/devices", "Thiết bị", Server]]),
    ...(provider === "unifi" ? [["/exempt-devices", "Miễn xác thực", ShieldCheck]] : []),
    ...(canAdmin ? [["/raw", "API nâng cao", Terminal]] : []),
  ] as const;
  const linkHref = (suffix: string) => {
    const q = new URLSearchParams(params.toString());
    q.delete("add");
    if (provider === "mikrotik" && suffix === "/topology") {
      q.delete("connectionId");
      q.set("scope", "fleet");
    } else {
      q.delete("scope");
      if (!q.get("connectionId")) {
        const selected = connections.find((c) => c.isDefault) || connections[0];
        if (selected) q.set("connectionId", selected.id);
      }
    }
    return `/admin/${provider}${suffix}?${q}`;
  };
  return (
    <div className="network-shell space-y-5 text-sm text-slate-800">
      <div className="network-scopebar flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {!inventory && (
            <label className="text-xs font-medium text-slate-500">
              {provider === "unifi" ? "Controller" : "Thiết bị"}
              <select
                aria-label={provider === "unifi" ? "Controller" : "Router"}
                value={fleet ? "fleet" : connectionId}
                onChange={(e) => choose("connectionId", e.target.value)}
                className="mt-1 block min-w-48 rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              >
                {topology && (
                  <option value="fleet">
                    Toàn bộ MikroTik ({connections.length})
                  </option>
                )}
                <option value="">Chọn thiết bị</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {provider === "unifi" && (
            <label className="text-xs font-medium text-slate-500">
              Site
              <select
                aria-label="Site"
                value={siteId}
                onChange={(e) => choose("siteId", e.target.value)}
                className="mt-1 block min-w-40 rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              >
                <option value="">Chọn site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <nav aria-label="Công cụ mạng" className="flex flex-wrap gap-1">
          {links.map(([suffix, title, Icon]) => (
            <Link
              key={String(suffix)}
              href={linkHref(String(suffix))}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${pathname === `/admin/${provider}${suffix}` ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <Icon size={16} />
              {String(title)}
            </Link>
          ))}
        </nav>
      </div>
      {(connectionError || error) && (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900"
        >
          {connectionError || error}
        </p>
      )}
      {inventory ? (
        children
      ) : loading && !connections.length ? (
        <p className="flex items-center gap-2 text-slate-500">
          <RefreshCw size={18} />
          Đang tải kết nối mạng…
        </p>
      ) : !connections.length && connectionError ? (
        <div className="rounded-lg border bg-white p-5">
          <p>Không thể tải danh sách kết nối.</p>
          <button
            className="admin-button mt-3"
            onClick={() => setRetry((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : !connections.length && !fleet ? (
        <div className="rounded-lg border bg-white p-5">
          <p>Chưa có kết nối mạng được cấu hình.</p>
          {canAdmin && (
            <Link
              href={
                provider === "mikrotik"
                  ? "/admin/mikrotik/inventory?add=1"
                  : "/admin/settings/connections"
              }
              className="mt-3 inline-flex gap-2 text-blue-600"
            >
              <Plus size={16} />
              Thêm thiết bị
            </Link>
          )}
        </div>
      ) : !connectionId && !fleet ? (
        <p className="rounded-lg border bg-white p-5">
          Chọn một thiết bị đã lưu để quản lý.
        </p>
      ) : provider === "unifi" && !siteId ? (
        <p className="rounded-lg border bg-white p-5">
          Chọn site để xem dữ liệu mạng.
        </p>
      ) : (
        <div key={`${fleet ? "fleet" : connectionId}:${siteId}`}>
          {children}
        </div>
      )}
    </div>
  );
}
