'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  Eye,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  ZoomIn,
  Columns3,
  Loader2,
} from 'lucide-react';
import {
  type DeviceVariant,
  DEVICES,
  DEVICE_KEYS,
  type Viewport,
} from '@/lib/template-document';
import type { SaveState } from './useDraftSave';

interface CmsTopBarProps {
  templateName: string;
  status: string;
  activeDevice: DeviceVariant;
  activePresetIndex: number;
  zoom: number;
  isRotated: boolean;
  isComparing: boolean;
  mode: 'edit' | 'simulate';
  saveState: SaveState;
  saveError: string;
  canUndo: boolean;
  canRedo: boolean;
  onSelectDevice: (device: DeviceVariant) => void;
  onSelectPreset: (index: number) => void;
  onToggleRotate: () => void;
  onSetZoom: (zoom: number) => void;
  onToggleCompare: () => void;
  onToggleMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenRevisions: () => void;
  onOpenPublish: () => void;
}

export default function CmsTopBar({
  templateName,
  status,
  activeDevice,
  activePresetIndex,
  zoom,
  isRotated,
  isComparing,
  mode,
  saveState,
  saveError,
  canUndo,
  canRedo,
  onSelectDevice,
  onSelectPreset,
  onToggleRotate,
  onSetZoom,
  onToggleCompare,
  onToggleMode,
  onUndo,
  onRedo,
  onOpenRevisions,
  onOpenPublish,
}: CmsTopBarProps) {
  const currentPresets = DEVICES[activeDevice].presets;

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40 text-gray-700 select-none shadow-sm shrink-0">
      {/* Left: Navigation & Document info */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/admin/templates"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Về danh sách mẫu"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-sm text-gray-900 truncate max-w-[180px] lg:max-w-xs">
            {templateName}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wider ${
              status === 'published'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {status === 'published' ? 'Đang chạy' : 'Bản nháp'}
          </span>
        </div>

        {/* Autosave Status */}
        <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span>Đang lưu...</span>
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã lưu</span>
            </span>
          )}
          {saveState === 'dirty' && (
            <span className="flex items-center gap-1 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
              <span>Có thay đổi</span>
            </span>
          )}
          {saveState === 'conflict' && (
            <span
              className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
              title={saveError}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Xung đột nháp</span>
            </span>
          )}
          {saveState === 'error' && (
            <span
              className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200"
              title={saveError}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Lỗi lưu</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: Device Switcher & Presets */}
      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
        <div className="flex items-center gap-0.5">
          {(
            [
              { key: 'mobile', label: 'Mobile', icon: Smartphone },
              { key: 'tablet', label: 'Tablet', icon: Tablet },
              { key: 'desktop', label: 'PC', icon: Monitor },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onSelectDevice(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeDevice === key && !isComparing
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        <select
          value={activePresetIndex}
          onChange={(e) => onSelectPreset(Number(e.target.value))}
          disabled={isComparing}
          className="bg-white border border-gray-200 text-gray-600 text-xs rounded-lg px-2 py-1 outline-none hover:border-gray-300 focus:border-blue-500 cursor-pointer disabled:opacity-50"
        >
          {currentPresets.map((preset, index) => (
            <option key={index} value={index}>
              {preset.width} × {preset.height}
            </option>
          ))}
        </select>

        {activeDevice !== 'desktop' && (
          <button
            onClick={onToggleRotate}
            disabled={isComparing}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              isRotated
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            } disabled:opacity-50`}
            title={isRotated ? 'Đang xoay ngang (click để về dọc)' : 'Xoay ngang màn hình'}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onToggleCompare}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
            isComparing
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="Chế độ so sánh 3 thiết bị cạnh nhau"
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">So sánh 3 khung</span>
        </button>
      </div>

      {/* Right: Zoom, History, Simulation & Actions */}
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
          <select
            value={zoom}
            onChange={(e) => onSetZoom(Number(e.target.value))}
            className="bg-white border border-gray-200 text-gray-700 font-medium text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value={0.35}>35%</option>
            <option value={0.4}>40%</option>
            <option value={0.5}>50%</option>
            <option value={0.6}>60% (Vừa khung)</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </div>

        <div className="flex items-center gap-0.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Hoàn tác (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Làm lại (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onToggleMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
            mode === 'simulate'
              ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm'
              : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
          }`}
          title="Chuyển đổi giữa chế độ chỉnh sửa và mô phỏng luồng WiFi"
        >
          {mode === 'simulate' ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Chỉnh sửa</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Mô phỏng</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenRevisions}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition-colors"
          title="Lịch sử phiên bản xuất bản"
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenPublish}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-xs font-medium shadow-md shadow-blue-600/20 transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Xuất bản</span>
        </button>
      </div>
    </header>
  );
}
