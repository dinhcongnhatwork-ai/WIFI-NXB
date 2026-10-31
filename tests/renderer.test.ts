import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DocumentRenderer from '../src/components/renderer/DocumentRenderer';
import { createDocument, createNode } from '../src/lib/template-document';

function setup() {
  const document = createDocument();
  const design = document.variants.desktop;
  design.flow.videoGate!.element.enabled = true;
  design.flow.attendanceGate!.element.enabled = true;
  design.flow.announcement!.element.enabled = true;
  const text = createNode('title');
  if (text.element.type === 'title') text.element.content = 'Custom meeting surroundings';
  design.screens!.attendance_gate!.sections[0].nodes.push(text);
  return document;
}
function render(document: ReturnType<typeof setup>, props: Record<string, unknown>) {
  return renderToStaticMarkup(React.createElement(DocumentRenderer, { document, variant: 'desktop', ...props }));
}
describe('shared renderer screens', () => {
  it('edits only the chosen surface with its inline functional block and surrounding content', () => {
    const html = render(setup(), {mode:'edit', screen:'attendance_gate'});
    expect(html).toContain('data-screen="attendance_gate"');
    expect(html).toContain('Custom meeting surroundings');
    expect(html).toContain('data-flow-content="attendance_gate"');
    expect(html).not.toContain('position:fixed');
    expect(html).not.toContain('Chào mừng đến với WiFi');
  });
  it('places nested rotated child hit areas above selected parent overlays without lifting root layers', () => {
    const document = setup(); const section = document.variants.desktop.sections[0];
    section.mode = 'freeform';
    const parent = createNode('container'); parent.layout.rotation = 25;
    const child = createNode('title'); child.layout.rotation = -10;
    const grandchild = createNode('shape'); child.children = [grandchild]; parent.children = [child]; section.nodes = [parent];
    const html = render(document, {mode:'edit', renderNodeOverlay:(node: {id:string})=>React.createElement('div', {'data-hit-area':node.id,style:{position:'absolute',inset:0,zIndex:30}})});
    const wrapperStyle = (id:string) => html.match(new RegExp(`data-node-id="${id}"[^>]*style="([^\"]+)"`))?.[1];
    expect(wrapperStyle(parent.id)).not.toContain('z-index:');
    expect(wrapperStyle(child.id)).toContain('z-index:31');
    expect(wrapperStyle(grandchild.id)).toContain('z-index:31');
  });
  it('starts the complete live flow at video without stacking attendance and announcement', () => {
    const html = render(setup(), {mode:'live'});
    expect(html).toContain('data-screen="video_gate"');
    expect(html).not.toContain('data-flow-content="attendance_gate"');
    expect(html).not.toContain('data-flow-content="announcement"');
  });
  it('renders a disabled single-screen preview as an explicit prompt', () => {
    const document = setup(); document.variants.desktop.flow.announcement!.element.enabled = false;
    expect(render(document, {mode:'simulate', previewTarget:'announcement'})).toContain('Màn hình này đang tắt');
  });
  it('preserves portrait video ratio on desktop and contains media', () => {
    const document = setup(); const video = document.variants.desktop.flow.videoGate!.element;
    if (video.type === 'video_gate') { video.aspectRatio='9:16'; video.videoUrl='/demo.mp4'; }
    const html = render(document, {mode:'simulate', previewTarget:'video_gate'});
    expect(html).toContain('aspect-ratio:9/16');
    expect(html).toContain('object-fit:contain');
    expect(html).not.toContain('position:fixed');
  });
});
