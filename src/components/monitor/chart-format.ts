/** All displayed traffic values are decimal bits per second. */
export function formatTrafficRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Không có mẫu";
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  let index = 0;
  while (Math.abs(value) >= 1000 && index < units.length - 1) {
    value /= 1000;
    index++;
  }
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${units[index]}`;
}

export function trafficDirection(metric: string) {
  return metric.startsWith("tx.")
    ? { label: "TX · Gửi", color: "#0d9488" }
    : { label: "RX · Nhận", color: "#2563eb" };
}

/** Collector metrics are bytes/sec; Zabbix can explicitly supply bits/sec. */
export function trafficSeries(series: any): any {
  if (!series?.data) return series;
  const data = series.data;
  const isBits = data.displayUnits === "bps" ||
    (data.source === "zabbix" && ["bps", "bit/s", "b/s"].includes(data.units));
  const factor = isBits ? 1 : 8;
  const convert = (value: number | null) => value == null ? null : value * factor;
  return {
    ...series,
    label: trafficDirection(data.metric || "").label,
    data: {
      ...data,
      displayUnits: "bps",
      points: (data.points || []).map((p: any) => ({ ...p, value: convert(p.value) })),
      thresholds: (data.thresholds || []).map((t: any) => ({ ...t, value: convert(t.value) })),
    },
  };
}
