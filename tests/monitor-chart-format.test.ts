import { describe, expect, it } from "vitest";
import { formatTrafficRate, trafficDirection, trafficSeries } from "../src/components/monitor/chart-format";

describe("interface traffic presentation", () => {
  it("labels RX as receive and TX as send from the interface perspective", () => {
    expect(trafficDirection("rx.bytes_sec")).toEqual({ label: "RX · Nhận", color: "#2563eb" });
    expect(trafficDirection("tx.bytes_sec")).toEqual({ label: "TX · Gửi", color: "#0d9488" });
  });
  it("uses decimal adaptive bit rate units, including zero and missing values", () => {
    expect(formatTrafficRate(0)).toBe("0 bps");
    expect(formatTrafficRate(800)).toBe("800 bps");
    expect(formatTrafficRate(1500)).toBe("1,5 Kbps");
    expect(formatTrafficRate(8e6)).toBe("8 Mbps");
    expect(formatTrafficRate(1.2e9)).toBe("1,2 Gbps");
    expect(formatTrafficRate(null)).toBe("Không có mẫu");
    expect(formatTrafficRate(NaN)).toBe("Không có mẫu");
  });
  it("converts telemetry bytes to bits once and preserves null gaps", () => {
    const input = { data: { metric: "rx.bytes_sec", source: "telemetry", units: "bit/s", points: [{ at: 1, value: 125000 }, { at: 2, value: null }], thresholds: [{ value: 100 }] } };
    const result = trafficSeries(input);
    expect(result.data.points).toEqual([{ at: 1, value: 1e6 }, { at: 2, value: null }]);
    expect(result.data.thresholds[0].value).toBe(800);
    expect(trafficSeries(result).data.points).toEqual(result.data.points);
    expect(input.data.points[0].value).toBe(125000);
  });
  it("respects explicit Zabbix bits/sec and converts Bps", () => {
    for (const [units, expected] of [["bps", 125], ["bit/s", 125], ["Bps", 1000], ["B/s", 1000]] as const) {
      expect(trafficSeries({ data: { metric: "tx.bytes_sec", source: "zabbix", units, points: [{ at: 1, value: 125 }] } }).data.points[0].value).toBe(expected);
    }
  });
});
