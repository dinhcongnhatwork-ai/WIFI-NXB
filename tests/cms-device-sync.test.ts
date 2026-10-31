import { describe, expect, it } from 'vitest';
import { clone, copyVariant, createDocument, createNode, flowNode, setNodeMedia } from '../src/lib/template-document';
import { syncDeviceChanges, syncDeviceContent } from '../src/lib/cms/device-sync';

function fixture() {
  const doc = createDocument();
  for (const device of ['mobile', 'tablet', 'desktop'] as const) {
    const title = createNode('title'); title.name = 'Thông điệp';
    Object.assign(title.element, { content: 'Hội nghị', fontSize: device === 'mobile' ? '20px' : '32px' });
    doc.variants[device].sections[0].nodes = [title];
  }
  return doc;
}
describe('device synchronization', () => {
  it('propagates content in one transaction while retaining target identity, font size and layout', () => {
    const before = fixture(), after = clone(before);
    Object.assign(after.variants.mobile.sections[0].nodes[0].element, { content: 'Thông báo mới' });
    const target = clone(before.variants.tablet.sections[0].nodes[0]);
    syncDeviceChanges(before, after, 'mobile', 'content');
    const actual = after.variants.tablet.sections[0].nodes[0];
    expect((actual.element as any).content).toBe('Thông báo mới');
    expect((actual.element as any).fontSize).toBe('32px');
    expect(actual.id).toBe(target.id); expect(actual.layout).toEqual(target.layout);
  });
  it('can synchronize visual style but never dimensions, crop or target media alternatives', () => {
    const before = fixture(), after = clone(before);
    Object.assign(after.variants.mobile.sections[0].nodes[0].element, { color: '#123456', fontSize: '18px', width: '20px' });
    syncDeviceChanges(before, after, 'mobile', 'content-style');
    const el = after.variants.desktop.sections[0].nodes[0].element as any;
    expect(el.color).toBe('#123456'); expect(el.fontSize).toBe('32px'); expect(el.width).toBeUndefined();
  });
  it('does not guess ambiguous duplicate nodes or overwrite locked targets', () => {
    const before = fixture();
    before.variants.tablet.sections[0].nodes.push(clone(before.variants.tablet.sections[0].nodes[0]));
    before.variants.desktop.sections[0].nodes[0].locked = true;
    const after = clone(before); Object.assign(after.variants.mobile.sections[0].nodes[0].element, { content: 'Mới' });
    const result = syncDeviceChanges(before, after, 'mobile', 'content');
    expect(result.updated).toBe(0); expect(result.skipped).toBe(2);
  });
  it('synchronizes gate policy and media references consistently', () => {
    const before = fixture(), after = clone(before);
    const gate = flowNode(after.variants.mobile, 'video_gate')!;
    Object.assign(gate.element, { enabled: true, skipAfter: 12 });
    setNodeMedia(gate, 'videoUrl', '/api/media/videos/new.mp4');
    syncDeviceChanges(before, after, 'mobile', 'content');
    const target = flowNode(after.variants.tablet, 'video_gate')!;
    expect((target.element as any).skipAfter).toBe(12);
    expect(target.media.videoUrl).toEqual(gate.media.videoUrl); expect(target.element.id).toBe(target.id);
  });
  it('supports explicit synchronization and off mode', () => {
    const before = fixture(), after = clone(before);
    Object.assign(after.variants.mobile.sections[0].nodes[0].element, { content: 'Mới' });
    syncDeviceChanges(before, after, 'mobile', 'off');
    expect((after.variants.tablet.sections[0].nodes[0].element as any).content).toBe('Hội nghị');
    expect(syncDeviceContent(after, 'mobile', 'content').updated).toBeGreaterThan(0);
    expect((after.variants.tablet.sections[0].nodes[0].element as any).content).toBe('Mới');
  });
});

describe('responsive variant copying', () => {
  it('fits a desktop freeform section and nested children to mobile without mutating source', () => {
    const doc = fixture(), section = doc.variants.desktop.sections[0];
    section.mode = 'freeform'; section.width = 1440; section.height = 900;
    const node = section.nodes[0]; node.layout = { x: 900, y: 100, width: 400, height: 80, rotation: 0 };
    node.children = [createNode('description')];
    const original = clone(doc);
    const copy = copyVariant(doc, 'desktop', 'mobile', false).variants.mobile.sections[0];
    expect(copy.width).toBe(390);
    expect(copy.nodes[0].layout.x + copy.nodes[0].layout.width).toBeLessThanOrEqual(390);
    expect(copy.nodes[0].children![0].layout.width).toBeLessThan(node.children[0].layout.width);
    expect(doc).toEqual(original);
  });
});
