'use client';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import './attendance.css';
import { api, authenticatedFetch } from '@/lib/api';
import { isoToLocalDateTime, localDateTimeToIso } from '@/lib/attendance/constants';
import { AttendanceSessionStatus } from '@/types/attendance';
import { ArrowLeft, Calendar, Layers, Radio, RefreshCw, ExternalLink } from 'lucide-react';
interface TemplateOption { id: string; name: string; thumbnail?: string | null; publishedRevisionId?: string | null; attendanceReady?: boolean }
interface CampaignOption { id: string; name: string; templateId: string; ssid: string; wlanConfId?: string | null; unifiSite?: string | null }
interface NetworkOption { _id: string; name: string }
interface DeviceOption { mac: string; name?: string; model?: string }
interface Fields { name: string; location: string; templateId: string; campaignId: string; ssid: string; unifiSite: string; wlanConfId: string; targetApMacs: string[]; startTime: string; endTime: string; warningThresholdMinutes: number; status: AttendanceSessionStatus }
const empty: Fields = { name: '', location: '', templateId: '', campaignId: '', ssid: '', unifiSite: 'default', wlanConfId: '', targetApMacs: [], startTime: '', endTime: '', warningThresholdMinutes: 15, status: 'DRAFT' };
export function AttendanceSessionForm({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const { token, canOperate } = useAuth();
  const formRef=useRef<HTMLFormElement>(null);
  const originalDates=useRef<{startTime:string;endTime:string}|null>(null);
  const [saveError,setSaveError]=useState('');
  const [fields, setFields] = useState<Fields>(empty);
  const [apInput, setApInput] = useState('');
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadVersion,setLoadVersion]=useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [networkUnavailable, setNetworkUnavailable] = useState(false);
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields(previous => ({ ...previous, [key]: value }));
  const refreshNetwork = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    const results = await Promise.allSettled([
      api.get<{ data: NetworkOption[] }>(`/api/unifi/ssids?siteId=${encodeURIComponent(fields.unifiSite)}`, token),
      api.get<{ data: DeviceOption[] }>(`/api/unifi/devices?type=ap&siteId=${encodeURIComponent(fields.unifiSite)}`, token),
    ]);
    setNetworks(results[0].status === 'fulfilled' && Array.isArray(results[0].value.data) ? results[0].value.data : []);
    setDevices(results[1].status === 'fulfilled' && Array.isArray(results[1].value.data) ? results[1].value.data : []);
    setNetworkUnavailable(results.some(result => result.status === 'rejected'));
    setRefreshing(false);
  }, [token,fields.unifiSite]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);setError('');
      const results = await Promise.allSettled([
        api.get<{ data: TemplateOption[] }>('/api/attendance/templates', token),
        api.get<{ data: CampaignOption[] }>('/api/campaigns', token),
        sessionId ? api.get<{ data: Fields }>(`/api/attendance/sessions/${sessionId}`, token) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (results[0].status === 'fulfilled') setTemplates(results[0].value.data || []);
      if (results[1].status === 'fulfilled') setCampaigns(results[1].value.data || []);
      if (results[2].status === 'fulfilled' && results[2].value) {
        const data = results[2].value.data;
        originalDates.current={startTime:data.startTime,endTime:data.endTime};
        setApInput((data.targetApMacs || []).join(', '));
        setFields({ ...empty, ...data, location: data.location || '', templateId: data.templateId || '', campaignId: data.campaignId || '', wlanConfId: data.wlanConfId || '', startTime: isoToLocalDateTime(data.startTime), endTime: isoToLocalDateTime(data.endTime) });
      } else if (sessionId) setError('Không thể tải buổi điểm danh. Vui lòng thử lại.');
      else setFields({ ...empty, startTime: isoToLocalDateTime(new Date(Date.now() + 10 * 60000).toISOString()), endTime: isoToLocalDateTime(new Date(Date.now() + 180 * 60000).toISOString()) });
      if (results.slice(0, 2).some(result => result.status === 'rejected')) toast.error('Không thể tải toàn bộ danh sách mẫu và chiến dịch.');
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [token, sessionId,loadVersion]);
  useEffect(()=>{if(loading)return;const timer=setTimeout(()=>void refreshNetwork(),250);return()=>clearTimeout(timer);},[loading,refreshNetwork]);
  useEffect(()=>{
    let mounted=true;
    const refreshTemplates=()=>{if(token)void api.get<{data:TemplateOption[]}>('/api/attendance/templates',token).then(result=>{if(mounted)setTemplates(result.data);}).catch(()=>{});};
    window.addEventListener('focus',refreshTemplates);return()=>{mounted=false;window.removeEventListener('focus',refreshTemplates);};
  },[token]);
  const selectedCampaign = campaigns.find(item => item.id === fields.campaignId);
  const effectiveTemplateId = fields.templateId || selectedCampaign?.templateId;
  const effectiveTemplate = templates.find(item => item.id === effectiveTemplateId);
  const handleCampaign = (id: string) => {
    const campaign = campaigns.find(item => item.id === id);
    setFields(previous => ({ ...previous, campaignId: id, ...(campaign ? { ssid: campaign.ssid, wlanConfId: campaign.wlanConfId || '', unifiSite: campaign.unifiSite || 'default' } : {}) }));
  };
  const handleSave = async (status: AttendanceSessionStatus) => {
    if (!canOperate || !token || saving) return;
    if(!formRef.current?.reportValidity())return;
    setSaveError('');
    try {
      setSaving(true);
      const body = { name: fields.name, location: fields.location, templateId: fields.templateId || null, campaignId: fields.campaignId || null, ssid: fields.ssid, unifiSite: fields.unifiSite, wlanConfId: fields.wlanConfId || null, targetApMacs: apInput.split(',').map(item => item.trim().toLowerCase()).filter(Boolean), warningThresholdMinutes: fields.warningThresholdMinutes, startTime: fields.status==='ENDED' && originalDates.current?originalDates.current.startTime:localDateTimeToIso(fields.startTime), endTime: fields.status==='ENDED' && originalDates.current?originalDates.current.endTime:localDateTimeToIso(fields.endTime), status };
      // Omit legacy form and dialog fields on edit, preserving stored answers/schema.
      const response = await authenticatedFetch(sessionId ? `/api/attendance/sessions/${sessionId}` : '/api/attendance/sessions', { method: sessionId ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Không thể lưu buổi điểm danh.');
      toast.success('Đã lưu buổi điểm danh.');
      router.push(`/admin/attendance/${result.data.id}`);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Không thể lưu buổi điểm danh.'); }
    finally { setSaving(false); }
  };
  if (loading) return <p className="p-8 text-sm text-slate-500">Đang tải buổi điểm danh...</p>;
  if (error) return <div className="attendance-workspace"><div role="alert" className="attendance-error">{error} <button onClick={()=>setLoadVersion(v=>v+1)}>Thử lại</button></div><Link href="/admin/attendance" className="attendance-button">Về danh sách</Link></div>;
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';
  const sealed=fields.status==='ENDED';
  const cardClass = 'rounded-2xl border border-slate-200 bg-white p-6 space-y-5';
  return <div className="attendance-workspace attendance-form max-w-5xl space-y-6 pb-20">
    <Link href="/admin/attendance" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Buổi điểm danh</Link>
    <div><h1 className="text-2xl font-bold text-slate-900">{sessionId ? 'Chỉnh sửa buổi điểm danh' : 'Tạo buổi điểm danh'}</h1><p className="mt-2 text-sm text-slate-500">Chọn mẫu, mạng WiFi và khung giờ cho buổi họp.</p></div>
    {sealed && <p className="attendance-source">Buổi họp đã chốt: có thể sửa tên và địa điểm. Mạng WiFi, lịch và cấu hình điểm danh được giữ để bảo toàn báo cáo.</p>}
    <form ref={formRef} onSubmit={event => { event.preventDefault(); void handleSave(fields.status); }} className="space-y-6">
      {saveError && <div role="alert" className="attendance-error">{saveError}</div>}
      <section className={cardClass}>
        <h2 className="flex items-center gap-2 font-semibold"><Layers size={18} /> Mẫu hiển thị</h2>
        <label className="block text-sm">Mẫu trực tiếp<select disabled={!canOperate || sealed} aria-label="Mẫu trực tiếp" className={`${inputClass} mt-2`} value={fields.templateId} onChange={event => set('templateId', event.target.value)}><option value="">Kế thừa từ chiến dịch</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name} — {template.attendanceReady ? 'Điểm danh sẵn sàng' : template.publishedRevisionId ? 'Chưa bật điểm danh' : 'Bản nháp'}</option>)}</select></label>
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Chọn mẫu qua ảnh ({templates.length})</summary>
          <div role="radiogroup" aria-label="Mẫu qua ảnh" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button type="button" role="radio" disabled={!canOperate || sealed} aria-checked={!fields.templateId} onClick={() => set('templateId', '')} className={`rounded-xl border p-2 text-left ${!fields.templateId ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
              <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-50 text-slate-400"><Layers size={28} /></div>
              <span className="mt-2 block text-xs font-medium">Kế thừa chiến dịch</span>
            </button>
            {templates.map(template => <button key={template.id} type="button" role="radio" disabled={!canOperate || sealed} aria-label={`Chọn mẫu ${template.name}`} aria-checked={fields.templateId === template.id} onClick={() => set('templateId', template.id)} className={`rounded-xl border p-2 text-left ${fields.templateId === template.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-400'}`}>
              <div className="aspect-video overflow-hidden rounded-lg bg-slate-50">{template.thumbnail ? <img src={template.thumbnail} alt={`Ảnh mẫu ${template.name}`} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Chưa có ảnh</div>}</div>
              <span className="mt-2 block truncate text-xs font-medium">{template.name}</span>
              <span className="block text-[11px] text-slate-500">{template.publishedRevisionId ? 'Đã xuất bản' : 'Bản nháp'}</span>
            </button>)}
          </div>
        </details>
        <label className="block text-sm">Chiến dịch (không bắt buộc)<select disabled={!canOperate || sealed} aria-label="Chiến dịch" className={`${inputClass} mt-2`} value={fields.campaignId} onChange={event => handleCampaign(event.target.value)}><option value="">Không chọn chiến dịch</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <p className="text-sm text-slate-500">Mẫu trực tiếp được ưu tiên. Có thể lưu mẫu nháp; để kích hoạt, hãy xuất bản mẫu có bật Điểm danh họp.</p>
        {effectiveTemplateId && <div className="flex flex-wrap items-center gap-4 text-sm">{effectiveTemplate?.thumbnail && <img src={effectiveTemplate.thumbnail} alt={`Mẫu đã chọn: ${effectiveTemplate.name}`} className="h-14 w-24 rounded-lg border border-slate-200 object-cover" />}<span className="font-medium">{effectiveTemplate?.name || 'Mẫu đang chọn'}</span><span className="attendance-badge" data-status={effectiveTemplate?.attendanceReady?'READY':'DRAFT'}>{effectiveTemplate?.attendanceReady?'Điểm danh sẵn sàng trên 3 thiết bị':'Cần xuất bản mẫu có bật điểm danh'}</span><Link target="_blank" rel="noopener noreferrer" href={`/admin/templates/${effectiveTemplateId}/preview?screen=attendance_gate`} className="inline-flex items-center gap-1 text-blue-600"><ExternalLink size={14} /> Xem trước</Link><Link target="_blank" rel="noopener noreferrer" href={`/admin/templates/${effectiveTemplateId}/builder?screen=attendance_gate`} className="text-blue-600">Chỉnh sửa mẫu</Link></div>}
      </section>
      <section className={cardClass}>
        <h2 className="flex items-center gap-2 font-semibold"><Calendar size={18} /> Thông tin buổi họp</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Tên buổi họp<input disabled={!canOperate} aria-label="Tên buổi họp" required className={`${inputClass} mt-2`} value={fields.name} onChange={event => set('name', event.target.value)} /></label>
          <label className="block text-sm">Địa điểm<input disabled={!canOperate} className={`${inputClass} mt-2`} value={fields.location} onChange={event => set('location', event.target.value)} /></label>
          <label className="block text-sm">Thời gian bắt đầu<input disabled={!canOperate || sealed} aria-label="Thời gian bắt đầu" type="datetime-local" required className={`${inputClass} mt-2`} value={fields.startTime} onChange={event => set('startTime', event.target.value)} /></label>
          <label className="block text-sm">Thời gian kết thúc<input disabled={!canOperate || sealed} aria-label="Thời gian kết thúc" type="datetime-local" required className={`${inputClass} mt-2`} value={fields.endTime} onChange={event => set('endTime', event.target.value)} /></label>
          <label className="block text-sm">Ngưỡng cảnh báo (phút)<input disabled={!canOperate || sealed} type="number" min={1} max={120} required className={`${inputClass} mt-2`} value={fields.warningThresholdMinutes} onChange={event => set('warningThresholdMinutes', Number(event.target.value))} /></label>
        </div>
        <p className="text-xs text-slate-500">Thời gian theo múi giờ trên thiết bị của bạn. Biểu mẫu điểm danh hiện có được giữ nguyên khi chỉnh sửa.</p>
      </section>
      <section className={cardClass}>
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Radio size={18} /> Mạng WiFi và Access Point</h2><button type="button" onClick={() => void refreshNetwork()} disabled={refreshing} className="inline-flex items-center gap-2 text-sm text-blue-600"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Làm mới UniFi</button></div>
        {networkUnavailable && <p className="text-sm text-amber-700">Không kết nối được UniFi. Bạn vẫn có thể nhập SSID và MAC AP bên dưới.</p>}
        {networks.length > 0 && <label className="block text-sm">SSID từ UniFi<select disabled={!canOperate || sealed} aria-label="SSID từ UniFi" value={fields.wlanConfId} onChange={event => { const network = networks.find(item => item._id === event.target.value); if (network) setFields(previous => ({ ...previous, wlanConfId: network._id, ssid: network.name })); else set('wlanConfId', ''); }} className={`${inputClass} mt-2`}><option value="">Nhập SSID thủ công</option>{networks.map(network => <option key={network._id} value={network._id}>{network.name}</option>)}</select></label>}
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">SSID<input disabled={!canOperate || sealed} aria-label="SSID" required className={`${inputClass} mt-2`} value={fields.ssid} onChange={event => setFields(previous=>({...previous,ssid:event.target.value,wlanConfId:''}))} /></label><label className="block text-sm">UniFi site<input aria-label="UniFi site" disabled={!canOperate || sealed} className={`${inputClass} mt-2`} required value={fields.unifiSite} onChange={event => {setFields(previous=>({...previous,unifiSite:event.target.value,wlanConfId:'',targetApMacs:[]}));setApInput('');}} /></label></div>
        {devices.length > 0 && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Chọn AP</legend>{devices.map(device => { const mac = device.mac.toLowerCase(); return <label key={mac} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm"><input disabled={!canOperate || sealed} type="checkbox" checked={fields.targetApMacs.includes(mac)} onChange={event => { const targets = event.target.checked ? Array.from(new Set([...fields.targetApMacs, mac])) : fields.targetApMacs.filter(item => item !== mac); set('targetApMacs', targets); setApInput(targets.join(', ')); }} /><span>{device.name || device.model || 'AP'} <span className="text-xs text-slate-500">{mac}</span></span></label>; })}</fieldset>}
        <label className="block text-sm">MAC AP (phân cách bằng dấu phẩy)<input disabled={!canOperate || sealed} aria-label="MAC AP" className={`${inputClass} mt-2`} value={apInput} onChange={event => { setApInput(event.target.value); set('targetApMacs', event.target.value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean)); }} /></label>
        <p className="text-xs text-slate-500">Để trống AP để áp dụng toàn bộ SSID. Nếu router không gửi AP, buổi họp chỉ được chọn khi có duy nhất một buổi phù hợp với mạng và thời gian. Khi có thông tin AP, chỉ các AP đã chọn được áp dụng.</p>
      </section>
      <div className="flex flex-wrap justify-end gap-3"><Link href="/admin/attendance" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">Hủy</Link>{fields.status !== 'ACTIVE' && fields.status !== 'ENDED' && <><button disabled={!canOperate || saving} type="button" onClick={() => void handleSave('DRAFT')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">Lưu nháp</button><button disabled={!canOperate || saving} type="button" onClick={() => void handleSave('READY')} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm text-blue-700">Lưu sẵn sàng</button><button disabled={!canOperate || saving} type="button" onClick={() => void handleSave('ACTIVE')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Lưu và kích hoạt</button></>}{(sessionId || fields.status === 'ACTIVE' || fields.status === 'ENDED') && <button disabled={!canOperate || saving} type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>}</div>
    </form>
  </div>;
}
