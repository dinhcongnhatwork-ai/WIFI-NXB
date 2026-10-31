'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Eye, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { TEMPLATE_PRESETS, type TemplatePreset } from '@/lib/template-presets';
import { createTemplateFromPreset } from './create-preset';
import PresetPreview from './PresetPreview';

export default function PresetGallery({ templateName }: { templateName?: string }) {
  const router = useRouter();
  const { token, canOperate } = useAuth();
  const [creating, setCreating] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemplatePreset | null>(null);
  const creatingRef = useRef(false);

  async function choose(preset: TemplatePreset) {
    if (!canOperate || creatingRef.current) return;
    if (!token) { toast.error('Vui lòng đăng nhập để tạo mẫu.'); return; }
    creatingRef.current = true;
    setCreating(preset.id);
    try {
      const id = await createTemplateFromPreset(preset.id, token, templateName);
      toast.success(`Đã tạo ${templateName?.trim() || preset.name}`);
      router.push(`/admin/templates/${id}/builder`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tạo mẫu thất bại');
      creatingRef.current = false;
      setCreating(null);
    }
  }

  return <section aria-labelledby="preset-gallery-title" className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">Thư viện khởi đầu</p>
        <h2 id="preset-gallery-title" className="text-lg font-semibold text-slate-900">Chọn một phong cách. Bắt đầu thiết kế.</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Mỗi mẫu có đủ 4 màn hình và 3 kích thước thiết bị. Trang kết nối được bật sẵn; các bước bổ sung có thể bật trong trình thiết kế.</p>
      </div>
      <span className="shrink-0 text-xs text-slate-500">5 mẫu có sẵn</span>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {TEMPLATE_PRESETS.map(preset => <article key={preset.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button type="button" onClick={() => setPreview(preset)} className="group relative block aspect-[16/11] w-full overflow-hidden bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label={`Xem trước ${preset.name}: ${preset.category}`}>
          <img src={preset.thumbnail} alt={`Trang kết nối ${preset.category.toLocaleLowerCase('vi-VN')} của ${preset.name}`} width={780} height={585} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none" />
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm"><Eye className="h-3 w-3" /> Xem trước</span>
        </button>
        <div className="flex flex-1 flex-col p-3">
          <div className="flex items-baseline justify-between gap-2"><h3 className="font-semibold text-slate-900">{preset.name}</h3><span className="text-[11px] text-slate-500">{preset.category}</span></div>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{preset.description}</p>
          <button type="button" disabled={!canOperate || !!creating || !token} onClick={() => choose(preset)} className="mt-4 inline-flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-wait disabled:opacity-50">
            {creating === preset.id ? <><span>Đang tạo...</span><Loader2 className="h-4 w-4 animate-spin" /></> : <><span>Dùng {preset.name}</span><ArrowUpRight className="h-4 w-4" /></>}
          </button>
        </div>
      </article>)}
    </div>
    {preview && <PresetPreview preset={preview} onClose={() => setPreview(null)} onChoose={() => choose(preview)} creating={!!creating} canChoose={canOperate} />}
  </section>;
}
