import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { TEMPLATE_PRESETS, createPresetDocument } from '../src/lib/template-presets';
import { allNodes, DEVICE_KEYS, GATE_SCREENS, flowNode, screenSurface, validateDocument } from '../src/lib/template-document';
import { normalizeDraft, validatePublish } from '../src/lib/template-publishing';

function localAssets(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith('/nxb-templates/') ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(localAssets);
  if (value && typeof value === 'object') return Object.values(value).flatMap(localAssets);
  return [];
}
function documentIds(document: ReturnType<typeof createPresetDocument>) {
  return DEVICE_KEYS.flatMap(device => {
    const v = document.variants[device];
    return [...allNodes(v).map(n => n.id), ...[v, ...GATE_SCREENS.map(s => screenSurface(v, s))].flatMap(s => s.sections.map(section => section.id))];
  });
}

describe('local starter templates for NXB Sự Thật', () => {
  test('offers exactly five named ready-to-use starter designs', () => {
    expect(TEMPLATE_PRESETS.map(p => p.name)).toEqual(['Mẫu 1', 'Mẫu 2', 'Mẫu 3', 'Mẫu 4', 'Mẫu 5']);
    expect(new Set(TEMPLATE_PRESETS.map(p => p.id)).size).toBe(5);
  });

  test.each([0, 1, 2, 3, 4])('preset %i is valid for draft and publication with every gate enabled', index => {
    const presetId = TEMPLATE_PRESETS[index].id;
    const document = createPresetDocument(presetId);
    expect(validateDocument(document)).toEqual([]);
    expect(() => normalizeDraft(document)).not.toThrow();
    expect(() => validatePublish(document)).not.toThrow();
    for (const device of DEVICE_KEYS) {
      const variant = document.variants[device];
      expect(variant.sections.flatMap(s => s.nodes).some(n => n.element.type === 'connect_button' && n.element.enabled)).toBe(true);
      for (const screen of GATE_SCREENS) {
        const controller = flowNode(variant, screen)!;
        const expectedDefault =
          (presetId === 'van-hoa-doc' && screen === 'announcement') ||
          (presetId === 'xuat-ban-so' && screen === 'video_gate') ||
          (presetId === 'hoi-nghi' && screen === 'attendance_gate') ||
          (presetId === 'trien-lam' && screen === 'announcement');
        expect(controller.element.enabled).toBe(expectedDefault);
        controller.element.enabled = true;
        const cores = screenSurface(variant, screen).sections.flatMap(s => s.nodes).filter(n => n.element.type === 'flow_content' && !n.hidden && n.element.enabled);
        expect(cores).toHaveLength(1);
        expect(cores[0].element).toMatchObject({ screen });
      }
    }
    expect(validateDocument(document)).toEqual([]);
    expect(() => validatePublish(document)).not.toThrow();
  });

  test('each selection is isolated and receives fresh IDs throughout all screens and variants', () => {
    const first = createPresetDocument('van-hoa-doc');
    const untouched = JSON.stringify(createPresetDocument('van-hoa-doc'));
    const second = createPresetDocument('van-hoa-doc');
    const firstIds = documentIds(first);
    const secondIds = documentIds(second);
    expect(new Set(firstIds).size).toBe(firstIds.length);
    expect(firstIds.some(id => secondIds.includes(id))).toBe(false);
    first.variants.mobile.sections[0].nodes[0].name = 'changed';
    first.variants.mobile.screens!.attendance_gate!.background.color = '#ff0000';
    expect(JSON.stringify(second)).not.toContain('changed');
    expect(second.variants.mobile.screens!.attendance_gate!.background.color).not.toBe('#ff0000');
    expect(untouched).not.toContain('changed');
    expect(() => createPresetDocument('unknown')).toThrow();
  });

  test('all media and thumbnails are packaged locally and video files are real MP4s', () => {
    const urls = new Set(TEMPLATE_PRESETS.flatMap(p => [p.thumbnail, ...localAssets(createPresetDocument(p.id))]));
    expect(urls.size).toBeGreaterThan(10);
    for (const url of Array.from(urls)) expect(existsSync(path.join(process.cwd(), 'public', url)), url).toBe(true);
    for (const preset of TEMPLATE_PRESETS) {
      const serialized = JSON.stringify(createPresetDocument(preset.id));
      expect(serialized).toContain('/nxb-templates/logo-nxb-su-that.png');
      expect(existsSync(path.join(process.cwd(), 'public', preset.thumbnail))).toBe(true);
    }
    for (const orientation of ['portrait', 'landscape']) {
      const file = readFileSync(path.join(process.cwd(), `public/nxb-templates/video-nxb-${orientation}.mp4`));
      expect(file.subarray(4, 8).toString()).toBe('ftyp');
      expect(file.length).toBeGreaterThan(1000);
    }
  });

  test('van-hoa-doc and xuat-ban-so contain editable image sliders and xuat-ban-so has portrait video gate', () => {
    for (const preset of ['van-hoa-doc', 'xuat-ban-so']) {
      for (const device of DEVICE_KEYS) {
        const v = createPresetDocument(preset).variants[device];
        const slider = allNodes(v).find(n => n.element.type === 'image_slider')!;
        expect(slider.element).toMatchObject({ images: expect.arrayContaining([expect.objectContaining({ src: expect.stringMatching(/^\/nxb-templates\//) })]) });
      }
    }
    for (const device of DEVICE_KEYS) {
      expect(flowNode(createPresetDocument('xuat-ban-so').variants[device], 'video_gate')!.element).toMatchObject({ aspectRatio: '9:16', videoUrl: '/nxb-templates/video-nxb-portrait.mp4' });
      expect(flowNode(createPresetDocument('van-hoa-doc').variants[device], 'video_gate')!.element).toMatchObject({ aspectRatio: '16:9', videoUrl: '/nxb-templates/video-nxb-landscape.mp4' });
    }
  });

  test('presets use contained editorial images without a tall mobile poster', () => {
    for (const preset of TEMPLATE_PRESETS) {
      const doc = createPresetDocument(preset.id);
      const mobileVariant = doc.variants.mobile;
      const slider = allNodes(mobileVariant).find(n => n.element.type === 'image_slider')!;
      const element = slider.element as unknown as { height?: string; images?: Array<{ src: string }> };
      expect(slider.layout.height).toBe(224);
      expect(element.height).toBe('224px');
      for (const img of element.images || []) {
        expect(img.src).toMatch(/\.jpg$/);
        expect(img.src).not.toMatch(/-portrait\.jpg$/);
      }
    }
  });

  test('diverse templates have appropriate gates enabled by default', () => {
    const doc1 = createPresetDocument('van-hoa-doc');
    expect(flowNode(doc1.variants.mobile, 'announcement')!.element.enabled).toBe(true);

    const doc2 = createPresetDocument('xuat-ban-so');
    expect(flowNode(doc2.variants.mobile, 'video_gate')!.element.enabled).toBe(true);

    const doc3 = createPresetDocument('hoi-nghi');
    expect(flowNode(doc3.variants.mobile, 'attendance_gate')!.element.enabled).toBe(true);

    const doc4 = createPresetDocument('trien-lam');
    expect(flowNode(doc4.variants.mobile, 'announcement')!.element.enabled).toBe(true);

    const doc5 = createPresetDocument('ly-luan-chinh-tri');
    expect(flowNode(doc5.variants.mobile, 'announcement')!.element.enabled).toBe(false);
    expect(flowNode(doc5.variants.mobile, 'video_gate')!.element.enabled).toBe(false);
    expect(flowNode(doc5.variants.mobile, 'attendance_gate')!.element.enabled).toBe(false);
  });
});
