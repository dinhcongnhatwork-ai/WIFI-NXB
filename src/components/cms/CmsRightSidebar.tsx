'use client';

import React, { useState, useEffect, useId } from 'react';
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
  STUDIO_FONT_FAMILIES,
  STUDIO_GRADIENT_PRESETS,
  STUDIO_BRAND_PALETTES,
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
  unit = 'px',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const inputId = useId();
  const safeVal = Number.isFinite(value) ? value : min;
  const [text, setText] = useState(String(step < 1 ? Number(safeVal.toFixed(2)) : Math.round(safeVal)));

  useEffect(() => {
    setText(String(step < 1 ? Number(safeVal.toFixed(2)) : Math.round(safeVal)));
  }, [safeVal, step]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    setText(String(step < 1 ? Number(next.toFixed(2)) : Math.round(next)));
    onChange(next); // Realtime preview dispatch
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const num = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(num) && num >= min && num <= max) {
      onChange(num); // Realtime preview dispatch
    }
  };

  const handleBlur = () => {
    const num = Number(text);
    if (!text.trim() || !Number.isFinite(num)) {
      setText(String(safeVal));
      return;
    }
    const clamped = Math.min(max, Math.max(min, num));
    setText(String(clamped));
    if (clamped !== safeVal) onChange(clamped);
  };

  const pct = Math.max(0, Math.min(100, ((safeVal - min) / (max - min)) * 100));

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={inputId} className="font-medium text-slate-700 select-none cursor-pointer text-[11px]">
          {label}
        </label>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 shadow-2xs">
          <input
            id={inputId}
            type="number"
            min={min}
            max={max}
            step={step}
            value={text}
            onChange={handleTextChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBlur();
                e.currentTarget.blur();
              }
            }}
            className="w-11 text-right text-xs text-slate-900 font-mono tabular-nums bg-transparent outline-none"
          />
          <span className="text-[11px] text-slate-400 font-medium select-none">{unit}</span>
        </div>
      </div>
      <div className="relative flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeVal}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-all"
          style={{
            background: `linear-gradient(to right, #2563eb ${pct}%, #e2e8f0 ${pct}%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ──────────────────────── Brand Color Swatch Picker ──────────────────────── */
function BrandColorControl({
  label,
  value,
  brandColors = [],
  onChange,
  onAddBrandColor,
  allowTransparent = false,
}: {
  label: string;
  value: string;
  brandColors?: string[];
  onChange: (color: string) => void;
  onAddBrandColor?: (color: string) => void;
  allowTransparent?: boolean;
}) {
  const safeHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '') ? value : '#2563eb';
  const swatches = Array.from(
    new Set([...brandColors, '#ffffff', '#0f172a', '#2563eb', '#10b981', '#f59e0b', '#e11d48'])
  ).slice(0, 9);

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-slate-600 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer bg-transparent shrink-0"
        />
        <input
          type="text"
          value={value || ''}
          placeholder={allowTransparent ? 'transparent / #hex' : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
        />
        {allowTransparent && (
          <button
            type="button"
            onClick={() => onChange('transparent')}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
              !value || value === 'transparent'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Trong suốt"
          >
            Trong suốt
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap pt-0.5">
        {swatches.map((sw) => (
          <button
            key={sw}
            type="button"
            onClick={() => onChange(sw)}
            style={{ backgroundColor: sw }}
            className={`w-5 h-5 rounded-md border transition-transform hover:scale-110 ${
              value?.toLowerCase() === sw.toLowerCase()
                ? 'ring-2 ring-blue-500 border-white'
                : 'border-slate-300'
            }`}
            title={`Chọn màu ${sw}`}
          />
        ))}
        {onAddBrandColor && /^#([0-9a-f]{6})$/i.test(value || '') && !brandColors.includes(value) && (
          <button
            type="button"
            onClick={() => onAddBrandColor(value)}
            className="px-1.5 h-5 rounded-md border border-dashed border-slate-300 text-[10px] text-slate-500 hover:text-blue-600 hover:border-blue-400"
            title="Lưu màu này vào Bảng màu thương hiệu"
          >
            + Lưu màu
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────── Studio Typography Inspector ──────────────────────── */
function TypographyInspectorGroup({
  el,
  brandColors,
  onUpdate,
  onAddBrandColor,
  defaultFontSize = 24,
  defaultWeight = '700',
}: {
  el: Record<string, any>;
  brandColors: string[];
  onUpdate: (updater: (target: any) => void) => void;
  onAddBrandColor?: (color: string) => void;
  defaultFontSize?: number;
  defaultWeight?: string;
}) {
  const fontSizeNum = parseInt(String(el.fontSize || defaultFontSize), 10) || defaultFontSize;
  const weightStr = String(el.fontWeight ?? defaultWeight);
  const isBold = Number(weightStr) >= 700 || weightStr === 'bold';
  const isItalic = el.fontStyle === 'italic';
  const isUnderline = el.textDecoration === 'underline';
  const isUppercase = el.textTransform === 'uppercase';
  const currentAlign = el.align || 'center';

  return (
    <div className="space-y-3.5">
      {/* Font Family */}
      <div>
        <label className="text-[11px] font-medium text-slate-600 block mb-1">Phông chữ (Font Family)</label>
        <select
          value={el.fontFamily || ''}
          onChange={(e) => onUpdate((t) => (t.fontFamily = e.target.value || undefined))}
          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
        >
          <option value="">Mặc định hệ thống (Inter)</option>
          {STUDIO_FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label} — {f.sample}
            </option>
          ))}
        </select>
      </div>

      {/* Style Toggles (B / I / U / AA) & Alignment */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-600 block mb-1">Kiểu chữ nhanh</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onUpdate((t) => (t.fontWeight = isBold ? '400' : '700'))}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                isBold
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="In đậm (Bold)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => onUpdate((t) => (t.fontStyle = isItalic ? 'normal' : 'italic'))}
              className={`flex-1 py-1.5 rounded-lg text-xs italic font-serif border transition-colors ${
                isItalic
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="In nghiêng (Italic)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => onUpdate((t) => (t.textDecoration = isUnderline ? 'none' : 'underline'))}
              className={`flex-1 py-1.5 rounded-lg text-xs underline border transition-colors ${
                isUnderline
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Gạch chân (Underline)"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => onUpdate((t) => (t.textTransform = isUppercase ? 'none' : 'uppercase'))}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                isUppercase
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="IN HOA (Uppercase)"
            >
              AA
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-600 block mb-1">Căn lề chữ</label>
          <div className="flex gap-1">
            {(
              [
                { key: 'left', label: 'Trái' },
                { key: 'center', label: 'Giữa' },
                { key: 'right', label: 'Phải' },
                { key: 'justify', label: 'Đều' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onUpdate((t) => (t.align = key))}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  currentAlign === key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Font Size & Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-600 block mb-1">Cỡ chữ (px)</label>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={10}
              max={72}
              step={1}
              value={fontSizeNum}
              onChange={(e) => onUpdate((t) => (t.fontSize = `${e.target.value}px`))}
              className="flex-1 h-1.5 accent-blue-600 cursor-pointer bg-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={el.fontSize || `${defaultFontSize}px`}
              onChange={(e) => onUpdate((t) => (t.fontSize = e.target.value))}
              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 text-center"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-600 block mb-1">Độ đậm (Weight)</label>
          <select
            value={weightStr}
            onChange={(e) => onUpdate((t) => (t.fontWeight = e.target.value))}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="300">300 - Mỏng (Light)</option>
            <option value="400">400 - Thường (Regular)</option>
            <option value="500">500 - Vừa (Medium)</option>
            <option value="600">600 - Bán đậm (SemiBold)</option>
            <option value="700">700 - Đậm (Bold)</option>
            <option value="800">800 - Rất đậm (ExtraBold)</option>
            <option value="900">900 - Siêu đậm (Black)</option>
          </select>
        </div>
      </div>

      {/* Text Color + Brand Swatches */}
      <BrandColorControl
        label="Màu chữ"
        value={el.color || '#ffffff'}
        brandColors={brandColors}
        onChange={(c) => onUpdate((t) => (t.color = c))}
        onAddBrandColor={onAddBrandColor}
      />

      {/* Spacing: Line Height & Letter Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <SliderInput
          label="Giãn dòng (Line Height)"
          value={Number(el.lineHeight ?? 1.35)}
          min={1}
          max={2.2}
          step={0.05}
          unit="x"
          onChange={(v) => onUpdate((t) => (t.lineHeight = v))}
        />
        <SliderInput
          label="Giãn chữ (Letter Spacing)"
          value={parseFloat(String(el.letterSpacing ?? 0)) || 0}
          min={-2}
          max={10}
          step={0.5}
          unit="px"
          onChange={(v) => onUpdate((t) => (t.letterSpacing = v))}
        />
      </div>

      {/* Advanced Text Effects & Pill Box */}
      <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700 select-none">
          Hiệu ứng chữ & nền chữ
        </summary>
        <div className="mt-3 space-y-3 pt-2 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">Đổ bóng chữ (Text Shadow)</label>
              <select
                value={el.textShadow || 'none'}
                onChange={(e) => onUpdate((t) => (t.textShadow = e.target.value === 'none' ? undefined : e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="none">Không đổ bóng</option>
                <option value="sm">Bóng nhẹ (Dễ đọc)</option>
                <option value="md">Bóng vừa (Nổi khối)</option>
                <option value="lg">Bóng đậm (Tương phản cao)</option>
                <option value="glow">Phát sáng hào quang (Glow)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">Viền chữ (Stroke px)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={6}
                  step={0.5}
                  value={el.textStrokeWidth ?? (parseFloat(el.textStroke || '0') || 0)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onUpdate((t) => {
                      t.textStrokeWidth = v;
                      t.textStroke = v > 0 ? `${v}px` : undefined;
                    });
                  }}
                  className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                />
                <input
                  type="color"
                  value={el.textStrokeColor || '#000000'}
                  onChange={(e) => onUpdate((t) => (t.textStrokeColor = e.target.value))}
                  className="w-7 h-7 rounded border border-slate-300 cursor-pointer bg-transparent"
                  title="Màu viền chữ"
                />
              </div>
            </div>
          </div>

          {/* Text Gradient */}
          <div>
            <label className="text-[11px] font-medium text-slate-600 block mb-1">Chữ chuyển sắc (Text Gradient)</label>
            <select
              value={el.textGradient || ''}
              onChange={(e) => onUpdate((t) => (t.textGradient = e.target.value || undefined))}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="">Không dùng (Dùng màu chữ đơn)</option>
              <option value="linear-gradient(135deg, #ffffff 0%, #93c5fd 100%)">Trắng Băng → Xanh Sáng</option>
              <option value="linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #fbbf24 100%)">Hoàng Kim Sang Trọng (Gold)</option>
              <option value="linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)">Xanh Đại Dương (Ocean)</option>
              <option value="linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)">Ngọc Lục Bảo (Emerald)</option>
              <option value="linear-gradient(135deg, #fda4af 0%, #e11d48 100%)">Hồng Ngọc Sự Kiện (Crimson)</option>
            </select>
          </div>

          {/* Text Pill / Background Box */}
          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <BrandColorControl
              label="Màu nền hộp chữ / Badge (Text Box)"
              value={el.bgColor || 'transparent'}
              brandColors={brandColors}
              onChange={(c) => onUpdate((t) => (t.bgColor = c))}
              allowTransparent
            />
            {el.bgColor && el.bgColor !== 'transparent' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <SliderInput
                    label="Độ đậm nền hộp (%)"
                    value={Math.round((el.bgOpacity ?? 1) * 100)}
                    min={10}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(v) => onUpdate((t) => (t.bgOpacity = v / 100))}
                  />
                  <SliderInput
                    label="Mờ kính nền (Blur)"
                    value={el.backdropBlur ?? 0}
                    min={0}
                    max={20}
                    step={2}
                    unit="px"
                    onChange={(v) => onUpdate((t) => (t.backdropBlur = v))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Đệm ngang (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={el.paddingX ?? 14}
                      onChange={(e) => onUpdate((t) => (t.paddingX = Number(e.target.value)))}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Đệm dọc (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={el.paddingY ?? 8}
                      onChange={(e) => onUpdate((t) => (t.paddingY = Number(e.target.value)))}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Bo góc (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={parseInt(el.borderRadius || '12', 10) || 12}
                      onChange={(e) => onUpdate((t) => (t.borderRadius = `${e.target.value}px`))}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </details>
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
  useEffect(() => { if (copyTarget === device) setCopyTarget(device === 'mobile' ? 'tablet' : 'mobile'); }, [device, copyTarget]);

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

    onUpdateDocument((d) => {
      const n = findNode(screenSurface(d.variants[device], screen).sections.find(s => s.id === activeSection!.id)?.nodes || [], selectedNodeId!);
      if (n) {
        n.layout[field] = value;
      }
    });
  };

  const updateNodeElement = (updater: (el: any, node: DesignNode) => void) => {
    if (!selectedNode || !activeSection || selectedCore?.locked || selectedNode.locked) return;
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
      <aside className="w-12 bg-white border-l border-slate-200 flex flex-col items-center py-3 z-30 shrink-0 select-none shadow-sm">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 mb-3 transition-colors"
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
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
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
    'w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 outline-none focus:border-blue-500';
  const labelCls = 'text-[10px] text-slate-500 block mb-1 font-medium';
  const headingCls = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wider';
  const borderCls = 'border-slate-200';
  const btnGhostCls = 'p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors';

  return (
    <aside data-inspector-only={inspectorOnly || undefined} className="cms-inspector w-[300px] bg-white border-l border-slate-200 flex flex-col z-30 shrink-0 select-none text-slate-700 shadow-sm">
      {inspectorOnly && <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold">Thuộc tính<button aria-label="Thu gọn thuộc tính" onClick={() => setIsCollapsed(true)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button></div>}
      {/* Tab Navigation Header */}
      <div className={inspectorOnly ? 'hidden' : 'h-12 border-b border-slate-200 px-3 flex items-center justify-between shrink-0 bg-white'}>
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl" hidden={inspectorOnly}>
          <button
            onClick={() => setActiveTab('components')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'components'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900'
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
                : 'text-slate-500 hover:text-slate-900'
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
                : 'text-slate-500 hover:text-slate-900'
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
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Thuộc tính"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Thuộc tính</span>
          </button>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Thu gọn bảng"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ──────────────────────── TAB 1: THÀNH PHẦN (COMPONENTS) ──────────────────────── */}
      {activeTab === 'components' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm thành phần (logo, nút, ảnh...)"
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Quick Add Section button */}
          <div className="px-3 pt-2.5 pb-2">
            <button
              onClick={() => onAddSection('flow')}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] rounded-xl text-xs text-blue-700 font-semibold border border-blue-200 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Thêm khối nội dung (Section)</span>
            </button>
          </div>

          {/* Component item list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredCategories.map((group) => (
              <div key={group.category}>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
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
                      className="group flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-300 text-left transition-all active:scale-[0.99]"
                    >
                      <div className="p-2 rounded-lg bg-white border border-slate-200 group-hover:border-blue-400 group-hover:text-blue-600 transition-colors shrink-0 shadow-xs">
                        <Icon className="w-4 h-4 text-slate-700 group-hover:text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-[10px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            + Thêm
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{desc}</p>
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
            <div className="text-center py-8 text-slate-500 text-xs">
              <p>Chưa có section nào.</p>
              <button
                onClick={() => onAddSection('flow')}
                className="mt-2 text-blue-600 font-medium hover:underline block mx-auto"
              >
                + Thêm khối nội dung mới
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
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Section Bar */}
                  <div
                    onClick={() => {
                      onSelectNode(null, null);
                      onSelectSection(section.id);
                      setActiveTab('inspector');
                    }}
                    className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-50 rounded-t-xl"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">
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
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                        title="Di chuyển lên"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveSection(section.id, 'down')}
                        disabled={sIndex === activeVariant.sections.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                        title="Di chuyển xuống"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteSection(section.id)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        title="Xóa section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section Nodes List */}
                  <div className="p-1.5 space-y-1 border-t border-slate-100">
                    {section.nodes.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic p-2 text-center">
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
                                : 'text-slate-700 hover:bg-slate-100'
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
                                  className="bg-white px-1 py-0.5 rounded text-xs border border-blue-400 text-slate-900 outline-none w-32"
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
                                className="p-0.5 hover:text-slate-900 disabled:opacity-20"
                                title="Lên trên"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onMoveNode(section.id, node.id, 'down')}
                                disabled={nIndex === section.nodes.length - 1}
                                className="p-0.5 hover:text-slate-900 disabled:opacity-20"
                                title="Xuống dưới"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onToggleLockNode(section.id, node.id)}
                                className="p-0.5 hover:text-slate-900"
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
                                className="p-0.5 hover:text-slate-900"
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
                                className="p-0.5 hover:text-slate-900"
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
          {(selectedNode || activeSection) ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2">
              <div className="min-w-0 flex items-center gap-1.5 text-xs text-slate-600 truncate">
                <button
                  type="button"
                  onClick={() => {
                    onSelectNode(null, null);
                    onSelectSection(null);
                  }}
                  className="hover:text-blue-600 hover:underline shrink-0 font-medium"
                >
                  Trang
                </button>
                {activeSection && (
                  <>
                    <span className="text-slate-400">›</span>
                    <button
                      type="button"
                      onClick={() => onSelectNode(null, activeSection.id)}
                      className={`truncate ${!selectedNode ? 'font-semibold text-slate-900' : 'hover:text-blue-600 hover:underline'}`}
                    >
                      {activeSection.name}
                    </button>
                  </>
                )}
                {selectedNode && (
                  <>
                    <span className="text-slate-400">›</span>
                    <span className="font-semibold text-blue-700 truncate">{selectedNode.name}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectNode(null, null);
                  onSelectSection(null);
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-200/80 hover:bg-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                title="Mở cài đặt Ảnh nền & Màu nền cho toàn bộ trang Portal"
              >
                <ImageIcon className="h-3.5 w-3.5 text-slate-500" /> Nền trang
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-blue-600" /> Cài đặt Nền trang Portal
              </span>
            </div>
          )}
          {/* ========================================================================= */}
          {/* CASE 1: NODE PROPERTIES                                                   */}
          {/* ========================================================================= */}
          {selectedNode && activeSection ? (
            <div className="space-y-4">
              {/* Header: Node Name + Delete / Duplicate */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-sm font-bold text-slate-900 block">{selectedNode.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeSection.mode === 'flow' ? 'Bố cục co giãn' : 'Bố cục tự do'}{selectedNode.locked ? ' · Đã khóa' : ''}
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
                    disabled={!!selectedCore || selectedNode.locked} onClick={() => onDeleteNode(activeSection!.id, selectedNode!.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa phần tử"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Flow Mode Status Badge */}
              {activeSection.mode === 'flow' ? (
                <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bố cục Co giãn (Responsive)</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                  <span className="text-[11px] text-amber-800 font-medium">Bố cục tự do (Legacy)</span>
                  <button
                    onClick={() => updateSection((s) => (s.mode = 'flow'))}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium transition-colors"
                  >
                    Chuyển sang Co giãn
                  </button>
                </div>
              )}

              {activeSection.mode === 'flow' && selectedNode.grid && <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-700">Vị trí trong lưới</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([['column', 'Cột'], ['row', 'Hàng'], ['columnSpan', 'Số cột chiếm'], ['rowSpan', 'Số hàng chiếm']] as const).map(([key, label]) => <label key={key} className={labelCls}>{label}<input type="number" min={1} max={key === 'column' || key === 'columnSpan' ? activeSection.columns : 100} value={selectedNode.grid?.[key] || 1} disabled={selectedNode.locked} className={inputCls} onChange={event => {
                    const value = Math.max(1, Math.min(key === 'column' || key === 'columnSpan' ? activeSection.columns : 100, Number(event.target.value) || 1));
                    onUpdateDocument(draft => { const node = propertyNode(draft); if (node?.grid) node.grid[key] = value; });
                  }} /></label>)}
                </div>
              </fieldset>}

              {/* ─── Layout Box with SLIDERS ─── */}
              <details open className="cms-layout-group space-y-3 border-b border-slate-200 pb-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">Vị trí & kích thước</summary>

                {/* X and Y Sliders only in Freeform mode */}
                {activeSection.mode === 'freeform' && (
                  <div className="grid grid-cols-2 gap-3">
                    <SliderInput
                      label="Vị trí X"
                      value={Math.round(selectedNode.layout.x || 0)}
                      min={0}
                      max={activeSection.width || 400}
                      onChange={(v) => updateNodeLayout('x', v)}
                    />
                    <SliderInput
                      label="Vị trí Y"
                      value={Math.round(selectedNode.layout.y || 0)}
                      min={0}
                      max={activeSection.height || 800}
                      onChange={(v) => updateNodeLayout('y', v)}
                    />
                  </div>
                )}

                {/* Width and Height Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <SliderInput
                    label="Chiều rộng"
                    value={Math.round(selectedNode.layout.width || 100)}
                    min={16}
                    max={activeSection.width || 600}
                    onChange={(v) => updateNodeLayout('width', Math.max(16, v))}
                  />
                  <SliderInput
                    label="Chiều cao"
                    value={Math.round(selectedNode.layout.height || 40)}
                    min={8}
                    max={activeSection.height || 800}
                    onChange={(v) => updateNodeLayout('height', Math.max(8, v))}
                  />
                </div>

                {/* Quick alignment in Freeform */}
                {activeSection.mode === 'freeform' && (
                  <div>
                    <label className={labelCls}>Căn lề nhanh</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateNodeLayout('x', 24)}
                        className="flex-1 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded text-[11px] text-slate-700 font-medium transition-colors"
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
                        className="flex-1 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded text-[11px] text-slate-700 font-medium transition-colors"
                      >
                        Giữa
                      </button>
                      <button
                        onClick={() =>
                          updateNodeLayout('x', activeSection!.width - selectedNode!.layout.width - 24)
                        }
                        className="flex-1 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded text-[11px] text-slate-700 font-medium transition-colors"
                      >
                        Phải
                      </button>
                    </div>
                  </div>
                )}
              </details>

              {/* ─── ELEMENT-SPECIFIC CONTROLS ─── */}

              {/* TITLE ELEMENT */}
              {selectedNode.element.type === 'title' && (
                <div className="space-y-3.5">
                  <div>
                    <label className={labelCls}>Nội dung tiêu đề</label>
                    <textarea
                      rows={2}
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
                  <TypographyInspectorGroup
                    el={selectedNode.element as any}
                    brandColors={doc.brandColors || []}
                    onUpdate={updateNodeElement}
                    onAddBrandColor={(color) =>
                      onUpdateDocument((d) => {
                        if (!d.brandColors.includes(color)) d.brandColors.push(color);
                      })
                    }
                    defaultFontSize={26}
                    defaultWeight="700"
                  />
                </div>
              )}

              {/* DESCRIPTION ELEMENT */}
              {selectedNode.element.type === 'description' && (
                <div className="space-y-3.5">
                  <div>
                    <label className={labelCls}>Nội dung đoạn văn</label>
                    <textarea
                      rows={3}
                      value={(selectedNode.element as any).content || ''}
                      onChange={(e) => updateNodeElement((el) => (el.content = e.target.value))}
                      className={inputCls}
                    />
                  </div>
                  <TypographyInspectorGroup
                    el={selectedNode.element as any}
                    brandColors={doc.brandColors || []}
                    onUpdate={updateNodeElement}
                    onAddBrandColor={(color) =>
                      onUpdateDocument((d) => {
                        if (!d.brandColors.includes(color)) d.brandColors.push(color);
                      })
                    }
                    defaultFontSize={15}
                    defaultWeight="400"
                  />
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
                          max={200}
                          value={parseInt(iel.borderRadius || '8', 10) || 8}
                          onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Tỷ lệ khung hình</label>
                        <select
                          value={iel.aspectRatio || 'auto'}
                          onChange={(e) => updateNodeElement((el) => (el.aspectRatio = e.target.value))}
                          className={inputCls}
                        >
                          <option value="auto">Tự do (Theo chiều cao)</option>
                          <option value="16/9">16:9 (Banner ngang)</option>
                          <option value="4/3">4:3 (Tiêu chuẩn)</option>
                          <option value="1/1">1:1 (Vuông)</option>
                          <option value="3/4">3:4 (Chân dung)</option>
                          <option value="9/16">9:16 (Story dọc)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Khung cắt hình học (Mask)</label>
                        <select
                          value={iel.maskShape || 'rounded'}
                          onChange={(e) => updateNodeElement((el) => (el.maskShape = e.target.value))}
                          className={inputCls}
                        >
                          <option value="rounded">Chữ nhật bo góc</option>
                          <option value="rect">Chữ nhật sắc cạnh</option>
                          <option value="circle">Hình tròn (Circle)</option>
                          <option value="arch">Vòm kiến trúc (Arch)</option>
                          <option value="pill">Viên thuốc (Pill)</option>
                        </select>
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
                          <option value="xl">Đổ bóng nổi 3D (XL)</option>
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
                          <option value="glass">Viền kính mờ (Glass)</option>
                        </select>
                      </div>
                    </div>

                    {iel.borderStyle && iel.borderStyle !== 'none' && iel.borderStyle !== 'glass' && (
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <label className={labelCls}>Màu viền</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={iel.borderColor || '#cbd5e1'}
                              onChange={(e) => updateNodeElement((el) => (el.borderColor = e.target.value))}
                              className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono text-slate-700">{iel.borderColor || '#cbd5e1'}</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Độ dày viền (px)</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={typeof iel.borderWidth === 'number' ? iel.borderWidth : parseInt(iel.borderWidth || '2', 10) || 2}
                            onChange={(e) => updateNodeElement((el) => (el.borderWidth = Number(e.target.value)))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    )}

                    {/* Image Caption / Label */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                      <h5 className="text-[11px] font-semibold text-slate-700">Chú thích / Nhãn trên ảnh (Caption)</h5>
                      <input
                        type="text"
                        placeholder="Nhập dòng chú thích hoặc ưu đãi trên ảnh..."
                        value={iel.caption || ''}
                        onChange={(e) => updateNodeElement((el) => (el.caption = e.target.value))}
                        className={inputCls}
                      />
                      {iel.caption && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Vị trí nhãn</label>
                            <select
                              value={iel.captionPosition || 'overlay-bottom'}
                              onChange={(e) => updateNodeElement((el) => (el.captionPosition = e.target.value))}
                              className={inputCls}
                            >
                              <option value="overlay-bottom">Đè lên chân ảnh</option>
                              <option value="below">Bên dưới khung ảnh</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Màu chữ nhãn</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={iel.captionColor || '#ffffff'}
                                onChange={(e) => updateNodeElement((el) => (el.captionColor = e.target.value))}
                                className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                              />
                              <span className="text-xs font-mono text-slate-700">{iel.captionColor || '#ffffff'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Image Filters & Effects */}
                    <details className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <summary className="text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                         Bộ lọc màu & Hiệu ứng ảnh (Brightness / Contrast / Blur)
                      </summary>
                      <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-200">
                        <SliderInput
                          label="Độ hiển thị (Opacity %)"
                          value={Math.round((iel.opacity ?? 1) * 100)}
                          min={10}
                          max={100}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.opacity = v / 100))}
                        />
                        <SliderInput
                          label="Độ sáng (Brightness %)"
                          value={iel.brightness ?? 100}
                          min={40}
                          max={160}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.brightness = v))}
                        />
                        <SliderInput
                          label="Độ tương phản (Contrast %)"
                          value={iel.contrast ?? 100}
                          min={50}
                          max={160}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.contrast = v))}
                        />
                        <SliderInput
                          label="Độ bão hòa màu (Saturate %)"
                          value={iel.saturate ?? 100}
                          min={0}
                          max={200}
                          step={10}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.saturate = v))}
                        />
                        <SliderInput
                          label="Trắng đen (Grayscale %)"
                          value={iel.grayscale ?? 0}
                          min={0}
                          max={100}
                          step={10}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.grayscale = v))}
                        />
                        <SliderInput
                          label="Làm mờ ảnh (Blur px)"
                          value={iel.blur ?? 0}
                          min={0}
                          max={20}
                          step={1}
                          unit="px"
                          onChange={(v) => updateNodeElement((el) => (el.blur = v))}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateNodeElement((el) => {
                              el.opacity = 1;
                              el.brightness = 100;
                              el.contrast = 100;
                              el.saturate = 100;
                              el.grayscale = 0;
                              el.blur = 0;
                            })
                          }
                          className="w-full py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-600"
                        >
                          Đặt lại bộ lọc gốc
                        </button>
                      </div>
                    </details>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-slate-700">Căn chỉnh vị trí & Thu phóng</h5>
                      <SliderInput
                        label="Độ phóng to ảnh (Zoom: 1x - 3x)"
                        value={iel.zoom ?? 1}
                        min={1}
                        max={3}
                        step={0.1}
                        unit="x"
                        onChange={(v) => updateNodeElement((el) => (el.zoom = v))}
                      />
                      <SliderInput
                        label="Dịch chuyển ngang (Offset X: -100px đến 100px)"
                        value={iel.posX ?? 0}
                        min={-100}
                        max={100}
                        step={1}
                        unit="px"
                        onChange={(v) => updateNodeElement((el) => (el.posX = v))}
                      />
                      <SliderInput
                        label="Dịch chuyển dọc (Offset Y: -100px đến 100px)"
                        value={iel.posY ?? 0}
                        min={-100}
                        max={100}
                        step={1}
                        unit="px"
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
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {pos === 'left' ? 'Trái' : pos === 'center' ? 'Giữa' : 'Phải'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Logo Plate / Badge Frame */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-slate-700">Đế nền & Khung nổi cho Logo</h5>
                      <BrandColorControl
                        label="Màu đế nền Logo (Giúp logo nổi trên nền tối/ảnh)"
                        value={lel.bgColor || 'transparent'}
                        brandColors={doc.brandColors || []}
                        onChange={(c) => updateNodeElement((el) => (el.bgColor = c))}
                        allowTransparent
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <SliderInput
                          label="Đệm quanh Logo (Padding)"
                          value={typeof lel.padding === 'number' ? lel.padding : parseInt(lel.padding || '0', 10) || 0}
                          min={0}
                          max={32}
                          step={2}
                          unit="px"
                          onChange={(v) => updateNodeElement((el) => (el.padding = v))}
                        />
                        <SliderInput
                          label="Bo góc đế Logo"
                          value={parseInt(lel.borderRadius || '14', 10) || 14}
                          min={0}
                          max={100}
                          step={2}
                          unit="px"
                          onChange={(v) => updateNodeElement((el) => (el.borderRadius = `${v}px`))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Đổ bóng Logo</label>
                          <select
                            value={lel.shadow || 'none'}
                            onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                            className={inputCls}
                          >
                            <option value="none">Không đổ bóng</option>
                            <option value="soft">Bóng nhẹ (Soft)</option>
                            <option value="medium">Bóng vừa (Medium)</option>
                            <option value="strong">Bóng sâu (Strong)</option>
                            <option value="glow">Phát sáng (Glow)</option>
                          </select>
                        </div>
                        <SliderInput
                          label="Độ rõ (Opacity %)"
                          value={Math.round((lel.opacity ?? 1) * 100)}
                          min={20}
                          max={100}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.opacity = v / 100))}
                        />
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

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                      <h5 className="text-[11px] font-semibold text-slate-700">Tùy chọn phát video</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.autoplay ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.autoplay = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Tự động phát</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.muted ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.muted = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Tắt tiếng</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vel.loop ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.loop = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Lặp lại vô tận</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
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
                          <option value="luxury_gold"> Hoàng gia Mạ vàng</option>
                          <option value="cinematic_dark"> Tối sang trọng (Dark)</option>
                          <option value="glass_neon"> Kính mờ Neon</option>
                          <option value="clean_light"> Trắng ngọc trai</option>
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
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                      <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-blue-600" />
                        <span>Luồng Video Gate Marketing</span>
                      </div>
                      <p className="text-[11px] text-blue-700 leading-relaxed">
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
                          <option value="luxury_gold"> Hoàng gia Mạ vàng</option>
                          <option value="cinematic_dark"> Rạp phim IMAX</option>
                          <option value="glass_neon"> Kính mờ Neon</option>
                          <option value="clean_light"> Trắng ngọc trai</option>
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

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                      <SliderInput
                        label="Thời gian xem bắt buộc trước khi cho kết nối (giây)"
                        value={vgel.skipAfter ?? 5}
                        min={1}
                        max={60}
                        step={1}
                        onChange={(v) => updateNodeElement((el) => (el.skipAfter = v))}
                      />
                      <p className="text-[10px] text-slate-500">Khách phải đợi xem hết thời gian này mới được bấm kết nối.</p>
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
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-1.5">
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
                const images: { src: string; alt: string; title?: string; subtitle?: string; badge?: string }[] = sel.images || [];

                const handleAddSlide = () => {
                  updateNodeElement((el) => {
                    if (!el.images) el.images = [];
                    el.images.push({ src: '', alt: `Slide ${el.images.length + 1}`, title: '', subtitle: '', badge: '' });
                  });
                };

                const handleUpdateSlide = (index: number, field: 'src' | 'alt' | 'title' | 'subtitle' | 'badge', val: string) => {
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
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Danh sách Slide ({images.length})</span>
                        <span className="text-[10px] text-slate-500">Quản lý ảnh, tiêu đề và nhãn từng slide</span>
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
                        <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500">
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
                          <div key={idx} className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-mono">
                                  {idx + 1}
                                </span>
                                Slide {idx + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveSlide(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded hover:bg-slate-200"
                                  title="Lên trên"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveSlide(idx, 1)}
                                  disabled={idx === images.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded hover:bg-slate-200"
                                  title="Xuống dưới"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveSlide(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
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

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Nhãn nổi (Badge)</label>
                                <input
                                  type="text"
                                  placeholder="VD: HOT / MỚI"
                                  value={slide.badge || ''}
                                  onChange={(e) => handleUpdateSlide(idx, 'badge', e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Mô tả ảnh (Alt)</label>
                                <input
                                  type="text"
                                  placeholder="Mô tả ảnh..."
                                  value={slide.alt || ''}
                                  onChange={(e) => handleUpdateSlide(idx, 'alt', e.target.value)}
                                  className={inputCls}
                                />
                              </div>
                            </div>

                            <div>
                              <label className={labelCls}>Tiêu đề trên Slide (Tùy chọn)</label>
                              <input
                                type="text"
                                placeholder="Tiêu đề nổi bật trên ảnh..."
                                value={slide.title || ''}
                                onChange={(e) => handleUpdateSlide(idx, 'title', e.target.value)}
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className={labelCls}>Phụ đề trên Slide (Tùy chọn)</label>
                              <input
                                type="text"
                                placeholder="Mô tả ngắn gọn..."
                                value={slide.subtitle || ''}
                                onChange={(e) => handleUpdateSlide(idx, 'subtitle', e.target.value)}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <h5 className="text-[11px] font-semibold text-slate-700">Cấu hình trình chiếu</h5>

                      <SliderInput
                        label="Thời gian chuyển slide (giây)"
                        value={sel.interval ?? 4}
                        min={1}
                        max={10}
                        step={1}
                        unit="s"
                        onChange={(v) => updateNodeElement((el) => (el.interval = v))}
                      />

                      <SliderInput
                        label="Chiều cao Slider (px)"
                        value={parseInt(sel.height || '200', 10) || 200}
                        min={100}
                        max={500}
                        step={10}
                        unit="px"
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
                        <div>
                          <label className={labelCls}>Hiệu ứng chuyển</label>
                          <select
                            value={sel.transitionType || 'fade'}
                            onChange={(e) => updateNodeElement((el) => (el.transitionType = e.target.value))}
                            className={inputCls}
                          >
                            <option value="fade">Mờ dần (Fade)</option>
                            <option value="slide">Trượt ngang (Slide)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={sel.autoplay ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.autoplay = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span>Tự chạy</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={sel.showDots ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.showDots = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span>Chấm tròn</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={sel.showArrows ?? true}
                            onChange={(e) => updateNodeElement((el) => (el.showArrows = e.target.checked))}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span>Mũi tên</span>
                        </label>
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
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                          <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ael.titleBold ?? true}
                              onChange={(e) => updateNodeElement((el) => (el.titleBold = e.target.checked))}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-bold">Đậm</span>
                          </label>
                          <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
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
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Màu nền Popup</label>
                          <input
                            type="color"
                            value={ael.bgColor || '#ffffff'}
                            onChange={(e) => updateNodeElement((el) => (el.bgColor = e.target.value))}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
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
                          <option value="luxury_gold"> Hoàng gia Mạ vàng</option>
                          <option value="cinematic_dark"> Rạp phim IMAX</option>
                          <option value="glass_neon"> Kính mờ Neon</option>
                          <option value="clean_light"> Trắng ngọc trai</option>
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

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-slate-700">Nút đóng / tiếp tục</h5>
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
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Màu chữ nút</label>
                          <input
                            type="color"
                            value={ael.buttonTextColor || '#ffffff'}
                            onChange={(e) => updateNodeElement((el) => (el.buttonTextColor = e.target.value))}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
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
                const gradFrom = typeof cbel.gradient === 'object' ? cbel.gradient?.from : '#2563eb';
                const gradTo = typeof cbel.gradient === 'object' ? cbel.gradient?.to : '#1d4ed8';
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
                      <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2.5">
                        <div>
                          <label className={labelCls}>Mẫu Gradient nhanh</label>
                          <select
                            value={typeof cbel.gradient === 'string' ? cbel.gradient : cbel.gradient?.css || ''}
                            onChange={(e) => {
                              const preset = STUDIO_GRADIENT_PRESETS.find((g) => g.value === e.target.value);
                              updateNodeElement((el) => {
                                if (preset) {
                                  el.gradient = { from: preset.from, to: preset.to, css: preset.value };
                                }
                              });
                            }}
                            className={inputCls}
                          >
                            <option value="">-- Chọn mẫu chuyển màu --</option>
                            {STUDIO_GRADIENT_PRESETS.map((g) => (
                              <option key={g.label} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <BrandColorControl
                            label="Màu bắt đầu"
                            value={gradFrom || '#2563eb'}
                            brandColors={doc.brandColors}
                            onChange={(c) =>
                              updateNodeElement((el) => {
                                el.gradient = { from: c, to: gradTo || '#1d4ed8' };
                              })
                            }
                          />
                          <BrandColorControl
                            label="Màu kết thúc"
                            value={gradTo || '#1d4ed8'}
                            brandColors={doc.brandColors}
                            onChange={(c) =>
                              updateNodeElement((el) => {
                                el.gradient = { from: gradFrom || '#2563eb', to: c };
                              })
                            }
                          />
                        </div>
                        <BrandColorControl
                          label="Màu chữ nút"
                          value={cbel.color || cbel.textColor || '#ffffff'}
                          brandColors={doc.brandColors}
                          onChange={(c) =>
                            updateNodeElement((el) => {
                              el.color = c;
                              el.textColor = c;
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <BrandColorControl
                          label="Màu nền nút"
                          value={cbel.bgColor || cbel.backgroundColor || '#2563eb'}
                          brandColors={doc.brandColors}
                          onChange={(c) =>
                            updateNodeElement((el) => {
                              el.bgColor = c;
                              el.backgroundColor = c;
                            })
                          }
                        />
                        <BrandColorControl
                          label="Màu chữ nút"
                          value={cbel.color || cbel.textColor || '#ffffff'}
                          brandColors={doc.brandColors}
                          onChange={(c) =>
                            updateNodeElement((el) => {
                              el.color = c;
                              el.textColor = c;
                            })
                          }
                        />
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
                          <option value="wifi"> Sóng WiFi</option>
                          <option value="lightning"> Sấm sét tốc độ</option>
                          <option value="arrow"> Mũi tên tiếp tục</option>
                          <option value="shield"> Khiên bảo mật</option>
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

                    {/* Typography & Sizing for Connect Button */}
                    <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700 select-none">
                        Kiểu chữ & Kích thước nút nâng cao
                      </summary>
                      <div className="mt-3 space-y-2.5">
                        <div>
                          <label className={labelCls}>Font chữ nút</label>
                          <select
                            value={cbel.fontFamily || 'inherit'}
                            onChange={(e) => updateNodeElement((el) => (el.fontFamily = e.target.value))}
                            className={inputCls}
                          >
                            {STUDIO_FONT_FAMILIES.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Cỡ chữ (px)</label>
                            <input
                              type="number"
                              min={11}
                              max={32}
                              value={parseInt(cbel.fontSize || '15', 10) || 15}
                              onChange={(e) => updateNodeElement((el) => (el.fontSize = `${e.target.value}px`))}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Độ đậm (Weight)</label>
                            <select
                              value={String(cbel.fontWeight || 700)}
                              onChange={(e) => updateNodeElement((el) => (el.fontWeight = Number(e.target.value)))}
                              className={inputCls}
                            >
                              <option value="500">500 - Medium</option>
                              <option value="600">600 - SemiBold</option>
                              <option value="700">700 - Bold</option>
                              <option value="800">800 - ExtraBold</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Kiểu chữ</label>
                            <select
                              value={cbel.textTransform || 'none'}
                              onChange={(e) => updateNodeElement((el) => (el.textTransform = e.target.value))}
                              className={inputCls}
                            >
                              <option value="none">Bình thường</option>
                              <option value="uppercase">CHỮ IN HOA</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Đệm dọc nút (px)</label>
                            <input
                              type="number"
                              min={8}
                              max={32}
                              value={cbel.paddingY ?? 14}
                              onChange={(e) => updateNodeElement((el) => (el.paddingY = Number(e.target.value)))}
                              className={inputCls}
                            />
                          </div>
                        </div>
                      </div>
                    </details>

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

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <h5 className="text-[11px] font-semibold text-slate-700">Thu thập thông tin & Điều khoản</h5>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
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

                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={!!cbel.requireConfirm} onChange={e => updateNodeElement(el => { el.requireConfirm = e.target.checked; })} />Yêu cầu đồng ý điều khoản trước khi kết nối</label>
                      <div>
                        <label className={labelCls}>Điều khoản sử dụng WiFi</label>
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
                    {isDivider && (
                      <div className="space-y-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                        <BrandColorControl
                          label="Màu đường kẻ"
                          value={del.color || '#cbd5e1'}
                          brandColors={doc.brandColors}
                          onChange={(c) => updateNodeElement((el) => (el.color = c))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Kiểu đường kẻ</label>
                            <select
                              value={del.dividerStyle || 'solid'}
                              onChange={(e) => updateNodeElement((el) => (el.dividerStyle = e.target.value))}
                              className={inputCls}
                            >
                              <option value="solid">Nét liền (Solid)</option>
                              <option value="dashed">Nét đứt (Dashed)</option>
                              <option value="dotted">Nét chấm (Dotted)</option>
                              <option value="gradient-fade">Mờ dần 2 đầu (Fade)</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Độ dày (px)</label>
                            <input
                              type="number"
                              min={1}
                              max={16}
                              value={del.thickness ?? 2}
                              onChange={(e) => updateNodeElement((el) => (el.thickness = Number(e.target.value)))}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <SliderInput
                          label="Chiều rộng đường kẻ (%)"
                          value={del.widthPercent ?? 100}
                          min={10}
                          max={100}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.widthPercent = v))}
                        />
                        <SliderInput
                          label="Độ rõ (Opacity %)"
                          value={Math.round((del.opacity ?? 1) * 100)}
                          min={10}
                          max={100}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.opacity = v / 100))}
                        />
                      </div>
                    )}

                    {!isSpacer && !isDivider && (
                      <div className="space-y-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                        <BrandColorControl
                          label="Màu nền khối / Hình khối"
                          value={del.color || '#ffffff'}
                          brandColors={doc.brandColors}
                          allowTransparent
                          onChange={(c) => updateNodeElement((el) => (el.color = c))}
                        />

                        <div>
                          <label className={labelCls}>Hoặc Gradient nền khối</label>
                          <select
                            value={del.gradient || ''}
                            onChange={(e) => updateNodeElement((el) => (el.gradient = e.target.value))}
                            className={inputCls}
                          >
                            <option value="">-- Không dùng Gradient --</option>
                            {STUDIO_GRADIENT_PRESETS.map((g) => (
                              <option key={g.label} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <MediaUploadField
                            label="Hoặc Ảnh nền khối (Chọn từ Thư viện / Dán Link URL)"
                            value={del.backgroundImage || mediaUrl(selectedNode.media.backgroundImage) || ''}
                            defaultFolderId="anh-nen-portal"
                            alwaysShowUrlInput
                            accept="image/*"
                            onChange={(url: string) => {
                              onUpdateDocument((d) => {
                                const n = propertyNode(d);
                                if (n) {
                                  setNodeMedia(n, 'backgroundImage', url);
                                  (n.element as any).backgroundImage = url;
                                }
                              });
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Hình dạng (Shape)</label>
                            <select
                              value={del.shapeVariant || 'rectangle'}
                              onChange={(e) => updateNodeElement((el) => (el.shapeVariant = e.target.value))}
                              className={inputCls}
                            >
                              <option value="rectangle">Chữ nhật bo góc</option>
                              <option value="pill">Viên thuốc (Pill)</option>
                              <option value="circle">Hình tròn / Elip</option>
                              <option value="arch">Vòm cung (Arch)</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Bo góc (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={parseInt(del.borderRadius || '16', 10) || 16}
                              onChange={(e) => updateNodeElement((el) => (el.borderRadius = `${e.target.value}px`))}
                              className={inputCls}
                            />
                          </div>
                        </div>

                        <SliderInput
                          label="Độ đục nền (Opacity %)"
                          value={Math.round((del.opacity ?? 0.9) * 100)}
                          min={0}
                          max={100}
                          step={5}
                          unit="%"
                          onChange={(v) => updateNodeElement((el) => (el.opacity = v / 100))}
                        />

                        <SliderInput
                          label="Kính mờ (Backdrop Blur px)"
                          value={del.backdropBlur ?? 0}
                          min={0}
                          max={24}
                          step={2}
                          unit="px"
                          onChange={(v) => updateNodeElement((el) => (el.backdropBlur = v))}
                        />

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                          <div>
                            <label className={labelCls}>Viền khung</label>
                            <select
                              value={del.borderStyle || 'none'}
                              onChange={(e) => updateNodeElement((el) => (el.borderStyle = e.target.value))}
                              className={inputCls}
                            >
                              <option value="none">Không viền</option>
                              <option value="solid">Viền liền (Solid)</option>
                              <option value="dashed">Viền đứt (Dashed)</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Đổ bóng (Shadow)</label>
                            <select
                              value={del.shadow || 'none'}
                              onChange={(e) => updateNodeElement((el) => (el.shadow = e.target.value))}
                              className={inputCls}
                            >
                              <option value="none">Không có</option>
                              <option value="soft">Nhẹ (Soft)</option>
                              <option value="medium">Vừa (Medium)</option>
                              <option value="strong">Đậm 3D (Strong)</option>
                              <option value="glow">Phát sáng (Glow)</option>
                            </select>
                          </div>
                        </div>

                        {del.borderStyle && del.borderStyle !== 'none' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={labelCls}>Độ dày viền (px)</label>
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={del.borderWidth ?? 1}
                                onChange={(e) => updateNodeElement((el) => (el.borderWidth = Number(e.target.value)))}
                                className={inputCls}
                              />
                            </div>
                            <BrandColorControl
                              label="Màu viền"
                              value={del.borderColor || '#e2e8f0'}
                              brandColors={doc.brandColors}
                              onChange={(c) => updateNodeElement((el) => (el.borderColor = c))}
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-sm font-bold text-slate-900">{activeSection.name}</span>
                <button
                  onClick={() => onDeleteSection(activeSection!.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Xóa section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Section Mode Info */}
              {activeSection.mode === 'freeform' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5">
                  <p className="text-amber-800 text-[11px] font-medium">Section này đang dùng bố cục tự do cũ (Pixel coordinates). Khuyến nghị chuyển sang co giãn để hiển thị chuẩn trên mọi thiết bị.</p>
                  <button
                    onClick={() => updateSection((s) => (s.mode = 'flow'))}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    Chuyển sang Bố cục Co giãn (Chuẩn)
                  </button>
                </div>
              )}

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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Số cột (Columns)</label>
                      <select
                        value={activeSection.columns || 1}
                        onChange={(e) => updateSection((s) => (s.columns = Number(e.target.value) as 1 | 2 | 3))}
                        className={inputCls}
                      >
                        <option value={1}>1 Cột dọc</option>
                        <option value={2}>2 Cột lưới</option>
                        <option value={3}>3 Cột lưới</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Căn chỉnh con</label>
                      <select
                        value={activeSection.align || 'center'}
                        onChange={(e) => updateSection((s) => (s.align = e.target.value as 'start' | 'center' | 'end'))}
                        className={inputCls}
                      >
                        <option value="start">Trái (Start)</option>
                        <option value="center">Giữa (Center)</option>
                        <option value="end">Phải (End)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section Card / Glassmorphism Styling */}
              <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-semibold text-slate-700">Khung Thẻ Section & Kính mờ (Card Style)</h5>

                <BrandColorControl
                  label="Màu nền Section"
                  value={activeSection.background || 'transparent'}
                  brandColors={doc.brandColors}
                  allowTransparent
                  onChange={(c) => updateSection((s) => (s.background = c))}
                />

                <div>
                  <label className={labelCls}>Hoặc Gradient nền Section</label>
                  <select
                    value={activeSection.gradient || ''}
                    onChange={(e) => updateSection((s) => (s.gradient = e.target.value))}
                    className={inputCls}
                  >
                    <option value="">-- Không dùng Gradient --</option>
                    {STUDIO_GRADIENT_PRESETS.map((g) => (
                      <option key={g.label} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <MediaUploadField
                    label="Hoặc Ảnh nền Section (Chọn từ Thư viện / Dán Link URL)"
                    value={activeSection.backgroundImage || ''}
                    defaultFolderId="anh-nen-portal"
                    alwaysShowUrlInput
                    accept="image/*"
                    onChange={(url: string) => updateSection((s) => (s.backgroundImage = url))}
                  />
                </div>

                {activeSection.background && activeSection.background !== 'transparent' && !activeSection.gradient && (
                  <SliderInput
                    label="Độ đục màu nền Section (%)"
                    value={Math.round((activeSection.bgOpacity ?? 1) * 100)}
                    min={5}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(v) => updateSection((s) => (s.bgOpacity = v / 100))}
                  />
                )}

                <SliderInput
                  label="Hiệu ứng kính mờ (Backdrop Blur px)"
                  value={activeSection.backdropBlur ?? 0}
                  min={0}
                  max={24}
                  step={2}
                  unit="px"
                  onChange={(v) => updateSection((s) => (s.backdropBlur = v))}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Bo góc Section (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={64}
                      value={parseInt(activeSection.borderRadius || '0', 10) || 0}
                      onChange={(e) => updateSection((s) => (s.borderRadius = `${e.target.value}px`))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Đổ bóng (Shadow)</label>
                    <select
                      value={activeSection.shadow || 'none'}
                      onChange={(e) => updateSection((s) => (s.shadow = e.target.value as any))}
                      className={inputCls}
                    >
                      <option value="none">Không có</option>
                      <option value="soft">Nhẹ (Soft)</option>
                      <option value="medium">Vừa (Medium)</option>
                      <option value="strong">Đậm 3D (Strong)</option>
                      <option value="glow">Phát sáng (Glow)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Kiểu viền Section</label>
                    <select
                      value={activeSection.borderStyle || 'none'}
                      onChange={(e) => updateSection((s) => (s.borderStyle = e.target.value as any))}
                      className={inputCls}
                    >
                      <option value="none">Không viền</option>
                      <option value="solid">Viền liền (Solid)</option>
                      <option value="dashed">Viền đứt (Dashed)</option>
                    </select>
                  </div>
                  {activeSection.borderStyle && activeSection.borderStyle !== 'none' && (
                    <div>
                      <label className={labelCls}>Độ dày viền (px)</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={activeSection.borderWidth ?? 1}
                        onChange={(e) => updateSection((s) => (s.borderWidth = Number(e.target.value)))}
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>

                {activeSection.borderStyle && activeSection.borderStyle !== 'none' && (
                  <BrandColorControl
                    label="Màu viền Section"
                    value={activeSection.borderColor || 'rgba(255,255,255,0.25)'}
                    brandColors={doc.brandColors}
                    onChange={(c) => updateSection((s) => (s.borderColor = c))}
                  />
                )}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CASE 3: PAGE / VARIANT SETTINGS (NOTHING SELECTED)                        */
            /* ========================================================================= */
            <div className="space-y-5">
              {/* BRAND PALETTE & SWATCHES */}
              <div className="cms-brand-palette bg-slate-50/90 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className={headingCls}>Bảng màu thương hiệu</h4>
                  <select
                    value=""
                    onChange={(e) => {
                      const found = STUDIO_BRAND_PALETTES.find((p) => p.name === e.target.value);
                      if (found) {
                        onUpdateDocument((d) => {
                          d.brandColors = [...found.colors];
                        });
                      }
                    }}
                    className="w-full min-w-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="">+ Chọn bộ phối màu...</option>
                    {STUDIO_BRAND_PALETTES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(doc.brandColors || ['#0f172a', '#2563eb', '#38bdf8', '#f8fafc', '#ffffff']).map((c, idx) => (
                    <label
                      key={`${c}-${idx}`}
                      className="relative w-7 h-7 rounded-lg border border-slate-300 shadow-2xs cursor-pointer overflow-hidden hover:scale-105 transition-transform"
                      style={{ backgroundColor: c }}
                      title={`Đổi màu thương hiệu #${idx + 1}: ${c}`}
                    >
                      <input
                        type="color"
                        value={c.startsWith('#') && c.length === 7 ? c : '#2563eb'}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          onUpdateDocument((d) => {
                            if (!d.brandColors || d.brandColors.length === 0) {
                              d.brandColors = ['#0f172a', '#2563eb', '#38bdf8', '#f8fafc', '#ffffff'];
                            }
                            d.brandColors[idx] = nextVal;
                          });
                        }}
                        className="opacity-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  Nhấn vào ô màu để chỉnh sửa. Bảng màu này sẽ xuất hiện trong mọi bộ chọn màu của Portal.
                </p>
              </div>

              <div>
                <h4 className={`${headingCls} mb-3`}>Nền thiết bị ({device === 'desktop' ? 'PC' : device === 'tablet' ? 'Tablet' : 'Mobile'})</h4>

                <div className="space-y-4">
                  {/* Base color / Gradient & Display type */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-[11px] font-semibold text-slate-700">Chế độ nền chính</h5>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => updateBackground((b) => (b.bgMode = 'solid'))}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                            (bg.bgMode || 'solid') === 'solid' && !bgImage
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Màu đơn
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackground((b) => (b.bgMode = 'gradient'))}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                            bg.bgMode === 'gradient'
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Gradient
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackground((b) => (b.bgMode = 'image'))}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                            bg.bgMode === 'image' || (bgImage && bg.bgMode !== 'gradient')
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                           Ảnh nền
                        </button>
                      </div>
                    </div>

                    {bg.bgMode === 'gradient' ? (
                      <div className="space-y-2.5">
                        <div>
                          <label className={labelCls}>Mẫu Gradient nền Portal</label>
                          <select
                            value={bg.gradient || ''}
                            onChange={(e) => {
                              const preset = STUDIO_GRADIENT_PRESETS.find((g) => g.value === e.target.value);
                              updateBackground((b) => {
                                b.gradient = e.target.value;
                                if (preset) {
                                  b.gradientFrom = preset.from;
                                  b.gradientTo = preset.to;
                                }
                              });
                            }}
                            className={inputCls}
                          >
                            <option value="">-- Tùy chỉnh 2 màu --</option>
                            {STUDIO_GRADIENT_PRESETS.map((g) => (
                              <option key={g.label} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <BrandColorControl
                            label="Màu đầu"
                            value={bg.gradientFrom || '#0f172a'}
                            brandColors={doc.brandColors}
                            onChange={(c) =>
                              updateBackground((b) => {
                                b.gradientFrom = c;
                                b.gradient = '';
                              })
                            }
                          />
                          <BrandColorControl
                            label="Màu cuối"
                            value={bg.gradientTo || '#1e3a8a'}
                            brandColors={doc.brandColors}
                            onChange={(c) =>
                              updateBackground((b) => {
                                b.gradientTo = c;
                                b.gradient = '';
                              })
                            }
                          />
                        </div>
                        <SliderInput
                          label="Góc chuyển màu (Độ)"
                          value={bg.gradientAngle ?? 135}
                          min={0}
                          max={360}
                          step={15}
                          unit="°"
                          onChange={(v) =>
                            updateBackground((b) => {
                              b.gradientAngle = v;
                              b.gradient = '';
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <BrandColorControl
                          label="Màu nền dự phòng"
                          value={bg.color || '#0f172a'}
                          brandColors={doc.brandColors}
                          onChange={(c) => updateBackground((b) => (b.color = c))}
                        />

                        <div>
                          <label className={labelCls}>Kiểu hiển thị ảnh/video</label>
                          <select
                            value={bg.type || 'cover'}
                            onChange={(e) => updateBackground((b) => (b.type = e.target.value as any))}
                            className={inputCls}
                          >
                            <option value="cover">Phủ kín (Cover)</option>
                            <option value="contain">Vừa khít (Contain)</option>
                            <option value="fill">Kéo dãn (Fill)</option>
                            <option value="repeat">Lặp lại (Repeat)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Background image picker + Direct URL */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 space-y-2">
                    <MediaUploadField
                      value={bgImage}
                      defaultFolderId="anh-nen-portal"
                      alwaysShowUrlInput
                      onChange={(url: string) => {
                        onUpdateDocument((d) => {
                          const target = screenSurface(d.variants[device], screen);
                          const ref = mediaRef(url);
                          if (ref) {
                            target.backgroundMedia.image = ref;
                            target.background.bgMode = 'image';
                          } else {
                            delete target.backgroundMedia.image;
                          }
                        });
                      }}
                      accept="image/*"
                      label=" Ảnh nền trang"
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

                  {/* OVERLAY COLOR, GRADIENT SCRIM & OPACITY SLIDER */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[11px] font-semibold text-slate-700">Lớp phủ nền (Overlay / Scrim)</h5>
                      <select
                        value={bg.overlayMode || 'solid'}
                        onChange={(e) => updateBackground((b) => (b.overlayMode = e.target.value as any))}
                        className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700"
                      >
                        <option value="solid">Phủ đều (Solid)</option>
                        <option value="gradient">Phủ chuyển sắc (Scrim)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <BrandColorControl
                        label="Màu lớp phủ"
                        value={bg.overlayColor || '#000000'}
                        brandColors={doc.brandColors}
                        onChange={(c) => updateBackground((b) => (b.overlayColor = c))}
                      />
                      {bg.overlayMode === 'gradient' && (
                        <div>
                          <label className={labelCls}>Hướng Scrim</label>
                          <select
                            value={bg.overlayGradientDirection || 'to-b'}
                            onChange={(e) => updateBackground((b) => (b.overlayGradientDirection = e.target.value as any))}
                            className={inputCls}
                          >
                            <option value="to-b">Đậm ở dưới (Bottom)</option>
                            <option value="to-t">Đậm ở trên (Top)</option>
                            <option value="radial">Tối viền (Vignette)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* OVERLAY OPACITY SLIDER */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500 font-medium">
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
                          className="flex-1 h-2 accent-blue-600 cursor-pointer bg-slate-200 rounded-lg"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.round((bg.overlayOpacity ?? 0.3) * 100)}
                          onChange={(e) => updateBackground((b) => (b.overlayOpacity = Math.min(100, Math.max(0, Number(e.target.value))) / 100))}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 outline-none focus:border-blue-500 text-center"
                        />
                        <span className="text-[10px] text-slate-400 w-4">%</span>
                      </div>
                    </div>

                    {/* Background focal point X, Y & Image Filters */}
                    {(bgImage || bgVideo) && (
                      <div className="pt-2 border-t border-slate-200 space-y-2.5">
                        <label className={labelCls}>Tiêu điểm & Hiệu ứng ảnh/video nền</label>
                        <div className="grid grid-cols-2 gap-2">
                          <SliderInput
                            label="Tiêu điểm X (%)"
                            value={bg.focalX ?? 50}
                            min={0}
                            max={100}
                            step={5}
                            unit="%"
                            onChange={(v) => updateBackground((b) => (b.focalX = v))}
                          />
                          <SliderInput
                            label="Tiêu điểm Y (%)"
                            value={bg.focalY ?? 50}
                            min={0}
                            max={100}
                            step={5}
                            unit="%"
                            onChange={(v) => updateBackground((b) => (b.focalY = v))}
                          />
                        </div>
                        <SliderInput
                          label="Làm mờ ảnh nền (Blur px)"
                          value={bg.imageBlur ?? 0}
                          min={0}
                          max={24}
                          step={1}
                          unit="px"
                          onChange={(v) => updateBackground((b) => (b.imageBlur = v))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <SliderInput
                            label="Độ sáng (%)"
                            value={bg.brightness ?? 100}
                            min={40}
                            max={160}
                            step={5}
                            unit="%"
                            onChange={(v) => updateBackground((b) => (b.brightness = v))}
                          />
                          <SliderInput
                            label="Tương phản (%)"
                            value={bg.contrast ?? 100}
                            min={50}
                            max={160}
                            step={5}
                            unit="%"
                            onChange={(v) => updateBackground((b) => (b.contrast = v))}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DECORATIVE PATTERN OVERLAY */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <h5 className="text-[11px] font-semibold text-slate-700">Họa tiết trang trí nền (Pattern)</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Kiểu họa tiết</label>
                        <select
                          value={bg.pattern || 'none'}
                          onChange={(e) => updateBackground((b) => (b.pattern = e.target.value as any))}
                          className={inputCls}
                        >
                          <option value="none">Không dùng</option>
                          <option value="dots">Chấm bi (Dots)</option>
                          <option value="grid">Lưới kỹ thuật (Grid)</option>
                          <option value="diagonal">Sọc chéo (Diagonal)</option>
                          <option value="waves">Vòng sóng (Waves)</option>
                        </select>
                      </div>
                      {bg.pattern && bg.pattern !== 'none' && (
                        <BrandColorControl
                          label="Màu họa tiết"
                          value={bg.patternColor || '#ffffff'}
                          brandColors={doc.brandColors}
                          onChange={(c) => updateBackground((b) => (b.patternColor = c))}
                        />
                      )}
                    </div>
                    {bg.pattern && bg.pattern !== 'none' && (
                      <SliderInput
                        label="Độ rõ họa tiết (%)"
                        value={Math.round((bg.patternOpacity ?? 0.12) * 100)}
                        min={2}
                        max={50}
                        step={2}
                        unit="%"
                        onChange={(v) => updateBackground((b) => (b.patternOpacity = v / 100))}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Cross-device copy tool */}
              <details className="pt-4 border-t border-slate-200">
                <summary className="text-xs font-semibold cursor-pointer mb-2">Nâng cao: sao chép thiết bị</summary>
                <h4 className={`${headingCls} mb-2`}>Sao chép sang thiết bị khác</h4>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Đến:</span>
                    <select
                      value={copyTarget}
                      onChange={(e) => setCopyTarget(e.target.value as DeviceVariant)}
                      className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800"
                    >
                      <option disabled={device === 'mobile'} value="mobile">Mobile (390×844)</option>
                      <option disabled={device === 'tablet'} value="tablet">Tablet (768×1024)</option>
                      <option disabled={device === 'desktop'} value="desktop">PC (1440×900)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={copyAppend} onChange={e => setCopyAppend(e.target.checked)} />Thêm vào cuối, giữ thiết kế hiện tại</label>
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
