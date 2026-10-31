import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import sharp from 'sharp';
import { presetBackground } from '../src/lib/preset-backgrounds';
import { createPresetDocument, TEMPLATE_PRESETS } from '../src/lib/template-presets';
import { DEVICE_KEYS, GATE_SCREENS, mediaUrl, screenSurface } from '../src/lib/template-document';
import DocumentRenderer from '../src/components/renderer/DocumentRenderer';

describe('responsive starter backgrounds', () => {
  it.each(TEMPLATE_PRESETS.map(p => p.id))('%s supplies real landscape and portrait assets on every screen', async id => {
    const document = createPresetDocument(id);
    for (const device of DEVICE_KEYS) {
      const variant = document.variants[device];
      for (const surface of [variant, ...GATE_SCREENS.map(screen => screenSurface(variant, screen))]) {
        const image = mediaUrl(surface.backgroundMedia.image)!;
        expect(image).toContain(device === 'desktop' ? '-desktop.webp' : '-portrait.webp');
        expect(surface.background.type).toBe('cover');
        const metadata = await sharp(`public${image}`).metadata();
        expect([metadata.width, metadata.height]).toEqual(device === 'desktop' ? [1920, 1080] : [1080, 1920]);
      }
    }
  });

  it('upgrades saved starter images by device without changing custom media', () => {
    expect(presetBackground('/nxb-templates/trien-lam-bg.jpg', 'mobile')).toBe('/nxb-templates/backgrounds/trien-lam-portrait.webp');
    expect(presetBackground('/uploads/my-bg.jpg', 'mobile')).toBeUndefined();
    expect(presetBackground('https://example.com/nxb-templates/trien-lam-bg.jpg', 'mobile')).toBeUndefined();
    expect(presetBackground(undefined, 'desktop')).toBeUndefined();
  });

  it('renders saved stretched preset backgrounds with cover while preserving custom fill', () => {
    const document = createPresetDocument('trien-lam');
    const variant = document.variants.mobile;
    variant.background.type = 'fill';
    variant.backgroundMedia.image = {kind:'external',url:'/nxb-templates/trien-lam-bg.jpg'};
    const render = () => renderToStaticMarkup(React.createElement(DocumentRenderer, { document, variant:'mobile', mode:'edit' }));
    expect(render()).toContain('trien-lam-portrait.webp');
    expect(render()).toContain('background-size:cover');
    variant.backgroundMedia.image = {kind:'external',url:'/uploads/custom.jpg'};
    expect(render()).toContain('background-size:100% 100%');
  });
});
