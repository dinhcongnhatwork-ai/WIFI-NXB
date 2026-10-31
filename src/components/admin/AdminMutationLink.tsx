'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

/** A visible mutation entry point that does not navigate for read-only users. */
export default function AdminMutationLink({ children, ...props }: ComponentProps<typeof Link>) {
  const { canOperate } = useAuth();
  if (!canOperate) return <span role="link" aria-disabled="true" className={`${props.className || ''} admin-disabled-link`} title="Tài khoản chỉ xem không có quyền thực hiện thao tác này.">{children}</span>;
  return <Link {...props}>{children}</Link>;
}
