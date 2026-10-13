'use client';

import React, { useState } from 'react';
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
}: CmsPublishModalProps) {
  const [publishing, setPublishing] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-gray-700">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Kiểm tra & Xuất bản mẫu</h3>
            <p className="text-xs text-gray-400 mt-0.5">{templateName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : warnings.length > 0
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
            }`}
          >
            {errors.length > 0 ? (
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            ) : warnings.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div>
              <p className="font-semibold text-sm">
                {errors.length > 0
                  ? `Có ${errors.length} lỗi cần xử lý trước khi xuất bản`
                  : warnings.length > 0
                  ? `Sẵn sàng xuất bản (${warnings.length} cảnh báo chất lượng)`
                  : 'Bản thiết kế hoàn hảo, sẵn sàng xuất bản!'}
              </p>
              <p className="text-[11px] opacity-80 mt-0.5">
                Đã kiểm tra cấu trúc 3 thiết bị Mobile, Tablet và PC.
              </p>
            </div>
          </div>

          {/* Errors list */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                Lỗi chặn xuất bản ({errors.length})
              </h4>
              <div className="space-y-1.5">
                {errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-200 text-xs"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-rose-900/60 text-[10px] uppercase font-mono shrink-0">
                      {err.variant || 'toàn cục'}
                    </span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings list */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Cảnh báo khuyến nghị ({warnings.length})
              </h4>
              <div className="space-y-1.5">
                {warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40 text-amber-200 text-xs"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-amber-900/60 text-[10px] uppercase font-mono shrink-0">
                      {warn.variant || 'toàn cục'}
                    </span>
                    <span>{warn.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected campaigns */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Chiến dịch WiFi chịu tác động ({campaigns.length})
            </h4>
            {campaigns.length === 0 ? (
              <p className="text-gray-500 italic">Hiện chưa có chiến dịch nào sử dụng mẫu này.</p>
            ) : (
              <div className="space-y-1.5">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                      <span className="font-medium text-white">{camp.name}</span>
                      <span className="text-[11px] text-gray-500 font-mono">SSID: {camp.ssid}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-md font-medium ${
                        camp.active
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                          : 'bg-gray-100 text-gray-400'
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
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishing}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all"
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
