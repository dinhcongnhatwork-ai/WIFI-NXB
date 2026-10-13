'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { MediaPreview } from './MediaPreview';
import { MediaPicker } from './MediaPicker';
export interface MediaUploadFieldProps { label: string; value: string; onChange: (url: string) => void; accept?: string }
export function MediaUploadField({ label, value, onChange, accept = 'image/*,video/*' }: MediaUploadFieldProps) {
  const { token } = useAuth();
  const [local, setLocal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState(value || '');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    setCustomUrl(value || '');
  }, [value]);

  useEffect(() => () => { sequence.current++; xhrRef.current?.abort(); }, []);
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  async function upload(selected: File) {
    const current = ++sequence.current;
    xhrRef.current?.abort();
    setFile(selected); setError('');
    if (selected.size > 50 * 1024 * 1024) { setError('Maximum file size is 50MB.'); return; }
    setLocal(URL.createObjectURL(selected)); setProgress(0);
    try {
      const data = await new Promise<{ url: string; type: 'image' | 'video' }>((resolve,reject) => {
        const xhr = new XMLHttpRequest(); xhrRef.current = xhr;
        xhr.open('POST','/api/upload'); xhr.withCredentials = true;
        if (token) xhr.setRequestHeader('Authorization',`Bearer ${token}`);
        xhr.upload.onprogress = event => { if (current === sequence.current && event.lengthComputable) setProgress(Math.round(event.loaded/event.total*100)); };
        xhr.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
        xhr.onabort = () => reject(new Error('Upload cancelled. Your previous selection is retained.'));
        xhr.onload = () => { try { const result = JSON.parse(xhr.responseText); if (xhr.status < 200 || xhr.status >= 300) throw new Error(result.error || 'Upload failed'); resolve(result.data); } catch (e) { reject(e); } };
        const form = new FormData(); form.append('file',selected); xhr.send(form);
      });
      if (!accept.includes(data.type) && accept !== '*/*') throw new Error(`This field only accepts ${accept}.`);
      await new Promise<void>((resolve,reject) => {
        const media = data.type === 'image' ? new Image() : document.createElement('video');
        const timeout = setTimeout(() => { media.src = ''; reject(new Error('The uploaded media could not be verified. Retry or select it from the library.')); },15000);
        const done = () => { clearTimeout(timeout); resolve(); };
        media.onerror = () => { clearTimeout(timeout); reject(new Error('The uploaded media could not be loaded.')); };
        if (media instanceof HTMLVideoElement) media.onloadedmetadata = done; else media.onload = done;
        media.src = data.url;
      });
      if (current !== sequence.current) return;
      onChange(data.url); setLocal(''); setFile(null);
    } catch (e) { if (current === sequence.current) setError((e as Error).message); }
    finally { if (current === sequence.current) setProgress(null); }
  }
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
      <p className="text-xs font-semibold text-gray-800">{label}</p>
      <MediaPreview src={local || value} type={local && file?.type.startsWith('video/') ? 'video' : undefined} />
      {local && <p className="text-[11px] text-gray-500">Xem trước cục bộ · lựa chọn cũ được giữ lại cho đến khi tải xong.</p>}
      <div className="flex flex-wrap gap-1.5 items-center pt-1">
        <label className="inline-flex cursor-pointer rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors shadow-xs">
          Tải file lên
          <input
            aria-label={`Tải lên ${label}`}
            className="sr-only"
            type="file"
            accept={accept}
            disabled={progress !== null}
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) void upload(next);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs text-gray-700 font-medium transition-colors"
          disabled={progress !== null}
          onClick={() => setPicker(true)}
        >
          Chọn từ thư viện
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${showUrlInput ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'}`}
          onClick={() => setShowUrlInput(!showUrlInput)}
          title="Nhập trực tiếp URL hình ảnh/video từ internet"
        >
          🔗 Dán link URL
        </button>
        {(value || local) && (
          <button
            type="button"
            className="rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs text-rose-600 font-medium transition-colors ml-auto"
            onClick={() => {
              sequence.current++;
              xhrRef.current?.abort();
              onChange('');
              setLocal('');
              setFile(null);
              setCustomUrl('');
              setProgress(null);
            }}
            title="Xóa ảnh/video hiện tại"
          >
            🗑️ Xóa media
          </button>
        )}
      </div>

      {showUrlInput && (
        <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
          <label className="text-[11px] font-semibold text-blue-900 block">
            Dán đường dẫn URL trực tiếp (Online / CDN)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="https://... hoặc /api/media/..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (customUrl.trim()) {
                    onChange(customUrl.trim());
                  }
                }
              }}
              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-gray-800"
            />
            <button
              type="button"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
              onClick={() => {
                if (customUrl.trim()) {
                  onChange(customUrl.trim());
                }
              }}
            >
              Áp dụng
            </button>
          </div>
          <p className="text-[10px] text-blue-700">
            Hỗ trợ link ảnh, logo hoặc video từ bất kỳ website nào (vd: https://images.unsplash.com/...).
          </p>
        </div>
      )}
      {progress !== null && (
        <div role="status" className="space-y-1 pt-1">
          <progress max={100} value={progress} className="w-full h-1.5 accent-blue-600 rounded" />
          <div className="flex justify-between text-[11px] text-gray-500">
            <span>{progress === 100 ? 'Đang xác thực file…' : `Đang tải lên ${progress}%`}</span>
            <button
              type="button"
              className="text-rose-600 hover:underline"
              onClick={() => {
                sequence.current++;
                xhrRef.current?.abort();
                setProgress(null);
                setError('Đã hủy tải lên.');
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
          {error}{' '}
          {file && (
            <button type="button" className="underline font-medium ml-1" onClick={() => void upload(file)}>
              Thử lại
            </button>
          )}
        </div>
      )}
      {picker && (
        <MediaPicker
          accept={accept}
          onSelect={(url) => {
            onChange(url);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}
