'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { MediaPreview } from './MediaPreview';
export interface MediaItem { key: string; url: string; type: 'image' | 'video'; name: string; size: number; lastModified: string | null; usage?: { id: string; name: string; kind: string }[] }
export function MediaLibrary({ onSelect, accept = 'image/*,video/*', refresh = 0, allowDelete = false }: { onSelect?: (url: string) => void; accept?: string; refresh?: number; allowDelete?: boolean }) {
  const { token } = useAuth();
  const [items,setItems] = useState<MediaItem[]>([]); const [search,setSearch] = useState(''); const [type,setType] = useState(accept.startsWith('image') && !accept.includes('video') ? 'image' : accept.startsWith('video') && !accept.includes('image') ? 'video' : 'all');
  const [page,setPage] = useState(1); const [total,setTotal] = useState(0); const [error,setError] = useState(''); const [loading,setLoading] = useState(false); const [version,setVersion] = useState(0);
  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }),[token]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); fetch(`/api/upload?${new URLSearchParams({ q: search, type, page: String(page), limit: '24' })}`,{ headers: headers(), signal: controller.signal }).then(async response => { const body = await response.json(); if(!response.ok) throw new Error(body.error); setItems(body.data); setTotal(body.total); }).catch(e => { if(e.name !== 'AbortError') setError(e.message); }).finally(() => { if(!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); },[search,type,page,refresh,version,headers]);
  async function remove(item: MediaItem) { if(!confirm(`Delete ${item.name}?`)) return; const response = await fetch('/api/upload',{ method:'DELETE', headers:{ ...headers(),'Content-Type':'application/json' },body:JSON.stringify({ keys:[item.key] }) }); const body = await response.json(); if(!response.ok) setError(body.error); else setVersion(v=>v+1); }
  return <div className="space-y-4"><div className="flex gap-3"><input aria-label="Search media" placeholder="Search media…" className="min-w-0 flex-1 rounded-lg border p-2" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} /><select aria-label="Media type" className="rounded-lg border p-2" value={type} onChange={e=>{setType(e.target.value);setPage(1);}}>{accept.includes('image') && accept.includes('video') && <option value="all">All media</option>}{accept.includes('image') && <option value="image">Images</option>}{accept.includes('video') && <option value="video">Videos</option>}</select></div>
    {error && <p role="alert" className="text-rose-700">{error}</p>}{loading && <p role="status">Loading media…</p>}{!loading && !items.length && <p>No media found.</p>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{items.map(item=><article key={item.key} className="space-y-2 rounded-xl border bg-white p-3"><MediaPreview src={item.url} type={item.type} alt={item.name} /><p className="truncate text-sm font-semibold" title={item.name}>{item.name}</p><p className="text-xs text-slate-500">{item.type} · {(item.size/1024/1024).toFixed(2)} MB · {item.lastModified ? new Date(item.lastModified).toLocaleDateString() : 'Unknown date'}</p><p className="text-xs text-slate-500">{item.usage?.length ? `Used in ${item.usage.length} draft/revision(s)` : 'Unused'}</p>{item.usage?.map(use=><p className="truncate text-xs" key={use.id}>{use.name}</p>)}{onSelect && <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white" onClick={()=>onSelect(item.url)}>Choose</button>}{allowDelete && <button type="button" disabled={!!item.usage?.length} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>void remove(item)}>Delete</button>}</article>)}</div>
    <div className="flex items-center gap-4"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span className="text-sm">Page {page} / {Math.max(1,Math.ceil(total/24))} · {total} files</span><button type="button" disabled={page*24>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div>
  </div>;
}
export function MediaPicker({ onSelect, onClose, accept }: { onSelect: (url: string) => void; onClose: () => void; accept?: string }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if(e.key === 'Escape') onClose();
      if(e.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, video[controls], [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown',handler);
    return () => { window.removeEventListener('keydown',handler); previous?.focus(); };
  },[onClose]);
  return <div ref={dialog} className="fixed inset-0 z-50 overflow-auto bg-black/50 p-6" role="dialog" aria-modal="true" aria-label="Choose media"><div className="mx-auto max-w-5xl space-y-4 rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Media library</h2><button autoFocus type="button" aria-label="Close media library" onClick={onClose}>Close</button></div><MediaLibrary onSelect={onSelect} accept={accept} /></div></div>;
}
