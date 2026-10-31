"use client";
import NetworkTopologyWorkspace from "./NetworkTopologyWorkspace";
/** Kept for callers of the previous AP-specific workspace. */
export default function AccessPointWorkspace(_props: {
  onOverview: () => void;
}) {
  return <NetworkTopologyWorkspace provider="unifi" />;
}
