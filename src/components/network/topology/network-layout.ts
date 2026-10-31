import dagre from "@dagrejs/dagre";
import { networkNodeSize, networkNodeHandles, INFRA_NODE_SIZE } from "./node-dimensions";
import { operationalGrid, type Point } from "./operational-grid";
import { Position, type Node, type Edge } from "@xyflow/react";
import type { Topology } from "@/lib/network/topology";
import {
  isOffline,
  isOnline,
  type Device,
  type Link,
  type Traffic,
} from "./model";

export type NetworkNodeData = Record<string, unknown> & {
  device: Device;
  childCount: number;
  clientCount: number;
  expanded: boolean;
  traffic?: Traffic;
  clock?: number;
  onToggle?: (id: string) => void;
};
export type NetworkLayoutOptions = {
  expanded: Set<string>;
  collapsed?: Set<string>;
  focusApId?: string;
  hideClients?: boolean;
  layer?: string;
  columns?: number;
};

/** The API's interface contract stores TX in downloadBps and RX in uploadBps. */
export function trafficDirections(sample?: Partial<Traffic>) {
  const raw = sample?.perspective === "interface";
  return {
    receive: raw ? sample?.uploadBps : sample?.downloadBps,
    send: raw ? sample?.downloadBps : sample?.uploadBps,
    receiveLabel: raw ? "RX · Nhận" : "Tải xuống",
    sendLabel: raw ? "TX · Gửi" : "Tải lên",
    receiveBytes: raw ? sample?.uploadBytes : sample?.downloadBytes,
    sendBytes: raw ? sample?.downloadBytes : sample?.uploadBytes,
  };
}

export function revealAncestors(topology: Topology, id: string): Set<string> {
  const found = new Set<string>(),
    queue = [id],
    visited = new Set([id]);
  for (let i = 0; i < queue.length; i++)
    for (const link of topology.links) {
      if (link.target !== queue[i] || visited.has(link.source)) continue;
      visited.add(link.source);
      found.add(link.source);
      queue.push(link.source);
    }
  return found;
}

export function deviceFloor(
  node?: Device,
): { value: string; inferred: boolean } | null {
  if (!node) return null;
  const explicit =
    node.meta?.floor ?? node.meta?.floorName ?? node.meta?.location?.floor;
  if (explicit != null) return { value: String(explicit), inferred: false };
  const match = node.name.match(/(?:AP|Tầng\s*)(\d+)(?:\.|\b)/i);
  return match ? { value: match[1], inferred: true } : null;
}

/** Apply the same observation filters to diagram and inventory, keeping parents as context. */
export function filterNetworkTopology(
  topology: Topology,
  filters: { status: string; floor: string },
): Topology {
  if (filters.status === "all" && filters.floor === "all") return topology;
  const byId = new Map(topology.nodes.map((node) => [node.id, node]));
  const ids = new Set<string>();
  for (const node of topology.nodes) {
    const offline = isOffline(node.status);
    const online = isOnline(node.status);
    if (
      (filters.status === "online" && !online) ||
      (filters.status === "offline" && !offline)
    )
      continue;
    const ancestors = revealAncestors(topology, node.id);
    const floor = deviceFloor(node)?.value;
    const floorMatches =
      filters.floor === "all" ||
      floor === filters.floor ||
      (node.type === "client" &&
        Array.from(ancestors).some(
          (id) => deviceFloor(byId.get(id))?.value === filters.floor,
        ));
    if (!floorMatches) continue;
    ids.add(node.id);
    for (const id of Array.from(ancestors)) ids.add(id);
  }
  return {
    ...topology,
    nodes: topology.nodes.filter((node) => ids.has(node.id)),
    links: topology.links.filter(
      (link) => ids.has(link.source) && ids.has(link.target),
    ),
  };
}

