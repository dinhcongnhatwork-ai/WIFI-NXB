'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  toDocument,
  isTemplateDocumentV2,
  createDocument,
  type TemplateDocumentV2,
} from '@/lib/template-document';

const CmsBuilder = dynamic(() => import('@/components/cms/CmsBuilder'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">Đang tải trình thiết kế CMS WiFi Marketing...</p>
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
  const { token } = useAuth();
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
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Đang tải dữ liệu mẫu...</p>
        </div>
      </div>
    );
  }

  if (!template || !token) return null;

  // Convert template layout to TemplateDocumentV2
  let documentV2: TemplateDocumentV2;
  try {
    if (isTemplateDocumentV2(template.layoutJson)) {
      documentV2 = template.layoutJson;
    } else {
      documentV2 = toDocument(template.layoutJson);
    }
  } catch (err) {
    console.warn('Lỗi parse template cũ, sử dụng template mặc định:', err);
    documentV2 = createDocument();
  }

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
