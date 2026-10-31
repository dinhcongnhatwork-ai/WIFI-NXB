'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createDocument } from '@/lib/template-document';
import PresetGallery from '@/components/templates/PresetGallery';

export default function NewTemplatePage() {
  const router = useRouter();
  const { token, canOperate } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canOperate || !name.trim()) return;

    setLoading(true);
    try {
      const res = await api.post<{ data: { id: string } }>(
        '/api/templates',
        {
          name,
          layoutJson: createDocument(),
          status: 'draft',
        },
        token!
      );
      toast.success('Đã tạo mẫu');
      router.push(`/admin/templates/${res.data.id}/builder`);
    } catch (err) {
      toast.error('Tạo mẫu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="max-w-7xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/templates"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tạo mẫu mới</h1>
          <p className="text-slate-500 text-sm mt-1">Tạo mẫu trang chào WiFi mới</p>
        </div>
      </div>

      <PresetGallery templateName={name} />

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl bg-white rounded-xl border border-slate-200 p-6"
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Bắt đầu từ trang trống</h2>
        <p className="mb-5 text-sm text-slate-500">Đặt tên và tự xây dựng bố cục của bạn.</p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tên mẫu
          </label>
          <input
            disabled={!canOperate}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ví dụ: Khuyến mãi mùa hè"
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canOperate || loading || !name.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Đang tạo...' : 'Tạo & Mở thiết kế'}
          </button>
          <Link
            href="/admin/templates"
            className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
          >
            Hủy bỏ
          </Link>
        </div>
      </form>
    </div>
  );
}
