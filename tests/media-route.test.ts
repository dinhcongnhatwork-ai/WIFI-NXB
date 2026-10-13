import { beforeEach, describe, expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/minio', async () => { const media = await import('../src/lib/media'); return { ...media, BUCKET:'test',s3Client:{send}, HeadObjectCommand: class { constructor(public input: unknown) {} }, GetObjectCommand: class { constructor(public input: unknown) {} } }; });
import { GET, HEAD } from '../src/app/api/media/[...key]/route';
import { NextRequest } from 'next/server';
const context = { params:{key:['videos','sample.mp4']} };
const metadata = { ContentType:'video/mp4', ContentLength:100, ETag:'"version"' };
beforeEach(()=>send.mockReset());
describe('same-origin streaming',()=>{
 it('streams a byte range with 206 and metadata',async()=>{ send.mockResolvedValueOnce(metadata).mockResolvedValueOnce({ContentLength:10,ContentRange:'bytes 0-9/100',Body:{transformToWebStream:()=>new ReadableStream({ start(controller){controller.enqueue(new Uint8Array(10));controller.close();} })}}); const response = await GET(new NextRequest('http://localhost/api/media/videos/sample.mp4',{headers:{range:'bytes=0-9'}}),context); expect(response.status).toBe(206);expect(response.headers.get('content-range')).toBe('bytes 0-9/100');expect((await response.arrayBuffer()).byteLength).toBe(10); });
 it('returns HEAD metadata without getting a body',async()=>{send.mockResolvedValueOnce(metadata);const response=await HEAD(new NextRequest('http://localhost/api/media/videos/sample.mp4'),context);expect(response.headers.get('content-length')).toBe('100');expect(send).toHaveBeenCalledTimes(1);});
 it('uses ETag cache validators',async()=>{send.mockResolvedValueOnce(metadata);const response=await GET(new NextRequest('http://localhost/api/media/videos/sample.mp4',{headers:{'if-none-match':'"version"'}}),context);expect(response.status).toBe(304);expect(send).toHaveBeenCalledTimes(1);});
 it('refuses invalid paths and active legacy SVG',async()=>{const bad=await GET(new NextRequest('http://localhost/api/media/secret/a'),{params:{key:['secret','a']}});expect(bad.status).toBe(400);expect(send).not.toHaveBeenCalled();send.mockResolvedValueOnce({ContentType:'image/svg+xml'});expect((await GET(new NextRequest('http://localhost/api/media/images/a.svg'),{params:{key:['images','a.svg']}})).status).toBe(415);});
});
