'use client';
import { useEffect, useState } from 'react';
export function MediaPreview({ src, type, alt = 'Media preview', className = '' }: { src: string; type?: 'image' | 'video'; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src) return <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center text-xs text-slate-500">Chưa chọn hình ảnh / video</div>;
  if (failed) return <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 text-center">⚠️ Không tải được ảnh xem trước. Nhấn nút Xóa bên dưới để chọn ảnh khác.</div>;
  return type === 'video' || /(?:\/videos\/|\.(mp4|webm|ogg)(?:\?|$))/.test(src) ? <video src={src} controls preload="metadata" className={`max-h-56 w-full rounded-xl object-contain bg-black/5 ${className}`} onError={() => setFailed(true)} /> : <img src={src} alt={alt} className={`max-h-56 w-full rounded-xl object-contain bg-black/5 ${className}`} onError={() => setFailed(true)} />;
}
