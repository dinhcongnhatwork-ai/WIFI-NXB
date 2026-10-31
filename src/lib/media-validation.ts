import sharp from 'sharp';
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1GB
export const MAX_MEDIA_SIZE = MAX_VIDEO_SIZE;

export async function validateMedia(buffer: Buffer): Promise<{ buffer: Buffer; type: 'image' | 'video'; contentType: string; extension: string }> {
  if (!buffer.length || buffer.length > MAX_VIDEO_SIZE) throw new Error('File must be between 1 byte and 1GB');
  const ascii = buffer.subarray(0, 4096).toString('utf8');
  if (buffer.subarray(4,8).toString() === 'ftyp' && buffer.length >= 24 && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(buffer.subarray(8,12).toString()) && buffer.includes(Buffer.from('moov')) && buffer.includes(Buffer.from('mdat'))) return { buffer, type: 'video', contentType: 'video/mp4', extension: 'mp4' };
  if (buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) && ascii.includes('webm')) return { buffer, type: 'video', contentType: 'video/webm', extension: 'webm' };
  if (ascii.startsWith('OggS') && ascii.includes('theora')) return { buffer, type: 'video', contentType: 'video/ogg', extension: 'ogg' };

  if (buffer.length > MAX_IMAGE_SIZE) throw new Error('Dung lượng hình ảnh vượt quá 50MB');

  try {
    // Re-encode all images to remove embedded active content and enforce a decoded pixel limit.
    if (/<svg[\s>]/i.test(ascii) && /(?:<!ENTITY|<!DOCTYPE|(?:href|url)\s*[=(])/i.test(buffer.toString('utf8'))) throw new Error('SVG references are not supported');
    const image = sharp(buffer, { limitInputPixels: 40_000_000, animated: true });
    const metadata = await image.metadata();
    if (!['jpeg','png','gif','webp','avif','svg'].includes(metadata.format || '')) throw new Error('Unsupported image');
    const animated = (metadata.pages || 1) > 1;
    const clean = animated ? await image.webp().toBuffer() : await image.rotate().png().toBuffer();
    if (clean.length > MAX_IMAGE_SIZE) throw new Error('Decoded image too large');
    return { buffer: clean, type: 'image', contentType: animated ? 'image/webp' : 'image/png', extension: animated ? 'webp' : 'png' };
  } catch { throw new Error('Unsupported or invalid image/video content'); }
}
