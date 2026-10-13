'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  TemplateConfig,
  TemplateElement,
  LogoElement,
  TitleElement,
  DescriptionElement,
  ImageElement,
  ImageSliderElement,
  VideoElement,
  ConnectButtonElement,
  VideoGateElement,
  AnnouncementElement,
  SpacerElement,
} from '@/types';
import {
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Image as ImageIcon,
  Type,
  FileText,
  Film,
  Wifi,
  PlayCircle,
  Upload,
  Monitor,
  Smartphone,
  Tablet,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Move,
  Layers,
  X,
  Minus,
  FolderOpen,
  Bell,
} from 'lucide-react';

interface Props {
  config: TemplateConfig;
  onSave: (config: TemplateConfig) => void;
}

const ELEMENT_LABELS: Record<string, string> = {
  logo: 'Logo', title: 'Tiêu đề', description: 'Mô tả', image: 'Hình ảnh',
  image_slider: 'Slider ảnh', video: 'Video', connect_button: 'Nút kết nối',
  video_gate: 'Video Gate', announcement: 'Thông báo', spacer: 'Khoảng trắng',
};

const ELEMENT_ICONS: Record<string, React.ReactNode> = {
  logo: <ImageIcon className="w-4 h-4" />, title: <Type className="w-4 h-4" />,
  description: <FileText className="w-4 h-4" />, image: <ImageIcon className="w-4 h-4" />,
  image_slider: <Layers className="w-4 h-4" />, video: <Film className="w-4 h-4" />,
  connect_button: <Wifi className="w-4 h-4" />, video_gate: <PlayCircle className="w-4 h-4" />,
  announcement: <Bell className="w-4 h-4" />, spacer: <Minus className="w-4 h-4" />,
};

type TabId = 'background' | 'elements';
type PreviewMode = 'mobile' | 'tablet' | 'laptop';

const PREVIEW_SIZES: Record<PreviewMode, { width: number; label: string }> = {
  mobile: { width: 375, label: 'Mobile' },
  tablet: { width: 768, label: 'Tablet' },
  laptop: { width: 1280, label: 'Laptop' },
};

