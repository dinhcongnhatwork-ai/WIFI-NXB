'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const pollingAbort=useRef<AbortController|null>(null);
  const stopPolling=useCallback(()=>{pollingAbort.current?.abort();},[]);
  const [pendingMessage,setPendingMessage]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const params=new URLSearchParams();const abort=new AbortController();pollingAbort.current=abort;setLoading(true);setError('');setData(null);setPendingMessage('');
    const aliases:Record<string,string[]>={
      mac:['mac','MAC','mac-address','macaddress','client-mac'],ip:['ip','IP','ip-address','client-ip'],
      ssid:['ssid','SSID','ssid-name','called-station-id'],apMac:['apMac','apmac','ap-mac','ap_mac','AP_MAC','ap','AP'],unifiSite:['unifiSite','site'],
      'link-login':['link-login','linklogin','link_login','linkLogin'],
      'link-login-only':['link-login-only','linkLoginOnly'],
      'link-orig':['link-orig','linkorig','link_orig','linkOrig'],trial:['trial','link-trial','linktrial'],
      templateId:['templateId','template_id','template','id'],preset:['preset','presetId'],
    };
    for (const [key,keys] of Object.entries(aliases)) {
      if(key==='templateId' && (searchParams.get('unifiSite') || searchParams.get('site')))continue;
      const value=keys.map(alias=>searchParams.get(alias)?.trim()).find(Boolean);if(value)params.set(key,value);
    }
    params.set('device',variantForWidth(window.innerWidth));
    const timeoutMessage='Chưa xác minh được kết nối WiFi. Hãy giữ kết nối với mạng này rồi bấm Thử lại.';
    const expiresAt=Date.now()+60000;let pendingTimer:ReturnType<typeof setTimeout>|undefined;
    const pause=(ms:number)=>new Promise<void>((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
      const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',cancel);resolve();},ms);
      abort.signal.addEventListener('abort',cancel,{once:true});if(abort.signal.aborted)cancel();
    });
    let failures=0,portalDisplayed=false;
    const load=async()=>{
      try {
        while(!abort.signal.aborted){
          let response:Response,result:any;
          const requestAbort=new AbortController(),cancelRequest=()=>requestAbort.abort();
          abort.signal.addEventListener('abort',cancelRequest,{once:true});
          const requestTimer=setTimeout(cancelRequest,8000);
          try {
            response=await fetch(`/api/portal?${params}`,{signal:requestAbort.signal,cache:'no-store'});
            if(response.status>=500||response.status===429)throw Error('Portal temporarily unavailable');
            result=await response.json();if(abort.signal.aborted)return;
            failures=0;
          }catch{
            if(abort.signal.aborted)return;
            if(++failures<3&&Date.now()<expiresAt){
              if(!portalDisplayed)setPendingMessage('Đang kết nối tới trang WiFi. Hệ thống đang thử lại…');
              await pause(1000);continue;
            }
            if(!portalDisplayed)setError('Chưa tải được trang WiFi. Hãy giữ kết nối WiFi và bấm Thử lại.');
            return;
          }finally{clearTimeout(requestTimer);abort.signal.removeEventListener('abort',cancelRequest);}
          if(response.status===409 && result.code==='UNIFI_CLIENT_PENDING' && params.get('unifiSite')){
            if(Date.now()>=expiresAt){setError(timeoutMessage);return;}
            setPendingMessage(result.error||'Đang chờ điểm phát WiFi cập nhật kết nối của bạn.');
            if(!pendingTimer)pendingTimer=setTimeout(()=>{setError(timeoutMessage);setLoading(false);abort.abort();},expiresAt-Date.now());
            const seconds=Number(response.headers.get('Retry-After'))||2;
            await new Promise<void>((resolve,reject)=>{
              const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
              const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',cancel);resolve();},Math.min(5,Math.max(1,seconds))*1000);
              abort.signal.addEventListener('abort',cancel,{once:true});
              if(abort.signal.aborted)cancel();
            });
            continue;
          }
          if(response.ok && result.success && result.data?.bypass===true){
            const target=new URL(result.data.redirectUrl,window.location.origin);
            if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('Invalid destination');
            window.location.replace(target.href);return;
          }
          if(response.ok && result.success && result.data?.connectionPending===true){
            portalDisplayed=true;clearTimeout(pendingTimer);pendingTimer=undefined;setData(result.data);setLoading(false);
            if(Date.now()<expiresAt){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',cancel);resolve();},2000);const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};abort.signal.addEventListener('abort',cancel,{once:true});if(abort.signal.aborted)cancel();});continue;}
            return;
          }
          if(response.ok && result.success)setData(result.data);else setError(result.error||'Không thể tải trang kết nối.');
          return;
        }
      }catch(cause){if(!abort.signal.aborted)setError('Lỗi kết nối máy chủ. Vui lòng thử lại.');}
      finally{clearTimeout(pendingTimer);if(!abort.signal.aborted)setLoading(false);}
    };
    void load();
    return()=>{clearTimeout(pendingTimer);abort.abort();if(pollingAbort.current===abort)pollingAbort.current=null;};
  },[searchParams,retry]);
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
  if(loading)return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white p-6"><div aria-hidden="true" className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><p role="status" className="max-w-sm text-center text-slate-600">{pendingMessage||'Đang tải trang kết nối WiFi…'}</p></div>;
  if(error)return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center"><h1 className="text-xl font-semibold text-slate-900">Chưa thể kết nối WiFi</h1><p role="alert" className="mt-3 text-slate-600">{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)} className="mt-6 min-h-12 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white">Thử lại</button></div></div>;
  if(!data)return null;
  if(!document)return <div className="min-h-screen flex items-center justify-center p-4"><p role="alert">Định dạng mẫu không được hỗ trợ. Vui lòng liên hệ quản trị viên.</p></div>;
  return <DocumentRenderer onConnectionStart={stopPolling} document={document} variant={data.params.device || 'mobile'} params={data.params} campaignId={data.campaignId} redirectUrl={data.redirectUrl} portalSessionId={data.portalSessionId} attendanceContext={data.attendanceSession?{session:data.attendanceSession,isAlreadyRegistered:!!data.isAlreadyRegistered}:undefined} />;
}

