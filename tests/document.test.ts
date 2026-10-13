import { describe,it,expect } from 'vitest';
import { createDocument,createNode,copyVariant,toDocument,validateDocument,variantForWidth,mediaRef,mediaUrl } from '../src/lib/template-document';
import { createDefaultTemplateConfig } from '../src/types';
import { dragLayout,resizeLayout,magneticLayout,contrastRatio } from '../src/lib/cms/interaction';
describe('document and responsive isolation',()=>{
 it('edits each independent variant and copies without references',()=>{const d=createDocument();d.variants.mobile.sections[0].nodes[1].name='Changed';expect(d.variants.tablet.sections[0].nodes[1].name).not.toBe('Changed');const c=copyVariant(d,'mobile','desktop',false);expect(c.variants.desktop.viewport.width).toBe(1440);expect(c.variants.desktop.sections[0].nodes[1].name).toBe('Changed');expect(c.variants.desktop.sections[0].nodes[1].id).not.toBe(d.variants.mobile.sections[0].nodes[1].id);});
 it.each([[767,'mobile'],[768,'tablet'],[1199,'tablet'],[1200,'desktop']])('classifies %i', (w,d)=>expect(variantForWidth(w as number)).toBe(d));
 it('preserves unknown legacy and old missing uploads',()=>{expect(()=>toDocument({type:'page'})).toThrow();const c=createDefaultTemplateConfig();c.background.imageMobile='/api/uploads/missing.png';expect(mediaUrl(toDocument(c).variants.mobile.backgroundMedia.image)).toBe('/api/uploads/missing.png');});
 it('migrates desktop properties and canvas positions',()=>{const c=createDefaultTemplateConfig();c.elements=[{...createNode('image').element,type:'image',src:'https://example.com/m.png',srcDesktop:'https://example.com/d.png',canvasPosition:{x:50,y:50}} as any];const d=toDocument(c);expect(d.variants.desktop.sections[0].mode).toBe('freeform');expect(mediaUrl(d.variants.desktop.sections[0].nodes[0].media.src)).toContain('/d.png');});
 it('blocks absent connect path and temporary upload URL',()=>{const d=createDocument();d.variants.mobile.sections=[];expect(validateDocument(d).some(i=>i.severity==='error'&&i.variant==='mobile')).toBe(true);expect(mediaRef('/api/media/images/a.png')).toEqual({kind:'object',key:'images/a.png'});});
});
describe('logical drag coordinates',()=>{
 const l={x:40,y:80,width:200,height:100,rotation:0};
 it.each([.25,.5,1,2])('maps scale %f without drift',s=>{expect(dragLayout(l,{x:11*s,y:13*s},s,false)).toEqual({...l,x:51,y:93});expect(resizeLayout(l,{x:20*s,y:0},s,true,false)).toEqual({...l,width:220,height:110});});
 it('snaps edges and center',()=>expect(magneticLayout({...l,x:3},[],{width:400,height:800}).layout.x).toBe(0));
 it('measures palette readability',()=>expect(contrastRatio('#000000','#ffffff')).toBe(21));
});
