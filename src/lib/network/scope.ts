/** Client-safe URL scoping shared by legacy pages, shell and global navigation. */
export function networkScopeHref(href: string, pathname: string, params: Pick<URLSearchParams, 'get'>): string {
  const provider = pathname.match(/^\/admin\/(unifi|mikrotik)(?:\/|$)/)?.[1];
  if (!provider || !new RegExp(`^/admin/${provider}(?:/|\\?|#|$)`).test(href)) return href;
  const url = new URL(href, 'http://network.local');
  for (const key of provider === 'unifi' ? ['connectionId', 'siteId'] : ['connectionId']) {
    const value = params.get(key);
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
