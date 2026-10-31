import { afterEach, expect, test, vi } from 'vitest';
import { createTemplateFromPreset } from '../src/components/templates/create-preset';
import { allNodes } from '../src/lib/template-document';
import { validatePublish } from '../src/lib/template-publishing';

afterEach(() => vi.unstubAllGlobals());

test('choosing a starter posts an authenticated fresh valid draft and returns the created ID', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ data: { id: 'created-template' } }), { status: 201 });
  });
  expect(await createTemplateFromPreset('trien-lam', 'session-token', '  Hội nghị  ')).toBe('created-template');
  expect(await createTemplateFromPreset('trien-lam', 'session-token')).toBe('created-template');
  expect(requests).toHaveLength(2);
  const bodies = requests.map(({ url, init }) => {
    expect(url).toBe('/api/templates');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-token');
    const body = JSON.parse(init.body as string);
    expect(body.status).toBe('draft');
    expect(body.thumbnail).toBe('/nxb-templates/trien-lam-thumb.webp');
    expect(() => validatePublish(body.layoutJson)).not.toThrow();
    return body;
  });
  expect(bodies[0].name).toBe('Hội nghị');
  expect(bodies[1].name).toBe('Mẫu 4');
  const firstIds = allNodes(bodies[0].layoutJson.variants.mobile).map(n => n.id);
  expect(allNodes(bodies[1].layoutJson.variants.mobile).some(n => firstIds.includes(n.id))).toBe(false);
});

test('missing authentication and unknown starters fail before sending a request', async () => {
  let requests = 0;
  vi.stubGlobal('fetch', async () => { requests++; return new Response('{}'); });
  await expect(createTemplateFromPreset('xuat-ban-so', '')).rejects.toThrow();
  await expect(createTemplateFromPreset('missing', 'token')).rejects.toThrow();
  expect(requests).toBe(0);
});

test('create failure propagates without substituting another document or ID', async () => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'Không thể tạo mẫu' }), { status: 500 }));
  await expect(createTemplateFromPreset('xuat-ban-so', 'token')).rejects.toThrow('Không thể tạo mẫu');
});
