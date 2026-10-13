'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createDefaultTemplateConfig } from '@/types';

export default function NewTemplatePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await api.post<{ data: { id: string } }>(
        '/api/templates',
        {
          name,
          layoutJson: createDefaultTemplateConfig(),
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-2xl"
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

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 p-6"
      >
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tên mẫu
          </label>
          <input
            type="text"
            defaultValue={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ví dụ: Khuyến mãi mùa hè"
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim()}
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
      </motion.form>
    </motion.div>
  );
}
