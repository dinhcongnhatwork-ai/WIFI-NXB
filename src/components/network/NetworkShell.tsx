'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Settings2, Network, Terminal, LayoutDashboard, RefreshCw } from 'lucide-react';
import type { Provider } from '@/lib/network/resources';
import { networkFetch } from './client';
import { useAuth } from '@/components/auth/AuthProvider';

type Connection={id:string;name:string;isDefault:boolean;config:Record<string,unknown>};
export default function NetworkShell({provider,children}:{provider:Provider;children:React.ReactNode}){
 const router=useRouter(),pathname=usePathname(),params=useSearchParams();const {canAdmin,token}=useAuth();
 const [loadingConnections,setLoadingConnections]=useState(true);
 const [connectionError,setConnectionError]=useState(''),[retry,setRetry]=useState(0);
 const [connections,setConnections]=useState<Connection[]>([]);const [sites,setSites]=useState<{id:string;name:string}[]>([]);const [error,setError]=useState('');
 const connectionId=params.get('connectionId')||'';const siteId=params.get('siteId')||'';
 useEffect(()=>{let active=true;setLoadingConnections(true);networkFetch(`/api/network/connections?provider=${provider.toUpperCase()}`).then(async r=>{const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||"Không thể tải kết nối");if(!active)return;setConnections(j.data);setConnectionError('');const fallback=j.data.find((c:Connection)=>c.isDefault);if(!connectionId&&fallback){const q=new URLSearchParams(params.toString());q.set('connectionId',fallback.id);router.replace(`${pathname}?${q}`,{scroll:false});}}).catch(e=>active&&setConnectionError(e.message)).finally(()=>active&&setLoadingConnections(false));return()=>{active=false};},[provider,connectionId,token,retry]);
 useEffect(()=>{if(provider!=='unifi'||!connectionId||!connections.some(c=>c.id===connectionId))return;let active=true;setSites([]);networkFetch(`/api/unifi/info?type=sites&connectionId=${encodeURIComponent(connectionId)}`).then(async r=>{const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||"Không thể tìm danh sách site");if(!active)return;const list=j.data.map((s:any)=>({id:s.name||s.id||s._id,name:s.desc||s.name||s.id}));setSites(list);setError('');if(!siteId){const configured=String(connections.find(c=>c.id===connectionId)?.config.site||'default');if(list.some((s:any)=>s.id===configured)){const q=new URLSearchParams(params.toString());q.set('siteId',configured);router.replace(`${pathname}?${q}`,{scroll:false});}}}).catch(e=>active&&setError(e.message));return()=>{active=false};},[provider,connectionId,connections]);
 const scope=(key:string,value:string)=>{const q=new URLSearchParams(params.toString());q.set(key,value);if(key==='connectionId')q.delete('siteId');router.push(`${pathname}?${q}`,{scroll:false});setError('');};
 const links=[['',"Tổng quan",LayoutDashboard],['/manage',"Quản lý",Settings2],['/topology',"Sơ đồ mạng",Network],...(canAdmin?[['/raw',"API nâng cao",Terminal]]:[])] as const;
 return <div className="space-y-5 text-sm text-slate-800">
  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
   <div className="flex flex-wrap gap-3"><label className="text-xs font-medium text-slate-500">{provider==='unifi'?'Controller':'Router'}<select aria-label={provider==='unifi'?'Controller':'Router'} value={connectionId} onChange={e=>scope('connectionId',e.target.value)} className="mt-1 block min-w-48 rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"><option value="">Chọn kết nối</option>{connections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   {provider==='unifi'&&<label className="text-xs font-medium text-slate-500">Site<select aria-label="Site" value={siteId} onChange={e=>scope('siteId',e.target.value)} className="mt-1 block min-w-40 rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"><option value="">Chọn site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}</div>
   <nav aria-label="Công cụ mạng" className="flex flex-wrap gap-1">{links.map(([suffix,title,Icon])=><Link key={String(suffix)} href={`/admin/${provider}${suffix}?${params}`} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${pathname===`/admin/${provider}${suffix}`?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-100'}`}><Icon size={20}/>{String(title)}</Link>)}</nav>
  </div>
  {(connectionError||error)&&<p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">{connectionError||error}</p>}
  {loadingConnections?<p className="flex items-center gap-2 text-slate-500"><RefreshCw size={20}/> Đang tải kết nối mạng…</p>:!connections.length&&connectionError?<div className="rounded-md border bg-white p-5"><p>Không thể tải danh sách kết nối. Vui lòng thử lại.</p><button className="admin-button mt-3" onClick={()=>setRetry(value=>value+1)}><RefreshCw size={20}/>Thử lại</button></div>:!connections.length?<div className="rounded-md border bg-white p-5"><p>Chưa có kết nối mạng được cấu hình.</p>{canAdmin&&<Link href="/admin/settings/connections" className="mt-2 inline-block text-blue-600 underline">Thêm kết nối mạng</Link>}</div>:!connectionId?<p className="rounded-md border bg-white p-5">Chọn một kết nối đã lưu để quản lý mạng.</p>:provider==='unifi'&&!siteId?<p className="rounded-md border bg-white p-5">Chọn site để xem dữ liệu mạng.</p>:<div key={`${connectionId}:${siteId}`}>{children}</div>}
 </div>;
}
