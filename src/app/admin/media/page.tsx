'use client';
import { useCallback, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { MediaLibrary, MediaUploadField } from '@/components/media';
import type { MediaFolderItem } from '@/components/media/MediaPicker';

export default function MediaPage() {
  const { canOperate } = useAuth();
  const [latest, setLatest] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [activeFolderName, setActiveFolderName] = useState<string>('Tất cả thư mục');

  const handleFolderChange = useCallback((folderId: string, folders: MediaFolderItem[]) => {
    setActiveFolderId(folderId);
    if (folderId === 'all') {
      setActiveFolderName('Tất cả thư mục');
    } else if (folderId === 'uncategorized') {
      setActiveFolderName('Chưa phân loại');
    } else {
      const match = folders.find((f) => f.id === folderId);
      setActiveFolderName(match ? match.name : folderId);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thư viện Tài nguyên & Media</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý hình ảnh, banner, bìa sách, logo và video theo từng Thư mục (Folder). Các tài nguyên đang được sử dụng trong mẫu Portal sẽ được bảo vệ khỏi thao tác xóa nhầm.
        </p>
      </div>
      {canOperate && (
        <MediaUploadField
          label={`Tải tài nguyên mới lên thư mục: ${activeFolderName} (Tối đa 50MB cho ảnh, 1GB cho video)`}
          value={latest}
          defaultFolderId={
            activeFolderId !== 'all' && activeFolderId !== 'uncategorized' ? activeFolderId : undefined
          }
          onChange={(url) => {
            setLatest(url);
            setRefresh((value) => value + 1);
          }}
        />
      )}
      <MediaLibrary
        refresh={refresh}
        allowDelete={canOperate}
        onFolderChange={handleFolderChange}
      />
    </div>
  );
}
