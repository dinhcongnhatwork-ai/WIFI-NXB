"use client";
import type { Provider } from "@/lib/network/resources";
import type { Topology } from "@/lib/network/topology";
import NetworkTopologyWorkspace from "./NetworkTopologyWorkspace";
import { buildNetworkLayout } from "./topology/network-layout";
/** Compatibility entry point; search focuses devices in the workspace instead of discarding parents. */
export function layoutTopology(
  topology: Topology,
  hideClients: boolean,
  _search: string,
  layer: string,
) {
  return buildNetworkLayout(topology, {
    expanded: new Set(),
    hideClients,
    layer,
  });
}
export default function TopologyView({ provider }: { provider: Provider }) {
  return <NetworkTopologyWorkspace provider={provider} />;
}
