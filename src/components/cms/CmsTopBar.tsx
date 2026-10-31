'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  RotateCcw,
  Eye,
  Play,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  Columns3,
  Loader2,
  MoreVertical,
  Check,
  RefreshCw,
  Palette,
  Download,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type DeviceVariant,
  DEVICES,
  type ScreenId,
  SCREEN_LABELS,
} from '@/lib/template-document';
import { TEMPLATE_PRESETS } from '@/lib/template-presets';
import type { DeviceSyncMode } from '@/lib/cms/device-sync';
import type { SaveState } from './useDraftSave';

interface CmsTopBarProps {
  templateName: string;
  status: string;
  activeDevice: DeviceVariant;
  activePresetIndex: number;
  zoom: number;
  zoomMode: 'fit' | number;
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
  onSetZoomMode: (mode: 'fit' | number) => void;
  onToggleCompare: () => void;
  onToggleMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenRevisions: () => void;
  onOpenPublish: () => void;
  // Screen selector
  screen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  isScreenEnabled?: boolean;
  onToggleScreenEnabled?: (enabled: boolean) => void;
  // Device sync & preset options
  deviceSync: DeviceSyncMode;
  onSetDeviceSync: (mode: DeviceSyncMode) => void;
  onSynchronizeNow: () => void;
  onSelectPresetTemplate: (presetId: string) => void;
  onDownloadDraft: () => void;
}

