import { prisma } from '@/lib/prisma';

export interface MediaFolder {
  id: string;
  name: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface MediaFolderWithCount extends MediaFolder {
  count: number;
}

export interface MediaFoldersConfig {
  folders: MediaFolder[];
  assignments: Record<string, string>;
  deletedDefaultIds?: string[];
}

export const MEDIA_FOLDERS_SETTING_KEY = 'media_folders_v1';

export const DEFAULT_MEDIA_FOLDERS: MediaFolder[] = [
  {
    id: 'logo-thuong-hieu',
    name: 'Logo & Nhận diện NXB',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'anh-nen-portal',
    name: 'Ảnh nền & Banner Portal',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'van-hoa-doc',
    name: 'Mẫu 1 · Văn hóa đọc & Nhà sách',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'xuat-ban-so',
    name: 'Mẫu 2 · Sách điện tử Stbook.vn',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'hoi-nghi',
    name: 'Mẫu 3 · Hội nghị & Tọa đàm',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'trien-lam',
    name: 'Mẫu 4 · Triển lãm & Ngày Sách',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'ly-luan-chinh-tri',
    name: 'Mẫu 5 · Nghiên cứu Lý luận',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSystem: true,
  },
];

let memoryConfigFallback: MediaFoldersConfig = {
  folders: [...DEFAULT_MEDIA_FOLDERS],
  assignments: {},
  deletedDefaultIds: [],
};

export function slugifyFolderId(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'thu-muc';
}

export function isValidFolderId(folderId: string): boolean {
  return /^[a-z0-9][a-z0-9-_]{0,48}$/.test(folderId);
}

function normalizeConfig(raw: unknown): MediaFoldersConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Partial<MediaFoldersConfig>) : {};
  const deletedDefaultIds = Array.isArray(obj.deletedDefaultIds)
    ? obj.deletedDefaultIds.filter((x): x is string => typeof x === 'string')
    : [];
  const rawFolders = Array.isArray(obj.folders) ? obj.folders : [];
  const folderMap = new Map<string, MediaFolder>();

  for (const def of DEFAULT_MEDIA_FOLDERS) {
    if (!deletedDefaultIds.includes(def.id)) {
      folderMap.set(def.id, { ...def });
    }
  }

  for (const item of rawFolders) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      item.id.trim() &&
      item.name.trim()
    ) {
      folderMap.set(item.id, {
        id: item.id.trim(),
        name: item.name.trim(),
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        isSystem: Boolean(item.isSystem),
      });
    }
  }

  const assignments: Record<string, string> = {};
  if (obj.assignments && typeof obj.assignments === 'object') {
    for (const [k, v] of Object.entries(obj.assignments)) {
      if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
        assignments[k] = v.trim();
      }
    }
  }

  return {
    folders: Array.from(folderMap.values()),
    assignments,
    deletedDefaultIds,
  };
}

export async function getMediaFoldersConfig(): Promise<MediaFoldersConfig> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: MEDIA_FOLDERS_SETTING_KEY },
    });
    if (!setting) {
      return normalizeConfig(memoryConfigFallback);
    }
    const config = normalizeConfig(setting.value);
    memoryConfigFallback = config;
    return config;
  } catch {
    return normalizeConfig(memoryConfigFallback);
  }
}

export async function saveMediaFoldersConfig(config: MediaFoldersConfig): Promise<MediaFoldersConfig> {
  const normalized = normalizeConfig(config);
  memoryConfigFallback = normalized;
  try {
    await prisma.systemSetting.upsert({
      where: { key: MEDIA_FOLDERS_SETTING_KEY },
      update: { value: normalized as unknown as object },
      create: { key: MEDIA_FOLDERS_SETTING_KEY, value: normalized as unknown as object },
    });
  } catch {
    // Fallback to in-memory if DB is unreachable in isolated unit test
  }
  return normalized;
}

