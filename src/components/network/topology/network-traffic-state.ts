import { trafficDirections } from "./network-layout";
import { type Link, type Traffic, TRAFFIC_THRESHOLD_BPS } from "./model";

export function networkTrafficState(data: { link: Link; traffic?: Traffic; clock: number; animate?: boolean; offline?: boolean }) {
  const { link, traffic } = data;
  const direction = trafficDirections(traffic);
  const sampledAt = Date.parse(traffic?.sampledAt || "");
  const old = !Number.isFinite(sampledAt) || data.clock - sampledAt > 30000;
  const organization = link.type === "organization";
  return {
    direction,
    old,
    reverse: traffic?.perspective === "interface",
    measured: !organization && !data.offline && !old && (direction.receive != null || direction.send != null),
    active: !!data.animate && !organization && !data.offline && !old && (traffic?.perspective !== "interface" || (!!link.sourcePort && !!link.evidence?.includes("/ip/neighbor"))) && ((direction.receive || 0) >= TRAFFIC_THRESHOLD_BPS || (direction.send || 0) >= TRAFFIC_THRESHOLD_BPS),
  };
}
