'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Palette,
  Megaphone,
  FolderOpen,
  Users,
  BarChart3,
  Server,
  Wifi,
  Settings,
  X,
  ChevronDown,
  ChevronRight,
  Shield,
  Network,
  Radio,
  Globe,
  Activity,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';

const MAIN_NAV_ITEMS = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { href: '/admin/attendance', label: 'Điểm danh họp', icon: UserCheck },
  { href: '/admin/templates', label: 'Mẫu hiển thị', icon: Palette },
  { href: '/admin/campaigns', label: 'Chiến dịch', icon: Megaphone },
  { href: '/admin/media', label: 'Thư viện', icon: FolderOpen },
  { href: '/admin/users', label: 'Người dùng', icon: Users },
  { href: '/admin/reports', label: 'Báo cáo', icon: BarChart3 },
];

const UNIFI_NAV_ITEMS = [
  { href: '/admin/unifi', label: 'Tổng quan', icon: Activity, exact: true },
  { href: '/admin/unifi/devices', label: 'Thiết bị', icon: Server },
  { href: '/admin/unifi/clients', label: 'Kết nối', icon: Users },
  { href: '/admin/unifi/ssids', label: 'SSID/WiFi', icon: Radio },
  { href: '/admin/unifi/networks', label: 'Mạng', icon: Network },
  { href: '/admin/unifi/firewall', label: 'Firewall', icon: Shield },
  { href: '/admin/unifi/settings', label: 'Cấu hình', icon: Globe },
];

const MIKROTIK_NAV_ITEMS = [
  { href: '/admin/mikrotik', label: 'Tổng quan', icon: Activity, exact: true },
  { href: '/admin/mikrotik/interfaces', label: 'Interfaces', icon: Network },
  { href: '/admin/mikrotik/ip', label: 'IP & DHCP', icon: Globe },
  { href: '/admin/mikrotik/firewall', label: 'Firewall', icon: Shield },
  { href: '/admin/mikrotik/hotspot', label: 'Hotspot', icon: Radio },
  { href: '/admin/mikrotik/raw', label: 'Raw API', icon: Server },
];

const navItemClass = (active: boolean) => {
  return `
    group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150
    ${active
      ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm'
      : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
    }
  `;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const [unifiExpanded, setUnifiExpanded] = useState(pathname.startsWith('/admin/unifi'));
  const [mikrotikExpanded, setMikrotikExpanded] = useState(pathname.startsWith('/admin/mikrotik'));

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const isUnifiActive = pathname.startsWith('/admin/unifi');
  const isMikrotikActive = pathname.startsWith('/admin/mikrotik');

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-[268px] border-r border-slate-200 bg-white text-slate-600
          transform transition-transform duration-300 ease-out
          lg:translate-x-0
          flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header with Logo */}
        <div className="h-[72px] px-5 border-b border-slate-100 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-lg shadow-slate-200/60 border border-slate-100 bg-white flex-shrink-0">
              <Image
                src="/logo.png"
                alt="WiFi Marketing"
                fill
                className="object-contain p-1.5"
                priority
              />
            </div>
            <div className="min-w-0">
              <span className="text-slate-900 font-extrabold text-[15px] leading-tight block">WiFi Marketing</span>
              <span className="text-blue-500 text-[11px] font-bold uppercase tracking-wide block">Admin Panel</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Main navigation section */}
          <div className="mb-4">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Menu
            </p>
            {MAIN_NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={navItemClass(active)}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className={`w-[18px] h-[18px] ${active ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span className={active ? 'font-semibold' : ''}>{item.label}</span>
                  </span>
                  {active && <ChevronRight className="w-4 h-4 text-blue-400" />}
                </Link>
              );
            })}
          </div>

          {/* System section */}
          <div className="mb-4">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Hệ thống
            </p>

            {/* UniFi */}
            <button
              onClick={() => setUnifiExpanded(!unifiExpanded)}
              className={navItemClass(isUnifiActive)}
            >
              <div className="flex items-center gap-3">
                <Server className={`w-[18px] h-[18px] ${isUnifiActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className={isUnifiActive ? 'font-semibold' : ''}>UniFi</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${unifiExpanded ? 'rotate-180' : ''} ${isUnifiActive ? 'text-blue-400' : 'text-slate-400'}`}
              />
            </button>

            <AnimatePresence>
              {unifiExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 ml-3 pl-3 border-l border-slate-200 space-y-0.5 py-1">
                    {UNIFI_NAV_ITEMS.map((item) => {
                      const active = isActive(item.href, item.exact);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
                            ${active
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }
                          `}
                        >
                          <item.icon className={`w-4 h-4 ${active ? 'text-blue-500' : 'text-slate-400'}`} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MikroTik */}
            <button
              onClick={() => setMikrotikExpanded(!mikrotikExpanded)}
              className={`${navItemClass(isMikrotikActive)} mt-1`}
            >
              <div className="flex items-center gap-3">
                <Wifi className={`w-[18px] h-[18px] ${isMikrotikActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className={isMikrotikActive ? 'font-semibold' : ''}>MikroTik</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${mikrotikExpanded ? 'rotate-180' : ''} ${isMikrotikActive ? 'text-blue-400' : 'text-slate-400'}`}
              />
            </button>

            <AnimatePresence>
              {mikrotikExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 ml-3 pl-3 border-l border-slate-200 space-y-0.5 py-1">
                    {MIKROTIK_NAV_ITEMS.map((item) => {
                      const active = isActive(item.href, item.exact);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
                            ${active
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }
                          `}
                        >
                          <item.icon className={`w-4 h-4 ${active ? 'text-blue-500' : 'text-slate-400'}`} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings */}
          <div>
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Cài đặt
            </p>
            <Link
              href="/admin/settings"
              onClick={onClose}
              className={navItemClass(pathname === '/admin/settings')}
            >
              <span className="flex items-center gap-3">
                <Settings className={`w-[18px] h-[18px] ${pathname === '/admin/settings' ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className={pathname === '/admin/settings' ? 'font-semibold' : ''}>Cài đặt</span>
              </span>
              {pathname === '/admin/settings' && <ChevronRight className="w-4 h-4 text-blue-400" />}
            </Link>
          </div>
        </nav>

        {/* Footer with logo watermark */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="relative rounded-xl border border-slate-100 bg-slate-50 p-3 overflow-hidden">
            {/* Mini watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.07]">
              <div className="relative w-20 h-20">
                <Image src="/logo.png" alt="" fill className="object-contain" />
              </div>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden shadow-sm border border-slate-200 bg-white flex-shrink-0">
                <Image src="/logo.png" alt="" fill className="object-contain p-1" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">Quản Trị Viên</p>
                <p className="text-xs text-slate-500">WiFi Marketing v1.0</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
