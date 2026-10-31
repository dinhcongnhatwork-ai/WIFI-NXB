"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useStore, useViewport } from "@xyflow/react";
import { particleCount, particleDuration } from "./model";
import { sampleTrafficPath } from "./traffic-path-sampling";
type Point = { x: number; y: number };
type Lane = { count: number; duration: number };
type ParticleLink = {
  id: string;
  path: string;
  reverse?: boolean;
  length: number;
  points: Point[];
  downloadPoints?: Point[];
  uploadPoints?: Point[];
  download: Lane;
  upload: Lane;
};
type Registration = {
  id: string;
  path: string;
  downloadPath?: string;
  uploadPath?: string;
  downloadBps?: number | null;
  uploadBps?: number | null;
  reverse?: boolean;
};
type Registry = {
  entries: Map<string, ParticleLink>;
  subscribe: (listener: () => void) => () => void;
  snapshot: () => number;
  register: (entry: Registration) => () => void;
};
const Context = createContext<Registry | null>(null);
export function TrafficParticleProvider({ children }: { children?: ReactNode }) {
  const registry = useMemo<Registry>(() => {
    const entries = new Map<string, ParticleLink>();
    const cache = new Map<string, Point[]>();
    const listeners = new Set<() => void>();
    let version = 0;
    let pending = false;
    const publish = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        version++;
        listeners.forEach((listener) => listener());
      });
    };
    const pointsFor = (value: string) => {
      const cached = cache.get(value);
      if (cached) return cached;
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", value);
      const points = sampleTrafficPath(path);
      if (cache.size >= 512) cache.delete(cache.keys().next().value!);
      cache.set(value, points);
      return points;
    };
    return {
      entries,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      snapshot: () => version,
      register: (entry) => {
        const download = {
          count: Math.min(3, particleCount(entry.downloadBps)),
          duration: particleDuration(entry.downloadBps || 0),
        };
        const upload = {
          count: Math.min(3, particleCount(entry.uploadBps)),
          duration: particleDuration(entry.uploadBps || 0),
        };
        if (!download.count && !upload.count) return () => {};
        const points = pointsFor(entry.path);
        const length = points.reduce((sum, p, index) => index ? sum + Math.hypot(p.x - points[index-1].x, p.y - points[index-1].y) : 0, 0);
        const registered = {
          ...entry,
          points,
          length,
          download,
          upload,
          downloadPoints: entry.downloadPath
            ? pointsFor(entry.downloadPath)
            : undefined,
          uploadPoints: entry.uploadPath
            ? pointsFor(entry.uploadPath)
            : undefined,
        };
        entries.set(entry.id, registered);
        publish();
        return () => {
          if (entries.get(entry.id) === registered) {
            entries.delete(entry.id);
            publish();
          }
        };
      },
    };
  }, []);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}
export function useParticleRegistry() {
  return useContext(Context);
}
export function TrafficParticleOverlay() {
  const registry = useContext(Context)!;
  useSyncExternalStore(registry.subscribe, registry.snapshot, () => 0);
  const viewport = useViewport();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const links = registry.entries.size;
  const particles = (Array.from(registry.entries.values()) as ParticleLink[]).reduce(
    (total, entry) => total + entry.download.count + entry.upload.count,
    0,
  );
  const dimensions = useRef({ width, height, dpr: 1 });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dimensions.current = { width, height, dpr };
    element.width = Math.max(1, Math.round(width * dpr));
    element.height = Math.max(1, Math.round(height * dpr));
  }, [width, height]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    let currentEntries: ParticleLink[] = Array.from(registry.entries.values());
    let frame = 0;
    let running = false;
    let disposed = false;
    const draw = (now: number) => {
      if (disposed || document.hidden) {
        running = false;
        return;
      }
      const { width, height, dpr } = dimensions.current;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const view = viewportRef.current;
      for (const entry of currentEntries) {
        for (let direction = 0; direction < 2; direction++) {
          const receive = direction === 0;
          const forward = receive !== !!entry.reverse;
          const lane = receive ? entry.download : entry.upload;
          const points = (receive ? entry.downloadPoints : entry.uploadPoints) || entry.points;
          if (!lane.count || points.length < 2) continue;
          const phase = (now / (lane.duration * 1000)) % 1;
          // Short, solid strokes follow the cable; no circles, glow or per-link animation nodes.
          const trail = Math.min(0.18, 32 / Math.max(1, entry.length * view.zoom));
          context.strokeStyle = receive ? "#2563eb" : "#10b981";
          context.lineWidth = 2.5;
          context.lineCap = "round";
          const pointAt = (progress: number) => {
            const index = Math.max(0, Math.min(1, progress)) * (points.length - 1);
            const low = Math.floor(index), high = Math.min(points.length - 1, low + 1);
            const fraction = index - low;
            return {
              x: (points[low].x + (points[high].x - points[low].x) * fraction) * view.zoom + view.x,
              y: (points[low].y + (points[high].y - points[low].y) * fraction) * view.zoom + view.y,
            };
          };
          for (let i = 0; i < lane.count; i++) {
            const progress = (phase + i / lane.count) % 1;
            const head = pointAt(forward ? progress : 1 - progress);
            const tail = pointAt(forward ? Math.max(0, progress - trail) : Math.min(1, 1 - progress + trail));
            if (Math.max(head.x,tail.x) < -40 || Math.min(head.x,tail.x) > width+40 || Math.max(head.y,tail.y) < -40 || Math.min(head.y,tail.y) > height+40) continue;
            context.beginPath();
            context.moveTo(tail.x, tail.y);
            for (let step = 1; step <= 6; step++) {
              const at = Math.max(0, progress - trail * (1 - step / 6));
              const point = pointAt(forward ? at : 1 - at);
              context.lineTo(point.x, point.y);
            }
            context.stroke();
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    const start = () => {
      if (!running && !document.hidden && registry.entries.size) {
        running = true;
        frame = requestAnimationFrame(draw);
      }
    };
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        running = false;
      } else start();
    };
    const synchronize = () => {
      currentEntries = Array.from(registry.entries.values());
      if (currentEntries.length) start();
      else {
        cancelAnimationFrame(frame);
        running = false;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, element.width, element.height);
      }
    };
    const unsubscribe = registry.subscribe(synchronize);
    synchronize();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      unsubscribe();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [registry]);
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={
        links
          ? `Lưu lượng trực tiếp: ${links} liên kết, ${particles} vệt line`
          : "Lưu lượng trực tiếp: không có line đang chạy"
      }
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{ width, height, transform: "translateZ(0)", contain: "strict" }}
    />
  );
}
