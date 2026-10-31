import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DocumentRenderer from '../src/components/renderer/DocumentRenderer';
import { createDocument, createNode } from '../src/lib/template-document';
function render(element: Record<string, unknown>) {
  const document = createDocument(), node = createNode('connect_button');
  Object.assign(node.element, element); document.variants.mobile.sections[0].nodes = [node];
  return renderToStaticMarkup(React.createElement(DocumentRenderer, { document, variant: 'mobile', mode: 'edit' }));
}
describe('connect button presentation', () => {
  it('retains every gradient stop and angle from a saved studio preset', () => {
    const css = 'linear-gradient(160deg, #450a0a 0%, #991b1b 55%, #b45309 100%)';
    expect(render({ buttonStyle: 'gradient', gradient: { from:'#450a0a',to:'#b45309',css } })).toContain(css);
  });
  it('renders image actions as named native buttons and honors required confirmation', () => {
    const html = render({imageSrc:'/connect.png',requireConfirm:true});
    expect(html).toMatch(/<button[^>]+disabled=""/);
    expect(html).toContain('aria-label="Kết nối WiFi ngay"');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('Đã kết nối thành công');
  });
});
