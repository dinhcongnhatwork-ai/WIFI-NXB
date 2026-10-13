/** Object keys accepted by the public media endpoint. */
export function isSafeMediaKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= 1024 && /^(images|videos)\/[a-zA-Z0-9/_\-.]+$/.test(key) && !key.split('/').some(part => !part || part === '.' || part === '..');
}
export function mediaUrl(key: string): string {
  if (!isSafeMediaKey(key)) throw new Error('Invalid media key');
  return `/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;
}
export function normalizeMediaUrl(value: string, endpoints: string[] = [], bucket = 'wifimarketing'): string {
  if (value.startsWith('/api/media/')) return isSafeMediaKey(value.slice(11)) ? value : '';
  try {
    const url = new URL(value);
    if (!endpoints.some(endpoint => { try { return new URL(endpoint).origin === url.origin; } catch { return false; } })) return value;
    const prefix = `/${bucket}/`;
    if (!url.pathname.startsWith(prefix)) return value;
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    return isSafeMediaKey(key) ? mediaUrl(key) : value;
  } catch { return value; }
}
export function referencesMedia(value: unknown, key: string): boolean {
  if (typeof value === 'string') return value === key || value.includes(mediaUrl(key)) || value.includes(`/${key}`);
  if (Array.isArray(value)) return value.some(item => referencesMedia(item, key));
  if (value && typeof value === 'object') return Object.values(value).some(item => referencesMedia(item, key));
  return false;
}