export function resolveFileFolderId(
  key: string,
  config: MediaFoldersConfig
): string | null {
  const folderIds = new Set(config.folders.map((f) => f.id));
  const explicit = config.assignments[key];
  if (explicit === '__uncategorized__') return null;
  if (explicit && folderIds.has(explicit)) return explicit;

  // Check if key is structured like images/<folderId>/... or videos/<folderId>/...
  const parts = key.split('/');
  if (parts.length >= 3 && (parts[0] === 'images' || parts[0] === 'videos')) {
    const candidateFolder = parts[1];
    if (folderIds.has(candidateFolder)) {
      return candidateFolder;
    }
  }

  // Check filename patterns for NXB assets
  const fileName = (parts[parts.length - 1] || '').toLowerCase();
  if (fileName.includes('logo-nxb') || fileName.includes('logo-su-that')) {
    if (folderIds.has('logo-thuong-hieu')) return 'logo-thuong-hieu';
  }
  if (fileName.includes('-bg.') || fileName.includes('bg-portal') || fileName.includes('banner-nxb')) {
    if (folderIds.has('anh-nen-portal')) return 'anh-nen-portal';
  }
  if (fileName.includes('van-hoa-doc')) {
    if (folderIds.has('van-hoa-doc')) return 'van-hoa-doc';
  }
  if (fileName.includes('xuat-ban-so') || fileName.includes('stbook')) {
    if (folderIds.has('xuat-ban-so')) return 'xuat-ban-so';
  }
  if (fileName.includes('hoi-nghi')) {
    if (folderIds.has('hoi-nghi')) return 'hoi-nghi';
  }
  if (fileName.includes('trien-lam')) {
    if (folderIds.has('trien-lam')) return 'trien-lam';
  }
  if (fileName.includes('ly-luan')) {
    if (folderIds.has('ly-luan-chinh-tri')) return 'ly-luan-chinh-tri';
  }

  return null;
}

export async function createMediaFolder(name: string): Promise<{ folder: MediaFolder; config: MediaFoldersConfig }> {
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) {
    throw new Error('Tên thư mục không được để trống');
  }
  const config = await getMediaFoldersConfig();
  const existingName = config.folders.find(
    (f) => f.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingName) {
    throw new Error('Thư mục có tên này đã tồn tại');
  }

  let candidateId = slugifyFolderId(cleanName);
  const existingIds = new Set(config.folders.map((f) => f.id));
  let suffix = 2;
  while (existingIds.has(candidateId) || candidateId === 'all' || candidateId === 'uncategorized') {
    candidateId = `${slugifyFolderId(cleanName)}-${suffix}`;
    suffix++;
  }

  const folder: MediaFolder = {
    id: candidateId,
    name: cleanName,
    createdAt: new Date().toISOString(),
    isSystem: false,
  };

  config.folders.push(folder);
  const saved = await saveMediaFoldersConfig(config);
  return { folder, config: saved };
}

export async function renameMediaFolder(folderId: string, newName: string): Promise<MediaFoldersConfig> {
  const cleanName = newName.trim().slice(0, 60);
  if (!cleanName) {
    throw new Error('Tên thư mục không được để trống');
  }
  const config = await getMediaFoldersConfig();
  const folder = config.folders.find((f) => f.id === folderId);
  if (!folder) {
    throw new Error('Không tìm thấy thư mục');
  }
  const duplicate = config.folders.find(
    (f) => f.id !== folderId && f.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error('Tên thư mục đã tồn tại');
  }
  folder.name = cleanName;
  return saveMediaFoldersConfig(config);
}

export async function deleteMediaFolder(folderId: string): Promise<MediaFoldersConfig> {
  const config = await getMediaFoldersConfig();
  const index = config.folders.findIndex((f) => f.id === folderId);
  if (index === -1) {
    throw new Error('Không tìm thấy thư mục');
  }
  config.folders.splice(index, 1);
  if (DEFAULT_MEDIA_FOLDERS.some((d) => d.id === folderId)) {
    const deleted = new Set(config.deletedDefaultIds || []);
    deleted.add(folderId);
    config.deletedDefaultIds = Array.from(deleted);
  }
  for (const [key, assignedFolder] of Object.entries(config.assignments)) {
    if (assignedFolder === folderId) {
      config.assignments[key] = '__uncategorized__';
    }
  }
  return saveMediaFoldersConfig(config);
}

export async function assignMediaToFolder(
  keys: string[],
  folderId: string | null
): Promise<MediaFoldersConfig> {
  const config = await getMediaFoldersConfig();
  if (folderId && folderId !== '__uncategorized__') {
    const exists = config.folders.some((f) => f.id === folderId);
    if (!exists) {
      throw new Error('Thư mục đích không tồn tại');
    }
  }
  for (const key of keys) {
    if (!key) continue;
    if (!folderId || folderId === '__uncategorized__') {
      config.assignments[key] = '__uncategorized__';
    } else {
      config.assignments[key] = folderId;
    }
  }
  return saveMediaFoldersConfig(config);
}

