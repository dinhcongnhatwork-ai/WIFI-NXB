'use client';

import React, { useState } from 'react';
import {
  Layers,
  Component,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Search,
  Type,
  AlignLeft,
  Sliders,
  Video,
  Radio,
  Film,
  Megaphone,
  Box,
  Minus,
  Sparkles,
  Square,
  Columns,
  UserCheck,
} from 'lucide-react';
import {
  type TemplateDocumentV2,
  type DeviceVariant,
  type NodeElement,
  type DesignNode,
  type DesignSection,
  createNode,
  createSection,
  COMPONENT_LABELS,
  type ScreenId,
  screenSurface,
  flattenNodes,
} from '@/lib/template-document';
import { MediaLibrary } from '@/components/media';
import type { MediaItem } from '@/components/media/MediaPicker';

interface CmsLeftSidebarProps {
  document: TemplateDocumentV2;
  device: DeviceVariant;
  screen?: ScreenId;
  onAddMedia?: (url: string, item?: MediaItem) => void;
  onAddSlides?: (items: MediaItem[]) => void;
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
}

type TabType = 'components' | 'layers' | 'media';

export default function CmsLeftSidebar({
  document,
  device,
  screen = 'portal',
  onAddMedia,
  onAddSlides,
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
}: CmsLeftSidebarProps) {
  const [sliderSelection, setSliderSelection] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('components');
  const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1100);
  const [componentSearch, setComponentSearch] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeVariant = screenSurface(document.variants[device], screen);

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
        { type: 'connect_button', label: 'Nút kết nối WiFi', icon: Radio, desc: 'Bắt buộc - nút cấp quyền truy cập' },
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
      items: cat.items.filter(item => !['attendance_gate', 'video_gate', 'announcement'].includes(item.type) && (screen === 'portal' || item.type !== 'connect_button')).filter((item) =>
        item.label.toLowerCase().includes(componentSearch.toLowerCase()) ||
        item.desc.toLowerCase().includes(componentSearch.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  if (isCollapsed) {
    return (
      <aside className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-3 z-30 shrink-0 select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 mb-4 transition-colors"
          title="Mở rộng panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setActiveTab('components');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'components'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Thư viện thành phần"
          >
            <Component className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('layers');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'layers'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Cây lớp"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('media');
              setIsCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'media'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Thư viện Media"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[248px] bg-white border-r border-gray-200 flex flex-col z-30 shrink-0 select-none text-gray-700">
      {/* Tabs Header */}
      <div className="h-12 border-b border-gray-200 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200/80">
          <button
            onClick={() => setActiveTab('components')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'components'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Component className="w-3.5 h-3.5" />
            <span>Thành phần</span>
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'layers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lớp ({activeVariant.sections.flatMap((s) => s.nodes).length})</span>
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeTab === 'media'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Thư viện media"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Thu gọn panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content: Components */}
      {activeTab === 'components' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-200/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm thành phần..."
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder:text-gray-500 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Quick Add Section buttons */}
          <div className="px-3 pt-3 pb-2 flex gap-2">
            <button
              onClick={() => onAddSection('flow')}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] rounded-xl text-xs text-gray-700 border border-gray-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Section co giãn</span>
            </button>
            <button
              onClick={() => onAddSection('freeform')}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] rounded-xl text-xs text-gray-700 border border-gray-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Section tự do</span>
            </button>
          </div>

          {/* Component item list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredCategories.map((group) => (
              <div key={group.category}>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {group.category}
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {group.items.map(({ type, label, icon: Icon, desc }) => (
                    <button
                      key={type}
                      onClick={() => onAddNode(type)}
                      className="group flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200/80 hover:border-gray-300 text-left transition-all active:scale-[0.99]"
                    >
                      <div className="p-2 rounded-lg bg-white border border-gray-300/50 group-hover:border-blue-500/50 group-hover:text-blue-400 transition-colors shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-700 group-hover:text-gray-900 flex items-center justify-between">
                          <span>{label}</span>
                          <Plus className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" />
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

      {/* Tab Content: Layers */}
      {activeTab === 'layers' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeVariant.sections.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              <p>Chưa có section nào.</p>
              <button
                onClick={() => onAddSection('flow')}
                className="mt-2 text-blue-400 hover:underline"
              >
                + Thêm section mới
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
                      ? 'border-blue-500/50 bg-gray-50'
                      : 'border-gray-200 bg-white/80'
                  }`}
                >
                  {/* Section Bar */}
                  <div
                    onClick={() => {
                      onSelectNode(null, null);
                      onSelectSection(section.id);
                    }}
                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100/40 rounded-t-xl"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {section.name || `Section ${sIndex + 1}`}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          section.mode === 'freeform'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-blue-50 text-blue-600 border border-blue-200'
                        }`}
                      >
                        {section.mode}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onMoveSection(section.id, 'up')}
                        disabled={sIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                        title="Di chuyển lên"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveSection(section.id, 'down')}
                        disabled={sIndex === activeVariant.sections.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                        title="Di chuyển xuống"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSection(section.id)}
                        className="p-1 text-gray-400 hover:text-rose-500"
                        title="Xóa section"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Section Nodes */}
                  <div className="p-1.5 space-y-1 border-t border-gray-200/60">
                    {section.nodes.length === 0 ? (
                      <p className="text-[11px] text-gray-500 italic p-1.5 text-center">
                        Trống. Nhấn + ở tab Thành phần để thêm.
                      </p>
                    ) : (
                      flattenNodes(section.nodes).map((node: DesignNode, nIndex: number) => {
                        const isNodeSelected = node.id === selectedNodeId;

                        return (
                          <div
                            key={node.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNode(node.id, section.id);
                            }}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                              isNodeSelected
                                ? 'bg-blue-600 text-white font-medium'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                                  className="bg-white px-1 py-0.5 rounded text-xs border border-blue-400 text-gray-900 outline-none w-28"
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
                                  <Unlock className="w-3 h-3 text-gray-500 hover:text-gray-900" />
                                )}
                              </button>
                              <button
                                disabled={node.element.type === 'flow_content'} onClick={() => onToggleHideNode(section.id, node.id)}
                                className="p-0.5 hover:text-gray-900"
                                title={node.hidden ? 'Hiện' : 'Ẩn'}
                              >
                                {node.hidden ? (
                                  <EyeOff className="w-3 h-3 text-gray-500" />
                                ) : (
                                  <Eye className="w-3 h-3 text-gray-400 hover:text-gray-900" />
                                )}
                              </button>
                              <button
                                disabled={node.element.type === 'flow_content'} onClick={() => onDuplicateNode(section.id, node.id)}
                                className="p-0.5 hover:text-gray-900 text-gray-400"
                                title="Nhân bản"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                disabled={node.element.type === 'flow_content'} onClick={() => onDeleteNode(section.id, node.id)}
                                className="p-0.5 hover:text-rose-500 text-gray-400"
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

      {/* Tab Content: Media Library */}
      {activeTab === 'media' && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs"><button className={`flex-1 rounded-md py-2 ${!sliderSelection ? 'bg-white text-blue-600 shadow-sm' : ''}`} onClick={() => setSliderSelection(false)}>Ảnh / Video</button><button className={`flex-1 rounded-md py-2 ${sliderSelection ? 'bg-white text-blue-600 shadow-sm' : ''}`} onClick={() => setSliderSelection(true)}>Tạo slider</button></div>
          <MediaLibrary key={sliderSelection ? 'slides' : 'single'} accept={sliderSelection ? 'image/*' : 'image/*,video/*'} onSelect={onAddMedia} onSelectMany={sliderSelection ? onAddSlides : undefined} />
        </div>
      )}
    </aside>
  );
}
