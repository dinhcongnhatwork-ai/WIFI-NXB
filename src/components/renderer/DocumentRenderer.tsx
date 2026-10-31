'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { materializeElement, mediaUrl, variantForWidth, screenSurface, flowNode, toDocument, type TemplateDocumentV2, type DeviceVariant, type Viewport, type RenderMode, type DesignNode, type DesignSection, type ScreenId, type PreviewTarget, type GateScreenId, type DecorationElement } from '@/lib/template-document';
import type { PortalParams, TemplateElement, VideoGateElement, AttendanceGateElement, AnnouncementElement } from '@/types';
import { RenderElement, resolveShadowStyle, resolveBorderStyle, applyColorOpacity, buildMediaFilterCss } from './PortalRenderer';
import FlowGate from './FlowGate';
import { presetBackground } from '@/lib/preset-backgrounds';
import { nextFlowScreen, MOCK_ATTENDANCE_SESSION, type AttendanceContext, type SimulationOutcome } from './flow-runtime';

function buildPatternStyle(pattern?: string, color = 'rgba(255,255,255,0.28)', opacity = 0.35): React.CSSProperties | null {
  if (!pattern || pattern === 'none') return null;
  if (pattern === 'dots') {
    return {
      position: 'absolute',
      inset: 0,
      backgroundImage: `radial-gradient(${color} 1.35px, transparent 1.35px)`,
      backgroundSize: '18px 18px',
      opacity,
      pointerEvents: 'none',
    };
  }
  if (pattern === 'grid') {
    return {
      position: 'absolute',
      inset: 0,
      backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      opacity,
      pointerEvents: 'none',
    };
  }
  if (pattern === 'diagonal') {
    return {
      position: 'absolute',
      inset: 0,
      backgroundImage: `repeating-linear-gradient(45deg, ${color} 0, ${color} 1px, transparent 0, transparent 14px)`,
      opacity,
      pointerEvents: 'none',
    };
  }
  if (pattern === 'waves') {
    return {
      position: 'absolute',
      inset: 0,
      backgroundImage: `radial-gradient(circle at 100% 50%, transparent 20%, ${color} 21%, ${color} 34%, transparent 35%, transparent), radial-gradient(circle at 0% 50%, transparent 20%, ${color} 21%, ${color} 34%, transparent 35%, transparent)`,
      backgroundSize: '28px 36px',
      opacity,
      pointerEvents: 'none',
    };
  }
  return null;
}

function renderDecorationElement(element: DecorationElement): React.ReactNode {
  if (element.type === 'divider') {
    const divStyle = element.dividerStyle || 'solid';
    const widthPct = element.widthPercent !== undefined ? `${element.widthPercent}%` : '100%';
    if (divStyle === 'gradient-fade') {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: element.opacity ?? 1 }}>
          <div
            style={{
              width: widthPct,
              height: element.thickness ? `${element.thickness}px` : '100%',
              background: `linear-gradient(90deg, transparent 0%, ${element.color || '#cbd5e1'} 50%, transparent 100%)`,
              borderRadius: element.borderRadius,
            }}
          />
        </div>
      );
    }
    if (divStyle === 'dashed' || divStyle === 'dotted') {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: element.opacity ?? 1 }}>
          <div
            style={{
              width: widthPct,
              height: 0,
              borderTop: `${element.thickness || 2}px ${divStyle} ${element.color || '#cbd5e1'}`,
            }}
          />
        </div>
      );
    }
    return (
      <div
        style={{
          width: widthPct,
          height: element.thickness ? `${element.thickness}px` : '100%',
          margin: '0 auto',
          background: element.gradient || element.color,
          borderRadius: element.borderRadius,
          opacity: element.opacity ?? 1,
        }}
      />
    );
  }

  let radius = element.borderRadius;
  if (element.shapeVariant === 'circle' || element.shapeVariant === 'pill') radius = '9999px';
  else if (element.shapeVariant === 'arch') radius = '9999px 9999px 16px 16px';

  const bgValue = element.gradient || applyColorOpacity(element.color, element.opacity) || element.color;
  const bgImg = element.backgroundImage ? `url(${JSON.stringify(element.backgroundImage)})` : undefined;
  const borderCss =
    element.borderStyle && element.borderStyle !== 'none'
      ? resolveBorderStyle(element.borderStyle, element.borderWidth, element.borderColor)
      : undefined;
  const shadowCss = element.shadow && element.shadow !== 'none' ? resolveShadowStyle(element.shadow) : undefined;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: !element.gradient ? bgValue : undefined,
        backgroundImage: bgImg && element.gradient ? `${bgImg}, ${element.gradient}` : bgImg || element.gradient,
        backgroundSize: bgImg
          ? element.backgroundSize === 'repeat'
            ? 'auto'
            : element.backgroundSize === 'fill'
            ? '100% 100%'
            : element.backgroundSize || 'cover'
          : undefined,
        backgroundRepeat: bgImg ? (element.backgroundSize === 'repeat' ? 'repeat' : 'no-repeat') : undefined,
        backgroundPosition: bgImg ? element.backgroundPosition || 'center center' : undefined,
        borderRadius: radius,
        backdropFilter: element.backdropBlur ? `blur(${element.backdropBlur}px)` : undefined,
        border: borderCss && borderCss !== 'none' ? borderCss : undefined,
        boxShadow: shadowCss && shadowCss !== 'none' ? shadowCss : undefined,
      }}
    />
  );
}

