import { describe, it, expect } from 'vitest';
import {
  createDocument,
  createNode,
  createSection,
  copyVariant,
  toDocument,
  validateDocument,
  variantForWidth,
  materializeElement,
  setNodeMedia,
  mediaRef,
  mediaUrl,
  allNodes,
  clone,
  type TemplateDocumentV2,
  type DeviceVariant,
} from '../src/lib/template-document';
import {
  dragLayout,
  resizeLayout,
  magneticLayout,
  contrastRatio,
} from '../src/lib/cms/interaction';
import { createDefaultTemplateConfig } from '../src/types';

describe('CMS Editor Component & Layer Operations', () => {
  it('creates default TemplateDocumentV2 with 3 distinct device variants', () => {
    const doc = createDocument();
    expect(doc.schemaVersion).toBe(2);
    expect(doc.variants.mobile).toBeDefined();
    expect(doc.variants.tablet).toBeDefined();
    expect(doc.variants.desktop).toBeDefined();

    expect(doc.variants.mobile.viewport.width).toBe(390);
    expect(doc.variants.tablet.viewport.width).toBe(768);
    expect(doc.variants.desktop.viewport.width).toBe(1440);
  });

  it('adds and removes sections without affecting other variants', () => {
    const doc = createDocument();
    const initialMobileSections = doc.variants.mobile.sections.length;
    const initialTabletSections = doc.variants.tablet.sections.length;

    const newFlowSection = createSection({ width: 390, height: 844 }, 'flow');
    doc.variants.mobile.sections.push(newFlowSection);

    expect(doc.variants.mobile.sections.length).toBe(initialMobileSections + 1);
    expect(doc.variants.tablet.sections.length).toBe(initialTabletSections);
  });

  it('adds, locks, hides, duplicates, and deletes nodes inside a section', () => {
    const doc = createDocument();
    const section = doc.variants.mobile.sections[0];
    const initialCount = section.nodes.length;

    // Add title node
    const titleNode = createNode('title');
    section.nodes.push(titleNode);
    expect(section.nodes.length).toBe(initialCount + 1);

    // Lock & Hide
    titleNode.locked = true;
    titleNode.hidden = true;
    expect(titleNode.locked).toBe(true);
    expect(titleNode.hidden).toBe(true);

    // Duplicate
    const duplicated = clone(titleNode);
    duplicated.id = 'node-dup-test';
    duplicated.locked = false;
    section.nodes.push(duplicated);
    expect(section.nodes.length).toBe(initialCount + 2);
    expect(section.nodes.find((n) => n.id === 'node-dup-test')?.locked).toBe(false);

    // Delete
    section.nodes = section.nodes.filter((n) => n.id !== titleNode.id);
    expect(section.nodes.find((n) => n.id === titleNode.id)).toBeUndefined();
  });

  it('updates node media references cleanly', () => {
    const node = createNode('image');
    setNodeMedia(node, 'src', '/api/media/images/2026/09/test.png');
    expect(node.media.src).toEqual({
      kind: 'object',
      key: 'images/2026/09/test.png',
    });
    expect(mediaUrl(node.media.src)).toBe('/api/media/images/2026/09/test.png');

    const materialized = materializeElement(node) as any;
    expect(materialized.src).toBe('/api/media/images/2026/09/test.png');
  });
});

