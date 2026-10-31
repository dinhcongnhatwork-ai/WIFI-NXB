'use client';

import React, { useState } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Palette,
  Layout,
  Smartphone,
  Tablet,
  Monitor,
  AlertCircle,
  CheckCircle,
  Component,
  Layers,
  Image as ImageIcon,
  Plus,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Search,
  Type,
  Sliders,
  Video,
  Radio,
  Film,
  Megaphone,
  Box,
  Square,
  Minus,
  Columns,
  SlidersHorizontal,
  Wifi,
  Zap,
  Shield,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import {
  type TemplateDocumentV2,
  type DeviceVariant,
  type DesignNode,
  type DesignSection,
  type NodeLayout,
  type NodeElement,
  type ScreenId,
  screenSurface,
  flowNode,
  findNode,
  materializeElement,
  setNodeMedia,
  mediaUrl,
  mediaRef,
  copyVariant,
} from '@/lib/template-document';
import { contrastRatio } from '@/lib/cms/interaction';
import { MediaUploadField, MediaLibrary } from '@/components/media';
import toast from 'react-hot-toast';

/* ──────────────────────── Slider + Number Input Component ──────────────────────── */
function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-1 font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 accent-blue-600 cursor-pointer bg-gray-200 rounded-lg"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Math.round(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 outline-none focus:border-blue-500 text-center"
        />
        <span className="text-[10px] text-gray-400 w-4">px</span>
      </div>
    </div>
  );
}

/* ──────────────────────── Main Sidebar Props ──────────────────────── */
export interface CmsRightSidebarProps {
  document: TemplateDocumentV2;
  device: DeviceVariant;
  screen?: ScreenId;
  inspectorOnly?: boolean;
  selectedNodeId: string | null;
  selectedSectionId: string | null;
  onSelectNode: (nodeId: string | null, sectionId?: string | null) => void;
  onSelectSection: (sectionId: string | null) => void;
  onAddNode: (type: NodeElement['type'], sectionId?: string) => void;
  onAddSection: (mode: 'flow' | 'freeform') => void;
  onDeleteNode: (sectionId: string, nodeId: string) => void;
  onDuplicateNode: (sectionId: string, nodeId: string) => void;
  onToggleLockNode: (sectionId: string, nodeId: string) => void;
  onToggleHideNode: (sectionId: string, nodeId: string) => void;
  onMoveNode: (sectionId: string, nodeId: string, direction: 'up' | 'down') => void;
  onDeleteSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
  onRenameNode: (sectionId: string, nodeId: string, newName: string) => void;
  onUpdateDocument: (updater: (doc: TemplateDocumentV2) => void) => void;
  onConvertToFreeform?: (sectionId: string, change?: (section: DesignSection) => void) => void;
}

type TabType = 'components' | 'layers' | 'media' | 'inspector';

