import { describe, expect, it } from 'vitest';
import { createPresetDocument, TEMPLATE_PRESETS } from '../src/lib/template-presets';
import { allNodes, DEVICE_KEYS, GATE_SCREENS, screenSurface, validateDocument, createNode } from '../src/lib/template-document';

describe('production starter redesign', () => {
  it.each(TEMPLATE_PRESETS.map(p=>p.id))('%s is readable and publishes across every screen/device', id => {
    const doc=createPresetDocument(id);
    for(const device of DEVICE_KEYS){
      const variant=doc.variants[device];
      const section=variant.sections[0];
      expect(section.columns).toBe(device==='desktop'?2:1);
      for(const node of section.nodes){
        const el=node.element as unknown as Record<string,string>;
        if(el.type==='title'||el.type==='description'){
          expect(parseFloat(el.fontSize)).toBeGreaterThanOrEqual(12);
          expect(el.textShadow).toBe('none');
        }
        if(el.type==='connect_button'){
          expect(node.layout.height).toBeGreaterThanOrEqual(48);
          expect(el.buttonEffect).toBe('none');
          expect(el.buttonStyle).toBe('solid');
        }
        if(el.type==='image_slider')expect(el.objectFit).toBe('contain');
      }
      for(const screen of GATE_SCREENS){
        const surface=screenSurface(variant,screen);
        expect(surface.sections[0].maxWidth).toBeLessThanOrEqual(680);
      }
    }
    expect(validateDocument(doc)).toEqual([]);
  });
  it('keeps real missing-media errors, identifying only the three added PC nodes',()=>{
    const doc=createPresetDocument('trien-lam');
    doc.variants.desktop.sections[0].nodes.push(createNode('logo'),createNode('image'),createNode('image'));
    const errors=validateDocument(doc).filter(i=>i.severity==='error');
    expect(errors).toHaveLength(3);
    expect(errors.every(i=>i.variant==='desktop'&&i.nodeId)).toBe(true);
  });
});

import { issueLocation } from '../src/lib/cms/issue-location';
it('takes a publish error to its exact screen, device and section',()=>{
  const doc=createPresetDocument('trien-lam');
  const surface=screenSurface(doc.variants.desktop,'announcement');
  const node=createNode('image');surface.sections[0].nodes.push(node);
  const issue=validateDocument(doc).find(i=>i.nodeId===node.id)!;
  expect(issueLocation(doc,issue)).toEqual({device:'desktop',screen:'announcement',sectionId:surface.sections[0].id,nodeId:node.id});
});
it('rejects invalid grid values without weakening publishing validation',()=>{
  const doc=createPresetDocument('trien-lam');
  doc.variants.desktop.sections[0].nodes[0].grid={column:-1,row:1};
  expect(validateDocument(doc).some(i=>i.severity==='error'&&i.message.includes('lưới'))).toBe(true);
});
