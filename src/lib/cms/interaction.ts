import type { NodeLayout } from '@/lib/template-document';
export interface Point { x: number; y: number }
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
