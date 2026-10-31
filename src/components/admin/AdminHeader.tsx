'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { LogOut, Menu, Settings, Sun, Moon } from 'lucide-react';
import { currentAdminPage, roleLabels } from './navigation';
import { useEffect, useState } from 'react';

interface Props { onMenuClick: () => void; sidebarOpen: boolean }

export default function AdminHeader({ onMenuClick, sidebarOpen }: Props) {
  const { username, role, canAdmin, logout } = useAuth();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = saved === 'dark' || (!saved && prefersDark);
    setIsDark(shouldDark);
    if (shouldDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="admin-header">
      <button
        onClick={onMenuClick}
        className="admin-icon-button admin-mobile-only"
        aria-label="Mở trình đơn"
        aria-controls="admin-sidebar"
        aria-expanded={sidebarOpen}
      >
        <Menu />
      </button>
      <div className="admin-header-location">
        <span>Quản trị</span>
        <span aria-hidden="true">/</span>
        <strong>{currentAdminPage(pathname)}</strong>
      </div>
      <div className="admin-header-actions">
        <button
          onClick={toggleTheme}
          className="admin-icon-button"
          aria-label={isDark ? "Chuyển sang chế độ Sáng" : "Chuyển sang chế độ Tối"}
          title={isDark ? "Chuyển sang chế độ Sáng" : "Chuyển sang chế độ Tối"}
        >
          {isDark ? <Sun className="text-amber-400" /> : <Moon />}
        </button>
        {canAdmin && (
          <Link
            href="/admin/settings"
            className="admin-icon-button"
            aria-label="Cài đặt hệ thống"
            title="Cài đặt hệ thống"
          >
            <Settings />
          </Link>
        )}
        <div className="admin-header-identity">
          <strong>{username}</strong>
          <span>{roleLabels[role || 'VIEWER']}</span>
        </div>
        <button
          onClick={() => void logout()}
          className="admin-icon-button"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut />
        </button>
      </div>
    </header>
  );
}
