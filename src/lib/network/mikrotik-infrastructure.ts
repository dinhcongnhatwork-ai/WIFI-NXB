import type { Topology, TopologyNode } from './topology';

/** Online hardware only. Collection provider alone does not identify a discovered vendor. */
export function mikrotikInfrastructureTopology(topology: Topology): Topology {
  const hardware = new Map<string, TopologyNode>();
  const ports = new Map<string, TopologyNode>();
  for (const node of topology.nodes) {
    if (['interface', 'bridge'].includes(node.type)) ports.set(node.id, node);
    if (!['gateway', 'router', 'switch', 'ap', 'neighbor'].includes(node.type)) continue;
    if (!['online', 'connected', 'running', '1'].includes(String(node.status).toLowerCase())) continue;
    const meta = node.meta || {};
    const managed = meta.provider === 'mikrotik' && (meta.managed || node.id === 'router:local');
    const vendor = [meta.vendor, meta.platform, meta.manufacturer].some(value => /mikrotik|routeros/i.test(String(value || '')));
    if (managed || vendor) hardware.set(node.id, node);
  }
  const owners = new Map<string, string>();
  const roots = new Map<string, string>();
  for (const node of Array.from(hardware.values())) {
    if (node.meta?.connectionId && (node.meta.managed || node.id === 'router:local')) roots.set(node.meta.connectionId, node.id);
  }
  for (const port of Array.from(ports.values())) {
    const root = roots.get(port.meta?.connectionId);
    if (root) owners.set(port.id, root);
  }
  // Walk only interface membership, never client, neighbor or offline-device paths.
  const children = new Map<string, string[]>();
  for (const edge of topology.links) {
    if (!ports.has(edge.target) || !['interface', 'bridge-port'].includes(edge.type)) continue;
    const list = children.get(edge.source) || [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const queue = Array.from(hardware.keys());
  for (let i = 0; i < queue.length; i++) {
    const parent = queue[i];
    for (const child of children.get(parent) || []) {
      if (owners.has(child)) continue;
      owners.set(child, hardware.has(parent) ? parent : owners.get(parent)!);
      queue.push(child);
    }
  }
  const links = topology.links.flatMap(edge => {
    if (['interface', 'bridge-port', 'bridge-host', 'arp', 'dhcp', 'client'].includes(edge.type)) return [];
    const source = hardware.has(edge.source) ? edge.source : owners.get(edge.source);
    const target = hardware.has(edge.target) ? edge.target : undefined;
    if (!source || !target || source === target) return [];
    return [{ ...edge, source, target, ...((edge.traffic || ports.get(edge.source)?.traffic) ? { traffic: edge.traffic || ports.get(edge.source)?.traffic } : {}), ...(ports.has(edge.source) ? { sourcePort: edge.sourcePort || ports.get(edge.source)!.name } : {}) }];
  });
  const nodes = Array.from(hardware.values(), node => {
    if (!Array.isArray(node.meta?.portConnections)) return node;
    const peers = node.meta.portConnections.filter((peer: { peerId: string }) => hardware.has(peer.peerId));
    return { ...node, meta: { ...node.meta, portConnections: peers, connectedPeerCount: new Set(peers.map((peer: {peerId: string}) => peer.peerId)).size, connectedApPorts: new Set(peers.filter((peer: {peerType: string; layer?: string}) => peer.peerType === 'ap' && peer.layer === 'physical').map((peer: {localPort: string}) => peer.localPort)).size } };
  });
  return { ...topology, nodes, links, ...(topology.summary ? {summary: {gateways: nodes.filter(n => ['gateway','router'].includes(n.type)).length, switches: nodes.filter(n => n.type === 'switch').length, accessPoints: nodes.filter(n => n.type === 'ap').length, networks: 0, clients: 0}} : {}) };
}
