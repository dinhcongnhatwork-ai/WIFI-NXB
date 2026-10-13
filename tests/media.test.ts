import { describe, it, expect } from 'vitest';
import { isSafeMediaKey, mediaUrl, normalizeMediaUrl, referencesMedia } from '../src/lib/media';
import sharp from 'sharp';
import { mediaUrl as documentMediaUrl, mediaRef, validMediaRef } from '../src/lib/template-document';
import { validateMedia } from '../src/lib/media-validation';
describe('media boundaries',()=>{
  it('rejects unsafe prefixes and traversal',()=>{ for(const key of ['other/file.png','images/../secret','images//file','images/a?x=1','https://host/file','images/%2e%2e/a']) expect(isSafeMediaKey(key)).toBe(false); expect(mediaUrl('images/2026/a.png')).toBe('/api/media/images/2026/a.png'); });
  it('normalizes only configured storage endpoints',()=>{ expect(normalizeMediaUrl('http://store:9000/bucket/images/a.png',['http://store:9000'],'bucket')).toBe('/api/media/images/a.png'); expect(normalizeMediaUrl('https://unknown/bucket/images/a.png',['http://store:9000'],'bucket')).toBe('https://unknown/bucket/images/a.png'); });
  it('finds references in nested drafts and legacy URLs',()=>{ expect(referencesMedia({ blocks:[{ src:'http://store/bucket/images/a.png' }] },'images/a.png')).toBe(true); expect(referencesMedia({src:'/api/media/images/b.png'},'images/a.png')).toBe(false); });
  it('rejects forged image content and rasterizes SVG',async()=>{ await expect(validateMedia(Buffer.from('<html>not an image</html>'))).rejects.toThrow(); const result = await validateMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')); expect(result.contentType).toBe('image/png'); expect(result.buffer.subarray(1,4).toString()).toBe('PNG'); });
  it('rejects SVG external references',async()=>{ await expect(validateMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://localhost/secret"/></svg>'))).rejects.toThrow(); });
  it('preserves animated GIF frames',async()=>{const result = await validateMedia(Buffer.from('R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH5BAAKAAAAIf8LTkVUU0NBUEUyLjADAQAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQACgAAACH/C05FVFNDQVBFMi4wAwEAAAAsAAAAAAIAAgCBAAD/AAAAAAAAAAAACAYAAQgEEBAAOw==','base64')); expect(result.contentType).toBe('image/webp'); expect((await sharp(result.buffer,{animated:true}).metadata()).pages).toBe(2);});
  it('does not crash rendering malformed media refs',()=>{expect(documentMediaUrl({kind:'object', key: 3} as never)).toBe('');expect(mediaRef('/api/media/images/%ZZ')).toBeUndefined();expect(validMediaRef({kind:'object',key:'images//a.png'})).toBe(false);});
});
