'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import DeviceFrame, { type DeviceFrameHandle } from './DeviceFrame';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import {
  type TemplateDocumentV2,
  type DeviceVariant,
  type Viewport,
  type DesignNode,
  type DesignSection,
  type NodeLayout,
} from '@/lib/template-document';
import { Lock, EyeOff } from 'lucide-react';

interface CmsCanvasProps {
  document: TemplateDocumentV2;
  device: DeviceVariant;
  viewport: Viewport;
  zoom: number;
  mode: 'edit' | 'simulate';
  selectedNodeId: string | null;
  selectedSectionId: string | null;
  onSelectNode: (nodeId: string | null, sectionId?: string | null) => void;
  onSelectSection: (sectionId: string | null) => void;
  onUpdateNodeLayout: (sectionId: string, nodeId: string, newLayout: NodeLayout) => void;
  onConvertToFreeform?: (sectionId: string) => void;
  onDeleteNode: (sectionId: string, nodeId: string) => void;
  onDuplicateNode: (sectionId: string, nodeId: string) => void;
  onFitZoom?: (zoom: number) => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export default function CmsCanvas({
  document: doc,
  device,
  viewport,
  zoom,
  mode,
  selectedNodeId,
  selectedSectionId,
  onSelectNode,
  onSelectSection,
  onUpdateNodeLayout,
  onConvertToFreeform,
  onDeleteNode,
  onDuplicateNode,
}: CmsCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceFrameRef = useRef<DeviceFrameHandle>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging & resizing active states
  const [dragActive, setDragActive] = useState(false);
  const [resizeActive, setResizeActive] = useState<ResizeHandle | null>(null);

  const activeVariant = doc.variants[device];

  // Find selected node and section
  let selectedNode: DesignNode | null = null;
  let activeSection: DesignSection | null = null;

  for (const s of activeVariant.sections) {
    if (s.id === selectedSectionId) activeSection = s;
    for (const n of s.nodes) {
      if (n.id === selectedNodeId) {
        selectedNode = n;
        activeSection = s;
        break;
      }
    }
  }

  // Handle Drag Start
  const handleDragStart = useCallback(
    (e: React.MouseEvent, node: DesignNode, section: DesignSection) => {
      if (e.button !== 0 || node.locked) return;
      e.stopPropagation();
      e.preventDefault();

      if (section.mode === 'flow' && onConvertToFreeform) {
        onConvertToFreeform(section.id);
      }

      const startScreenX = e.screenX;
      const startScreenY = e.screenY;
      const initialX = node.layout.x || 0;
      const initialY = node.layout.y || 0;

      setDragActive(true);

      const iframeDoc = deviceFrameRef.current?.getIframeDocument();
      const iframeWin = deviceFrameRef.current?.getIframeWindow();

      const onMouseMove = (moveEvt: MouseEvent) => {
        moveEvt.preventDefault();
        const deltaX = (moveEvt.screenX - startScreenX) / zoom;
        const deltaY = (moveEvt.screenY - startScreenY) / zoom;

        const snap = !moveEvt.altKey;
        let nextX = initialX + deltaX;
        let nextY = initialY + deltaY;

        if (snap) {
          nextX = Math.round(nextX / 4) * 4;
          nextY = Math.round(nextY / 4) * 4;
        }

        nextX = Math.max(0, Math.round(nextX));
        nextY = Math.max(0, Math.round(nextY));

        onUpdateNodeLayout(section.id, node.id, {
          ...node.layout,
          x: nextX,
          y: nextY,
        });
      };

      const onMouseUp = () => {
        setDragActive(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (iframeDoc) {
          iframeDoc.removeEventListener('mousemove', onMouseMove);
          iframeDoc.removeEventListener('mouseup', onMouseUp);
        }
        if (iframeWin) {
          iframeWin.removeEventListener('mousemove', onMouseMove);
          iframeWin.removeEventListener('mouseup', onMouseUp);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      if (iframeDoc) {
        iframeDoc.addEventListener('mousemove', onMouseMove);
        iframeDoc.addEventListener('mouseup', onMouseUp);
      }
      if (iframeWin) {
        iframeWin.addEventListener('mousemove', onMouseMove);
        iframeWin.addEventListener('mouseup', onMouseUp);
      }
    },
    [zoom, onConvertToFreeform, onUpdateNodeLayout]
  );

  // Handle Resize Start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle, node: DesignNode, section: DesignSection) => {
      if (e.button !== 0 || node.locked) return;
      e.stopPropagation();
      e.preventDefault();

      if (section.mode === 'flow' && onConvertToFreeform) {
        onConvertToFreeform(section.id);
      }

      const startScreenX = e.screenX;
      const startScreenY = e.screenY;
      const initialLayout = { ...node.layout };
      const keepRatio = e.shiftKey || ['image', 'video', 'logo'].includes(node.element.type);

      setResizeActive(handle);

      const iframeDoc = deviceFrameRef.current?.getIframeDocument();
      const iframeWin = deviceFrameRef.current?.getIframeWindow();

      const onMouseMove = (moveEvt: MouseEvent) => {
        moveEvt.preventDefault();
        const deltaX = (moveEvt.screenX - startScreenX) / zoom;
        const deltaY = (moveEvt.screenY - startScreenY) / zoom;

        let newW = initialLayout.width;
        let newH = initialLayout.height;
        let newX = initialLayout.x;
        let newY = initialLayout.y;

        if (handle.includes('e')) newW = Math.max(16, initialLayout.width + deltaX);
        if (handle.includes('s')) newH = Math.max(8, initialLayout.height + deltaY);
        if (handle.includes('w')) {
          const potW = Math.max(16, initialLayout.width - deltaX);
          newX = initialLayout.x + (initialLayout.width - potW);
          newW = potW;
        }
        if (handle.includes('n')) {
          const potH = Math.max(8, initialLayout.height - deltaY);
          newY = initialLayout.y + (initialLayout.height - potH);
          newH = potH;
        }

        if (keepRatio && initialLayout.width > 0) {
          const ratio = initialLayout.height / initialLayout.width;
          if (handle === 'e' || handle === 'w') {
            newH = Math.round(newW * ratio);
          } else {
            newW = Math.round(newH / ratio);
          }
        }

        onUpdateNodeLayout(section.id, node.id, {
          ...node.layout,
          x: Math.max(0, Math.round(newX)),
          y: Math.max(0, Math.round(newY)),
          width: Math.max(16, Math.round(newW)),
          height: Math.max(8, Math.round(newH)),
        });
      };

      const onMouseUp = () => {
        setResizeActive(null);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (iframeDoc) {
          iframeDoc.removeEventListener('mousemove', onMouseMove);
          iframeDoc.removeEventListener('mouseup', onMouseUp);
        }
        if (iframeWin) {
          iframeWin.removeEventListener('mousemove', onMouseMove);
          iframeWin.removeEventListener('mouseup', onMouseUp);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      if (iframeDoc) {
        iframeDoc.addEventListener('mousemove', onMouseMove);
        iframeDoc.addEventListener('mouseup', onMouseUp);
      }
      if (iframeWin) {
        iframeWin.addEventListener('mousemove', onMouseMove);
        iframeWin.addEventListener('mouseup', onMouseUp);
      }
    },
    [zoom, onConvertToFreeform, onUpdateNodeLayout]
  );

  // Resize handle CSS helper
  const getHandleStyle = (handle: ResizeHandle): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 9,
      height: 9,
      backgroundColor: '#ffffff',
      border: '2px solid #2563eb',
      borderRadius: 2,
      zIndex: 50,
      boxSizing: 'border-box',
    };
    switch (handle) {
      case 'nw': return { ...base, top: -4, left: -4, cursor: 'nwse-resize' };
      case 'n': return { ...base, top: -4, left: '50%', marginLeft: -4.5, cursor: 'ns-resize' };
      case 'ne': return { ...base, top: -4, right: -4, cursor: 'nesw-resize' };
      case 'e': return { ...base, top: '50%', right: -4, marginTop: -4.5, cursor: 'ew-resize' };
      case 'se': return { ...base, bottom: -4, right: -4, cursor: 'nwse-resize' };
      case 's': return { ...base, bottom: -4, left: '50%', marginLeft: -4.5, cursor: 'ns-resize' };
      case 'sw': return { ...base, bottom: -4, left: -4, cursor: 'nesw-resize' };
      case 'w': return { ...base, top: '50%', left: -4, marginTop: -4.5, cursor: 'ew-resize' };
    }
  };

  // Node Overlay inside DocumentRenderer (rendered directly within node wrapper)
  const renderNodeOverlay = useCallback(
    (node: DesignNode, section: DesignSection): React.ReactNode => {
      if (mode !== 'edit') return null;

      const isSelected = selectedNodeId === node.id;
      const isLocked = node.locked;

      if (!isSelected) {
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              cursor: isLocked ? 'not-allowed' : 'pointer',
              boxSizing: 'border-box',
            }}
            className="group hover:ring-2 hover:ring-blue-400/80 hover:ring-dashed hover:bg-blue-500/5 rounded transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(node.id, section.id);
            }}
            onMouseDown={(e) => {
              if (e.button !== 0 || isLocked) return;
              e.stopPropagation();
              onSelectNode(node.id, section.id);
              handleDragStart(e, node, section);
            }}
          />
        );
      }

      // ACTIVE SELECTION OVERLAY
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            outline: '2px solid #2563eb',
            outlineOffset: 0,
            cursor: isLocked ? 'not-allowed' : 'move',
            boxSizing: 'border-box',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            if (e.button !== 0 || isLocked) return;
            handleDragStart(e, node, section);
          }}
        >
          {/* Label Badge */}
          <div
            style={{
              position: 'absolute',
              top: -24,
              left: 0,
              zIndex: 50,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            }}
          >
            <span>{node.name}</span>
            <span style={{ opacity: 0.8, fontFamily: 'monospace', fontSize: 9 }}>
              {Math.round(node.layout.width)}×{Math.round(node.layout.height)}
            </span>
            {isLocked && <Lock style={{ width: 10, height: 10, color: '#fcd34d' }} />}
            {node.hidden && <EyeOff style={{ width: 10, height: 10, color: '#d1d5db' }} />}
          </div>

          {/* Resize Handles */}
          {!isLocked &&
            (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => (
              <div
                key={handle}
                style={getHandleStyle(handle)}
                onMouseDown={(e) => handleResizeStart(e, handle, node, section)}
              />
            ))}
        </div>
      );
    },
    [mode, selectedNodeId, onSelectNode, handleDragStart, handleResizeStart]
  );

  // Space key panning and keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      } else if (e.key === 'Escape') {
        onSelectNode(null, null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && activeSection) {
        if (!selectedNode.locked) {
          e.preventDefault();
          onDeleteNode(activeSection.id, selectedNode.id);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedNode && activeSection) {
        e.preventDefault();
        onDuplicateNode(activeSection.id, selectedNode.id);
      } else if (selectedNode && activeSection && !selectedNode.locked) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          if (activeSection.mode === 'flow' && onConvertToFreeform) {
            onConvertToFreeform(activeSection.id);
          }
          onUpdateNodeLayout(activeSection.id, selectedNode.id, {
            ...selectedNode.layout,
            x: Math.max(0, (selectedNode.layout.x || 0) + dx),
            y: Math.max(0, (selectedNode.layout.y || 0) + dy),
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNode, activeSection, onSelectNode, onDeleteNode, onDuplicateNode, onUpdateNodeLayout, onConvertToFreeform]);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (containerRef.current) {
        setScrollStart({
          x: containerRef.current.scrollLeft,
          y: containerRef.current.scrollTop,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && containerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      containerRef.current.scrollLeft = scrollStart.x - dx;
      containerRef.current.scrollTop = scrollStart.y - dy;
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-auto bg-gray-100 select-none flex ${
        isSpacePressed ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #d1d5db 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => {
        if (!dragActive && !resizeActive) {
          onSelectNode(null, null);
          onSelectSection(null);
        }
      }}
    >
      {/* Device Frame Wrapper: centered using m-auto so it never gets cut off when overflowing */}
      <div
        className="m-auto p-6 md:p-10 flex flex-col items-center justify-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DeviceFrame
          ref={deviceFrameRef}
          device={device}
          viewport={viewport}
          zoom={zoom}
          title={`Bản xem trước ${device}`}
          onNodeClick={(nodeId, sectionId) => onSelectNode(nodeId, sectionId || null)}
        >
          <DocumentRenderer
            document={doc}
            variant={device}
            viewport={viewport}
            mode={mode}
            renderNodeOverlay={renderNodeOverlay}
            onSelectNode={onSelectNode}
            selectedNodeId={selectedNodeId}
          />
        </DeviceFrame>
      </div>

      {/* Global Drag Shield: prevents iframe mouse trapping during drag or resize */}
      {(dragActive || resizeActive) && (
        <div
          className="fixed inset-0 z-[9999] select-none"
          style={{ cursor: dragActive ? 'move' : 'crosshair' }}
        />
      )}
    </div>
  );
}