export default function PageBuilder({ config, onSave }: Props) {
  const [localConfig, setLocalConfig] = useState<TemplateConfig>(config);
  const [activeTab, setActiveTab] = useState<TabId>('elements');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('mobile');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingElId, setDraggingElId] = useState<string | null>(null);

  const updateConfig = useCallback((updater: (prev: TemplateConfig) => TemplateConfig) => {
    setLocalConfig(prev => updater(prev));
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<TemplateElement>) => {
    updateConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } as TemplateElement : el),
    }));
  }, [updateConfig]);

  const removeElement = useCallback((id: string) => {
    updateConfig(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== id) }));
    setSelectedElementId(null);
  }, [updateConfig]);

  const toggleElement = useCallback((id: string) => {
    updateConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, enabled: !el.enabled } as TemplateElement : el),
    }));
  }, [updateConfig]);

  const moveElement = useCallback((index: number, direction: 'up' | 'down') => {
    updateConfig(prev => {
      const elements = [...prev.elements];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= elements.length) return prev;
      [elements[index], elements[targetIndex]] = [elements[targetIndex], elements[index]];
      return { ...prev, elements };
    });
  }, [updateConfig]);

  const addElement = useCallback((type: TemplateElement['type']) => {
    const id = `${type}-${Date.now()}`;
    let newElement: TemplateElement;
    switch (type) {
      case 'logo': newElement = { id, type: 'logo', enabled: true, src: '', width: '120px', position: 'center' }; break;
      case 'title': newElement = { id, type: 'title', enabled: true, content: 'Tiêu đề mới', color: '#ffffff', fontSize: '24px', align: 'center' }; break;
      case 'description': newElement = { id, type: 'description', enabled: true, content: 'Mô tả nội dung', color: '#ffffff', fontSize: '14px' }; break;
      case 'image': newElement = { id, type: 'image', enabled: true, src: '', alt: '', width: '100%', height: 'auto', borderRadius: '8px', objectFit: 'cover', zoom: 1, posX: 0, posY: 0 }; break;
      case 'image_slider': newElement = { id, type: 'image_slider', enabled: true, images: [], height: '200px', borderRadius: '8px', objectFit: 'cover', autoplay: true, interval: 3 }; break;
      case 'video': newElement = { id, type: 'video', enabled: true, src: '', autoplay: true, muted: true, loop: true, controls: false, poster: '', aspectRatio: '16:9', frameWidth: '100%' }; break;
      case 'connect_button':
        newElement = {
          id,
          type: 'connect_button',
          enabled: true,
          text: 'Kết nối ngay',
          color: '#ffffff',
          bgColor: '#3b82f6',
          radius: '50px',
          buttonWidth: '100%',
          showPhone: false,
          phonePlaceholder: 'Nhập số điện thoại',
          termsText: '',
          requireConfirm: false,
          confirmMessage: '',
        };
        break;
      case 'video_gate': newElement = { id, type: 'video_gate', enabled: true, videoUrl: '', skipAfter: 5, poster: '', aspectRatio: '16:9', frameWidth: '90%', dialogTitle: 'Xem video để kết nối WiFi', dialogMessage: 'Vui lòng xem video quảng cáo trước khi kết nối WiFi miễn phí.', muted: true }; break;
      case 'announcement': newElement = { id, type: 'announcement', enabled: true, title: 'Thông báo quan trọng', message: 'Nội dung thông báo của bạn...', titleBold: true, titleFontSize: '20px', titleColor: '#1e293b', messageColor: '#475569', bgColor: '#ffffff', buttonText: 'Đóng', buttonBgColor: '#3b82f6', buttonTextColor: '#ffffff', skipAfter: 5, borderRadius: '16px' }; break;
      case 'spacer': newElement = { id, type: 'spacer', enabled: true, height: '20px', heightDesktop: '20px' }; break;
      default: return;
    }
    updateConfig(prev => ({ ...prev, elements: [...prev.elements, newElement] }));
    setSelectedElementId(id);
    setActiveTab('elements');
  }, [updateConfig]);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return; }
    updateConfig(prev => {
      const elements = [...prev.elements];
      const [moved] = elements.splice(dragIndex, 1);
      elements.splice(index, 0, moved);
      return { ...prev, elements };
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const updateElementPosition = useCallback((id: string, x: number, y: number) => {
    updateConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== id) return el;
        if (el.type === 'logo') return { ...el, canvasPosition: { x, y }, position: 'center' } as LogoElement;
        if (el.type === 'title') return { ...el, canvasPosition: { x, y } } as TitleElement;
        if (el.type === 'description') return { ...el, canvasPosition: { x, y } } as DescriptionElement;
        if (el.type === 'image') return { ...el, canvasPosition: { x, y } } as ImageElement;
        if (el.type === 'image_slider') return { ...el, canvasPosition: { x, y } } as ImageSliderElement;
        if (el.type === 'video') return { ...el, canvasPosition: { x, y } } as VideoElement;
        if (el.type === 'connect_button') return { ...el, canvasPosition: { x, y } } as ConnectButtonElement;
        if (el.type === 'spacer') return { ...el, canvasPosition: { x, y } } as SpacerElement;
        return el;
      }),
    }));
  }, [updateConfig]);

  const resetElementPosition = useCallback((id: string) => {
    updateConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== id) return el;
        if (el.type === 'logo') return { ...el, canvasPosition: null } as LogoElement;
        if (el.type === 'title') return { ...el, canvasPosition: null } as TitleElement;
        if (el.type === 'description') return { ...el, canvasPosition: null } as DescriptionElement;
        if (el.type === 'image') return { ...el, canvasPosition: null } as ImageElement;
        if (el.type === 'image_slider') return { ...el, canvasPosition: null } as ImageSliderElement;
        if (el.type === 'video') return { ...el, canvasPosition: null } as VideoElement;
        if (el.type === 'connect_button') return { ...el, canvasPosition: null } as ConnectButtonElement;
        if (el.type === 'spacer') return { ...el, canvasPosition: null } as SpacerElement;
        return el;
      }),
    }));
  }, [updateConfig]);

  const handleSave = () => onSave(localConfig);
  const selectedElement = localConfig.elements.find(el => el.id === selectedElementId);
  const previewSize = PREVIEW_SIZES[previewMode];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['mobile', 'tablet', 'laptop'] as PreviewMode[]).map(mode => {
              const Icon = mode === 'mobile' ? Smartphone : mode === 'tablet' ? Tablet : Monitor;
              return (
                <button key={mode} onClick={() => setPreviewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${previewMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Icon className="w-4 h-4" />{PREVIEW_SIZES[mode].label}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={handleSave} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold shadow-sm">
          Lưu giao diện
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-start justify-center p-6 overflow-auto bg-slate-100">
          <div className="transition-all duration-300 flex-shrink-0 flex flex-col items-center" style={{ width: previewMode === 'laptop' ? '100%' : `${previewSize.width}px`, maxWidth: '100%' }}>
            {previewMode === 'laptop' ? (
              /* Monitor frame for PC/Laptop - 16:9 */
              <div className="flex flex-col items-center w-full" style={{ maxWidth: '900px' }}>
                <div className="w-full bg-slate-800 rounded-t-xl p-2 shadow-2xl border border-slate-700">
                  <div className="flex items-center gap-1.5 px-2 mb-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <div className="flex-1 mx-2 bg-slate-700 rounded-md px-3 py-0.5 text-[10px] text-slate-400 text-center truncate">wifi.jtsc.vn/portal</div>
                  </div>
                    <div className="bg-white rounded-md overflow-hidden" style={{ aspectRatio: '16/9', overflowY: 'auto', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
                      <PhonePreview
                        config={localConfig} selectedId={selectedElementId}
                        onSelectElement={setSelectedElementId} previewMode={previewMode}
                        draggingElId={draggingElId}
                        onDragElStart={setDraggingElId}
                        onDragElMove={(id, x, y) => { updateElementPosition(id, x, y); }}
                        onDragElEnd={() => setDraggingElId(null)}
                        updateElementPosition={updateElementPosition}
                        resetElementPosition={resetElementPosition}
                      />
                    </div>
                </div>
                <div className="w-24 h-6 bg-slate-700 rounded-b-sm" />
                <div className="w-40 h-2 bg-slate-600 rounded-b-lg" />
              </div>
            ) : (
              <div className="bg-slate-800 rounded-[2.5rem] p-3 shadow-2xl">
                <div className="flex justify-center mb-1"><div className="w-20 h-4 bg-slate-800 rounded-b-xl" /></div>
                <div className="bg-white overflow-hidden rounded-[2rem]" style={{ minHeight: previewMode === 'mobile' ? '667px' : '500px', maxHeight: '80vh', overflowY: 'auto' }}>
                  <PhonePreview
                    config={localConfig} selectedId={selectedElementId}
                    onSelectElement={setSelectedElementId} previewMode={previewMode}
                    draggingElId={draggingElId}
                    onDragElStart={setDraggingElId}
                    onDragElMove={(id, x, y) => { updateElementPosition(id, x, y); }}
                    onDragElEnd={() => setDraggingElId(null)}
                    updateElementPosition={updateElementPosition}
                    resetElementPosition={resetElementPosition}
                  />
                </div>
                <div className="flex justify-center mt-2"><div className="w-8 h-8 rounded-full border-2 border-slate-600" /></div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop sidebar / Mobile bottom sheet */}
        <div className="hidden md:flex w-[360px] bg-white border-l border-slate-200 flex-col shrink-0 overflow-hidden">
          <div className="flex border-b border-slate-200 shrink-0">
            <button onClick={() => { setActiveTab('background'); setSelectedElementId(null); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'background' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Hình nền</button>
            <button onClick={() => setActiveTab('elements')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'elements' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Thành phần</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'background' && <BackgroundPanel config={localConfig} updateConfig={updateConfig} />}
            {activeTab === 'elements' && !selectedElement && (
              <ElementListPanel elements={localConfig.elements} onSelect={setSelectedElementId} onToggle={toggleElement} onRemove={removeElement} onAdd={addElement} onMove={moveElement} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} dragOverIndex={dragOverIndex} />
            )}
            {activeTab === 'elements' && selectedElement && (
              <ElementEditorPanel element={selectedElement} onUpdate={updateElement} onBack={() => setSelectedElementId(null)} />
            )}
          </div>
        </div>

        {/* Mobile: Fixed bottom bar with FAB */}
        <MobileSidebar
          config={localConfig}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedElement={selectedElement}
          onSelectElement={(id) => { setSelectedElementId(id); setActiveTab('elements'); }}
          onToggle={toggleElement}
          onRemove={removeElement}
          onAdd={addElement}
          onMove={moveElement}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          dragOverIndex={dragOverIndex}
          onUpdate={updateElement}
          onBack={() => setSelectedElementId(null)}
          updateConfig={updateConfig}
        />
      </div>
    </div>
  );
}

// ============================================
// Phone Preview
// ============================================
interface PhonePreviewProps {
  config: TemplateConfig;
  selectedId: string | null;
  onSelectElement: (id: string) => void;
  previewMode: PreviewMode;
  draggingElId?: string | null;
  onDragElStart?: (id: string) => void;
  onDragElMove?: (id: string, x: number, y: number) => void;
  onDragElEnd?: () => void;
  updateElementPosition?: (id: string, x: number, y: number) => void;
  resetElementPosition?: (id: string) => void;
}

function PhonePreview({
  config, selectedId, onSelectElement, previewMode,
  draggingElId,
  onDragElStart, onDragElMove, onDragElEnd,
  updateElementPosition, resetElementPosition,
}: PhonePreviewProps) {
  const bg = config.background;
  const isDesktop = previewMode === 'laptop' || previewMode === 'tablet';
  const bgImage = isDesktop ? (bg.imageDesktop || bg.imageMobile) : (bg.imageMobile || bg.imageDesktop);
  const bgVideo = isDesktop ? (bg.videoDesktop || bg.videoMobile) : (bg.videoMobile || bg.videoDesktop);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingElId || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onDragElMove?.(draggingElId, x, y);
  }, [draggingElId, onDragElMove]);

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingElId) {
      onDragElEnd?.();
    }
  }, [draggingElId, onDragElEnd]);

  const allVisible = config.elements.filter(el => el.enabled && el.type !== 'video_gate' && el.type !== 'announcement');
  const canvasElements = allVisible.filter(el => (el as { canvasPosition?: unknown }).canvasPosition != null);
  const flexElements = allVisible.filter(el => (el as { canvasPosition?: unknown }).canvasPosition == null);

  return (
    <div
      ref={previewRef}
      className="relative"
      style={{ minHeight: previewMode === 'mobile' ? '667px' : previewMode === 'tablet' ? '500px' : '100%', flex: previewMode === 'laptop' ? 1 : undefined, cursor: draggingElId ? 'grabbing' : 'default' }}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {bgVideo ? (
          <video src={bgVideo} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: (bg.type || 'cover') as React.CSSProperties['objectFit'] }} />
        ) : bgImage ? (
          <div style={{ width: '100%', height: '100%', backgroundImage: `url(${bgImage})`, backgroundSize: bg.type || 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#1e293b' }} />
        )}
        {bg.overlayOpacity > 0 && <div className="absolute inset-0" style={{ backgroundColor: bg.overlayColor, opacity: bg.overlayOpacity }} />}
      </div>

      {/* Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 15 }}>
        <div className="relative" style={{ width: '80px', height: '80px', opacity: 0.12, filter: 'blur(0.5px)' }}>
          <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Canvas overlay / draggable elements */}
      {canvasElements.length > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
          <div className="absolute left-0 top-0 right-0 bottom-0" style={{ border: '1px dashed rgba(139,92,246,0.3)' }} />
        </div>
      )}
      {canvasElements.map(el => {
        const cp = (el as { canvasPosition?: { x: number; y: number } | null }).canvasPosition;
        if (cp == null) return null;
        const isSelected = selectedId === el.id;
        const isDragging = draggingElId === el.id;
        return (
          <div
            key={el.id}
            className="absolute"
            style={{
              left: `${cp.x}%`, top: `${cp.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isSelected ? 20 : 10,
              cursor: isDragging ? 'grabbing' : 'grab',
              outline: isSelected ? '2px solid #8b5cf6' : isDragging ? '2px solid #a78bfa' : '2px solid transparent',
              outlineOffset: '2px',
              pointerEvents: 'auto',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectElement(el.id);
              if (!isDragging) onDragElStart?.(el.id);
            }}
          >
            <PreviewElement element={el} isDesktop={isDesktop} previewMode={previewMode} />
          </div>
        );
      })}

      {/* Normal flow elements */}
      <div className="relative z-10" style={{ padding: bg.padding || '20px' }}>
        {flexElements.map(el => (
          <div key={el.id} className={`relative cursor-pointer transition-all rounded-lg mb-1 ${selectedId === el.id ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:ring-1 hover:ring-blue-300 hover:ring-offset-1'}`}
            onClick={(e) => { e.stopPropagation(); onSelectElement(el.id); }}>
            <PreviewElement element={el} isDesktop={isDesktop} previewMode={previewMode} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewElement({ element, isDesktop, previewMode }: { element: TemplateElement; isDesktop?: boolean; previewMode?: PreviewMode }) {
  switch (element.type) {
    case 'logo': {
      const el = element as LogoElement;
      const justify = el.position === 'left' ? 'flex-start' : el.position === 'right' ? 'flex-end' : 'center';
      return (
        <div style={{ display: 'flex', justifyContent: justify, padding: '12px 0' }}>
          {el.src ? <img src={el.src} alt="Logo" style={{ width: el.width, height: 'auto', objectFit: 'contain' }} />
            : <div className="flex items-center justify-center border-2 border-dashed border-white/30 rounded-lg bg-white/10 text-white/50 text-xs" style={{ width: el.width, height: '60px' }}>LOGO</div>}
        </div>
      );
    }
    case 'title': { const el = element as TitleElement; const s: React.CSSProperties = { padding: '8px 0', textAlign: el.align, color: el.color, fontSize: el.fontSize, fontWeight: 700 }; if (el.textShadow) s.textShadow = el.textShadow; if (el.textStroke) (s as Record<string,unknown>).WebkitTextStroke = `${el.textStroke} ${el.textStrokeColor || '#000'}`; return <div style={s}>{el.content || 'Tiêu đề'}</div>; }
    case 'description': { const el = element as DescriptionElement; const s: React.CSSProperties = { padding: '4px 0', textAlign: 'center', color: el.color, fontSize: el.fontSize }; if (el.textShadow) s.textShadow = el.textShadow; if (el.textStroke) (s as Record<string,unknown>).WebkitTextStroke = `${el.textStroke} ${el.textStrokeColor || '#000'}`; return <div style={s}>{el.content || 'Mô tả'}</div>; }
    case 'image': {
      const el = element as ImageElement;
      const zoom = el.zoom || 1; const posX = el.posX || 0; const posY = el.posY || 0;
      const imgSrc = isDesktop && el.srcDesktop ? el.srcDesktop : el.src;
      return (
        <div style={{ padding: '8px 0' }}>
          {imgSrc ? (
            <div style={{ overflow: 'hidden', borderRadius: el.borderRadius, width: el.width, height: el.height === 'auto' ? 'auto' : el.height }}>
              <img src={imgSrc} alt={el.alt} style={{ width: '100%', height: el.height === 'auto' ? 'auto' : '100%', objectFit: el.objectFit, objectPosition: `calc(50% + ${posX}px) calc(50% + ${posY}px)`, transform: `scale(${zoom})`, transformOrigin: 'center', display: 'block', transition: 'transform 0.2s' }} />
            </div>
          ) : <div className="w-full flex items-center justify-center border-2 border-dashed border-white/30 rounded-lg bg-white/10 text-white/50 text-xs" style={{ height: '120px', borderRadius: el.borderRadius }}>Chọn hình ảnh</div>}
        </div>
      );
    }
    case 'image_slider': return <SliderPreview el={element as ImageSliderElement} isDesktop={isDesktop} />;
    case 'video': {
      const el = element as VideoElement;
      const aspectMap: Record<string, string> = { '16:9': '16/9', '9:16': '9/16', '4:3': '4/3', 'auto': 'auto' };
      const frameWidth = isDesktop ? (el.frameWidthDesktop || el.frameWidth || '100%') : (el.frameWidth || '100%');
      return (
        <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
          {el.src ? (
            <div style={{ width: frameWidth, maxWidth: '100%', borderRadius: '12px', overflow: 'hidden', aspectRatio: aspectMap[el.aspectRatio || 'auto'] || 'auto', background: '#000' }}>
              <video src={el.src} muted={el.muted} autoPlay={el.autoplay} loop={el.loop} playsInline poster={el.poster || undefined} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }} />
            </div>
          ) : <div className="w-full flex items-center justify-center border-2 border-dashed border-white/30 rounded-lg bg-white/10 text-white/50 text-xs gap-2" style={{ height: '180px', borderRadius: '12px' }}><Film className="w-6 h-6 opacity-50" /> Chọn video</div>}
        </div>
      );
    }
    case 'connect_button': {
      const el = element as ConnectButtonElement;
      const buttonWidth = isDesktop ? (el.buttonWidthDesktop || el.buttonWidth || '100%') : (el.buttonWidth || '100%');
      return (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: buttonWidth, maxWidth: '100%' }}>
            {el.showPhone && <input type="text" placeholder={el.phonePlaceholder} disabled style={{ width: '100%', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: el.radius, fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.9)', color: '#333' }} />}
            {el.imageSrc ? <img src={el.imageSrc} alt={el.text} style={{ width: isDesktop ? (el.imageWidthDesktop || el.imageWidth || '100%') : (el.imageWidth || '100%'), maxWidth: '100%', borderRadius: el.radius, display: 'block', cursor: 'default', margin: '0 auto' }} />
              : <button disabled style={{ width: '100%', padding: '14px', background: el.bgColor, color: el.color, border: 'none', borderRadius: el.radius, fontSize: '16px', fontWeight: 600, cursor: 'default' }}>{el.text}</button>}
            {el.termsText && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: '8px' }}>{el.termsText}</p>}
          </div>
        </div>
      );
    }
    case 'spacer': {
      const el = element as SpacerElement;
      const spacerHeight = isDesktop ? (el.heightDesktop || el.height || '20px') : (el.height || '20px');
      return <div style={{ height: spacerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '60%', height: '1px', borderTop: '1px dashed rgba(255,255,255,0.3)' }} /></div>;
    }
    case 'announcement': {
      const el = element as AnnouncementElement;
      const titleStyle: React.CSSProperties = {
        fontWeight: el.titleBold ? 700 : 600,
        fontStyle: el.titleItalic ? 'italic' : 'normal',
        color: el.titleColor || '#1e293b',
        fontSize: el.titleFontSize || '18px',
        marginBottom: '8px',
      };
      const msgStyle: React.CSSProperties = {
        fontWeight: el.messageBold ? 600 : 400,
        fontStyle: el.messageItalic ? 'italic' : 'normal',
        color: el.messageColor || '#475569',
        fontSize: el.messageFontSize || '13px',
        marginBottom: '12px',
      };
      const dialogWidth = isDesktop ? (el.dialogMaxWidthDesktop || el.dialogMaxWidth || '400px') : (el.dialogMaxWidth || '400px');
      return (
        <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: el.bgColor, borderRadius: el.borderRadius || '16px', padding: '16px', maxWidth: dialogWidth, margin: '0 auto', textAlign: 'center' }}>
            <div style={titleStyle}>{el.title}</div>
            <div style={msgStyle}>{el.message}</div>
            <div style={{ padding: '8px 20px', background: el.buttonBgColor, color: el.buttonTextColor, borderRadius: '8px', display: 'inline-block', fontSize: '13px', fontWeight: 600 }}>{el.buttonText}</div>
          </div>
        </div>
      );
    }
    default: return null;
  }
}

function SliderPreview({ el, isDesktop }: { el: ImageSliderElement; isDesktop?: boolean }) {
  const [current, setCurrent] = useState(0);
  const images = isDesktop && el.imagesDesktop && el.imagesDesktop.length > 0 ? el.imagesDesktop : (el.images || []);
  const height = isDesktop && el.heightDesktop ? el.heightDesktop : (el.height || '200px');
  useEffect(() => {
    if (!el.autoplay || images.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % images.length), (el.interval || 3) * 1000);
    return () => clearInterval(timer);
  }, [el.autoplay, el.interval, images.length]);

  if (images.length === 0) return <div style={{ padding: '8px 0' }}><div className="w-full flex items-center justify-center border-2 border-dashed border-white/30 rounded-lg bg-white/10 text-white/50 text-xs gap-2" style={{ height, borderRadius: el.borderRadius }}><Layers className="w-5 h-5 opacity-50" /> Thêm ảnh vào slider</div></div>;

  return (
    <div style={{ padding: '8px 0', position: 'relative' }}>
      <div style={{ overflow: 'hidden', borderRadius: el.borderRadius, height, position: 'relative' }}>
        {images.map((img, i) => <img key={i} src={img.src} alt={img.alt || ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: el.objectFit || 'cover', transition: 'opacity 0.5s ease', opacity: i === current ? 1 : 0 }} />)}
        {images.length > 1 && (
          <>
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 2 }}>
              {images.map((_, i) => <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }} style={{ width: i === current ? '20px' : '8px', height: '8px', borderRadius: '4px', background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />)}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setCurrent(c => (c - 1 + images.length) % images.length); }} style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', zIndex: 2 }}><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); setCurrent(c => (c + 1) % images.length); }} style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', zIndex: 2 }}><ChevronRight className="w-4 h-4" /></button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// Panels
