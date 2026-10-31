import type { Topology } from './topology';
export type GatewayAddress = { ip: string; connectionId: string; observedAt: string; model?: string };
/** Match actual interface identity, never infer a gateway from a subnet or a name. */
export function gatewayAddresses(topology: Topology): Map<string, GatewayAddress> {
  const candidates = new Map<string, GatewayAddress[]>();
  for (const node of topology.nodes) {
    if (node.status !== 'online' || !node.meta?.managed) continue;
    for (const port of node.meta.portTable || []) {
      const mac = String(port.mac || '').toLowerCase();
      if (!/^([a-f\d]{2}:){5}[a-f\d]{2}$/.test(mac) || !port.ip) continue;
      const rows = candidates.get(mac) || [];
      rows.push({ip:port.ip,connectionId:node.meta.connectionId,observedAt:topology.observedAt,model:node.meta.model});
      candidates.set(mac,rows);
    }
  }
  return new Map(Array.from(candidates).flatMap(([mac, rows]) => new Set(rows.map(row => row.ip)).size === 1 ? [[mac,rows[0]] as const] : []));
}
let cached: { until: number; pending: Promise<Map<string, GatewayAddress>> } | undefined;
/** Address metadata changes slowly; do not collect the MikroTik fleet on every UniFi traffic poll. */
export function observedGatewayAddresses(req: Request): Promise<Map<string, GatewayAddress>> {
  if (cached && cached.until > Date.now()) return cached.pending;
  const pending = import('./mikrotik-fleet').then(({getMikrotikFleetTopology}) => getMikrotikFleetTopology(req)).then(gatewayAddresses).catch(() => new Map<string, GatewayAddress>());
  cached = {until:Date.now()+60000,pending};
  return pending;
}
