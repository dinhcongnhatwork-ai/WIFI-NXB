import { afterEach, expect, it } from 'vitest';
import { createPortalEntryServer } from '../deploy/hotspot-entry.mjs';
import type { Server } from 'node:http';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {server.closeAllConnections(); server.close(() => resolve());}))); });
async function start() {
  const server = createPortalEntryServer('https://solutionai.com.vn'); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP address');
  return `http://127.0.0.1:${address.port}`;
}
it('forwards the UniFi identity to the configured HTTPS callback, preserving Vietnamese SSID', async () => {
  const response = await fetch(`${await start()}/guest/s/m5npy6bn/?id=aa%3Abb%3Acc%3Add%3Aee%3Aff&ap=11%3A22%3A33%3A44%3A55%3A66&ssid=WIFI_PH%C3%92NG+H%E1%BB%8CP&url=http%3A%2F%2Fexample.com%2F&t=123&unexpected=discard`, {redirect:'manual',headers:{Host:'attacker.invalid'}});
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get('location')!);
  expect(location.origin).toBe('https://solutionai.com.vn');
  expect(location.pathname).toBe('/guest/s/m5npy6bn/');
  expect(location.searchParams.get('id')).toBe('aa:bb:cc:dd:ee:ff');
  expect(location.searchParams.get('ssid')).toBe('WIFI_PHÒNG HỌP');
  expect(location.searchParams.has('unexpected')).toBe(false);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('does not redirect arbitrary routes or accept a submitted body', async () => {
  const base = await start();
  expect((await fetch(`${base}/admin`,{redirect:'manual'})).status).toBe(404);
  expect((await fetch(`${base}/guest/s/m5npy6bn/`,{method:'POST',body:'data',redirect:'manual'})).status).toBe(405);
});
it('requires a configured HTTPS origin without credentials or a path', () => {
  for (const value of ['http://solutionai.com.vn','https://user:password@solutionai.com.vn','https://solutionai.com.vn/path']) {
    expect(() => createPortalEntryServer(value)).toThrow();
  }
});
