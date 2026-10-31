// ============================================
// Utility Functions
// ============================================

export function formatBytes(bytes: number): string {
  const safeBytes = Number(bytes);
  if (!Number.isFinite(safeBytes) || safeBytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(safeBytes) / Math.log(k));
  return `${parseFloat((safeBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatUptime(seconds: number | undefined): string {
  const safeSeconds = Number(seconds);
  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) {
    return '0m';
  }

  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatSignal(signal: number): string {
  const safeSignal = Number(signal);
  if (!Number.isFinite(safeSignal)) return 'Unknown';
  if (safeSignal >= -30) return 'Excellent';
  if (safeSignal >= -50) return 'Good';
  if (safeSignal >= -60) return 'Fair';
  if (safeSignal >= -70) return 'Poor';
  return 'Very Poor';
}

export function getSignalColor(signal: number): string {
  const safeSignal = Number(signal);
  if (!Number.isFinite(safeSignal)) return 'text-slate-400';
  if (safeSignal >= -50) return 'text-green-500';
  if (safeSignal >= -60) return 'text-yellow-500';
  if (safeSignal >= -70) return 'text-orange-500';
  return 'text-red-500';
}

export function getDeviceTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    uap: 'Access Point',
    usw: 'Switch',
    ugw: 'Gateway',
    udm: 'Dream Machine',
    switch: 'Switch',
    router: 'Router',
    gateway: 'Gateway',
  };
  return icons[type] || type;
}

export function getDeviceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    upgrading: 'bg-yellow-500',
    disconnected: 'bg-gray-500',
  };
  return colors[status] || 'bg-gray-500';
}

export function getSecurityTypeLabel(security: string): string {
  const labels: Record<string, string> = {
    open: 'Open (No Security)',
    wep: 'WEP',
    wpapsk: 'WPA Personal',
    wpa2psk: 'WPA2 Personal',
    'wpapsk+ wpa2psk': 'WPA/WPA2 Personal',
    'wpaowpa2ent': 'WPA/WPA2 Enterprise',
    wpawpa2psk: 'WPA/WPA2 Personal',
    'wpa3': 'WPA3 Personal',
    'wpa3-ent': 'WPA3 Enterprise',
  };
  return labels[security] || security;
}
