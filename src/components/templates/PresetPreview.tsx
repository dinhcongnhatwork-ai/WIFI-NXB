'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import { createPresetDocument, type TemplatePreset } from '@/lib/template-presets';
import { DEVICES, DEVICE_KEYS, SCREEN_LABELS, type DeviceVariant, type ScreenId } from '@/lib/template-document';

export default function PresetPreview({ preset, onClose, onChoose, creating, canChoose = true, replacing = false }: { preset: TemplatePreset; onClose: () => void; onChoose: () => void; creating: boolean; canChoose?: boolean; replacing?: boolean }) {
  const document = useMemo(() => createPresetDocument(preset.id), [preset.id]);
  const [device, setDevice] = useState<DeviceVariant>('mobile');
  const [screen, setScreen] = useState<ScreenId>('portal');
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const viewport = DEVICES[device].presets[0];
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    const bodyOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select, input, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); window.document.body.style.overflow = bodyOverflow; previous?.focus(); };
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-2 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="preset-preview-title" className="admin-shell admin-popover flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div><h2 id="preset-preview-title" className="font-semibold text-slate-900">{preset.name} · {preset.category}</h2><p className="mt-0.5 text-xs text-slate-500">Xem thiết kế của từng màn hình trước khi tạo bản nháp.</p></div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng xem trước" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Màn hình">{(Object.keys(SCREEN_LABELS) as ScreenId[]).map(id => <button key={id} type="button" aria-pressed={screen === id} onClick={() => setScreen(id)} className={`rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${screen === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{SCREEN_LABELS[id]}</button>)}</div>
        <div className="flex gap-1" role="group" aria-label="Thiết bị">{DEVICE_KEYS.map(id => <button key={id} type="button" aria-pressed={device === id} onClick={() => setDevice(id)} className={`rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${device === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{DEVICES[id].label}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
        <div className="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ width: viewport.width, maxWidth: '100%' }}>
          <DocumentRenderer document={document} variant={device} viewport={viewport} mode="edit" screen={screen} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">
          {replacing && 'Thay thiết kế cả 3 thiết bị. Bản cũ sẽ được tải xuống JSON; có thể hoàn tác. Cần xuất bản riêng để áp dụng cho chiến dịch.'}
          {!replacing && preset.id === 'van-hoa-doc' && 'Đã bật thông báo giới thiệu không gian đọc.'}
          {!replacing && preset.id === 'xuat-ban-so' && 'Đã bật video giới thiệu xuất bản số (9:16).'}
          {!replacing && preset.id === 'hoi-nghi' && 'Đã bật điểm danh đại biểu và thông tin đơn vị.'}
          {!replacing && preset.id === 'trien-lam' && 'Đã bật thông báo giới thiệu triển lãm.'}
          {!replacing && preset.id === 'ly-luan-chinh-tri' && 'Kết nối trực tiếp; có thể bật các màn hình bổ sung.'}
        </p>
        <button type="button" disabled={!canChoose || creating} onClick={onChoose} className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">{creating ? 'Đang tạo...' : replacing ? `Áp dụng ${preset.name}` : `Dùng ${preset.name}`}</button>
      </div>
    </div>
  </div>, window.document.body);
}
