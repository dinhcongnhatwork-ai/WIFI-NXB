'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { Users,Activity,RefreshCw } from 'lucide-react';
import { ConnectionSettings } from '@/components/network/ConnectionSettings';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
export default function SettingsPage(){
 const{canAdmin}=useAuth();const[data,setData]=useState<any>(null),[error,setError]=useState('');
 const load=()=>api.get<any>('/api/settings').then(r=>{setData(r.data);setError('');}).catch(e=>setError(e.message));
 useEffect(()=>{if(canAdmin)void load();},[canAdmin]);
 if(!canAdmin)return <p className="admin-error">Chỉ quản trị viên được thay đổi cài đặt hệ thống.</p>;
 return <div><div className="admin-page-heading"><div><h1>Cài đặt hệ thống</h1><p>Quản trị kết nối, tài khoản và nguồn giám sát.</p></div><button className="admin-button" onClick={()=>void load()}><RefreshCw size={20}/>Làm mới</button></div>{error&&<p className="admin-error" role="alert">{error}</p>}
 <ConnectionSettings embedded onSaved={()=>void load()}/>
 <section className="admin-panel"><div className="admin-panel-heading"><h2>Cấu hình vận hành</h2></div><div className="divide-y divide-slate-200">
 {[{href:'/admin/settings/accounts',icon:Users,title:'Tài khoản quản trị',text:'Phân quyền Quản trị, Vận hành và Giám sát.'},{href:'/admin/monitor',icon:Activity,title:'Giám sát hệ thống',text:'Tài nguyên, trạng thái dịch vụ, cảnh báo và nhật ký.'}].map(({href,icon:Icon,title,text})=><Link key={href} href={href} className="flex gap-4 p-5 hover:bg-slate-50"><Icon size={20} className="text-blue-600 shrink-0"/><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-slate-500">{text}</p></div></Link>)}
 </div></section><section className="admin-panel"><div className="admin-panel-heading"><h2>Trạng thái cấu hình</h2></div><dl className="grid gap-4 p-5 sm:grid-cols-2"><div><dt className="text-slate-500">Mã hóa kết nối</dt><dd className="mt-1 font-medium">{data?(data.encryptionConfigured?'Đã cấu hình':'Cần cấu hình NETWORK_CREDENTIALS_KEY'):'Đang kiểm tra…'}</dd></div><div><dt className="text-slate-500">Nguồn Zabbix</dt><dd className="mt-1 font-medium">{data?(data.monitoring?.configured?'Đã cấu hình':'Chưa kết nối Zabbix'):'Đang kiểm tra…'}</dd></div><div><dt className="text-slate-500">Kết nối thiết bị</dt><dd className="mt-1">{data?.connections?.length??'—'}</dd></div><div><dt className="text-slate-500">Chu kỳ thu thập</dt><dd className="mt-1">30 giây</dd></div></dl></section></div>;
}
