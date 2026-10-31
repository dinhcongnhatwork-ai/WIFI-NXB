'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import {
  toDocument,
  isTemplateDocumentV2,
  createDocument,
  type TemplateDocumentV2,
} from '@/lib/template-document';

const CmsBuilder = dynamic(() => import('@/components/cms/CmsBuilder'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 text-slate-900">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-600 text-sm font-medium">Đang tải trình thiết kế CMS WiFi Marketing...</p>
      </div>
    </div>
  ),
});

interface TemplateData {
  id: string;
  name: string;
  layoutJson: unknown;
  status: string;
  draftVersion?: number;
  campaigns?: Array<{
    id: string;
    name: string;
    ssid: string;
    active: boolean;
  }>;
}

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { token, canOperate } = useAuth();
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    api
      .get<{ data: TemplateData }>(`/api/templates/${id}`, token)
      .then((res) => setTemplate(res.data))
      .catch(() => {
        toast.error('Không tìm thấy mẫu giao diện');
        router.push('/admin/templates');
      })
      .finally(() => setLoading(false));
  }, [token, id, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex items-center justify-center text-slate-900">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Đang tải dữ liệu mẫu...</p>
        </div>
      </div>
    );
  }

  if (!template || !token) return null;

  // Convert template layout to TemplateDocumentV2
  let documentV2: TemplateDocumentV2;
  try {
    documentV2 = toDocument(template.layoutJson);
  } catch (err) {
    return <div className="p-8"><p role="alert" className="text-rose-700">{err instanceof Error ? err.message : 'Không thể mở mẫu. Dữ liệu gốc được giữ nguyên.'}</p><button className="mt-4 text-blue-600" onClick={() => router.push('/admin/templates')}>Trở lại danh sách mẫu</button></div>;
  }

  if (!canOperate) return <div className="space-y-4">
    <div className="admin-panel-heading"><h1>{template.name}</h1><Link href={`/admin/templates/${id}/preview`}>Xem trước đầy đủ</Link></div>
    <DocumentRenderer document={documentV2} mode="edit" />
  </div>;

  return (
    <CmsBuilder
      templateId={template.id}
      templateName={template.name}
      status={template.status}
      initialDocument={documentV2}
      initialVersion={template.draftVersion || 1}
      campaigns={template.campaigns || []}
      token={token}
    />
  );
}
