'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { materializeElement, mediaUrl, variantForWidth, screenSurface, flowNode, toDocument, type TemplateDocumentV2, type DeviceVariant, type Viewport, type RenderMode, type DesignNode, type DesignSection, type ScreenId, type PreviewTarget, type GateScreenId } from '@/lib/template-document';
import type { PortalParams, TemplateElement, VideoGateElement, AttendanceGateElement, AnnouncementElement } from '@/types';
import { RenderElement } from './PortalRenderer';
import FlowGate from './FlowGate';
import { nextFlowScreen, MOCK_ATTENDANCE_SESSION, type AttendanceContext, type SimulationOutcome } from './flow-runtime';

interface Props {
  document: TemplateDocumentV2; variant?: DeviceVariant; viewport?: Viewport; mode?: RenderMode;
  screen?: ScreenId; previewTarget?: PreviewTarget; attendanceContext?: AttendanceContext; portalSessionId?: string;
  params?: Partial<PortalParams>; campaignId?: string; redirectUrl?: string; editHref?: string;
  renderNodeOverlay?: (node: DesignNode, section: DesignSection) => React.ReactNode;
  onSelectNode?: (nodeId: string | null, sectionId?: string | null) => void;
  selectedNodeId?: string | null;
}
export default function DocumentRenderer({ document, variant, viewport, mode = 'live', screen = 'portal', previewTarget = 'flow', attendanceContext, portalSessionId, params = {}, campaignId, redirectUrl, editHref, renderNodeOverlay, onSelectNode, selectedNodeId }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [width,setWidth] = useState(viewport?.width || 390);
  const [completed,setCompleted] = useState<GateScreenId[]>([]);
  const [outcome,setOutcome] = useState<SimulationOutcome>('success');
  const [result,setResult] = useState(''); const [restart,setRestart] = useState(0);
  const normalized = useMemo(()=>toDocument(document),[document]);
  const device = variant || variantForWidth(width);
  useEffect(()=>{
    const el=root.current;if(!el)return;
    const update=()=>setWidth(viewport?.width || el.clientWidth);update();
    if (typeof ResizeObserver==='undefined') return;
    const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
  },[viewport?.width]);
  useEffect(()=>{setCompleted([]);setResult('');},[device,mode,previewTarget,portalSessionId,restart]);
  const design = normalized.variants[device];
  const context = attendanceContext || (mode==='simulate'?{session:MOCK_ATTENDANCE_SESSION,isAlreadyRegistered:false}:undefined);
  const activeScreen:ScreenId = mode==='edit'?screen:mode==='simulate'&&previewTarget!=='flow'?previewTarget:nextFlowScreen(design,completed,context);
  const surface = screenSurface(design,activeScreen);
  const controller = activeScreen==='portal'?undefined:flowNode(design,activeScreen);
  const disabled = activeScreen!=='portal'&&(!controller || controller.hidden || !controller.element.enabled);
  const inactiveMeeting = mode!=='edit'&&activeScreen==='attendance_gate'&&(!context || context.session.status!=='ACTIVE'||context.isAlreadyRegistered);
  function finish(gate:GateScreenId) {setCompleted(previous=>previous.includes(gate)?previous:[...previous,gate]);setResult(mode==='simulate'&&previewTarget!=='flow'?'Màn hình đã hoàn tất (mô phỏng).':'');}
  function simulateConnect() {setResult(outcome==='success'?'Đã kết nối thành công (mô phỏng).':outcome==='error'?'Không thể kết nối. Hãy thử lại (mô phỏng).':'Đang chờ kết nối (mô phỏng)…');}
  function nodeView(node:DesignNode,section:DesignSection,absolute:boolean,nested=false):React.ReactNode {
    if(node.hidden || !node.element.enabled)return null;
    if (['video_gate','attendance_gate','announcement'].includes(node.element.type)) return null;
    const element=materializeElement(node);
    const core=element.type==='flow_content';
    const mediaHeight=['image','image_slider','video','container','shape','divider','spacer'].includes(element.type);
    if(element.type==='image'){element.width='100%';element.height=`${node.layout.height}px`;}
    if(element.type==='image_slider'||element.type==='spacer') element.height=`${node.layout.height}px`;
    const gate = core?flowNode(design,element.screen):undefined;
    return <div key={node.id} data-node-id={node.id} data-section-id={section.id} aria-selected={mode==='edit'?selectedNodeId===node.id:undefined} onClick={mode==='edit'?event=>{event.stopPropagation();onSelectNode?.(node.id,section.id);}:undefined} style={{position:absolute?'absolute':'relative',zIndex:mode==='edit'&&nested?31:undefined,left:absolute?node.layout.x:undefined,top:absolute?node.layout.y:undefined,width:node.layout.width,maxWidth:absolute?undefined:'100%',height:absolute||mediaHeight||core?node.layout.height:'auto',minWidth:0,transform:`rotate(${node.layout.rotation}deg)`,overflowWrap:'anywhere'}}>
      <div style={{pointerEvents:mode==='edit'?'none':undefined,height:absolute||mediaHeight||core?'100%':undefined}}>
        {core&&gate ? <FlowGate key={`${element.screen}-${device}-${restart}`} element={materializeElement(gate) as VideoGateElement|AttendanceGateElement|AnnouncementElement} screen={element.screen} mode={mode} params={params} portalSessionId={portalSessionId} attendanceContext={context} isDesktop={device!=='mobile'} outcome={outcome} onDone={()=>finish(element.screen)} onResult={setResult} /> : element.type==='container'||element.type==='shape'||element.type==='divider'?<div style={{width:'100%',height:'100%',background:element.color,borderRadius:element.borderRadius}}/>:<RenderElement element={element as TemplateElement} params={params} isPreview={mode!=='live'} isDesktop={device!=='mobile'} campaignId={campaignId} redirectUrl={redirectUrl} portalSessionId={portalSessionId} autoPlayTrigger={mode!=='edit'&&activeScreen==='portal'?1:0} onSimulateConnect={mode==='simulate'?simulateConnect:undefined} />}
      </div>
      {renderNodeOverlay?.(node,section)}
      {node.children?.map(child=>nodeView(child,section,true,true))}
    </div>;
  }
  const bg=surface.background;const image=mediaUrl(surface.backgroundMedia.image);const video=mediaUrl(surface.backgroundMedia.video);
  return <div ref={root} className="portal-page" data-render-mode={mode} data-device-variant={device} data-screen={activeScreen} style={{position:'relative',width:'100%',minHeight:viewport?.height || '100vh',backgroundColor:bg.color,isolation:'isolate'}}>
    <div style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',backgroundImage:image?`url(${JSON.stringify(image)})`:undefined,backgroundSize:bg.type||'cover',backgroundPosition:`${bg.focalX}% ${bg.focalY}%`}}>
      {video&&<video src={video} autoPlay={mode!=='edit'} muted loop playsInline style={{width:'100%',height:'100%',objectFit:bg.type as 'cover'|'contain',objectPosition:`${bg.focalX}% ${bg.focalY}%`}}/>}
      <div style={{position:'absolute',inset:0,background:bg.overlayColor,opacity:bg.overlayOpacity}}/>
    </div>
    {mode!=='edit'&&(disabled||inactiveMeeting)?<div role="status" style={{padding:32,textAlign:'center',color:'#0f172a',background:'#fff'}}>{disabled?'Màn hình này đang tắt. Bật màn hình trong trình chỉnh sửa để chạy thử.':'Không có cuộc họp cần điểm danh.'}{editHref&&<p><a href={editHref}>Trở lại chỉnh sửa màn hình</a></p>}</div>:surface.sections.filter(section=>!section.hidden).map(section=>{
      const scale=section.mode==='freeform'?width/section.width:1;
      return <section key={`${activeScreen}-${section.id}`} data-design-section={section.id} data-section-id={section.id} data-section-scale={scale} style={{position:'relative',width:'100%',height:section.mode==='freeform'?section.height*scale:undefined,background:section.background}}>
        <div style={section.mode==='freeform'?{position:'relative',width:section.width,height:section.height,transform:`scale(${scale})`,transformOrigin:'top left'}:{display:'grid',gridTemplateColumns:`repeat(${section.columns}, minmax(0, 1fr))`,gap:section.gap,padding:section.padding,justifyItems:section.align,boxSizing:'border-box',maxWidth:device==='desktop'?'720px':device==='tablet'?'600px':'100%',margin:'0 auto'}}>{section.nodes.map(node=>nodeView(node,section,section.mode==='freeform'))}</div>
      </section>;
    })}
    {mode==='simulate'&&<div style={{position:'sticky',bottom:0,zIndex:60,padding:10,borderRadius:8,background:'#fff',color:'#0f172a',fontSize:12,boxShadow:'0 2px 12px #0003'}}>
      <label>Kết quả mô phỏng <select value={outcome} onChange={event=>{setOutcome(event.target.value as SimulationOutcome);setResult('');}}><option value="success">Thành công</option><option value="error">Lỗi</option><option value="wait">Chờ</option></select></label>{' '}<button type="button" onClick={()=>setRestart(n=>n+1)}>Bắt đầu lại</button>
      {result&&<p role="status">{result}</p>}
    </div>}
  </div>;
}
