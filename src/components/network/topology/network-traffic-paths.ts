import { getSmoothStepPath, Position } from "@xyflow/react";

export type TrafficRoutePoint = { x: number; y: number };
type Endpoints = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  routePoints?: TrafficRoutePoint[];
};
const LANE_GAP = 3.5;

const EPSILON = 0.001;
function simplify(points: TrafficRoutePoint[]) {
  const result: TrafficRoutePoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const previous = result[result.length - 1];
    if (previous && Math.hypot(point.x - previous.x,point.y - previous.y) < EPSILON) continue;
    while (result.length > 1) {
      const before=result[result.length-2],last=result[result.length-1];
      const ax=last.x-before.x,ay=last.y-before.y,bx=point.x-last.x,by=point.y-last.y;
      if (Math.abs(ax*by-ay*bx) > EPSILON * (Math.hypot(ax,ay)+Math.hypot(bx,by))) break;
      result.pop();
    }
    result.push(point);
  }
  return result;
}

function offsetRoute(points: TrafficRoutePoint[], offset: number) {
  if (points.length < 2) return points;
  const normals = points.slice(1).map((point, index) => {
    const previous = points[index];
    const length = Math.hypot(point.x - previous.x, point.y - previous.y);
    return { x: -(point.y - previous.y) / length, y: (point.x - previous.x) / length };
  });
  return points.map((point, index) => {
    const before = normals[Math.max(0, index - 1)];
    const after = normals[Math.min(normals.length - 1, index)];
    // Orthogonal turns meet at the intersection of the two parallel segments.
    const denominator = 1 + before.x * after.x + before.y * after.y;
    if (denominator < 0.01) return { x:point.x+offset*after.x,y:point.y+offset*after.y };
    return { x: point.x + offset * (before.x + after.x) / denominator, y: point.y + offset * (before.y + after.y) / denominator };
  });
}

function roundedRoute(input: TrafficRoutePoint[]) {
  const points=simplify(input);
  if (points.length < 2) return `M ${points[0]?.x || 0} ${points[0]?.y || 0} l 0.001 0`;
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1], point = points[index], after = points[index + 1];
    const incoming = Math.hypot(point.x - before.x, point.y - before.y);
    const outgoing = Math.hypot(after.x - point.x, after.y - point.y);
    const radius = Math.min(16, incoming / 2, outgoing / 2);
    const entry = { x: point.x + (before.x - point.x) * radius / incoming, y: point.y + (before.y - point.y) * radius / incoming };
    const exit = { x: point.x + (after.x - point.x) * radius / outgoing, y: point.y + (after.y - point.y) * radius / outgoing };
    commands.push(`L ${entry.x} ${entry.y}`, `Q ${point.x} ${point.y} ${exit.x} ${exit.y}`);
  }
  const end = points[points.length - 1];
  commands.push(`L ${end.x} ${end.y}`);
  return commands.join(" ");
}

/** SVG base cables and canvas traffic must use the same route in flow coordinates. */
export function networkTrafficPaths(input: Endpoints) {
  const points = simplify([{ x: input.sourceX, y: input.sourceY }, ...(input.routePoints || []), { x: input.targetX, y: input.targetY }]);
  if (input.routePoints?.length && points.length >= 2) {
    const middle = points[Math.floor(points.length / 2)];
    return { path: roundedRoute(points), downloadPath: roundedRoute(offsetRoute(points, LANE_GAP)), uploadPath: roundedRoute(offsetRoute(points, -LANE_GAP)), x: middle.x, y: middle.y };
  }
  const verticalSource = input.sourcePosition === Position.Bottom || input.sourcePosition === Position.Top;
  const verticalTarget = input.targetPosition === Position.Bottom || input.targetPosition === Position.Top;
  const route = (offset: number) => getSmoothStepPath({ ...input, sourceX: input.sourceX + (verticalSource ? -offset : 0), sourceY: input.sourceY + (verticalSource ? 0 : -offset), targetX: input.targetX + (verticalTarget ? -offset : 0), targetY: input.targetY + (verticalTarget ? 0 : -offset), borderRadius: 16, offset: 24 });
  const [path, x, y] = route(0);
  return { path, downloadPath: route(LANE_GAP)[0], uploadPath: route(-LANE_GAP)[0], x, y };
}
