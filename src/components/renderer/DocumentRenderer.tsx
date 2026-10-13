'use client';

import React, { useEffect, useRef, useState } from 'react';
import { materializeElement, mediaUrl, variantForWidth, type TemplateDocumentV2, type DeviceVariant, type Viewport, type RenderMode, type DesignNode, type DesignSection } from '@/lib/template-document';
import type { PortalParams, TemplateElement, VideoGateElement, AnnouncementElement } from '@/types';
import { RenderElement, VideoGateRenderer, AnnouncementRenderer } from './PortalRenderer';

interface Props {
  document: TemplateDocumentV2; variant?: DeviceVariant; viewport?: Viewport; mode?: RenderMode;
  params?: Partial<PortalParams>; campaignId?: string; redirectUrl?: string;
  renderNodeOverlay?: (node: DesignNode, section: DesignSection) => React.ReactNode;
  onSelectNode?: (nodeId: string | null, sectionId?: string | null) => void;
  selectedNodeId?: string | null;
}
export default function DocumentRenderer({ document, variant, viewport, mode = 'live', params = {}, campaignId, redirectUrl, renderNodeOverlay, onSelectNode, selectedNodeId }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(viewport?.width || 390);
  const [gateDone, setGateDone] = useState(false);
  const [announcementDone, setAnnouncementDone] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'error' | 'wait'>('success');
  const [result, setResult] = useState('');
  const [restart, setRestart] = useState(0);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const update = () => setWidth(viewport?.width || el.clientWidth);
    update(); const observer = new ResizeObserver(update); observer.observe(el);
    return () => observer.disconnect();
  }, [viewport?.width]);
  useEffect(() => { setGateDone(false); setAnnouncementDone(false); setResult(''); }, [variant, mode, restart]);
  const device = variant || variantForWidth(width);
  const design = document.variants[device];

  // Detect Video Gate from either design.flow or section nodes
  const gateNodeFromSection = design.sections
    .flatMap(s => s.nodes)
    .find(n => n.element.type === 'video_gate' && !n.hidden && n.element.enabled);
  const gate = design.flow.videoGate || gateNodeFromSection;

  // Detect Announcement from either design.flow or section nodes
  const announcementNodeFromSection = design.sections
    .flatMap(s => s.nodes)
    .find(n => n.element.type === 'announcement' && !n.hidden && n.element.enabled);
  const announcement = design.flow.announcement || announcementNodeFromSection;

  const showGate = mode !== 'edit' && gate && !gate.hidden && gate.element.enabled && !gateDone;
  const showAnnouncement = mode !== 'edit' && !showGate && announcement && !announcement.hidden && announcement.element.enabled && !announcementDone;

  function nodeView(node: DesignNode, section: DesignSection, absolute: boolean): React.ReactNode {
    if (node.hidden || !node.element.enabled) return null;
    // In live or simulate mode, video_gate, announcement, and attendance_gate are gating overlays displayed BEFORE the main page.
    // They must never be rendered as inline static cards inside the section content.
    if (mode !== 'edit' && (node.element.type === 'video_gate' || node.element.type === 'announcement' || node.element.type === 'attendance_gate')) {
      return null;
    }
    const element = materializeElement(node);
    const mediaHeight = ['image', 'image_slider', 'video', 'video_gate', 'announcement', 'container', 'shape', 'divider', 'spacer'].includes(element.type);
    if (element.type === 'image') { element.width = '100%'; element.height = `${node.layout.height}px`; }
    if (element.type === 'image_slider' || element.type === 'spacer') element.height = `${node.layout.height}px`;
    return <div key={node.id} data-node-id={node.id} data-section-id={section.id} style={{ position: absolute ? 'absolute' : 'relative', left: absolute ? node.layout.x : undefined, top: absolute ? node.layout.y : undefined, width: node.layout.width, maxWidth: absolute ? undefined : '100%', height: absolute || mediaHeight ? node.layout.height : 'auto', minWidth: 0, transform: `rotate(${node.layout.rotation}deg)`, overflowWrap: 'anywhere' }}>
      {element.type === 'container' || element.type === 'shape' || element.type === 'divider' ? <div style={{ width: '100%', height: '100%', background: element.color, borderRadius: element.borderRadius }} /> : <div style={{ pointerEvents: mode === 'edit' ? 'none' : undefined }}><RenderElement element={element as TemplateElement} params={params} isPreview={mode !== 'live'} isDesktop={device !== 'mobile'} campaignId={campaignId} redirectUrl={redirectUrl} autoPlayTrigger={mode !== 'edit' && !showGate && !showAnnouncement ? 1 : 0} onSimulateConnect={mode === 'simulate' ? () => setResult(outcome === 'success' ? 'Đã kết nối thành công (mô phỏng).' : outcome === 'error' ? 'Không thể kết nối. Hãy thử lại (mô phỏng).' : 'Đang chờ kết nối (mô phỏng)…') : undefined} /></div>}
      {node.children?.map(child => nodeView(child, section, true))}
      {renderNodeOverlay?.(node, section)}
    </div>;
  }
  const bg = design.background;
  const image = mediaUrl(design.backgroundMedia.image);
  const video = mediaUrl(design.backgroundMedia.video);
  return <div ref={root} className="portal-page" data-render-mode={mode} data-device-variant={device} style={{ position: 'relative', width: '100%', minHeight: viewport?.height || '100vh', backgroundColor: bg.color, isolation: 'isolate' }}>
    <div style={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', backgroundImage: image ? `url(${JSON.stringify(image)})` : undefined, backgroundSize: bg.type || 'cover', backgroundPosition: `${bg.focalX}% ${bg.focalY}%` }}>
      {video && <video src={video} autoPlay={mode !== 'edit'} muted loop playsInline style={{ width: '100%', height: '100%', objectFit: bg.type as 'cover' | 'contain', objectPosition: `${bg.focalX}% ${bg.focalY}%` }} />}
      <div style={{ position: 'absolute', inset: 0, background: bg.overlayColor, opacity: bg.overlayOpacity }} />
    </div>

    {/* In Edit mode: render flow video gate and announcement as prominent preview cards so the user sees them on canvas */}
    {mode === 'edit' && gate && !gate.hidden && gate.element.enabled && (
      <div
        className={`p-3 mx-auto my-2 max-w-sm flex flex-col items-center justify-center bg-blue-50/90 border border-blue-200/90 rounded-2xl shadow-sm backdrop-blur-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${selectedNodeId === gate.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
        data-node-id={gate.id}
        data-flow-preview="video_gate"
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode?.(gate.id, null);
        }}
      >
        <div className="flex items-center gap-1.5 mb-1 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <span>🎬 Luồng Video Gate (Bấm để chỉnh sửa)</span>
        </div>
        <RenderElement
          element={materializeElement(gate) as TemplateElement}
          params={params}
          isPreview={true}
          isDesktop={device !== 'mobile'}
        />
      </div>
    )}

    {mode === 'edit' && announcement && !announcement.hidden && announcement.element.enabled && (
      <div
        className={`p-3 mx-auto my-2 max-w-sm flex flex-col items-center justify-center bg-amber-50/90 border border-amber-200/90 rounded-2xl shadow-sm backdrop-blur-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${selectedNodeId === announcement.id ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
        data-node-id={announcement.id}
        data-flow-preview="announcement"
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode?.(announcement.id, null);
        }}
      >
        <div className="flex items-center gap-1.5 mb-1 px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <span>📢 Luồng Thông báo (Bấm để chỉnh sửa)</span>
        </div>
        <RenderElement
          element={materializeElement(announcement) as TemplateElement}
          params={params}
          isPreview={true}
          isDesktop={device !== 'mobile'}
        />
      </div>
    )}

    {/* Main sections wrapper with blur backdrop when Video Gate or Announcement is active */}
    <div
      style={{
        filter: (showGate || showAnnouncement) ? 'blur(16px) brightness(0.45)' : 'none',
        pointerEvents: (showGate || showAnnouncement) ? 'none' : undefined,
        transition: 'filter 0.5s ease-out',
        width: '100%',
      }}
    >
      {design.sections.filter(section => !section.hidden).map(section => {
        const scale = section.mode === 'freeform' ? width / section.width : 1;
        return <section key={section.id} data-design-section={section.id} data-section-id={section.id} data-section-scale={scale} style={{ position: 'relative', width: '100%', height: section.mode === 'freeform' ? section.height * scale : undefined, background: section.background }}>
          <div style={section.mode === 'freeform' ? { position: 'relative', width: section.width, height: section.height, transform: `scale(${scale})`, transformOrigin: 'top left' } : { display: 'grid', gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`, gap: section.gap, padding: section.padding, justifyItems: section.align, boxSizing: 'border-box', maxWidth: device === 'desktop' ? '720px' : device === 'tablet' ? '600px' : '100%', margin: '0 auto' }}>
            {section.nodes.map(node => nodeView(node, section, section.mode === 'freeform'))}
          </div>
        </section>;
      })}
    </div>
    {showGate && <VideoGateRenderer key={`gate-${device}-${restart}`} el={materializeElement(gate) as VideoGateElement} params={params} isPreview={mode !== 'live'} forcedDesktop={device !== 'mobile'} onDismissed={() => setGateDone(true)} />}
    {showAnnouncement && <AnnouncementRenderer key={`announcement-${device}-${restart}`} el={materializeElement(announcement) as AnnouncementElement} params={params} isPreview={mode !== 'live'} forcedDesktop={device !== 'mobile'} onDismissed={() => setAnnouncementDone(true)} />}
    {mode === 'simulate' && <div style={{ position: 'fixed', bottom: 8, left: 8, right: 8, zIndex: 60, padding: 10, borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: 12, boxShadow: '0 2px 12px #0003' }}>
      <label>Kết quả mô phỏng <select value={outcome} onChange={e => { setOutcome(e.target.value as typeof outcome); setResult(''); }}><option value="success">Thành công</option><option value="error">Lỗi</option><option value="wait">Chờ</option></select></label>{' '}<button onClick={() => setRestart(n => n + 1)}>Bắt đầu lại</button>
      {result && <p role="status">{result}</p>}
    </div>}
  </div>;
}
