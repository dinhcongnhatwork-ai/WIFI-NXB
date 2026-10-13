import { prisma } from '@/lib/prisma';
import { UnifiClient, registerUnifiConfigResolver } from '@/lib/unifi';
import { registerMikrotikConfigResolver } from '@/lib/mikrotik';

export interface UnifiSystemConfig {
  controllerUrl: string;
  username: string;
  password?: string;
  site: string;
}

export interface MikrotikSystemConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  allowInsecure: boolean;
}

// In-memory cache for ultra-fast access
const settingsCache = new Map<string, { value: any; expiresAt: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

export async function getSystemSetting<T>(key: string, fallback: T): Promise<T> {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  try {
    const record = await (prisma as any).systemSetting.findUnique({
      where: { key },
    });

    if (record && record.value !== null && record.value !== undefined) {
      const merged =
        typeof fallback === 'object' && fallback !== null
          ? { ...fallback, ...(record.value as any) }
          : (record.value as unknown as T);

      settingsCache.set(key, { value: merged, expiresAt: now + CACHE_TTL_MS });
      return merged;
    }
  } catch (err) {
    console.error(`[settings] Error reading setting "${key}":`, err);
  }

  return fallback;
}

export async function saveSystemSetting<T>(key: string, value: T): Promise<void> {
  await (prisma as any).systemSetting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });

  // Update in-memory cache immediately
  settingsCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

  // If UniFi settings updated, clear session cache so new credentials take effect immediately
  if (key === 'unifi') {
    UnifiClient.clearSessionCache();
  }
}

export function getCachedUnifiConfig(): UnifiSystemConfig {
  const cached = settingsCache.get('unifi');
  if (cached && cached.value) return cached.value;
  return {
    controllerUrl: process.env.UNIFI_CONTROLLER_URL || 'https://192.168.1.200:11443',
    username: process.env.UNIFI_USERNAME || 'congnhat',
    password: process.env.UNIFI_PASSWORD || 'Congnhat2002@',
    site: process.env.UNIFI_SITE || 'default',
  };
}

export function getCachedMikrotikConfig(): MikrotikSystemConfig {
  const cached = settingsCache.get('mikrotik');
  if (cached && cached.value) return cached.value;
  return {
    host: process.env.MIKROTIK_HOST || '192.168.1.200',
    port: parseInt(process.env.MIKROTIK_PORT || '80', 10),
    username: process.env.MIKROTIK_USER || 'admin',
    password: process.env.MIKROTIK_PASSWORD || '10122002',
    allowInsecure: process.env.MIKROTIK_ALLOW_INSECURE !== 'false',
  };
}

export async function getUnifiConfig(): Promise<UnifiSystemConfig> {
  const fallback = getCachedUnifiConfig();
  const setting = await getSystemSetting<UnifiSystemConfig>('unifi', fallback);

  return {
    controllerUrl: setting.controllerUrl || fallback.controllerUrl,
    username: setting.username || fallback.username,
    password: setting.password || fallback.password,
    site: setting.site || fallback.site,
  };
}

export async function getMikrotikConfig(): Promise<MikrotikSystemConfig> {
  const fallback = getCachedMikrotikConfig();
  const setting = await getSystemSetting<MikrotikSystemConfig>('mikrotik', fallback);

  return {
    host: setting.host || fallback.host,
    port: setting.port || fallback.port,
    username: setting.username || fallback.username,
    password: setting.password || fallback.password,
    allowInsecure: setting.allowInsecure ?? fallback.allowInsecure,
  };
}

export async function getUnifiClientFromRequest(req?: Request): Promise<UnifiClient> {
  const config = await getUnifiConfig();
  const controllerUrl = req?.headers.get('x-unifi-url') || config.controllerUrl;
  const username = req?.headers.get('x-unifi-user') || config.username;
  const password = req?.headers.get('x-unifi-pass') || config.password;
  const site = req?.headers.get('x-unifi-site') || config.site;

  return new UnifiClient({
    controllerUrl,
    username,
    password,
    site,
    rejectUnauthorized: false,
  });
}

// Register dynamic resolvers for default constructors across codebase
registerUnifiConfigResolver(() => getCachedUnifiConfig());
registerMikrotikConfigResolver(() => {
  const c = getCachedMikrotikConfig();
  return {
    host: c.host,
    username: c.username,
    password: c.password,
    allowInsecure: c.allowInsecure,
  };
});

// Eagerly prefetch database configuration into memory
if (typeof window === 'undefined') {
  getUnifiConfig().catch(() => {});
  getMikrotikConfig().catch(() => {});
}
