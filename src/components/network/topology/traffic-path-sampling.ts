type Point = { x: number; y: number };
type PathGeometry = {
  getAttribute?: (name: string) => string | null;
  getTotalLength: () => number;
  getPointAtLength: (distance: number) => Point;
};

function append(points: Point[], point: Point) {
  const last = points[points.length - 1];
  if (!last || last.x !== point.x || last.y !== point.y) points.push(point);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.x - start.x - dx * fraction, point.y - start.y - dy * fraction);
}

/** Subdivide only curved sections; long straight bus segments stay inexpensive. */
function flattenCurve(curve: Point[], points: Point[], depth = 0) {
  const last = curve[curve.length - 1];
  if (depth >= 12 || curve.slice(1, -1).every(point => distanceToSegment(point, curve[0], last) <= 0.2)) {
    append(points, last);
    return;
  }
  const left = [curve[0]], right = [last];
  let level = curve;
  while (level.length > 1) {
    level = level.slice(1).map((point, index) => ({ x: (point.x + level[index].x) / 2, y: (point.y + level[index].y) / 2 }));
    left.push(level[0]);
    right.unshift(level[level.length - 1]);
  }
  flattenCurve(left, points, depth + 1);
  flattenCurve(right, points, depth + 1);
}

/** Our generated cable routes use absolute move, line, quadratic and cubic commands. */
function flattenGeneratedPath(value: string): Point[] | null {
  const tokens = value.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/g);
  if (!tokens) return null;
  const points: Point[] = [];
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++];
    const count = command === "M" || command === "L" ? 1 : command === "Q" ? 2 : command === "C" ? 3 : 0;
    if (!count || index + count * 2 > tokens.length) return null;
    const next: Point[] = [];
    for (let i = 0; i < count; i++) {
      const x = Number(tokens[index++]), y = Number(tokens[index++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      next.push({ x, y });
    }
    if (count === 1) append(points, next[0]);
    else {
      if (!points.length) return null;
      flattenCurve([points[points.length - 1], ...next], points);
    }
  }
  return points.length ? points : null;
}

function evenlySpaced(points: Point[]) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) cumulative.push(cumulative[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  const length = cumulative[cumulative.length - 1];
  if (!length) return [points[0], points[0]];
  const segments = Math.max(1, Math.min(8192, Math.ceil(length / 4)));
  let high = 1;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const distance = length * index / segments;
    while (high < points.length - 1 && cumulative[high] < distance) high++;
    const fraction = (distance - cumulative[high - 1]) / (cumulative[high] - cumulative[high - 1]);
    return { x: points[high - 1].x + (points[high].x - points[high - 1].x) * fraction, y: points[high - 1].y + (points[high].y - points[high - 1].y) * fraction };
  });
}

/** Keep canvas interpolation on long rounded routes without blocking on native SVG geometry. */
export function sampleTrafficPath(path: PathGeometry) {
  const value = path.getAttribute?.("d");
  const generated = value && flattenGeneratedPath(value);
  if (generated) return evenlySpaced(generated);
  // Bound native work for an unexpected path format from another edge renderer.
  const length = path.getTotalLength();
  return Array.from({ length: 97 }, (_, index) => {
    const point = path.getPointAtLength(length * index / 96);
    return { x: point.x, y: point.y };
  });
}
