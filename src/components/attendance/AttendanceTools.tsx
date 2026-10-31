'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import toast from 'react-hot-toast';
import './attendance.css';
export function AttendanceExportButton({id}:{id:string}) {
  const [busy,setBusy]=useState(false);
  async function download(){
    setBusy(true);
    try{
      const response=await authenticatedFetch(`/api/attendance/sessions/${id}/export`);
      if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error || 'Không tải được báo cáo.');}
      const url=URL.createObjectURL(await response.blob());
      const a=document.createElement('a');a.href=url;a.download=`diem-danh-${id}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){toast.error(error instanceof Error?error.message:'Không tải được báo cáo.');}finally{setBusy(false);}
  }
  return <button type="button" disabled={busy} aria-label="Xuất báo cáo Excel" title="Xuất báo cáo Excel" onClick={()=>void download()}><FileSpreadsheet />{busy?'Đang tải…':'Excel'}</button>;
}
export function AttendanceDialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const panel=ref.current;panel?.focus();
    function keyboard(event:KeyboardEvent){
      if(event.key==='Escape' && !busy)onClose();
      if(event.key==='Tab'){
        const elements=panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]');
        if(!elements?.length){event.preventDefault();return;}
        const first=elements[0],last=elements[elements.length-1];
        if(event.shiftKey && (document.activeElement===first || document.activeElement===panel)){event.preventDefault();last.focus();}
        else if(!event.shiftKey && (document.activeElement===last || document.activeElement===panel)){event.preventDefault();first.focus();}
      }
    }
    document.addEventListener('keydown',keyboard);
    return()=>{document.removeEventListener('keydown',keyboard);previous?.focus();};
  },[onClose,busy]);
  return <div className="attendance-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !busy)onClose();}}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="attendance-dialog"><h2>{title}</h2>{children}</div></div>;
}
