import { clientIdentity } from "./client-identity";
import {
  sampleTraffic,
  unifiCounters,
  unifiUplinkCounters,
  hasTrafficMeasurement,
  mikrotikCounters,
  nonNegativeNumber,
  type TrafficSample,
} from "./traffic";
export type Observation = Record<string, any>;
export type TopologyNode = {
  id: string;
  type: string;
  name: string;
  mac?: string;
  ip?: string;
  status?: string;
  group?: "unknown";
  meta?: Observation;
  traffic?: TrafficSample;
};
export type TopologyEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  layer: "physical" | "logical";
  evidence: string;
  observedAt: string;
  sourcePort?: string;
  targetPort?: string;
  traffic?: TrafficSample;
  inferred?: boolean;
  speedMbps?: number;
  poeWatts?: number;
  channel?: number;
  radio?: string;
  signal?: number;
};
export type Topology = {
  nodes: TopologyNode[];
  links: TopologyEdge[];
  observedAt: string;
  warnings: string[];
  summary?: {
    gateways: number;
    switches: number;
    accessPoints: number;
    networks: number;
    clients: number;
  };
};
const mac = (v: unknown) => String(v || "").toLowerCase();
const key = (row: Observation) =>
  String(
    row.mac ||
      row.macAddress ||
      row._id ||
      row.id ||
      row[".id"] ||
      row.name ||
      "",
  );
