'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import { isTemplateDocumentV2, toDocument, variantForWidth } from '@/lib/template-document';
import { createPresetDocument } from '@/lib/template-presets';
import type { PortalParams } from '@/types';
import { isTemplateConfig } from '@/types';
import type { AttendanceSessionDto } from '@/types/attendance';

interface PortalData {
  layout:unknown;params:Partial<PortalParams>;templateId?:string;campaignId?:string;redirectUrl?:string;
  attendanceSession?:AttendanceSessionDto|null;isAlreadyRegistered?:boolean;portalSessionId?:string;
}
const loadingView = <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
export default function PortalPage() {return <Suspense fallback={loadingView}><PortalContent /></Suspense>;}
function PortalContent() {
  const searchParams=useSearchParams();const [data,setData]=useState<PortalData|null>(null);
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{
    const params=new URLSearchParams();const abort=new AbortController();setLoading(true);setError('');setData(null);
    const aliases:Record<string,string[]>={
      mac:['mac','MAC','mac-address','macaddress','client-mac'],ip:['ip','IP','ip-address','client-ip'],
      ssid:['ssid','SSID','ssid-name','called-station-id'],apMac:['apMac','apmac','ap-mac','ap_mac','AP_MAC','ap','AP'],unifiSite:['unifiSite','site'],
      'link-login':['link-login','linklogin','link_login','linkLogin'],
      'link-login-only':['link-login-only','linkLoginOnly'],
      'link-orig':['link-orig','linkorig','link_orig','linkOrig'],trial:['trial','link-trial','linktrial'],
      templateId:['templateId','template_id','template','id'],preset:['preset','presetId'],
    };
    for (const [key,keys] of Object.entries(aliases)) {
      const value=keys.map(alias=>searchParams.get(alias)?.trim()).find(Boolean);if(value)params.set(key,value);
    }
    params.set('device',variantForWidth(window.innerWidth));
    fetch(`/api/portal?${params}`,{signal:abort.signal}).then(response=>response.json()).then(response=>{
      if(response.success)setData(response.data);else setError(response.error||'Không thể tải trang kết nối.');
    }).catch(cause=>{if(cause.name!=='AbortError')setError('Lỗi kết nối máy chủ.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[searchParams]);
  const document=useMemo(()=>{
    if(!data)return null;
    try {
      if (isTemplateDocumentV2(data.layout) || isTemplateConfig(data.layout)) {
        return toDocument(data.layout);
      }
      return toDocument(data.layout);
    } catch {
      try { return createPresetDocument('van-hoa-doc'); } catch { return null; }
    }
  },[data]);
  if(loading)return loadingView;
  if(error)return <div className="min-h-screen flex items-center justify-center p-4"><p role="alert">{error}</p></div>;
  if(!data)return null;
  if(!document)return <div className="min-h-screen flex items-center justify-center p-4"><p role="alert">Định dạng mẫu không được hỗ trợ. Vui lòng liên hệ quản trị viên.</p></div>;
  return <DocumentRenderer document={document} variant={data.params.device || 'mobile'} params={data.params} campaignId={data.campaignId} redirectUrl={data.redirectUrl} portalSessionId={data.portalSessionId} attendanceContext={data.attendanceSession?{session:data.attendanceSession,isAlreadyRegistered:!!data.isAlreadyRegistered}:undefined} />;
}

