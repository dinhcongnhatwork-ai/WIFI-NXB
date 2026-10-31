"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SourceStamp } from "@/components/ui/operations";
import { networkFetch } from "../client";
import { bytes, rate, type Device, type Traffic } from "./model";
type ClientContext = {
  mac: string;
  sampledAt: string;
  attendance: {
    id: string;
    displayName: string;
    status: string;
    session: { id: string; name: string };
  }[];
  hotspot: {
    status: "available" | "not-configured" | "unavailable";
    error?: string;
    sources: {
      connectionId: string;
      name: string;
      source: string;
      sampledAt: string | null;
      quality: "fresh" | "stale" | "missing";
      sessions: {
        id?: string;
        user?: string;
        ip?: string;
        uptime?: string;
        traffic: Traffic;
      }[];
    }[];
  };
};
function Comparison({
  title,
  traffic,
  countersOnly = false,
}: {
  title: string;
  traffic?: Traffic;
  countersOnly?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <h4 className="break-words text-xs font-semibold text-slate-700">
        {title}
      </h4>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-slate-500">Đã tải xuống</dt>
          <dd className="mt-1 font-mono font-semibold text-slate-900">
            {bytes(traffic?.downloadBytes)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Đã tải lên</dt>
          <dd className="mt-1 font-mono font-semibold text-slate-900">
            {bytes(traffic?.uploadBytes)}
          </dd>
        </div>
        {!countersOnly && (
          <div className="border-t border-slate-100 pt-2 font-mono">
            <dt className="sr-only">Tốc độ hiện tại</dt>
            <dd className="text-blue-600">↓ {rate(traffic?.downloadBps)}</dd>
            <dd className="mt-1 text-slate-500">
              ↑ {rate(traffic?.uploadBps)}
            </dd>
          </div>
        )}
      </dl>
      {countersOnly && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Chỉ đối chiếu bộ đếm phiên
        </p>
      )}
      <div className="mt-3">
        {traffic ? (
          <SourceStamp
            source={traffic.source}
            sampledAt={traffic.sampledAt}
            detail={
              !countersOnly && traffic.reason === "first-sample"
                ? "Đang đo tốc độ…"
                : undefined
            }
          />
        ) : (
          <span className="text-xs text-slate-500">
            Nguồn chưa cung cấp bộ đếm
          </span>
        )}
      </div>
    </div>
  );
}
export function ClientContextPanel({
  device,
  traffic,
}: {
  device: Device;
  traffic?: Traffic;
}) {
  const params = useSearchParams();
  const scope = params.toString();
  const [context, setContext] = useState<ClientContext | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!device.mac) return;
    let active = true;
    const controller = new AbortController();
    setContext(null);
    setError("");
    setLoading(true);
    const load = async () => {
      try {
        const response = await networkFetch(
          `/api/network/client-context?mac=${encodeURIComponent(device.mac!)}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok || !body.success)
          throw Error(body.error || "Không thể đọc thông tin liên quan");
        if (active) setContext(body.data);
      } catch (e) {
        if (active && !controller.signal.aborted)
          setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    // StrictMode replays mount effects in development. Defer I/O so its cleanup
    // cancels the discarded subscription before any request reaches the server.
    const start = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(start);
      active = false;
      controller.abort();
    };
  }, [device.id, device.mac, scope, retry]);
  if (!device.mac)
    return (
      <p className="text-sm leading-6 text-slate-500">
        Nguồn chưa cung cấp MAC; chưa thể đối chiếu phiên Hotspot hoặc lượt điểm
        danh.
      </p>
    );
  if (loading)
    return (
      <p role="status" className="py-4 text-sm text-slate-500">
        Đang đối chiếu MAC với phiên Hotspot và điểm danh…
      </p>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 p-3 text-sm text-red-700"
      >
        <p>{error}</p>
        <button
          onClick={() => setRetry((value) => value + 1)}
          className="mt-2 rounded border border-slate-200 px-3 py-2 text-xs text-slate-700"
        >
          Thử lại
        </button>
      </div>
    );
  if (!context) return null;
  const statusLabel: Record<string, string> = {
    PRESENT: "Có mặt",
    ABSENT: "Vắng mặt",
    CHECKED_IN: "Đã điểm danh",
    REGISTERED: "Đã đăng ký",
    LEFT: "Đã rời",
    ONLINE: "Đang kết nối",
    OFFLINE: "Ngoại tuyến",
    present: "Có mặt",
    absent: "Vắng mặt",
  };
  return (
    <div className="space-y-5">
      <section aria-label="Điểm danh liên quan">
        <h3 className="text-sm font-semibold text-slate-900">
          Điểm danh và buổi họp
        </h3>
        <div className="mt-1">
          <SourceStamp source="CSDL điểm danh" sampledAt={context.sampledAt} />
        </div>
        {context.attendance.length ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {context.attendance.map((row) => (
              <li key={row.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800">
                    {row.displayName}
                  </span>
                  <span className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                    {statusLabel[row.status] || row.status || "Chưa rõ"}
                  </span>
                </div>
                <Link
                  href={`/admin/attendance/${encodeURIComponent(row.session.id)}`}
                  className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
                >
                  {row.session.name} →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Chưa tìm thấy lượt điểm danh gắn với MAC này.
          </p>
        )}
      </section>
      <section aria-label="Đối chiếu phiên Hotspot">
        <h3 className="text-sm font-semibold text-slate-900">
          Đối chiếu phiên Hotspot
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Hai bộ đếm có thời điểm bắt đầu riêng. Hiển thị từng nguồn để đối
          chiếu, không cộng gộp.
        </p>
        {context.hotspot.status === "not-configured" ? (
          <p className="mt-3 text-sm text-slate-500">
            Chưa có kết nối MikroTik để đối chiếu.
          </p>
        ) : context.hotspot.status === "unavailable" ? (
          <p
            role="status"
            className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          >
            {context.hotspot.error ||
              "Nguồn MikroTik chưa cung cấp phiên Hotspot."}
          </p>
        ) : context.hotspot.sources.length ? (
          context.hotspot.sources.map((source) => (
            <div key={source.connectionId} className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700">
                {source.name}
              </h4>
              <div className="mt-1">
                <SourceStamp
                  source={source.source}
                  sampledAt={source.sampledAt}
                  detail={
                    source.quality === "missing"
                      ? "Chưa có mẫu"
                      : source.quality === "stale"
                        ? "Mẫu cũ"
                        : undefined
                  }
                />
              </div>
              {source.sessions.length ? (
                source.sessions.map((session, i) => (
                  <div key={session.id || i} className="mt-3">
                    <p className="mb-2 break-words text-xs text-slate-500">
                      {session.user || "Phiên không có tên"} ·{" "}
                      {session.ip || "Chưa có IP"}
                      {session.uptime ? ` · ${session.uptime}` : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Comparison title="Nguồn topology" traffic={traffic} />
                      <Comparison
                        title="Phiên Hotspot"
                        countersOnly
                        traffic={session.traffic}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Không có phiên Hotspot đang hoạt động với MAC này tại nguồn đã
                  đọc.
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Nguồn chưa trả về phiên Hotspot đối chiếu.
          </p>
        )}
      </section>
    </div>
  );
}
