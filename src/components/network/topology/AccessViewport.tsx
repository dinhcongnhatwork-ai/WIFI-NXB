"use client";
import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

export function AccessViewport({
  structureKey,
}: {
  structureKey: string;
}) {
  const { fitView, getViewport, setViewport, getNodes, viewportInitialized } =
    useReactFlow();
  const fitted = useRef("");

  useEffect(() => {
    if (!viewportInitialized || !structureKey || fitted.current === structureKey)
      return;
    let alive = true;
    const frame = requestAnimationFrame(() => {
      void fitView({
        padding: 0.1,
        duration: 200,
        maxZoom: 1,
      }).then(async (ready) => {
        if (!alive || !ready) return;
        const viewport = getViewport();
        const nodes = getNodes();
        if (!nodes.length) return;
        const top = Math.min(...nodes.map((n) => n.position.y));
        if (top * viewport.zoom + viewport.y > 24) {
          await setViewport(
            { ...viewport, y: 24 - top * viewport.zoom },
            { duration: 100 },
          );
        }
        if (alive) fitted.current = structureKey;
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [
    structureKey,
    fitView,
    getViewport,
    setViewport,
    getNodes,
    viewportInitialized,
  ]);

  return null;
}
