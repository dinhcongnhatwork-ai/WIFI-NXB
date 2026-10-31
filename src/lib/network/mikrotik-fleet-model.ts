import type { Topology, TopologyNode, TopologyEdge } from "./topology";
export type FleetConnection = {
  id: string;
  name: string;
  baseUrl: string;
  config: Record<string, unknown>;
};
export type FleetObservation = {
  connection: FleetConnection;
  topology?: Topology;
  error?: string;
};
export type UniFiObservation = {
  connectionId: string;
  siteId: string;
  topology: Topology;
};
const normalizedMac = (value: unknown) =>
  String(value || "")
    .replace(/[^a-f0-9]/gi, "")
    .toLowerCase();
const address = (value: unknown) =>
  String(value || "")
    .split("/")[0]
    .trim()
    .toLowerCase();
const macKey = (value: unknown) =>
  normalizedMac(value).length === 12 ? normalizedMac(value) : "";
const ns = (connectionId: string, id: string) =>
  `mikrotik:${connectionId}:${id}`;
const rootId = (connectionId: string) => ns(connectionId, "router:local");
export function mergeMikrotikFleet(
  observations: FleetObservation[],
  unifi: UniFiObservation[] = [],
  observedAt = new Date().toISOString(),
): Topology {
  const nodes = new Map<string, TopologyNode>(),
    links = new Map<string, TopologyEdge>(),
    warnings: string[] = [];
  const macIndex = new Map<string, Set<string>>(),
    ipIndex = new Map<string, Set<string>>();
  const addIndex = (
    index: Map<string, Set<string>>,
    value: string,
    id: string,
  ) => {
    if (!value) return;
    const set = index.get(value) || new Set<string>();
    set.add(id);
    index.set(value, set);
  };
  const register = (
    node: TopologyNode,
    ips: unknown[] = [],
    macs: unknown[] = [],
  ) => {
    nodes.set(node.id, node);
    for (const ip of [node.ip, ...ips]) addIndex(ipIndex, address(ip), node.id);
    for (const mac of [node.mac, ...macs])
      addIndex(macIndex, macKey(mac), node.id);
  };
  // Create every configured device, including unreadable devices, before matching neighbors.
  for (const item of observations) {
    const { connection, topology } = item;
    const root = topology?.nodes.find((node) => node.id === "router:local") || {
      id: "router:local",
      type: "gateway",
      name: connection.name,
      status: "unknown",
    };
    const role = String(connection.config.deviceRole || "router");
    const physicalType =
      role === "core-switch" || role === "access-switch" ? "switch" : "gateway";
    const host = new URL(connection.baseUrl).hostname;
    const ports =
      topology?.nodes.filter((node) =>
        ["interface", "bridge"].includes(node.type),
      ) || [];
    register(
      {
        ...root,
        id: rootId(connection.id),
        name: connection.name,
        type: physicalType,
        ip: root.ip || host,
        status: topology ? root.status : "unknown",
        meta: {
          ...root.meta,
          connectionId: connection.id,
          provider: "mikrotik",
          managed: true,
          deviceRole: role,
          model: root.meta?.model || connection.config.model || undefined,
          location: connection.config.location || undefined,
          identity: root.name,
          collectionError: item.error,
          portTable: ports.map((port) => ({
            name: port.name,
            mac: port.mac,
            ip: port.ip,
            status: port.status,
            traffic: port.traffic,
            mtu: port.meta?.mtu,
            interfaceType: port.meta?.interfaceType,
          })),
          observedPortCount: item.error
            ? null
            : ports.filter((port) => port.type === "interface").length,
        },
      },
      [host, ...ports.map((node) => node.ip)],
      ports.map((port) => port.mac),
    );
    warnings.push(
      ...(topology?.warnings || []).map((w) => `${connection.name}: ${w}`),
    );
    if (item.error) warnings.push(`${connection.name}: ${item.error}`);
  }
  // AP identities from configured UniFi sites enrich RouterOS neighbor observations.
  for (const source of unifi) {
    for (const node of source.topology.nodes) {
      if (node.type !== "ap") continue;
      register({
        ...node,
        id: `unifi:${source.connectionId}:${source.siteId}:${node.id}`,
        meta: {
          ...node.meta,
          provider: "unifi",
          connectionId: source.connectionId,
          siteId: source.siteId,
        },
      });
    }
  }
  const lookup = (node: TopologyNode) => {
    const viaMac = macIndex.get(macKey(node.mac));
    const viaIp = ipIndex.get(address(node.ip));
    if (viaMac?.size === 1) return Array.from(viaMac)[0];
    if (viaMac && viaMac.size > 1) return undefined;
    if (viaIp?.size !== 1) return undefined;
    const candidate = Array.from(viaIp)[0];
    // An IP can be reused across sites or after DHCP churn. A contradictory
    // known chassis MAC must never override recorded hardware identity.
    if (
      macKey(node.mac) &&
      Array.from(macIndex.values()).some((ids) => ids.has(candidate))
    )
      return undefined;
    return candidate;
  };
  for (const { connection, topology } of observations) {
    if (!topology) continue;
    const aliases = new Map<string, string>([
      ["router:local", rootId(connection.id)],
    ]);
    for (const node of topology.nodes) {
      if (node.id === "router:local") continue;
      const match = lookup(node);
      if (node.type === "neighbor" && match) {
        aliases.set(node.id, match);
        continue;
      }
      // ARP and bridge FDB can see an upstream device through a trunk. Do not invent a direct cable.
      if (node.type === "client" && match) continue;
      const id = ns(connection.id, node.id);
      aliases.set(node.id, id);
      nodes.set(id, {
        ...node,
        id,
        meta: {
          ...node.meta,
          provider: "mikrotik",
          connectionId: connection.id,
        },
      });
    }
    for (const edge of topology.links) {
      const source = aliases.get(edge.source),
        target = aliases.get(edge.target);
      if (!source || !target || source === target) continue;
      const id = ns(connection.id, edge.id);
      links.set(id, { ...edge, id, source, target });
    }
  }
  // Reuse observed UniFi AP/client associations; never infer a switch port from an SSID or IP.
  for (const source of unifi) {
    const alias = new Map<string, string>();
    for (const node of source.topology.nodes) {
      const id = `unifi:${source.connectionId}:${source.siteId}:${node.id}`;
      alias.set(node.id, id);
      if (!nodes.has(id))
        nodes.set(id, {
          ...node,
          id,
          meta: {
            ...node.meta,
            provider: "unifi",
            connectionId: source.connectionId,
            siteId: source.siteId,
          },
        });
    }
    for (const edge of source.topology.links) {
      const id = `unifi:${source.connectionId}:${source.siteId}:${edge.id}`;
      links.set(id, {
        ...edge,
        id,
        source: alias.get(edge.source)!,
        target: alias.get(edge.target)!,
      });
    }
  }
  // Neighbor discovery is reported from both ends. Keep one observed cable,
  // preferring the upstream role for display; retain parallel cables by port pair.
  const observedLinks = Array.from(links.values());
  const reciprocal = new Map<string, TopologyEdge>();
  const roleOrder = (id: string) => {
    const role = nodes.get(id)?.meta?.deviceRole;
    return role === "router"
      ? 0
      : role === "core-switch"
        ? 1
        : role === "access-switch"
          ? 2
          : 3;
  };
  for (const edge of Array.from(links.values())) {
    if (edge.type !== "neighbor" || !edge.sourcePort || !edge.targetPort)
      continue;
    const owner = nodes.get(edge.source)?.meta?.connectionId;
    const sourceRoot = owner ? rootId(String(owner)) : edge.source;
    if (
      !nodes.get(sourceRoot)?.meta?.managed ||
      !nodes.get(edge.target)?.meta?.managed
    )
      continue;
    const key = [
      `${sourceRoot}:${edge.sourcePort}`,
      `${edge.target}:${edge.targetPort}`,
    ]
      .sort()
      .join("|");
    const existing = reciprocal.get(key);
    if (!existing) {
      reciprocal.set(key, edge);
      continue;
    }
    const existingOwner = String(
      nodes.get(existing.source)?.meta?.connectionId || "",
    );
    const existingRoot = rootId(existingOwner);
    if (
      roleOrder(sourceRoot) < roleOrder(existingRoot) ||
      (roleOrder(sourceRoot) === roleOrder(existingRoot) &&
        sourceRoot.localeCompare(existingRoot) < 0)
    ) {
      links.delete(existing.id);
      reciprocal.set(key, edge);
    } else links.delete(edge.id);
  }
  for (const item of observations) {
    const root = nodes.get(rootId(item.connection.id))!;
    const ports = new Set(
      (
        item.topology?.nodes.filter((n) =>
          ["interface", "bridge"].includes(n.type),
        ) || []
      ).map((n) => ns(item.connection.id, n.id)),
    );
    const rows: Array<Record<string, unknown>> = [];
    for (const edge of observedLinks) {
      if (edge.type !== "neighbor" || !ports.has(edge.source)) continue;
      const peer = nodes.get(edge.target);
      if (!peer) continue;
      rows.push({
        id: edge.id,
        localPort: edge.sourcePort || nodes.get(edge.source)?.name,
        remotePort: edge.targetPort || null,
        peerId: peer.id,
        peerName: peer.name,
        peerType: peer.type,
        peerIp: peer.ip || null,
        evidence: edge.evidence,
        layer: edge.layer,
        observedAt: edge.observedAt,
      });
    }
    root.meta = {
      ...root.meta,
      portConnections: rows,
      connectedApPorts: item.error
        ? null
        : new Set(
            rows
              .filter(
                (row) => row.peerType === "ap" && row.layer === "physical",
              )
              .map((row) => row.localPort),
          ).size,
      connectedPeerCount: item.error
        ? null
        : new Set(rows.map((row) => row.peerId)).size,
    };
  }
  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values()),
    warnings,
    observedAt,
  };
}
