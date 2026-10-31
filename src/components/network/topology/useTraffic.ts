"use client";
import { useEffect, useState } from "react";
import type { Provider } from "@/lib/network/resources";
import { networkFetch } from "../client";
import type { TrafficSnapshot, HistoryPoint } from "./model";
export function useTraffic(provider: Provider, scope: string) {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    setSnapshot(null);
    setHistory({});
    setError("");
    const poll = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await networkFetch(
          `/api/${provider}/topology/traffic`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok || !result.success)
          throw Error(result.error || "Không thể cập nhật lưu lượng");
        if (!active) return;
        const next: TrafficSnapshot = result.data;
        if (!next?.nodes || !next?.links || !next?.sampledAt)
          throw Error("Nguồn chưa cung cấp mẫu lưu lượng hợp lệ");
        setSnapshot(next);
        setError("");
        setHistory((previous) => {
          const updated: Record<string, HistoryPoint[]> = {};
          for (const [id, t] of Object.entries(next.nodes)) {
            const at = Date.parse(t.sampledAt);
            const rows = (previous[id] || []).filter(
              (p) => p.at > at - 15 * 60 * 1000 && p.at !== at,
            );
            updated[id] = [
              ...rows,
              { at, download: t.downloadBps, upload: t.uploadBps },
            ].slice(-180);
          }
          return updated;
        });
      } catch (e) {
        if (active && !controller.signal.aborted)
          setError((e as Error).message);
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    const visible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [provider, scope]);
  return { snapshot, history, error };
}
export function useAnimationEnabled(paused: boolean) {
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setVisible(!document.hidden);
    const change = () => setReduced(media.matches);
    visibility();
    change();
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", change);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", change);
    };
  }, []);
  return visible && !reduced && !paused;
}