describe('Coordinate Transforms & Magnetic Snapping', () => {
  const layout = { x: 50, y: 100, width: 200, height: 120, rotation: 0 };

  it('performs 8px quantizing drag accurately across scale levels', () => {
    // scale 0.5 (zoomed out)
    const dragged50 = dragLayout(layout, { x: 10, y: 20 }, 0.5, true);
    expect(dragged50.x % 8).toBe(0);
    expect(dragged50.y % 8).toBe(0);

    // scale 1.5 (zoomed in)
    const dragged150 = dragLayout(layout, { x: 15, y: -25 }, 1.5, true);
    expect(dragged150.x % 8).toBe(0);
    expect(dragged150.y % 8).toBe(0);
  });

  it('resizes with aspect ratio lock', () => {
    const resized = resizeLayout(layout, { x: 80, y: 0 }, 1, true, true);
    expect(resized.width).toBe(280);
    // ratio = 120 / 200 = 0.6 => height = 280 * 0.6 = 168
    expect(resized.height).toBe(168);
  });

  it('snaps magnetically to sibling bounds within tolerance', () => {
    const sibling = { x: 100, y: 200, width: 150, height: 80, rotation: 0 };
    // Place node at x: 98 (within 5px tolerance of sibling.x = 100)
    const testLayout = { ...layout, x: 98, y: 300 };
    const { layout: result, guides } = magneticLayout(
      testLayout,
      [sibling],
      { width: 390, height: 844 },
      5
    );
    expect(result.x).toBe(100);
    expect(guides.x).toBe(100);
  });

  it('calculates WCAG contrast ratio for accessibility validation', () => {
    const blackOnWhite = contrastRatio('#000000', '#ffffff');
    expect(blackOnWhite).toBeCloseTo(21, 0);

    const whiteOnDarkBlue = contrastRatio('#ffffff', '#0f172a');
    expect(whiteOnDarkBlue).toBeGreaterThan(10);

    const poorContrast = contrastRatio('#888888', '#999999');
    expect(poorContrast).toBeLessThan(2);
  });
});

describe('Pre-Flight Publishing Checklist & Document Validation', () => {
  it('detects missing connect button as a blocking error', () => {
    const doc = createDocument();
    // Remove connect button from mobile variant
    doc.variants.mobile.sections[0].nodes = doc.variants.mobile.sections[0].nodes.filter(
      (n) => n.element.type !== 'connect_button'
    );
    const issues = validateDocument(doc);
    const hasError = issues.some(
      (i) => i.severity === 'error' && i.variant === 'mobile' && i.message.includes('nút kết nối')
    );
    expect(hasError).toBe(true);
  });

  it('detects image without alt text as non-blocking warning', () => {
    const doc = createDocument();
    const imageNode = createNode('image');
    setNodeMedia(imageNode, 'src', 'https://example.com/banner.png');
    (imageNode.element as any).alt = '';
    doc.variants.mobile.sections[0].nodes.push(imageNode);

    const issues = validateDocument(doc);
    const altWarning = issues.some(
      (i) => i.severity === 'warning' && i.nodeId === imageNode.id && i.message.includes('mô tả ảnh')
    );
    expect(altWarning).toBe(true);
  });

  it('warns when freeform element exceeds section boundaries', () => {
    const doc = createDocument();
    const freeform = createSection({ width: 390, height: 800 }, 'freeform');
    const button = createNode('connect_button');
    button.layout.x = 350; // width 280 + 350 = 630 > 390
    button.layout.width = 280;
    freeform.nodes.push(button);
    doc.variants.mobile.sections.push(freeform);

    const issues = validateDocument(doc);
    const overflowWarning = issues.some(
      (i) => i.severity === 'warning' && i.nodeId === button.id && i.message.includes('vượt khỏi section')
    );
    expect(overflowWarning).toBe(true);
  });
});

describe('Cross-Device Copying & Isolation', () => {
  it('copies variant with overwrite or append modes', () => {
    const doc = createDocument();
    doc.variants.mobile.sections[0].name = 'Hero Banner Custom';

    // Overwrite tablet
    const overwritten = copyVariant(doc, 'mobile', 'tablet', false);
    expect(overwritten.variants.tablet.sections[0].name).toBe('Hero Banner Custom');
    expect(overwritten.variants.tablet.viewport.width).toBe(768);

    // Node IDs are regenerated to prevent shared identity
    expect(overwritten.variants.tablet.sections[0].nodes[0].id).not.toBe(
      doc.variants.mobile.sections[0].nodes[0].id
    );

    // Append to desktop
    const beforeDesktopSections = doc.variants.desktop.sections.length;
    const appended = copyVariant(doc, 'mobile', 'desktop', true);
    expect(appended.variants.desktop.sections.length).toBe(
      beforeDesktopSections + doc.variants.mobile.sections.length
    );
  });
});
