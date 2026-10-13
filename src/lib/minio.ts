import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { isSafeMediaKey, mediaUrl, normalizeMediaUrl } from './media';
export { isSafeMediaKey, mediaUrl } from './media';
function formatEndpoint(raw?: string): string {
  if (!raw) return 'http://localhost:9000';
  let u = raw.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `http://${u}`;
  }
  try {
    const parsed = new URL(u);
    if (!parsed.port && parsed.hostname.startsWith('192.168.')) {
      parsed.port = '9000';
      return parsed.origin;
    }
  } catch {}
  return u;
}

export const BUCKET = process.env.MINIO_BUCKET || 'wifimarketing';
const endpoint = formatEndpoint(process.env.MINIO_ENDPOINT);
export const s3Client = new S3Client({ endpoint, region: 'us-east-1', credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin', secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin' }, forcePathStyle: true });
export interface UploadedMedia { url: string; key: string; type: 'image' | 'video'; name: string; size: number; lastModified: string | null; usage?: { id: string; name: string; kind: string }[] }
export function normalizeLegacyMediaUrl(value: string) { return normalizeMediaUrl(value, [endpoint, formatEndpoint(process.env.MINIO_PUBLIC_URL || endpoint)], BUCKET); }
export async function uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
  if (!isSafeMediaKey(key)) throw new Error('Invalid media key');
  await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return mediaUrl(key);
}
export async function listUploadedFiles(): Promise<UploadedMedia[]> {
  const files: UploadedMedia[] = [];
  let ContinuationToken: string | undefined;
  do {
    const result = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken, MaxKeys: 1000 }));
    for (const item of result.Contents || []) {
      if (!isSafeMediaKey(item.Key)) continue;
      const key = item.Key;
      files.push({ key, url: mediaUrl(key), type: key.startsWith('videos/') ? 'video' : 'image', name: key.split('/').pop() || key, size: item.Size || 0, lastModified: item.LastModified?.toISOString() || null });
    }
    ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return files.sort((a,b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
}
export async function getPresignedUrl(key: string) { return mediaUrl(key); }
export async function deleteFile(key: string) { await deleteFiles([key]); }
export async function deleteFiles(keys: string[]) {
  if (!keys.length) return;
  if (!keys.every(isSafeMediaKey)) throw new Error('Invalid media key');
  const result = await s3Client.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys.map(Key => ({ Key })) } }));
  if (result.Errors?.length) throw new Error('Some media could not be deleted');
}
export { GetObjectCommand, HeadObjectCommand };
