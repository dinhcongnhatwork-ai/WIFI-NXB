/** Restrict all device requests to the configured server, including raw explorer. */
export function validateRelativePath(path: string): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\#\x00-\x20]/.test(path)) throw new Error('Cần đường dẫn API tương đối trên máy chủ');
  const pathname = path.split('?')[0];
  let decoded = pathname;
  for (let n = 0; n < 3; n++) {
    try { decoded = decodeURIComponent(decoded); } catch { throw new Error('Mã hóa đường dẫn không hợp lệ'); }
    if (decoded.split('/').some(p => p === '.' || p === '..') || decoded.includes('\\') || decoded.startsWith('//') || /[?#\x00-\x20]/.test(decoded)) throw new Error('Không được truy cập vượt thư mục API');
  }
  return path;
}
export function recordId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9*:_-]{1,160}$/.test(value)) throw new Error('Mã tài nguyên không hợp lệ');
  return value;
}