export function buildNetworkLayout(
  topology: Topology,
  options: NetworkLayoutOptions,
): {
  nodes: Node<NetworkNodeData>[];
  edges: Edge<{ link: Link; traffic?: Traffic; secondary?: boolean; routePoints?: Point[] }>[];
  members: Map<string, Device[]>;
} {
  const byId = new Map(topology.nodes.map((node) => [node.id, node as Device]));
  let original = topology.links.filter(
    (link) =>
      byId.has(link.source) &&
      byId.has(link.target) &&
      (options.layer == null ||
        options.layer === "all" ||
        link.layer === options.layer),
  );
  let devices = Array.from(byId.values());
  const members = new Map<string, Device[]>();
  const parentClients = new Map<string, Device[]>();
  for (const node of devices.filter((node) => node.type === "client")) {
    for (const link of original.filter((link) => link.target === node.id))
      parentClients.set(link.source, [
        ...(parentClients.get(link.source) || []),
        node,
      ]);
  }
  if (options.focusApId) {
    const visible = new Set([options.focusApId]),
      queue = [options.focusApId];
    for (let i = 0; i < queue.length; i++)
      for (const link of original) {
        if (link.source === queue[i] && !visible.has(link.target)) {
          visible.add(link.target);
          queue.push(link.target);
        }
      }
    devices = devices.filter((node) => visible.has(node.id));
    original = original.filter(
      (link) => visible.has(link.source) && visible.has(link.target),
    );
  } else {
    devices = devices.filter(
      (node) =>
        node.type !== "client" ||
        (!options.hideClients &&
          original.some(
            (link) =>
              link.target === node.id &&
              (byId.get(link.source)?.type === "ap"
                ? options.expanded.has(link.source)
                : !options.collapsed?.has(link.source)),
          )),
    );
  }
  const hidden = new Set<string>();
  for (const id of Array.from(
    options.focusApId ? [] : options.collapsed || [],
  )) {
    const queue = [id],
      visited = new Set([id]);
    for (let i = 0; i < queue.length; i++)
      for (const link of original)
        if (link.source === queue[i] && !visited.has(link.target)) {
          visited.add(link.target);
          queue.push(link.target);
          // Keep cyclic infrastructure peers; they are still observed connections.
          if (!revealAncestors(topology, id).has(link.target))
            hidden.add(link.target);
        }
  }
  devices = devices.filter((node) => !hidden.has(node.id));
  const ids = new Set(devices.map((node) => node.id));
  let links: Link[] = original.filter(
    (link) => ids.has(link.source) && ids.has(link.target),
  );
  const groupLink = (source: string, target: string): Link => ({
    id: `organization:${source}:${target}`,
    source,
    target,
    type: "organization",
    layer: "logical",
    evidence: "layout.organization",
    observedAt: topology.observedAt,
  });
  if (!options.focusApId) {
    const unmapped = devices.filter(
      (node) =>
        node.type === "ap" &&
        !original.some(
          (link) =>
            link.target === node.id && byId.get(link.source)?.type !== "client",
        ),
    );
    if (unmapped.length) {
      const group: Device = {
        id: "layout:unmapped",
        type: "branch",
        name: "Chưa xác định uplink",
        meta: {
          layoutOnly: true,
          description:
            "Nhóm hiển thị · nguồn chưa cung cấp gateway / switch phía trên",
        },
      };
      members.set(group.id, unmapped);
      devices.push(group);
      if (options.collapsed?.has(group.id)) {
        const subtree = new Set(unmapped.map((node) => node.id));
        for (const node of topology.nodes)
          if (
            revealAncestors(topology, node.id).size &&
            Array.from(revealAncestors(topology, node.id)).some((id) =>
              subtree.has(id),
            )
          )
            subtree.add(node.id);
        devices = devices.filter((node) => !subtree.has(node.id));
        links = links.filter(
          (link) => !subtree.has(link.source) && !subtree.has(link.target),
        );
      } else
        links.push(...unmapped.map((node) => groupLink(group.id, node.id)));
    }
    const unknown = topology.nodes.filter(
      (node) =>
        node.type === "client" &&
        !original.some((link) => link.target === node.id),
    );
    if (unknown.length && !options.hideClients) {
      const group: Device = {
        id: "layout:unassociated",
        type: "branch",
        name: "Máy khách chưa rõ kết nối",
        meta: {
          layoutOnly: true,
          description: "Chưa có quan hệ kết nối được quan sát",
        },
      };
      members.set(group.id, unknown);
      devices.push(group);
      if (options.expanded.has(group.id)) {
        devices.push(...unknown);
        links.push(...unknown.map((node) => groupLink(group.id, node.id)));
      }
    }
  }
  // Condense strongly connected components so observed reciprocal links cannot inflate tree ranks.
  const graph = new dagre.graphlib.Graph();
  devices.forEach((node) => graph.setNode(node.id, {}));
  links.forEach((link) => graph.setEdge(link.source, link.target));
  const algorithms = dagre.graphlib.alg as typeof dagre.graphlib.alg & {
    tarjan: (g: typeof graph) => string[][];
  };
  const components = algorithms.tarjan(graph).map((group) => group.sort());
  const componentOf = new Map<string, string>();
  const dag = new dagre.graphlib.Graph();
  dag.setGraph({
    rankdir: "LR",
    ranksep: 110,
    nodesep: 36,
    edgesep: 24,
    marginx: 32,
    marginy: 32,
  });
  dag.setDefaultEdgeLabel(() => ({}));
  const size = INFRA_NODE_SIZE;
  components.forEach((group, index) => {
    const id = String(index);
    group.forEach((member) => componentOf.set(member, id));
    dag.setNode(id, {
      width: Math.max(...group.map(member=>networkNodeSize(byId.get(member)).width)),
      height: group.reduce((total,member)=>total+networkNodeSize(byId.get(member)).height,0) + (group.length - 1) * 28,
    });
  });
  links.forEach((link) => {
    const source = componentOf.get(link.source)!,
      target = componentOf.get(link.target)!;
    if (source !== target) dag.setEdge(source, target);
  });
  const roots = dag.nodes().filter((id) => !dag.predecessors(id)?.length);
  if (roots.length > 1 && !options.focusApId) {
    const root: Device = {
      id: "layout:site",
      type: "site",
      name: "Toàn mạng",
      meta: {
        layoutOnly: true,
        description: "Nhóm hiển thị · không phải thiết bị vật lý",
      },
    };
    devices.push(root);
    const id = "root";
    componentOf.set(root.id, id);
    components.push([root.id]);
    dag.setNode(id, size);
    for (const child of roots) {
      dag.setEdge(id, child);
      links.push(groupLink(root.id, components[Number(child)][0]));
    }
  }
  if (devices.length) {
    dagre.layout(dag);
    // Anchor each parent to its first branch. Large AP inventories remain readable
    // from the top of the canvas instead of placing the root halfway off-screen.
    for (const id of dagre.graphlib.alg.topsort(dag).reverse()) {
      const children = dag.successors(id) || [];
      if (children.length) {
        const box = dag.node(id);
        box.y =
          Math.min(
            ...children.map((child) => {
              const b = dag.node(child);
              return b.y - b.height / 2;
            }),
          ) +
          box.height / 2;
      }
    }
  }
  // Parent anchoring can move a long branch onto a leaf sibling. Repack each
  // rank after anchoring, using measured component heights and a fixed gutter.
  const columns=new Map<number,string[]>();
  for(const id of dag.nodes()){const x=dag.node(id).x;columns.set(x,[...(columns.get(x)||[]),id]);}
  for(const ids of Array.from(columns.values())){
    ids.sort((a,b)=>dag.node(a).y-dag.node(b).y||a.localeCompare(b));
    let bottom=-Infinity;
    for(const id of ids){const box=dag.node(id);const top=Math.max(box.y-box.height/2,bottom+36);box.y=top+box.height/2;bottom=top+box.height;}
  }
  const positions = new Map<string, { x: number; y: number }>();
  const nodeSourcePos = new Map<string, Position>();
  const nodeTargetPos = new Map<string, Position>();
  for (const group of components) {
    const box = dag.node(componentOf.get(group[0])!);
    let y=box.y-box.height/2;
    group.forEach((id) => {
      const dimensions=networkNodeSize(byId.get(id));
      positions.set(id,{x:box.x-dimensions.width/2,y});
      y+=dimensions.height+28;
    });
  }
  const compact = !options.focusApId && (devices.filter(d => d.type === "ap").length > 3 || devices.filter(d => d.meta?.provider === "mikrotik" && d.meta?.managed).length > 1);
  const grid = compact ? operationalGrid(devices, links, options.columns) : undefined;
  if (grid) for (const [id, position] of Array.from(grid.positions)) {
    positions.set(id, position);
    nodeSourcePos.set(id, grid.sourcePosition);
    nodeTargetPos.set(id, grid.targetPosition);
  }
  const nodes: Node<NetworkNodeData>[] = devices.map((device) => {
    const children = original
      .filter((link) => link.source === device.id && (!grid || grid.forest.primary.has(link.id)))
      .map((link) => byId.get(link.target))
      .filter(Boolean) as Device[];
    const clientCount = parentClients.get(device.id)?.length || 0;
    const childCount = members.get(device.id)?.length ||
      (device.type === "ap" && clientCount > 0 ? clientCount : grid ? grid.forest.children.get(device.id)?.length || 0 : children.length);
    return {
      id: device.id,
      type: "network-device",
      position: positions.get(device.id)!,
      sourcePosition: nodeSourcePos.get(device.id) || Position.Right,
      targetPosition: nodeTargetPos.get(device.id) || Position.Left,
      handles: networkNodeHandles(device,nodeSourcePos.get(device.id)||Position.Right,nodeTargetPos.get(device.id)||Position.Left),
      style: networkNodeSize(device),
      initialWidth: networkNodeSize(device).width,
      initialHeight: networkNodeSize(device).height,
      draggable: false,
      data: {
        device,
        childCount,
        clientCount,
        expanded: options.focusApId
          ? true
          : device.id === "layout:unassociated"
            ? options.expanded.has(device.id)
            : device.type === "ap" && clientCount > 0
              ? options.expanded.has(device.id)
              : !options.collapsed?.has(device.id),
      },
    };
  });
  return {
    nodes,
    edges: links.map((link) => ({
      id: link.id,
      source: link.source,
      target: link.target,
      type: "network-traffic",
      data: { link, ...(grid ? {secondary: !grid.forest.primary.has(link.id), routePoints: grid.routes.get(link.id)} : {}) },
    })),
    members,
  };
}
