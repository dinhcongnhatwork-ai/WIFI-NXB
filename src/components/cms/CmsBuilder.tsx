'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { X, Play } from 'lucide-react';
import { syncDeviceChanges, syncDeviceContent, type DeviceSyncMode } from '@/lib/cms/device-sync';
import './cms-editor.css';
import PresetPreview from '@/components/templates/PresetPreview';
import { createPresetDocument, TEMPLATE_PRESETS, type TemplatePreset } from '@/lib/template-presets';
import { issueLocation } from '@/lib/cms/issue-location';
import CmsTopBar from './CmsTopBar';
import CmsCanvas, { type CmsCanvasHandle } from './CmsCanvas';
import CmsLeftSidebar from './CmsLeftSidebar';
import CmsRightSidebar from './CmsRightSidebar';
import CmsPublishModal from './CmsPublishModal';
import CmsRevisionsModal from './CmsRevisionsModal';
import CmsComparisonView from './CmsComparisonView';
import CmsElementToolbar from './CmsElementToolbar';
import { MediaPicker } from '@/components/media';
import type { MediaItem } from '@/components/media/MediaPicker';
import { useDocumentHistory } from './useDocumentHistory';
import { useDraftSave } from './useDraftSave';
import {
  type TemplateDocumentV2,
  type DeviceVariant,
  type NodeElement,
  type DesignNode,
  type DesignSection,
  type NodeLayout,
  type Viewport,
  type ScreenId,
  type PreviewTarget,
  DEVICES,
  SCREEN_LABELS,
  GATE_SCREENS,
  createNode,
  createSection,
  clone,
  uid,
  toDocument,
  screenSurface,
  flowNode,
  findNode,
  nodeSiblings,
  flattenNodes,
  setNodeMedia,
} from '@/lib/template-document';

export interface CampaignInfo {
  id: string;
  name: string;
  ssid: string;
  active: boolean;
}

export interface CmsBuilderProps {
  templateId: string;
  templateName: string;
  status: string;
  initialDocument: TemplateDocumentV2;
  initialVersion: number;
  campaigns?: CampaignInfo[];
  token: string;
}

function removeNode(nodes: DesignNode[], id: string): DesignNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}

function regenerate(node: DesignNode) {
  node.id = uid();
  node.element.id = node.id;
  node.children?.forEach(regenerate);
}

