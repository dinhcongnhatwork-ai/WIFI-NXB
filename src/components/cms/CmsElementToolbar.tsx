'use client';

import React from 'react';
import {
  Copy,
  Trash2,
  Lock,
  Unlock,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { DesignNode, DesignSection } from '@/lib/template-document';

interface CmsElementToolbarProps {
  selectedNode: DesignNode;
  activeSection: DesignSection;
  selectedCount?: number;
  onOpenMediaPicker?: () => void;
  onAlign?: (alignment: 'left' | 'center' | 'right') => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove?: (direction: 'up' | 'down') => void;
}

export default function CmsElementToolbar({
  selectedNode,
  activeSection,
  selectedCount = 1,
  onOpenMediaPicker,
  onAlign,
  onToggleLock,
  onDuplicate,
  onDelete,
  onMove,
}: CmsElementToolbarProps) {
  const isCore = selectedNode.element.type === 'flow_content';
  const hasMedia = ['image', 'logo', 'video', 'video_gate', 'announcement'].includes(selectedNode.element.type);

  return (
    <div
      role="toolbar"
      aria-label="Thao tác phần tử"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-md text-slate-700 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Node Tag */}
      {selectedCount > 1 ? (
        <span className="px-2 py-0.5 mr-1 rounded bg-blue-600 text-white text-[11px] font-semibold">
          Đã chọn {selectedCount} phần tử (Ctrl)
        </span>
      ) : (
        <span className="px-2 py-0.5 mr-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold max-w-[120px] truncate">
          {selectedNode.name}
        </span>
      )}

      {/* Media Picker Button */}
      {hasMedia && onOpenMediaPicker && (
        <button
          type="button"
          title="Chọn ảnh hoặc video từ thư viện"
          aria-label="Thay media"
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          onClick={onOpenMediaPicker}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Alignment Buttons */}
      {onAlign && (
        <div className="flex items-center gap-0.5 border-x border-slate-200 px-1 mx-0.5">
          <button
            type="button"
            aria-label="Căn trái"
            title="Căn trái"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => onAlign('left')}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Căn giữa"
            title="Căn giữa"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => onAlign('center')}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Căn phải"
            title="Căn phải"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => onAlign('right')}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Move Up / Down */}
      {onMove && (
        <div className="flex items-center gap-0.5 mr-0.5">
          <button
            type="button"
            title="Di chuyển lên trên"
            aria-label="Lên trên"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => onMove('up')}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Di chuyển xuống dưới"
            aria-label="Xuống dưới"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => onMove('down')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Lock / Unlock */}
      <button
        type="button"
        aria-label={selectedNode.locked ? 'Mở khóa phần tử' : 'Khóa phần tử'}
        title={selectedNode.locked ? 'Mở khóa phần tử' : 'Khóa phần tử (tránh di chuyển vô tình)'}
        className={`p-1.5 rounded-lg transition-colors ${
          selectedNode.locked
            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
        onClick={onToggleLock}
      >
        {selectedNode.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>

      {/* Duplicate */}
      <button
        type="button"
        aria-label="Nhân bản phần tử"
        title="Nhân bản (Ctrl+D)"
        disabled={isCore}
        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"
        onClick={onDuplicate}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>

      {/* Delete */}
      <button
        type="button"
        aria-label="Xóa phần tử"
        title="Xóa phần tử (Delete)"
        disabled={isCore || selectedNode.locked}
        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 transition-colors"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

