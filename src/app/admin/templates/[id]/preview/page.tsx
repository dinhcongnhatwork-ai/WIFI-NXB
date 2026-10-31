'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { api } from '@/lib/api';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import DeviceFrame from '@/components/cms/DeviceFrame';
import { DEVICES, DEVICE_KEYS, SCREEN_LABELS, isTemplateDocumentV2, toDocument, type DeviceVariant, type PreviewTarget } from '@/lib/template-document';
import { isTemplateConfig } from '@/types';
import { MOCK_ATTENDANCE_SESSION } from '@/components/renderer/flow-runtime';
interface Template { id:string;name:string;layoutJson:unknown }
export default function TemplatePreviewPage() {return <Suspense fallback={<p>Đang tải mẫu…</p>}><TemplatePreviewContent /></Suspense>;}
function TemplatePreviewContent() {
  const {id}=useParams<{id:string}>();const query=useSearchParams();const {token}=useAuth();
  const [template,setTemplate]=useState<Template|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const [device,setDevice]=useState<DeviceVariant>('mobile');const [preset,setPreset]=useState(0);const [zoom,setZoom]=useState(.75);
  const [target,setTarget]=useState<PreviewTarget>('flow');const [rotated,setRotated]=useState(false);const [restart,setRestart]=useState(0);
  useEffect(()=>{
    const screen=query.get('screen');if(screen==='flow'||(screen&&screen in SCREEN_LABELS))setTarget(screen as PreviewTarget);
    const dev=query.get('device');if(dev&&DEVICE_KEYS.includes(dev as DeviceVariant))setDevice(dev as DeviceVariant);
  },[query]);
  useEffect(()=>{
    if(!token||!id)return;let active=true;setLoading(true);setError('');
    api.get<{data:Template}>(`/api/templates/${id}`,token).then(response=>{if(active)setTemplate(response.data);}).catch(()=>{if(active)setError('Không thể tải mẫu. Vui lòng thử lại.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[token,id]);
  const document=useMemo(()=>{
    const layout=template?.layoutJson;if(!isTemplateDocumentV2(layout)&&!isTemplateConfig(layout))return null;
    try{return toDocument(layout);}catch{return null;}
  },[template]);
  const size=DEVICES[device].presets[preset]||DEVICES[device].presets[0];const viewport=rotated?{width:size.height,height:size.width}:size;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
      <Link href={`/admin/templates/${id}`} className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">← Trở lại chỉnh sửa</Link>
      <h1 className="text-base font-bold text-slate-900 mr-auto">Xem trước: {template?.name}</h1>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">Màn hình <select className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800" value={target} onChange={event=>setTarget(event.target.value as PreviewTarget)}><option value="flow">Toàn bộ luồng</option>{Object.entries(SCREEN_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">Thiết bị <select className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800" value={device} onChange={event=>{setDevice(event.target.value as DeviceVariant);setPreset(0);}}>{DEVICE_KEYS.map(key=><option key={key} value={key}>{DEVICES[key].label}</option>)}</select></label>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">Kích thước <select className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800" value={preset} onChange={event=>setPreset(Number(event.target.value))}>{DEVICES[device].presets.map((size,index)=><option key={index} value={index}>{size.width} × {size.height}</option>)}</select></label>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">Zoom <select className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800" value={zoom} onChange={event=>setZoom(Number(event.target.value))}>{[.25,.5,.75,1].map(value=><option key={value} value={value}>{value*100}%</option>)}</select></label>
      <button type="button" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors" onClick={()=>setRotated(value=>!value)}>Xoay thiết bị</button>
      <button type="button" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors" onClick={()=>setRestart(value=>value+1)}>Bắt đầu lại</button>
    </div>
    {loading?<p className="text-sm text-slate-500">Đang tải mẫu…</p>:error?<p role="alert" className="text-sm text-rose-700">{error}</p>:!document?<p role="alert" className="text-sm text-rose-700">Định dạng mẫu không được hỗ trợ. Dữ liệu gốc được giữ nguyên.</p>:<div className="overflow-auto bg-slate-100 border border-slate-200 rounded-xl p-6"><DeviceFrame device={device} viewport={viewport} zoom={zoom} title={`Xem trước ${DEVICES[device].label}`}>
      <DocumentRenderer key={`${restart}-${device}-${preset}-${rotated}-${target}`} document={document} variant={device} viewport={viewport} mode="simulate" previewTarget={target} attendanceContext={{session:MOCK_ATTENDANCE_SESSION,isAlreadyRegistered:false}} editHref={`/admin/templates/${id}/builder?screen=${target==='flow'?'portal':target}`} />
    </DeviceFrame></div>}
  </div>;
}
