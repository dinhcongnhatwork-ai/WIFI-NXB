'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Send,
  Loader2,
} from 'lucide-react';
import {
  type TemplateDocumentV2,
  validateDocument,
  type DocumentIssue,
  DEVICES,
} from '@/lib/template-document';
import toast from 'react-hot-toast';

interface CampaignInfo {
  id: string;
  name: string;
  ssid: string;
  active: boolean;
}

interface CmsPublishModalProps {
  templateId: string;
  templateName: string;
  document: TemplateDocumentV2;
  currentVersion: number;
  campaigns: CampaignInfo[];
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onPublished: (newVersion: number) => void;
  onInspectIssue?: (issue: DocumentIssue) => void;
}

export default function CmsPublishModal({
  templateId,
  templateName,
  document,
  currentVersion,
  campaigns,
  token,
  isOpen,
  onClose,
  onPublished,
  onInspectIssue,
}: CmsPublishModalProps) {
  const [publishing, setPublishing] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = window.document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !publishing) onClose();
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [isOpen, publishing, onClose]);

  if (!isOpen) return null;

  const issues = validateDocument(document);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const canPublish = errors.length === 0;

  const handlePublish = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);

    try {
      const res = await fetch(`/api/templates/${templateId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expectedVersion: currentVersion }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Xuất bản thất bại');
      }

      toast.success('Xuất bản thành công! Chiến dịch đang chạy đã được cập nhật.');
      onPublished(json.data.draftVersion);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xuất bản bản nháp');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cms-publish-heading" className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-700">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 id="cms-publish-heading" className="text-base font-bold text-slate-900">Kiểm tra & Xuất bản mẫu</h3>
            <p className="text-xs text-slate-500 mt-0.5">{templateName}</p>
          </div>
          <button
            type="button" aria-label="Đóng kiểm tra xuất bản"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Status summary */}
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 ${
              errors.length > 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : warnings.length > 0
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {errors.length > 0 ? (
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            ) : warnings.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <div>
              <p className="font-semibold text-sm">
                {errors.length > 0
                  ? `Có ${errors.length} lỗi cần xử lý trước khi xuất bản`
                  : warnings.length > 0
                  ? `Sẵn sàng xuất bản (${warnings.length} cảnh báo chất lượng)`
                  : 'Mẫu đã qua kiểm tra, sẵn sàng xuất bản'}
              </p>
              <p className="text-[11px] opacity-80 mt-0.5">
                Đã kiểm tra cấu trúc 3 thiết bị Mobile, Tablet và PC.
              </p>
            </div>
          </div>

          {/* Errors list */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                Lỗi chặn xuất bản ({errors.length})
              </h4>
              <div className="space-y-1.5">
                {errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-rose-800 text-xs"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] uppercase font-mono shrink-0">
                      {err.variant ? DEVICES[err.variant].label : 'Toàn cục'}
                    </span>
                    <span>{err.message}</span>
                    {err.nodeId && onInspectIssue && <button type="button" onClick={() => onInspectIssue(err)} className="ml-auto shrink-0 rounded-md border border-rose-300 px-2 py-1 font-semibold focus-visible:outline focus-visible:outline-2">Đến thành phần</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings list */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                Cảnh báo khuyến nghị ({warnings.length})
              </h4>
              <div className="space-y-1.5">
                {warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-800 text-xs"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] uppercase font-mono shrink-0">
                      {warn.variant ? DEVICES[warn.variant].label : 'Toàn cục'}
                    </span>
                    <span>{warn.message}</span>
                    {warn.nodeId && onInspectIssue && <button type="button" onClick={() => onInspectIssue(warn)} className="ml-auto shrink-0 rounded-md border border-amber-300 px-2 py-1 font-semibold focus-visible:outline focus-visible:outline-2">Đến thành phần</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected campaigns */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Chiến dịch WiFi chịu tác động ({campaigns.length})
            </h4>
            {campaigns.length === 0 ? (
              <p className="text-slate-500 italic">Hiện chưa có chiến dịch nào sử dụng mẫu này.</p>
            ) : (
              <div className="space-y-1.5">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-medium text-slate-900">{camp.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">SSID: {camp.ssid}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-md font-medium ${
                        camp.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {camp.active ? 'Đang phát' : 'Tạm dừng'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishing}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xuất bản...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Xác nhận xuất bản</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
