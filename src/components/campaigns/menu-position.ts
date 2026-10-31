interface AnchorRect { top: number; bottom: number; right: number }
interface MenuSize { width: number; height: number }
interface Viewport { left: number; top: number; width: number; height: number }

export function positionCampaignMenu(anchor: AnchorRect, menu: MenuSize, viewport: Viewport) {
  const margin = 8;
  const gap = 4;
  const minTop = viewport.top + margin;
  const minLeft = viewport.left + margin;
  const maxBottom = viewport.top + viewport.height - margin;
  const maxRight = viewport.left + viewport.width - margin;
  const below = Math.max(0, maxBottom - Math.max(minTop, anchor.bottom + gap));
  const above = Math.max(0, Math.min(maxBottom, anchor.top - gap) - minTop);
  const openAbove = menu.height > below && above > below;
  const maxHeight = openAbove ? above : below;
  const maxWidth = Math.max(0, viewport.width - margin * 2);
  const height = Math.min(menu.height, maxHeight);
  const width = Math.min(menu.width, maxWidth);
  const top = openAbove ? anchor.top - gap - height : anchor.bottom + gap;
  return {
    top: Math.max(minTop, Math.min(top, maxBottom - height)),
    left: Math.max(minLeft, Math.min(anchor.right - width, maxRight - width)),
    maxHeight,
    maxWidth,
  };
}
