import { describe, expect, it } from "vitest";
import { eventDataState } from "@/components/monitor/presentation-state";

describe("incident response presentation", () => {
  it("keeps an unloaded or first failed response unknown rather than healthy zero", () => {
    expect(eventDataState(null)).toEqual({ available: false, label: "Đang tải dữ liệu sự cố" });
    expect(eventDataState({ success: false, quality: "stale", error: "Nguồn gián đoạn" })).toEqual({ available: false, label: "Nguồn gián đoạn" });
  });
  it("allows a zero count only after a successful structured response", () => {
    expect(eventDataState({ success: true, data: { history: [], problems: [] } }).available).toBe(true);
    expect(eventDataState({ success: true, data: null }).available).toBe(false);
  });
  it("does not describe a failed refresh with old cached events as current health", () => {
    expect(eventDataState({ success: false, data: { history: [], problems: [] }, error: "Refresh failed" }).available).toBe(false);
  });
});
