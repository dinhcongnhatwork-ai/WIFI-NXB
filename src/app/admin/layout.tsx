'use client';

import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import LoginForm from '@/components/auth/LoginForm';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';

function AdminContent({ children }: { children: React.ReactNode }) {
  const { token, loading, canOperate } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const pathname = usePathname();
  // A transformed ancestor collapses the fixed fullscreen CMS to this wrapper's height.
  const fullscreenCms = /^\/admin\/templates\/[^/]+\/builder\/?$/.test(pathname);

  if (loading) {
    return <div className="admin-login admin-session-loading" role="status">Đang kiểm tra phiên đăng nhập…</div>;
  }
  if (!token) return <LoginForm />;

  return (
    <div className="admin-shell" data-read-only={!canOperate || undefined}>
      <a className="admin-skip-link" href="#admin-main">Chuyển đến nội dung</a>
      <AdminSidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="admin-workspace">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} />
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {!canOperate && <p className="admin-readonly-notice">Chế độ chỉ xem. Tài khoản của bạn không có quyền thay đổi dữ liệu.</p>}
          <div key={pathname} className={fullscreenCms ? undefined : 'admin-tab-transition'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider><AdminContent>{children}</AdminContent></AuthProvider>;
}
