import { createHash, randomUUID } from "node:crypto";

export const INTERVAL_MS = 30_000;
export const STALE_MS = 95_000;
export function finite(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
export function percentUsed(free: unknown, total: unknown) {
  const f = finite(free),
    t = finite(total);
  return f !== undefined && t !== undefined && t > 0 && f >= 0 && f <= t
    ? ((t - f) / t) * 100
    : undefined;
}
export function counterRate(
  previous: { value: number; at: number; boot?: string } | null,
  value: number,
  at: number,
  boot?: string,
) {
  if (
    !previous ||
    at <= previous.at ||
    value < previous.value ||
    previous.boot !== boot ||
    at - previous.at > STALE_MS
  )
    return null;
  return ((value - previous.value) * 1000) / (at - previous.at);
}
export function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function dataQuality(at?: Date | string | null, now = Date.now()) {
  return !at
    ? "missing"
    : now - new Date(at).getTime() > STALE_MS
      ? "stale"
      : "fresh";
}
export const RELEASE_LOCK =
  'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end';
export const EXTEND_LOCK =
  'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("pexpire",KEYS[1],ARGV[2]) else return 0 end';
export async function withLease<T>(
  client: { set: Function; eval: Function },
  key: string,
  task: (assertLease: () => void) => Promise<T>,
  ttl = 120_000,
): Promise<T | undefined> {
  const token = randomUUID();
  if ((await client.set(key, token, "PX", ttl, "NX")) !== "OK")
    return undefined;
  let valid = true;
  const heartbeat = setInterval(
    () => {
      void client
        .eval(EXTEND_LOCK, 1, key, token, ttl)
        .then((n: unknown) => {
          if (n !== 1) valid = false;
        })
        .catch(() => {
          valid = false;
        });
    },
    Math.floor(ttl / 3),
  );
  heartbeat.unref();
  try {
    return await task(() => {
      if (!valid) throw new Error("Collector lease lost");
    });
  } finally {
    clearInterval(heartbeat);
    await client.eval(RELEASE_LOCK, 1, key, token).catch(() => {});
  }
}
export async function mapLimited<T>(
  values: T[],
  limit: number,
  task: (v: T) => Promise<unknown>,
) {
  let index = 0;
  const results: PromiseSettledResult<unknown>[] = [];
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limit), values.length) },
      async () => {
        while (index < values.length) {
          const i = index++;
          try {
            results[i] = { status: "fulfilled", value: await task(values[i]) };
          } catch (reason) {
            results[i] = { status: "rejected", reason };
          }
        }
      },
    ),
  );
  return results;
}
export function timeRange(value: string | null) {
  return (
    (
      {
        "1h": 3600,
        "6h": 21600,
        "24h": 86400,
        "7d": 604800,
        "30d": 2592000,
      } as Record<string, number>
    )[value || "24h"] || 86400
  );
}

/** Custom windows require explicit instants; preset cache keys remain rolling. */
export function monitorWindow(
  query: URLSearchParams,
  now = Date.now(),
): { seconds: number; end?: number; start?: number; error?: string } {
  const from = query.get("from"),
    to = query.get("to");
  const seconds = timeRange(query.get("time"));
  if (!from && !to && query.get("time") !== "custom") return { seconds };
  const fail = {
    seconds,
    error:
      "Khoảng tùy chọn cần from/to ISO có múi giờ, từ 1 giây đến 30 ngày, không nằm trong tương lai",
  };
  if (
    !from ||
    !to ||
    ![from, to].every((v) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        v,
      ),
    )
  )
    return fail;
  for (const value of [from, to]) {
    const parts = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
    )!;
    const [, year, month, day, hour, minute, second] = parts.map(Number);
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
      hour > 23 ||
      minute > 59 ||
      (second || 0) > 59
    )
      return fail;
  }
  const start = Date.parse(from),
    end = Date.parse(to),
    duration = end - start;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    duration < 1000 ||
    duration > 2592000000 ||
    end > now
  )
    return fail;
  return { seconds: duration / 1000, start, end };
}
