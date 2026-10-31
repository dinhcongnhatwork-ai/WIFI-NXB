import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function formatEndpoint(raw) {
  if (!raw) return 'http://localhost:9000';
  let u = raw.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `http://${u}`;
  }
  return u;
}

const BUCKET = process.env.MINIO_BUCKET || 'wifimarketing';
const endpoint = formatEndpoint(process.env.MINIO_ENDPOINT);
const s3Client = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

const TPL_DIR = path.resolve(process.cwd(), 'public/nxb-templates');

const DEFAULT_FOLDERS = [
  { id: 'logo-thuong-hieu', name: 'Logo & Nhận diện NXB', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'anh-nen-portal', name: 'Ảnh nền & Banner Portal', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'van-hoa-doc', name: 'Mẫu 1 · Văn hóa đọc & Nhà sách', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'xuat-ban-so', name: 'Mẫu 2 · Sách điện tử Stbook.vn', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'hoi-nghi', name: 'Mẫu 3 · Hội nghị & Tọa đàm', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'trien-lam', name: 'Mẫu 4 · Triển lãm & Ngày Sách', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'ly-luan-chinh-tri', name: 'Mẫu 5 · Nghiên cứu Lý luận', createdAt: '2026-01-01T00:00:00.000Z' },
];

function classifyFileToFolder(filename) {
  if (filename.startsWith('logo-')) return 'logo-thuong-hieu';
  if (filename.endsWith('-bg.jpg') || filename.endsWith('-thumb.webp')) return 'anh-nen-portal';
  if (filename.startsWith('van-hoa-doc-')) return 'van-hoa-doc';
  if (filename.startsWith('stbook-')) return 'xuat-ban-so';
  if (filename.startsWith('hoi-nghi-')) return 'hoi-nghi';
  if (filename.startsWith('trien-lam-')) return 'trien-lam';
  if (filename.startsWith('ly-luan-')) return 'ly-luan-chinh-tri';
  return 'anh-nen-portal';
}

function getContentType(filename) {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.mp4')) return 'video/mp4';
  return 'image/jpeg';
}

async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

async function main() {
  await ensureBucket();

  // Delete old legacy template images in MinIO if any (e.g. van-hoa-doc-space.jpg, van-hoa-doc-books.jpg, etc.)
  const listed = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 1000 }));
  const oldKeys = (listed.Contents || [])
    .map(c => c.Key)
    .filter(k => k && (
      k.includes('van-hoa-doc-space') ||
      k.includes('van-hoa-doc-books') ||
      k.includes('van-hoa-doc-reading') ||
      k.includes('stbook-app') ||
      k.includes('stbook-digital') ||
      k.includes('stbook-reader') ||
      k.includes('hoi-nghi-discussion') ||
      k.includes('hoi-nghi-delegates') ||
      k.includes('trien-lam-event') ||
      k.includes('trien-lam-books') ||
      k.includes('ly-luan-dangvien') ||
      k.includes('ly-luan-database') ||
      k.includes('logo-solutionai')
    ));
  if (oldKeys.length > 0) {
    await s3Client.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: oldKeys.map(Key => ({ Key })) },
    }));
    console.log(`🗑️ Deleted ${oldKeys.length} old template images from MinIO.`);
  }

  const files = (await fs.readdir(TPL_DIR)).filter(f => /\.(jpg|png|webp)$/i.test(f));

  const existingSetting = await prisma.systemSetting.findUnique({ where: { key: 'media_folders_v1' } });
  let parsed = { folders: DEFAULT_FOLDERS, fileFolders: {} };
  if (existingSetting?.value) {
    try {
      const raw = JSON.parse(existingSetting.value);
      const mergedFolders = [...DEFAULT_FOLDERS];
      if (Array.isArray(raw.folders)) {
        for (const f of raw.folders) {
          if (f?.id && !mergedFolders.some(d => d.id === f.id)) {
            mergedFolders.push(f);
          }
        }
      }
      parsed = {
        folders: mergedFolders,
        fileFolders: raw.fileFolders && typeof raw.fileFolders === 'object' ? { ...raw.fileFolders } : {},
      };
    } catch {
      // use default
    }
  }

  for (const k of oldKeys) {
    delete parsed.fileFolders[k];
  }

  let uploadedCount = 0;
  for (const filename of files) {
    const folderId = classifyFileToFolder(filename);
    const objectKey = `images/${folderId}/${filename}`;
    const fullPath = path.join(TPL_DIR, filename);
    const buf = await fs.readFile(fullPath);
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: buf,
      ContentType: getContentType(filename),
    }));
    parsed.fileFolders[objectKey] = folderId;
    uploadedCount++;
  }

  await prisma.systemSetting.upsert({
    where: { key: 'media_folders_v1' },
    update: { value: JSON.stringify(parsed) },
    create: { key: 'media_folders_v1', value: JSON.stringify(parsed) },
  });

  console.log(`✅ Uploaded ${uploadedCount} NXB assets into MinIO (${BUCKET}) across ${parsed.folders.length} Media Library folders!`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

