import { describe, expect, it } from 'vitest';
import * as geometry from '../src/lib/cms/interaction';

describe('pointer geometry across scaled and rotated surfaces', () => {
  it('includes section scale instead of drifting at a different phone preset', () => {
    expect((geometry as any).localDelta({ x: 60, y: 30 }, .6 * 375 / 390, 0)).toEqual({ x: 104, y: 52 });
  });
  it('converts a world delta into a rotated parent coordinate system', () => {
    const delta = (geometry as any).localDelta({ x: 0, y: 40 }, .5, 90);
    expect(delta.x).toBeCloseTo(80);
    expect(delta.y).toBeCloseTo(0);
  });
  it('keeps the opposite corner fixed during north-west resizing', () => {
    const layout = { x: 100, y: 80, width: 200, height: 100, rotation: 0 };
    expect((geometry as any).resizeFromHandle(layout, { x: 30, y: 20 }, 'nw', false)).toEqual({ x: 130, y: 100, width: 170, height: 80, rotation: 0 });
  });
  it('resizes a rotated box around its opposite edge', () => {
    const layout = { x: 100, y: 80, width: 200, height: 100, rotation: 90 };
    const result = (geometry as any).resizeFromHandle(layout, { x: 40, y: 0 }, 'e', false);
    expect(result).toEqual({ x: 80, y: 100, width: 240, height: 100, rotation: 90 });
  });
  it('honors the dominant axis and aspect ratio during corner resizing', () => {
    const layout = { x: 0, y: 0, width: 200, height: 100, rotation: 0 };
    expect((geometry as any).resizeFromHandle(layout, { x: 40, y: 10 }, 'se', true)).toEqual({ x: 0, y: 0, width: 240, height: 120, rotation: 0 });
  });
});
