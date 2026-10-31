'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {api} from '@/lib/api';
interface Props {campaign:{id:string;name:string;ssid:string};token:string;canAdmin:boolean;onClose:()=>void}
export default function CampaignSessionPolicyDialog({campaign,token,canAdmin,onClose}:Props){
 const [minutes,setMinutes]=useState('240');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [disconnect,setDisconnect]=useState(false);const [error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  let live=true;const previous=document.activeElement as HTMLElement|null;
  api.get<{data:{sessionMinutes:number}}>(`/api/campaigns/${campaign.id}/session-policy`,token).then(result=>{if(live)setMinutes(String(result.data.sessionMinutes));}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Không thể đọc thời hạn phiên.');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;previous?.focus();};
 },[campaign.id,token]);
 useEffect(()=>{if(!loading&&!error)input.current?.focus();},[loading,error]);
 async function save(event:React.FormEvent){
  event.preventDefault();const value=Number(minutes);
  if(!Number.isInteger(value)||value<1||value>1440){setError('Nhập số nguyên từ 1 đến 1440 phút.');return;}
  setSaving(true);setError('');let saved=false;
  try{
   await api.put(`/api/campaigns/${campaign.id}/session-policy`,{sessionMinutes:value},token);saved=true;
   if(disconnect){const result=await api.post<{data:{queued:number}}>(`/api/campaigns/${campaign.id}/session-policy`,{},token);toast.success(`Đã lưu thời hạn và lên lịch ngắt ${result.data.queued} phiên của chiến dịch.`);}
   else toast.success('Đã lưu thời hạn cho các lần đăng nhập tiếp theo.');
   onClose();
  }catch(cause){setError((saved?'Đã lưu thời hạn, nhưng chưa yêu cầu được đăng nhập lại. ':'')+(cause instanceof Error?cause.message:'Không thể lưu cấu hình.'));}
  finally{setSaving(false);}
 }
 return createPortal(<div className="admin-shell fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4" style={{backgroundColor:'rgb(0 0 0 / 0.4)'}} onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="session-policy-title" aria-describedby="session-policy-description" className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onKeyDown={event=>{
   if(event.key==='Escape'&&!saving)onClose();
   if(event.key==='Tab'){const focusable=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])'));const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}>
   <h2 id="session-policy-title" className="text-xl font-semibold text-slate-900">Thời hạn phiên WiFi</h2>
   <p className="mt-1 break-words text-sm text-slate-500">{campaign.name} · {campaign.ssid}</p>
   <p id="session-policy-description" className="mt-4 text-sm leading-6 text-slate-600">Tính từ lúc xác thực thành công. Hết hạn, thiết bị sẽ bị ngắt và phải đăng nhập lại. Ngắt WiFi rồi kết nối lại không làm mới thời hạn phiên.</p>
   {loading?<p role="status" className="py-8 text-center text-slate-500">Đang tải thời hạn phiên…</p>:<form onSubmit={save}>
    <div className="mt-5 flex flex-wrap gap-2">{[{label:'30 phút',value:30},{label:'1 giờ',value:60},{label:'2 giờ',value:120},{label:'4 giờ',value:240}].map(option=><button key={option.value} type="button" disabled={saving} onClick={()=>setMinutes(String(option.value))} className={`rounded-lg border px-3 py-2 text-sm ${Number(minutes)===option.value?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-600'}`}>{option.label}</button>)}</div>
    <label htmlFor="session-policy-minutes" className="mt-5 block text-sm font-medium text-slate-700">Thời hạn phiên (phút)</label>
    <input ref={input} id="session-policy-minutes" type="number" min={1} max={1440} step={1} required disabled={saving} value={minutes} onChange={event=>setMinutes(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"/>
    <p className="mt-2 text-xs text-slate-500">Từ 1 đến 1440 phút. Thời hạn mới áp dụng cho lần đăng nhập tiếp theo. Thiết bị miễn xác thực không bị áp dụng thời hạn này.</p>
    {canAdmin&&<label className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={disconnect} disabled={saving} onChange={event=>setDisconnect(event.target.checked)} className="mt-1"/><span>Ngắt các phiên hiện tại để áp dụng ngay<span className="mt-1 block text-xs leading-5 text-slate-500">Các phiên thông thường trong chiến dịch này sẽ phải đăng nhập lại. Thiết bị miễn xác thực giữ quyền truy cập. SSID có mật khẩu và chiến dịch khác không bị ảnh hưởng.</span></span></label>}
    {error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700">Đóng</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving?'Đang lưu…':'Lưu thời hạn'}</button></div>
   </form>}
   {loading&&error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
  </section>
 </div>,document.body);
}
