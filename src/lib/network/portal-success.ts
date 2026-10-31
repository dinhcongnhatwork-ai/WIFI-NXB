/** Called only after UniFi authorization and its live readback succeed. */
export function wifiConnectionSuccess(destination: string): Response {
  const target = new URL(destination);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid connection destination');
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
