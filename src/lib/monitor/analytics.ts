/** Time-weighted availability never treats unobserved time as uptime. */
export type Point = {
  at: number;
  value: number | null;
  samples?: number;
  maximum?: number;
};
export function availability(
  points: Point[],
  start: number,
  end: number,
  maxGap = 95_000,
  sampleIntervalMs = 30_000,
) {
  let observedMs = 0,
    availableMs = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.value === null || !Number.isFinite(p.value)) continue;
    const window = Math.max(
      0,
      Math.min(end, points[i + 1]?.at ?? end, p.at + maxGap) -
        Math.max(start, p.at),
    );
    const duration =
      p.samples === undefined
        ? window
        : Math.min(window, Math.max(0, p.samples) * sampleIntervalMs);
    observedMs += duration;
    availableMs += duration * Math.max(0, Math.min(1, p.value));
  }
  return {
    percent: observedMs ? (availableMs / observedMs) * 100 : null,
    observedMs,
    missingMs: Math.max(0, end - start - observedMs),
  };
}
/** Largest-triangle sampling per contiguous segment, with explicit null gaps retained. */
export function downsample(points: Point[], limit = 500): Point[] {
  if (points.length <= limit) return points;
  const segments: Point[][] = [];
  let segment: Point[] = [];
  for (const p of points) {
    if (p.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
      segments.push([p]);
    } else segment.push(p);
  }
  if (segment.length) segments.push(segment);
  // Pathological, highly fragmented histories are bucketed conservatively: a
  // bucket containing missing data stays missing, never bridges outages.
  if (segments.length * 2 > limit) {
    const size = Math.ceil(points.length / limit),
      output: Point[] = [];
    for (let i = 0; i < points.length; i += size) {
      const bucket = points.slice(i, i + size);
      output.push(
        bucket.find((p) => p.value === null) ??
          bucket[Math.floor(bucket.length / 2)],
      );
    }
    return output;
  }
  const output: Point[] = [],
    budget = limit - segments.length * 2;
  for (const rows of segments) {
    const count = Math.min(
      rows.length,
      Math.max(2, Math.floor((rows.length / points.length) * budget) + 2),
    );
    if (rows.length <= count) {
      output.push(...rows);
      continue;
    }
    const width = (rows.length - 2) / (count - 2);
    let a = 0;
    output.push(rows[0]);
    for (let i = 0; i < count - 2; i++) {
      const next = rows.slice(
        Math.floor((i + 1) * width) + 1,
        Math.min(rows.length, Math.floor((i + 2) * width) + 1),
      );
      const avgX = next.reduce((s, p) => s + p.at, 0) / next.length;
      const avgY = next.reduce((s, p) => s + p.value!, 0) / next.length;
      let best = -1,
        chosen = a + 1;
      for (
        let j = Math.floor(i * width) + 1;
        j < Math.min(rows.length - 1, Math.floor((i + 1) * width) + 1);
        j++
      ) {
        const area = Math.abs(
          (rows[a].at - avgX) * (rows[j].value! - rows[a].value!) -
            (rows[a].at - rows[j].at) * (avgY - rows[a].value!),
        );
        if (area > best) {
          best = area;
          chosen = j;
        }
      }
      output.push(rows[chosen]);
      a = chosen;
    }
    output.push(rows[rows.length - 1]);
  }
  return output;
}
export function percentile(points: Point[], fraction = 0.95) {
  const values = points
    .flatMap((p) => (p.value === null ? [] : [p.value]))
    .sort((a, b) => a - b);
  return values.length
    ? values[Math.max(0, Math.ceil(values.length * fraction) - 1)]
    : null;
}
