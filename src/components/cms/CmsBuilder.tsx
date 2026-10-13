'use client';

import React, { useState, useCallback, useMemo } from 'react';
import CmsTopBar from './CmsTopBar';
import CmsCanvas from './CmsCanvas';
import CmsRightSidebar from './CmsRightSidebar';
import CmsPublishModal from './CmsPublishModal';
import CmsRevisionsModal from './CmsRevisionsModal';
import CmsComparisonView from './CmsComparisonView';
import { useDocumentHistory } from './useDocumentHistory';
import { useDraftSave } from './useDraftSave';
import {
  type TemplateDocumentV2,
  type DeviceVariant,
  type NodeElement,
  type NodeLayout,
  type Viewport,
  DEVICES,
  createNode,
  createSection,
  clone,
  uid,
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

export default function CmsBuilder({
  templateId,
  templateName,
  status: initialStatus,
  initialDocument,
  initialVersion,
  campaigns = [],
  token,
}: CmsBuilderProps) {
  // Document State & Undo/Redo
  const {
    document,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDocumentHistory(initialDocument);

  // Autosave State
  const {
    state: saveState,
    error: saveError,
    version,
    markVersion,
  } = useDraftSave(templateId, document, initialVersion, token, true);

  // Viewport & Editor State
  const [activeDevice, setActiveDevice] = useState<DeviceVariant>('mobile');
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [zoom, setZoom] = useState(0.6);
  const [isRotated, setIsRotated] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [mode, setMode] = useState<'edit' | 'simulate'>('edit');
  const [status, setStatus] = useState(initialStatus);

  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);

  // Current active viewport
  const activeViewport: Viewport = useMemo(() => {
    const raw = DEVICES[activeDevice].presets[activePresetIndex] || DEVICES[activeDevice].presets[0];
    if (isRotated && activeDevice !== 'desktop') {
      return { width: raw.height, height: raw.width };
    }
    return raw;
  }, [activeDevice, activePresetIndex, isRotated]);

  // Adjust zoom automatically when switching device
  const handleSelectDevice = (dev: DeviceVariant) => {
    setActiveDevice(dev);
    setActivePresetIndex(0);
    setIsRotated(false);
    setSelectedNodeId(null);
    setSelectedSectionId(null);
    if (dev === 'mobile') setZoom(0.6);
    else if (dev === 'tablet') setZoom(0.45);
    else setZoom(0.35);
  };

  // Node & Section Actions
  const handleSelectNode = useCallback((nodeId: string | null, sectionId?: string | null) => {
    setSelectedNodeId(nodeId);
    if (sectionId !== undefined) {
      setSelectedSectionId(sectionId);
    }
  }, []);

  const handleSelectSection = useCallback((sectionId: string | null) => {
    setSelectedSectionId(sectionId);
    if (!sectionId) setSelectedNodeId(null);
  }, []);

  const handleConvertToFreeform = useCallback(
    (sectionId: string) => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        if (!sec || sec.mode === 'freeform') return;

        let currentY = sec.padding || 24;
        for (const n of sec.nodes) {
          if (n.layout.x === 0 || !n.layout.x) {
            n.layout.x = Math.max(0, Math.round((sec.width - n.layout.width) / 2));
          }
          if (n.layout.y === 0 || !n.layout.y) {
            n.layout.y = currentY;
          }
          currentY += n.layout.height + (sec.gap || 16);
        }
        sec.mode = 'freeform';
        sec.height = Math.max(activeViewport.height, currentY + (sec.padding || 24));
      });
    },
    [activeDevice, activeViewport, commit]
  );

  const handleAddSection = useCallback(
    (sectionMode: 'flow' | 'freeform') => {
      commit((draft) => {
        const newSec = createSection(activeViewport, sectionMode);
        draft.variants[activeDevice].sections.push(newSec);
      });
    },
    [activeDevice, activeViewport, commit]
  );

  const handleAddNode = useCallback(
    (type: NodeElement['type'], targetSectionId?: string) => {
      const newNode = createNode(type);
      commit((draft) => {
        const sections = draft.variants[activeDevice].sections;
        let sec = targetSectionId
          ? sections.find((s) => s.id === targetSectionId)
          : selectedSectionId
          ? sections.find((s) => s.id === selectedSectionId)
          : sections[sections.length - 1];

        if (!sec) {
          sec = createSection(activeViewport, 'freeform');
          sections.push(sec);
        }

        if (sec.mode === 'freeform') {
          newNode.layout.x = Math.max(0, Math.round((sec.width - newNode.layout.width) / 2));
          const maxY = sec.nodes.reduce(
            (max, n) => Math.max(max, (n.layout.y || 0) + (n.layout.height || 0)),
            0
          );
          newNode.layout.y =
            maxY > 0 && maxY + newNode.layout.height < sec.height
              ? maxY + 16
              : Math.round(sec.height / 3);
        }

        sec.nodes.push(newNode);
      });
      setSelectedNodeId(newNode.id);
    },
    [activeDevice, activeViewport, selectedSectionId, commit]
  );

  const handleDeleteNode = useCallback(
    (sectionId: string, nodeId: string) => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        if (sec) {
          sec.nodes = sec.nodes.filter((n) => n.id !== nodeId);
        }
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [activeDevice, selectedNodeId, commit]
  );

  const handleDuplicateNode = useCallback(
    (sectionId: string, nodeId: string) => {
      let createdId: string | null = null;
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        if (!sec) return;
        const nodeIndex = sec.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) return;

        const original = sec.nodes[nodeIndex];
        const duplicated: typeof original = clone(original);
        duplicated.id = uid();
        duplicated.element.id = duplicated.id;
        duplicated.name = `${original.name} (sao chép)`;

        if (sec.mode === 'freeform') {
          duplicated.layout.x = Math.min(sec.width - duplicated.layout.width, duplicated.layout.x + 20);
          duplicated.layout.y = Math.min(sec.height - duplicated.layout.height, duplicated.layout.y + 20);
        }

        sec.nodes.splice(nodeIndex + 1, 0, duplicated);
        createdId = duplicated.id;
      });

      if (createdId) setSelectedNodeId(createdId);
    },
    [activeDevice, commit]
  );

  const handleUpdateNodeLayout = useCallback(
    (sectionId: string, nodeId: string, newLayout: NodeLayout) => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        const node = sec?.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.layout = newLayout;
        }
      });
    },
    [activeDevice, commit]
  );

  const handleToggleLockNode = useCallback(
    (sectionId: string, nodeId: string) => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        const node = sec?.nodes.find((n) => n.id === nodeId);
        if (node) node.locked = !node.locked;
      });
    },
    [activeDevice, commit]
  );

  const handleToggleHideNode = useCallback(
    (sectionId: string, nodeId: string) => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        const node = sec?.nodes.find((n) => n.id === nodeId);
        if (node) node.hidden = !node.hidden;
      });
    },
    [activeDevice, commit]
  );

  const handleMoveNode = useCallback(
    (sectionId: string, nodeId: string, direction: 'up' | 'down') => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        if (!sec) return;
        const index = sec.nodes.findIndex((n) => n.id === nodeId);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= sec.nodes.length) return;

        const [item] = sec.nodes.splice(index, 1);
        sec.nodes.splice(targetIndex, 0, item);
      });
    },
    [activeDevice, commit]
  );

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      commit((draft) => {
        draft.variants[activeDevice].sections = draft.variants[activeDevice].sections.filter(
          (s) => s.id !== sectionId
        );
      });
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null);
        setSelectedNodeId(null);
      }
    },
    [activeDevice, selectedSectionId, commit]
  );

  const handleMoveSection = useCallback(
    (sectionId: string, direction: 'up' | 'down') => {
      commit((draft) => {
        const list = draft.variants[activeDevice].sections;
        const index = list.findIndex((s) => s.id === sectionId);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const [item] = list.splice(index, 1);
        list.splice(targetIndex, 0, item);
      });
    },
    [activeDevice, commit]
  );

  const handleRenameNode = useCallback(
    (sectionId: string, nodeId: string, newName: string) => {
      commit((draft) => {
        const sec = draft.variants[activeDevice].sections.find((s) => s.id === sectionId);
        const node = sec?.nodes.find((n) => n.id === nodeId);
        if (node) node.name = newName;
      });
    },
    [activeDevice, commit]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 text-gray-900 font-sans overflow-hidden select-none">
      {/* TopBar */}
      <CmsTopBar
        templateName={templateName}
        status={status}
        activeDevice={activeDevice}
        activePresetIndex={activePresetIndex}
        zoom={zoom}
        isRotated={isRotated}
        isComparing={isComparing}
        mode={mode}
        saveState={saveState}
        saveError={saveError}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectDevice={handleSelectDevice}
        onSelectPreset={setActivePresetIndex}
        onToggleRotate={() => setIsRotated(!isRotated)}
        onSetZoom={setZoom}
        onToggleCompare={() => setIsComparing(!isComparing)}
        onToggleMode={() => setMode(mode === 'edit' ? 'simulate' : 'edit')}
        onUndo={undo}
        onRedo={redo}
        onOpenRevisions={() => setShowRevisionsModal(true)}
        onOpenPublish={() => setShowPublishModal(true)}
      />

      {/* Main Workspace Area: Left side empty, Canvas centered, Unified Sidebar on the right */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center Canvas */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {isComparing ? (
            <CmsComparisonView
              document={document}
              activeDevice={activeDevice}
              onSelectDevice={handleSelectDevice}
            />
          ) : (
            <CmsCanvas
              document={document}
              device={activeDevice}
              viewport={activeViewport}
              zoom={zoom}
              mode={mode}
              selectedNodeId={selectedNodeId}
              selectedSectionId={selectedSectionId}
              onSelectNode={handleSelectNode}
              onSelectSection={handleSelectSection}
              onUpdateNodeLayout={handleUpdateNodeLayout}
              onConvertToFreeform={handleConvertToFreeform}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
            />
          )}
        </main>

        {/* Right Unified Sidebar: Thành phần, Lớp, Media, Thuộc tính */}
        <CmsRightSidebar
          document={document}
          device={activeDevice}
          selectedNodeId={selectedNodeId}
          selectedSectionId={selectedSectionId}
          onSelectNode={handleSelectNode}
          onSelectSection={handleSelectSection}
          onAddNode={handleAddNode}
          onAddSection={handleAddSection}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onToggleLockNode={handleToggleLockNode}
          onToggleHideNode={handleToggleHideNode}
          onMoveNode={handleMoveNode}
          onDeleteSection={handleDeleteSection}
          onMoveSection={handleMoveSection}
          onRenameNode={handleRenameNode}
          onUpdateDocument={commit}
          onConvertToFreeform={handleConvertToFreeform}
        />
      </div>

      {/* Modals */}
      <CmsPublishModal
        templateId={templateId}
        templateName={templateName}
        document={document}
        currentVersion={version.current}
        campaigns={campaigns}
        token={token}
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onPublished={(newVersion) => {
          markVersion(newVersion);
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
        onRestored={(newVersion, newLayout) => {
          markVersion(newVersion);
          commit(() => clone(newLayout));
        }}
      />
    </div>
  );
}
