'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';
import { networkScopeHref } from '@/lib/network/scope';
export default function ScopedNetworkLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname(), params = useSearchParams();
  return <Link {...props} href={typeof props.href === 'string' ? networkScopeHref(props.href, pathname, params) : props.href} />;
}
