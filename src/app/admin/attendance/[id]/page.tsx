'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Pencil, ExternalLink, Play, Square, Wifi, Radio, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import { AttendanceDialog, AttendanceExportButton } from '@/components/attendance/AttendanceTools';
import { useAttendanceStream } from '@/components/attendance/useAttendanceStream';
import { SESSION_LABELS, REGISTRATION_LABELS, durationLabel, meetingDate } from '@/lib/attendance/presentation';
import type { AttendanceSessionDto, AttendanceRegistrationDto, AttendanceLogDto, AttendanceUnregisteredClientDto } from '@/types/attendance';
type Session=AttendanceSessionDto & {registrations:AttendanceRegistrationDto[];logs:AttendanceLogDto[];unregisteredClients:AttendanceUnregisteredClientDto[]};
export default function AttendanceLiveDashboardPage(){
  const {id}=useParams<{id:string}>(),router=useRouter();const {token,canOperate}=useAuth();
  const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('ALL'),[selectedId,setSelectedId]=useState<string|null>(null);
  const [action,setAction]=useState<'start'|'end'|null>(null),[busy,setBusy]=useState(false),[scanning,setScanning]=useState(false);
  const [editing,setEditing]=useState(false),[editName,setEditName]=useState(''),[editMac,setEditMac]=useState(''),[reason,setReason]=useState(''),[editError,setEditError]=useState('');
  const [now,setNow]=useState(Date.now());const sequence=useRef(0);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const load=useCallback(async(signal?:AbortSignal)=>{
    const request=++sequence.current;
    try{
      const response=await authenticatedFetch(`/api/attendance/sessions/${id}`,{signal});const body=await response.json();
      if(!response.ok || !body.success)throw new Error(body.error || 'Không tải được buổi họp.');
      if(signal?.aborted || request!==sequence.current)return;
      setSession(body.data);setError('');
    }catch(cause){if(!signal?.aborted && request===sequence.current)setError(cause instanceof Error?cause.message:'Không tải được dữ liệu.');}
    finally{if(!signal?.aborted)setLoading(false);}
  },[id]);
  useEffect(()=>{if(!token)return;const controller=new AbortController();setLoading(true);void load(controller.signal);return()=>controller.abort();},[load,token]);
  const connected=useAttendanceStream(id,!!token && session?.status==='ACTIVE',data=>{setSession(data);setError('');},()=>router.push('/admin/attendance'));
  useEffect(()=>{
    if(!token || session?.status!=='ACTIVE' || connected)return;
    const controller=new AbortController(),timer=setInterval(()=>void load(controller.signal),10000);
    return()=>{clearInterval(timer);controller.abort();};
  },[token,session?.status,connected,load]);
  const closeAction=useCallback(()=>setAction(null),[]),closeDetails=useCallback(()=>{setSelectedId(null);setEditing(false);setEditError('');},[]);
  async function transition(){
    if(!action || busy || !canOperate)return;setBusy(true);
    try{
      const response=await authenticatedFetch(`/api/attendance/sessions/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:action==='start'?'ACTIVE':'ENDED'})});const body=await response.json();
      if(!response.ok || !body.success)throw new Error(body.error || 'Không thay đổi được trạng thái.');
      setAction(null);await load();toast.success('Đã cập nhật trạng thái buổi họp.');
    }catch(cause){toast.error(cause instanceof Error?cause.message:'Thao tác thất bại.');}finally{setBusy(false);}
  }
  async function scan(){
    if(scanning || !canOperate)return;setScanning(true);
    try{const response=await authenticatedFetch('/api/attendance/monitor/tick',{method:'POST'});const body=await response.json();if(!response.ok || !body.success)throw new Error(body.error || 'Không thực hiện được đồng bộ.');await load();}
    catch(cause){toast.error(cause instanceof Error?cause.message:'Không đồng bộ được.');}finally{setScanning(false);}
  }
  const registrations=session?.registrations || [],selected=registrations.find(r=>r.id===selectedId);
  async function saveAttendee(){
    if(!selected || !canOperate || busy)return;setBusy(true);setEditError('');
    try{
      const response=await authenticatedFetch(`/api/attendance/sessions/${id}/registrations`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({registrationId:selected.id,displayName:editName.trim(),newMac:editMac.trim(),reason:reason.trim()})});const body=await response.json();
      if(!response.ok || !body.success)throw new Error(body.error || 'Không lưu được thông tin.');
      setEditing(false);await load();toast.success('Đã cập nhật đại biểu.');
    }catch(cause){setEditError(cause instanceof Error?cause.message:'Không lưu được thông tin.');}finally{setBusy(false);}
  }
  if(loading)return <div className="attendance-workspace"><div role="status" className="attendance-empty">Đang tải buổi họp…</div></div>;
  if(!session)return <div className="attendance-workspace"><div role="alert" className="attendance-error">{error || 'Không tìm thấy buổi họp.'}</div><Link className="attendance-button" href="/admin/attendance"><ArrowLeft />Danh sách buổi họp</Link></div>;
  const active=session.status==='ACTIVE',stats=session.stats;
  const lastSync=stats?.lastSyncTime?Date.parse(stats.lastSyncTime):0,age=lastSync?Math.max(0,Math.floor((now-lastSync)/1000)):null;
  const health=!active?'inactive':stats?.syncHealth==='error'?'error':!connected || age===null || age>15?'warning':stats?.syncHealth || 'warning';
  const metrics=[['Đã đăng ký',stats?.totalRegistered || 0],['Hiện diện',stats?.presentCount || 0],['Mất kết nối',stats?.temporaryAbsentCount || 0],['Vắng quá ngưỡng',stats?.alertAbsentCount || 0],['Chưa xác định',stats?.unknownCount || 0]];
  const filtered=registrations.filter(r=>(filter==='ALL' || r.status===filter) && (!search.trim() || `${r.displayName} ${r.identityValue} ${r.primaryMac} ${Object.values(r.formAnswers || {}).join(' ')}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))));
  const templateId=session.effectiveTemplateId || session.templateId;
  return <div className="attendance-workspace">
    <Link className="attendance-muted" href="/admin/attendance" style={{display:'inline-flex',alignItems:'center',gap:6,marginBottom:16,textDecoration:'none'}}><ArrowLeft />Danh sách buổi họp</Link>
    <header className="attendance-heading"><div><span className="attendance-badge" data-status={session.status}>{SESSION_LABELS[session.status]}</span><h1>{session.name}</h1><p>{session.location || 'Chưa ghi địa điểm'} · {meetingDate(session.startTime)} – {meetingDate(session.endTime)}</p></div><div className="attendance-actions"><button onClick={()=>void load()}><RefreshCw />Làm mới</button><AttendanceExportButton id={id} />{canOperate && <><Link href={`/admin/attendance/${id}/edit`} className="attendance-button"><Pencil />Sửa buổi họp</Link>{active?<button className="attendance-danger" onClick={()=>setAction('end')}><Square />Kết thúc</button>:session.status!=='ENDED' && <button className="attendance-primary" onClick={()=>setAction('start')}><Play />Bắt đầu</button>}</>}</div></header>
    {error && <div role="alert" className="attendance-error">{error} <button onClick={()=>void load()}>Thử lại</button></div>}
    <div className="attendance-source" data-health={health} role="status"><span className="source-dot" /><strong>{active?'UniFi Controller':session.status==='ENDED'?'Số liệu đã chốt':'Chưa chạy giám sát'}</strong><span>{active?(stats?.syncMessage || 'Chờ dữ liệu đồng bộ từ Controller.'):'Chỉ theo dõi trực tiếp khi buổi họp đang diễn ra.'}</span>{active && <span>{age===null?'Chưa có mốc đồng bộ':`Cập nhật ${age} giây trước`} · {connected?'Luồng trực tiếp đã kết nối':'Đang kết nối lại luồng dữ liệu'}</span>}{active && canOperate && <button style={{marginLeft:'auto'}} disabled={scanning} onClick={()=>void scan()}><RefreshCw />{scanning?'Đang đồng bộ…':'Đồng bộ ngay'}</button>}</div>
    <dl className="attendance-summary">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="attendance-columns"><main>
      <section className="attendance-panel"><div className="attendance-panel-title"><h2>Danh sách đại biểu</h2><span className="attendance-muted">{filtered.length}/{registrations.length} đại biểu</span></div>
        <div className="attendance-filters" style={{border:0,borderRadius:0,marginBottom:0}}><label className="attendance-field search">Tìm đại biểu<input aria-label="Tìm đại biểu" type="search" placeholder="Họ tên, đơn vị, mã định danh hoặc MAC" value={search} onChange={e=>setSearch(e.target.value)} /></label><label className="attendance-field">Trạng thái kết nối<select aria-label="Trạng thái đại biểu" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Tất cả</option>{Object.entries(REGISTRATION_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
        {!filtered.length?<div className="attendance-empty"><strong>{registrations.length?'Không tìm thấy đại biểu phù hợp':'Chưa có đại biểu đăng ký'}</strong>{registrations.length?'Thay đổi từ khóa hoặc trạng thái.':'Đại biểu kết nối SSID của buổi họp và hoàn tất biểu mẫu trên portal.'}</div>:<div className="attendance-table-scroll"><table className="attendance-table"><thead><tr><th>Đại biểu / Đơn vị</th><th>Trạng thái</th><th>AP / Tín hiệu</th><th>Thời gian</th><th>Hồ sơ</th></tr></thead><tbody>{filtered.map(reg=>{
          const absent=reg.absentStartedAt?Math.max(0,Math.floor((now-Date.parse(reg.absentStartedAt))/1000)):0,remaining=Math.max(0,session.warningThresholdMinutes*60-absent);
          return <tr key={reg.id}><td><strong>{reg.displayName}</strong><div className="attendance-muted">{String(reg.formAnswers?.department || reg.identityValue)}</div><div className="attendance-muted" style={{fontFamily:'monospace'}}>{reg.primaryMac}</div></td><td><span className="attendance-badge" data-status={reg.status}>{REGISTRATION_LABELS[reg.status]}</span>{reg.status==='TEMPORARY_ABSENT' && <div className="attendance-muted attendance-numbers">Cảnh báo sau {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</div>}</td><td>{session.targetAps?.find(ap=>ap.mac===reg.currentApMac)?.name || reg.currentApMac || 'Chưa xác nhận AP'}<div className="attendance-muted">{reg.currentRssi!=null?`${reg.currentRssi} dBm`:'—'}</div></td><td className="attendance-numbers">{durationLabel(reg.totalPresentSeconds)} hiện diện<div className="attendance-muted">{durationLabel(reg.totalAbsentSeconds)} vắng · {durationLabel(reg.totalUnknownSeconds || 0)} chưa rõ</div></td><td><button aria-label={`Chi tiết ${reg.displayName}`} onClick={()=>{setSelectedId(reg.id);setEditing(false);}}>Chi tiết</button></td></tr>;
        })}</tbody></table></div>}
      </section>
      <section className="attendance-panel"><div className="attendance-panel-title"><h2>Thiết bị chưa hoàn tất điểm danh</h2><span className="attendance-muted">{session.unregisteredClients?.length || 0} thiết bị</span></div>{session.unregisteredClients?.length?<div className="attendance-table-scroll"><table className="attendance-table"><thead><tr><th>Địa chỉ MAC</th><th>Địa chỉ IP</th><th>AP</th><th>Lần thấy cuối</th></tr></thead><tbody>{session.unregisteredClients.map(c=><tr key={c.id}><td>{c.mac}</td><td>{c.ip || '—'}</td><td>{c.apMac || '—'}</td><td>{meetingDate(c.lastSeenAt)}</td></tr>)}</tbody></table></div>:<p className="attendance-empty" style={{padding:24}}>Chưa có thiết bị chưa đăng ký được ghi nhận.</p>}</section>
    </main><aside>
      <section className="attendance-panel"><div className="attendance-panel-title"><h2>Mẫu điểm danh & mạng WiFi</h2></div><dl className="attendance-detail-grid" style={{gridTemplateColumns:'1fr'}}><div><dt>Mẫu hiển thị</dt><dd>{templateId?<><strong>{session.templateName || 'Mẫu đang liên kết'}</strong><div className="attendance-actions" style={{marginTop:10}}><Link className="attendance-button" target="_blank" rel="noopener noreferrer" href={`/admin/templates/${templateId}/preview?screen=attendance_gate`}><ExternalLink />Xem trước</Link>{canOperate && <Link className="attendance-button" target="_blank" rel="noopener noreferrer" href={`/admin/templates/${templateId}/builder?screen=attendance_gate`}><Pencil />Thiết kế</Link>}</div><p className="attendance-muted">{session.templateReadiness?.attendanceReady?'Bản xuất bản đã bật điểm danh trên 3 thiết bị.':'Cần kiểm tra bản xuất bản và bật màn hình điểm danh trên 3 thiết bị.'}</p></>:<span>Chưa liên kết mẫu. Chọn mẫu ở phần sửa buổi họp.</span>}</dd></div><div><dt>SSID / Site</dt><dd><Wifi style={{display:'inline',marginRight:6}} />{session.ssid} · {session.unifiSite}</dd></div><div><dt>Phạm vi AP</dt><dd>{session.targetApMacs.length?session.targetApMacs.map(mac=><div key={mac} style={{marginBottom:6}}>{session.targetAps?.find(ap=>ap.mac===mac)?.name || mac}</div>):'Toàn bộ AP trên SSID'}</dd></div><div><dt>Ngưỡng cảnh báo vắng</dt><dd>{session.warningThresholdMinutes} phút sau khi xác nhận mất kết nối.</dd></div></dl></section>
      <section className="attendance-panel"><div className="attendance-panel-title"><h2>Nhật ký điểm danh</h2><Radio /></div><ol className="attendance-activity">{session.logs?.length?session.logs.map(log=><li key={log.id}><div>{log.message}</div><time className="attendance-muted">{meetingDate(log.createdAt)}</time></li>):<li className="attendance-muted">Chưa có sự kiện.</li>}</ol></section>
    </aside></div>
    {action && <AttendanceDialog title={action==='start'?'Bắt đầu buổi họp':'Kết thúc buổi họp'} onClose={closeAction} busy={busy}><p>{action==='start'?'Hệ thống sẽ kiểm tra mẫu đã xuất bản và bắt đầu giám sát thiết bị qua UniFi Controller.':'Hệ thống sẽ đóng các khoảng theo dõi và chốt thời gian thống kê của buổi họp.'}</p><footer><button disabled={busy} onClick={closeAction}>Hủy</button><button disabled={busy} className="attendance-primary" onClick={()=>void transition()}>{busy?'Đang xử lý…':'Xác nhận'}</button></footer></AttendanceDialog>}
    {selected && <AttendanceDialog title={`Hồ sơ: ${selected.displayName}`} onClose={closeDetails} busy={busy}>
      <span className="attendance-badge" data-status={selected.status}>{REGISTRATION_LABELS[selected.status]}</span>
      <dl className="attendance-detail-grid" style={{padding:'16px 0'}}><div><dt>Mã định danh</dt><dd>{selected.identityValue}</dd></div><div><dt>Thiết bị</dt><dd>{selected.primaryMac}</dd></div><div><dt>Đăng ký / Lần thấy đầu</dt><dd>{meetingDate(selected.firstSeenAt)}</dd></div><div><dt>Lần xác nhận gần nhất</dt><dd>{meetingDate(selected.lastSeenAt)}</dd></div>{Object.entries(selected.formAnswers || {}).map(([key,value])=><div key={key}><dt>{session.formSchema?.find(field=>field.id===key)?.label || key}</dt><dd>{String(value)}</dd></div>)}</dl>
      {editing?<form onSubmit={e=>{e.preventDefault();void saveAttendee();}} style={{display:'grid',gap:12}}>{editError && <div role="alert" className="attendance-error">{editError}</div>}<label className="attendance-field">Họ và tên<input aria-label="Họ và tên đại biểu" required value={editName} onChange={e=>setEditName(e.target.value)} /></label><label className="attendance-field">MAC thiết bị<input aria-label="MAC thiết bị đại biểu" required disabled={session.status==='ENDED'} value={editMac} onChange={e=>setEditMac(e.target.value)} /></label>{editMac.trim().toLowerCase()!==selected.primaryMac.toLowerCase() && <label className="attendance-field">Lý do đổi thiết bị<input required value={reason} onChange={e=>setReason(e.target.value)} /></label>}<div className="attendance-actions"><button disabled={busy} className="attendance-primary" type="submit">{busy?'Đang lưu…':'Lưu thông tin'}</button><button disabled={busy} type="button" onClick={()=>setEditing(false)}>Hủy sửa</button></div></form>:canOperate && <button onClick={()=>{setEditing(true);setEditName(selected.displayName);setEditMac(selected.primaryMac);setReason('');setEditError('');}}><Pencil />Sửa thông tin / thiết bị</button>}
      <h3 style={{fontSize:14,marginTop:24}}>Lịch sử hiện diện</h3><ol className="attendance-activity" style={{padding:0,maxHeight:220}}>{selected.intervals?.length?selected.intervals.map(interval=><li key={interval.id}><strong>{interval.status==='PRESENT'?'Hiện diện':interval.status==='UNKNOWN'?'Chưa xác định':'Mất kết nối'}</strong><div>{meetingDate(interval.joinedAt)} – {interval.leftAt?meetingDate(interval.leftAt):'Đang tiếp diễn'}</div></li>):<li>Chưa có khoảng theo dõi.</li>}</ol><footer><button onClick={closeDetails} disabled={busy}><X />Đóng</button></footer>
    </AttendanceDialog>}
  </div>;
}
