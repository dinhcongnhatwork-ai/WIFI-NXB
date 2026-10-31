import { FormFieldDefinition, AttendanceRegistrationStatus } from '@/types/attendance';

export const DEFAULT_WARNING_THRESHOLD_MINUTES = 15;
export const DEFAULT_POLL_INTERVAL_MS = 3000;

export const DEFAULT_FORM_FIELDS: FormFieldDefinition[] = [
  {
    id: 'fullname',
    type: 'text',
    label: 'Họ và tên',
    placeholder: 'VD: Nguyễn Văn A',
    required: true,
    isDisplayName: true,
    isIdentifier: true,
  },
  {
    id: 'department',
    type: 'text',
    label: 'Phòng ban / Đơn vị',
    placeholder: 'VD: Ban Biên tập Chính trị',
    required: true,
    isDisplayName: false,
    isIdentifier: false,
  },
];

export const STATUS_CONFIG: Record<
  AttendanceRegistrationStatus,
  {
    label: string;
    sublabel: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
    glowColor: string;
  }
> = {
  PRESENT: {
    label: 'Đang hiện diện',
    sublabel: 'Kết nối đúng AP mục tiêu',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/20 dark:border-emerald-400/20',
    dotColor: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    glowColor: 'rgba(16, 185, 129, 0.15)',
  },
  TEMPORARY_ABSENT: {
    label: 'Mất kết nối',
    sublabel: 'Đang đếm ngược vắng',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-400/10',
    badgeText: 'text-amber-700 dark:text-amber-400',
    badgeBorder: 'border-amber-500/20 dark:border-amber-400/20',
    dotColor: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
    glowColor: 'rgba(245, 158, 11, 0.15)',
  },
  ALERT_ABSENT: {
    label: 'Vắng quá ngưỡng',
    sublabel: 'Mất kết nối quá thời gian quy định',
    badgeBg: 'bg-rose-500/10 dark:bg-rose-400/10',
    badgeText: 'text-rose-700 dark:text-rose-400',
    badgeBorder: 'border-rose-500/20 dark:border-rose-400/20',
    dotColor: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]',
    glowColor: 'rgba(244, 63, 94, 0.15)',
  },
  UNKNOWN: {
    label: 'Không xác định',
    sublabel: 'Controller gián đoạn',
    badgeBg: 'bg-slate-500/10 dark:bg-slate-400/10',
    badgeText: 'text-slate-700 dark:text-slate-400',
    badgeBorder: 'border-slate-500/20 dark:border-slate-400/20',
    dotColor: 'bg-slate-400',
    glowColor: 'rgba(148, 163, 184, 0.15)',
  },
};

/**
 * Identify likely device vendor from MAC address OUI prefix
 */
export function detectDeviceVendor(mac: string): string {
  if (!mac) return 'Thiết bị không rõ';
  const clean = mac.replace(/[:-]/g, '').toUpperCase();
  const prefix3 = clean.slice(0, 6);

  // Common OUIs
  const vendors: Record<string, string> = {
    // Apple
    'F01898': 'Apple iPhone/iPad',
    '3C0630': 'Apple iPhone',
    'F4F15A': 'Apple MacBook',
    'ACDE48': 'Apple Device',
    'B87826': 'Apple Device',
    '703560': 'Apple Device',
    // Samsung
    'A8B86E': 'Samsung Galaxy',
    '507705': 'Samsung Galaxy',
    'F47B5E': 'Samsung Galaxy',
    // Xiaomi
    '50EC50': 'Xiaomi Phone',
    '640980': 'Xiaomi Phone',
    // Intel
    '001500': 'Intel WiFi Card',
    '5891CF': 'Intel WiFi Card',
  };

  if (vendors[prefix3]) {
    return vendors[prefix3];
  }

  // Check random private MAC (Apple Private Wi-Fi address, Android MAC randomization)
  // Local bit is set if second hex char is 2, 6, A, or E
  const secondChar = clean[1];
  if (['2', '6', 'A', 'E'].includes(secondChar)) {
    return 'Thiết bị di động (MAC riêng tư)';
  }

  return 'Thiết bị WiFi';
}

// datetime-local is interpreted in the browser's timezone; the API receives ISO UTC.
export function localDateTimeToIso(value: string): string {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error('Thời gian không hợp lệ.');
  return date.toISOString();
}
export function isoToLocalDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