// ============================================

interface MobileSidebarProps {
  config: TemplateConfig;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedElement: TemplateElement | undefined;
  onSelectElement: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: TemplateElement['type']) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  dragOverIndex: number | null;
  onUpdate: (id: string, updates: Partial<TemplateElement>) => void;
  onBack: () => void;
  updateConfig: (fn: (prev: TemplateConfig) => TemplateConfig) => void;
}

function MobileSidebar({
  config, activeTab, setActiveTab, selectedElement, onSelectElement,
  onToggle, onRemove, onAdd, onMove, onDragStart, onDragOver, onDrop, dragOverIndex,
  onUpdate, onBack, updateConfig,
}: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bottom FAB */}
      <div className="md:hidden fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-2 w-64 max-h-[60vh] flex flex-col">
            <div className="flex border-b border-slate-200 shrink-0">
              <button onClick={() => { setActiveTab('background'); setOpen(true); }}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'background' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Nền</button>
              <button onClick={() => { setActiveTab('elements'); setOpen(true); }}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'elements' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Phần tử</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'background' && <BackgroundPanel config={config} updateConfig={updateConfig} />}
              {activeTab === 'elements' && !selectedElement && (
                <div className="p-3">
                  <ElementListPanel
                    elements={config.elements} onSelect={(id) => { onSelectElement(id); }}
                    onToggle={onToggle} onRemove={onRemove} onAdd={onAdd}
                    onMove={onMove} onDragStart={onDragStart} onDragOver={onDragOver}
                    onDrop={onDrop} dragOverIndex={dragOverIndex}
                  />
                </div>
              )}
              {activeTab === 'elements' && selectedElement && (
                <div className="p-3">
                  <ElementEditorPanel element={selectedElement} onUpdate={onUpdate} onBack={onBack} />
                </div>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${open ? 'bg-red-500 rotate-45' : 'bg-blue-600'}`}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
      )}
    </>
  );
}

function BackgroundPanel({ config, updateConfig }: { config: TemplateConfig; updateConfig: (fn: (prev: TemplateConfig) => TemplateConfig) => void }) {
  const bg = config.background;
  const updateBg = (updates: Partial<TemplateConfig['background']>) => updateConfig(prev => ({ ...prev, background: { ...prev.background, ...updates } }));
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-slate-700">Cài đặt hình nền</h3>
      <MediaUploadField label="Hình nền mobile" value={bg.imageMobile || ''} onChange={(v) => updateBg({ imageMobile: v })} accept="image/*" />
      <MediaUploadField label="Hình nền máy tính" value={bg.imageDesktop || ''} onChange={(v) => updateBg({ imageDesktop: v })} accept="image/*" />
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-xs font-semibold text-slate-600 mb-3">Video nền</h4>
        <MediaUploadField label="Video nền mobile" value={bg.videoMobile || ''} onChange={(v) => updateBg({ videoMobile: v })} accept="video/*" />
        <div className="mt-3"><MediaUploadField label="Video nền máy tính" value={bg.videoDesktop || ''} onChange={(v) => updateBg({ videoDesktop: v })} accept="video/*" /></div>
        <p className="text-xs text-slate-400 mt-2">Video nền sẽ ưu tiên hơn hình nền khi có cả hai.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Kiểu nền</label>
        <select value={bg.type} onChange={(e) => updateBg({ type: e.target.value as 'cover' | 'contain' | 'fill' })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="cover">Phủ toàn bộ (Cover)</option><option value="contain">Vừa khung (Contain)</option><option value="fill">Kéo giãn (Fill)</option>
        </select>
      </div>
      <ColorField label="Màu phủ" value={bg.overlayColor} onChange={(v) => updateBg({ overlayColor: v })} />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Độ trong suốt: {Math.round(bg.overlayOpacity * 100)}%</label>
        <input type="range" min="0" max="100" value={Math.round(bg.overlayOpacity * 100)} onChange={(e) => updateBg({ overlayOpacity: parseInt(e.target.value) / 100 })} className="w-full accent-blue-600" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Khoảng đệm (padding)</label>
        <input type="text" value={bg.padding} onChange={(e) => updateBg({ padding: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="20px" />
      </div>
    </div>
  );
}

function ElementListPanel({ elements, onSelect, onToggle, onRemove, onAdd, onMove, onDragStart, onDragOver, onDrop, dragOverIndex }: {
  elements: TemplateElement[]; onSelect: (id: string) => void; onToggle: (id: string) => void; onRemove: (id: string) => void;
  onAdd: (type: TemplateElement['type']) => void; onMove: (index: number, direction: 'up' | 'down') => void;
  onDragStart: (index: number) => void; onDragOver: (e: React.DragEvent, index: number) => void; onDrop: (index: number) => void; dragOverIndex: number | null;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addableTypes: { type: TemplateElement['type']; label: string }[] = [
    { type: 'logo', label: 'Logo' }, { type: 'title', label: 'Tiêu đề' }, { type: 'description', label: 'Mô tả' },
    { type: 'image', label: 'Hình ảnh' }, { type: 'image_slider', label: 'Slider ảnh' }, { type: 'video', label: 'Video' },
    { type: 'connect_button', label: 'Nút kết nối' }, { type: 'video_gate', label: 'Video Gate' },
    { type: 'announcement', label: 'Thông báo' }, { type: 'spacer', label: 'Khoảng trắng' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Danh sách thành phần</h3>
        <div className="relative">
          <button onClick={() => setShowAddMenu(!showAddMenu)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Plus className="w-4 h-4" /></button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-20 py-1">
              {addableTypes.map(({ type, label }) => (
                <button key={type} onClick={() => { onAdd(type); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">{ELEMENT_ICONS[type]}{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">Kéo thả hoặc dùng nút mũi tên để sắp xếp. Bấm để chỉnh sửa.</p>
      <div className="space-y-1">
        {elements.map((el, index) => (
          <div key={el.id} draggable onDragStart={() => onDragStart(index)} onDragOver={(e) => onDragOver(e, index)} onDrop={() => onDrop(index)}
            className={`flex items-center gap-1.5 p-2 rounded-lg border transition-all cursor-pointer ${dragOverIndex === index ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'} ${!el.enabled ? 'opacity-50' : ''}`}>
            <div className="cursor-grab text-slate-400 hover:text-slate-600"><GripVertical className="w-3.5 h-3.5" /></div>
            <div className="flex-1 flex items-center gap-2 min-w-0" onClick={() => onSelect(el.id)}>
              <span className="text-slate-500">{ELEMENT_ICONS[el.type]}</span>
              <span className="text-sm font-medium text-slate-700 truncate">{ELEMENT_LABELS[el.type] || el.type}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onMove(index, 'up'); }} disabled={index === 0} className="p-0.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Lên"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onMove(index, 'down'); }} disabled={index === elements.length - 1} className="p-0.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Xuống"><ChevronDown className="w-3.5 h-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onToggle(el.id); }} className="p-0.5 rounded text-slate-400 hover:text-slate-600" title={el.enabled ? 'Ẩn' : 'Hiện'}>{el.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(el.id); }} className="p-0.5 rounded text-slate-400 hover:text-red-500" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementEditorPanel({ element, onUpdate, onBack }: { element: TemplateElement; onUpdate: (id: string, updates: Partial<TemplateElement>) => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">← Quay lại danh sách</button>
      <h3 className="text-sm font-semibold text-slate-700">Chỉnh sửa: {ELEMENT_LABELS[element.type]}</h3>
      {element.type === 'logo' && <LogoEditor element={element as LogoElement} onUpdate={onUpdate} />}
      {element.type === 'title' && <TitleEditor element={element as TitleElement} onUpdate={onUpdate} />}
      {element.type === 'description' && <DescriptionEditor element={element as DescriptionElement} onUpdate={onUpdate} />}
      {element.type === 'image' && <ImageEditor element={element as ImageElement} onUpdate={onUpdate} />}
      {element.type === 'image_slider' && <ImageSliderEditor element={element as ImageSliderElement} onUpdate={onUpdate} />}
      {element.type === 'video' && <VideoEditor element={element as VideoElement} onUpdate={onUpdate} />}
      {element.type === 'connect_button' && <ConnectButtonEditor element={element as ConnectButtonElement} onUpdate={onUpdate} />}
      {element.type === 'video_gate' && <VideoGateEditor element={element as VideoGateElement} onUpdate={onUpdate} />}
      {element.type === 'announcement' && <AnnouncementEditor element={element as AnnouncementElement} onUpdate={onUpdate} />}
      {element.type === 'spacer' && <SpacerEditor element={element as SpacerElement} onUpdate={onUpdate} />}
    </div>
  );
}