export default function CmsBuilder({
  templateId,
  templateName,
  status: initialStatus,
  initialDocument,
  initialVersion,
  campaigns = [],
  token,
}: CmsBuilderProps) {
  const { document, commit: commitRaw, undo, redo, canUndo, canRedo } = useDocumentHistory(toDocument(initialDocument));
  const searchParams = useSearchParams();
  const initialScreen = searchParams.get('screen') as ScreenId;
  const [screen, setScreen] = useState<ScreenId>(initialScreen && initialScreen in SCREEN_LABELS ? initialScreen : 'portal');
  const [activeDevice, setActiveDevice] = useState<DeviceVariant>('mobile');

  const commit = useCallback(
    (change: TemplateDocumentV2 | ((draft: TemplateDocumentV2) => void)) => {
      commitRaw((draft) => {
        const before = clone(draft);
        if (typeof change === 'function') change(draft);
        else {
          Object.assign(draft, change);
          return;
        }
        syncDeviceChanges(before, draft, activeDevice, draft.deviceSync ?? 'content');
      });
    },
    [commitRaw, activeDevice]
  );

  function synchronizeNow() {
    commitRaw((draft) => {
      const result = syncDeviceContent(draft, activeDevice, draft.deviceSync ?? 'content');
      toast.success(`Đã cập nhật ${result.updated} phần tử; bỏ qua ${result.skipped} phần tử không khớp hoặc bị khóa.`);
    });
  }

  const { state: saveState, error: saveError, version, markVersion, flush } = useDraftSave(
    templateId,
    document,
    initialVersion,
    token,
    true
  );

  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [zoom, setZoom] = useState(0.75);
  const [isRotated, setIsRotated] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [mode, setMode] = useState<'edit' | 'simulate'>('edit');
  const [status, setStatus] = useState(initialStatus);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>('portal');
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [replacementPreset, setReplacementPreset] = useState<TemplatePreset | null>(null);

  const canvas = useRef<CmsCanvasHandle>(null);
  const activeViewport: Viewport = useMemo(() => {
    const raw = DEVICES[activeDevice].presets[activePresetIndex] || DEVICES[activeDevice].presets[0];
    return isRotated && activeDevice !== 'desktop' ? { width: raw.height, height: raw.width } : raw;
  }, [activeDevice, activePresetIndex, isRotated]);

  const surface = screenSurface(document.variants[activeDevice], screen);
  const section =
    surface.sections.find((s) => s.id === selectedSectionId) ||
    surface.sections.find((s) => !!findNode(s.nodes, selectedNodeId || ''));
  const selected = section && selectedNodeId ? findNode(section.nodes, selectedNodeId) : undefined;
  const editable = selected?.element.type === 'flow_content' ? flowNode(document.variants[activeDevice], selected.element.screen) : selected;

  const sectionFor = (draft: TemplateDocumentV2, id: string) =>
    screenSurface(draft.variants[activeDevice], screen).sections.find((s) => s.id === id);

  const selectNode = useCallback((id: string | null, sectionId?: string | null, multi?: boolean) => {
    if (!id) {
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      if (sectionId !== undefined) setSelectedSectionId(sectionId);
      return;
    }
    if (multi) {
      setSelectedNodeIds((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
        setSelectedNodeId(next[next.length - 1] || null);
        return next;
      });
    } else {
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
    }
    if (sectionId !== undefined) setSelectedSectionId(sectionId);
  }, []);

  const reorderNode = useCallback(
    (sectionId: string, sourceId: string, targetId: string, position: 'before' | 'after') => {
      commit((d) => {
        const sec = screenSurface(d.variants[activeDevice], screen).sections.find((s) => s.id === sectionId);
        if (!sec) return;
        const sIdx = sec.nodes.findIndex((n) => n.id === sourceId);
        const tIdx = sec.nodes.findIndex((n) => n.id === targetId);
        if (sIdx === -1 || tIdx === -1 || sIdx === tIdx) return;
        const [moved] = sec.nodes.splice(sIdx, 1);
        const newTargetIdx = sec.nodes.findIndex((n) => n.id === targetId);
        const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;
        sec.nodes.splice(insertIdx, 0, moved);
      });
    },
    [commit, activeDevice, screen]
  );

  function chooseScreen(next: ScreenId) {
    setScreen(next);
    setMode('edit');
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedSectionId(null);
  }

  function chooseDevice(device: DeviceVariant) {
    setActiveDevice(device);
    setActivePresetIndex(0);
    setIsRotated(false);
    setIsComparing(false);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedSectionId(null);
    setZoomMode('fit');
  }

  function addNode(
    type: NodeElement['type'],
    target?: string,
    media?: { url: string; item?: MediaItem },
    slides?: MediaItem[]
  ) {
    if (GATE_SCREENS.includes(type as any)) {
      chooseScreen(type as ScreenId);
      return;
    }
    if (type === 'flow_content' || (screen !== 'portal' && type === 'connect_button')) return;
    const node = createNode(type, document.variants[activeDevice].viewport.width);
    if (media) {
      setNodeMedia(node, 'src', media.url);
      if (node.element.type === 'image') node.element.alt = media.item?.name || 'Ảnh';
    }
    if (slides && node.element.type === 'image_slider') {
      node.element.images = slides.map((item) => ({ src: item.url, alt: item.name }));
    }

    let newSectionId = '';
    commit((draft) => {
      const current = screenSurface(draft.variants[activeDevice], screen);
      let targetSection = current.sections.find((s) => s.id === (target || selectedSectionId)) || current.sections[0];
      if (!targetSection) {
        targetSection = createSection(draft.variants[activeDevice].viewport);
        current.sections.push(targetSection);
      }
      if (targetSection.mode === 'freeform') {
        node.layout.x = Math.max(0, (targetSection.width - node.layout.width) / 2);
        node.layout.y = Math.max(24, ...targetSection.nodes.map((n) => n.layout.y + n.layout.height + 16));
        targetSection.height = Math.max(targetSection.height, node.layout.y + node.layout.height + 24);
        targetSection.nodes.push(node);
      } else {
        const currentIdx = selectedNodeId ? targetSection.nodes.findIndex((n) => n.id === selectedNodeId) : -1;
        if (currentIdx >= 0) {
          targetSection.nodes.splice(currentIdx + 1, 0, node);
        } else {
          targetSection.nodes.push(node);
        }
      }
      newSectionId = targetSection.id;
    });

    selectNode(node.id, newSectionId);
    toast.success(`Đã thêm ${node.name}`);
    if (['logo', 'image'].includes(type) && !media) {
      setShowMediaPicker(true);
    }
  }

  const updateLayout = (sid: string, id: string, layout: NodeLayout) =>
    commit((d) => {
      const n = findNode(sectionFor(d, sid)?.nodes || [], id);
      if (n && !n.locked) n.layout = layout;
    });

  const deleteNode = (sid: string, id: string) => {
    commit((d) => {
      const s = sectionFor(d, sid),
        n = findNode(s?.nodes || [], id);
      if (s && n && !flattenNodes([n]).some((child) => child.element.type === 'flow_content') && !n.locked) {
        s.nodes = removeNode(s.nodes, id);
      }
    });
    if (selectedNodeId === id) selectNode(null, sid);
  };

  const duplicateNode = (sid: string, id: string) => {
    let copyId = '';
    commit((d) => {
      const s = sectionFor(d, sid),
        original = findNode(s?.nodes || [], id);
      if (!s || !original || flattenNodes([original]).some((child) => child.element.type === 'flow_content')) return;
      const siblings = nodeSiblings(s.nodes, id);
      if (!siblings) return;
      const copy = clone(original);
      regenerate(copy);
      copy.name += ' (sao chép)';
      if (s.mode === 'freeform') {
        copy.layout.x += 16;
        copy.layout.y += 16;
        if (siblings === s.nodes) s.height = Math.max(s.height, copy.layout.y + copy.layout.height + 16);
      }
      siblings.splice(siblings.indexOf(original) + 1, 0, copy);
      copyId = copy.id;
    });
    if (copyId) selectNode(copyId, sid);
  };

  const changeNode = (sid: string, id: string, change: (n: DesignNode) => void) =>
    commit((d) => {
      const n = findNode(sectionFor(d, sid)?.nodes || [], id);
      if (n) change(n);
    });

  const moveSection = (sid: string, direction: 'up' | 'down') =>
    commit((d) => {
      const sections = screenSurface(d.variants[activeDevice], screen).sections;
      const i = sections.findIndex((s) => s.id === sid),
        j = i + (direction === 'up' ? -1 : 1);
      if (i >= 0 && j >= 0 && j < sections.length) [sections[i], sections[j]] = [sections[j], sections[i]];
    });

  const convert = (sid: string, change?: (section: DesignSection) => void) => canvas.current?.convertSection(sid, change);

  function handleAlign(alignment: 'left' | 'center' | 'right') {
    if (!section || !selected) return;
    if (section.mode === 'flow') {
      commit((d) => {
        const n = findNode(sectionFor(d, section.id)?.nodes || [], selected.id);
        if (!n) return;
        if (n.element.type === 'logo') {
          n.element.position = alignment;
        } else if (n.element.type === 'title' || n.element.type === 'description') {
          n.element.align = alignment;
        }
      });
    } else {
      canvas.current?.convertSection(section.id, (s) => {
        const n = findNode(s.nodes, selected.id);
        if (n && !n.locked) {
          n.layout.x =
            alignment === 'left' ? 0 : alignment === 'center' ? (s.width - n.layout.width) / 2 : s.width - n.layout.width;
        }
      });
    }
  }

  function replaceMedia(url: string) {
    if (!section || !selectedNodeId) return;
    commit((d) => {
      const core = findNode(sectionFor(d, section.id)?.nodes || [], selectedNodeId);
      const node = core?.element.type === 'flow_content' ? flowNode(d.variants[activeDevice], core.element.screen) : core;
      if (node)
        setNodeMedia(
          node,
          node.element.type === 'video_gate' ? 'videoUrl' : node.element.type === 'announcement' ? 'imageUrl' : 'src',
          url
        );
    });
    setShowMediaPicker(false);
  }

  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `cms-draft-${templateId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function openPublish() {
    try {
      await flush();
      setShowPublishModal(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được bản nháp.');
    }
  }

  const common = {
    document,
    device: activeDevice,
    screen,
    selectedNodeId,
    selectedNodeIds,
    selectedSectionId,
    onSelectNode: selectNode,
    onSelectSection: (id: string | null) => {
      setSelectedSectionId(id);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
    },
    onAddNode: addNode,
    onAddSection: (sectionMode: DesignSection['mode'] = 'flow') =>
      commit((d) => {
        const newSec = createSection(d.variants[activeDevice].viewport, sectionMode || 'flow');
        newSec.mode = 'flow';
        screenSurface(d.variants[activeDevice], screen).sections.push(newSec);
        setSelectedSectionId(newSec.id);
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
      }),
    onDeleteNode: deleteNode,
    onDuplicateNode: duplicateNode,
    onToggleLockNode: (sid: string, id: string) =>
      changeNode(sid, id, (n) => {
        n.locked = !n.locked;
      }),
    onToggleHideNode: (sid: string, id: string) =>
      changeNode(sid, id, (n) => {
        if (!flattenNodes([n]).some((child) => child.element.type === 'flow_content')) n.hidden = !n.hidden;
      }),
    onMoveNode: (sid: string, id: string, direction: 'up' | 'down') =>
      commit((d) => {
        const s = sectionFor(d, sid);
        if (!s) return;
        const siblings = nodeSiblings(s.nodes, id);
        if (!siblings) return;
        const i = siblings.findIndex((n) => n.id === id),
          j = i + (direction === 'up' ? -1 : 1);
        if (i >= 0 && !siblings[i].locked && j >= 0 && j < siblings.length) [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
      }),
    onReorderNode: reorderNode,
    onDeleteSection: (sid: string) =>
      commit((d) => {
        const current = screenSurface(d.variants[activeDevice], screen);
        const s = current.sections.find((s) => s.id === sid);
        if (s && !flattenNodes(s.nodes).some((n) => n.element.type === 'flow_content'))
          current.sections = current.sections.filter((s) => s.id !== sid);
      }),
    onMoveSection: moveSection,
    onRenameNode: (sid: string, id: string, name: string) =>
      changeNode(sid, id, (n) => {
        n.name = name;
      }),
  };

  return (
    <div className="cms-editor fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100 text-slate-900">
      {/* ─── Unified Clean Header Bar ─── */}
      <CmsTopBar
        templateName={templateName}
        status={status}
        activeDevice={activeDevice}
        activePresetIndex={activePresetIndex}
        zoom={zoom}
        zoomMode={zoomMode}
        isRotated={isRotated}
        isComparing={isComparing}
        mode={mode}
        saveState={saveState}
        saveError={saveError}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectDevice={chooseDevice}
        onSelectPreset={setActivePresetIndex}
        onToggleRotate={() => setIsRotated((v) => !v)}
        onSetZoom={setZoom}
        onSetZoomMode={setZoomMode}
        onToggleCompare={() => setIsComparing((v) => !v)}
        onToggleMode={() => (mode === 'simulate' ? setMode('edit') : setShowPreviewPicker(true))}
        onUndo={undo}
        onRedo={redo}
        onOpenRevisions={() => {
          void flush()
            .then(() => setShowRevisionsModal(true))
            .catch((e) => toast.error(e instanceof Error ? e.message : 'Không lưu được bản nháp.'));
        }}
        onOpenPublish={() => void openPublish()}
        screen={screen}
        onSelectScreen={chooseScreen}
        isScreenEnabled={screen === 'portal' ? true : !!flowNode(document.variants[activeDevice], screen)?.element.enabled}
        onToggleScreenEnabled={(enabled) => {
          if (screen === 'portal') return;
          const currentGateScreen = screen;
          commit((d) => {
            for (const variant of Object.values(d.variants)) {
              const node = flowNode(variant, currentGateScreen);
              if (node) {
                node.element.enabled = enabled;
                node.hidden = false;
              }
            }
          });
        }}
        deviceSync={document.deviceSync ?? 'content'}
        onSetDeviceSync={(mode) =>
          commitRaw((draft) => {
            draft.deviceSync = mode;
          })
        }
        onSynchronizeNow={synchronizeNow}
        onSelectPresetTemplate={(presetId) => {
          const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
          if (preset) setReplacementPreset(preset);
        }}
        onDownloadDraft={downloadDraft}
      />

      {/* Save conflict or error alert if any */}
      {(saveState === 'error' || saveState === 'conflict') && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
          <span className="flex-1">{saveError || 'Chưa lưu được thay đổi. Bản thiết kế đang mở được giữ lại.'}</span>
          {saveState === 'error' && (
            <button
              className="border border-rose-300 bg-white px-3 py-1 font-medium rounded"
              onClick={() => void flush().catch((e) => toast.error(e instanceof Error ? e.message : 'Lưu thất bại.'))}
            >
              Thử lưu lại
            </button>
          )}
          <button className="border border-rose-300 bg-white px-3 py-1 font-medium rounded" onClick={downloadDraft}>
            Tải bản nháp dự phòng
          </button>
        </div>
      )}

      {/* Main Workspace: Left Panel + Canvas + Inspector Panel */}
      <div className="relative flex flex-1 overflow-hidden">
        {mode === 'edit' && (
          <CmsLeftSidebar
            {...common}
            onAddMedia={(url, item) => addNode(item?.type === 'video' ? 'video' : 'image', undefined, { url, item })}
            onAddSlides={(items) => addNode('image_slider', undefined, undefined, items)}
          />
        )}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Smart Floating Element Toolbar (appears only when element is selected) */}
          {selected && section && mode === 'edit' && (
            <CmsElementToolbar
              selectedNode={selected}
              activeSection={section}
              selectedCount={selectedNodeIds.length}
              onOpenMediaPicker={() => setShowMediaPicker(true)}
              onAlign={handleAlign}
              onToggleLock={() => common.onToggleLockNode(section.id, selected.id)}
              onDuplicate={() => {
                const ids = selectedNodeIds.length > 0 ? selectedNodeIds : [selected.id];
                for (const id of ids) duplicateNode(section.id, id);
              }}
              onDelete={() => {
                const ids = selectedNodeIds.length > 0 ? selectedNodeIds : [selected.id];
                for (const id of ids) deleteNode(section.id, id);
              }}
              onMove={(dir) => common.onMoveNode(section.id, selected.id, dir)}
            />
          )}

          {isComparing ? (
            <CmsComparisonView document={document} activeDevice={activeDevice} screen={screen} onSelectDevice={chooseDevice} />
          ) : (
            <CmsCanvas
              ref={canvas}
              document={document}
              device={activeDevice}
              screen={screen}
              previewTarget={previewTarget}
              viewport={activeViewport}
              zoom={zoom}
              mode={mode}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              selectedSectionId={selectedSectionId}
              onSelectNode={selectNode}
              onSelectSection={common.onSelectSection}
              onUpdateNodeLayout={updateLayout}
              onCommitGesture={commit}
              onUndo={undo}
              onRedo={redo}
              onDeleteNode={deleteNode}
              onDuplicateNode={duplicateNode}
              onUpdateText={(sid, id, text) =>
                changeNode(sid, id, (n) => {
                  if (n.element.type === 'title' || n.element.type === 'description') n.element.content = text;
                })
              }
              onMeasuredFitZoom={(fitVal) => {
                if (zoomMode === 'fit') {
                  setZoom(fitVal);
                }
              }}
            />
          )}
        </main>

        {mode === 'edit' && <CmsRightSidebar {...common} inspectorOnly onUpdateDocument={commit} onConvertToFreeform={convert} />}
      </div>

      {/* Preview Screen Modal */}
      {showPreviewPicker && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="Chọn màn hình xem trước">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Chọn màn hình muốn xem trước</h2>
              <button autoFocus aria-label="Đóng chọn preview" onClick={() => setShowPreviewPicker(false)}>
                <X className="h-5 w-5 text-slate-400 hover:text-slate-700" />
              </button>
            </div>
            <div className="space-y-2">
              {[...Object.entries(SCREEN_LABELS), ['flow', 'Toàn bộ luồng kết nối']].map(([key, label]) => (
                <button
                  key={key}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => {
                    setPreviewTarget(key as PreviewTarget);
                    setMode('simulate');
                    setIsComparing(false);
                    selectNode(null, null);
                    setShowPreviewPicker(false);
                  }}
                >
                  <span className="font-medium text-slate-800">{label}</span>
                  <Play className="h-4 w-4 text-blue-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <MediaPicker
          onSelect={replaceMedia}
          onClose={() => setShowMediaPicker(false)}
          accept={editable?.element.type === 'video' || editable?.element.type === 'video_gate' ? 'video/*' : 'image/*'}
        />
      )}

      {/* Preset Replace Confirmation */}
      {replacementPreset && (
        <PresetPreview
          preset={replacementPreset}
          replacing
          creating={false}
          onClose={() => setReplacementPreset(null)}
          onChoose={() => {
            downloadDraft();
            commitRaw(createPresetDocument(replacementPreset.id));
            setReplacementPreset(null);
            chooseScreen('portal');
            setMode('edit');
            setIsComparing(false);
            toast.success('Đã áp dụng thiết kế vào bản nháp. Có thể hoàn tác trước khi xuất bản.');
          }}
        />
      )}

      {/* Publish & Revision Modals */}
      <CmsPublishModal
        templateId={templateId}
        templateName={templateName}
        document={document}
        currentVersion={version.current}
        campaigns={campaigns}
        token={token}
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onInspectIssue={(issue) => {
          const location = issueLocation(document, issue);
          if (!location) return;
          setShowPublishModal(false);
          setMode('edit');
          setIsComparing(false);
          setActiveDevice(location.device);
          setActivePresetIndex(0);
          setIsRotated(false);
          setScreen(location.screen);
          selectNode(location.nodeId, location.sectionId);
        }}
        onPublished={(n) => {
          markVersion(n);
          setStatus('published');
        }}
      />

      <CmsRevisionsModal
        templateId={templateId}
        templateName={templateName}
        currentVersion={version.current}
        token={token}
        isOpen={showRevisionsModal}
        onClose={() => setShowRevisionsModal(false)}
        onRestored={(n, layout) => {
          markVersion(n);
          commit(toDocument(layout));
        }}
      />
    </div>
  );
}
