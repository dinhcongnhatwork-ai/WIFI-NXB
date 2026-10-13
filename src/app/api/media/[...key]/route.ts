import { NextRequest } from 'next/server';
import { BUCKET, s3Client, GetObjectCommand, HeadObjectCommand, isSafeMediaKey } from '@/lib/minio';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function serve(req: NextRequest, context: { params: { key: string[] } }, head: boolean) {
  const key = context.params.key.join('/');
  if (!isSafeMediaKey(key)) return new Response(null, { status: 400 });
  const range = req.headers.get('range');
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416 });
  try {
    const metadata = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    // Never serve active SVG/HTML from the application's origin, including old uploads.
    const type = metadata.ContentType || '';
    if (!/^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|webm|ogg))$/.test(type)) return new Response(null, { status: 415 });
    const headers = new Headers({ 'Content-Type': type, 'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' });
    if (metadata.ETag) headers.set('ETag', metadata.ETag);
    if (metadata.LastModified) headers.set('Last-Modified', metadata.LastModified.toUTCString());
    if (req.headers.get('if-none-match')?.split(',').map(s => s.trim()).some(tag => tag === '*' || tag === metadata.ETag)) return new Response(null, { status: 304, headers });
    if (head) { headers.set('Content-Length', String(metadata.ContentLength || 0)); return new Response(null, { headers }); }
    const ifRange = req.headers.get('if-range');
    const result = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range && (!ifRange || ifRange === metadata.ETag || ifRange === metadata.LastModified?.toUTCString()) ? range : undefined }));
    headers.set('Content-Length', String(result.ContentLength || 0));
    if (result.ContentRange) headers.set('Content-Range', result.ContentRange);
    return new Response(result.Body?.transformToWebStream() as ReadableStream, { status: result.ContentRange ? 206 : 200, headers });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    return new Response(null, { status: status === 404 ? 404 : status === 416 ? 416 : 502 });
  }
}
export function GET(req: NextRequest, context: { params: { key: string[] } }) { return serve(req, context, false); }
export function HEAD(req: NextRequest, context: { params: { key: string[] } }) { return serve(req, context, true); }
