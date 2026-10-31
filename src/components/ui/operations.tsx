"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from "react";

export type OperationalStatus = "online" | "offline" | "warning" | "unknown";
const statusLabel = {
  online: "Hoạt động",
  offline: "Ngoại tuyến",
  warning: "Cảnh báo",
  unknown: "Chưa rõ",
};
const statusColor = {
  online: "bg-ok",
  offline: "bg-crit",
  warning: "bg-warn",
  unknown: "bg-muted",
};

export function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface shadow-sm ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function StatusDot({
  status,
  label = true,
}: {
  status: OperationalStatus;
  label?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 text-xs text-ink-500"
      title={statusLabel[status]}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${statusColor[status]}`}
      />
      {label ? (
        statusLabel[status]
      ) : (
        <span className="sr-only">{statusLabel[status]}</span>
      )}
    </span>
  );
}

export function Badge({
  children,
  status = "unknown",
}: {
  children: ReactNode;
  status?: OperationalStatus;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-0.5 text-xs text-ink-700">
      <StatusDot status={status} label={false} />
      {children}
    </span>
  );
}

/** Source timestamps age in place even if the upstream stops answering. */
export function SourceStamp({
  source,
  sampledAt,
  staleAfter = 30,
  detail,
}: {
  source: string;
  sampledAt?: string | number | null;
  staleAfter?: number;
  detail?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const at = sampledAt == null ? NaN : new Date(sampledAt).getTime();
  const seconds =
    now != null && Number.isFinite(at)
      ? Math.max(0, Math.floor((now - at) / 1000))
      : null;
  const old = seconds != null && seconds > staleAfter;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 text-xs ${old ? "text-amber-700" : "text-ink-500"}`}
    >
      {source}
      <span aria-hidden="true">·</span>
      {Number.isFinite(at) ? (
        <time
          dateTime={new Date(at).toISOString()}
          title={new Date(at).toLocaleString("vi-VN", {
            timeZone: "Asia/Bangkok",
          })}
        >
          {new Date(at).toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Bangkok",
            hour12: false,
          })}
        </time>
      ) : (
        "Chưa có mẫu"
      )}
      {seconds != null && (
        <span>
          ·{" "}
          {seconds < 60
            ? `${seconds} giây`
            : `${Math.floor(seconds / 60)} phút`}{" "}
          trước{old ? " · dữ liệu cũ" : ""}
        </span>
      )}
      {detail && <span>· {detail}</span>}
    </span>
  );
}

export function StatTile({
  label,
  value,
  source,
  sampledAt,
  delta,
  sparkline,
}: {
  label: string;
  value: ReactNode;
  source?: string;
  sampledAt?: string | number | null;
  delta?: string;
  sparkline?: ReactNode;
}) {
  return (
    <Card className="min-w-0 p-5">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <strong className="text-[28px] font-semibold leading-tight tracking-tight text-ink-900 tabular-nums">
          {value ?? "—"}
        </strong>
        {sparkline}
      </div>
      {delta && <p className="mt-2 text-xs text-ink-500">{delta}</p>}
      {source && (
        <div className="mt-3">
          <SourceStamp source={source} sampledAt={sampledAt} />
        </div>
      )}
    </Card>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1"
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-xs font-medium ${option.value === value ? "bg-accent-soft text-accent" : "text-ink-500 hover:bg-canvas"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={props.label}
      className="flex gap-5 overflow-x-auto border-b border-line"
    >
      {props.options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-current={option.value === props.value ? "page" : undefined}
          onClick={() => props.onChange(option.value)}
          className={`whitespace-nowrap border-b-2 py-3 text-sm ${option.value === props.value ? "border-accent font-semibold text-accent" : "border-transparent text-ink-500 hover:text-ink-900"}`}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-xs leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Chưa có dữ liệu",
}: {
  columns: readonly {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
  }[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-canvas text-xs font-medium text-ink-500">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="whitespace-nowrap px-4 py-3"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-canvas">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={empty} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