// ============================================
// Editors
// ============================================
function LogoEditor({ element, onUpdate }: { element: LogoElement; onUpdate: (id: string, u: Partial<LogoElement>) => void }) {
  return (<div className="space-y-4">
    <MediaUploadField label="Ảnh logo" value={element.src} onChange={(v) => onUpdate(element.id, { src: v })} accept="image/*" />
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng</label><input type="text" value={element.width} onChange={(e) => onUpdate(element.id, { width: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="120px" /></div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Vị trí</label><select value={element.position} onChange={(e) => onUpdate(element.id, { position: e.target.value as 'left' | 'center' | 'right' })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="left">Bên trái</option><option value="center">Ở giữa</option><option value="right">Bên phải</option></select></div>
  </div>);
}

function TitleEditor({ element, onUpdate }: { element: TitleElement; onUpdate: (id: string, u: Partial<TitleElement>) => void }) {
  return (<div className="space-y-4">
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Nội dung tiêu đề</label><input type="text" value={element.content} onChange={(e) => onUpdate(element.id, { content: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
    <ColorField label="Màu chữ" value={element.color} onChange={(v) => onUpdate(element.id, { color: v })} />
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Cỡ chữ</label><input type="text" value={element.fontSize} onChange={(e) => onUpdate(element.id, { fontSize: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="24px" /></div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Căn chỉnh</label><select value={element.align} onChange={(e) => onUpdate(element.id, { align: e.target.value as 'left' | 'center' | 'right' })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="left">Bên trái</option><option value="center">Ở giữa</option><option value="right">Bên phải</option></select></div>
    <TextStyleFields element={element} onUpdate={onUpdate} />
  </div>);
}

function DescriptionEditor({ element, onUpdate }: { element: DescriptionElement; onUpdate: (id: string, u: Partial<DescriptionElement>) => void }) {
  return (<div className="space-y-4">
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Nội dung mô tả</label><textarea value={element.content} onChange={(e) => onUpdate(element.id, { content: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={3} /></div>
    <ColorField label="Màu chữ" value={element.color} onChange={(v) => onUpdate(element.id, { color: v })} />
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Cỡ chữ</label><input type="text" value={element.fontSize} onChange={(e) => onUpdate(element.id, { fontSize: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="14px" /></div>
    <TextStyleFields element={element} onUpdate={onUpdate} />
  </div>);
}

function ImageEditor({ element, onUpdate }: { element: ImageElement; onUpdate: (id: string, u: Partial<ImageElement>) => void }) {
  const zoom = element.zoom || 1; const posX = element.posX || 0; const posY = element.posY || 0;
  return (<div className="space-y-4">
    <MediaUploadField label="Hình ảnh (Mobile)" value={element.src} onChange={(v) => onUpdate(element.id, { src: v })} accept="image/*" />
    <MediaUploadField label="Hình ảnh (Máy tính)" value={element.srcDesktop || ''} onChange={(v) => onUpdate(element.id, { srcDesktop: v })} accept="image/*" />
    <p className="text-xs text-slate-400">Nếu không chọn ảnh máy tính, sẽ dùng ảnh mobile. Dùng ảnh 16:9 hoặc ngang cho máy tính.</p>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Mô tả ảnh (alt)</label><input type="text" value={element.alt} onChange={(e) => onUpdate(element.id, { alt: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng</label><input type="text" value={element.width} onChange={(e) => onUpdate(element.id, { width: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="100%" /></div>
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều cao</label><input type="text" value={element.height} onChange={(e) => onUpdate(element.id, { height: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="auto" /></div>
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Bo góc</label><input type="text" value={element.borderRadius} onChange={(e) => onUpdate(element.id, { borderRadius: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="8px" /></div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Kiểu hiển thị</label><select value={element.objectFit} onChange={(e) => onUpdate(element.id, { objectFit: e.target.value as 'cover' | 'contain' | 'fill' })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="cover">Phủ khung</option><option value="contain">Vừa khung</option><option value="fill">Kéo giãn</option></select></div>
    <div className="bg-slate-50 rounded-lg p-3 space-y-3 border border-slate-200">
      <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><ZoomIn className="w-3.5 h-3.5" /> Phóng to & Vị trí</h4>
      <div><label className="block text-xs text-slate-500 mb-1">Phóng to: {Math.round(zoom * 100)}%</label>
        <div className="flex items-center gap-2"><button onClick={() => onUpdate(element.id, { zoom: Math.max(0.5, zoom - 0.1) })} className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100"><ZoomOut className="w-3.5 h-3.5" /></button><input type="range" min="50" max="300" value={Math.round(zoom * 100)} onChange={(e) => onUpdate(element.id, { zoom: parseInt(e.target.value) / 100 })} className="flex-1 accent-blue-600" /><button onClick={() => onUpdate(element.id, { zoom: Math.min(3, zoom + 0.1) })} className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100"><ZoomIn className="w-3.5 h-3.5" /></button></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Move className="w-3 h-3" /> Ngang: {posX}px</label><input type="range" min="-200" max="200" value={posX} onChange={(e) => onUpdate(element.id, { posX: parseInt(e.target.value) })} className="w-full accent-blue-600" /></div>
        <div><label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Move className="w-3 h-3" /> Dọc: {posY}px</label><input type="range" min="-200" max="200" value={posY} onChange={(e) => onUpdate(element.id, { posY: parseInt(e.target.value) })} className="w-full accent-blue-600" /></div>
      </div>
      <button onClick={() => onUpdate(element.id, { zoom: 1, posX: 0, posY: 0 })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Đặt lại mặc định</button>
    </div>
  </div>);
}

function ImageSliderEditor({ element, onUpdate }: { element: ImageSliderElement; onUpdate: (id: string, u: Partial<ImageSliderElement>) => void }) {
  const images = element.images || [];
  const imagesDesktop = element.imagesDesktop || [];
  const addImage = (src: string) => onUpdate(element.id, { images: [...images, { src, alt: '' }] });
  const removeImage = (index: number) => onUpdate(element.id, { images: images.filter((_, i) => i !== index) });
  const updateImageAlt = (index: number, alt: string) => { const updated = [...images]; updated[index] = { ...updated[index], alt }; onUpdate(element.id, { images: updated }); };
  const addImageDesktop = (src: string) => onUpdate(element.id, { imagesDesktop: [...imagesDesktop, { src, alt: '' }] });
  const removeImageDesktop = (index: number) => onUpdate(element.id, { imagesDesktop: imagesDesktop.filter((_, i) => i !== index) });
  return (<div className="space-y-4">
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">Ảnh Mobile ({images.length})</label>
      <div className="space-y-2">
        {images.map((img, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
            <img src={img.src} alt={img.alt} className="w-12 h-12 object-cover rounded" />
            <div className="flex-1 min-w-0"><p className="text-xs text-slate-500 truncate">{img.src.split('/').pop()}</p><input type="text" value={img.alt} onChange={(e) => updateImageAlt(index, e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs mt-1" placeholder="Mô tả ảnh" /></div>
            <button onClick={() => removeImage(index)} className="p-1 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-2"><MediaUploadField label="Thêm ảnh mobile" value="" onChange={(v) => { if (v) addImage(v); }} accept="image/*" /></div>
    </div>
    <div className="border-t border-slate-200 pt-4">
      <label className="block text-xs font-medium text-slate-600 mb-2">Ảnh PC/Laptop ({imagesDesktop.length})</label>
      <p className="text-xs text-slate-400 mb-2">Nếu không có ảnh PC, sẽ dùng ảnh mobile. Nên dùng ảnh ngang 16:9.</p>
      <div className="space-y-2">
        {imagesDesktop.map((img, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <img src={img.src} alt={img.alt} className="w-12 h-12 object-cover rounded" />
            <div className="flex-1 min-w-0"><p className="text-xs text-slate-500 truncate">{img.src.split('/').pop()}</p></div>
            <button onClick={() => removeImageDesktop(index)} className="p-1 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-2"><MediaUploadField label="Thêm ảnh PC" value="" onChange={(v) => { if (v) addImageDesktop(v); }} accept="image/*" /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều cao (Mobile)</label><input type="text" value={element.height} onChange={(e) => onUpdate(element.id, { height: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="200px" /></div>
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều cao (PC)</label><input type="text" value={element.heightDesktop || ''} onChange={(e) => onUpdate(element.id, { heightDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Dùng giá trị Mobile" /></div>
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Bo góc</label><input type="text" value={element.borderRadius} onChange={(e) => onUpdate(element.id, { borderRadius: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="8px" /></div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Kiểu hiển thị</label><select value={element.objectFit} onChange={(e) => onUpdate(element.id, { objectFit: e.target.value as 'cover' | 'contain' | 'fill' })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="cover">Phủ khung</option><option value="contain">Vừa khung</option><option value="fill">Kéo giãn</option></select></div>
    <CheckboxField label="Tự chuyển ảnh" checked={element.autoplay} onChange={(v) => onUpdate(element.id, { autoplay: v })} />
    {element.autoplay && <div><label className="block text-xs font-medium text-slate-600 mb-1">Thời gian mỗi ảnh (giây)</label><input type="number" value={element.interval} onChange={(e) => onUpdate(element.id, { interval: parseInt(e.target.value) || 3 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" min={1} max={30} /></div>}
  </div>);
}

function VideoEditor({ element, onUpdate }: { element: VideoElement; onUpdate: (id: string, u: Partial<VideoElement>) => void }) {
  return (<div className="space-y-4">
    <MediaUploadField label="Chọn video" value={element.src} onChange={(v) => onUpdate(element.id, { src: v })} accept="video/*" />
    <MediaUploadField label="Ảnh bìa video" value={element.poster} onChange={(v) => onUpdate(element.id, { poster: v })} accept="image/*" />
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Tỉ lệ khung hình</label>
      <div className="grid grid-cols-4 gap-2">{(['16:9', '9:16', '4:3', 'auto'] as const).map(ratio => (
        <button key={ratio} onClick={() => onUpdate(element.id, { aspectRatio: ratio })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.aspectRatio || 'auto') === ratio ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{ratio === 'auto' ? 'Tự do' : ratio}</button>
      ))}</div>
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng khung (Mobile)</label>
      <div className="grid grid-cols-4 gap-2 mb-2">{['100%', '80%', '60%', '50%'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { frameWidth: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.frameWidth || '100%') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.frameWidth || '100%'} onChange={(e) => onUpdate(element.id, { frameWidth: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="100% hoặc 300px" />
    </div>
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><label className="block text-xs font-medium text-slate-600">Chiều rộng khung (Laptop/PC)</label></div>
      <div className="grid grid-cols-4 gap-2 mb-2">{['100%', '60%', '40%', '30%'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { frameWidthDesktop: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.frameWidthDesktop || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.frameWidthDesktop || ''} onChange={(e) => onUpdate(element.id, { frameWidthDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Để trống = dùng giá trị Mobile" />
    </div>
    <div className="space-y-2">
      <CheckboxField label="Tự phát" checked={element.autoplay} onChange={(v) => onUpdate(element.id, { autoplay: v })} />
      <CheckboxField label="Tắt tiếng" checked={element.muted} onChange={(v) => onUpdate(element.id, { muted: v })} />
      <CheckboxField label="Lặp lại" checked={element.loop} onChange={(v) => onUpdate(element.id, { loop: v })} />
      <CheckboxField label="Hiện điều khiển" checked={element.controls} onChange={(v) => onUpdate(element.id, { controls: v })} />
    </div>
  </div>);
}

function ConnectButtonEditor({ element, onUpdate }: { element: ConnectButtonElement; onUpdate: (id: string, u: Partial<ConnectButtonElement>) => void }) {
  return (<div className="space-y-4">
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Nội dung nút</label><input type="text" value={element.text} onChange={(e) => onUpdate(element.id, { text: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Kết nối ngay" /></div>
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-3">
      <h4 className="text-xs font-semibold text-slate-600">Nút hình ảnh (tuỳ chọn)</h4>
      <MediaUploadField label="Ảnh nút bấm" value={element.imageSrc || ''} onChange={(v) => onUpdate(element.id, { imageSrc: v })} accept="image/*" />
      {element.imageSrc && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kích thước ảnh nút (Mobile)</label>
          <div className="grid grid-cols-4 gap-2 mb-2">{['100%', '80%', '60%', '50%'].map(w => (
            <button key={w} onClick={() => onUpdate(element.id, { imageWidth: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.imageWidth || '100%') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
          ))}</div>
          <input type="text" value={element.imageWidth || '100%'} onChange={(e) => onUpdate(element.id, { imageWidth: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="100% hoặc 300px" />
        </div>
      )}
      {element.imageSrc && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kích thước ảnh nút (PC)</label>
          <div className="grid grid-cols-4 gap-2 mb-2">{['100%', '60%', '40%', '30%'].map(w => (
            <button key={w} onClick={() => onUpdate(element.id, { imageWidthDesktop: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.imageWidthDesktop || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
          ))}</div>
          <input type="text" value={element.imageWidthDesktop || ''} onChange={(e) => onUpdate(element.id, { imageWidthDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Để trống = dùng giá trị Mobile" />
        </div>
      )}
      <p className="text-xs text-slate-400">Upload ảnh để thay thế nút bấm mặc định.</p>
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng nút (Mobile)</label>
      <div className="grid grid-cols-4 gap-2">{['100%', '80%', '60%', '50%'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { buttonWidth: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.buttonWidth || '100%') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.buttonWidth || '100%'} onChange={(e) => onUpdate(element.id, { buttonWidth: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-2" placeholder="100%" />
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng nút (PC)</label>
      <div className="grid grid-cols-4 gap-2">{['100%', '60%', '40%', '30%'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { buttonWidthDesktop: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.buttonWidthDesktop || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.buttonWidthDesktop || ''} onChange={(e) => onUpdate(element.id, { buttonWidthDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-2" placeholder="Để trống = dùng giá trị Mobile" />
    </div>
    <ColorField label="Màu chữ nút" value={element.color} onChange={(v) => onUpdate(element.id, { color: v })} />
    <ColorField label="Màu nền nút" value={element.bgColor} onChange={(v) => onUpdate(element.id, { bgColor: v })} />
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Bo góc nút</label><input type="text" value={element.radius} onChange={(e) => onUpdate(element.id, { radius: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="50px" /></div>
    <CheckboxField label="Hiện ô nhập số điện thoại" checked={element.showPhone} onChange={(v) => onUpdate(element.id, { showPhone: v })} />
    {element.showPhone && <div><label className="block text-xs font-medium text-slate-600 mb-1">Placeholder SĐT</label><input type="text" value={element.phonePlaceholder} onChange={(e) => onUpdate(element.id, { phonePlaceholder: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>}
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Điều khoản sử dụng</label><input type="text" value={element.termsText} onChange={(e) => onUpdate(element.id, { termsText: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Bằng việc kết nối..." /></div>
  </div>);
}

function VideoGateEditor({ element, onUpdate }: { element: VideoGateElement; onUpdate: (id: string, u: Partial<VideoGateElement>) => void }) {
  return (<div className="space-y-4">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-xs text-amber-700">Video Gate hiển thị dạng bảng dialog khi người dùng truy cập portal. Nó không xuất hiện trong bản xem trước.</p></div>
    <MediaUploadField label="Video quảng cáo" value={element.videoUrl} onChange={(v) => onUpdate(element.id, { videoUrl: v })} accept="video/*" />
    <MediaUploadField label="Ảnh bìa video" value={element.poster} onChange={(v) => onUpdate(element.id, { poster: v })} accept="image/*" />
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Tỉ lệ khung video</label>
      <div className="grid grid-cols-4 gap-2">{(['16:9', '9:16', '4:3', 'auto'] as const).map(ratio => (
        <button key={ratio} onClick={() => onUpdate(element.id, { aspectRatio: ratio })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.aspectRatio || '16:9') === ratio ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{ratio === 'auto' ? 'Tự do' : ratio}</button>
      ))}</div>
    </div>
    {/* Mobile frame width */}
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng khung video (Mobile)</label>
      <div className="grid grid-cols-4 gap-2 mb-2">{['100%', '80%', '60%', '50%'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { frameWidth: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.frameWidth || '90%') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.frameWidth || '90%'} onChange={(e) => onUpdate(element.id, { frameWidth: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="90%" />
    </div>
    {/* Desktop frame width */}
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><label className="block text-xs font-medium text-slate-600">Chiều rộng khung video (Laptop/PC)</label></div>
      <div className="grid grid-cols-4 gap-2 mb-2">{['100%', '60%', '40%', '30%'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { frameWidthDesktop: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.frameWidthDesktop || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.frameWidthDesktop || ''} onChange={(e) => onUpdate(element.id, { frameWidthDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Để trống = dùng giá trị Mobile" />
    </div>
    {/* Dialog max width */}
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Kích thước dialog tối đa (Mobile)</label>
      <div className="grid grid-cols-4 gap-2 mb-2">{['320px', '400px', '500px', '90vw'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { dialogMaxWidth: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.dialogMaxWidth || '400px') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.dialogMaxWidth || '400px'} onChange={(e) => onUpdate(element.id, { dialogMaxWidth: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="400px" />
    </div>
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><label className="block text-xs font-medium text-slate-600">Kích thước dialog tối đa (Laptop/PC)</label></div>
      <div className="grid grid-cols-4 gap-2 mb-2">{['400px', '500px', '600px', '90vw'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { dialogMaxWidthDesktop: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.dialogMaxWidthDesktop || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.dialogMaxWidthDesktop || ''} onChange={(e) => onUpdate(element.id, { dialogMaxWidthDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Để trống = dùng giá trị Mobile" />
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Cho phép bỏ qua sau (giây)</label><input type="number" value={element.skipAfter} onChange={(e) => onUpdate(element.id, { skipAfter: parseInt(e.target.value) || 5 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" min={1} max={60} /></div>
    <CheckboxField label="Tắt tiếng mặc định" checked={element.muted ?? true} onChange={(v) => onUpdate(element.id, { muted: v })} />
    <p className="text-xs text-slate-400 -mt-1">Người dùng có thể bật/tắt âm thanh trên video</p>
    <div className="border-t border-slate-200 pt-4"><h4 className="text-xs font-semibold text-slate-600 mb-3">Nội dung Dialog</h4>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Tiêu đề dialog</label><input type="text" value={element.dialogTitle || ''} onChange={(e) => onUpdate(element.id, { dialogTitle: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Xem video để kết nối WiFi" /></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Mô tả dialog</label><textarea value={element.dialogMessage || ''} onChange={(e) => onUpdate(element.id, { dialogMessage: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={2} placeholder="Vui lòng xem video trước..." /></div>
      </div>
    </div>
  </div>);
}

function AnnouncementEditor({ element, onUpdate }: { element: AnnouncementElement; onUpdate: (id: string, u: Partial<AnnouncementElement>) => void }) {
  const fontSizes = ['14px', '16px', '18px', '20px', '24px', '28px', '32px'];

  return (<div className="space-y-4">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3"><p className="text-xs text-blue-700">Thông báo hiển thị dạng dialog popup khi người dùng kết nối WiFi. Người dùng phải đợi đủ thời gian trước khi có thể đóng.</p></div>

    {/* === Video quảng cáo === */}
    <MediaUploadField label="Video quảng cáo (thay thế ảnh)" value={element.videoUrl || ''} onChange={(v) => onUpdate(element.id, { videoUrl: v })} accept="video/*" />
    {element.videoUrl && (
      <CheckboxField label="Tự phát video" checked={element.autoPlayVideo ?? true} onChange={(v) => onUpdate(element.id, { autoPlayVideo: v })} />
    )}
    {!element.videoUrl && (
      <MediaUploadField label="Hình ảnh (tùy chọn)" value={element.imageUrl || ''} onChange={(v) => onUpdate(element.id, { imageUrl: v })} accept="image/*" />
    )}

    {/* === Tiêu đề === */}
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Tiêu đề thông báo</label>
      <input type="text" value={element.title} onChange={(e) => onUpdate(element.id, { title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Thông báo quan trọng" />
      <div className="mt-2 flex flex-wrap items-center gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
        <span className="text-xs text-slate-500 mr-1">Định dạng tiêu đề:</span>
        <button onClick={() => onUpdate(element.id, { titleBold: !element.titleBold })} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold border transition-colors ${element.titleBold ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`} title="Đậm"><span className="font-bold">B</span></button>
        <button onClick={() => onUpdate(element.id, { titleItalic: !element.titleItalic })} className={`w-8 h-8 flex items-center justify-center rounded text-xs border transition-colors ${element.titleItalic ? 'bg-blue-100 border-blue-400 text-blue-700 italic' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 italic'}`} title="Nghiêng"><span className="italic">I</span></button>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Cỡ:</span>
          <select value={element.titleFontSize || '20px'} onChange={(e) => onUpdate(element.id, { titleFontSize: e.target.value })} className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700">
            {fontSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Màu:</span>
          <input type="color" value={element.titleColor || '#1e293b'} onChange={(e) => onUpdate(element.id, { titleColor: e.target.value })} className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5" />
          <input type="text" value={element.titleColor || '#1e293b'} onChange={(e) => onUpdate(element.id, { titleColor: e.target.value })} className="w-20 px-1 py-0.5 text-xs border border-slate-200 rounded font-mono" />
        </div>
      </div>
    </div>

    {/* === Nội dung === */}
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Nội dung thông báo</label>
      <textarea value={element.message} onChange={(e) => onUpdate(element.id, { message: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={4} placeholder="Nội dung thông báo..." />
      <div className="mt-2 flex flex-wrap items-center gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
        <span className="text-xs text-slate-500 mr-1">Định dạng nội dung:</span>
        <button onClick={() => onUpdate(element.id, { messageBold: !element.messageBold })} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold border transition-colors ${element.messageBold ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`} title="Đậm"><span className="font-bold">B</span></button>
        <button onClick={() => onUpdate(element.id, { messageItalic: !element.messageItalic })} className={`w-8 h-8 flex items-center justify-center rounded text-xs border transition-colors ${element.messageItalic ? 'bg-blue-100 border-blue-400 text-blue-700 italic' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 italic'}`} title="Nghiêng"><span className="italic">I</span></button>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Cỡ:</span>
          <select value={element.messageFontSize || '14px'} onChange={(e) => onUpdate(element.id, { messageFontSize: e.target.value })} className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700">
            {fontSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Màu:</span>
          <input type="color" value={element.messageColor || '#475569'} onChange={(e) => onUpdate(element.id, { messageColor: e.target.value })} className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5" />
          <input type="text" value={element.messageColor || '#475569'} onChange={(e) => onUpdate(element.id, { messageColor: e.target.value })} className="w-20 px-1 py-0.5 text-xs border border-slate-200 rounded font-mono" />
        </div>
      </div>
    </div>

    <ColorField label="Màu nền" value={element.bgColor} onChange={(v) => onUpdate(element.id, { bgColor: v })} />
    <div className="border-t border-slate-200 pt-4">
      <h4 className="text-xs font-semibold text-slate-600 mb-3">Nút bấm</h4>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Nội dung nút</label><input type="text" value={element.buttonText} onChange={(e) => onUpdate(element.id, { buttonText: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Đóng" /></div>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Màu nền nút" value={element.buttonBgColor} onChange={(v) => onUpdate(element.id, { buttonBgColor: v })} />
          <ColorField label="Màu chữ nút" value={element.buttonTextColor} onChange={(v) => onUpdate(element.id, { buttonTextColor: v })} />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Thời gian chờ (giây)</label><input type="number" value={element.skipAfter} onChange={(e) => onUpdate(element.id, { skipAfter: parseInt(e.target.value) || 5 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" min={1} max={60} /></div>
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Bó góc</label><input type="text" value={element.borderRadius || '16px'} onChange={(e) => onUpdate(element.id, { borderRadius: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="16px" /></div>
    </div>
    <div><label className="block text-xs font-medium text-slate-600 mb-1">Kích thước dialog tối đa (Mobile)</label>
      <div className="grid grid-cols-4 gap-2 mb-2">{['320px', '400px', '500px', '90vw'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { dialogMaxWidth: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.dialogMaxWidth || '400px') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.dialogMaxWidth || '400px'} onChange={(e) => onUpdate(element.id, { dialogMaxWidth: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="400px" />
    </div>
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><label className="block text-xs font-medium text-slate-600">Kích thước dialog tối đa (Laptop/PC)</label></div>
      <div className="grid grid-cols-4 gap-2 mb-2">{['400px', '500px', '600px', '90vw'].map(w => (
        <button key={w} onClick={() => onUpdate(element.id, { dialogMaxWidthDesktop: w })} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.dialogMaxWidthDesktop || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w}</button>
      ))}</div>
      <input type="text" value={element.dialogMaxWidthDesktop || ''} onChange={(e) => onUpdate(element.id, { dialogMaxWidthDesktop: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Để trống = dùng giá trị Mobile" />
    </div>
  </div>);
}

function SpacerEditor({ element, onUpdate }: { element: SpacerElement; onUpdate: (id: string, u: Partial<SpacerElement>) => void }) {
  const mobileHeightNum = parseInt(element.height, 10) || 20;
  const desktopHeightNum = parseInt(element.heightDesktop || element.height, 10) || 20;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
        <label className="block text-xs font-semibold text-slate-700">Chiều cao Mobile: {element.height}</label>
        <input
          type="range"
          min="5"
          max="240"
          value={mobileHeightNum}
          onChange={(e) => onUpdate(element.id, { height: `${e.target.value}px` })}
          className="w-full accent-blue-600"
        />
        <div className="grid grid-cols-4 gap-2">
          {['10px', '20px', '40px', '80px'].map((h) => (
            <button
              key={h}
              onClick={() => onUpdate(element.id, { height: h })}
              className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${element.height === h ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              {h}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={element.height}
          onChange={(e) => onUpdate(element.id, { height: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          placeholder="20px"
        />
      </div>

      <div className="rounded-lg border border-blue-200 p-3 bg-blue-50 space-y-3">
        <label className="block text-xs font-semibold text-slate-700">Chiều cao Laptop/Tablet: {element.heightDesktop || '(dùng Mobile)'}</label>
        <input
          type="range"
          min="5"
          max="320"
          value={desktopHeightNum}
          onChange={(e) => onUpdate(element.id, { heightDesktop: `${e.target.value}px` })}
          className="w-full accent-blue-600"
        />
        <div className="grid grid-cols-4 gap-2">
          {['20px', '40px', '80px', '120px'].map((h) => (
            <button
              key={h}
              onClick={() => onUpdate(element.id, { heightDesktop: h })}
              className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${(element.heightDesktop || '') === h ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              {h}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={element.heightDesktop || ''}
          onChange={(e) => onUpdate(element.id, { heightDesktop: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          placeholder="Để trống = dùng giá trị Mobile"
        />
        <button
          onClick={() => onUpdate(element.id, { heightDesktop: '' })}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Dùng cùng giá trị Mobile
        </button>
      </div>
    </div>
  );
}

// ============================================
// Shared Components
// ============================================
function TextStyleFields({ element, onUpdate }: { element: TitleElement | DescriptionElement; onUpdate: (id: string, u: Record<string, unknown>) => void }) {
  const shadowPresets = [
    { label: 'Không', value: '' },
    { label: 'Nhẹ', value: '1px 1px 2px rgba(0,0,0,0.5)' },
    { label: 'Trung bình', value: '2px 2px 4px rgba(0,0,0,0.7)' },
    { label: 'Mạnh', value: '3px 3px 6px rgba(0,0,0,0.9)' },
    { label: 'Phát sáng', value: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4)' },
  ];
  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-3 border border-slate-200">
      <h4 className="text-xs font-semibold text-slate-600">Hiệu ứng chữ</h4>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Đổ bóng chữ</label>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {shadowPresets.map(p => (
            <button key={p.label} onClick={() => onUpdate(element.id, { textShadow: p.value })}
              className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${(element.textShadow || '') === p.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{p.label}</button>
          ))}
        </div>
        <input type="text" value={element.textShadow || ''} onChange={(e) => onUpdate(element.id, { textShadow: e.target.value })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="VD: 2px 2px 4px rgba(0,0,0,0.5)" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Viền chữ (stroke)</label>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {['', '1px', '2px', '3px'].map(w => (
            <button key={w || 'none'} onClick={() => onUpdate(element.id, { textStroke: w })}
              className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${(element.textStroke || '') === w ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{w || 'Không'}</button>
          ))}
        </div>
        {element.textStroke && (
          <ColorField label="Màu viền chữ" value={element.textStrokeColor || '#000000'} onChange={(v) => onUpdate(element.id, { textStrokeColor: v })} />
        )}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, palette }: { label: string; value: string; onChange: (v: string) => void; palette?: string[] }) {
  const presets = palette || ['#ffffff', '#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#1e293b', '#0f172a', '#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-2 mb-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5" style={{ minWidth: '40px' }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" placeholder="#000000" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(color => (
          <button key={color} onClick={() => onChange(color)}
            className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${value === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
            style={{ backgroundColor: color }} title={color}
          />
        ))}
      </div>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" /><span className="text-sm text-slate-700">{label}</span></label>);
}

interface MediaFile { url: string; key: string; type: 'image' | 'video'; name: string; size: number; }

function MediaUploadField({ label, value, onChange, accept }: { label: string; value: string; onChange: (v: string) => void; accept: string }) {
  const [uploading, setUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (data.success) onChange(data.data.url);
      else console.error('Upload error:', data.error);
    } catch (err) { console.error('Upload failed:', err); }
    finally { setUploading(false); }
  };

  const handleUrlSubmit = () => {
    if (urlValue.trim()) {
      onChange(urlValue.trim());
      setUrlValue('');
      setShowUrlInput(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {value && accept.startsWith('image') && (
        <div className="mb-2 relative rounded-lg overflow-hidden border border-slate-200">
          <img src={value} alt="" className="w-full h-24 object-cover" />
          <button onClick={() => onChange('')} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
        </div>
      )}
      {value && accept.startsWith('video') && (
        <div className="mb-2 relative rounded-lg overflow-hidden border border-slate-200">
          <video src={value} className="w-full h-24 object-cover" muted />
          <button onClick={() => onChange('')} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" />{uploading ? 'Đang tải...' : 'Tải lên'}
        </button>
        <button onClick={() => setShowMediaPicker(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
          <FolderOpen className="w-3.5 h-3.5" />Thư viện
        </button>
        <button onClick={() => setShowUrlInput(!showUrlInput)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
          URL
        </button>
      </div>
      {showUrlInput && (
        <div className="flex gap-2 mt-2">
          <input type="text" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlSubmit(); } }}
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={handleUrlSubmit} className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600">OK</button>
        </div>
      )}
      {showMediaPicker && <MediaPickerModal accept={accept} onSelect={(url) => { onChange(url); setShowMediaPicker(false); }} onClose={() => setShowMediaPicker(false)} />}
    </div>
  );
}

function MediaPickerModal({ accept, onSelect, onClose }: { accept: string; onSelect: (url: string) => void; onClose: () => void }) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const filterType = accept.startsWith('image') ? 'image' : accept.startsWith('video') ? 'video' : '';

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const url = filterType ? `/api/upload?type=${filterType}` : '/api/upload';
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setFiles(data.data || []);
      } catch (err) { console.error('Failed to load media:', err); }
      finally { setLoading(false); }
    };
    fetchFiles();
  }, [filterType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Chọn từ thư viện Media</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">Chưa có file nào trong thư viện.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {files.map((file, i) => (
                <button key={i} onClick={() => onSelect(file.url)}
                  className="aspect-square bg-slate-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors relative group">
                  {file.type === 'image' ? <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Film className="w-8 h-8 text-white/60" /></div>}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">{file.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
