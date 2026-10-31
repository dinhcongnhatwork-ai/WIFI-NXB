"use client";
import NetworkTopologyWorkspace from "./NetworkTopologyWorkspace";
/** Uses actual topology observations; no model, address, port or traffic defaults. */
export default function MikrotikTopologyWorkspace(_props: {
  onOverview?: () => void;
}) {
  return <NetworkTopologyWorkspace provider="mikrotik" />;
}
