import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { listUploadedFiles, uploadFile, deleteFiles, isSafeMediaKey } from '@/lib/minio';
import { referencesMedia } from '@/lib/media';
import { validateMedia, MAX_MEDIA_SIZE } from '@/lib/media-validation';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getMediaFoldersConfig,
  resolveFileFolderId,
  createMediaFolder,
  renameMediaFolder,
  deleteMediaFolder,
  assignMediaToFolder,
  isValidFolderId,
  MediaFolderWithCount,
} from '@/lib/media-folders';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function usageSources() {
  const [drafts, revisions] = await Promise.all([
    prisma.template.findMany({ select: { id: true, name: true, layoutJson: true, thumbnail: true } }),
    prisma.templateRevision.findMany({ select: { id: true, templateId: true, layoutJson: true } }),
  ]);
  return [
    ...drafts.map((item) => ({ ...item, kind: 'draft' })),
    ...revisions.map((item) => ({ ...item, name: `Published revision · ${item.templateId}`, kind: 'revision' })),
  ];
}

async function handleGET(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [files, sources, foldersConfig] = await Promise.all([
      listUploadedFiles(),
      usageSources(),
      getMediaFoldersConfig(),
    ]);

    const folderMap = new Map(foldersConfig.folders.map((f) => [f.id, f]));
    const folderCounts = new Map<string, number>();
    for (const f of foldersConfig.folders) {
      folderCounts.set(f.id, 0);
    }

    let uncategorizedCount = 0;

    const type = req.nextUrl.searchParams.get('type');
    const search = (req.nextUrl.searchParams.get('q') || '').toLowerCase();
    const folderFilter = req.nextUrl.searchParams.get('folder') || 'all';

    // First filter by type & search so folder counts reflect active type/search filter
    const typeAndSearchFiltered = files
      .map((file) => {
        const folderId = resolveFileFolderId(file.key, foldersConfig);
        const folderName = folderId ? folderMap.get(folderId)?.name || null : null;
        return { ...file, folderId, folderName };
      })
      .filter(
        (file) =>
          (!type || type === 'all' || file.type === type) &&
          (file.name.toLowerCase().includes(search) ||
            (file.folderName && file.folderName.toLowerCase().includes(search)))
      );

    for (const file of typeAndSearchFiltered) {
      if (file.folderId && folderCounts.has(file.folderId)) {
        folderCounts.set(file.folderId, (folderCounts.get(file.folderId) || 0) + 1);
      } else {
        uncategorizedCount++;
      }
    }

    const filtered = typeAndSearchFiltered.filter((file) => {
      if (!folderFilter || folderFilter === 'all') return true;
      if (folderFilter === 'uncategorized') return !file.folderId;
      return file.folderId === folderFilter;
    });

    const folders: MediaFolderWithCount[] = foldersConfig.folders.map((f) => ({
      ...f,
      count: folderCounts.get(f.id) || 0,
    }));

    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 24));
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
    const data = filtered.slice((page - 1) * limit, page * limit).map((file) => ({
      ...file,
      usage: sources
        .filter((source) => referencesMedia(source, file.key))
        .map(({ id, name, kind }) => ({ id, name, kind })),
    }));

    return NextResponse.json({
      success: true,
      data,
      total: filtered.length,
      totalAll: typeAndSearchFiltered.length,
      uncategorizedCount,
      folders,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: 'Cannot load media list' }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (Number(req.headers.get('content-length')) > MAX_MEDIA_SIZE + 20 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 1GB)' }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    const rawFolderId = form.get('folderId');
    const folderId =
      typeof rawFolderId === 'string' &&
      rawFolderId.trim() &&
      rawFolderId !== 'all' &&
      rawFolderId !== 'uncategorized' &&
      isValidFolderId(rawFolderId.trim())
        ? rawFolderId.trim()
        : null;

    if (!(file instanceof File) || file.size > MAX_MEDIA_SIZE)
      return NextResponse.json({ error: 'Vui lòng chọn tệp tối đa 1GB cho video hoặc 50MB cho hình ảnh' }, { status: 400 });
    let media;
    try {
      media = await validateMedia(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    const name =
      file.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .slice(0, 60) || 'file';
    const prefix = media.type === 'image' ? 'images' : 'videos';
    const datePath = new Date().toISOString().slice(0, 10).replaceAll('-', '/');
    const key = folderId
      ? `${prefix}/${folderId}/${datePath}/${randomUUID()}-${name}.${media.extension}`
      : `${prefix}/${datePath}/${randomUUID()}-${name}.${media.extension}`;

    const url = await uploadFile(media.buffer, key, media.contentType);
    if (folderId) {
      await assignMediaToFolder([key], folderId);
    }

    return NextResponse.json({
      success: true,
      data: {
        url,
        key,
        type: media.type,
        name: file.name,
        size: media.buffer.length,
        folderId,
        lastModified: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

async function handlePUT(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === 'create_folder') {
      const { folder, config } = await createMediaFolder(String(body?.name || ''));
      return NextResponse.json({ success: true, folder, folders: config.folders });
    }

    if (action === 'rename_folder') {
      const config = await renameMediaFolder(String(body?.folderId || ''), String(body?.name || ''));
      return NextResponse.json({ success: true, folders: config.folders });
    }

    if (action === 'delete_folder') {
      const config = await deleteMediaFolder(String(body?.folderId || ''));
      return NextResponse.json({ success: true, folders: config.folders });
    }

    if (action === 'move_files') {
      const keys = Array.isArray(body?.keys) ? body.keys.filter((k: unknown): k is string => typeof k === 'string') : [];
      if (!keys.length || keys.length > 200 || !keys.every(isSafeMediaKey)) {
        return NextResponse.json({ error: 'Danh sách file không hợp lệ' }, { status: 400 });
      }
      const targetFolderId =
        typeof body?.folderId === 'string' && body.folderId.trim() && body.folderId !== 'uncategorized'
          ? body.folderId.trim()
          : null;
      const config = await assignMediaToFolder(keys, targetFolderId);
      return NextResponse.json({ success: true, moved: keys.length, folders: config.folders });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Folder operation failed' }, { status: 400 });
  }
}

async function handleDELETE(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { keys } = await req.json();
    if (!Array.isArray(keys) || !keys.length || keys.length > 100 || !keys.every(isSafeMediaKey))
      return NextResponse.json({ error: 'Invalid media keys' }, { status: 400 });
    const sources = await usageSources();
    const used = keys.filter((key) => sources.some((source) => referencesMedia(source, key)));
    if (used.length)
      return NextResponse.json(
        { error: 'Media is used by a template draft or published revision', keys: used },
        { status: 409 }
      );
    await deleteFiles(keys);
    return NextResponse.json({ success: true, deleted: keys.length });
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', handlePOST);
export const PUT = withPermission('operate', handlePUT);
export const DELETE = withPermission('operate', handleDELETE);
