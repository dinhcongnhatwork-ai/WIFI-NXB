import {
  Activity, BarChart3, Cable, Code2, FolderOpen, Globe, LayoutDashboard,
  Megaphone, Network, Palette, Radio, Router, Server, Settings, Shield,
  SlidersHorizontal, UserCheck, Users, Wifi, type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
}
export interface AdminNavGroup {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: AdminNavItem[];
}

export const adminNavigation: AdminNavGroup[] = [
  { id: 'workspace', label: 'Điều hành', items: [
    { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
    { href: '/admin/monitor', label: 'Giám sát hệ thống', icon: Activity },
    { href: '/admin/attendance', label: 'Điểm danh họp', icon: UserCheck },
    { href: '/admin/templates', label: 'Mẫu hiển thị', icon: Palette },
    { href: '/admin/campaigns', label: 'Chiến dịch', icon: Megaphone },
    { href: '/admin/media', label: 'Thư viện', icon: FolderOpen },
    { href: '/admin/reports', label: 'Báo cáo', icon: BarChart3 },
  ] },
  { id: 'unifi', label: 'UniFi', icon: Wifi, items: [
    { href: '/admin/unifi', label: 'Tổng quan UniFi', icon: Activity, exact: true },
    { href: '/admin/unifi/topology', label: 'Sơ đồ mạng', icon: Network },
    { href: '/admin/unifi/devices', label: 'Thiết bị', icon: Server },
    { href: '/admin/unifi/clients', label: 'Thiết bị khách', icon: Users },
    { href: '/admin/unifi/exempt-devices', label: 'Thiết bị miễn xác thực', icon: UserCheck },
    { href: '/admin/unifi/ssids', label: 'SSID / WiFi', icon: Radio },
    { href: '/admin/unifi/networks', label: 'Mạng', icon: Cable },
    { href: '/admin/unifi/firewall', label: 'Tường lửa', icon: Shield },
    { href: '/admin/unifi/manage', label: 'Quản lý thiết bị', icon: SlidersHorizontal },
    { href: '/admin/unifi/settings', label: 'Cấu hình UniFi', icon: Settings, adminOnly: true },
    { href: '/admin/unifi/raw', label: 'API nâng cao', icon: Code2, adminOnly: true },
  ] },
  { id: 'mikrotik', label: 'MikroTik', icon: Router, items: [
    { href: '/admin/mikrotik', label: 'Tổng quan MikroTik', icon: Activity, exact: true },
    { href: '/admin/mikrotik/topology', label: 'Sơ đồ mạng', icon: Network },
    { href: '/admin/mikrotik/inventory', label: 'Thiết bị MikroTik', icon: Server, adminOnly: true },
    { href: '/admin/mikrotik/interfaces', label: 'Cổng kết nối', icon: Cable },
    { href: '/admin/mikrotik/ip', label: 'IP & DHCP', icon: Globe },
    { href: '/admin/mikrotik/firewall', label: 'Tường lửa', icon: Shield },
    { href: '/admin/mikrotik/hotspot', label: 'Hotspot', icon: Radio },
    { href: '/admin/mikrotik/queues', label: 'Quản lý băng thông', icon: SlidersHorizontal },
    { href: '/admin/mikrotik/manage', label: 'Quản lý router', icon: Server },
    { href: '/admin/mikrotik/raw', label: 'API nâng cao', icon: Code2, adminOnly: true },
  ] },
  { id: 'settings', label: 'Quản trị', items: [
    { href: '/admin/settings', label: 'Cài đặt hệ thống', icon: Settings, exact: true, adminOnly: true },
    { href: '/admin/settings/connections', label: 'Kết nối mạng', icon: Cable, adminOnly: true },
    { href: '/admin/settings/accounts', label: 'Tài khoản quản trị', icon: Users, adminOnly: true },
  ] },
];

export function currentAdminPage(pathname: string): string {
  return adminNavigation.flatMap(group => group.items)
    .filter(item => item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label || 'Quản trị hệ thống';
}

export { ROLE_LABELS as roleLabels } from '@/lib/permissions';
