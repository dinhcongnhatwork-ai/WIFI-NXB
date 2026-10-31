'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Edit3 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  status: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplateSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { token, canOperate } = useAuth();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    api
      .get<{ data: Template }>(`/api/templates/${id}`, token)
      .then((res) => {
        setTemplate(res.data);
        setName(res.data.name);
        setStatus(res.data.status);
      })
      .catch(() => toast.error('Template not found'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canOperate) return;
    setSaving(true);
    try {
      await api.put(`/api/templates/${id}`, { name, status }, token!);
      toast.success('Đã cập nhật');
    } catch {
      toast.error('Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Không tìm thấy mẫu</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/templates"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Cài đặt mẫu</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý cấu hình mẫu giao diện</p>
        </div>
        <Link
          href={`/admin/templates/${id}/builder`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Edit3 className="w-4 h-4" />
          Mở thiết kế
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <fieldset disabled={!canOperate} className="min-w-0 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tên mẫu
          </label>
          <input
            type="text"
            defaultValue={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="draft">Bản nháp</option>
            <option value="published">Đang xuất bản</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
          <div>
            <p className="font-medium text-slate-600">Ngày tạo</p>
            <p>{new Date(template.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Cập nhật lần cuối</p>
            <p>{new Date(template.updatedAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 transition-colors text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </fieldset>
      </form>
    </div>
  );
}
