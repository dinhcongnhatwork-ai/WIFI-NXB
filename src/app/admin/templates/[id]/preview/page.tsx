'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import PortalRenderer from '@/components/renderer/PortalRenderer';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import DeviceFrame from '@/components/cms/DeviceFrame';
import { DEVICES, DEVICE_KEYS, isTemplateDocumentV2, type DeviceVariant } from '@/lib/template-document';
import { isTemplateConfig, normalizeTemplateConfigMedia } from '@/types';
interface Template { id: string; name: string; layoutJson: unknown }
export default function TemplatePreviewPage() {
  const { id } = useParams<{ id: string }>(); const { token } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<DeviceVariant>('mobile'); const [preset, setPreset] = useState(0); const [zoom, setZoom] = useState(.75);
  useEffect(() => {
    if (!token || !id) return;
    let active = true; setLoading(true); setError('');
    api.get<{ data: Template }>(`/api/templates/${id}`, token).then(res => { if (active) setTemplate(res.data); }).catch(() => { if (active) setError('Không thể tải mẫu. Vui lòng thử lại.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, id]);
  const viewport = DEVICES[device].presets[preset] || DEVICES[device].presets[0];
  const layout = template?.layoutJson;
  return <div>
    <div className="flex flex-wrap items-center gap-4 mb-6"><Link href={`/admin/templates/${id}`}>← Trở lại chỉnh sửa</Link><h1 className="text-xl font-bold">Xem trước: {template?.name}</h1>
      <label>Thiết bị <select value={device} onChange={e => { setDevice(e.target.value as DeviceVariant); setPreset(0); }}>{DEVICE_KEYS.map(key => <option key={key} value={key}>{DEVICES[key].label}</option>)}</select></label>
      <label>Kích thước <select value={preset} onChange={e => setPreset(Number(e.target.value))}>{DEVICES[device].presets.map((size, i) => <option key={i} value={i}>{size.width} × {size.height}</option>)}</select></label>
      <label>Zoom <select value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[.25,.5,.75,1].map(n => <option key={n} value={n}>{n * 100}%</option>)}</select></label>
    </div>
    {loading ? <p>Đang tải mẫu…</p> : error ? <p role="alert">{error}</p> : !isTemplateDocumentV2(layout) && !isTemplateConfig(layout) ? <p role="alert">Định dạng mẫu không được hỗ trợ. Dữ liệu gốc được giữ nguyên.</p> : <div className="overflow-auto bg-slate-100 rounded-xl p-6"><DeviceFrame device={device} viewport={viewport} zoom={zoom} title={`Xem trước ${DEVICES[device].label}`}>
      {isTemplateDocumentV2(layout) ? <DocumentRenderer document={layout} variant={device} viewport={viewport} mode="simulate" /> : isTemplateConfig(layout) ? <PortalRenderer config={normalizeTemplateConfigMedia(layout)} params={{}} isPreview previewMode={device} /> : null}
    </DeviceFrame></div>}
  </div>;
}
