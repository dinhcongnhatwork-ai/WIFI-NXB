/** Rates are bits per second; cumulative counters remain bytes. */
export interface TrafficSample {
  downloadBytes: number | null;
  uploadBytes: number | null;
  downloadBps: number | null;
  uploadBps: number | null;
  /** User download/upload, or raw interface TX/RX when route role is unknown. */
  perspective?: "user" | "interface";
  source: string;
  sampledAt: string;
  sessionId?: string;
  reason?:
    "first-sample" | "counter-reset" | "missing-counters" | "stale-sample";
}
export interface TrafficCounters {
  perspective?: "user" | "interface";
  downloadBytes?: unknown;
  uploadBytes?: unknown;
  downloadBytesPerSecond?: unknown;
  uploadBytesPerSecond?: unknown;
  sessionId?: string;
}
export function nonNegativeNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function sampleTraffic(
  counters: TrafficCounters,
  source: string,
  sampledAt: string,
  previous?: TrafficSample | null,
): TrafficSample {
  const downloadBytes = nonNegativeNumber(counters.downloadBytes);
  const uploadBytes = nonNegativeNumber(counters.uploadBytes);
  const elapsed = previous
    ? (Date.parse(sampledAt) - Date.parse(previous.sampledAt)) / 1000
    : 0;
  const reset =
    previous &&
    ((counters.sessionId &&
      previous.sessionId &&
      counters.sessionId !== previous.sessionId) ||
      (downloadBytes !== null &&
        previous.downloadBytes !== null &&
        downloadBytes < previous.downloadBytes) ||
      (uploadBytes !== null &&
        previous.uploadBytes !== null &&
        uploadBytes < previous.uploadBytes));
  let reason: TrafficSample["reason"];
  if (reset) reason = "counter-reset";
  else if (downloadBytes === null && uploadBytes === null)
    reason = "missing-counters";
  else if (!previous || elapsed <= 0) reason = "first-sample";
  else if (elapsed > 30) reason = "stale-sample";
  const rate = (
    now: number | null,
    before: number | null | undefined,
    direct: unknown,
  ) => {
    if (reset) return null;
    const measured = nonNegativeNumber(direct);
    if (measured !== null) return measured * 8;
    if (
      !previous ||
      elapsed <= 0 ||
      elapsed > 30 ||
      now === null ||
      before === null ||
      before === undefined
    )
      return null;
    return ((now - before) / elapsed) * 8;
  };
  const downloadBps = rate(
    downloadBytes,
    previous?.downloadBytes,
    counters.downloadBytesPerSecond,
  );
  const uploadBps = rate(
    uploadBytes,
    previous?.uploadBytes,
    counters.uploadBytesPerSecond,
  );
  return {
    downloadBytes,
    uploadBytes,
    downloadBps,
    uploadBps,
    perspective: counters.perspective ?? "user",
    source,
    sampledAt,
    ...(counters.sessionId ? { sessionId: counters.sessionId } : {}),
    ...(reason && (downloadBps === null || uploadBps === null)
      ? { reason }
      : {}),
  };
}
/** Controller station counters are AP-facing: tx is download to the station. */
export function unifiCounters(row: Record<string, any>): TrafficCounters {
  const isDeviceOffline =
    row.state === 0 ||
    row.status === "offline" ||
    row.status === "disconnected";
  return {
    downloadBytes: row.txBytes ?? row.tx_bytes ?? row.uplink?.rx_bytes,
    uploadBytes: row.rxBytes ?? row.rx_bytes ?? row.uplink?.tx_bytes,
    downloadBytesPerSecond: isDeviceOffline
      ? 0
      : (row["tx_bytes-r"] ?? row.uplink?.["rx_bytes-r"]),
    uploadBytesPerSecond: isDeviceOffline
      ? 0
      : (row["rx_bytes-r"] ?? row.uplink?.["tx_bytes-r"]),
    sessionId:
      row.assocTime || row.assoc_time
        ? String(row.assocTime ?? row.assoc_time)
        : undefined,
  };
}
export function mikrotikCounters(
  row: Record<string, any>,
  hotspot = false,
): TrafficCounters {
  return hotspot
    ? {
        downloadBytes: row["bytes-out"] ?? row.bytesOut,
        uploadBytes: row["bytes-in"] ?? row.bytesIn,
        sessionId: row[".id"],
      }
    : {
        perspective: "interface",
        downloadBytes: row["tx-byte"],
        uploadBytes: row["rx-byte"],
      };
}

/** RX on the child uplink is traffic arriving from its parent (download). */
export function unifiUplinkCounters(
  row: Record<string, any>,
  offline = false,
): TrafficCounters {
  return {
    downloadBytes: row.rxBytes ?? row.rx_bytes,
    uploadBytes: row.txBytes ?? row.tx_bytes,
    downloadBytesPerSecond: offline ? 0 : row["rx_bytes-r"],
    uploadBytesPerSecond: offline ? 0 : row["tx_bytes-r"],
  };
}
export function hasTrafficMeasurement(counters: TrafficCounters): boolean {
  return [
    counters.downloadBytes,
    counters.uploadBytes,
    counters.downloadBytesPerSecond,
    counters.uploadBytesPerSecond,
  ].some((value) => nonNegativeNumber(value) !== null);
}