export default function CmsTopBar({
  templateName,
  status,
  activeDevice,
  activePresetIndex,
  zoom,
  zoomMode,
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
  onSetZoomMode,
  onToggleCompare,
  onToggleMode,
  onUndo,
  onRedo,
  onOpenRevisions,
  onOpenPublish,
  screen,
  onSelectScreen,
  isScreenEnabled = true,
  onToggleScreenEnabled,
  deviceSync,
  onSetDeviceSync,
  onSynchronizeNow,
  onSelectPresetTemplate,
  onDownloadDraft,
}: CmsTopBarProps) {
  const currentPresets = DEVICES[activeDevice].presets;
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showScreenMenu, setShowScreenMenu] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const screenMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setShowOptionsMenu(false);
      }
      if (screenMenuRef.current && !screenMenuRef.current.contains(target)) {
        setShowScreenMenu(false);
      }
    }
    if (showOptionsMenu || showScreenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionsMenu, showScreenMenu]);

  return (
    <header className="cms-topbar min-h-13 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-4 z-40 text-slate-700 select-none shadow-xs shrink-0 gap-2">
      {/* ─── Left Section: Nav, Name & Screen Selector ─── */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <Link
          href="/admin/templates"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          title="Về danh sách mẫu"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-px h-4 bg-slate-200 shrink-0" />

        <div className="flex items-center gap-1.5 truncate max-w-[130px] sm:max-w-[180px] xl:max-w-xs">
          <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
            {templateName}
          </span>
          <span
            className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full uppercase tracking-wider shrink-0 ${
              status === 'published'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {status === 'published' ? 'Đang chạy' : 'Bản nháp'}
          </span>
        </div>

        {/* Autosave Status Indicator */}
        <div className="hidden lg:flex items-center gap-1 text-xs shrink-0">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              <span>Đang lưu...</span>
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]" title="Đã lưu tự động">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã lưu</span>
            </span>
          )}
          {saveState === 'dirty' && (
            <span className="flex items-center gap-1 text-slate-500 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
              <span>Có thay đổi</span>
            </span>
          )}
          {saveState === 'error' && (
            <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] border border-rose-200" title={saveError}>
              <AlertTriangle className="w-3 h-3" />
              <span>Lỗi lưu</span>
            </span>
          )}
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5 shrink-0" />

        {/* ─── Compact Screen Selector Dropdown (Sleek & Never Overlaps) ─── */}
        <div className="relative shrink-0" ref={screenMenuRef}>
          <button
            type="button"
            onClick={() => setShowScreenMenu((v) => !v)}
            aria-expanded={showScreenMenu}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 transition-colors shadow-2xs"
            title="Đổi màn hình trong luồng WiFi Marketing"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-800">{SCREEN_LABELS[screen]}</span>
            {screen !== 'portal' && (
              <span
                className={`w-2 h-2 rounded-full ${isScreenEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                title={isScreenEnabled ? 'Màn hình đang BẬT' : 'Màn hình đang TẮT'}
              />
            )}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showScreenMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Màn hình luồng WiFi
              </div>
              <div className="space-y-0.5">
                {(Object.entries(SCREEN_LABELS) as [ScreenId, string][]).map(([key, label]) => {
                  const isActive = screen === key;
                  const icon =
                    key === 'portal' ? '🌐' : key === 'video_gate' ? '🎬' : key === 'attendance_gate' ? '📋' : '📢';
                  const desc =
                    key === 'portal'
                      ? 'Trang chào & đăng nhập WiFi chính'
                      : key === 'video_gate'
                      ? 'Video quảng cáo trước khi duyệt'
                      : key === 'attendance_gate'
                      ? 'Điểm danh đại biểu cuộc họp'
                      : 'Thông báo & tin tức bắt buộc';

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        onSelectScreen(key);
                        setShowScreenMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{icon}</span>
                        <div className="min-w-0 truncate">
                          <div className="truncate font-medium">{label}</div>
                          <div className="text-[10px] text-slate-400 truncate">{desc}</div>
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Gate screen enable/disable toggle inside dropdown */}
              {screen !== 'portal' && onToggleScreenEnabled && (
                <div className="mt-1 pt-1.5 border-t border-slate-100 px-2 py-1.5 flex items-center justify-between bg-slate-50 rounded-lg">
                  <span className="text-[11px] font-medium text-slate-700">Kích hoạt trong luồng:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScreenEnabled}
                      onChange={(e) => onToggleScreenEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Center Section: Device Switcher & Dimensions ─── */}
      <div className="cms-device-tools flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 shrink-0">
        <div className="flex items-center gap-0.5 shrink-0">
          {(
            [
              { key: 'mobile', label: 'Mobile', icon: Smartphone },
              { key: 'tablet', label: 'Tablet', icon: Tablet },
              { key: 'desktop', label: 'PC', icon: Monitor },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              aria-label={label}
              aria-pressed={activeDevice === key}
              onClick={() => onSelectDevice(key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap transition-all ${
                activeDevice === key && !isComparing
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="shrink-0">{label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Preset Resolution Selector */}
        <select
          aria-label="Kích thước màn hình"
          value={activePresetIndex}
          onChange={(e) => onSelectPreset(Number(e.target.value))}
          disabled={isComparing}
          className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-md px-2 py-1 outline-none hover:border-slate-300 focus:border-blue-500 cursor-pointer disabled:opacity-50"
        >
          {currentPresets.map((preset, index) => {
            const label =
              activeDevice === 'desktop'
                ? preset.width === 1440
                  ? '1440 × 900 (MacBook)'
                  : preset.width === 1920
                  ? '1920 × 1080 (PC FHD)'
                  : preset.width === 1366
                  ? '1366 × 768 (Laptop)'
                  : `${preset.width} × ${preset.height}`
                : activeDevice === 'tablet'
                ? preset.width === 768
                  ? '768 × 1024 (iPad)'
                  : preset.width === 820
                  ? '820 × 1180 (iPad Air)'
                  : `${preset.width} × ${preset.height}`
                : preset.width === 390
                ? '390 × 844 (iPhone)'
                : `${preset.width} × ${preset.height}`;

            return (
              <option key={index} value={index}>
                {label}
              </option>
            );
          })}
        </select>

        {activeDevice !== 'desktop' && (
          <button
            onClick={onToggleRotate}
            disabled={isComparing}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              isRotated
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
            } disabled:opacity-50`}
            title={isRotated ? 'Đang xoay ngang (click để về dọc)' : 'Xoay ngang màn hình'}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Compare 3 Devices */}
        <button
          onClick={onToggleCompare}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            isComparing
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Chế độ xem đồng thời 3 thiết bị"
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">3 thiết bị</span>
        </button>
      </div>

      {/* ─── Right Section: Zoom, Undo, Preview, Options Menu & Publish ─── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Zoom Controls (- / % / +) */}
        <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200 gap-0.5">
          <button
            onClick={() => onSetZoom(Math.max(0.2, Number((zoom - 0.1).toFixed(2))))}
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
            title="Thu nhỏ (-10%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <select
            aria-label="Thu phóng canvas"
            value={zoomMode === 'fit' ? 'fit' : zoom}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'fit') {
                onSetZoomMode('fit');
              } else {
                const numericZoom = Number(val);
                onSetZoom(numericZoom);
                onSetZoomMode(numericZoom);
              }
            }}
            className="bg-transparent text-slate-700 font-medium text-xs px-1 py-0.5 outline-none cursor-pointer"
          >
            <option value="fit">Vừa khung ({Math.round(zoom * 100)}%)</option>
            <option value={0.35}>35%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
          <button
            onClick={() => onSetZoom(Math.min(2.0, Number((zoom + 0.1).toFixed(2))))}
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
            title="Phóng to (+10%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Hoàn tác (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Làm lại (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preview / Edit Toggle */}
        <button
          onClick={onToggleMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            mode === 'simulate'
              ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
          }`}
          title="Chế độ chạy thử / chỉnh sửa"
        >
          {mode === 'simulate' ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Chỉnh sửa</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Xem trước</span>
            </>
          )}
        </button>

        {/* ─── Options Menu (⋯ Tùy chọn) ─── */}
        <div className="relative" ref={optionsMenuRef}>
          <button
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            aria-expanded={showOptionsMenu}
            className={`p-1.5 rounded-lg border transition-colors ${
              showOptionsMenu
                ? 'bg-slate-100 text-slate-900 border-slate-300'
                : 'bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
            }`}
            title="Tùy chọn mẫu & đồng bộ"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showOptionsMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs">
              <div className="px-2 py-1.5 font-semibold text-slate-800 border-b border-slate-100 flex items-center justify-between">
                <span>Cài đặt mẫu thiết kế</span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* Sync settings */}
              <div className="p-2 space-y-2 border-b border-slate-100">
                <label className="block text-[11px] font-medium text-slate-600">Đồng bộ giữa 3 thiết bị:</label>
                <select
                  value={deviceSync}
                  onChange={(e) => onSetDeviceSync(e.target.value as DeviceSyncMode)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none"
                >
                  <option value="content">Nội dung & cấu hình luồng</option>
                  <option value="content-style">Nội dung, màu sắc & hiệu ứng</option>
                  <option value="off">Chỉnh riêng từng thiết bị</option>
                </select>
                <button
                  disabled={deviceSync === 'off'}
                  onClick={() => {
                    onSynchronizeNow();
                    setShowOptionsMenu(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đồng bộ từ thiết bị hiện tại</span>
                </button>
              </div>

              {/* Template preset replacement */}
              <div className="p-2 border-b border-slate-100 space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-indigo-500" />
                  <span>Đổi giao diện mẫu khác:</span>
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onSelectPresetTemplate(e.target.value);
                      setShowOptionsMenu(false);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 outline-none"
                >
                  <option value="">Chọn thiết kế từ thư viện mẫu...</option>
                  {TEMPLATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Revision history & Backup draft download */}
              <div className="p-1 space-y-1">
                <button
                  onClick={() => {
                    onOpenRevisions();
                    setShowOptionsMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left"
                >
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Lịch sử các lần xuất bản</span>
                </button>
                <button
                  onClick={() => {
                    onDownloadDraft();
                    setShowOptionsMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Tải bản nháp dự phòng (.json)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Publish Action Button */}
        <button
          onClick={onOpenPublish}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Xuất bản</span>
        </button>
      </div>
    </header>
  );
}