export default function CmsRightSidebar({
  document: doc,
  device,
  screen = 'portal',
  inspectorOnly = false,
  selectedNodeId,
  selectedSectionId,
  onSelectNode,
  onSelectSection,
  onAddNode,
  onAddSection,
  onDeleteNode,
  onDuplicateNode,
  onToggleLockNode,
  onToggleHideNode,
  onMoveNode,
  onDeleteSection,
  onMoveSection,
  onRenameNode,
  onUpdateDocument,
  onConvertToFreeform,
}: CmsRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('inspector');
  const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1100);
  const [componentSearch, setComponentSearch] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeVariant = screenSurface(doc.variants[device], screen);

  // Find selected node & active section
  let selectedNode: DesignNode | null = null;
  let activeSection: DesignSection | null = null;

  for (const section of activeVariant.sections) {
    if (section.id === selectedSectionId) activeSection = section;
    const node = selectedNodeId ? findNode(section.nodes, selectedNodeId) : undefined;
    if (node) { selectedNode = node; activeSection = section; break; }
  }
  const selectedCore = selectedNode?.element.type === 'flow_content' ? selectedNode : null;
  if (selectedCore && selectedCore.element.type === 'flow_content') {
    const controller = flowNode(doc.variants[device], selectedCore.element.screen);
    if (controller) selectedNode = { ...controller, id: selectedCore.id, layout: selectedCore.layout };
  }
  const propertyNode = (draft: TemplateDocumentV2): DesignNode | undefined => {
    const node = activeSection && selectedNodeId ? findNode(screenSurface(draft.variants[device], screen).sections.find(s => s.id === activeSection!.id)?.nodes || [], selectedNodeId) : undefined;
    return node?.element.type === 'flow_content' ? flowNode(draft.variants[device], node.element.screen) : node;
  };

  // Cross-device copy state
  const [copyTarget, setCopyTarget] = useState<DeviceVariant>(
    device === 'mobile' ? 'tablet' : device === 'tablet' ? 'desktop' : 'mobile'
  );
  const [copyAppend, setCopyAppend] = useState(false);

  const handleCopyVariant = () => {
    if (
      !confirm(
        `Bạn có chắc muốn sao chép thiết kế từ ${device.toUpperCase()} sang ${copyTarget.toUpperCase()} (${
          copyAppend ? 'thêm vào cuối' : 'ghi đè toàn bộ'
        })?`
      )
    ) {
      return;
    }

    onUpdateDocument((d) => {
      const updated = copyVariant(d, device, copyTarget, copyAppend);
      d.variants = updated.variants;
    });
    toast.success(`Đã sao chép sang ${copyTarget.toUpperCase()}`);
  };

  // Node updater helper
  const updateNodeLayout = (field: keyof NodeLayout, value: number) => {
    if (!selectedNode || !activeSection || selectedCore?.locked || (!selectedCore && selectedNode.locked)) return;
    if (!Number.isFinite(value) || ((field === 'width' || field === 'height') && value <= 0)) return;

    // If section is flow and updating x or y, auto convert to freeform
    if (activeSection.mode === 'flow' && (field === 'x' || field === 'y') && onConvertToFreeform) {
      onConvertToFreeform(activeSection.id, section => { const node = findNode(section.nodes, selectedNodeId!); if (node) node.layout[field] = value; });
      return;
    }

    onUpdateDocument((d) => {
      const n = findNode(screenSurface(d.variants[device], screen).sections.find(s => s.id === activeSection!.id)?.nodes || [], selectedNodeId!);
      if (n) {
        n.layout[field] = value;
      }
    });
  };

  const updateNodeElement = (updater: (el: any, node: DesignNode) => void) => {
    if (!selectedNode || !activeSection) return;
    onUpdateDocument((d) => {
      const n = propertyNode(d);
      if (n) {
        updater(n.element, n);
      }
    });
  };

  const updateSection = (updater: (sec: DesignSection) => void) => {
    if (!activeSection) return;
    onUpdateDocument((d) => {
      const s = screenSurface(d.variants[device], screen).sections.find((item) => item.id === activeSection!.id);
      if (s) updater(s);
    });
  };

  const updateBackground = (updater: (bg: typeof activeVariant.background) => void) => {
    onUpdateDocument((d) => {
      updater(screenSurface(d.variants[device], screen).background);
    });
  };

  // Component categories for "Thành phần" tab
  const componentCategories: {
    category: string;
    items: {
      type: NodeElement['type'];
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      desc: string;
    }[];
  }[] = [
    {
      category: 'Nội dung',
      items: [
        { type: 'logo', label: 'Logo', icon: Sparkles, desc: 'Biểu trưng thương hiệu' },
        { type: 'title', label: 'Tiêu đề', icon: Type, desc: 'Dòng chữ nổi bật chào đón' },
        { type: 'description', label: 'Mô tả', icon: AlignLeft, desc: 'Đoạn văn hướng dẫn/giới thiệu' },
        { type: 'image', label: 'Hình ảnh', icon: ImageIcon, desc: 'Ảnh đơn lẻ banner/sản phẩm' },
        { type: 'image_slider', label: 'Slider ảnh', icon: Sliders, desc: 'Bộ sưu tập ảnh tự chạy' },
        { type: 'video', label: 'Video', icon: Video, desc: 'Video phát nền hoặc tương tác' },
      ],
    },
    {
      category: 'Luồng WiFi Marketing',
      items: [
        { type: 'connect_button', label: 'Nút kết nối WiFi', icon: Radio, desc: 'Nút cấp quyền truy cập WiFi' },
        { type: 'attendance_gate', label: 'Điểm danh họp', icon: UserCheck, desc: 'Điền Họ tên & Phòng ban trước khi kết nối' },
        { type: 'video_gate', label: 'Video Gate', icon: Film, desc: 'Xem video bắt buộc trước khi kết nối' },
        { type: 'announcement', label: 'Thông báo', icon: Megaphone, desc: 'Popup quảng bá tin tức/ưu đãi' },
      ],
    },
    {
      category: 'Cấu trúc & Trang trí',
      items: [
        { type: 'container', label: 'Container', icon: Box, desc: 'Khối hộp chứa các phần tử' },
        { type: 'spacer', label: 'Khoảng trắng', icon: Square, desc: 'Khoảng cách đệm giữa các mục' },
        { type: 'divider', label: 'Đường phân cách', icon: Minus, desc: 'Đường kẻ mảnh phân đoạn' },
        { type: 'shape', label: 'Hình khối', icon: Columns, desc: 'Khối màu trang trí bo góc' },
      ],
    },
  ];

  const filteredCategories = componentCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(componentSearch.toLowerCase()) ||
          item.desc.toLowerCase().includes(componentSearch.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const totalNodesCount = activeVariant.sections.flatMap((s) => s.nodes).length;

  /* ─── Collapsed state (Rail with tab icons) ─── */
  if (isCollapsed) {
    return (
      <aside className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-3 z-30 shrink-0 select-none shadow-sm">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 mb-3 transition-colors"
          title="Mở rộng bảng công cụ"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className={inspectorOnly ? 'hidden' : 'flex flex-col gap-2'}>
          <button
            onClick={() => {
              setActiveTab('components');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'components'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Thành phần"
          >
            <Component className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('layers');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors relative ${
              activeTab === 'layers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={`Lớp (${totalNodesCount})`}
          >
            <Layers className="w-4 h-4" />
            {totalNodesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {totalNodesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('media');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'media'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Media"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('inspector');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'inspector'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Thuộc tính"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  const bg = activeVariant.background;
  const bgImage = mediaUrl(activeVariant.backgroundMedia.image);
  const bgVideo = mediaUrl(activeVariant.backgroundMedia.video);

  const inputCls =
    'w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 outline-none focus:border-blue-500';
  const labelCls = 'text-[10px] text-gray-500 block mb-1 font-medium';
  const headingCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wider';
  const borderCls = 'border-gray-200';
  const btnGhostCls = 'p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors';

  return (
    <aside data-inspector-only={inspectorOnly || undefined} className="cms-inspector w-[300px] bg-white border-l border-gray-200 flex flex-col z-30 shrink-0 select-none text-gray-700 shadow-sm">
      {inspectorOnly && <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold">Thuộc tính<button aria-label="Thu gọn thuộc tính" onClick={() => setIsCollapsed(true)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button></div>}
      {/* Tab Navigation Header */}
      <div className={inspectorOnly ? 'hidden' : 'h-12 border-b border-gray-200 px-3 flex items-center justify-between shrink-0 bg-white'}>
        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl" hidden={inspectorOnly}>
          <button
            onClick={() => setActiveTab('components')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'components'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            title="Thành phần"
          >
            <Component className="w-3.5 h-3.5" />
            <span>Thành phần</span>
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'layers'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            title="Lớp"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lớp ({totalNodesCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`p-1 px-2 rounded-lg text-xs transition-all ${
              activeTab === 'media'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            title="Media"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'inspector'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            title="Thuộc tính"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Thuộc tính</span>
          </button>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Thu gọn bảng"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ──────────────────────── TAB 1: THÀNH PHẦN (COMPONENTS) ──────────────────────── */}
      {activeTab === 'components' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm thành phần (logo, nút, ảnh...)"
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Quick Add Section buttons */}
          <div className="px-3 pt-2.5 pb-2 flex gap-2">
            <button
              onClick={() => onAddSection('freeform')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] rounded-xl text-xs text-blue-700 font-medium border border-blue-200 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Section tự do (Kéo thả)</span>
            </button>
            <button
              onClick={() => onAddSection('flow')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-50 hover:bg-gray-100 active:scale-[0.98] rounded-xl text-xs text-gray-700 border border-gray-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-gray-500" />
              <span>+ Section co giãn</span>
            </button>
          </div>

          {/* Component item list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredCategories.map((group) => (
              <div key={group.category}>
                <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {group.category}
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {group.items.map(({ type, label, icon: Icon, desc }) => (
                    <button
                      key={type}
                      onClick={() => {
                        onAddNode(type);
                        setActiveTab('inspector');
                      }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl bg-gray-50/80 hover:bg-blue-50/60 border border-gray-200/80 hover:border-blue-300 text-left transition-all active:scale-[0.99]"
                    >
                      <div className="p-2 rounded-lg bg-white border border-gray-200 group-hover:border-blue-400 group-hover:text-blue-600 transition-colors shrink-0 shadow-xs">
                        <Icon className="w-4 h-4 text-gray-700 group-hover:text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-700 flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-[10px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            + Thêm
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────── TAB 2: LỚP (LAYERS TREE) ──────────────────────── */}
      {activeTab === 'layers' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeVariant.sections.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              <p>Chưa có section nào.</p>
              <button
                onClick={() => onAddSection('freeform')}
                className="mt-2 text-blue-600 font-medium hover:underline block mx-auto"
              >
                + Thêm section tự do mới
              </button>
            </div>
          ) : (
            activeVariant.sections.map((section: DesignSection, sIndex: number) => {
              const isSectionSelected = section.id === selectedSectionId;

              return (
                <div
                  key={section.id}
                  className={`rounded-xl border transition-all ${
                    isSectionSelected
                      ? 'border-blue-400 bg-blue-50/20 shadow-xs'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Section Bar */}
                  <div
                    onClick={() => {
                      onSelectNode(null, null);
                      onSelectSection(section.id);
                      setActiveTab('inspector');
                    }}
                    className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 rounded-t-xl"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {section.name || `Section ${sIndex + 1}`}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          section.mode === 'freeform'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {section.mode === 'freeform' ? 'Tự do' : 'Co giãn'}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onMoveSection(section.id, 'up')}
                        disabled={sIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-20"
                        title="Di chuyển lên"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveSection(section.id, 'down')}
                        disabled={sIndex === activeVariant.sections.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-20"
                        title="Di chuyển xuống"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSection(section.id)}
                        className="p-1 text-gray-400 hover:text-rose-500"
                        title="Xóa section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section Nodes List */}
                  <div className="p-1.5 space-y-1 border-t border-gray-100">
                    {section.nodes.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic p-2 text-center">
                        Section trống. Nhấn vào tab Thành phần để thêm.
                      </p>
                    ) : (
                      section.nodes.map((node: DesignNode, nIndex: number) => {
                        const isNodeSelected = node.id === selectedNodeId;

                        return (
                          <div
                            key={node.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNode(node.id, section.id);
                              setActiveTab('inspector');
                            }}
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                              isNodeSelected
                                ? 'bg-blue-600 text-white font-medium shadow-xs'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                              {editingNodeId === node.id ? (
                                <input
                                  type="text"
                                  value={editingName}
                                  autoFocus
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={() => {
                                    if (editingName.trim()) {
                                      onRenameNode(section.id, node.id, editingName.trim());
                                    }
                                    setEditingNodeId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (editingName.trim()) {
                                        onRenameNode(section.id, node.id, editingName.trim());
                                      }
                                      setEditingNodeId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingNodeId(null);
                                    }
                                  }}
                                  className="bg-white px-1 py-0.5 rounded text-xs border border-blue-400 text-gray-900 outline-none w-32"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className="truncate"
                                  onDoubleClick={() => {
                                    setEditingNodeId(node.id);
                                    setEditingName(node.name);
                                  }}
                                  title="Nhấp đúp để đổi tên"
                                >
                                  {node.name}
                                </span>
                              )}
                            </div>

                            {/* Node Actions */}
                            <div
                              className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => onMoveNode(section.id, node.id, 'up')}
                                disabled={nIndex === 0}
                                className="p-0.5 hover:text-gray-900 disabled:opacity-20"
                                title="Lên trên"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onMoveNode(section.id, node.id, 'down')}
                                disabled={nIndex === section.nodes.length - 1}
                                className="p-0.5 hover:text-gray-900 disabled:opacity-20"
                                title="Xuống dưới"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onToggleLockNode(section.id, node.id)}
                                className="p-0.5 hover:text-gray-900"
                                title={node.locked ? 'Mở khóa' : 'Khóa'}
                              >
                                {node.locked ? (
                                  <Lock className="w-3 h-3 text-amber-500" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                onClick={() => onToggleHideNode(section.id, node.id)}
                                className="p-0.5 hover:text-gray-900"
                                title={node.hidden ? 'Hiện' : 'Ẩn'}
                              >
                                {node.hidden ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                onClick={() => onDuplicateNode(section.id, node.id)}
                                className="p-0.5 hover:text-gray-900"
                                title="Nhân bản"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onDeleteNode(section.id, node.id)}
                                className="p-0.5 hover:text-rose-500"
                                title="Xóa"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ──────────────────────── TAB 3: MEDIA (MEDIA LIBRARY) ──────────────────────── */}
      {activeTab === 'media' && (
        <div className="flex-1 overflow-y-auto p-3">
          <MediaLibrary
            onSelect={() => {
              onAddNode('image');
              setActiveTab('inspector');
            }}
          />
        </div>
      )}

      {/* ──────────────────────── TAB 4: THUỘC TÍNH (INSPECTOR) ──────────────────────── */}
      {activeTab === 'inspector' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* ========================================================================= */}
          {/* CASE 1: NODE PROPERTIES                                                   */}
          {/* ========================================================================= */}
          {selectedNode && activeSection ? (
            <div className="space-y-4">
              {/* Header: Node Name + Delete / Duplicate */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <span className="text-sm font-bold text-gray-900 block">{selectedNode.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Loại: {selectedNode.element.type} | Section: {activeSection.mode}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={!!selectedCore} onClick={() => onDuplicateNode(activeSection!.id, selectedNode!.id)}
                    className={btnGhostCls}
                    title="Nhân bản"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    disabled={!!selectedCore} onClick={() => onDeleteNode(activeSection!.id, selectedNode!.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa phần tử"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notice if in Flow Mode */}
              {activeSection.mode === 'flow' && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5">
                  <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Đang ở Section Co giãn (Flow)</span>
                  </div>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Các phần tử hiện xếp theo cột. Bạn có thể kéo thả trực tiếp trên màn hình hoặc chỉnh thanh trượt X, Y để tự động chuyển sang chế độ tự do.
                  </p>
                  {onConvertToFreeform && (
                    <button
                      onClick={() => onConvertToFreeform(activeSection!.id)}
                      className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                    >
                      🎯 Chuyển sang Section tự do (Kéo thả)
                    </button>
                  )}
                </div>
              )}

              {/* ─── Layout Box with SLIDERS (Always visible & interactive) ─── */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <h4 className={headingCls}>Vị trí & Kích thước (px)</h4>

                {/* X and Y Sliders */}
                <div className="space-y-2">
                  <SliderInput
                    label="Vị trí X (Trục ngang)"
                    value={Math.round(selectedNode.layout.x || 0)}
                    min={0}
                    max={activeSection.width || 400}
                    onChange={(v) => updateNodeLayout('x', v)}
                  />
                  <SliderInput
                    label="Vị trí Y (Trục dọc)"
                    value={Math.round(selectedNode.layout.y || 0)}
                    min={0}
                    max={activeSection.height || 800}
                    onChange={(v) => updateNodeLayout('y', v)}
                  />
                </div>

                {/* Width and Height Sliders */}
                <div className="space-y-2 pt-1 border-t border-gray-200">
                  <SliderInput
                    label="Chiều rộng (Width)"
                    value={Math.round(selectedNode.layout.width || 100)}
                    min={16}
                    max={activeSection.width || 600}
                    onChange={(v) => updateNodeLayout('width', Math.max(16, v))}
                  />
                  <SliderInput
                    label="Chiều cao (Height)"
                    value={Math.round(selectedNode.layout.height || 40)}
                    min={8}
                    max={activeSection.height || 800}
                    onChange={(v) => updateNodeLayout('height', Math.max(8, v))}
                  />
                </div>

                {/* Quick alignment */}
                <div>
                  <label className={labelCls}>Căn lề nhanh</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateNodeLayout('x', 24)}
                      className="flex-1 py-1 bg-white hover:bg-gray-200 border border-gray-200 rounded text-[11px] text-gray-700 font-medium transition-colors"
                    >
                      Trái
                    </button>
                    <button
                      onClick={() =>
                        updateNodeLayout(
                          'x',
                          Math.round((activeSection!.width - selectedNode!.layout.width) / 2)
                        )
                      }
                      className="flex-1 py-1 bg-white hover:bg-gray-200 border border-gray-200 rounded text-[11px] text-gray-700 font-medium transition-colors"
                    >
                      Giữa
                    </button>
                    <button
                      onClick={() =>
                        updateNodeLayout('x', activeSection!.width - selectedNode!.layout.width - 24)
                      }
                      className="flex-1 py-1 bg-white hover:bg-gray-200 border border-gray-200 rounded text-[11px] text-gray-700 font-medium transition-colors"
                    >
                      Phải
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── ELEMENT-SPECIFIC CONTROLS ─── */}

              {/* TITLE ELEMENT */}
              {selectedNode.element.type === 'title' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nội dung tiêu đề</label>
                    <input
                      type="text"
                      value={(selectedNode.element as any).content || (selectedNode.element as any).text || ''}
                      onChange={(e) =>
                        updateNodeElement((el) => {
                          el.content = e.target.value;
                          el.text = e.target.value;
                        })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Màu chữ</label>
                      <input
                        type="color"
                        value={(selectedNode.element as any).color || '#ffffff'}
                        onChange={(e) => updateNodeElement((el) => (el.color = e.target.value))}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Cỡ chữ</label>
                      <input
                        type="text"
                        value={(selectedNode.element as any).fontSize || '24px'}
                        onChange={(e) => updateNodeElement((el) => (el.fontSize = e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Căn lề chữ</label>
                    <div className="flex gap-1">
                      {['left', 'center', 'right'].map((align) => (
                        <button
                          key={align}
                          onClick={() => updateNodeElement((el) => (el.align = align))}
                          className={`flex-1 py-1 rounded text-xs font-medium border transition-colors ${
                            (selectedNode.element as any).align === align
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {align === 'left' ? 'Trái' : align === 'center' ? 'Giữa' : 'Phải'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DESCRIPTION ELEMENT */}
              {selectedNode.element.type === 'description' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nội dung đoạn văn</label>
                    <textarea
                      rows={3}
                      value={(selectedNode.element as any).content || ''}
                      onChange={(e) => updateNodeElement((el) => (el.content = e.target.value))}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Màu chữ</label>
                      <input
                        type="color"
                        value={(selectedNode.element as any).color || '#cbd5e1'}
                        onChange={(e) => updateNodeElement((el) => (el.color = e.target.value))}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Cỡ chữ</label>
                      <input
                        type="text"
                        value={(selectedNode.element as any).fontSize || '16px'}
                        onChange={(e) => updateNodeElement((el) => (el.fontSize = e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGE ELEMENT */}
              {selectedNode.element.type === 'image' && (() => {
                const iel = selectedNode.element as any;
                const currentSrc = iel.src || mediaUrl(selectedNode.media.src) || '';
                return (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Tải ảnh hoặc chọn từ thư viện</label>
                      <MediaUploadField
                        value={currentSrc}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'src', url);
                              (n.element as any).src = url;
                            }
                          });
                        }}
                        accept="image/*"
                        label="Hình ảnh minh họa / sản phẩm"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp link URL ảnh (Online / CDN / MinIO)</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentSrc}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'src', val);
                              (n.element as any).src = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Mô tả ảnh (Alt text - SEO & a11y)</label>
                      <input
                        type="text"
                        placeholder="Mô tả hình ảnh..."
                        value={iel.alt || ''}
                        onChange={(e) => updateNodeElement((el) => (el.alt = e.target.value))}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Kiểu hiển thị</label>
                        <select
                          value={iel.objectFit || 'cover'}
                          onChange={(e) => updateNodeElement((el) => (el.objectFit = e.target.value))}
                          className={inputCls}
                        >
                          <option value="cover">Phủ kín (Cover)</option>
                          <option value="contain">Vừa khung (Contain)</option>
                          <option value="fill">Dãn đều (Fill)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Bo góc (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={parseInt(iel.borderRadius || '8', 10) || 8}
                          onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Đổ bóng (Shadow)</label>
                        <select
                          value={iel.shadow || 'none'}
                          onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                          className={inputCls}
                        >
                          <option value="none">Không có</option>
                          <option value="soft">Đổ bóng nhẹ (Soft)</option>
                          <option value="medium">Đổ bóng vừa (Medium)</option>
                          <option value="strong">Đổ bóng sâu (Strong)</option>
                          <option value="glow">Phát sáng (Glow)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Kiểu viền (Border)</label>
                        <select
                          value={iel.borderStyle || 'none'}
                          onChange={(e) => updateNodeElement((el) => (el.borderStyle = e.target.value))}
                          className={inputCls}
                        >
                          <option value="none">Không viền</option>
                          <option value="solid">Viền liền (Solid)</option>
                          <option value="dashed">Viền đứt (Dashed)</option>
                          <option value="double">Viền kép (Double)</option>
                        </select>
                      </div>
                    </div>

                    {iel.borderStyle && iel.borderStyle !== 'none' && (
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                          <label className={labelCls}>Màu viền</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={iel.borderColor || '#cbd5e1'}
                              onChange={(e) => updateNodeElement((el) => (el.borderColor = e.target.value))}
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-700">{iel.borderColor || '#cbd5e1'}</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Độ dày viền (px)</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={iel.borderWidth ?? 2}
                            onChange={(e) => updateNodeElement((el) => (el.borderWidth = Number(e.target.value)))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-gray-700">Căn chỉnh vị trí & Thu phóng</h5>
                      <SliderInput
                        label="Độ phóng to ảnh (Zoom: 1x - 3x)"
                        value={iel.zoom ?? 1}
                        min={1}
                        max={3}
                        step={0.1}
                        onChange={(v) => updateNodeElement((el) => (el.zoom = v))}
                      />
                      <SliderInput
                        label="Dịch chuyển ngang (Offset X: -100px đến 100px)"
                        value={iel.posX ?? 0}
                        min={-100}
                        max={100}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.posX = v))}
                      />
                      <SliderInput
                        label="Dịch chuyển dọc (Offset Y: -100px đến 100px)"
                        value={iel.posY ?? 0}
                        min={-100}
                        max={100}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.posY = v))}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* LOGO ELEMENT */}
              {selectedNode.element.type === 'logo' && (() => {
                const lel = selectedNode.element as any;
                const currentSrc = lel.src || mediaUrl(selectedNode.media.src) || '';
                return (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Tải Logo</label>
                      <MediaUploadField
                        value={currentSrc}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'src', url);
                              (n.element as any).src = url;
                            }
                          });
                        }}
                        accept="image/*"
                        label="Logo biểu trưng thương hiệu"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp link URL Logo</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentSrc}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'src', val);
                              (n.element as any).src = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <SliderInput
                        label="Độ rộng Logo (px)"
                        value={parseInt(lel.width || '120', 10) || 120}
                        min={40}
                        max={350}
                        step={5}
                        onChange={(v) => updateNodeElement((el) => (el.width = `${v}px`))}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Căn lề Logo</label>
                      <div className="flex gap-1">
                        {(['left', 'center', 'right'] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => updateNodeElement((el) => (el.position = pos))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              (lel.position || 'center') === pos
                                ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {pos === 'left' ? 'Trái' : pos === 'center' ? 'Giữa' : 'Phải'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* VIDEO ELEMENT */}
              {selectedNode.element.type === 'video' && (() => {
                const vel = selectedNode.element as any;
                const currentSrc = vel.src || mediaUrl(selectedNode.media.src) || '';
                const currentPoster = vel.poster || mediaUrl(selectedNode.media.poster) || '';
                return (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Tải file Video</label>
                      <MediaUploadField
                        value={currentSrc}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'src', url);
                              (n.element as any).src = url;
                            }
                          });
                        }}
                        accept="video/*"
                        label="Tải video lên hoặc chọn từ MinIO"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp URL Video (MP4/WebM)</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentSrc}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'src', val);
                              (n.element as any).src = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Ảnh bìa Video (Poster Thumbnail)</label>
                      <MediaUploadField
                        value={currentPoster}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'poster', url);
                              (n.element as any).poster = url;
                            }
                          });
                        }}
                        accept="image/*"
                        label="Chọn ảnh bìa đại diện video"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Tỉ lệ khung hình</label>
                        <select
                          value={vel.aspectRatio || '16:9'}
                          onChange={(e) => updateNodeElement((el) => (el.aspectRatio = e.target.value))}
                          className={inputCls}
                        >
                          <option value="16:9">16:9 (Ngang chuẩn)</option>
                          <option value="9:16">9:16 (Dọc TikTok/Reels)</option>
                          <option value="4:3">4:3 (Khung ảnh)</option>
                          <option value="auto">Auto (Tự động)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Độ rộng khung (%)</label>
                        <input
                          type="text"
                          value={vel.frameWidth || '100%'}
                          onChange={(e) => updateNodeElement((el) => (el.frameWidth = e.target.value))}
                          className={inputCls}
                          placeholder="100%"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Đổ bóng (Shadow)</label>
                        <select
                          value={vel.shadow || 'none'}
                          onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                          className={inputCls}
                        >
                          <option value="none">Không có</option>
                          <option value="soft">Đổ bóng nhẹ (Soft)</option>
                          <option value="medium">Đổ bóng vừa (Medium)</option>
                          <option value="strong">Đổ bóng sâu (Strong)</option>
                          <option value="glow">Phát sáng (Glow)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Bo góc video (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={parseInt(vel.borderRadius || '12', 10) || 12}
                          onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2.5">
                      <h5 className="text-[11px] font-semibold text-gray-700">Tùy chọn phát video</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.autoplay ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.autoplay = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Tự động phát</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.muted ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.muted = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Tắt tiếng</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.loop ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.loop = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Lặp lại vô tận</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.controls ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.controls = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Hiện nút Play</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ATTENDANCE GATE ELEMENT */}
              {selectedNode.element.type === 'attendance_gate' && (() => {
                const agel = selectedNode.element as any;
                return (
                  <div className="space-y-4">
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                      <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Luồng Điểm danh Họp WiFi</span>
                      </div>
                      <p className="text-[11px] text-blue-700 leading-relaxed">
                        Yêu cầu người tham dự nhập Họ và Tên cùng Phòng ban trước khi cấp quyền truy cập WiFi.
                      </p>
                    </div>

                    <div>
                      <label className={labelCls}>Tiêu đề hộp thoại</label>
                      <input
                        type="text"
                        value={agel.dialogTitle || 'Điểm danh cuộc họp'}
                        placeholder="Điểm danh cuộc họp"
                        onChange={(e) => updateNodeElement((el) => (el.dialogTitle = e.target.value))}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Lời dẫn / Thông điệp</label>
                      <textarea
                        rows={2}
                        value={agel.dialogMessage || ''}
                        placeholder="Vui lòng nhập Họ tên và Phòng ban để hoàn tất điểm danh và kết nối WiFi."
                        onChange={(e) => updateNodeElement((el) => (el.dialogMessage = e.target.value))}
                        className={inputCls}
                      />
                    </div>

                    {/* Fixed 2 fields notice */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        2 Trường thông tin bắt buộc
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                          <span className="font-semibold text-slate-800">1. Họ và tên</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            Bắt buộc
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                          <span className="font-semibold text-slate-800">2. Phòng ban / Đơn vị</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            Bắt buộc
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Chữ trên nút xác nhận</label>
                      <input
                        type="text"
                        value={agel.buttonText || 'Xác nhận điểm danh & Kết nối'}
                        placeholder="Xác nhận điểm danh & Kết nối"
                        onChange={(e) => updateNodeElement((el) => (el.buttonText = e.target.value))}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Kích cỡ Hộp thoại</label>
                        <select
                          value={agel.dialogSize || 'normal'}
                          onChange={(e) => updateNodeElement((el) => (el.dialogSize = e.target.value))}
                          className={inputCls}
                        >
                          <option value="normal">Chuẩn (560px)</option>
                          <option value="large">Rộng (740px)</option>
                          <option value="xlarge">Siêu rộng (900px)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Chủ đề & Phong cách</label>
                        <select
                          value={agel.dialogTheme || 'luxury_gold'}
                          onChange={(e) => updateNodeElement((el) => (el.dialogTheme = e.target.value))}
                          className={inputCls}
                        >
                          <option value="luxury_gold">✨ Hoàng gia Mạ vàng</option>
                          <option value="cinematic_dark">🎬 Tối sang trọng (Dark)</option>
                          <option value="glass_neon">⚡ Kính mờ Neon</option>
                          <option value="clean_light">📢 Trắng ngọc trai</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Độ mờ hậu cảnh (Blur)</label>
                        <select
                          value={agel.overlayBlur || 'blur(10px)'}
                          onChange={(e) => updateNodeElement((el) => (el.overlayBlur = e.target.value))}
                          className={inputCls}
                        >
                          <option value="blur(4px)">Mờ nhẹ (4px)</option>
                          <option value="blur(8px)">Mờ vừa (8px)</option>
                          <option value="blur(14px)">Mờ đậm (14px)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Bo góc (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={parseInt(agel.borderRadius || '24', 10) || 24}
                          onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Đổ bóng hộp thoại (Shadow)</label>
                      <select
                        value={agel.shadow || 'glow'}
                        onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                        className={inputCls}
                      >
                        <option value="none">Không có</option>
                        <option value="soft">Đổ bóng nhẹ (Soft)</option>
                        <option value="medium">Đổ bóng vừa (Medium)</option>
                        <option value="strong">Đổ bóng sâu 3D (Strong)</option>
                        <option value="glow">Hào quang sáng (Glow)</option>
                      </select>
                    </div>
                  </div>
                );
              })()}

              {/* VIDEO GATE MARKETING ELEMENT */}
              {selectedNode.element.type === 'video_gate' && (() => {
                const vgel = selectedNode.element as any;
                const currentVideoUrl = vgel.videoUrl || mediaUrl(selectedNode.media.videoUrl) || '';
                const currentPoster = vgel.poster || mediaUrl(selectedNode.media.poster) || '';
                return (
                  <div className="space-y-4">
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                      <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-purple-600" />
                        <span>Luồng Video Gate Marketing</span>
                      </div>
                      <p className="text-[11px] text-purple-700 leading-relaxed">
                        Bắt buộc khách hàng xem video trước khi hiển thị nút kết nối WiFi.
                      </p>
                    </div>

                    <div>
                      <label className={labelCls}>Tải Video Gate bắt buộc</label>
                      <MediaUploadField
                        value={currentVideoUrl}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'videoUrl', url);
                              (n.element as any).videoUrl = url;
                            }
                          });
                        }}
                        accept="video/*"
                        label="Tải video quảng cáo hoặc chọn từ MinIO"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp URL Video</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentVideoUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'videoUrl', val);
                              (n.element as any).videoUrl = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Ảnh bìa Video Gate (Poster Thumbnail)</label>
                      <MediaUploadField
                        value={currentPoster}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'poster', url);
                              (n.element as any).poster = url;
                            }
                          });
                        }}
                        accept="image/*"
                        label="Chọn ảnh bìa video gate"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp URL ảnh bìa (Poster)</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentPoster}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'poster', val);
                              (n.element as any).poster = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Kích cỡ Hộp thoại</label>
                        <select
                          value={vgel.dialogSize || 'large'}
                          onChange={(e) => updateNodeElement((el) => (el.dialogSize = e.target.value))}
                          className={inputCls}
                        >
                          <option value="normal">Chuẩn (560px)</option>
                          <option value="large">Rộng - Rạp mini (740px)</option>
                          <option value="xlarge">Siêu rộng (900px)</option>
                          <option value="cinematic">Điện ảnh IMAX (1060px)</option>
                          <option value="fullscreen">Toàn màn hình</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Chủ đề & Trang trí</label>
                        <select
                          value={vgel.dialogTheme || 'luxury_gold'}
                          onChange={(e) => updateNodeElement((el) => (el.dialogTheme = e.target.value))}
                          className={inputCls}
                        >
                          <option value="luxury_gold">✨ Hoàng gia Mạ vàng</option>
                          <option value="cinematic_dark">🎬 Rạp phim IMAX</option>
                          <option value="glass_neon">⚡ Kính mờ Neon</option>
                          <option value="clean_light">📢 Trắng ngọc trai</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Độ mờ hậu cảnh (Blur)</label>
                        <select
                          value={vgel.overlayBlur || 'blur(10px)'}
                          onChange={(e) => updateNodeElement((el) => (el.overlayBlur = e.target.value))}
                          className={inputCls}
                        >
                          <option value="blur(4px)">Mờ nhẹ (4px)</option>
                          <option value="blur(8px)">Mờ vừa (8px)</option>
                          <option value="blur(14px)">Mờ đậm (14px)</option>
                          <option value="blur(22px)">Rất đậm (22px)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Bo góc (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={parseInt(vgel.borderRadius || '24', 10) || 24}
                          onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                      <SliderInput
                        label="Thời gian xem bắt buộc trước khi cho kết nối (giây)"
                        value={vgel.skipAfter ?? 5}
                        min={1}
                        max={60}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.skipAfter = v))}
                      />
                      <p className="text-[10px] text-gray-500">Khách phải đợi xem hết thời gian này mới được bấm kết nối.</p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Tiêu đề hộp thoại (Dialog Title)</label>
                        <input
                          type="text"
                          value={vgel.dialogTitle || ''}
                          placeholder="Xem video để kết nối WiFi"
                          onChange={(e) => updateNodeElement((el) => (el.dialogTitle = e.target.value))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Nội dung thông báo (Dialog Message)</label>
                        <textarea
                          rows={2}
                          value={vgel.dialogMessage || ''}
                          placeholder="Vui lòng xem video quảng cáo trước khi tiếp tục."
                          onChange={(e) => updateNodeElement((el) => (el.dialogMessage = e.target.value))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Tỉ lệ khung hình</label>
                        <select
                          value={vgel.aspectRatio || '16:9'}
                          onChange={(e) => updateNodeElement((el) => (el.aspectRatio = e.target.value))}
                          className={inputCls}
                        >
                          <option value="16:9">16:9 (Ngang)</option>
                          <option value="9:16">9:16 (Dọc)</option>
                          <option value="4:3">4:3 (Khung ảnh)</option>
                        </select>
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer py-1.5">
                          <input
                            type="checkbox"
                            checked={vgel.muted ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.muted = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Tắt tiếng mặc định</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Đổ bóng hộp thoại (Shadow)</label>
                      <select
                        value={vgel.shadow || 'glow'}
                        onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                        className={inputCls}
                      >
                        <option value="none">Không có</option>
                        <option value="soft">Đổ bóng nhẹ (Soft)</option>
                        <option value="medium">Đổ bóng vừa (Medium)</option>
                        <option value="strong">Đổ bóng sâu 3D (Strong)</option>
                        <option value="glow">Hào quang sáng (Glow)</option>
                      </select>
                    </div>
                  </div>
                );
              })()}

              {/* IMAGE SLIDER ELEMENT */}
              {selectedNode.element.type === 'image_slider' && (() => {
                const sel = selectedNode.element as any;
                const images: { src: string; alt: string }[] = sel.images || [];

                const handleAddSlide = () => {
                  updateNodeElement((el) => {
                    if (!el.images) el.images = [];
                    el.images.push({ src: '', alt: `Slide ${el.images.length + 1}` });
                  });
                };

                const handleUpdateSlide = (index: number, field: 'src' | 'alt', val: string) => {
                  updateNodeElement((el) => {
                    if (el.images && el.images[index]) {
                      el.images[index][field] = val;
                    }
                  });
                };

                const handleRemoveSlide = (index: number) => {
                  updateNodeElement((el) => {
                    if (el.images) {
                      el.images.splice(index, 1);
                    }
                  });
                };

                const handleMoveSlide = (index: number, dir: -1 | 1) => {
                  updateNodeElement((el) => {
                    if (!el.images) return;
                    const target = index + dir;
                    if (target < 0 || target >= el.images.length) return;
                    const temp = el.images[index];
                    el.images[index] = el.images[target];
                    el.images[target] = temp;
                  });
                };

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">Danh sách Slide ({images.length})</span>
                        <span className="text-[10px] text-gray-500">Quản lý và tải ảnh từng slide</span>
                      </div>
                      <button
                        onClick={handleAddSlide}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm slide</span>
                      </button>
                    </div>

                    <details className="rounded-lg border border-slate-200 p-2">
                      <summary className="cursor-pointer text-xs font-medium text-blue-600">Chọn nhiều ảnh từ thư viện</summary>
                      <div className="mt-3"><MediaLibrary accept="image/*" onSelectMany={items => updateNodeElement(el => { el.images = [...(el.images || []), ...items.map(item => ({ src: item.url, alt: item.name }))]; })} /></div>
                    </details>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {images.length === 0 ? (
                        <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-500">
                          <p>Chưa có slide ảnh nào.</p>
                          <button
                            onClick={handleAddSlide}
                            className="mt-2 text-blue-600 font-medium hover:underline text-xs"
                          >
                            + Nhấp để thêm slide ảnh đầu tiên
                          </button>
                        </div>
                      ) : (
                        images.map((slide, idx) => (
                          <div key={idx} className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-mono">
                                  {idx + 1}
                                </span>
                                Slide {idx + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveSlide(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-20 rounded hover:bg-gray-200"
                                  title="Lên trên"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveSlide(idx, 1)}
                                  disabled={idx === images.length - 1}
                                  className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-20 rounded hover:bg-gray-200"
                                  title="Xuống dưới"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveSlide(idx)}
                                  className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                  title="Xóa slide này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <MediaUploadField
                              value={slide.src}
                              onChange={(url) => handleUpdateSlide(idx, 'src', url)}
                              accept="image/*"
                              label={`Tải ảnh slide ${idx + 1}`}
                            />

                            <div>
                              <label className={labelCls}>Hoặc nhập link URL ảnh slide</label>
                              <input
                                type="text"
                                placeholder="https://... hoặc /api/media/..."
                                value={slide.src || ''}
                                onChange={(e) => handleUpdateSlide(idx, 'src', e.target.value)}
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className={labelCls}>Mô tả ảnh (Alt text)</label>
                              <input
                                type="text"
                                placeholder="Mô tả ảnh slide..."
                                value={slide.alt || ''}
                                onChange={(e) => handleUpdateSlide(idx, 'alt', e.target.value)}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <h5 className="text-[11px] font-semibold text-gray-700">Cấu hình trình chiếu</h5>

                      <SliderInput
                        label="Thời gian chuyển slide (giây)"
                        value={sel.interval ?? 4}
                        min={1}
                        max={10}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.interval = v))}
                      />

                      <SliderInput
                        label="Bo góc Slider (px)"
                        value={parseInt(sel.borderRadius || '8', 10) || 8}
                        min={0}
                        max={40}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.borderRadius = `${v}px`))}
                      />

                      <SliderInput
                        label="Chiều cao Slider (px)"
                        value={parseInt(sel.height || '200', 10) || 200}
                        min={100}
                        max={500}
                        step={10}
                        onChange={(v) => updateNodeElement((el) => (el.height = `${v}px`))}
                      />

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className={labelCls}>Kiểu hiển thị</label>
                          <select
                            value={sel.objectFit || 'cover'}
                            onChange={(e) => updateNodeElement((el) => (el.objectFit = e.target.value))}
                            className={inputCls}
                          >
                            <option value="cover">Phủ kín (Cover)</option>
                            <option value="contain">Vừa khung (Contain)</option>
                            <option value="fill">Dãn đều (Fill)</option>
                          </select>
                        </div>
                        <div className="flex flex-col justify-end">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer py-1.5">
                            <input
                              type="checkbox"
                              checked={sel.autoplay ?? true}
                              onChange={(e) => updateNodeElement((el) => (el.autoplay = e.target.checked))}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span>Tự động chạy</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className={labelCls}>Đổ bóng (Shadow)</label>
                          <select
                            value={sel.shadow || 'none'}
                            onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                            className={inputCls}
                          >
                            <option value="none">Không có</option>
                            <option value="soft">Đổ bóng nhẹ (Soft)</option>
                            <option value="medium">Đổ bóng vừa (Medium)</option>
                            <option value="strong">Đổ bóng sâu (Strong)</option>
                            <option value="glow">Phát sáng (Glow)</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Bo góc slider (px)</label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={parseInt(sel.borderRadius || '12', 10) || 12}
                            onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ANNOUNCEMENT POPUP ELEMENT */}
              {selectedNode.element.type === 'announcement' && (() => {
                const ael = selectedNode.element as any;
                const currentImg = ael.imageUrl || mediaUrl(selectedNode.media.imageUrl) || '';
                return (
                  <div className="space-y-4">
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                      <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                        <span>Thông báo Popup / Khuyến mãi</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        Hiển thị pop-up thông báo tin tức hoặc chương trình ưu đãi khi vào WiFi.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className={labelCls}>Tiêu đề thông báo</label>
                        <input
                          type="text"
                          value={ael.title || ''}
                          placeholder="Chào mừng bạn"
                          onChange={(e) => updateNodeElement((el) => (el.title = e.target.value))}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Màu tiêu đề</label>
                          <input
                            type="color"
                            value={ael.titleColor || '#1e293b'}
                            onChange={(e) => updateNodeElement((el) => (el.titleColor = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                          <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ael.titleBold ?? true}
                              onChange={(e) => updateNodeElement((el) => (el.titleBold = e.target.checked))}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold">Đậm</span>
                          </label>
                          <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ael.titleItalic ?? false}
                              onChange={(e) => updateNodeElement((el) => (el.titleItalic = e.target.checked))}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="italic">Nghiêng</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className={labelCls}>Nội dung thông điệp</label>
                        <textarea
                          rows={3}
                          value={ael.message || ''}
                          placeholder="Khám phá các chương trình hấp dẫn..."
                          onChange={(e) => updateNodeElement((el) => (el.message = e.target.value))}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Màu nội dung</label>
                          <input
                            type="color"
                            value={ael.messageColor || '#475569'}
                            onChange={(e) => updateNodeElement((el) => (el.messageColor = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Màu nền Popup</label>
                          <input
                            type="color"
                            value={ael.bgColor || '#ffffff'}
                            onChange={(e) => updateNodeElement((el) => (el.bgColor = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Ảnh minh họa Popup (Tùy chọn)</label>
                      <MediaUploadField
                        value={currentImg}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'imageUrl', url);
                              (n.element as any).imageUrl = url;
                            }
                          });
                        }}
                        accept="image/*"
                        label="Tải ảnh banner popup"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp link URL ảnh Popup</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentImg}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'imageUrl', val);
                              (n.element as any).imageUrl = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Kích cỡ Hộp thoại</label>
                        <select
                          value={ael.dialogSize || 'large'}
                          onChange={(e) => updateNodeElement((el) => (el.dialogSize = e.target.value))}
                          className={inputCls}
                        >
                          <option value="normal">Chuẩn (560px)</option>
                          <option value="large">Rộng (740px)</option>
                          <option value="xlarge">Siêu rộng (900px)</option>
                          <option value="cinematic">Rạp phim (1060px)</option>
                          <option value="fullscreen">Toàn màn hình</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Chủ đề & Trang trí</label>
                        <select
                          value={ael.dialogTheme || 'luxury_gold'}
                          onChange={(e) => updateNodeElement((el) => (el.dialogTheme = e.target.value))}
                          className={inputCls}
                        >
                          <option value="luxury_gold">✨ Hoàng gia Mạ vàng</option>
                          <option value="cinematic_dark">🎬 Rạp phim IMAX</option>
                          <option value="glass_neon">⚡ Kính mờ Neon</option>
                          <option value="clean_light">📢 Trắng ngọc trai</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Độ mờ hậu cảnh (Blur)</label>
                        <select
                          value={ael.overlayBlur || 'blur(10px)'}
                          onChange={(e) => updateNodeElement((el) => (el.overlayBlur = e.target.value))}
                          className={inputCls}
                        >
                          <option value="blur(4px)">Mờ nhẹ (4px)</option>
                          <option value="blur(8px)">Mờ vừa (8px)</option>
                          <option value="blur(14px)">Mờ đậm (14px)</option>
                          <option value="blur(22px)">Rất đậm (22px)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Bo góc (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={parseInt(ael.borderRadius || '24', 10) || 24}
                          onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-gray-700">Nút đóng / tiếp tục</h5>
                      <div>
                        <label className={labelCls}>Nhãn nút</label>
                        <input
                          type="text"
                          value={ael.buttonText || 'Tiếp tục'}
                          onChange={(e) => updateNodeElement((el) => (el.buttonText = e.target.value))}
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Màu nút</label>
                          <input
                            type="color"
                            value={ael.buttonBgColor || '#3b82f6'}
                            onChange={(e) => updateNodeElement((el) => (el.buttonBgColor = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Màu chữ nút</label>
                          <input
                            type="color"
                            value={ael.buttonTextColor || '#ffffff'}
                            onChange={(e) => updateNodeElement((el) => (el.buttonTextColor = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                        </div>
                      </div>
                      <SliderInput
                        label="Thời gian tự đóng (giây, 0 = không tự đóng)"
                        value={ael.skipAfter ?? 0}
                        min={0}
                        max={30}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.skipAfter = v))}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* CONNECT BUTTON */}
              {selectedNode.element.type === 'connect_button' && (() => {
                const cbel = selectedNode.element as any;
                const currentImg = cbel.imageSrc || mediaUrl(selectedNode.media.imageSrc) || '';
                return (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Nhãn nút (Text)</label>
                      <input
                        type="text"
                        value={cbel.text || cbel.label || 'Kết nối ngay'}
                        onChange={(e) =>
                          updateNodeElement((el) => {
                            el.text = e.target.value;
                            el.label = e.target.value;
                          })
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Kiểu dáng nút</label>
                        <select
                          value={cbel.buttonStyle || 'solid'}
                          onChange={(e) => updateNodeElement((el) => (el.buttonStyle = e.target.value))}
                          className={inputCls}
                        >
                          <option value="solid">Màu trơn (Solid)</option>
                          <option value="gradient">Chuyển màu (Gradient)</option>
                          <option value="glass">Kính mờ (Glassmorphism)</option>
                          <option value="outline">Viền nét (Outline)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Hiệu ứng động</label>
                        <select
                          value={cbel.buttonEffect || 'none'}
                          onChange={(e) => updateNodeElement((el) => (el.buttonEffect = e.target.value))}
                          className={inputCls}
                        >
                          <option value="none">Không có</option>
                          <option value="pulse">Nhịp thở (Pulse)</option>
                          <option value="shimmer">Vệt sáng quét (Shimmer)</option>
                          <option value="glow">Phát sáng viền (Glow)</option>
                          <option value="lift">Nổi 3D khi hover</option>
                        </select>
                      </div>
                    </div>

                    {cbel.buttonStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/80">
                        <div>
                          <label className={labelCls}>Màu bắt đầu</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={cbel.gradient?.from || '#2563eb'}
                              onChange={(e) =>
                                updateNodeElement((el) => {
                                  el.gradient = { ...(el.gradient || {}), from: e.target.value, to: el.gradient?.to || '#1d4ed8' };
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-700">{cbel.gradient?.from || '#2563eb'}</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Màu kết thúc</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={cbel.gradient?.to || '#1d4ed8'}
                              onChange={(e) =>
                                updateNodeElement((el) => {
                                  el.gradient = { ...(el.gradient || {}), to: e.target.value, from: el.gradient?.from || '#2563eb' };
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-700">{cbel.gradient?.to || '#1d4ed8'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Màu nền nút</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={cbel.bgColor || cbel.backgroundColor || '#2563eb'}
                              onChange={(e) =>
                                updateNodeElement((el) => {
                                  el.bgColor = e.target.value;
                                  el.backgroundColor = e.target.value;
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-700">{cbel.bgColor || '#2563eb'}</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Màu chữ nút</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={cbel.color || cbel.textColor || '#ffffff'}
                              onChange={(e) =>
                                updateNodeElement((el) => {
                                  el.color = e.target.value;
                                  el.textColor = e.target.value;
                                })
                              }
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-700">{cbel.color || '#ffffff'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Biểu tượng (Icon)</label>
                        <select
                          value={cbel.buttonIcon || 'none'}
                          onChange={(e) => updateNodeElement((el) => (el.buttonIcon = e.target.value))}
                          className={inputCls}
                        >
                          <option value="none">Không có icon</option>
                          <option value="wifi">📶 Sóng WiFi</option>
                          <option value="lightning">⚡ Sấm sét tốc độ</option>
                          <option value="arrow">➡️ Mũi tên tiếp tục</option>
                          <option value="shield">🛡️ Khiên bảo mật</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Đổ bóng (Shadow)</label>
                        <select
                          value={cbel.shadow || 'medium'}
                          onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                          className={inputCls}
                        >
                          <option value="none">Không có</option>
                          <option value="soft">Đổ bóng nhẹ (Soft)</option>
                          <option value="medium">Đổ bóng vừa (Medium)</option>
                          <option value="strong">Đổ bóng sâu 3D (Strong)</option>
                          <option value="glow">Hào quang sáng (Glow)</option>
                        </select>
                      </div>
                    </div>

                    <SliderInput
                      label="Bo góc nút (px)"
                      value={parseInt(cbel.radius || '12', 10) || 12}
                      min={0}
                      max={50}
                      step={1}
                      onChange={(v) => updateNodeElement((el) => (el.radius = `${v}px`))}
                    />

                    <div>
                      <label className={labelCls}>Hoặc ảnh nút đồ họa (Tùy chọn)</label>
                      <MediaUploadField
                        value={currentImg}
                        onChange={(url: string) => {
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'imageSrc', url);
                              (n.element as any).imageSrc = url;
                            }
                          });
                        }}
                        accept="image/*"
                        label="Tải ảnh nút thiết kế sẵn"
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Hoặc nhập trực tiếp link URL ảnh nút bấm</label>
                      <input
                        type="text"
                        placeholder="https://... hoặc /api/media/..."
                        value={currentImg}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateDocument((d) => {
                            const n = propertyNode(d);
                            if (n) {
                              setNodeMedia(n, 'imageSrc', val);
                              (n.element as any).imageSrc = val;
                            }
                          });
                        }}
                        className={inputCls}
                      />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-gray-700">Thu thập thông tin & Điều khoản</h5>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cbel.showPhone ?? false}
                          onChange={(e) => updateNodeElement((el) => (el.showPhone = e.target.checked))}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="font-medium">Yêu cầu nhập số điện thoại trước khi kết nối</span>
                      </label>

                      {cbel.showPhone && (
                        <div>
                          <label className={labelCls}>Gợi ý ô nhập (Placeholder)</label>
                          <input
                            type="text"
                            placeholder="Nhập số điện thoại của bạn"
                            value={cbel.phonePlaceholder || ''}
                            onChange={(e) => updateNodeElement((el) => (el.phonePlaceholder = e.target.value))}
                            className={inputCls}
                          />
                        </div>
                      )}

                      <div>
                        <label className={labelCls}>Điều khoản sử dụng WiFi (Dưới nút)</label>
                        <textarea
                          rows={2}
                          placeholder="Bằng cách kết nối, bạn đồng ý với Điều khoản..."
                          value={cbel.termsText || ''}
                          onChange={(e) => updateNodeElement((el) => (el.termsText = e.target.value))}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CONTAINER, SHAPE, DIVIDER, SPACER */}
              {(selectedNode.element.type === 'container' ||
                selectedNode.element.type === 'shape' ||
                selectedNode.element.type === 'divider' ||
                selectedNode.element.type === 'spacer') && (() => {
                const del = selectedNode.element as any;
                const isSpacer = selectedNode.element.type === 'spacer';
                const isDivider = selectedNode.element.type === 'divider';

                return (
                  <div className="space-y-4">
                    {!isSpacer && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>{isDivider ? 'Màu đường kẻ' : 'Màu sắc'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={del.color || (isDivider ? '#cbd5e1' : '#2563eb')}
                              onChange={(e) => updateNodeElement((el) => (el.color = e.target.value))}
                              className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-700">{del.color || (isDivider ? '#cbd5e1' : '#2563eb')}</span>
                          </div>
                        </div>
                        {!isDivider && (
                          <div>
                            <label className={labelCls}>Bo góc (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={parseInt(del.borderRadius || '8', 10) || 8}
                              onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                              className={inputCls}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {isSpacer && (
                      <SliderInput
                        label="Chiều cao khoảng trắng (px)"
                        value={parseInt(del.height || '24', 10) || 24}
                        min={8}
                        max={200}
                        step={4}
                        onChange={(v) => {
                          updateNodeElement((el) => (el.height = `${v}px`));
                          updateNodeLayout('height', v);
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          ) : activeSection ? (
            /* ========================================================================= */
            /* CASE 2: SECTION PROPERTIES                                                */
            /* ========================================================================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="text-sm font-bold text-gray-900">{activeSection.name}</span>
                <button
                  onClick={() => onDeleteSection(activeSection!.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Xóa section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Toggle: Freeform vs Flow */}
              <div className="space-y-2">
                <label className={labelCls}>Chế độ bố cục Section</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (activeSection!.mode !== 'freeform' && onConvertToFreeform) {
                        onConvertToFreeform(activeSection!.id);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      activeSection.mode === 'freeform'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🎯 Tự do (Kéo thả)</span>
                  </button>
                  <button
                    onClick={() => updateSection((s) => (s.mode = 'flow'))}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      activeSection.mode === 'flow'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Layout className="w-3.5 h-3.5" />
                    <span>📄 Co giãn (Flow)</span>
                  </button>
                </div>
              </div>

              {activeSection.mode === 'freeform' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Chiều rộng (Width)</label>
                      <input
                        type="number"
                        value={activeSection.width}
                        onChange={(e) => updateSection((s) => (s.width = Number(e.target.value)))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Chiều cao (Height)</label>
                      <input
                        type="number"
                        value={activeSection.height}
                        onChange={(e) => updateSection((s) => (s.height = Number(e.target.value)))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Khoảng cách con (Gap)</label>
                      <input
                        type="number"
                        value={activeSection.gap}
                        onChange={(e) => updateSection((s) => (s.gap = Number(e.target.value)))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Đệm trong (Padding)</label>
                      <input
                        type="number"
                        value={activeSection.padding}
                        onChange={(e) => updateSection((s) => (s.padding = Number(e.target.value)))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Màu nền Section</label>
                <input
                  type="text"
                  placeholder="transparent"
                  value={activeSection.background}
                  onChange={(e) => updateSection((s) => (s.background = e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CASE 3: PAGE / VARIANT SETTINGS (NOTHING SELECTED)                        */
            /* ========================================================================= */
            <div className="space-y-5">
              <div>
                <h4 className={`${headingCls} mb-3`}>Nền thiết bị ({device.toUpperCase()})</h4>

                <div className="space-y-4">
                  {/* Background image picker */}
                  <div>
                    <label className={labelCls}>Ảnh nền (Background Image)</label>
                    <MediaUploadField
                      value={bgImage}
                      onChange={(url: string) => {
                        onUpdateDocument((d) => {
                          const target = screenSurface(d.variants[device], screen);
                          const ref = mediaRef(url);
                          if (ref) {
                            target.backgroundMedia.image = ref;
                          } else {
                            delete target.backgroundMedia.image;
                          }
                        });
                      }}
                      accept="image/*"
                      label="Tải ảnh nền hoặc chọn từ MinIO"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Hoặc nhập link URL ảnh nền (Online / CDN)</label>
                    <input
                      type="text"
                      placeholder="https://... hoặc /api/media/..."
                      value={bgImage}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateDocument((d) => {
                          const target = screenSurface(d.variants[device], screen);
                          const ref = mediaRef(val);
                          if (ref) {
                            target.backgroundMedia.image = ref;
                          } else {
                            delete target.backgroundMedia.image;
                          }
                        });
                      }}
                      className={inputCls}
                    />
                  </div>

                  {/* Background Video picker */}
                  <div>
                    <label className={labelCls}>Video nền (Background Video - Tùy chọn)</label>
                    <MediaUploadField
                      value={bgVideo}
                      onChange={(url: string) => {
                        onUpdateDocument((d) => {
                          const target = screenSurface(d.variants[device], screen);
                          const ref = mediaRef(url);
                          if (ref) {
                            target.backgroundMedia.video = ref;
                          } else {
                            delete target.backgroundMedia.video;
                          }
                        });
                      }}
                      accept="video/*"
                      label="Tải video nền (MP4 / WebM)"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Hoặc nhập link URL video nền</label>
                    <input
                      type="text"
                      placeholder="https://... hoặc /api/media/..."
                      value={bgVideo}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateDocument((d) => {
                          const target = screenSurface(d.variants[device], screen);
                          const ref = mediaRef(val);
                          if (ref) {
                            target.backgroundMedia.video = ref;
                          } else {
                            delete target.backgroundMedia.video;
                          }
                        });
                      }}
                      className={inputCls}
                    />
                  </div>

                  {/* Base color & Display type */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                    <h5 className="text-[11px] font-semibold text-gray-700">Màu nền chính (Base Color)</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Màu nền</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={bg.color || '#0f172a'}
                            onChange={(e) => updateBackground((b) => (b.color = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                          <span className="font-mono text-xs text-gray-700">{bg.color || '#0f172a'}</span>
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Kiểu hiển thị ảnh/video</label>
                        <select
                          value={bg.type || 'cover'}
                          onChange={(e) => updateBackground((b) => (b.type = e.target.value as any))}
                          className={inputCls}
                        >
                          <option value="cover">Phủ kín (Cover)</option>
                          <option value="contain">Vừa khít (Contain)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* OVERLAY COLOR & OPACITY SLIDER */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                    <h5 className="text-[11px] font-semibold text-gray-700">Lớp phủ & Độ mờ đục (Overlay Opacity)</h5>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Màu lớp phủ (Overlay Color)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={bg.overlayColor || '#000000'}
                            onChange={(e) => updateBackground((b) => (b.overlayColor = e.target.value))}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer bg-transparent"
                          />
                          <span className="font-mono text-xs text-gray-700">{bg.overlayColor || '#000000'}</span>
                        </div>
                      </div>
                    </div>

                    {/* OVERLAY OPACITY SLIDER */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-gray-500 font-medium">
                          Độ mờ lớp phủ nền (Overlay Opacity)
                        </label>
                        <span className="text-xs font-mono font-bold text-blue-600">
                          {Math.round((bg.overlayOpacity ?? 0.3) * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.round((bg.overlayOpacity ?? 0.3) * 100)}
                          onChange={(e) => updateBackground((b) => (b.overlayOpacity = Number(e.target.value) / 100))}
                          className="flex-1 h-2 accent-blue-600 cursor-pointer bg-gray-200 rounded-lg"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.round((bg.overlayOpacity ?? 0.3) * 100)}
                          onChange={(e) => updateBackground((b) => (b.overlayOpacity = Math.min(100, Math.max(0, Number(e.target.value))) / 100))}
                          className="w-16 px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-900 outline-none focus:border-blue-500 text-center"
                        />
                        <span className="text-[10px] text-gray-400 w-4">%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Kéo về 0% để thấy màu/ảnh gốc rõ nhất, kéo về 100% để tối màu nền làm nổi bật chữ.
                      </p>
                    </div>

                    {/* Background focal point X, Y */}
                    {bgImage && (
                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <label className={labelCls}>Tiêu điểm căn chỉnh ảnh nền</label>
                        <div className="grid grid-cols-2 gap-2">
                          <SliderInput
                            label="Tiêu điểm X (%)"
                            value={bg.focalX ?? 50}
                            min={0}
                            max={100}
                            step={5}
                            onChange={(v) => updateBackground((b) => (b.focalX = v))}
                          />
                          <SliderInput
                            label="Tiêu điểm Y (%)"
                            value={bg.focalY ?? 50}
                            min={0}
                            max={100}
                            step={5}
                            onChange={(v) => updateBackground((b) => (b.focalY = v))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cross-device copy tool */}
              <details className="pt-4 border-t border-gray-200">
                <summary className="text-xs font-semibold cursor-pointer mb-2">Nâng cao: sao chép thiết bị</summary>
                <h4 className={`${headingCls} mb-2`}>Sao chép sang thiết bị khác</h4>
                <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Đến:</span>
                    <select
                      value={copyTarget}
                      onChange={(e) => setCopyTarget(e.target.value as DeviceVariant)}
                      className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-800"
                    >
                      <option value="mobile">Mobile (390×844)</option>
                      <option value="tablet">Tablet (768×1024)</option>
                      <option value="desktop">PC (1440×900)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleCopyVariant}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    Sao chép giao diện
                  </button>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
