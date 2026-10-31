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
type Point = { x: number; y: number };
type Lane = { count: number; duration: number };
type ParticleLink = {
  id: string;
  path: string;
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
      const length = path.getTotalLength();
      const points = Array.from({ length: 97 }, (_, index) => {
        const point = path.getPointAtLength((length * index) / 96);
        return { x: point.x, y: point.y };
      });
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
          count: particleCount(entry.downloadBps),
          duration: particleDuration(entry.downloadBps || 0),
        };
        const upload = {
          count: particleCount(entry.uploadBps),
          duration: particleDuration(entry.uploadBps || 0),
        };
        if (!download.count && !upload.count) return () => {};
        const registered = {
          ...entry,
          points: pointsFor(entry.path),
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
      // Render glowing cyber energy photons with dual-channel perpendicular lane offset
      for (let direction = 0; direction < 2; direction++) {
        const isDown = direction === 0;
        // isDown = Download (Inbound / Vào - Cyan), !isDown = Upload (Outbound / Ra - Emerald)
        const coreColor = "#ffffff";
        const primaryColor = isDown ? "#38bdf8" : "#34d399";
        const glowColor = isDown ? "rgba(14, 165, 233, 0.42)" : "rgba(16, 185, 129, 0.42)";
        
        for (const entry of currentEntries) {
          const lane = isDown ? entry.download : entry.upload;
          if (!lane.count) continue;
          const directional = isDown ? entry.downloadPoints : entry.uploadPoints;
          const points = directional || entry.points;
          if (!points || points.length < 2) continue;
          
          const phase = (now / (lane.duration * 1000)) % 1;
          const radius = Math.max(2.2, Math.min(5, 2.6 * view.zoom));
          const haloRadius = radius * 2.5;

          // Lane offset: +2.2px for download (lane 1), -2.2px for upload (lane 2)
          const laneOffsetDist = isDown ? 2.2 : -2.2;

          for (let i = 0; i < lane.count; i++) {
            const progress = (phase + i / lane.count) % 1;
            // Download travels 0 -> 1 (Source to Target, downwards)
            // Upload travels 1 -> 0 (Target to Source, upwards)
            const normalized = isDown ? progress : 1 - progress;
            const index = normalized * (points.length - 1);
            const low = Math.floor(index);
            const high = Math.min(points.length - 1, low + 1);
            const fraction = index - low;
            const a = points[low];
            const b = points[high];

            // Calculate tangent and normal unit vector
            const segDx = b.x - a.x;
            const segDy = b.y - a.y;
            const segLen = Math.hypot(segDx, segDy);
            let nx = 0;
            let ny = 0;
            if (segLen > 0.0001) {
              nx = -segDy / segLen;
              ny = segDx / segLen;
            } else if (low > 0) {
              const prevA = points[low - 1];
              const pDx = b.x - prevA.x;
              const pDy = b.y - prevA.y;
              const pLen = Math.hypot(pDx, pDy);
              if (pLen > 0.0001) {
                nx = -pDy / pLen;
                ny = pDx / pLen;
              }
            }

            const offX = nx * laneOffsetDist;
            const offY = ny * laneOffsetDist;
            
            const x = (a.x + segDx * fraction + offX) * view.zoom + view.x;
            const y = (a.y + segDy * fraction + offY) * view.zoom + view.y;

            if (
              x + haloRadius < 0 ||
              x - haloRadius > width ||
              y + haloRadius < 0 ||
              y - haloRadius > height
            ) {
              continue;
            }

            // Draw trailing comet tail behind the particle's direction of movement
            // For isDown (moving forward 0 -> 1), tail was at smaller normalized (normalized - delta)
            // For !isDown (moving backward 1 -> 0), tail was at larger normalized (normalized + delta)
            const tailNorm = isDown
              ? Math.max(0, normalized - 0.035)
              : Math.min(1, normalized + 0.035);
            const tailIdx = tailNorm * (points.length - 1);
            const tLow = Math.floor(tailIdx);
            const tHigh = Math.min(points.length - 1, tLow + 1);
            const tFrac = tailIdx - tLow;
            const tA = points[tLow];
            const tB = points[tHigh];
            const tDx = tB.x - tA.x;
            const tDy = tB.y - tA.y;
            const tLen = Math.hypot(tDx, tDy);
            let tNx = 0;
            let tNy = 0;
            if (tLen > 0.0001) {
              tNx = -tDy / tLen;
              tNy = tDx / tLen;
            } else {
              tNx = nx;
              tNy = ny;
            }
            const tOffX = tNx * laneOffsetDist;
            const tOffY = tNy * laneOffsetDist;

            const tailX = (tA.x + tDx * tFrac + tOffX) * view.zoom + view.x;
            const tailY = (tA.y + tDy * tFrac + tOffY) * view.zoom + view.y;

            // Comet tail stroke
            context.beginPath();
            context.moveTo(tailX, tailY);
            context.lineTo(x, y);
            context.strokeStyle = glowColor;
            context.lineWidth = radius * 1.5;
            context.lineCap = "round";
            context.stroke();

            // Outer soft radial glow
            const glowGrad = context.createRadialGradient(x, y, 0, x, y, haloRadius);
            glowGrad.addColorStop(0, primaryColor);
            glowGrad.addColorStop(0.5, glowColor);
            glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            context.fillStyle = glowGrad;
            context.beginPath();
            context.arc(x, y, haloRadius, 0, Math.PI * 2);
            context.fill();

            // Bright white-hot energy core
            context.fillStyle = coreColor;
            context.beginPath();
            context.arc(x, y, radius * 0.75, 0, Math.PI * 2);
            context.fill();
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
          ? `Lưu lượng trực tiếp: ${links} liên kết, ${particles} hạt`
          : "Lưu lượng trực tiếp: không có hạt đang chạy"
      }
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{ width, height, transform: "translateZ(0)", contain: "strict" }}
    />
  );
}
