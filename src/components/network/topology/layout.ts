import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { Topology } from "@/lib/network/topology";
import type { Device, Link } from "./model";
export type NodeData = Record<string, unknown> & {
  device: Device;
  members?: Device[];
  expanded?: boolean;
  traffic?: import("./model").Traffic;
};
export type LayoutOptions = {
  hideClients: boolean;
  layer: string;
  grouping: string;
  expanded: Set<string>;
};
export function buildLayout(
  topology: Topology,
  options: LayoutOptions,
): { nodes: Node<NodeData>[]; edges: Edge[]; clusters: Map<string, Device[]> } {
  const all = [...topology.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const originalLinks = [...topology.links]
    .filter((e) => options.layer === "all" || e.layer === options.layer)
    .sort((a, b) => a.id.localeCompare(b.id));
  const groups = new Map<string, Device[]>();
  const clusterOf = new Map<string, string>();
  for (const node of all.filter(
    (n) => n.type === "client" && n.group !== "unknown",
  )) {
    const parent = topology.links.find((e) => e.target === node.id)?.source;
    if (!parent) continue;
    const key =
      options.grouping === "ssid"
        ? `ssid:${node.meta?.ssid || "Không có SSID"}`
        : parent;
    const id = `cluster:${key}`;
    groups.set(id, [...(groups.get(id) || []), node]);
    clusterOf.set(node.id, id);
  }
  let visible: Device[] = all.filter(
    (n) => n.type !== "client" && n.group !== "unknown",
  );
  const members = new Map<string, Device[]>();
  if (!options.hideClients)
    for (const [id, clients] of Array.from(groups)) {
      const parent = all.find(
        (n) =>
          n.id ===
          topology.links.find((e) => e.target === clients[0].id)?.source,
      );
      visible.push({
        id,
        type: "cluster",
        name:
          options.grouping === "ssid"
            ? String(clients[0].meta?.ssid || "Không có SSID")
            : `Khách · ${parent?.name || "Kết nối"}`,
      });
      members.set(id, clients);
      if (options.expanded.has(id)) visible.push(...clients.slice(0, 30));
    }
  const ids = new Set(visible.map((n) => n.id));
  let links: Link[] = [];
  const seen = new Set<string>();
  for (const edge of originalLinks) {
    const cluster = clusterOf.get(edge.target);
    if (cluster && !options.hideClients) {
      const id = `${edge.source}:${cluster}`;
      if (!seen.has(id)) {
        links.push({ ...edge, id: `cluster-edge:${id}`, target: cluster });
        seen.add(id);
      }
      if (options.expanded.has(cluster) && ids.has(edge.target))
        links.push({ ...edge, source: cluster });
    } else if (ids.has(edge.source) && ids.has(edge.target)) links.push(edge);
  }
  const byId = new Map(all.map(node => [node.id, node]));
  const groupingLink = (source: string, target: string): Link => ({
    id: `organization:${source}:${target}`, source, target,
    type: "organization", layer: "logical", evidence: "layout.organization",
    observedAt: topology.observedAt,
  });
  // Standalone APs have no observed infrastructure parent or child. Keep them
  // in an explicit expandable branch rather than inventing a switch uplink.
  const unmapped = visible.filter(node => node.type === "ap" && !topology.links.some(
    edge => (edge.source === node.id && byId.get(edge.target)?.type !== "client")
      || (edge.target === node.id && byId.get(edge.source)?.type !== "client"),
  ));
  if (unmapped.length >= 4 && options.grouping === "ap") {
    const branchId = "branch:unmapped";
    groups.set(branchId, unmapped);
    members.set(branchId, unmapped);
    if (!options.expanded.has(branchId)) {
      const hidden = new Set(unmapped.map(node => node.id));
      // This branch has no infrastructure children; hide only its client subtrees.
      for (let pass = 0; pass < visible.length; pass++) {
        const before = hidden.size;
        for (const edge of links) if (hidden.has(edge.source)) hidden.add(edge.target);
        if (hidden.size === before) break;
      }
      visible = visible.filter(node => !hidden.has(node.id));
      links = links.filter(edge => !hidden.has(edge.source) && !hidden.has(edge.target));
    } else {
      links.push(...unmapped.map(node => groupingLink(branchId, node.id)));
    }
    visible.push({ id: branchId, type: "branch", name: "AP chưa rõ uplink",
      meta: { layoutOnly: true, description: "Chưa có dữ liệu switch / gateway phía trên" } });
  }
  const dimension = (node: Device) => ({
    width: node.type === "client" ? 128 : node.type === "site" || node.type === "branch" ? 180 : 160,
    height: node.type === "client" ? 120 : node.type === "site" || node.type === "branch" ? 116 : node.type === "cluster" ? 130 : 148,
  });
  const graph = new dagre.graphlib.Graph();
  for (const node of visible) graph.setNode(node.id, {});
  for (const edge of links) if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) graph.setEdge(edge.source, edge.target);
  // Dagre's bundled declaration misspells the runtime tarjan export as tarjam.
  const algorithms = dagre.graphlib.alg as typeof dagre.graphlib.alg & {
    tarjan: (input: typeof graph) => string[][];
  };
  const components = algorithms.tarjan(graph).map(component => component.sort());
  const componentOf = new Map<string, string>();
  const condensed = new dagre.graphlib.Graph();
  condensed.setGraph({ rankdir: "TB", ranksep: 92, nodesep: 44, edgesep: 24, marginx: 32, marginy: 24 });
  condensed.setDefaultEdgeLabel(() => ({}));
  const visibleById = new Map(visible.map(node => [node.id, node]));
  components.forEach((component, index) => {
    const id = String(index);
    const sizes = component.map(member => dimension(visibleById.get(member)!));
    condensed.setNode(id, { width: sizes.reduce((sum, size) => sum + size.width, 0) + (component.length - 1) * 44,
      height: Math.max(...sizes.map(size => size.height)) });
    component.forEach(member => componentOf.set(member, id));
  });
  for (const edge of links) {
    const source = componentOf.get(edge.source), target = componentOf.get(edge.target);
    if (source !== undefined && target !== undefined && source !== target) condensed.setEdge(source, target);
  }
  const roots = condensed.nodes().filter(id => !condensed.predecessors(id)?.length);
  // A clearly labelled organization root joins the forest, not physical cables.
  if (roots.length > 1 || visible.some(node => node.type === "branch")) {
    const root: Device = { id: "layout:site", type: "site", name: "Sơ đồ mạng",
      meta: { layoutOnly: true, description: "Nhóm hiển thị · không phải gateway" } };
    visible.push(root);
    const id = "organization-root";
    componentOf.set(root.id, id);
    components.push([root.id]);
    condensed.setNode(id, dimension(root));
    for (const child of roots) {
      condensed.setEdge(id, child);
      const representative = components[Number(child)][0];
      links.push(groupingLink(root.id, representative));
    }
  }
  dagre.layout(condensed);
  const positions = new Map<string, {x: number; y: number}>();
  for (const component of components) {
    const box = condensed.node(componentOf.get(component[0])!);
    let x = box.x - box.width / 2;
    for (const id of component) {
      const node = visible.find(item => item.id === id)!;
      const size = dimension(node);
      positions.set(id, {x, y: box.y - size.height / 2});
      x += size.width + 44;
    }
  }
  const nodes: Node<NodeData>[] = visible.map(device => ({
    id: device.id, type: "device", position: positions.get(device.id)!,
    data: {device, members: members.get(device.id), expanded: options.expanded.has(device.id)},
    style: dimension(device), initialWidth: dimension(device).width, initialHeight: dimension(device).height, draggable: false,
  }));
  return {
    nodes,
    edges: links.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, type: "traffic",
      ...(componentOf.get(edge.source) === componentOf.get(edge.target) ? {sourceHandle: "peer-out", targetHandle: "peer-in"} : {}),
      data: {link: edge},
    })),
    clusters: groups,
  };
}
