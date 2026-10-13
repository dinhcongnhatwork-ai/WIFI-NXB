'use client';

import React, { useEffect, useState } from 'react';
import { X, History, RotateCcw, Loader2, CheckCircle2, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface RevisionItem {
  id: string;
  templateId: string;
  author: string;
  createdAt: string;
  layoutJson: any;
}

interface CmsRevisionsModalProps {
  templateId: string;
  templateName: string;
  currentPublishedRevisionId?: string | null;
  currentVersion: number;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onRestored: (newVersion: number, newLayout: any) => void;
}

export default function CmsRevisionsModal({
  templateId,
  templateName,
  currentPublishedRevisionId,
  currentVersion,
  token,
  isOpen,
  onClose,
  onRestored,
}: CmsRevisionsModalProps) {
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/templates/${templateId}/revisions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRevisions(json.data);
      })
      .catch(() => toast.error('Không thể tải lịch sử phiên bản'))
      .finally(() => setLoading(false));
  }, [isOpen, templateId, token]);

  if (!isOpen) return null;

  const handleRestore = async (revision: RevisionItem) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn đưa phiên bản từ ${new Date(
          revision.createdAt
        ).toLocaleString()} về làm bản nháp hiện tại?`
      )
    ) {
      return;
    }

    setRestoringId(revision.id);
    try {
      const res = await fetch(`/api/templates/${templateId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          revisionId: revision.id,
          expectedVersion: currentVersion,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Khôi phục thất bại');

      toast.success('Đã khôi phục phiên bản về bản nháp!');
      onRestored(json.data.draftVersion, json.data.layoutJson);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi khôi phục');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-base font-bold text-white">Lịch sử phiên bản</h3>
              <p className="text-xs text-gray-400">{templateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              <p>Chưa có phiên bản xuất bản nào được lưu.</p>
            </div>
          ) : (
            revisions.map((rev) => {
              const isCurrent = rev.id === currentPublishedRevisionId;

              return (
                <div
                  key={rev.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-blue-950/20 border-blue-800/60'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {new Date(rev.createdAt).toLocaleString('vi-VN')}
                        </span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Đang chạy trên portal
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-500" />
                          {rev.author}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">ID: {rev.id.slice(0, 16)}...</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestore(rev)}
                      disabled={restoringId === rev.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 hover:text-gray-900 rounded-lg text-xs font-medium border border-gray-300 transition-colors disabled:opacity-50"
                      title="Đưa phiên bản này về làm bản nháp"
                    >
                      {restoringId === rev.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Khôi phục</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
