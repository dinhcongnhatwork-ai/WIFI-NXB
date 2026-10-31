'use client';
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Copy, Trash2, Lock, Unlock, ImageIcon, AlignLeft, AlignCenter, AlignRight, X, Play, Check } from 'lucide-react';
import CmsTopBar from './CmsTopBar';
import CmsCanvas, { type CmsCanvasHandle } from './CmsCanvas';
import CmsLeftSidebar from './CmsLeftSidebar';
import CmsRightSidebar from './CmsRightSidebar';
import CmsPublishModal from './CmsPublishModal';
import CmsRevisionsModal from './CmsRevisionsModal';
import CmsComparisonView from './CmsComparisonView';
import { MediaPicker } from '@/components/media';
import type { MediaItem } from '@/components/media/MediaPicker';
import { useDocumentHistory } from './useDocumentHistory';
import { useDraftSave } from './useDraftSave';
import { type TemplateDocumentV2, type DeviceVariant, type NodeElement, type DesignNode, type DesignSection, type NodeLayout, type Viewport, type ScreenId, type PreviewTarget, DEVICES, SCREEN_LABELS, GATE_SCREENS, createNode, createSection, clone, uid, toDocument, screenSurface, flowNode, findNode, flattenNodes, setNodeMedia } from '@/lib/template-document';
export interface CampaignInfo { id: string; name: string; ssid: string; active: boolean }
export interface CmsBuilderProps { templateId: string; templateName: string; status: string; initialDocument: TemplateDocumentV2; initialVersion: number; campaigns?: CampaignInfo[]; token: string }
function removeNode(nodes: DesignNode[], id: string): DesignNode[] { return nodes.filter(n => n.id !== id).map(n => n.children ? { ...n, children: removeNode(n.children, id) } : n); }
function regenerate(node: DesignNode) { node.id = uid(); node.element.id = node.id; node.children?.forEach(regenerate); }
export default function CmsBuilder({ templateId, templateName, status: initialStatus, initialDocument, initialVersion, campaigns = [], token }: CmsBuilderProps) {
  const { document, commit, undo, redo, canUndo, canRedo } = useDocumentHistory(toDocument(initialDocument));
  const { state: saveState, error: saveError, version, markVersion, flush } = useDraftSave(templateId, document, initialVersion, token, true);
  const searchParams = useSearchParams();
  const initialScreen = searchParams.get('screen') as ScreenId;
  const [screen, setScreen] = useState<ScreenId>(initialScreen && initialScreen in SCREEN_LABELS ? initialScreen : 'portal');
  const [activeDevice, setActiveDevice] = useState<DeviceVariant>('mobile');
  const [activePresetIndex, setActivePresetIndex] = useState(0), [zoom, setZoom] = useState(.75);
  const [isRotated, setIsRotated] = useState(false), [isComparing, setIsComparing] = useState(false);
  const [mode, setMode] = useState<'edit' | 'simulate'>('edit'), [status, setStatus] = useState(initialStatus);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>('portal'), [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null), [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false), [showRevisionsModal, setShowRevisionsModal] = useState(false), [showMediaPicker, setShowMediaPicker] = useState(false);
  const canvas = useRef<CmsCanvasHandle>(null);
  const activeViewport: Viewport = useMemo(() => { const raw = DEVICES[activeDevice].presets[activePresetIndex] || DEVICES[activeDevice].presets[0]; return isRotated && activeDevice !== 'desktop' ? { width: raw.height, height: raw.width } : raw; }, [activeDevice, activePresetIndex, isRotated]);
  const surface = screenSurface(document.variants[activeDevice], screen);
  const section = surface.sections.find(s => s.id === selectedSectionId) || surface.sections.find(s => !!findNode(s.nodes, selectedNodeId || ''));
  const selected = section && selectedNodeId ? findNode(section.nodes, selectedNodeId) : undefined;
  const editable = selected?.element.type === 'flow_content' ? flowNode(document.variants[activeDevice], selected.element.screen) : selected;
  const sectionFor = (draft: TemplateDocumentV2, id: string) => screenSurface(draft.variants[activeDevice], screen).sections.find(s => s.id === id);
  const selectNode = useCallback((id: string | null, sectionId?: string | null) => { setSelectedNodeId(id); if (sectionId !== undefined) setSelectedSectionId(sectionId); }, []);
  function chooseScreen(next: ScreenId) { setScreen(next); setMode('edit'); setSelectedNodeId(null); setSelectedSectionId(null); }
  function chooseDevice(device: DeviceVariant) { setActiveDevice(device); setActivePresetIndex(0); setIsRotated(false); setSelectedNodeId(null); setSelectedSectionId(null); setZoom(device === 'mobile' ? .75 : device === 'tablet' ? .5 : .35); }
  function addNode(type: NodeElement['type'], target?: string, media?: { url: string; item?: MediaItem }, slides?: MediaItem[]) {
    if (GATE_SCREENS.includes(type as any)) { chooseScreen(type as ScreenId); return; }
    if (type === 'flow_content' || (screen !== 'portal' && type === 'connect_button')) return;
    const node = createNode(type, document.variants[activeDevice].viewport.width);
    if (media) { setNodeMedia(node, 'src', media.url); if (node.element.type === 'image') node.element.alt = media.item?.name || 'Ảnh'; }
    if (slides && node.element.type === 'image_slider') node.element.images = slides.map(item => ({ src: item.url, alt: item.name }));
    let newSectionId = '';
    commit(draft => {
      const current = screenSurface(draft.variants[activeDevice], screen);
      let targetSection = current.sections.find(s => s.id === (target || selectedSectionId)) || current.sections[current.sections.length - 1];
      if (!targetSection) { targetSection = createSection(draft.variants[activeDevice].viewport); current.sections.push(targetSection); }
      if (targetSection.mode === 'freeform') {
        node.layout.x = Math.max(0, (targetSection.width - node.layout.width) / 2);
        node.layout.y = Math.max(24, ...targetSection.nodes.map(n => n.layout.y + n.layout.height + 16));
        targetSection.height = Math.max(targetSection.height, node.layout.y + node.layout.height + 24);
      }
      targetSection.nodes.push(node); newSectionId = targetSection.id;
    });
    selectNode(node.id, newSectionId);
  }
  const updateLayout = (sid: string, id: string, layout: NodeLayout) => commit(d => { const n = findNode(sectionFor(d, sid)?.nodes || [], id); if (n && !n.locked) n.layout = layout; });
  const deleteNode = (sid: string, id: string) => { commit(d => { const s = sectionFor(d, sid), n = findNode(s?.nodes || [], id); if (s && n && !flattenNodes([n]).some(child => child.element.type === 'flow_content') && !n.locked) s.nodes = removeNode(s.nodes, id); }); if (selectedNodeId === id) selectNode(null, sid); };
  const duplicateNode = (sid: string, id: string) => { let copyId = ''; commit(d => { const s = sectionFor(d, sid), original = findNode(s?.nodes || [], id); if (!s || !original || flattenNodes([original]).some(child => child.element.type === 'flow_content')) return; const copy = clone(original); regenerate(copy); copy.name += ' (sao chép)'; if (s.mode === 'freeform') { copy.layout.x += 16; copy.layout.y += 16; s.height = Math.max(s.height, copy.layout.y + copy.layout.height + 16); } s.nodes.push(copy); copyId = copy.id; }); if (copyId) selectNode(copyId, sid); };
  const changeNode = (sid: string, id: string, change: (n: DesignNode) => void) => commit(d => { const n = findNode(sectionFor(d, sid)?.nodes || [], id); if (n) change(n); });
  const moveSection = (sid: string, direction: 'up' | 'down') => commit(d => { const sections = screenSurface(d.variants[activeDevice], screen).sections; const i = sections.findIndex(s => s.id === sid), j = i + (direction === 'up' ? -1 : 1); if (i >= 0 && j >= 0 && j < sections.length) [sections[i], sections[j]] = [sections[j], sections[i]]; });
  const convert = (sid: string, change?: (section: DesignSection) => void) => canvas.current?.convertSection(sid, change);
  function replaceMedia(url: string) { if (!section || !selectedNodeId) return; commit(d => { const core = findNode(sectionFor(d, section.id)?.nodes || [], selectedNodeId); const node = core?.element.type === 'flow_content' ? flowNode(d.variants[activeDevice], core.element.screen) : core; if (node) setNodeMedia(node, node.element.type === 'video_gate' ? 'videoUrl' : node.element.type === 'announcement' ? 'imageUrl' : 'src', url); }); setShowMediaPicker(false); }
  async function openPublish() { try { await flush(); setShowPublishModal(true); } catch (e) { toast.error(e instanceof Error ? e.message : 'Không lưu được bản nháp.'); } }
  const common = { document, device: activeDevice, screen, selectedNodeId, selectedSectionId, onSelectNode: selectNode, onSelectSection: (id: string | null) => { setSelectedSectionId(id); setSelectedNodeId(null); }, onAddNode: addNode,
    onAddSection: (sectionMode: DesignSection['mode']) => commit(d => { screenSurface(d.variants[activeDevice], screen).sections.push(createSection(d.variants[activeDevice].viewport, sectionMode)); }),
    onDeleteNode: deleteNode, onDuplicateNode: duplicateNode,
    onToggleLockNode: (sid: string, id: string) => changeNode(sid, id, n => { n.locked = !n.locked; }),
    onToggleHideNode: (sid: string, id: string) => changeNode(sid, id, n => { if (!flattenNodes([n]).some(child => child.element.type === 'flow_content')) n.hidden = !n.hidden; }),
    onMoveNode: (sid: string, id: string, direction: 'up' | 'down') => commit(d => { const s = sectionFor(d, sid); if (!s) return; const i = s.nodes.findIndex(n => n.id === id), j = i + (direction === 'up' ? -1 : 1); if (i >= 0 && j >= 0 && j < s.nodes.length) [s.nodes[i], s.nodes[j]] = [s.nodes[j], s.nodes[i]]; }),
    onDeleteSection: (sid: string) => commit(d => { const current = screenSurface(d.variants[activeDevice], screen); const s = current.sections.find(s => s.id === sid); if (s && !flattenNodes(s.nodes).some(n => n.element.type === 'flow_content')) current.sections = current.sections.filter(s => s.id !== sid); }),
    onMoveSection: moveSection, onRenameNode: (sid: string, id: string, name: string) => changeNode(sid, id, n => { n.name = name; }),
  };
  return <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100 text-slate-900">
    <CmsTopBar templateName={templateName} status={status} activeDevice={activeDevice} activePresetIndex={activePresetIndex} zoom={zoom} isRotated={isRotated} isComparing={isComparing} mode={mode} saveState={saveState} saveError={saveError} canUndo={canUndo} canRedo={canRedo} onSelectDevice={chooseDevice} onSelectPreset={setActivePresetIndex} onToggleRotate={() => setIsRotated(v => !v)} onSetZoom={setZoom} onToggleCompare={() => setIsComparing(v => !v)} onToggleMode={() => mode === 'simulate' ? setMode('edit') : setShowPreviewPicker(true)} onUndo={undo} onRedo={redo} onOpenRevisions={() => { void flush().then(() => setShowRevisionsModal(true)).catch(e => toast.error(e instanceof Error ? e.message : 'Không lưu được bản nháp.')); }} onOpenPublish={() => void openPublish()} />
    <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <nav aria-label="Màn hình thiết kế" className="flex flex-wrap gap-1">{Object.entries(SCREEN_LABELS).map(([key, label]) => <button key={key} aria-pressed={screen === key} onClick={() => chooseScreen(key as ScreenId)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${screen === key ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>{label}{key !== 'portal' && flowNode(document.variants[activeDevice], key as any)?.element.enabled && <Check className="ml-1 inline h-3 w-3" />}</button>)}</nav>
      {screen !== 'portal' && <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" className="accent-blue-600" checked={!!flowNode(document.variants[activeDevice], screen)?.element.enabled} onChange={e => { const enabled = e.target.checked; commit(d => { for (const variant of Object.values(d.variants)) { const node = flowNode(variant, screen); if (node) { node.element.enabled = enabled; node.hidden = false; } } }); }} />Bật màn hình trong luồng</label>}
    </div>
    <div className="relative flex flex-1 overflow-hidden">
      {mode === 'edit' && <CmsLeftSidebar {...common} onAddMedia={(url, item) => addNode(item?.type === 'video' ? 'video' : 'image', undefined, { url, item })} onAddSlides={items => addNode('image_slider', undefined, undefined, items)} />}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {selected && section && mode === 'edit' && <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Thao tác phần tử">
          {editable && ['image', 'logo', 'video', 'video_gate', 'announcement'].includes(editable.element.type) && <button title="Thay media" aria-label="Thay media" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" onClick={() => setShowMediaPicker(true)}><ImageIcon className="h-4 w-4" /></button>}
          {(['left', 'center', 'right'] as const).map((alignment, i) => { const Icon = [AlignLeft, AlignCenter, AlignRight][i]; return <button key={alignment} aria-label={`Căn ${alignment}`} title={['Căn trái', 'Căn giữa', 'Căn phải'][i]} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" onClick={() => { canvas.current?.convertSection(section.id, s => { const n = findNode(s.nodes, selected.id); if (n && !n.locked) n.layout.x = alignment === 'left' ? 0 : alignment === 'center' ? (s.width - n.layout.width) / 2 : s.width - n.layout.width; }); }}><Icon className="h-4 w-4" /></button>; })}
          <button aria-label={selected.locked ? 'Mở khóa' : 'Khóa'} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" onClick={() => common.onToggleLockNode(section.id, selected.id)}>{selected.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
          <button aria-label="Nhân bản" disabled={selected.element.type === 'flow_content'} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30" onClick={() => duplicateNode(section.id, selected.id)}><Copy className="h-4 w-4" /></button>
          <button aria-label="Xóa phần tử" disabled={selected.element.type === 'flow_content' || selected.locked} className="p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-lg disabled:opacity-30" onClick={() => deleteNode(section.id, selected.id)}><Trash2 className="h-4 w-4" /></button>
        </div>}
        {isComparing ? <CmsComparisonView document={document} activeDevice={activeDevice} onSelectDevice={chooseDevice} /> : <CmsCanvas ref={canvas} document={document} device={activeDevice} screen={screen} previewTarget={previewTarget} viewport={activeViewport} zoom={zoom} mode={mode} selectedNodeId={selectedNodeId} selectedSectionId={selectedSectionId} onSelectNode={selectNode} onSelectSection={common.onSelectSection} onUpdateNodeLayout={updateLayout} onCommitGesture={commit} onUndo={undo} onRedo={redo} onDeleteNode={deleteNode} onDuplicateNode={duplicateNode} onUpdateText={(sid, id, text) => changeNode(sid, id, n => { if (n.element.type === 'title' || n.element.type === 'description') n.element.content = text; })} />}
      </main>
      {mode === 'edit' && <CmsRightSidebar {...common} inspectorOnly onUpdateDocument={commit} onConvertToFreeform={convert} />}
    </div>
    {showPreviewPicker && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="Chọn màn hình xem trước"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Bạn muốn xem màn hình nào?</h2><button autoFocus aria-label="Đóng chọn preview" onClick={() => setShowPreviewPicker(false)}><X className="h-5 w-5" /></button></div><div className="space-y-2">{[...Object.entries(SCREEN_LABELS), ['flow', 'Toàn bộ luồng']].map(([key, label]) => <button key={key} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50" onClick={() => { setPreviewTarget(key as PreviewTarget); setMode('simulate'); setIsComparing(false); selectNode(null, null); setShowPreviewPicker(false); }}><span>{label}</span><Play className="h-4 w-4 text-blue-600" /></button>)}</div></div></div>}
    {showMediaPicker && <MediaPicker onSelect={replaceMedia} onClose={() => setShowMediaPicker(false)} accept={editable?.element.type === 'video' || editable?.element.type === 'video_gate' ? 'video/*' : 'image/*'} />}
    <CmsPublishModal templateId={templateId} templateName={templateName} document={document} currentVersion={version.current} campaigns={campaigns} token={token} isOpen={showPublishModal} onClose={() => setShowPublishModal(false)} onPublished={n => { markVersion(n); setStatus('published'); }} />
    <CmsRevisionsModal templateId={templateId} templateName={templateName} currentVersion={version.current} token={token} isOpen={showRevisionsModal} onClose={() => setShowRevisionsModal(false)} onRestored={(n, layout) => { markVersion(n); commit(toDocument(layout)); }} />
  </div>;
}
