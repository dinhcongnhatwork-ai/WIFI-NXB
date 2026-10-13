import { NextRequest, NextResponse } from 'next/server';
import { listUploadedFiles, uploadFile, deleteFiles, isSafeMediaKey } from '@/lib/minio';
import { referencesMedia } from '@/lib/media';
import { validateMedia, MAX_MEDIA_SIZE } from '@/lib/media-validation';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function usageSources() {
  const [drafts, revisions] = await Promise.all([
    prisma.template.findMany({ select: { id: true, name: true, layoutJson: true, thumbnail: true } }),
    prisma.templateRevision.findMany({ select: { id: true, templateId: true, layoutJson: true } }),
  ]);
  return [...drafts.map(item => ({ ...item, kind: 'draft' })), ...revisions.map(item => ({ ...item, name: `Published revision · ${item.templateId}`, kind: 'revision' }))];
}
export async function GET(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [files, sources] = await Promise.all([listUploadedFiles(), usageSources()]);
    const type = req.nextUrl.searchParams.get('type');
    const search = (req.nextUrl.searchParams.get('q') || '').toLowerCase();
    const filtered = files.filter(file => (!type || type === 'all' || file.type === type) && file.name.toLowerCase().includes(search));
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 24));
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
    const data = filtered.slice((page-1)*limit, page*limit).map(file => ({ ...file, usage: sources.filter(source => referencesMedia(source, file.key)).map(({ id,name,kind }) => ({ id,name,kind })) }));
    return NextResponse.json({ success: true, data, total: filtered.length, page, limit });
  } catch { return NextResponse.json({ error: 'Cannot load media list' }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (Number(req.headers.get('content-length')) > MAX_MEDIA_SIZE + 1024 * 1024) return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size > MAX_MEDIA_SIZE) return NextResponse.json({ error: 'Provide a file up to 50MB' }, { status: 400 });
    let media;
    try { media = await validateMedia(Buffer.from(await file.arrayBuffer())); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0,60) || 'file';
    const key = `${media.type === 'image' ? 'images' : 'videos'}/${new Date().toISOString().slice(0,10).replaceAll('-','/')}/${randomUUID()}-${name}.${media.extension}`;
    const url = await uploadFile(media.buffer, key, media.contentType);
    // Replacement is an editor operation: never delete the previous asset here.
    return NextResponse.json({ success: true, data: { url, key, type: media.type, name: file.name, size: media.buffer.length, lastModified: new Date().toISOString() } });
  } catch { return NextResponse.json({ error: 'Upload failed' }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { keys } = await req.json();
    if (!Array.isArray(keys) || !keys.length || keys.length > 100 || !keys.every(isSafeMediaKey)) return NextResponse.json({ error: 'Invalid media keys' }, { status: 400 });
    const sources = await usageSources();
    const used = keys.filter(key => sources.some(source => referencesMedia(source,key)));
    if (used.length) return NextResponse.json({ error: 'Media is used by a template draft or published revision', keys: used }, { status: 409 });
    await deleteFiles(keys);
    return NextResponse.json({ success: true, deleted: keys.length });
  } catch { return NextResponse.json({ error: 'Delete failed' }, { status: 500 }); }
}
