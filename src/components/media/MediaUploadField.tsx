'use client';
import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Upload, Link2, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { MediaPreview } from './MediaPreview';
import { MediaPicker } from './MediaPicker';

export interface MediaUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  defaultFolderId?: string;
  alwaysShowUrlInput?: boolean;
}

export function MediaUploadField({
  label,
  value,
  onChange,
  accept = 'image/*,video/*',
  defaultFolderId,
  alwaysShowUrlInput = false,
}: MediaUploadFieldProps) {
  const { token } = useAuth();
  const [local, setLocal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(alwaysShowUrlInput);
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
    setFile(selected);
    setError('');
    const isVideo = selected.type.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(selected.name);
    const maxSize = isVideo ? 1024 * 1024 * 1024 : 50 * 1024 * 1024;
    if (selected.size > maxSize) {
      setError(isVideo ? 'Dung lượng video tối đa cho phép là 1GB.' : 'Dung lượng tối đa cho phép là 50MB.');
      return;
    }
    setLocal(URL.createObjectURL(selected));
    setProgress(0);
    try {
      const data = await new Promise<{ url: string; type: 'image' | 'video' }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', '/api/upload');
        xhr.withCredentials = true;
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (event) => {
          if (current === sequence.current && event.lengthComputable)
            setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () => reject(new Error('Tải file thất bại. Vui lòng kiểm tra kết nối mạng và thử lại.'));
        xhr.onabort = () => reject(new Error('Đã hủy tải file. Lựa chọn trước đó được giữ nguyên.'));
        xhr.onload = () => {
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status < 200 || xhr.status >= 300) throw new Error(result.error || 'Upload failed');
            resolve(result.data);
          } catch (e) {
            reject(e);
          }
        };
        const form = new FormData();
        form.append('file', selected);
        if (defaultFolderId) {
          form.append('folderId', defaultFolderId);
        }
        xhr.send(form);
      });
      if (!accept.includes(data.type) && accept !== '*/*')
        throw new Error(`Trường này chỉ nhận định dạng ${accept}.`);
      await new Promise<void>((resolve, reject) => {
        const media = data.type === 'image' ? new Image() : document.createElement('video');
        const timeout = setTimeout(() => {
          media.src = '';
          reject(new Error('Không thể xác thực file vừa tải lên. Vui lòng thử lại hoặc chọn từ thư viện.'));
        }, 60000);
        const done = () => {
          clearTimeout(timeout);
          resolve();
        };
        media.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Không thể nạp file media vừa tải lên.'));
        };
        if (media instanceof HTMLVideoElement) media.onloadedmetadata = done;
        else media.onload = done;
        media.src = data.url;
      });
      if (current !== sequence.current) return;
      onChange(data.url);
      setLocal('');
      setFile(null);
    } catch (e) {
      if (current === sequence.current) setError((e as Error).message);
    } finally {
      if (current === sequence.current) setProgress(null);
    }
  }

  return (
    <div className="cms-media-field space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <p className="text-xs font-semibold text-slate-800">{label}</p>
      <MediaPreview src={local || value} type={local && file?.type.startsWith('video/') ? 'video' : undefined} />
      {local && (
        <p className="text-[11px] text-slate-500">
          Xem trước cục bộ · lựa chọn cũ được giữ lại cho đến khi tải xong.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 items-center pt-1">
        <button
          type="button"
          className="rounded-lg border border-blue-600 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs text-white font-semibold transition-colors shadow-xs"
          disabled={progress !== null}
          onClick={() => setPicker(true)}
        >
          <FolderOpen className="mr-1.5 inline h-3.5 w-3.5" />Chọn từ thư viện
        </button>
        <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors">
          <Upload className="mr-1.5 inline h-3.5 w-3.5" />Tải file lên
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
        {!alwaysShowUrlInput && (
          <button
            type="button"
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showUrlInput
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            onClick={() => setShowUrlInput(!showUrlInput)}
            title="Nhập trực tiếp URL hình ảnh/video từ internet"
          >
            <Link2 className="mr-1.5 inline h-3.5 w-3.5" />Dán liên kết
          </button>
        )}
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
            <Trash2 className="mr-1.5 inline h-3.5 w-3.5" />Xóa media
          </button>
        )}
      </div>

      {(showUrlInput || alwaysShowUrlInput) && (
        <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
          <label className="text-[11px] font-semibold text-blue-900 block">
            Đường dẫn ảnh hoặc video
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="https://... hoặc /nxb-templates/... hoặc /api/media/..."
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
              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
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
            Hỗ trợ link ảnh trực tiếp từ internet (https://...) hoặc đường dẫn từ thư viện hệ thống.
          </p>
        </div>
      )}
      {progress !== null && (
        <div role="status" className="space-y-1 pt-1">
          <progress max={100} value={progress} className="w-full h-1.5 accent-blue-600 rounded" />
          <div className="flex justify-between text-[11px] text-slate-500">
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
          initialFolder={defaultFolderId}
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
