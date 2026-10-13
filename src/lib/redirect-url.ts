const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function prepareCandidate(raw: string): string {
  const trimmed = raw.trim().replace(/^['\"]|['\"]$/g, '');
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function normalizeRedirectUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const candidate = prepareCandidate(raw);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolvePortalFallbackUrl(rawAppUrl: string | undefined): string {
  const defaultPortalUrl = 'https://wifi.jtsc.vn/portal';
  if (!rawAppUrl) {
    return defaultPortalUrl;
  }

  const normalized = normalizeRedirectUrl(rawAppUrl);
  if (!normalized) {
    return defaultPortalUrl;
  }

  try {
    const url = new URL(normalized);
    if (url.pathname && url.pathname !== '/') {
      return url.toString();
    }

    url.pathname = '/portal';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return defaultPortalUrl;
  }
}
