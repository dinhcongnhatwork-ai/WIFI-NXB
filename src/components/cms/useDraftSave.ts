'use client';
import { authenticatedFetch } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemplateDocumentV2 } from '@/lib/template-document';
export type SaveState = 'saved'|'dirty'|'saving'|'error'|'conflict';
export function useDraftSave(id:string, document:TemplateDocumentV2, initialVersion:number, token:string, enabled=true) {
  const [state,setState]=useState<SaveState>('saved'); const [error,setError]=useState('');
  const version=useRef(initialVersion); const latest=useRef(document); latest.current=document;
  const saved=useRef(JSON.stringify(document)); const pending=useRef<Promise<void>|null>(null); const blocked=useRef(false);
  const key=`cms-draft:${id}`;
  const save=useCallback(async function persist(): Promise<void> {
    if(!enabled) return;
    if(blocked.current) throw new Error('Bản nháp đã được sửa ở tab khác. Tải lại hoặc xuất bản sao phục hồi.');
    while(pending.current) await pending.current;
    if(blocked.current) throw new Error('Bản nháp đã được sửa ở tab khác. Tải lại hoặc xuất bản sao phục hồi.');
    const snapshot=JSON.stringify(latest.current); if(snapshot===saved.current) return;
    setState('saving'); setError('');
    const operation=(async()=>{
      try {
        const res=await authenticatedFetch(`/api/templates/${id}`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({layoutJson:JSON.parse(snapshot),expectedVersion:version.current})});
        const data=await res.json().catch(()=>({error:'Máy chủ không trả dữ liệu hợp lệ. Vui lòng thử lưu lại.'}));
        if(!res.ok) { if(res.status===409) blocked.current=true; throw new Error(res.status===401?'Phiên đăng nhập đã hết hạn. Hãy tải bản nháp dự phòng trước khi đăng nhập lại.':data.error||'Không lưu được bản nháp'); }
        if(!Number.isInteger(data.data?.draftVersion))throw new Error('Máy chủ chưa xác nhận phiên bản lưu. Vui lòng thử lại.');
        version.current=data.data.draftVersion; saved.current=snapshot;
        if(JSON.stringify(latest.current)===snapshot) { setState('saved'); try{localStorage.removeItem(key);}catch{} } else setState('dirty');
      } catch(e) { setState(blocked.current?'conflict':'error');setError(e instanceof Error?e.message:'Lưu thất bại');throw e; }
    })();
    pending.current=operation;try {await operation;}finally{if(pending.current===operation) pending.current=null;}
    if(JSON.stringify(latest.current)!==saved.current) await persist();
  },[id,token,key,enabled]);
  const flush=useCallback(async()=>{ await save(); if(JSON.stringify(latest.current)!==saved.current) await save(); },[save]);
  useEffect(()=>{
    if(!enabled || JSON.stringify(document)===saved.current) return;
    if(!blocked.current) setState('dirty');
    try{localStorage.setItem(key,JSON.stringify({version:version.current,document,updatedAt:Date.now()}));}catch{setError('Trình duyệt không còn dung lượng phục hồi. Hãy lưu bản nháp.');}
    const timer=setTimeout(()=>{void save().catch(()=>{});},1500);return()=>clearTimeout(timer);
  },[document,key,save,enabled]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(JSON.stringify(latest.current)!==saved.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
  return {state,error,flush,version,markVersion:(n:number)=>{version.current=n;}};
}
