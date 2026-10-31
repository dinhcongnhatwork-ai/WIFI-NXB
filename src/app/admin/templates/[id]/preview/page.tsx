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
  return <div>
    <div className="flex flex-wrap items-center gap-4 mb-6"><Link href={`/admin/templates/${id}`}>← Trở lại chỉnh sửa</Link><h1 className="text-xl font-bold">Xem trước: {template?.name}</h1>
      <label>Màn hình <select value={target} onChange={event=>setTarget(event.target.value as PreviewTarget)}><option value="flow">Toàn bộ luồng</option>{Object.entries(SCREEN_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Thiết bị <select value={device} onChange={event=>{setDevice(event.target.value as DeviceVariant);setPreset(0);}}>{DEVICE_KEYS.map(key=><option key={key} value={key}>{DEVICES[key].label}</option>)}</select></label>
      <label>Kích thước <select value={preset} onChange={event=>setPreset(Number(event.target.value))}>{DEVICES[device].presets.map((size,index)=><option key={index} value={index}>{size.width} × {size.height}</option>)}</select></label>
      <label>Zoom <select value={zoom} onChange={event=>setZoom(Number(event.target.value))}>{[.25,.5,.75,1].map(value=><option key={value} value={value}>{value*100}%</option>)}</select></label>
      <button type="button" onClick={()=>setRotated(value=>!value)}>Xoay thiết bị</button><button type="button" onClick={()=>setRestart(value=>value+1)}>Bắt đầu lại</button>
    </div>
    {loading?<p>Đang tải mẫu…</p>:error?<p role="alert">{error}</p>:!document?<p role="alert">Định dạng mẫu không được hỗ trợ. Dữ liệu gốc được giữ nguyên.</p>:<div className="overflow-auto bg-slate-100 rounded-xl p-6"><DeviceFrame device={device} viewport={viewport} zoom={zoom} title={`Xem trước ${DEVICES[device].label}`}>
      <DocumentRenderer key={`${restart}-${device}-${preset}-${rotated}-${target}`} document={document} variant={device} viewport={viewport} mode="simulate" previewTarget={target} attendanceContext={{session:MOCK_ATTENDANCE_SESSION,isAlreadyRegistered:false}} editHref={`/admin/templates/${id}/builder?screen=${target==='flow'?'portal':target}`} />
    </DeviceFrame></div>}
  </div>;
}