interface Props {
  document: TemplateDocumentV2; variant?: DeviceVariant; viewport?: Viewport; mode?: RenderMode;
  screen?: ScreenId; previewTarget?: PreviewTarget; attendanceContext?: AttendanceContext; portalSessionId?: string;
  params?: Partial<PortalParams>; campaignId?: string; redirectUrl?: string; editHref?: string;
  renderNodeOverlay?: (node: DesignNode, section: DesignSection) => React.ReactNode;
  onConnectionStart?: () => void;
  onSelectNode?: (nodeId: string | null, sectionId?: string | null) => void;
  selectedNodeId?: string | null;
}
export default function DocumentRenderer({ document, variant, viewport, mode = 'live', screen = 'portal', previewTarget = 'flow', attendanceContext, portalSessionId, params = {}, campaignId, redirectUrl, editHref, renderNodeOverlay, onSelectNode, selectedNodeId, onConnectionStart }: Props) {
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
    const autoCore=core&&!absolute;
    const mediaHeight=['image','image_slider','video','container','shape','divider','spacer'].includes(element.type);
    if(element.type==='image'){element.width='100%';element.height=`${node.layout.height}px`;}
    if(element.type==='image_slider'||element.type==='spacer') { element.height=`${node.layout.height}px`; element.heightDesktop=element.height; }
    if(element.type==='logo'&&!element.src&&mode==='edit') { element.height=`${Math.max(64, node.layout.height)}px`; }
    const gate = core?flowNode(design,element.screen):undefined;
    return <div key={node.id} data-node-id={node.id} data-section-id={section.id} aria-selected={mode==='edit'?selectedNodeId===node.id:undefined} onClick={mode==='edit'?event=>{event.stopPropagation();onSelectNode?.(node.id,section.id);}:undefined} style={{position:absolute?'absolute':'relative',zIndex:mode==='edit'&&nested?31:undefined,left:absolute?node.layout.x:undefined,top:absolute?node.layout.y:undefined,width:node.layout.width,maxWidth:absolute?undefined:'100%',alignSelf:!absolute&&node.grid&&mediaHeight?'center':undefined,gridColumn:!absolute&&node.grid?`${node.grid.column} / span ${node.grid.columnSpan||1}`:undefined,gridRow:!absolute&&node.grid?`${node.grid.row} / span ${node.grid.rowSpan||1}`:undefined,height:absolute||mediaHeight||core&&!autoCore?node.layout.height:'auto',minWidth:0,transform:`rotate(${node.layout.rotation}deg)`,overflowWrap:'anywhere'}}>
      <div style={{pointerEvents:mode==='edit'?'none':undefined,height:absolute||mediaHeight||core&&!autoCore?'100%':undefined}}>
        {core&&gate ? <FlowGate key={`${element.screen}-${device}-${restart}`} element={materializeElement(gate) as VideoGateElement|AttendanceGateElement|AnnouncementElement} screen={element.screen} mode={mode} params={params} portalSessionId={portalSessionId} attendanceContext={context} isDesktop={device!=='mobile'} outcome={outcome} autoHeight={autoCore} onDone={()=>finish(element.screen)} onResult={setResult} /> : element.type==='container'||element.type==='shape'||element.type==='divider'?renderDecorationElement(element):<RenderElement element={element as TemplateElement} params={params} isPreview={mode!=='live'} isDesktop={device!=='mobile'} campaignId={campaignId} redirectUrl={redirectUrl} portalSessionId={portalSessionId} autoPlayTrigger={mode!=='edit'&&activeScreen==='portal'?1:0} onSimulateConnect={mode==='simulate'?simulateConnect:undefined} onConnectionStart={onConnectionStart} />}
      </div>
      {renderNodeOverlay?.(node,section)}
      {node.children?.map(child=>nodeView(child,section,true,true))}
    </div>;
  }
  const bg=surface.background;const storedImage=mediaUrl(surface.backgroundMedia.image);const bundledBackground=presetBackground(storedImage,device);const image=bundledBackground||storedImage;const video=mediaUrl(surface.backgroundMedia.video);
  const surfaceGradient = bg.bgMode === 'gradient'
    ? (bg.gradient || (bg.gradientFrom || bg.gradientTo
        ? `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.gradientFrom || bg.color || '#0f172a'} 0%, ${bg.gradientVia ? `${bg.gradientVia} 50%, ` : ''}${bg.gradientTo || '#2563eb'} 100%)`
        : undefined))
    : undefined;
  const bgFilterCss = buildMediaFilterCss({
    blur: bg.imageBlur,
    brightness: bg.brightness,
    contrast: bg.contrast,
    saturate: bg.saturate,
    grayscale: bg.grayscale,
  });
  const patternStyle = buildPatternStyle(bg.pattern, bg.patternColor, bg.patternOpacity);
  const overlayBg = bg.overlayMode === 'gradient'
    ? (bg.overlayGradientDirection === 'to-t'
        ? `linear-gradient(0deg, ${bg.overlayColor || '#000000'} 0%, ${bg.overlayGradientTo || 'rgba(0,0,0,0.05)'} 100%)`
        : bg.overlayGradientDirection === 'radial'
        ? `radial-gradient(circle at center, ${bg.overlayGradientTo || 'rgba(0,0,0,0.05)'} 10%, ${bg.overlayColor || '#000000'} 100%)`
        : `linear-gradient(180deg, ${bg.overlayGradientTo || 'rgba(0,0,0,0.08)'} 0%, ${bg.overlayColor || '#000000'} 100%)`)
    : bg.overlayColor;

  return <div ref={root} className="portal-page" data-render-mode={mode} data-device-variant={device} data-screen={activeScreen} style={{position:'relative',width:'100%',padding:bg.pagePadding||undefined,boxSizing:'border-box',minHeight:viewport?.height || '100dvh',isolation:'isolate',display:device==='desktop'?'flex':'block',flexDirection:device==='desktop'?'column':undefined,justifyContent:device==='desktop'?'center':undefined}}>
    <div style={{position:'absolute',inset:0,zIndex:0,pointerEvents:'none',overflow:'hidden',backgroundColor:bg.color||'#0f172a',backgroundImage:surfaceGradient}}>
      {image && (
        <div
          data-portal-background={bundledBackground ? 'preset' : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${image}")`,
            backgroundSize: bundledBackground ? 'cover' : bg.type === 'repeat' ? 'auto' : bg.type === 'fill' ? '100% 100%' : (bg.type || 'cover'),
            backgroundRepeat: !bundledBackground && bg.type === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundPosition: `${bg.focalX ?? 50}% ${bg.focalY ?? 50}%`,
            filter: bgFilterCss,
            transform: bg.imageBlur && bg.imageBlur > 0 ? 'scale(1.06)' : undefined,
          }}
        />
      )}
      {video && (
        <video
          src={video}
          autoPlay={mode !== 'edit'}
          muted
          loop
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: bg.type === 'contain' ? 'contain' : 'cover',
            objectPosition: `${bg.focalX ?? 50}% ${bg.focalY ?? 50}%`,
          }}
        />
      )}
      {patternStyle && <div style={patternStyle} />}
      {bg.overlayOpacity && bg.overlayOpacity > 0 ? (
        <div style={{position:'absolute',inset:0,background:overlayBg,opacity:bg.overlayOpacity}}/>
      ) : null}
    </div>
    {mode!=='edit'&&(disabled||inactiveMeeting)?<div role="status" style={{padding:32,textAlign:'center',color:'#0f172a',background:'#fff'}}>{disabled?'Màn hình này đang tắt. Bật màn hình trong trình chỉnh sửa để chạy thử.':'Không có cuộc họp cần điểm danh.'}{editHref&&<p><a href={editHref}>Trở lại chỉnh sửa màn hình</a></p>}</div>:surface.sections.filter(section=>!section.hidden).map(section=>{
      const scale=section.mode==='freeform'?width/section.width:1;
      const hasCardStyle = Boolean(section.backgroundImage || section.gradient || section.backdropBlur || section.borderRadius || (section.borderStyle && section.borderStyle !== 'none') || section.borderColor || (section.shadow && section.shadow !== 'none') || (section.bgOpacity !== undefined && section.bgOpacity < 1));
      const sectionBg = section.gradient || applyColorOpacity(section.background, section.bgOpacity) || section.background;
      const sectionBgImg = section.backgroundImage ? `url(${JSON.stringify(section.backgroundImage)})` : undefined;
      const sectionBorder = section.borderStyle && section.borderStyle !== 'none'
        ? resolveBorderStyle(section.borderStyle, section.borderWidth || 1, section.borderColor)
        : section.borderColor
        ? resolveBorderStyle('solid', section.borderWidth || 1, section.borderColor)
        : undefined;
      const sectionShadow = section.shadow && section.shadow !== 'none' ? resolveShadowStyle(section.shadow) : undefined;
      const padValue = section.paddingY !== undefined || section.paddingX !== undefined
        ? `${section.paddingY ?? section.padding}px ${section.paddingX ?? section.padding}px`
        : section.padding;
      const maxW = section.maxWidth ? `${section.maxWidth}px` : (device==='desktop'?'720px':device==='tablet'?'600px':'100%');
      const cardBgStyle: React.CSSProperties = {
        backgroundColor: !section.gradient ? sectionBg : undefined,
        backgroundImage: sectionBgImg && section.gradient ? `${sectionBgImg}, ${section.gradient}` : sectionBgImg || section.gradient,
        backgroundSize: sectionBgImg
          ? section.backgroundSize === 'repeat'
            ? 'auto'
            : section.backgroundSize === 'fill'
            ? '100% 100%'
            : section.backgroundSize || 'cover'
          : undefined,
        backgroundRepeat: sectionBgImg ? (section.backgroundSize === 'repeat' ? 'repeat' : 'no-repeat') : undefined,
        backgroundPosition: sectionBgImg ? section.backgroundPosition || 'center center' : undefined,
      };
      return <section key={`${activeScreen}-${section.id}`} data-design-section={section.id} data-section-id={section.id} data-section-scale={scale} style={{position:'relative',zIndex:1,width:'100%',height:section.mode==='freeform'?section.height*scale:undefined,background:hasCardStyle && section.mode !== 'freeform' ? 'transparent' : sectionBg}}>
        <div style={section.mode==='freeform'?{position:'relative',width:section.width,height:section.height,transform:`scale(${scale})`,transformOrigin:'top left',backdropFilter:section.backdropBlur?`blur(${section.backdropBlur}px)`:undefined,borderRadius:section.borderRadius,border:sectionBorder,boxShadow:sectionShadow,...(hasCardStyle?cardBgStyle:{})}:{display:'grid',gridTemplateColumns:`repeat(${section.columns}, minmax(0, 1fr))`,gap:section.gap,padding:padValue,justifyItems:section.align,boxSizing:'border-box',maxWidth:maxW,margin:'0 auto',...(hasCardStyle?cardBgStyle:{}),backdropFilter:section.backdropBlur?`blur(${section.backdropBlur}px)`:undefined,borderRadius:section.borderRadius,border:sectionBorder,boxShadow:sectionShadow}}>{section.nodes.map(node=>nodeView(node,section,section.mode==='freeform'))}</div>
      </section>;
    })}
    {mode==='simulate'&&<div style={{position:'sticky',bottom:0,zIndex:60,padding:10,borderRadius:8,background:'#fff',color:'#0f172a',fontSize:12,boxShadow:'0 2px 12px #0003'}}>
      <label>Kết quả mô phỏng <select value={outcome} onChange={event=>{setOutcome(event.target.value as SimulationOutcome);setResult('');}}><option value="success">Thành công</option><option value="error">Lỗi</option><option value="wait">Chờ</option></select></label>{' '}<button type="button" onClick={()=>setRestart(n=>n+1)}>Bắt đầu lại</button>
      {result&&<p role="status">{result}</p>}
    </div>}
  </div>;
}
