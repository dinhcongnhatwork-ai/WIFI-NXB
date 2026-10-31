"use client";
import { useEffect, useRef } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { rootViewport } from "./root-viewport";
import {networkNodeSize} from "./node-dimensions";
import type {NetworkNodeData} from "./network-layout";
/** Initialize at readable scale once per connection/site, never refit a data refresh. */
export function NetworkViewport({
  scope,
  focusId,
  focusVersion,
  presentation = false,
}: {
  scope: string;
  focusId?: string;
  focusVersion: number;
  presentation?: boolean;
}) {
  const { getNodes, getViewport, setViewport, setCenter, getNode, viewportInitialized } =
    useReactFlow();
  const initialized = useStore(
    (state) =>
      state.nodeLookup.size > 0 &&
      Array.from(state.nodeLookup.values()).every(
        (node) => !!(node.measured.width || node.width || node.initialWidth) && !!(node.measured.height || node.height || node.initialHeight),
      ),
  );
  const width = useStore(state => state.width);
  const ready = useRef("");
  const presentationMode = useRef(`${presentation}:${width}`);
  const focus = useRef("");
  useEffect(() => {
    if (!viewportInitialized || !initialized || ready.current === scope) return;
    ready.current = scope;
    const allNodes = getNodes();
    const left = Math.min(...allNodes.map(n => n.position.x));
    const right = Math.max(...allNodes.map(n => n.position.x + (n.measured?.width || networkNodeSize((n.data as NetworkNodeData).device).width)));
    // Fit width at a readable scale; a tall inventory is explored by panning, never shrunk into tiny text.
    const zoom = Math.min(1, Math.max(0.65, (width - 64) / Math.max(260, right - left)));
    void setViewport(rootViewport(allNodes, {...getViewport(),zoom}, width), {duration:0});
  }, [scope, initialized, viewportInitialized, getNodes, getViewport, setViewport, width]);
  useEffect(() => {
    if (presentationMode.current === `${presentation}:${width}` || !initialized || !viewportInitialized) return;
    const frame = requestAnimationFrame(() => {
      presentationMode.current = `${presentation}:${width}`;
      void setViewport(rootViewport(getNodes(), getViewport(), width), {duration:0});
    });
    return () => cancelAnimationFrame(frame);
  }, [presentation, width, initialized, viewportInitialized, getNodes, getViewport, setViewport]);
  useEffect(() => {
    if (
      !focusId ||
      !initialized ||
      !viewportInitialized ||
      focus.current === `${scope}:${focusId}:${focusVersion}`
    )
      return;
    const node = getNode(focusId);
    if (!node) return;
    focus.current = `${scope}:${focusId}:${focusVersion}`;
    void setCenter(node.position.x + (node.measured?.width || networkNodeSize((node.data as NetworkNodeData).device).width)/2, node.position.y + (node.measured?.height || networkNodeSize((node.data as NetworkNodeData).device).height)/2, {
      zoom: 1,
      duration: 250,
    });
  }, [
    scope,
    focusId,
    focusVersion,
    initialized,
    viewportInitialized,
    getNode,
    setCenter,
  ]);
  return null;
}
