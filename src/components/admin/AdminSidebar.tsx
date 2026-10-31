'use client';

import Link from '@/components/network/ScopedNetworkLink';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { adminNavigation, roleLabels } from './navigation';

interface Props { open: boolean; onClose: () => void }

export default function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { canAdmin, role, username } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    unifi: pathname.startsWith('/admin/unifi'), mikrotik: pathname.startsWith('/admin/mikrotik'),
  });
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const workspace = document.querySelector<HTMLElement>('.admin-workspace');
    if (workspace) workspace.inert = true;
    const focusFrame = requestAnimationFrame(() => closeButton.current?.focus());
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener('change', closeOnDesktop);
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || [])
        .filter(element => element.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (workspace) workspace.inert = false;
      cancelAnimationFrame(focusFrame);
      desktop.removeEventListener('change', closeOnDesktop);
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    const group = adminNavigation.find(item => item.icon && pathname.startsWith(`/admin/${item.id}`));
    if (group) setExpanded(previous => ({ ...previous, [group.id]: true }));
  }, [pathname]);

  return <>
    {open && <button className="admin-drawer-backdrop" aria-label="Đóng trình đơn điều hướng" onClick={onClose} tabIndex={-1} />}
    <aside ref={panel} id="admin-sidebar" className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="Điều hướng quản trị" role={open ? 'dialog' : undefined} aria-modal={open || undefined}>
      <div className="admin-sidebar-brand">
        <Link href="/admin" onClick={onClose} className="admin-brand-link">
          <Image src="/logo.png" alt="" width={36} height={36} priority />
          <span><strong>WiFi Marketing</strong><small>Hệ thống quản trị</small></span>
        </Link>
        <button ref={closeButton} onClick={onClose} className="admin-icon-button admin-mobile-only" aria-label="Đóng trình đơn"><X /></button>
      </div>
      <nav className="admin-navigation" aria-label="Điều hướng chính">
        {adminNavigation.map(group => {
          const items = group.items.filter(item => !item.adminOnly || canAdmin);
          if (!items.length) return null;
          const Icon = group.icon;
          return <div key={group.id} className="admin-nav-group">
            {Icon ? <button className="admin-nav-group-toggle" aria-expanded={!!expanded[group.id]} aria-controls={`admin-nav-${group.id}`} onClick={() => setExpanded(previous => ({ ...previous, [group.id]: !previous[group.id] }))}>
              <Icon /><span>{group.label}</span><ChevronDown className={expanded[group.id] ? 'is-expanded' : ''} />
            </button> : <p className="admin-nav-heading">{group.label}</p>}
            <div id={`admin-nav-${group.id}`} hidden={!!Icon && !expanded[group.id]} className={Icon ? 'admin-nav-children' : ''}>
              {items.map(item => {
                const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return <Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? 'page' : undefined} className="admin-nav-link">
                  <item.icon /><span>{item.label}</span>
                </Link>;
              })}
            </div>
          </div>;
        })}
      </nav>
      <div className="admin-sidebar-footer"><strong>{username}</strong><span>{roleLabels[role || 'VIEWER']}</span></div>
    </aside>
  </>;
}
