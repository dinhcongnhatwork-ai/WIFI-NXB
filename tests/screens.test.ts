import { describe, it, expect } from 'vitest';
import { createDocument, copyVariant, validateDocument, toDocument, createNode, allNodes } from '../src/lib/template-document';
import { normalizeDraft } from '../src/lib/template-publishing';

describe('editable gate screens', () => {
  it('prepares three independent gate canvases without enabling live gates', () => {
    const document = createDocument();
    for (const variant of Object.values(document.variants)) {
      const screens = (variant as any).screens;
      expect(screens).toBeDefined();
      for (const screen of ['video_gate', 'attendance_gate', 'announcement']) {
        const nodes = screens[screen].sections.flatMap((s: any) => s.nodes);
        expect(nodes.filter((n: any) => n.element.type === 'flow_content' && n.element.screen === screen && !n.hidden)).toHaveLength(1);
      }
    }
  });
  it('copies gate canvases without sharing nodes or reusing IDs', () => {
    const document = createDocument();
    const screen = (document.variants.mobile as any).screens?.announcement;
    expect(screen).toBeDefined();
    screen.sections[0].nodes.push(createNode('description'));
    const copied = copyVariant(document, 'mobile', 'desktop', false);
    const mobile = allNodes(copied.variants.mobile);
    const desktop = allNodes(copied.variants.desktop);
    expect(desktop.some(n => mobile.some(m => m.id === n.id))).toBe(false);
    expect((copied.variants.desktop as any).screens.announcement.sections[0].nodes).toHaveLength(2);
  });
  it('rejects malformed screen geometry and a missing functional block', () => {
    const document = createDocument();
    const screen = (document.variants.mobile as any).screens?.announcement;
    expect(screen).toBeDefined();
    screen.sections[0].nodes[0].layout.width = -1;
    expect(() => normalizeDraft(document)).toThrow();
    screen.sections[0].nodes = [];
    expect(validateDocument(document).some(i => i.severity === 'error' && i.message.includes('chức năng'))).toBe(true);
  });
  it('canonicalizes old section gates without mutating their stored document', () => {
    const document = createDocument();
    delete (document.variants.mobile as any).screens;
    document.variants.mobile.flow = {};
    const gate = createNode('announcement');
    document.variants.mobile.sections[0].nodes.push(gate);
    const original = JSON.stringify(document);
    const migrated = toDocument(document);
    expect(migrated.variants.mobile.flow.announcement?.id).toBe(gate.id);
    expect(migrated.variants.mobile.sections[0].nodes.some(n => n.id === gate.id)).toBe(false);
    expect(JSON.stringify(document)).toBe(original);
  });
  it('rejects a functional block hidden by an ancestor', () => {
    const document = createDocument();
    const screen = document.variants.mobile.screens!.attendance_gate!;
    const parent = createNode('container');
    parent.hidden = true; parent.children = screen.sections[0].nodes;
    screen.sections[0].nodes = [parent];
    expect(validateDocument(document).some(i => i.message.includes('chức năng'))).toBe(true);
  });
  it('appends decorations without duplicating a nested functional block', () => {
    const document = createDocument();
    const screen = document.variants.mobile.screens!.announcement!;
    const parent = createNode('container'); parent.children = screen.sections[0].nodes;
    screen.sections[0].nodes = [parent];
    const appended = copyVariant(document, 'mobile', 'desktop', true);
    const nodes = allNodes(appended.variants.desktop).filter(n => n.element.type === 'flow_content' && n.element.screen === 'announcement');
    expect(nodes).toHaveLength(1);
  });
});
