import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

/** Legacy UniFi external portals accept an IPv4 address and call TCP port 80. */
export function createPortalEntryServer(publicOrigin) {
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('PORTAL_PUBLIC_URL must be an HTTPS origin');
  }
  return createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method || '')) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    try {
      const incoming = new URL(request.url || '/', 'http://portal.invalid');
      if (incoming.pathname === '/health') {
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('ok'); return;
      }
      if (!/^\/guest\/s\/[A-Za-z0-9_-]{1,100}\/?$/.test(incoming.pathname)) {
        response.writeHead(404); response.end(); return;
      }
      const destination = new URL(incoming.pathname, origin);
      for (const key of ['id', 'ap', 'ssid', 'url', 't']) {
        const value = incoming.searchParams.get(key);
        if (value && value.length <= 2048) destination.searchParams.set(key, value);
      }
      response.writeHead(302, { Location: destination.toString() }); response.end();
    } catch {
      response.writeHead(400); response.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createPortalEntryServer(process.env.PORTAL_PUBLIC_URL || 'https://solutionai.com.vn');
  server.listen(Number(process.env.PORTAL_ENTRY_PORT || 80), process.env.PORTAL_ENTRY_HOST || '192.168.1.253', () => {
    console.log('[hotspot-entry] Ready');
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