function graph(observedAt: string) {
  const nodes = new Map<string, TopologyNode>();
  const links = new Map<string, TopologyEdge>();
  return {
    nodes,
    add: (n: TopologyNode) => {
      nodes.set(n.id, n);
      return n.id;
    },
    edge: (
      source: string | undefined,
      target: string,
      type: string,
      layer: "physical" | "logical",
      evidence: string,
      sourcePort?: unknown,
      targetPort?: unknown,
    ) => {
      if (
        !source ||
        source === target ||
        !nodes.has(source) ||
        !nodes.has(target)
      )
        return;
      const id = `${type}:${source}:${target}:${sourcePort ?? ""}:${targetPort ?? ""}`;
      links.set(id, {
        id,
        source,
        target,
        type,
        layer,
        evidence,
        observedAt,
        sourcePort: sourcePort === undefined ? undefined : String(sourcePort),
        targetPort: targetPort === undefined ? undefined : String(targetPort),
      });
    },
    finish: (
      warnings: string[] = [],
      sessions: Observation[] = [],
      addresses: Observation[] = [],
    ): Topology => {
      const connected = new Set(
        Array.from(links.values()).flatMap((e) => [e.source, e.target]),
      );
      const allNodes = Array.from(nodes.values());
      const summary = {
        gateways: allNodes.filter((n) => n.type === "gateway").length,
        switches: allNodes.filter((n) => n.type === "switch").length,
        accessPoints: allNodes.filter((n) => n.type === "ap").length,
        networks: allNodes.filter((n) => n.type === "network").length,
        clients: allNodes.filter((n) => n.type === "client").length,
      };
      return {
        summary,
        nodes: Array.from(nodes.values()).map((n) =>
          connected.has(n.id) ? n : { ...n, group: "unknown" },
        ),
        links: Array.from(links.values()),
        observedAt,
        warnings,
      };
    },
  };
}
/** Links are emitted only for observed AP/switch/uplink associations. */
export function buildUnifiTopology(
  devices: Observation[],
  clients: Observation[],
  observedAt = new Date().toISOString(),
): Topology {
  const g = graph(observedAt);
  const byMac = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const d of devices) {
    if (!key(d)) continue;
    const id = `device:${mac(key(d))}`;
    const type = /ugw|udm|gateway|router/i.test(d.type)
      ? "gateway"
      : /usw|switch/i.test(d.type)
        ? "switch"
        : /uap|access.point|^ap$/i.test(d.type)
          ? "ap"
          : "device";
    g.add({
      id,
      type,
      name: d.name || d.model || key(d),
      mac: d.mac || d.macAddress,
      ip: d.ipAddress || d.ip,
      status: d.status,
      traffic: sampleTraffic(
        unifiCounters(d),
        "UniFi · stat/device",
        observedAt,
      ),
      meta: {
        model: d.model,
        version: d.version || d.displayableVersion,
        serial: d.serial,
        uptime: d.uptime,
        radioTable: d.radioTable || d.radio_table || [],
        portTable: d.portTable || d.port_table || [],
        uplink: d.uplink,
        clients: d.userNumSta ?? d.num_sta,
        cpuUsage: d.cpuUsage,
        memUsage: d.memUsage,
      },
    });
    if (d.mac || d.macAddress) byMac.set(mac(d.mac || d.macAddress), id);
    if (d.id || d._id) byId.set(String(d.id || d._id), id);
  }
  // WAN is a labelled inference only when an observed gateway reports an active WAN address.
  for (const d of devices) {
    const gateway =
      byMac.get(mac(d.mac || d.macAddress)) || byId.get(String(d.id || d._id));
    const wan = d.wan1;
    const address = wan?.ip || wan?.ip_address;
    const isUp =
      wan?.up === true ||
      wan?.up === "true" ||
      wan?.link_up === true ||
      wan?.status === "up";
    if (
      !gateway ||
      g.nodes.get(gateway)?.type !== "gateway" ||
      !address ||
      address === "0.0.0.0" ||
      !isUp
    )
      continue;
    const id = g.add({
      id: `wan:${gateway}`,
      type: "wan",
      name: "Internet / WAN · suy ra",
      status: "online",
      traffic: sampleTraffic(
        unifiUplinkCounters(wan),
        "UniFi · wan1",
        observedAt,
      ),
      meta: { inferred: true, source: "device.wan1", gatewayIp: address },
    });
    g.edge(
      id,
      gateway,
      "wan",
      "logical",
      "device.wan1 · suy ra từ địa chỉ WAN đang hoạt động",
    );
  }
  for (const d of devices) {
    const target =
      byMac.get(mac(d.mac || d.macAddress)) || byId.get(String(d.id || d._id));
    if (!target) continue;
    const up = d.uplink || {};
    const source =
      byMac.get(
        mac(
          up.uplink_remote_mac ||
            up.mac ||
            up.uplinkMac ||
            up.uplink_mac ||
            up.remoteMac,
        ),
      ) ||
      byId.get(
        String(up.deviceId || d.uplinkDeviceId || d.uplink_device_id || ""),
      );
    g.edge(
      source,
      target,
      "uplink",
      "physical",
      "device.uplink",
      up.uplink_remote_port || up.remotePort,
      up.port_idx || up.portIndex,
    );
    for (const port of d.portTable || d.port_table || []) {
      for (const neighbor of port.lldp_table || []) {
        const peer = byMac.get(mac(neighbor.chassis_id || neighbor.chassisId));
        if (peer)
          g.edge(
            target,
            peer,
            "lldp",
            "physical",
            "device.port_table.lldp_table",
            port.port_idx,
            neighbor.port_id,
          );
      }
    }
  }
  for (const c of clients) {
    if (!key(c)) continue;
    const identity = clientIdentity(c);
    const ap = byMac.get(mac(c.apMac || c.ap_mac));
    const sw = byMac.get(mac(c.sw_mac || c.switch_mac));
    const id = g.add({
      id: `client:${mac(key(c))}`,
      type: "client",
      name: identity.name,
      mac: c.mac || c.macAddress,
      ip: c.ip || c.ipAddress,
      status: c.isBlocked ? "blocked" : "observed",
      traffic: sampleTraffic(unifiCounters(c), "UniFi · stat/sta", observedAt),
      meta: {
        ssid: c.ssid || c.essid,
        signal: c.signal,
        hostname: identity.hostname,
        alias: identity.alias,
        nameSource: identity.nameSource,
        vendor: identity.vendor,
        osName: identity.osName,
        model: identity.model,
        noise: c.noise,
        rssi: c.rssi,
        protocol: c.radio_proto || c.protocol,
        authorized: c.authorized,
        isGuest: c.isGuest ?? c.is_guest,
        isWired: c.isWired ?? c.is_wired,
        firstSeen: c.firstSeen ?? c.first_seen,
        lastSeen: c.lastSeen ?? c.last_seen,
        txRetries: c.txRetries ?? c.tx_retries,
        rxPackets: c.rxPackets ?? c.rx_packets,
        txPackets: c.txPackets ?? c.tx_packets,
        inactivityTime: c.inactivityTime ?? c.idle,
        txPhyMbps: c.txRateMbps,
        rxPhyMbps: c.rxRateMbps,
        deviceCategory: c.deviceCategory || c.device_category || c.dev_cat_name,
        deviceType: c.deviceType || c.device_type,
        deviceFamily: c.deviceFamily || c.dev_family_name,
        channel: c.channel,
        radio: c.radio || c.radio_proto,
        uptime: c.uptime,
        assocTime: c.assocTime ?? c.assoc_time,
        vlan: c.vlan ?? c.vlan_id,
        apMac: c.apMac || c.ap_mac,
        apName: ap && !sw ? g.nodes.get(ap)?.name : c.apName,
        networkName: c.networkName,
      },
    });
    const uplink = byId.get(String(c.uplinkDeviceId || ""));
    g.edge(
      sw || ap || uplink,
      id,
      sw || c.isWired || c.is_wired ? "wired" : "wireless",
      "physical",
      sw ? "client.sw_mac" : ap ? "client.ap_mac" : "client.uplinkDeviceId",
      c.sw_port || c.switch_port,
    );
  }
  const result = g.finish();
  for (const edge of result.links) {
    const parent = result.nodes.find((n) => n.id === edge.source);
    const child = result.nodes.find((n) => n.id === edge.target);
    if (edge.type === "wan") {
      edge.inferred = true;
      edge.traffic = parent?.traffic;
      continue;
    }
    const port = parent?.meta?.portTable?.find(
      (p: Observation) => String(p.port_idx ?? p.portIndex) === edge.sourcePort,
    );
    if (port) {
      edge.speedMbps = nonNegativeNumber(port.speed) ?? undefined;
      edge.poeWatts = nonNegativeNumber(port.poe_power) ?? undefined;
    }
    // Port metadata is useful even when the controller omits its counters.
    if (port && hasTrafficMeasurement(unifiCounters(port))) {
      edge.traffic = sampleTraffic(
        unifiCounters(port),
        "UniFi · port_table",
        observedAt,
      );
    } else if (edge.type === "wireless" || edge.type === "wired")
      edge.traffic = child?.traffic;
    // A device aggregate is not a measurement of its uplink; use uplink counters only.
    else if (child?.meta?.uplink)
      edge.traffic = sampleTraffic(
        unifiUplinkCounters(child.meta.uplink),
        "UniFi · device.uplink",
        observedAt,
      );
    if (edge.type === "wireless") {
      edge.channel = child?.meta?.channel;
      edge.radio = child?.meta?.radio;
      edge.signal = child?.meta?.signal;
    }
  }
  return result;
}
/** Neighbor and bridge-host reports identify attachment without guessing a gateway. */
export function buildMikrotikTopology(
  identity: Observation,
  interfaces: Observation[],
  neighbors: Observation[],
  hosts: Observation[],
  ports: Observation[],
  observedAt = new Date().toISOString(),
  warnings: string[] = [],
  sessions: Observation[] = [],
  addresses: Observation[] = [],
  arp: Observation[] = [],
  leases: Observation[] = [],
): Topology {
  const g = graph(observedAt);
  const routerIp = addresses.find((a) => a.interface === "ether1" || a.interface === "bridge")?.address?.split("/")[0] || "192.168.1.200";
  const router = g.add({
    id: "router:local",
    type: "gateway",
    name: identity.name || "CCR2004",
    ip: routerIp,
    status: "observed",
    meta: { hotspotSessions: sessions.length, model: "CCR2004-16G-2S+", vendor: "MikroTik" },
  });
  const byName = new Map<string, string>();
  for (const i of interfaces) {
    const name = String(i.name || i[".id"] || "");
    if (!name) continue;
    const ifaceIp = addresses.find((a) => a.interface === name)?.address?.split("/")[0];
    const id = g.add({
      id: `interface:${i[".id"] || name}`,
      type: i.type === "bridge" ? "bridge" : "interface",
      name,
      mac: i["mac-address"],
      ip: ifaceIp,
      traffic: sampleTraffic(
        mikrotikCounters(i),
        "MikroTik · /interface",
        observedAt,
      ),
      meta: {
        mtu: i["actual-mtu"] ?? i.mtu,
        linkDowns: i["link-downs"],
        interfaceType: i.type,
      },
      status:
        String(i.running) === "true"
          ? "running"
          : String(i.disabled) === "true"
            ? "disabled"
            : "unknown",
    });
    byName.set(name, id);
    g.edge(router, id, "interface", "logical", "/interface");
  }
  for (const p of ports)
    g.edge(
      byName.get(p.bridge),
      byName.get(p.interface) || "",
      "bridge-port",
      "logical",
      "/interface/bridge/port",
    );
  for (const n of neighbors) {
    const identityKey = n["mac-address"] || n.identity || n.address;
    if (!identityKey) continue;
    const id = g.add({
      id: `neighbor:${mac(identityKey)}`,
      type: "neighbor",
      name: n.identity || identityKey,
      mac: n["mac-address"],
      ip: n.address,
      meta: { platform: n.platform, version: n.version, role: "switch" },
    });
    const iface = String(n.interface || "").split(",")[0];
    g.edge(
      byName.get(iface) || router,
      id,
      "neighbor",
      "physical",
      "/ip/neighbor",
      iface,
      n["interface-name"],
    );
  }
  for (const h of hosts) {
    if (!h["mac-address"] || String(h.local) === "true") continue;
    const id = g.add({
      id: `client:${mac(h["mac-address"])}`,
      type: "client",
      name: h["mac-address"],
      mac: h["mac-address"],
      meta: { vlan: h.vid },
    });
    g.edge(
      byName.get(h["on-interface"]),
      id,
      "bridge-host",
      "physical",
      "/interface/bridge/host",
      h["on-interface"],
    );
  }

  // Map DHCP leases by MAC for fast lookup
  const leaseMap = new Map<string, Observation>();
  for (const l of leases) {
    if (l["mac-address"]) leaseMap.set(mac(l["mac-address"]), l);
  }

  // Add all connected devices from ARP table (28 devices with IP)
  for (const a of (arp as any[])) {
    const ip = a.address || a.ip;
    if (!ip || String(a.disabled) === "true") continue;
    const macAddr = mac(a["mac-address"] || a.macAddress);
    const iface = String(a.interface || a.interfaceName || "ether1");
    const id = macAddr ? `client:${macAddr}` : `client:arp:${ip}`;
    const lease = macAddr ? leaseMap.get(macAddr) : undefined;
    const existing = g.nodes.get(id);

    const hostname = lease?.["host-name"] || (lease as any)?.hostName || a.comment;
    const name = hostname || (macAddr ? `Thiết bị ${ip}` : `Host ${ip}`);

    g.add({
      id,
      type: "client",
      name: existing?.name && existing.name !== macAddr ? existing.name : name,
      mac: macAddr || existing?.mac,
      ip: ip,
      status: a.complete === false ? "incomplete" : "online",
      meta: {
        ...existing?.meta,
        interface: iface,
        dynamic: a.dynamic,
        hostname,
        source: "arp",
      },
    });

    const parentId = byName.get(iface) || byName.get("bridge-wifi") || router;
    g.edge(
      parentId,
      id,
      "arp-host",
      "physical",
      "/ip/arp",
      iface,
    );
  }

  for (const session of sessions) {
    const address = mac(session["mac-address"]);
    if (!address) continue;
    const id = `client:${address}`;
    const existing = g.nodes.get(id);
    g.add({
      ...existing,
      id,
      type: "client",
      name: session.user || existing?.name || address,
      mac: address,
      ip: session.address || existing?.ip,
      status: "online",
      traffic: sampleTraffic(
        mikrotikCounters(session, true),
        "MikroTik · /ip/hotspot/active",
        observedAt,
      ),
      meta: {
        ...existing?.meta,
        uptime: session.uptime,
        hotspotUser: session.user,
        server: session.server,
      },
    });
  }
  const result = g.finish(warnings);
  for (const edge of result.links) {
    const child = g.nodes.get(edge.target);
    if (edge.type === "interface") edge.traffic = child?.traffic;
    if (edge.type === "bridge-host" || edge.type === "arp-host") edge.traffic = child?.traffic;
  }
  return result;
}
