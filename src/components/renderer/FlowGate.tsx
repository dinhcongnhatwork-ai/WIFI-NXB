'use client';
import React, { useEffect, useState } from 'react';
import type { AnnouncementElement, AttendanceGateElement, PortalParams, VideoGateElement } from '@/types';
import type { FormFieldDefinition } from '@/types/attendance';
import type { GateScreenId, RenderMode } from '@/lib/template-document';
import { getDialogMaxWidth, getDialogThemeStyles } from './PortalRenderer';
import { gateAction, MOCK_ATTENDANCE_SESSION, type AttendanceContext, type SimulationOutcome } from './flow-runtime';

type GateElement = VideoGateElement | AttendanceGateElement | AnnouncementElement;
export default function FlowGate({element,screen,mode,params,portalSessionId,attendanceContext,isDesktop,outcome,onDone,onResult}: {
  element:GateElement;screen:GateScreenId;mode:RenderMode;params:Partial<PortalParams>;portalSessionId?:string;
  attendanceContext?:AttendanceContext;isDesktop:boolean;outcome:SimulationOutcome;onDone:()=>void;onResult:(message:string)=>void;
}) {
  const wait = element.type === 'attendance_gate' ? 0 : Math.max(0,element.skipAfter ?? 5);
  const [seconds,setSeconds] = useState(wait);
  const [answers,setAnswers] = useState<Record<string,unknown>>({});
  const [error,setError] = useState(''); const [pending,setPending] = useState(false);
  const [muted,setMuted] = useState(element.type === 'video_gate' ? element.muted ?? true : true);
  const session = attendanceContext?.session || (mode !== 'live' ? MOCK_ATTENDANCE_SESSION : undefined);
  const theme = getDialogThemeStyles(element.dialogTheme);
  const fields:FormFieldDefinition[] = session?.formSchema?.length ? session.formSchema : MOCK_ATTENDANCE_SESSION.formSchema;
  useEffect(() => {
    setAnswers(Object.fromEntries(fields.filter(field=>field.defaultValue!==undefined).map(field=>[field.id,field.defaultValue])));
  }, [session?.id]);
  useEffect(() => {
    if (mode === 'edit' || seconds <= 0) return;
    const timer = setTimeout(()=>setSeconds(n=>n-1),1000);return()=>clearTimeout(timer);
  },[mode,seconds]);
  async function complete(event?:React.FormEvent) {
    event?.preventDefault(); if (mode === 'edit' || seconds > 0 || pending) return;
    setError('');
    if (screen === 'attendance_gate') {
      const missing = fields.find(f => f.required && (answers[f.id] === undefined || answers[f.id] === false || String(answers[f.id]).trim() === '' || (Array.isArray(answers[f.id]) && (answers[f.id] as unknown[]).length === 0)));
      if (missing) {setError(`Vui lòng điền ${missing.label}`);return;}
    }
    if (mode === 'simulate' && outcome !== 'success') {
      const message = outcome === 'error' ? 'Không thể hoàn tất. Hãy thử lại (mô phỏng).' : 'Đang chờ xử lý (mô phỏng)…';
      setError(message);onResult(message);return;
    }
    setPending(true);
    try {await gateAction({screen,mode,params,portalSessionId,session,answers});onDone();}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Lỗi kết nối máy chủ. Vui lòng thử lại.');}
    finally {setPending(false);}
  }
  function input(field:FormFieldDefinition) {
    const value = answers[field.id] ?? field.defaultValue ?? '';
    const update = (value:unknown) => setAnswers(previous=>({...previous,[field.id]:value}));
    const common = {id:`gate-${field.id}`,name:field.id,required:field.required,disabled:mode==='edit',style:{width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,color:'#0f172a',background:'#fff'},'aria-label':field.label};
    if (field.type === 'select') return <select {...common} value={String(value)} onChange={e=>update(e.target.value)}><option value="">Chọn…</option>{field.options?.map(option=><option key={option}>{option}</option>)}</select>;
    if (field.type === 'textarea') return <textarea {...common} placeholder={field.placeholder} maxLength={field.maxLength} value={String(value)} onChange={e=>update(e.target.value)} />;
    if (field.type === 'checkbox' && !field.options?.length) return <input {...common} type="checkbox" style={{width:20,height:20}} checked={!!value} onChange={e=>update(e.target.checked)} />;
    if (field.type === 'radio' || field.type === 'checkbox') return <div>{field.options?.map(option=><label key={option} style={{display:'block',padding:4}}><input type={field.type} name={field.id} disabled={mode==='edit'} checked={field.type==='radio' ? value===option : Array.isArray(value) && value.includes(option)} onChange={e=>update(field.type==='radio' ? option : e.target.checked ? [...(Array.isArray(value)?value:[]),option] : (Array.isArray(value)?value:[]).filter(item=>item!==option))} /> {option}</label>)}</div>;
    return <input {...common} type={field.type === 'phone' ? 'tel' : field.type} placeholder={field.placeholder} maxLength={field.maxLength} value={String(value)} onChange={e=>update(e.target.value)} />;
  }
  const buttonStyle:React.CSSProperties = {padding:'12px 18px',width:'100%',background:element.type === 'video_gate' ? '#2563eb' : element.buttonBgColor || '#2563eb',color:element.type === 'video_gate' ? '#fff' : element.buttonTextColor || '#fff',border:0,borderRadius:10,cursor:'pointer',opacity:seconds>0||pending ? .5 : 1};
  return <div data-flow-content={screen} style={{width:'100%',height:'100%',overflow:'auto',display:'flex',justifyContent:'center',alignItems:'start'}}>
    <div style={{width:'100%',maxWidth:getDialogMaxWidth(element.dialogSize,element.dialogMaxWidthDesktop,element.dialogMaxWidth,isDesktop),background:element.type==='announcement'?element.bgColor:theme.cardBg,border:theme.cardBorder,borderRadius:element.borderRadius||'20px',padding:20,boxSizing:'border-box',color:theme.messageColor}}>
      <h2 style={{margin:'0 0 8px',color:element.type==='announcement'?element.titleColor||theme.titleColor:theme.titleColor,fontSize:element.type==='announcement'?element.titleFontSize:'20px',fontWeight:element.type==='announcement'?(element.titleBold?700:600):700,fontStyle:element.type==='announcement'&&element.titleItalic?'italic':undefined}}>{element.type==='announcement'?element.title:element.dialogTitle || session?.dialogTitle}</h2>
      <p style={{margin:'0 0 14px',color:element.type==='announcement'?element.messageColor:undefined,fontSize:element.type==='announcement'?element.messageFontSize:'14px',fontWeight:element.type==='announcement'&&element.messageBold?700:undefined,fontStyle:element.type==='announcement'&&element.messageItalic?'italic':undefined}}>{element.type==='announcement'?element.message:element.dialogMessage || session?.dialogDescription}</p>
      {element.type==='video_gate' && <>
        <div style={{margin:'0 auto 12px',width:element.aspectRatio==='9:16'?'min(100%, 240px, 30.9375vh)':isDesktop?element.frameWidthDesktop||element.frameWidth:element.frameWidth,maxWidth:'100%',aspectRatio:element.aspectRatio==='9:16'?'9/16':element.aspectRatio==='4:3'?'4/3':'16/9',maxHeight:'min(440px, 55vh)',background:'#000',borderRadius:12,overflow:'hidden'}}>
          {element.videoUrl?<video src={element.videoUrl} poster={element.poster||undefined} autoPlay={mode!=='edit'} muted={muted} playsInline controls={false} style={{width:'100%',height:'100%',objectFit:'contain'}} />:<div style={{padding:20,color:'#fff'}}>Chưa có video</div>}
        </div>
        {element.showVolumeControl!==false && <button type="button" disabled={mode==='edit'} onClick={()=>setMuted(value=>!value)} style={{marginBottom:10}}>{muted?'Bật tiếng':'Tắt tiếng'}</button>}
      </>}
      {element.type==='announcement' && <>
        {element.imageUrl && <img src={element.imageUrl} alt={element.title} style={{width:'100%',maxHeight:300,objectFit:'contain',marginBottom:12}} />}
        {element.videoUrl && <video src={element.videoUrl} autoPlay={mode!=='edit'&&element.autoPlayVideo!==false} muted playsInline controls={mode!=='edit'} style={{width:'100%',maxHeight:300,objectFit:'contain'}} />}
      </>}
      {error && <p role="alert" style={{color:'#dc2626'}}>{error}</p>}
      {element.type==='attendance_gate'?<form onSubmit={complete}>
        {fields.map(field=><div key={field.id} style={{marginBottom:12,textAlign:'left'}}><label htmlFor={`gate-${field.id}`} style={{display:'block',marginBottom:5}}>{field.label}{field.required?' *':''}</label>{input(field)}</div>)}
        <button type="submit" disabled={mode==='edit'||pending} style={buttonStyle}>{pending?'Đang xử lý…':element.buttonText||session?.confirmButtonText}</button>
      </form>:<button type="button" disabled={mode==='edit'||seconds>0||pending} style={buttonStyle} onClick={()=>void complete()}>{pending?'Đang xử lý…':seconds>0?`Đợi ${seconds}s để tiếp tục`:element.type==='announcement'?element.buttonText:'Tiếp tục kết nối WiFi'}</button>}
    </div>
  </div>;
}
