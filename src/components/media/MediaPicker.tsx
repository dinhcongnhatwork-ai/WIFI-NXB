'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Film,
  Folder,
  FolderOpen,
  FolderPlus,
  ImageIcon,
  Link2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface MediaFolderItem {
  id: string;
  name: string;
  createdAt: string;
  isSystem?: boolean;
  count: number;
}

export interface MediaItem {
  key: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  size: number;
  lastModified: string | null;
  folderId?: string | null;
  folderName?: string | null;
  usage?: { id: string; name: string; kind: string }[];
}

export function MediaLibrary({
  onSelect,
  onSelectMany,
  accept = 'image/*,video/*',
  refresh = 0,
  allowDelete = false,
  initialFolder = 'all',
  onFolderChange,
}: {
  onSelect?: (url: string, item?: MediaItem) => void;
  onSelectMany?: (items: MediaItem[]) => void;
  accept?: string;
  refresh?: number;
  allowDelete?: boolean;
  initialFolder?: string;
  onFolderChange?: (folderId: string, folders: MediaFolderItem[]) => void;
}) {
  const { token, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>(initialFolder || 'all');
  const [totalAll, setTotalAll] = useState(0);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timer); }, [search]);
  const folderChange = useRef(onFolderChange); folderChange.current = onFolderChange;
  const [type, setType] = useState(
    accept.startsWith('image') && !accept.includes('video')
      ? 'image'
      : accept.startsWith('video') && !accept.includes('image')
      ? 'video'
      : 'all'
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Keyboard navigation for preview modal
  useEffect(() => {
    if (!previewItem) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPreviewItem(null);
      } else if (e.key === 'ArrowLeft') {
        const idx = items.findIndex((x) => x.key === previewItem?.key);
        if (idx > 0) setPreviewItem(items[idx - 1]);
      } else if (e.key === 'ArrowRight') {
        const idx = items.findIndex((x) => x.key === previewItem?.key);
        if (idx >= 0 && idx < items.length - 1) setPreviewItem(items[idx + 1]);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem, items]);

  function copyToClipboard(url: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      });
    }
  }

  // Folder creation & editing state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [uploadingInFolder, setUploadingInFolder] = useState(false);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  // The shared transport reads the latest session on every request, including retries.
  const headers = useCallback((): Record<string, string> => ({}), []);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    authenticatedFetch(
      `/api/upload?${new URLSearchParams({
        q: query,
        type,
        folder: activeFolder,
        page: String(page),
        limit: '24',
      })}`,
      { headers: headers(), signal: controller.signal }
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || (response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Không tải được thư viện. Vui lòng thử lại.'));
        if (controller.signal.aborted) return;
        setItems(body.data || []);
        setTotal(body.total || 0);
        if (Array.isArray(body.folders)) {
          setFolders(body.folders);
          folderChange.current?.(activeFolder, body.folders);
        }
        if (typeof body.totalAll === 'number') setTotalAll(body.totalAll);
        if (typeof body.uncategorizedCount === 'number') setUncategorizedCount(body.uncategorizedCount);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== 'AbortError') { setItems([]); setError(e.message); }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, authLoading, query, type, activeFolder, page, refresh, version, headers]);

  async function handleCreateFolder() {
    const clean = newFolderName.trim();
    if (!clean) return;
    setError('');
    try {
      const response = await authenticatedFetch('/api/upload', {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_folder', name: clean }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể tạo thư mục');
      setNewFolderName('');
      setCreatingFolder(false);
      if (body.folder?.id) {
        setActiveFolder(body.folder.id);
        setPage(1);
      }
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo thư mục');
    }
  }

  async function handleRenameFolder(folderId: string) {
    const clean = renameFolderValue.trim();
    if (!clean) return;
    setError('');
    try {
      const response = await authenticatedFetch('/api/upload', {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename_folder', folderId, name: clean }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể đổi tên thư mục');
      setRenamingFolderId(null);
      setRenameFolderValue('');
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đổi tên thư mục');
    }
  }

  async function handleDeleteFolder(folderObj: MediaFolderItem) {
    if (
      !confirm(
        `Xóa thư mục “${folderObj.name}”? (Các file bên trong sẽ không bị mất mà chuyển về mục Chưa phân loại)`
      )
    )
      return;
    setError('');
    try {
      const response = await authenticatedFetch('/api/upload', {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_folder', folderId: folderObj.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể xóa thư mục');
      setActiveFolder('all');
      setPage(1);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xóa thư mục');
    }
  }

  async function handleMoveFile(keys: string[], targetFolderId: string) {
    if (!keys.length) return;
    setError('');
    try {
      const response = await authenticatedFetch('/api/upload', {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_files',
          keys,
          folderId: targetFolderId === 'uncategorized' ? null : targetFolderId,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể chuyển thư mục');
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể chuyển thư mục');
    }
  }

  async function handleUploadToCurrentFolder(fileList: FileList | null) {
    if (!fileList || !fileList.length || uploadingInFolder) return;
    setUploadingInFolder(true);
    setError('');
    try {
      for (const file of Array.from(fileList)) {
        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(file.name);
        const maxSize = isVideo ? 1024 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(`Tệp "${file.name}" vượt quá dung lượng cho phép (${isVideo ? 'Tối đa 1GB cho video' : 'Tối đa 50MB cho ảnh'}).`);
        }
        const form = new FormData();
        form.append('file', file);
        if (activeFolder !== 'all' && activeFolder !== 'uncategorized') {
          form.append('folderId', activeFolder);
        }
        const response = await authenticatedFetch('/api/upload', {
          method: 'POST',
          headers: headers(),
          body: form,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Tải file thất bại');
        setVersion((v) => v + 1);
      }

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải file thất bại');
    } finally {
      setUploadingInFolder(false);
      if (folderUploadInputRef.current) folderUploadInputRef.current.value = '';
    }
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Xóa media “${item.name}”?`)) return;
    try {
      const response = await authenticatedFetch('/api/upload', {
        method: 'DELETE',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [item.key] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xóa media.');
    }
  }

  function choose(item: MediaItem) {
    if (onSelectMany)
      setSelected((previous) =>
        previous.some((x) => x.key === item.key)
          ? previous.filter((x) => x.key !== item.key)
          : [...previous, item]
      );
    else onSelect?.(item.url, item);
  }

  const currentFolderObj = folders.find((f) => f.id === activeFolder);

  return (
    <div className="cms-media-library space-y-3">
      {/* Quản lý Thư mục (Folder Navigation & Actions) */}
      <div className="cms-media-folders rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
            <span>Thư mục tài nguyên ({folders.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={folderUploadInputRef}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={(e) => void handleUploadToCurrentFolder(e.target.files)}
            />
            <button
              type="button"
              disabled={uploadingInFolder}
              onClick={() => folderUploadInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              title="Tải file mới trực tiếp vào thư mục đang mở"
            >
              <Upload className="h-3 w-3" />
              {uploadingInFolder
                ? 'Đang tải...'
                : currentFolderObj
                ? `Tải vào "${currentFolderObj.name}"`
                : 'Tải file lên'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingFolder((prev) => !prev);
                setNewFolderName('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <FolderPlus className="h-3 w-3 text-amber-600" />
              Tạo thư mục
            </button>
          </div>
        </div>

        {/* Form tạo thư mục mới */}
        {creatingFolder && (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2">
            <Folder className="h-4 w-4 shrink-0 text-amber-600" />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setCreatingFolder(false);
                }
              }}
              placeholder="Nhập tên thư mục mới (VD: Sự kiện 2026, Bìa sách mới...)"
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleCreateFolder()}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Tạo
            </button>
            <button
              type="button"
              onClick={() => setCreatingFolder(false)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Danh sách các Folder dạng Pills */}
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveFolder('all');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
              activeFolder === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
            <span>Tất cả</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeFolder === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalAll}
            </span>
          </button>

          {folders.map((folder) => {
            const isActive = activeFolder === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  setActiveFolder(folder.id);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/40'
                }`}
              >
                <Folder
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? 'text-amber-300' : 'text-amber-500'
                  }`}
                />
                <span className="truncate max-w-[150px]">{folder.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {folder.count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setActiveFolder('uncategorized');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
              activeFolder === 'uncategorized'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'border border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span>Chưa phân loại</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeFolder === 'uncategorized'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {uncategorizedCount}
            </span>
          </button>
        </div>

        {/* Thanh thao tác với Folder đang chọn (Đổi tên / Xóa folder) */}
        {currentFolderObj && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 text-xs">
            {renamingFolderId === currentFolderObj.id ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  type="text"
                  value={renameFolderValue}
                  onChange={(e) => setRenameFolderValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRenameFolder(currentFolderObj.id);
                    } else if (e.key === 'Escape') {
                      setRenamingFolderId(null);
                    }
                  }}
                  className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-2 py-1 text-xs"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleRenameFolder(currentFolderObj.id)}
                  className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingFolderId(null)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
                  <span>
                    Đang xem: <strong className="text-slate-900">{currentFolderObj.name}</strong> (
                    {currentFolderObj.count} tài nguyên)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingFolderId(currentFolderObj.id);
                      setRenameFolderValue(currentFolderObj.name);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <Edit3 className="h-3 w-3" />
                    Đổi tên
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteFolder(currentFolderObj)}
                    className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Xóa thư mục
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Thanh tìm kiếm & lọc định dạng */}
      <div className="flex gap-2">
        <input
          aria-label="Tìm media"
          placeholder="Tìm ảnh, video hoặc tên thư mục…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Loại media"
          className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          {accept.includes('image') && accept.includes('video') && (
            <option value="all">Tất cả</option>
          )}
          {accept.includes('image') && <option value="image">Ảnh</option>}
          {accept.includes('video') && <option value="video">Video</option>}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
          <button type="button" aria-label="Thử lại tải thư viện" onClick={() => setVersion(v => v + 1)} className="mt-2 block rounded border border-rose-300 bg-white px-3 py-1 font-medium">Thử lại</button>
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Đang tải media" className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="aspect-square rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : !error && !items.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>Chưa có tài nguyên nào trong thư mục này.</p>
          <button
            type="button"
            onClick={() => folderUploadInputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Upload className="h-3.5 w-3.5" />
            Tải file vào thư mục này
          </button>
        </div>
      ) : null}

      {/* Lưới hiển thị Media */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
      >
        {!loading && !error &&
          items.map((item) => {
            const checked = selected.some((x) => x.key === item.key);
            return (
              <div
                key={item.key}
                className={`group relative flex flex-col overflow-hidden rounded-xl bg-white transition-all ${
                  checked
                    ? 'ring-2 ring-blue-600 shadow-sm'
                    : 'ring-1 ring-slate-200 hover:ring-blue-400 hover:shadow-sm'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  title={!onSelect && !onSelectMany ? `Nhấn để xem trước: ${item.name}` : `Nhấn để chọn: ${item.name}`}
                  aria-label={`${onSelect || onSelectMany ? 'Chọn' : 'Xem trước'} ${item.type === 'image' ? 'ảnh' : 'video'} ${item.name}`}
                  aria-pressed={onSelectMany ? checked : undefined}
                  className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 group"
                  onClick={() => {
                    if (onSelect || onSelectMany) {
                      choose(item);
                    } else {
                      setPreviewItem(item);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onSelect || onSelectMany) choose(item);
                      else setPreviewItem(item);
                    }
                  }}
                >
                  {item.type === 'image' ? (
                    <img
                      loading="lazy"
                      src={item.url}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <>
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <Film className="absolute bottom-2 left-2 h-5 w-5 rounded bg-slate-900/70 p-0.5 text-white shadow-xs" />
                    </>
                  )}
                  {checked && (
                    <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-blue-600 p-0.5 text-white shadow-xs z-10" />
                  )}

                  {/* Overlay khi rê chuột */}
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {onSelect || onSelectMany ? (
                      <div className="flex items-center gap-1.5 px-2">
                        <span className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-blue-700">
                          Chọn
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewItem(item);
                          }}
                          className="rounded-md bg-white/90 p-1 text-slate-800 shadow-xs hover:bg-white"
                          title="Xem trước phóng to"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-xs">
                        <Eye className="h-3.5 w-3.5" />
                        Xem trước
                      </span>
                    )}
                  </div>
                </div>

                {/* Chân thẻ: Tên file + Chuyển thư mục + Xóa */}
                <div className="flex flex-col gap-1 border-t border-slate-100 bg-white p-1.5">
                  <div className="truncate text-[10px] font-medium text-slate-700" title={item.name}>
                    {item.name}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <select
                      aria-label={`Chuyển thư mục cho ${item.name}`}
                      value={item.folderId || 'uncategorized'}
                      onChange={(e) => void handleMoveFile([item.key], e.target.value)}
                      className="min-w-0 flex-1 truncate rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 focus:border-blue-500 focus:outline-none"
                      title="Chuyển file sang thư mục khác"
                    >
                      <option value="uncategorized">📂 Chưa phân loại</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name}
                        </option>
                      ))}
                    </select>
                    {allowDelete && (
                      <button
                        type="button"
                        aria-label={`Xóa ${item.name}`}
                        title={
                          item.usage?.length
                            ? `Đang dùng trong: ${item.usage.map((u) => u.name).join(', ')}`
                            : 'Xóa media'
                        }
                        disabled={!!item.usage?.length}
                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-35"
                        onClick={() => void remove(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {onSelectMany && (
        <button
          type="button"
          disabled={!selected.length}
          className="sticky bottom-0 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          onClick={() => {
            onSelectMany(selected);
            setSelected([]);
          }}
        >
          Thêm {selected.length || ''} ảnh vào slider
        </button>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <button
          type="button"
          disabled={page <= 1}
          className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
          onClick={() => setPage((p) => p - 1)}
        >
          ← Trước
        </button>
        <span>
          Trang {page} / {Math.max(1, Math.ceil(total / 24))} ({total} file)
        </span>
        <button
          type="button"
          disabled={page * 24 >= total}
          className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
          onClick={() => setPage((p) => p + 1)}
        >
          Sau →
        </button>
      </div>

      {/* Lightbox / Modal xem trước ảnh & video */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Xem trước ${previewItem.name}`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                {previewItem.type === 'video' ? (
                  <Film className="h-5 w-5 shrink-0 text-amber-400" />
                ) : (
                  <ImageIcon className="h-5 w-5 shrink-0 text-blue-400" />
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-100" title={previewItem.name}>
                    {previewItem.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="rounded bg-slate-800 px-1.5 py-0.2 uppercase font-mono">
                      {previewItem.type}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(previewItem.size)}</span>
                    {previewItem.folderName && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400">📁 {previewItem.folderName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons on top right */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(previewItem.url)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                  title="Sao chép đường dẫn trực tiếp"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{copiedUrl ? 'Đã sao chép!' : 'Sao chép link'}</span>
                </button>
                <a
                  href={previewItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={previewItem.url}
                  download={previewItem.name}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                  title="Tải về máy"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:bg-rose-950 hover:border-rose-800 hover:text-rose-300 transition-colors"
                  title="Đóng (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Center Media Display + Prev/Next buttons */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/60 p-2 sm:p-4 min-h-[300px] max-h-[68vh]">
              {/* Prev button */}
              {items.findIndex((x) => x.key === previewItem.key) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = items.findIndex((x) => x.key === previewItem.key);
                    if (idx > 0) setPreviewItem(items[idx - 1]);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-slate-900/80 p-2 text-white hover:bg-slate-800 border border-slate-700/80 shadow-lg transition-transform hover:scale-110"
                  title="Phím mũi tên Trái (←)"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {/* Media Element */}
              {previewItem.type === 'video' ? (
                <video
                  key={previewItem.url}
                  src={previewItem.url}
                  controls
                  autoPlay
                  preload="auto"
                  className="max-h-[64vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                />
              ) : (
                <img
                  key={previewItem.url}
                  src={previewItem.url}
                  alt={previewItem.name}
                  className="max-h-[64vh] w-auto max-w-full rounded-lg object-contain shadow-2xl transition-all"
                />
              )}

              {/* Next button */}
              {items.findIndex((x) => x.key === previewItem.key) < items.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = items.findIndex((x) => x.key === previewItem.key);
                    if (idx >= 0 && idx < items.length - 1) setPreviewItem(items[idx + 1]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-slate-900/80 p-2 text-white hover:bg-slate-800 border border-slate-700/80 shadow-lg transition-transform hover:scale-110"
                  title="Phím mũi tên Phải (→)"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Modal Footer: Metadata & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Ngày cập nhật:{' '}
                  <strong className="text-slate-100">
                    {previewItem.lastModified
                      ? new Date(previewItem.lastModified).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '---'}
                  </strong>
                </span>
                {previewItem.usage && previewItem.usage.length > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400 border border-amber-500/20">
                    Đang dùng trong {previewItem.usage.length} mẫu Portal
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {allowDelete && (
                  <button
                    type="button"
                    disabled={!!previewItem.usage?.length}
                    onClick={() => {
                      const toDel = previewItem;
                      setPreviewItem(null);
                      void remove(toDel);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/60 transition-colors disabled:opacity-35"
                    title={previewItem.usage?.length ? 'Tài nguyên đang được sử dụng trong mẫu Portal' : 'Xóa tài nguyên này'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa tài nguyên</span>
                  </button>
                )}

                {onSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      choose(previewItem);
                      setPreviewItem(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Chọn tài nguyên này</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaPicker({
  onSelect,
  onClose,
  accept,
  onSelectMany,
  initialFolder,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
  accept?: string;
  onSelectMany?: (items: MediaItem[]) => void;
  initialFolder?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [directUrl, setDirectUrl] = useState('');

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, select, [tabindex="0"]'
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, [onClose]);

  const applyDirectUrl = () => {
    const trimmed = directUrl.trim();
    if (!trimmed) return;
    onSelect(trimmed);
    onClose();
  };

  return (
    <div
      ref={dialog}
      className="fixed inset-0 z-50 overflow-auto bg-slate-950/50 p-4 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Chọn media"
    >
      <div className="mx-auto max-w-5xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Thư viện Tài nguyên & Media</h2>
            <p className="text-xs text-slate-500">
              Chọn tài nguyên theo Thư mục (Folder), tải file mới lên thư mục hoặc dán trực tiếp Link URL ảnh
            </p>
          </div>
          <button
            autoFocus
            type="button"
            aria-label="Đóng thư viện"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ô dán nhanh Link URL trực tiếp ngay trong hộp thoại Thư viện */}
        {!onSelectMany && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 shrink-0">
              <Link2 className="h-4 w-4 text-blue-600" />
              <span>Dán Link URL ảnh trực tiếp:</span>
            </div>
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyDirectUrl();
                }
              }}
              placeholder="https://... hoặc /nxb-templates/..."
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={!directUrl.trim()}
              onClick={applyDirectUrl}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Sử dụng Link URL này
            </button>
          </div>
        )}

        <MediaLibrary
          onSelect={(url) => {
            onSelect(url);
            onClose();
          }}
          onSelectMany={onSelectMany}
          accept={accept}
          initialFolder={initialFolder}
        />
      </div>
    </div>
  );
}
