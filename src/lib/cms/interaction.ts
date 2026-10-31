import type { NodeLayout } from '@/lib/template-document';
export interface Point { x: number; y: number }
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
/** Delta in CSS screen pixels -> local design pixels, including ancestor rotation. */
export function localDelta(delta: Point, scale: number, rotation = 0): Point {
  const angle = rotation * Math.PI / 180;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const x = (delta.x * Math.cos(angle) + delta.y * Math.sin(angle)) / safeScale;
  const y = (-delta.x * Math.sin(angle) + delta.y * Math.cos(angle)) / safeScale;
  return { x: Math.round(x * 1e8) / 1e8, y: Math.round(y * 1e8) / 1e8 };
}
export function resizeFromHandle(layout: NodeLayout, delta: Point, handle: ResizeHandle, keepRatio: boolean): NodeLayout {
  let width = Math.max(16, layout.width + (handle.includes('e') ? delta.x : handle.includes('w') ? -delta.x : 0));
  let height = Math.max(8, layout.height + (handle.includes('s') ? delta.y : handle.includes('n') ? -delta.y : 0));
  if (keepRatio) {
    const horizontal = handle === 'e' || handle === 'w';
    const vertical = handle === 'n' || handle === 's';
    if (horizontal || (!vertical && Math.abs(width / layout.width - 1) >= Math.abs(height / layout.height - 1))) height = width * layout.height / layout.width;
    else width = height * layout.width / layout.height;
    const minimum = Math.max(1, 16 / width, 8 / height);
    width *= minimum; height *= minimum;
  }
  width = Math.round(width); height = Math.round(height);
  const dw = width - layout.width, dh = height - layout.height;
  const offsetX = handle.includes('w') ? -dw : !handle.includes('e') ? -dw / 2 : 0;
  const offsetY = handle.includes('n') ? -dh : !handle.includes('s') ? -dh / 2 : 0;
  const angle = layout.rotation * Math.PI / 180;
  const cx = offsetX + dw / 2, cy = offsetY + dh / 2;
  return { ...layout, width, height,
    x: Math.round(layout.x + cx * Math.cos(angle) - cy * Math.sin(angle) - dw / 2),
    y: Math.round(layout.y + cx * Math.sin(angle) + cy * Math.cos(angle) - dh / 2),
  };
}
export function dragLayout(layout: NodeLayout, delta: Point, scale = 1, snap = true): NodeLayout {
  const quantize = (n: number) => snap ? Math.round(n / 8) * 8 : n;
  return { ...layout, x: quantize(layout.x + delta.x / scale), y: quantize(layout.y + delta.y / scale) };
}
export function resizeLayout(layout: NodeLayout, delta: Point, scale = 1, keepRatio = false, snap = true): NodeLayout {
  const quantize = (n: number) => Math.max(8, snap ? Math.round(n / 8) * 8 : n);
  const width = quantize(layout.width + delta.x / scale);
  return { ...layout, width, height: keepRatio ? width * layout.height / layout.width : quantize(layout.height + delta.y / scale) };
}
export function magneticLayout(layout: NodeLayout, others: NodeLayout[], bounds: {width:number;height:number}, tolerance = 5): { layout: NodeLayout; guides: {x?:number;y?:number} } {
  const next = { ...layout }; const guides: {x?:number;y?:number} = {};
  for (const axis of ['x','y'] as const) {
    const length = axis === 'x' ? 'width' : 'height'; const targets = [0, bounds[length]/2, bounds[length], ...others.flatMap(o => [o[axis], o[axis]+o[length]/2, o[axis]+o[length]])];
    let distance = tolerance + 1;
    for (const offset of [0, layout[length]/2, layout[length]]) for (const target of targets) {
      const d = target - (layout[axis] + offset);
      if (Math.abs(d) < distance) { distance = Math.abs(d); next[axis] = layout[axis] + d; guides[axis] = target; }
    }
  }
  return { layout: next, guides };
}
export function contrastRatio(a: string, b: string): number | null {
  const luminance = (hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  const x=luminance(a), y=luminance(b); return x===null||y===null?null:(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
