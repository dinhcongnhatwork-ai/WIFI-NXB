"use client";
import { useEffect, useRef } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

/** Measure each new structure before fitting and enabling viewport culling. */
export function TopologyViewport({ structureKey, onFitted }: {
  structureKey: string;
  onFitted: (key: string) => void;
}) {
  // Controlled nodes do not echo dimension changes through onNodesChange.
  // Read the measured internals rather than the cached nodesInitialized flag.
  const initialized = useStore(state => state.nodeLookup.size > 0 &&
    Array.from(state.nodeLookup.values()).every(node => !!node.measured.width && !!node.measured.height));
  const { fitView, getViewport, setViewport, getNodes, viewportInitialized } = useReactFlow();
  const fitted = useRef("");
  useEffect(() => {
    if (!initialized || !viewportInitialized || !structureKey || fitted.current === structureKey) return;
    let alive = true;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.15, duration: 0, maxZoom: 1, includeHiddenNodes: true }).then(async ready => {
        if (!alive || !ready) return;
        const viewport = getViewport();
        const top = Math.min(...getNodes().map(node => node.position.y));
        if (top * viewport.zoom + viewport.y > 32) {
          await setViewport({...viewport, y: 32 - top * viewport.zoom}, {duration: 0});
        }
        if (alive) { fitted.current = structureKey; onFitted(structureKey); }
      });
    });
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [initialized, viewportInitialized, structureKey, fitView, getViewport, setViewport, getNodes, onFitted]);
  return null;
}
