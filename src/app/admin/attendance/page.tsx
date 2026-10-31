'use client';
import { useCallback, useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Pencil, Trash2, Play, Square, ArrowUpRight, Filter, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { authenticatedFetch } from '@/lib/api';
import { AttendanceDialog, AttendanceExportButton } from '@/components/attendance/AttendanceTools';
import { SESSION_LABELS, meetingDate, vietnamMonthKey, monthLabel } from '@/lib/attendance/presentation';
import type { AttendanceSessionDto } from '@/types/attendance';
import toast from 'react-hot-toast';
interface Meta {page:number;limit:number;total:number;totalPages:number}
type Action={session:AttendanceSessionDto;kind:'start'|'end'|'delete'};
export default function AttendanceSessionsPage(){
  const {token,canOperate}=useAuth();
  const [sessions,setSessions]=useState<AttendanceSessionDto[]>([]),[meta,setMeta]=useState<Meta>({page:1,limit:25,total:0,totalPages:1});
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[month,setMonth]=useState(''),[status,setStatus]=useState('ALL'),[page,setPage]=useState(1);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[action,setAction]=useState<Action|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(1);},250);return()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    if(!token)return;
    const controller=new AbortController();setLoading(true);setError('');
    const params=new URLSearchParams({page:String(page),limit:'25'});
    if(status!=='ALL')params.set('status',status);if(month)params.set('month',month);if(query.trim())params.set('search',query.trim());
    authenticatedFetch(`/api/attendance/sessions?${params}`,{signal:controller.signal}).then(async response=>{
      const body=await response.json();if(!response.ok || !body.success)throw new Error(body.error || 'Không tải được danh sách buổi họp.');
      if(controller.signal.aborted)return;
      const next=body.meta || {page,limit:25,total:body.data.length,totalPages:1};
      if(page>next.totalPages){setPage(next.totalPages);return;}
      setSessions(body.data);setMeta(next);
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[token,page,status,month,query,refresh]);
  const closeAction=useCallback(()=>setAction(null),[]);
  async function execute(){
    if(!action || busy || !canOperate)return;setBusy(true);
    try{
      const response=await authenticatedFetch(`/api/attendance/sessions/${action.session.id}`,{method:action.kind==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},...(action.kind==='delete'?{}:{body:JSON.stringify({status:action.kind==='start'?'ACTIVE':'ENDED'})})});
      const body=await response.json();if(!response.ok || !body.success)throw new Error(body.error || 'Không thực hiện được thao tác.');
      toast.success(action.kind==='delete'?'Đã xóa buổi họp.':action.kind==='start'?'Đã bắt đầu buổi họp.':'Đã kết thúc buổi họp.');
      setAction(null);setRefresh(v=>v+1);
    }catch(cause){toast.error(cause instanceof Error?cause.message:'Thao tác thất bại.');}finally{setBusy(false);}
  }
  const metrics=[['Buổi họp phù hợp',meta.total],['Đang diễn ra trên trang',sessions.filter(s=>s.status==='ACTIVE').length],['Đại biểu trên trang',sessions.reduce((n,s)=>n+(s.stats?.totalRegistered || 0),0)],['Hiện diện',sessions.reduce((n,s)=>n+(s.stats?.presentCount || 0),0)],['Vắng quá ngưỡng',sessions.reduce((n,s)=>n+(s.stats?.alertAbsentCount || 0),0)]];
  const filterActive=!!(search || month || status!=='ALL');
  return <div className="attendance-workspace">
    <header className="attendance-heading"><div><span className="attendance-kicker">Quản lý hội nghị · Theo dõi hiện diện</span><h1>Điểm danh họp</h1><p>Quản lý lịch họp, mẫu điểm danh và trạng thái kết nối WiFi của đại biểu.</p></div><div className="attendance-actions"><button onClick={()=>setRefresh(v=>v+1)} disabled={loading}><RefreshCw />Làm mới</button>{canOperate && <Link href="/admin/attendance/new" className="attendance-button attendance-primary"><Plus />Tạo buổi họp</Link>}</div></header>
    <div className="attendance-filters" role="search" aria-label="Lọc buổi họp">
      <label className="attendance-field search">Tìm kiếm<input type="search" aria-label="Tìm buổi họp" placeholder="Tên buổi họp, địa điểm hoặc SSID" value={search} onChange={e=>setSearch(e.target.value)} /></label>
      <label className="attendance-field">Tháng tổ chức<input type="month" aria-label="Tháng tổ chức" value={month} onChange={e=>{setMonth(e.target.value);setPage(1);}} /></label>
      <label className="attendance-field">Trạng thái<select aria-label="Trạng thái buổi họp" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="ALL">Tất cả trạng thái</option>{Object.entries(SESSION_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {filterActive && <button onClick={()=>{setSearch('');setQuery('');setMonth('');setStatus('ALL');setPage(1);}}><X />Xóa bộ lọc</button>}
    </div>
    {!error && <dl className="attendance-summary">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{loading?'—':value}</dd></div>)}</dl>}
    {error?<div role="alert" className="attendance-error">{error} <button onClick={()=>setRefresh(v=>v+1)}>Thử lại</button></div>:<section className="attendance-panel" aria-label="Danh sách buổi họp" aria-busy={loading}>
      <div className="attendance-panel-title"><h2>Lịch sử buổi họp</h2><span className="attendance-muted"><Filter style={{display:'inline',width:13,height:13,marginRight:6}} />Nhóm theo tháng · Giờ Việt Nam</span></div>
      {loading?<div role="status" className="attendance-empty">Đang tải danh sách buổi họp…</div>:!sessions.length?<div className="attendance-empty"><strong>{filterActive?'Không có buổi họp phù hợp':'Chưa có buổi họp'}</strong>{filterActive?'Điều chỉnh tháng, trạng thái hoặc từ khóa tìm kiếm.':'Tạo buổi họp và liên kết mẫu điểm danh để bắt đầu.'}</div>:<div className="attendance-table-scroll"><table className="attendance-table"><thead><tr><th>Buổi họp / Mẫu hiển thị</th><th>Thời gian</th><th>Mạng WiFi</th><th>Trạng thái</th><th>Đại biểu</th><th>Thao tác</th></tr></thead><tbody>{sessions.map((session,index)=>{
        const key=vietnamMonthKey(session.startTime),previous=index?vietnamMonthKey(sessions[index-1].startTime):'';
        return <Fragment key={session.id}>{key!==previous && <tr className="attendance-month"><td colSpan={6}>{monthLabel(key)}</td></tr>}<tr>
          <td><Link className="attendance-name" href={`/admin/attendance/${session.id}`}>{session.name}</Link><div className="attendance-muted">{session.location || 'Chưa ghi địa điểm'}</div>{(session.effectiveTemplateId || session.templateId)?<Link className="attendance-muted" href={`/admin/templates/${session.effectiveTemplateId || session.templateId}/preview?screen=attendance_gate`}>{session.templateName || 'Mẫu điểm danh'} ↗</Link>:<span className="attendance-muted">{session.campaignName?'Mẫu từ chiến dịch':'Chưa liên kết mẫu'}</span>}</td>
          <td className="attendance-numbers">{meetingDate(session.startTime)}<div className="attendance-muted">Đến {meetingDate(session.endTime)}</div></td>
          <td>{session.ssid}<div className="attendance-muted">Site {session.unifiSite} · {session.targetApMacs.length?`${session.targetApMacs.length} AP`:'Toàn bộ AP'}</div></td>
          <td><span className="attendance-badge" data-status={session.status}>{SESSION_LABELS[session.status]}</span>{session.status==='ACTIVE' && session.stats?.syncHealth!=='healthy' && <div className="attendance-muted">Chờ / lỗi đồng bộ</div>}</td>
          <td className="attendance-numbers"><strong>{session.stats?.totalRegistered || 0}</strong><div className="attendance-muted">{session.stats?.presentCount || 0} hiện diện · {session.stats?.temporaryAbsentCount || 0} mất kết nối</div></td>
          <td><div className="attendance-row-actions"><Link className="attendance-button" aria-label={`Theo dõi ${session.name}`} href={`/admin/attendance/${session.id}`}><ArrowUpRight />{session.status==='ACTIVE'?'Theo dõi':'Chi tiết'}</Link><AttendanceExportButton id={session.id} />{canOperate && <><Link className="attendance-button" aria-label={`Sửa ${session.name}`} href={`/admin/attendance/${session.id}/edit`}><Pencil />Sửa</Link>{['DRAFT','READY'].includes(session.status) && <button aria-label={`Bắt đầu ${session.name}`} onClick={()=>setAction({session,kind:'start'})}><Play />Bắt đầu</button>}{session.status==='ACTIVE'?<button onClick={()=>setAction({session,kind:'end'})}><Square />Kết thúc</button>:<button className="attendance-danger" aria-label={`Xóa ${session.name}`} onClick={()=>setAction({session,kind:'delete'})}><Trash2 />Xóa</button>}</>}</div></td>
        </tr></Fragment>;
      })}</tbody></table></div>}
    </section>}
    {!error && <div className="attendance-pagination"><span>{meta.total} buổi họp · Trang {meta.page}/{meta.totalPages}</span><div className="attendance-actions"><button disabled={loading || page<=1} onClick={()=>setPage(p=>p-1)}>Trang trước</button><button disabled={loading || page>=meta.totalPages} onClick={()=>setPage(p=>p+1)}>Trang sau</button></div></div>}
    {action && <AttendanceDialog title={action.kind==='delete'?'Xóa buổi họp':action.kind==='start'?'Bắt đầu giám sát':'Kết thúc buổi họp'} onClose={closeAction} busy={busy}><p><strong>{action.session.name}</strong></p><p className="attendance-muted">{action.kind==='delete'?`Sẽ xóa buổi họp và ${action.session.stats?.totalRegistered || 0} bản ghi đại biểu, lịch sử hiện diện, nhật ký liên quan. Thao tác không thể hoàn tác.`:action.kind==='start'?'Mẫu đã xuất bản phải bật điểm danh trên cả Mobile, Tablet và PC. Hệ thống sẽ lấy dữ liệu từ UniFi Controller.':'Hệ thống sẽ đóng các khoảng hiện diện và chốt thời gian thống kê.'}</p><footer><button disabled={busy} onClick={closeAction}>Hủy</button><button disabled={busy} className={action.kind==='delete'?'attendance-danger':'attendance-primary'} onClick={()=>void execute()}>{busy?'Đang xử lý…':'Xác nhận'}</button></footer></AttendanceDialog>}
  </div>;
}
