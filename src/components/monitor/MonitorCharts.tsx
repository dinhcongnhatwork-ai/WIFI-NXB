"use client";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, BarChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  VisualMapComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback, useEffect, useRef } from "react";
echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  VisualMapComponent,
  ToolboxComponent,
  CanvasRenderer,
]);
function formatRate(value: number) {
  const units = ["bit/s", "Kbit/s", "Mbit/s", "Gbit/s"];
  let i = 0;
  while (Math.abs(value) >= 1000 && i < 3) {
    value /= 1000;
    i++;
  }
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${units[i]}`;
}
const colors = ["#2563eb", "#64748b", "#93c5fd"];
export function ChartPanel({
  title,
  children,
  source,
}: {
  title: string;
  children: React.ReactNode;
  source?: string;
}) {
  const order = title.startsWith("Lưu lượng")
    ? 1
    : title === "Sự cố theo thời gian"
      ? 2
      : title.startsWith("Số khách")
        ? 3
        : title === "Phản hồi dịch vụ"
          ? 4
          : title === "CPU (%)"
            ? 5
            : title === "RAM (%)"
              ? 6
              : 7;
  return (
    <section
      style={{ order }}
      className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {source || "Zabbix · khoảng trống biểu thị mẫu bị thiếu"}
      </p>
    </section>
  );
}
export function TimeChart({
  title,
  series,
  unit = "",
  area = false,
}: {
  title: string;
  series: any[];
  unit?: string;
  area?: boolean;
}) {
  const chartRef = useRef<ReturnType<
    ReactEChartsCore["getEchartsInstance"]
  > | null>(null);
  // History arrives after the empty state mounts; connect when the actual chart is ready.
  const connectChart = useCallback(
    (chart: ReturnType<ReactEChartsCore["getEchartsInstance"]>) => {
      chartRef.current = chart;
      chart.group = "monitor-time";
      echarts.connect("monitor-time");
    },
    [],
  );
  useEffect(
    () => () => {
      const chart = chartRef.current;
      if (chart && !chart.isDisposed()) chart.group = "";
    },
    [],
  );
  const rows = series
    .filter((s) => s?.data?.points?.some((p: any) => p.value !== null))
    .slice(0, 3);
  const stale = series.some(
    (s) =>
      s?.quality === "stale" ||
      s?.success === false ||
      s?.data?.quality === "stale",
  );
  const option = {
    animation: false,
    color: colors,
    textStyle: { fontFamily: "Inter, sans-serif" },
    grid: { left: 48, right: 18, top: 40, bottom: 55 },
    tooltip: {
      renderMode: "richText",
      trigger: "axis",
      formatter: (params: any[]) => {
        if (!params?.length) return "";
        return [
          new Date(Number(params[0].axisValue)).toLocaleString("vi-VN", {
            timeZone: "Asia/Bangkok",
          }),
          ...params.map((p) => {
            const value = Array.isArray(p.value) ? p.value[1] : p.value;
            return `${p.seriesName}: ${value == null ? "Không có mẫu" : unit === "bit/s" ? formatRate(Number(value)) : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`}`;
          }),
        ].join("\n");
      },
      axisPointer: { type: "cross" },
      valueFormatter: (value: any) =>
        value == null
          ? "Không có mẫu"
          : unit === "bit/s"
            ? formatRate(Number(value))
            : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`,
    },
    legend: {
      type: "scroll",
      top: 5,
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    toolbox: { feature: { dataZoom: { yAxisIndex: "none" } }, right: 0 },
    xAxis: {
      type: "time",
      axisLabel: {
        color: "#64748b",
        formatter: (value: number) =>
          new Date(value).toLocaleString("vi-VN", {
            timeZone: "Asia/Bangkok",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
      },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
    },
    yAxis: {
      type: "value",
      name: unit,
      axisLabel: {
        color: "#64748b",
        ...(unit === "bit/s" ? { formatter: formatRate } : {}),
      },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
    },
    dataZoom: [
      { type: "inside", filterMode: "none" },
      { type: "slider", height: 16, bottom: 5, borderColor: "#e2e8f0" },
    ],
    series: rows.map((s, i) => ({
      name: s.label || s.data.metric,
      type: "line",
      showSymbol: false,
      connectNulls: false,
      sampling: "lttb",
      areaStyle: area ? { opacity: 0.07 } : undefined,
      data: s.data.points.map((p: any) => [p.at, p.value]),
      markArea: {
        silent: true,
        data: (s.data.thresholds || [])
          .slice()
          .sort((a: any, b: any) => a.value - b.value)
          .map((t: any, i: number, thresholds: any[]) => [
            {
              yAxis: t.value,
              itemStyle: {
                color:
                  Number(t.severity) >= 4
                    ? "rgba(220,38,38,0.045)"
                    : "rgba(217,119,6,0.045)",
              },
            },
            {
              yAxis:
                thresholds[i + 1]?.value ??
                Math.max(
                  100,
                  ...s.data.points.flatMap((p: any) =>
                    p.value === null ? [] : [p.value],
                  ),
                ),
            },
          ]),
      },
      markLine: {
        silent: true,
        symbol: "none",
        data: (s.data.thresholds || []).map((t: any) => ({
          yAxis: t.value,
          name: t.name,
          lineStyle: {
            color: Number(t.severity) >= 4 ? "#dc2626" : "#d97706",
            type: "dashed",
          },
          label: { formatter: `${t.value}${unit}` },
        })),
      },
      ...(s.data.p95 != null && unit === "ms"
        ? {
            name: `${s.label} · ${s.data.aggregation === "trung bình theo giờ" ? "p95 trung bình giờ" : "p95"} ${s.data.p95.toFixed(1)} ms`,
          }
        : {}),
      itemStyle: { color: colors[i] },
    })),
  };
  return (
    <ChartPanel
      title={title}
      source={
        rows.length
          ? `Zabbix · ${rows[0].data.aggregation || "mẫu gốc"} · ${rows[0].data.lastAt ? new Date(rows[0].data.lastAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" }) : "chưa có thời điểm"}`
          : undefined
      }
    >
      <div role="img" aria-label={`Biểu đồ lịch sử ${title}`}>
        {rows.length ? (
          <ReactEChartsCore
            onChartReady={connectChart}
            echarts={echarts}
            option={option}
            notMerge
            style={{ height: 260 }}
          />
        ) : (
          <div className="flex h-[260px] items-center justify-center text-center text-sm text-slate-500">
            {series.find((s) => s?.error)?.error ||
              "Nguồn chưa cung cấp chỉ số trong khoảng này"}
          </div>
        )}
      </div>
      {stale && (
        <p className="text-xs text-amber-800">
          Nguồn tạm ngừng. Đang hiển thị lịch sử đã lưu; mẫu có thể đã cũ.
        </p>
      )}
    </ChartPanel>
  );
}
export function IncidentChart({
  data,
  onBucket,
}: {
  data: any;
  onBucket: (at: number) => void;
}) {
  const rows = data?.data?.buckets || [];
  return (
    <ChartPanel
      title="Sự cố theo thời gian"
      source={`Zabbix · event.get · ${data?.quality || "đang tải"}${data?.data?.truncated ? " · đã giới hạn 10.000 sự kiện" : ""}`}
    >
      {rows.length ? (
        <ReactEChartsCore
          echarts={echarts}
          style={{ height: 260 }}
          onEvents={{ click: (p: any) => onBucket(rows[p.dataIndex].at) }}
          option={{
            animation: false,
            color: ["#94a3b8", "#d97706", "#dc2626"],
            tooltip: { renderMode: "richText", trigger: "axis" },
            legend: { top: 10 },
            grid: { left: 35, right: 10, top: 50, bottom: 40 },
            xAxis: {
              type: "category",
              data: rows.map((r: any) =>
                new Date(r.at).toLocaleString("vi-VN", {
                  timeZone: "Asia/Bangkok",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                }),
              ),
              axisLabel: { color: "#64748b" },
            },
            yAxis: {
              type: "value",
              minInterval: 1,
              splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: ["info", "warning", "critical"].map((k, i) => ({
              name: ["Thông tin", "Cảnh báo", "Nghiêm trọng"][i],
              type: "bar",
              stack: "events",
              data: rows.map((r: any) => r[k]),
            })),
          }}
        />
      ) : (
        <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
          {data?.error || "Đang tải lịch sử sự cố"}
        </div>
      )}
    </ChartPanel>
  );
}
export function AvailabilityChart({ series }: { series: any[] }) {
  const rows = series.filter((s) => s?.data?.points?.length).slice(0, 8);
  const times = Array.from(
    new Set<number>(rows.flatMap((s) => s.data.points.map((p: any) => p.at))),
  ).sort((a, b) => a - b);
  const cells = rows.flatMap((s, y) =>
    s.data.points.map((p: any) => [
      times.indexOf(p.at),
      y,
      p.value === null ? -1 : p.value >= 0.999 ? 1 : 0,
    ]),
  );
  return (
    <ChartPanel
      title="Khả dụng theo đối tượng"
      source="Zabbix · available · xanh: khả dụng, đỏ: gián đoạn, xám: thiếu mẫu; trend là trung bình giờ"
    >
      {rows.length ? (
        <ReactEChartsCore
          echarts={echarts}
          style={{ height: Math.max(190, rows.length * 32 + 85) }}
          option={{
            animation: false,
            tooltip: {
              renderMode: "richText",
              formatter: (p: any) =>
                `${rows[p.value[1]].data.name} · ${new Date(times[p.value[0]]).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })} · ${p.value[2] === 1 ? "Khả dụng" : p.value[2] === 0 ? "Gián đoạn / khả dụng một phần" : "Thiếu mẫu"}`,
            },
            grid: { left: 150, right: 15, top: 10, bottom: 55 },
            xAxis: {
              type: "category",
              data: times.map((t) =>
                new Date(t).toLocaleTimeString("vi-VN", {
                  timeZone: "Asia/Bangkok",
                }),
              ),
              axisLabel: { color: "#64748b" },
            },
            yAxis: {
              type: "category",
              data: rows.map((s) => s.data.name),
              axisLabel: { width: 135, overflow: "truncate", color: "#64748b" },
            },
            visualMap: {
              show: false,
              type: "piecewise",
              pieces: [
                { value: -1, color: "#cbd5e1" },
                { value: 0, color: "#dc2626" },
                { value: 1, color: "#16a34a" },
              ],
            },
            dataZoom: [{ type: "slider", height: 16, bottom: 5 }],
            series: [
              {
                type: "heatmap",
                data: cells,
                itemStyle: { borderWidth: 1, borderColor: "#fff" },
              },
            ],
          }}
        />
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">
          Chưa có lịch sử khả dụng
        </p>
      )}
    </ChartPanel>
  );
}

export function HistorySparkline({ data }: { data: any }) {
  const points: { at: number; value: number | null }[] =
    data?.data?.points || [];
  const valid = points.filter((p) => p.value !== null);
  if (valid.length < 2)
    return <span className="text-[10px] text-slate-400">Chưa có lịch sử</span>;
  const first = points[0].at,
    last = points[points.length - 1].at,
    min = Math.min(...valid.map((p) => p.value!)),
    max = Math.max(...valid.map((p) => p.value!));
  const segments: string[] = [];
  let path = "";
  for (const point of points) {
    if (point.value === null) {
      if (path) segments.push(path);
      path = "";
      continue;
    }
    const x = ((point.at - first) / Math.max(1, last - first)) * 76 + 2,
      y = 22 - ((point.value - min) / Math.max(1, max - min)) * 18;
    path += `${path ? " L" : "M"}${x},${y}`;
  }
  if (path) segments.push(path);
  return (
    <svg
      role="img"
      aria-label="Xu hướng từ lịch sử Zabbix"
      width="80"
      height="26"
      viewBox="0 0 80 26"
      className="shrink-0"
    >
      <title>{`Zabbix · ${data.data.aggregation || "mẫu gốc"} · ${new Date(last).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}${data.quality === "stale" || data.data.quality === "stale" ? " · cũ" : ""}`}</title>
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#2563eb" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
