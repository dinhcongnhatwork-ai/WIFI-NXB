'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Check, Film, ImageIcon, Trash2, X } from 'lucide-react';
export interface MediaItem { key: string; url: string; type: 'image' | 'video'; name: string; size: number; lastModified: string | null; usage?: { id: string; name: string; kind: string }[] }
export function MediaLibrary({ onSelect, onSelectMany, accept = 'image/*,video/*', refresh = 0, allowDelete = false }: { onSelect?: (url: string, item?: MediaItem) => void; onSelectMany?: (items: MediaItem[]) => void; accept?: string; refresh?: number; allowDelete?: boolean }) {
  const { token } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState(accept.startsWith('image') && !accept.includes('video') ? 'image' : accept.startsWith('video') && !accept.includes('image') ? 'video' : 'all');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [error, setError] = useState(''), [loading, setLoading] = useState(false), [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController(); setLoading(true); setError('');
    fetch(`/api/upload?${new URLSearchParams({ q: search, type, page: String(page), limit: '24' })}`, { headers: headers(), signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setItems(body.data); setTotal(body.total); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, search, type, page, refresh, version, headers]);
  async function remove(item: MediaItem) {
    if (!confirm(`Xóa media “${item.name}”?`)) return;
    try {
      const response = await fetch('/api/upload', { method: 'DELETE', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: [item.key] }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xóa media.'); }
  }
  function choose(item: MediaItem) {
    if (onSelectMany) setSelected(previous => previous.some(x => x.key === item.key) ? previous.filter(x => x.key !== item.key) : [...previous, item]);
    else onSelect?.(item.url, item);
  }
  return <div className="space-y-3">
    <div className="flex gap-2"><input aria-label="Tìm media" placeholder="Tìm ảnh, video…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><select aria-label="Loại media" className="min-w-0 rounded-lg border border-slate-200 px-2 text-xs" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>{accept.includes('image') && accept.includes('video') && <option value="all">Tất cả</option>}{accept.includes('image') && <option value="image">Ảnh</option>}{accept.includes('video') && <option value="video">Video</option>}</select></div>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {loading ? <div role="status" aria-label="Đang tải media" className="grid grid-cols-2 gap-2">{[1, 2, 3, 4].map(n => <div key={n} className="aspect-square rounded-lg bg-slate-100 animate-pulse" />)}</div> : !items.length ? <div className="py-8 text-center text-xs text-slate-500"><ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />Chưa có media phù hợp.</div> : null}
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>{!loading && items.map(item => {
      const checked = selected.some(x => x.key === item.key);
      return <div key={item.key} className={`relative overflow-hidden rounded-lg bg-slate-100 ${checked ? 'ring-2 ring-blue-600' : 'ring-1 ring-slate-200'}`}>
        <button type="button" title={item.name} aria-label={`Chọn ${item.type === 'image' ? 'ảnh' : 'video'} ${item.name}`} aria-pressed={onSelectMany ? checked : undefined} disabled={!onSelect && !onSelectMany} className="relative block aspect-square w-full overflow-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:cursor-default" onClick={() => choose(item)}>
          {item.type === 'image' ? <img loading="lazy" src={item.url} alt={item.name} className="h-full w-full object-cover transition-transform hover:scale-105" /> : <><video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /><Film className="absolute bottom-2 left-2 h-5 w-5 rounded bg-slate-900/70 p-0.5 text-white" /></>}
          {checked && <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-blue-600 p-0.5 text-white" />}
        </button>
        {allowDelete && <button aria-label={`Xóa ${item.name}`} title={item.usage?.length ? 'Media đang được sử dụng' : 'Xóa media'} disabled={!!item.usage?.length} className="absolute right-1 bottom-1 rounded bg-white/90 p-1.5 text-slate-600 hover:text-rose-600 disabled:opacity-40" onClick={() => void remove(item)}><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>;
    })}</div>
    {onSelectMany && <button type="button" disabled={!selected.length} className="sticky bottom-0 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400" onClick={() => { onSelectMany(selected); setSelected([]); }}>Thêm {selected.length || ''} ảnh vào slider</button>}
    <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><button type="button" disabled={page <= 1} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage(p => p - 1)}>←</button><span>{page} / {Math.max(1, Math.ceil(total / 24))}</span><button type="button" disabled={page * 24 >= total} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage(p => p + 1)}>→</button></div>
  </div>;
}
export function MediaPicker({ onSelect, onClose, accept, onSelectMany }: { onSelect: (url: string) => void; onClose: () => void; accept?: string; onSelectMany?: (items: MediaItem[]) => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); previous?.focus(); };
  }, [onClose]);
  return <div ref={dialog} className="fixed inset-0 z-50 overflow-auto bg-slate-950/40 p-6" role="dialog" aria-modal="true" aria-label="Chọn media"><div className="mx-auto max-w-4xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Thư viện media</h2><button autoFocus type="button" aria-label="Đóng thư viện" onClick={onClose}><X className="h-5 w-5" /></button></div><MediaLibrary onSelect={onSelect} onSelectMany={onSelectMany} accept={accept} /></div></div>;
}
