'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, ArrowRight } from 'lucide-react';

export default function UsersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to professional UniFi clients manager
    router.replace('/admin/unifi/clients');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 mb-4 animate-pulse">
        <Wifi className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
        Đang chuyển hướng đến Quản lý Thiết bị khách UniFi...
      </h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md">
        Phần quản lý người dùng WiFi hiện đã được tích hợp tập trung và chuyên nghiệp hơn tại mục UniFi &gt; Thiết bị khách.
      </p>
      <button
        onClick={() => router.replace('/admin/unifi/clients')}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition"
      >
        Đi đến Thiết bị khách <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
