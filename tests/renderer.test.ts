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

  it('renders rich typography, text gradient, text shadow, and pill container on title and description', () => {
    const document = createDocument();
    const design = document.variants.desktop;
    const titleNode = design.sections[0].nodes.find((n) => n.element.type === 'title')!;
    if (titleNode.element.type === 'title') {
      titleNode.element.fontFamily = "'Playfair Display', Georgia, serif";
      titleNode.element.fontWeight = 800;
      titleNode.element.fontStyle = 'italic';
      titleNode.element.textDecoration = 'underline';
      titleNode.element.textTransform = 'uppercase';
      titleNode.element.lineHeight = 1.4;
      titleNode.element.letterSpacing = '0.08em';
      titleNode.element.textShadow = 'glow';
      titleNode.element.textGradient = 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)';
      titleNode.element.bgColor = '#0f172a';
      titleNode.element.bgOpacity = 0.75;
      titleNode.element.backdropBlur = 8;
      titleNode.element.paddingX = 16;
      titleNode.element.paddingY = 8;
      titleNode.element.borderRadius = '24px';
    }
    const html = render(document, { mode: 'edit', screen: 'portal' });
    expect(html).toContain('Playfair Display');
    expect(html).toContain('font-weight:800');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('text-decoration:underline');
    expect(html).toContain('text-transform:uppercase');
    expect(html).toContain('letter-spacing:0.08em');
    expect(html).toContain('-webkit-background-clip:text');
    expect(html).toContain('backdrop-filter:blur(8px)');
  });

  it('renders portal background gradients, scrims, patterns, and image filters', () => {
    const document = createDocument();
    const design = document.variants.desktop;
    design.background.bgMode = 'gradient';
    design.background.gradientFrom = '#0f172a';
    design.background.gradientTo = '#1e3a8a';
    design.background.gradientAngle = 120;
    design.background.overlayMode = 'gradient';
    design.background.overlayGradientDirection = 'to-b';
    design.background.overlayColor = '#000000';
    design.background.overlayOpacity = 0.6;
    design.background.pattern = 'dots';
    design.background.patternColor = '#ffffff';
    design.background.patternOpacity = 0.2;
    design.backgroundMedia.image = { kind: 'external', url: '/bg-hero.jpg' };
    design.background.imageBlur = 6;
    design.background.brightness = 110;

    const html = render(document, { mode: 'edit', screen: 'portal' });
    expect(html).toContain('linear-gradient(120deg, #0f172a 0%, #1e3a8a 100%)');
    expect(html).toContain('radial-gradient(#ffffff 1.35px, transparent 1.35px)');
    expect(html).toContain('linear-gradient(180deg, rgba(0,0,0,0.08) 0%, #000000 100%)');
    expect(html).toContain('blur(6px)');
    expect(html).toContain('brightness(110%)');
  });

  it('renders image aspect ratio, mask shape, caption, and connect button gradient object & shimmer effect', () => {
    const document = createDocument();
    const design = document.variants.desktop;
    const imgNode = createNode('image');
    if (imgNode.element.type === 'image') {
      imgNode.element.src = '/promo.jpg';
      imgNode.element.aspectRatio = '16/9';
      imgNode.element.maskShape = 'rounded';
      imgNode.element.borderWidth = 3;
      imgNode.element.borderStyle = 'solid';
      imgNode.element.borderColor = '#38bdf8';
      imgNode.element.shadow = 'strong';
      imgNode.element.caption = 'Ưu đãi mùa hè';
      imgNode.element.captionPosition = 'overlay-bottom';
    }
    design.sections[0].nodes.push(imgNode);

    const btnSection = design.sections.find((s) => s.nodes.some((n) => n.element.type === 'connect_button'))!;
    const btnNode = btnSection.nodes.find((n) => n.element.type === 'connect_button')!;
    if (btnNode.element.type === 'connect_button') {
      btnNode.element.buttonStyle = 'gradient';
      btnNode.element.gradient = { from: '#2563eb', to: '#06b6d4' };
      btnNode.element.buttonEffect = 'shimmer';
      btnNode.element.textTransform = 'uppercase';
    }

    const html = render(document, { mode: 'edit', screen: 'portal' });
    expect(html).toContain('aspect-ratio:16/9');
    expect(html).toContain('3px solid #38bdf8');
    expect(html).toContain('Ưu đãi mùa hè');
    expect(html).toContain('linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)');
    expect(html).toContain('shimmer');
  });
});

describe('document geometry overrides legacy responsive dimensions', () => {
  it('keeps tablet sliders within the height configured in the CMS', () => {
    const document = createDocument();
    const slider = createNode('image_slider');
    slider.layout.height = 180;
    Object.assign(slider.element, { images:[{src:'/photo.jpg',alt:'Ảnh hội nghị'}],heightDesktop:'400px' });
    document.variants.tablet.sections[0].nodes = [slider];
    const html = renderToStaticMarkup(React.createElement(DocumentRenderer,{document,variant:'tablet',mode:'edit'}));
    expect(html).not.toContain('height:400px');
    expect(html).toContain('height:180px');
  });
});
