import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const captured = vi.hoisted(() => ({ option: null as any }));
vi.mock("echarts-for-react/lib/core", () => ({ default: ({ style, option }: any) => { captured.option = option; return React.createElement("div", { "data-chart": true, style }); } }));
import { AvailabilityChart, TimeChart } from "@/components/monitor/MonitorCharts";

// Vitest's classic JSX transform runs the Next TSX source outside Next's compiler.
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
describe("monitor chart missing observations", () => {
  it("renders an all-null direct history as an empty chart, without a plotted zero series", () => {
    const html = renderToStaticMarkup(React.createElement(TimeChart, { title: "CPU", unit: "%", series: [{ success: true, data: { source: "direct", quality: "missing", points: [{ at: 1, value: null }, { at: 2, value: null }] } }] }));
    expect(html).toContain("Nguồn chưa cung cấp chỉ số trong khoảng này");
    expect(html).not.toContain("data-chart");
  });
  it("keeps both the availability plot and empty state at least 280px tall", () => {
    const empty = renderToStaticMarkup(React.createElement(AvailabilityChart, { series: [] }));
    expect(empty).toContain("min-h-[280px]");
    const chart = renderToStaticMarkup(React.createElement(AvailabilityChart, { series: [{ data: { name: "AP", points: [{ at: 1, value: 1 }] } }] }));
    expect(chart).toContain("height:280px");
  });
  it("renders compact traffic from recorded samples with gaps and readable short ticks", () => {
    const points = [{ at: 1, value: null }, { at: 2, value: 800000 }, { at: 3, value: null }];
    const html = renderToStaticMarkup(React.createElement(TimeChart, { compact: true, title: "Lưu lượng trong phiên", unit: "bit/s", series: [{ label: "RX · Nhận", data: { metric: "rx.bytes_sec", source: "telemetry", points } }] }));
    expect(html).toContain("height:320px");
    expect(captured.option.series[0].data).toEqual([[1, null], [2, 800000], [3, null]]);
    expect(captured.option.series[0].connectNulls).toBe(false);
    expect(captured.option.xAxis.axisLabel.hideOverlap).toBe(true);
    expect(captured.option.xAxis.axisLabel.formatter(1700000000000)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(captured.option.dataZoom.every((zoom: any) => zoom.type === "inside")).toBe(true);
    expect(captured.option.toolbox).toBeUndefined();
  });

  it("shows one actual compact observation with exactly a 30-second time pad, without synthesizing history", () => {
    const at = 1700000000000;
    renderToStaticMarkup(React.createElement(TimeChart, { compact: true, title: "Traffic", unit: "bit/s", series: [{ label: "RX", data: { metric: "rx.bytes_sec", points: [{ at, value: 8000 }] } }] }));
    expect(captured.option.series[0].data).toEqual([[at, 8000]]);
    expect(captured.option.series[0].showSymbol).toBe(true);
    expect(captured.option.xAxis.min).toBe(at - 30000);
    expect(captured.option.xAxis.max).toBe(at + 30000);
  });
  it("bounds multiple compact observations by their recorded timestamps", () => {
    renderToStaticMarkup(React.createElement(TimeChart, { compact: true, title: "Traffic", unit: "bit/s", series: [{ data: { metric: "rx.bytes_sec", points: [{ at: 1000, value: 1 }, { at: 2000, value: null }, { at: 3000, value: 2 }] } }] }));
    expect(captured.option.xAxis.min).toBe(1000);
    expect(captured.option.xAxis.max).toBe(3000);
    expect(captured.option.series[0].data).toEqual([[1000, 1], [2000, null], [3000, 2]]);
  });

});
