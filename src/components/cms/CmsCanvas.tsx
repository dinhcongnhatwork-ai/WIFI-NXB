'use client';
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import DeviceFrame, { type DeviceFrameHandle } from './DeviceFrame';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import { type TemplateDocumentV2, type DeviceVariant, type Viewport, type DesignNode, type DesignSection, type NodeLayout, type ScreenId, type PreviewTarget, clone, screenSurface, findNode, flattenNodes } from '@/lib/template-document';
import { localDelta, resizeFromHandle, magneticLayout, type ResizeHandle } from '@/lib/cms/interaction';
export interface CmsCanvasHandle { convertSection: (sectionId: string, change?: (section: DesignSection) => void) => void }
interface CmsCanvasProps {
  document: TemplateDocumentV2; device: DeviceVariant; screen: ScreenId; previewTarget: PreviewTarget; viewport: Viewport; zoom: number; mode: 'edit' | 'simulate';
  selectedNodeId: string | null; selectedSectionId: string | null;
  onSelectNode: (nodeId: string | null, sectionId?: string | null) => void; onSelectSection: (sectionId: string | null) => void;
  onUpdateNodeLayout: (sectionId: string, nodeId: string, layout: NodeLayout) => void;
  onCommitGesture: (document: TemplateDocumentV2) => void;
  onDeleteNode: (sectionId: string, nodeId: string) => void; onDuplicateNode: (sectionId: string, nodeId: string) => void;
  onUpdateText: (sectionId: string, nodeId: string, text: string) => void;
  onUndo: () => void; onRedo: () => void;
}
const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const positions: Record<ResizeHandle, React.CSSProperties> = { nw: {left:-5,top:-5,cursor:'nwse-resize'}, n:{left:'50%',top:-5,cursor:'ns-resize'}, ne:{right:-5,top:-5,cursor:'nesw-resize'}, e:{right:-5,top:'50%',cursor:'ew-resize'}, se:{right:-5,bottom:-5,cursor:'nwse-resize'}, s:{left:'50%',bottom:-5,cursor:'ns-resize'}, sw:{left:-5,bottom:-5,cursor:'nesw-resize'}, w:{left:-5,top:'50%',cursor:'ew-resize'} };
const CmsCanvas = forwardRef<CmsCanvasHandle, CmsCanvasProps>(function CmsCanvas({ document: doc, device, screen, previewTarget, viewport, zoom, mode, selectedNodeId, selectedSectionId, onSelectNode, onSelectSection, onUpdateNodeLayout, onCommitGesture, onDeleteNode, onDuplicateNode, onUpdateText, onUndo, onRedo }, ref) {
  const frame = useRef<DeviceFrameHandle>(null), container = useRef<HTMLDivElement>(null);
  const [frameWindow, setFrameWindow] = useState<Window | null>(null);
  const [transient, setTransient] = useState<TemplateDocumentV2 | null>(null);
  const [guides, setGuides] = useState<{ sectionId: string; x?: number; y?: number } | null>(null);
  const [editing, setEditing] = useState<{ sectionId: string; nodeId: string; text: string } | null>(null);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const shown = transient || doc;
  const surface = screenSurface(shown.variants[device], screen);
  function sectionElement(id: string) { return frame.current?.getIframeDocument()?.querySelector<HTMLElement>(`[data-design-section="${id}"]`); }
  function nodeElement(id: string) { return frame.current?.getIframeDocument()?.querySelector<HTMLElement>(`[data-node-id="${id}"]`); }
  /** Snapshot displayed flow geometry before switching positioning mode. */
  const convertedDocument = useCallback((sectionId: string, source: TemplateDocumentV2): TemplateDocumentV2 => {
    const next = clone(source);
    const section = screenSurface(next.variants[device], screen).sections.find(s => s.id === sectionId);
    if (!section || section.mode === 'freeform') return next;
    const el = sectionElement(sectionId);
    if (!el) return next;
    const bounds = el.getBoundingClientRect();
    for (const node of section.nodes) {
      const element = nodeElement(node.id);
      if (!element) continue;
      const box = element.getBoundingClientRect();
      node.layout = { ...node.layout, x: box.left + box.width / 2 - bounds.left - element.offsetWidth / 2, y: box.top + box.height / 2 - bounds.top - element.offsetHeight / 2, width: element.offsetWidth, height: Math.max(8, element.offsetHeight) };
    }
    section.width = bounds.width;
    section.height = Math.max(bounds.height, ...section.nodes.map(n => n.layout.y + n.layout.height));
    section.mode = 'freeform';
    return next;
  }, [device, screen]);
  useImperativeHandle(ref, () => ({ convertSection: (id, change) => { const next = convertedDocument(id, doc); const section = screenSurface(next.variants[device], screen).sections.find(s => s.id === id); if (section && (change || section.mode !== screenSurface(doc.variants[device], screen).sections.find(s => s.id === id)?.mode)) { change?.(section); onCommitGesture(next); } } }), [doc, device, screen, convertedDocument, onCommitGesture]);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => { cleanup.current?.(); setTransient(null); setEditing(null); }, [device, screen, mode, viewport.width, viewport.height, zoom]);
  function parentPoint(event: PointerEvent) {
    const rect = frame.current?.getIframeRect();
    const owner = (event.target as Node | null)?.ownerDocument;
    if (rect && (event.view === frame.current?.getIframeWindow() || owner === frame.current?.getIframeDocument())) return { x: rect.left + event.clientX * rect.width / viewport.width, y: rect.top + event.clientY * rect.height / viewport.height };
    return { x: event.clientX, y: event.clientY };
  }
  const startGesture = (event: React.PointerEvent, node: DesignNode, section: DesignSection, handle?: ResizeHandle) => {
    if (event.button !== 0 || node.locked || section.locked || mode !== 'edit' || space || editing) return;
    event.preventDefault(); event.stopPropagation();
    onSelectNode(node.id, section.id);
    cleanup.current?.();
    const iframeWindow = frame.current?.getIframeWindow();
    const start = parentPoint(event.nativeEvent);
    const initialFrame = frame.current?.getIframeRect();
    if (!initialFrame) return;
    const initialScroll = { x: iframeWindow?.scrollX || 0, y: iframeWindow?.scrollY || 0 };
    const base = section.mode === 'flow' ? convertedDocument(section.id, doc) : clone(doc);
    const baseSection = screenSurface(base.variants[device], screen).sections.find(s => s.id === section.id)!;
    const baseNode = findNode(baseSection.nodes, node.id)!;
    const initial = { ...baseNode.layout };
    let parentRotation = 0;
    const stack: DesignNode[] = [];
    const path = (nodes: DesignNode[]): boolean => nodes.some(n => { if (n.id === node.id) return true; stack.push(n); if (n.children && path(n.children)) return true; stack.pop(); return false; });
    path(baseSection.nodes); stack.forEach(n => { parentRotation += n.layout.rotation; });
    const parent = stack[stack.length - 1];
    const scale = initialFrame.width / viewport.width * viewport.width / baseSection.width;
    const pointerId = event.pointerId;
    const originTarget = event.currentTarget as HTMLElement;
    try { originTarget.setPointerCapture(pointerId); } catch {}
    let latest = base, changed = false, finished = false;
    const stop = (commit: boolean) => {
      if (finished) return; finished = true;
      for (const win of [window, iframeWindow]) if (win) { win.removeEventListener('pointermove', move); win.removeEventListener('pointerup', up); win.removeEventListener('pointercancel', cancel); win.removeEventListener('keydown', key); }
      window.removeEventListener('blur', cancel);
      try { if (originTarget.hasPointerCapture(pointerId)) originTarget.releasePointerCapture(pointerId); } catch {}
      cleanup.current = null; setTransient(null); setGuides(null); setDragging(false);
      if (commit && changed) onCommitGesture(latest);
    };
    const cancel = () => stop(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      const point = parentPoint(e), rect = frame.current?.getIframeRect() || initialFrame;
      const pixel = { x: point.x - start.x + initialFrame.left - rect.left + ((iframeWindow?.scrollX || 0) - initialScroll.x) * initialFrame.width / viewport.width, y: point.y - start.y + initialFrame.top - rect.top + ((iframeWindow?.scrollY || 0) - initialScroll.y) * initialFrame.height / viewport.height };
      if (!changed && Math.hypot(pixel.x, pixel.y) < 3) return;
      changed = true;
      const delta = localDelta(pixel, scale, parentRotation + (handle ? initial.rotation : 0));
      let layout: NodeLayout = handle ? resizeFromHandle(initial, delta, handle, e.shiftKey || ['image', 'logo', 'video'].includes(node.element.type)) : { ...initial, x: Math.round(initial.x + delta.x), y: Math.round(initial.y + delta.y) };
      if (!handle && !e.altKey && !layout.rotation) {
        const siblings = parent?.children || baseSection.nodes;
        const magnetic = magneticLayout(layout, siblings.filter(n => n.id !== node.id && !n.hidden).map(n => n.layout), { width: parent?.layout.width || baseSection.width, height: parent?.layout.height || baseSection.height }, 5 / Math.max(scale, .01));
        layout = magnetic.layout; if (!parentRotation) setGuides({ sectionId: section.id, ...magnetic.guides });
      } else setGuides(null);
      latest = clone(base);
      const target = screenSurface(latest.variants[device], screen).sections.find(s => s.id === section.id)!;
      const n = findNode(target.nodes, node.id)!; n.layout = layout;
      if (!parent) target.height = Math.max(target.height, layout.y + layout.height);
      setTransient(latest); setDragging(true);
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) { move(e); stop(true); } };
    for (const win of [window, iframeWindow]) if (win) { win.addEventListener('pointermove', move); win.addEventListener('pointerup', up); win.addEventListener('pointercancel', cancel); win.addEventListener('keydown', key); }
    window.addEventListener('blur', cancel); cleanup.current = cancel;
  };
  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setSpace(true); }
      if (e.key === 'Escape') { if (cleanup.current) cleanup.current(); else onSelectNode(null, null); return; }
      if (mode !== 'edit' || cleanup.current) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? onRedo() : onUndo(); return; }
      const s = screenSurface(doc.variants[device], screen).sections.find(s => !!findNode(s.nodes, selectedNodeId || ''));
      const node = s && findNode(s.nodes, selectedNodeId || '');
      if (!s || !node) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !node.locked && node.element.type !== 'flow_content') { e.preventDefault(); onDeleteNode(s.id, node.id); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); onDuplicateNode(s.id, node.id); }
      else if (e.key.startsWith('Arrow') && !node.locked) {
        e.preventDefault(); const step = e.shiftKey ? 10 : 1;
        const next = s.mode === 'flow' ? convertedDocument(s.id, doc) : clone(doc);
        const section = screenSurface(next.variants[device], screen).sections.find(section => section.id === s.id)!;
        const n = findNode(section.nodes, node.id)!;
        if (e.key === 'ArrowLeft') n.layout.x -= step; else if (e.key === 'ArrowRight') n.layout.x += step; else if (e.key === 'ArrowUp') n.layout.y -= step; else if (e.key === 'ArrowDown') n.layout.y += step;
        onCommitGesture(next);
      }
    };
    const keyUp = (e: KeyboardEvent) => { if (e.code === 'Space') { setSpace(false); pan.current = null; } };
    for (const win of [window, frameWindow]) if (win) { win.addEventListener('keydown', keyDown); win.addEventListener('keyup', keyUp); }
    return () => { for (const win of [window, frameWindow]) if (win) { win.removeEventListener('keydown', keyDown); win.removeEventListener('keyup', keyUp); } };
  }, [doc, device, screen, selectedNodeId, mode, frameWindow, convertedDocument, onSelectNode, onCommitGesture, onDeleteNode, onDuplicateNode, onUndo, onRedo]);
  const overlay = (node: DesignNode, section: DesignSection) => {
    if (mode !== 'edit') return null;
    const selected = node.id === selectedNodeId;
    return <div data-editor-overlay={node.id} style={{ position:'absolute', inset:0, outline:selected ? '2px solid #2563eb' : undefined, outlineOffset:0, zIndex:selected ? 30 : 20, cursor:node.locked ? 'not-allowed' : space ? 'grab' : selected ? 'move' : 'pointer', touchAction:'none' }}
      onClick={e => { e.stopPropagation(); onSelectNode(node.id, section.id); }} onPointerDown={e => startGesture(e, node, section)}
      onDoubleClick={e => { if (!node.locked && (node.element.type === 'title' || node.element.type === 'description')) { e.stopPropagation(); setEditing({ nodeId: node.id, sectionId: section.id, text: node.element.content }); } }}>
      {selected && <><span className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">{node.name} · {Math.round(node.layout.width)}×{Math.round(node.layout.height)}</span>{!node.locked && HANDLES.map(handle => <div key={handle} data-resize-handle={handle} aria-label={`Resize ${handle}`} style={{position:'absolute',width:10,height:10,background:'#fff',border:'2px solid #2563eb',borderRadius:2,...positions[handle]}} onPointerDown={e => startGesture(e, node, section, handle)} />)}</>}
      {editing?.nodeId === node.id && <textarea autoFocus value={editing.text} aria-label="Sửa chữ trực tiếp" className="absolute inset-0 z-50 h-full w-full resize-none rounded border-2 border-blue-600 bg-white p-2 text-sm text-slate-900" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => setEditing({ ...editing, text: e.target.value })} onBlur={() => { onUpdateText(editing.sectionId, editing.nodeId, editing.text); setEditing(null); }} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur(); }} />}
    </div>;
  };
  return <div ref={container} className={`relative flex h-full w-full overflow-auto bg-slate-100 ${space ? 'cursor-grab' : ''}`} style={{backgroundImage:'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',backgroundSize:'20px 20px'}}
    onPointerDown={e => { if ((space || e.button === 1) && container.current) { e.preventDefault(); pan.current = {x:e.clientX,y:e.clientY,left:container.current.scrollLeft,top:container.current.scrollTop}; e.currentTarget.setPointerCapture(e.pointerId); } }}
    onPointerMove={e => { if (pan.current && container.current) { container.current.scrollLeft = pan.current.left - e.clientX + pan.current.x; container.current.scrollTop = pan.current.top - e.clientY + pan.current.y; } }} onPointerUp={() => { pan.current = null; }}
    onClick={() => { if (!dragging && !editing) { onSelectNode(null, null); onSelectSection(null); } }}>
    <div className="m-auto shrink-0 p-10 pt-16" onClick={e => e.stopPropagation()}>
      <DeviceFrame ref={frame} device={device} viewport={viewport} zoom={zoom} title="Canvas thiết kế" onWindow={setFrameWindow}>
        <DocumentRenderer document={shown} variant={device} viewport={viewport} mode={mode} screen={screen} previewTarget={previewTarget} renderNodeOverlay={overlay} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} />
        {guides && (() => { const el = sectionElement(guides.sectionId); if (!el) return null; const rect = el.getBoundingClientRect(); const section = surface.sections.find(s => s.id === guides.sectionId)!; const scale = viewport.width / section.width; return <div style={{position:'absolute',left:rect.left,top:rect.top + (frameWindow?.scrollY || 0),width:rect.width,height:rect.height,pointerEvents:'none',zIndex:50}}>{guides.x !== undefined && <div style={{position:'absolute',left:guides.x*scale,top:0,bottom:0,width:1,background:'#2563eb'}} />}{guides.y !== undefined && <div style={{position:'absolute',top:guides.y*scale,left:0,right:0,height:1,background:'#2563eb'}} />}</div>; })()}
      </DeviceFrame>
    </div>
    {dragging && <div className="fixed inset-0 z-[60]" style={{cursor:'move'}} />}
  </div>;
});
export default CmsCanvas;
