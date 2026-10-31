import { recordId } from '@/lib/network/paths';
import { deviceFetch } from '@/lib/network/transport';
// ============================================
// UniFi Controller API Client
// Supports: UniFi OS / UniFi Network API v6+
// ============================================

import {
  UnifiDevice,
  UnifiUser,
  UnifiWlanConf,
  UnifiSite,
  UnifiDashboardStats,
  UnifiHealth,
  UnifiAlert,
  UnifiNetwork,
  UnifiUserGroup,
  UnifiFirewallRule,
  UnifiPortForward,
  UnifiDhcpReservation,
  UnifiDhcpPool,
  UnifiUplink,
  UnifiSsidRequest,
  UnifiPortRequest,
  UnifiRadioRequest,
  UnifiDeviceNameRequest,
  UnifiLedSettingsRequest,
  UnifiNetworkRequest,
  UnifiUserGroupRequest,
  UnifiDhcpReservationRequest,
  UnifiPortForwardRequest,
  UnifiFirewallRuleRequest,
  UnifiDpiRequest,
  UnifiAdoptionRequest,
  UnifiSpeedtestRequest,
  UnifiFirmwareUpdateRequest,
  UnifiLoginRequest,
  UnifiLoginResponse,
  UnifiApiResponse,
  UnifiListResponse,
  UnifiControllerInfo,
  UnifiBlockClientRequest,
  UnifiUnblockClientRequest,
  UnifiRogueAp,
  UnifiEvent,
  UnifiOverview,
} from '@/types/unifi';

const DEFAULT_CONTROLLER_URL = process.env.UNIFI_CONTROLLER_URL || 'https://192.168.1.200:11443';
const DEFAULT_USERNAME = process.env.UNIFI_USERNAME || '';
const DEFAULT_PASSWORD = process.env.UNIFI_PASSWORD || '';
const DEFAULT_SITE = process.env.UNIFI_SITE || 'default';

let dynamicUnifiResolver: (() => Partial<UnifiClientConfig>) | null = null;

export function registerUnifiConfigResolver(resolver: () => Partial<UnifiClientConfig>): void {
  dynamicUnifiResolver = resolver;
}

export interface UnifiClientConfig {
  controllerUrl: string;
  username: string;
  password: string;
  site: string;
  rejectUnauthorized: boolean;
  apiKey?: string;
  version?: string | null;
  apiMode?: 'legacy' | 'official';
  apiPrefix?: string;
}

interface CachedSession {
  cookie: string;
  csrfToken: string | null;
  expiresAt: number;
}

export class UnifiClient {
  private static sessionCache = new Map<string, CachedSession>();

  public static clearSessionCache(): void {
    UnifiClient.sessionCache.clear();
  }
  private baseUrl: string;
  private username: string;
  private password: string;
  private site: string;
  private rejectUnauthorized: boolean;
  private csrfToken: string | null = null;
  private cookie: string | null = null;
  private siteResolved = false;
  private apiKey?: string;
  private apiMode: 'legacy' | 'official';
  private apiPrefix: string;
  private legacyPrefix: string;
  public version: string | null;


  constructor(config: Partial<UnifiClientConfig> = {}) {
    const dynamic = dynamicUnifiResolver ? dynamicUnifiResolver() : {};
    let rawUrl = (config.controllerUrl || dynamic.controllerUrl || DEFAULT_CONTROLLER_URL).trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.username = config.username || dynamic.username || DEFAULT_USERNAME;
    this.password = config.password || dynamic.password || DEFAULT_PASSWORD;
    this.site = recordId(config.site || dynamic.site || DEFAULT_SITE);
    this.rejectUnauthorized = config.rejectUnauthorized ?? dynamic.rejectUnauthorized ?? true;
    this.apiMode = config.apiMode === 'legacy' ? 'legacy' : config.apiMode === 'official' || config.apiKey ? 'official' : 'legacy';
    this.apiKey = this.apiMode === 'official' ? config.apiKey : undefined;
    this.apiPrefix = config.apiPrefix === '' || config.apiPrefix === '/integration/v1' ? '/integration/v1' : '/proxy/network/integration/v1';
    this.version = config.version || null;
    this.legacyPrefix = config.apiPrefix === '/proxy/network' ? '/proxy/network' : '';
  }

  private getEndpointCandidates(endpoint: string): string[] {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    if (normalized.startsWith('/proxy/network')) {
      const unproxied = normalized.replace('/proxy/network', '');
      return [normalized, unproxied];
    }

    const candidates = this.legacyPrefix && (normalized.startsWith('/api/s/') || normalized.startsWith('/v2/api/'))
      ? [`${this.legacyPrefix}${normalized}`]
      : [normalized];

    if (normalized.startsWith('/api/') || normalized.startsWith('/v2/api/')) {
      candidates.push(`/proxy/network${normalized}`);
    }

    return Array.from(new Set(candidates));
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private toBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false;
      }
    }

    return fallback;
  }

  private normalizeDevice(device: any): UnifiDevice {
    const statusFromState: Record<number, UnifiDevice['status']> = {
      0: 'offline',
      1: 'online',
      2: 'upgrading',
      3: 'disconnected',
    };

    const state = this.toOptionalNumber(device?.state);
    const status =
      (typeof device?.status === 'string' ? device.status : undefined) ||
      (state !== undefined ? statusFromState[state] : undefined) ||
      (device?.disconnected_at ? 'offline' : 'unknown');

    const normalizedType =
      device?.type ||
      (typeof device?.model === 'string' && device.model.toLowerCase().includes('usw')
        ? 'usw'
        : typeof device?.model === 'string' && device.model.toLowerCase().includes('uap')
          ? 'uap'
          : typeof device?.model === 'string' && device.model.toLowerCase().includes('udm')
            ? 'udm'
            : typeof device?.model === 'string' && device.model.toLowerCase().includes('ugw')
              ? 'ugw'
              : 'uap');

    return {
      ...device,
      radioTable: device.radioTable || device.radio_table,
      portTable: device.portTable || device.port_table,
      portOverrides: device.port_overrides,
      _id: device?._id || device?.id || device?.mac || '',
      deviceId: device?.deviceId || device?._id || device?.id || device?.mac || '',
      mac: device?.mac || device?.macAddress || '',
      name: device?.name || device?.hostname || device?.model || device?.mac || 'Unknown Device',
      model: device?.model || 'Unknown',
      type: normalizedType,
      status,
      isConnected: status === 'online',
      ipAddress: device?.ipAddress || device?.ip || device?.config_network?.ip,
      serialNumber: device?.serialNumber || device?.serial,
      uptime: this.toOptionalNumber(device?.uptime),
      guestNumSta: this.toOptionalNumber(device?.guestNumSta ?? device?.guest_num_sta),
      userNumSta: this.toOptionalNumber(device?.userNumSta ?? device?.num_sta),
      txBytes: this.toOptionalNumber(device?.txBytes ?? device?.tx_bytes),
      rxBytes: this.toOptionalNumber(device?.rxBytes ?? device?.rx_bytes),
      txPackets: this.toOptionalNumber(device?.txPackets ?? device?.tx_packets),
      rxPackets: this.toOptionalNumber(device?.rxPackets ?? device?.rx_packets),
      cpuUsage: this.toOptionalNumber(device?.cpuUsage ?? device?.cpu_usage ?? device?.system_stats?.cpu),
      memUsage: this.toOptionalNumber(device?.memUsage ?? device?.mem_usage ?? device?.system_stats?.mem),
    };
  }

  private normalizeClient(user: any): UnifiUser {
    const mac = user?.mac || user?.macAddress || '';
    const isWireless = this.toBoolean(user?.isWireless ?? user?.is_wireless, !this.toBoolean(user?.isWired ?? user?.is_wired, false));
    const isWired = this.toBoolean(user?.isWired ?? user?.is_wired, !isWireless);

    return {
      ...user,
      _id: user?._id || user?.id || mac || '',
      mac,
      ip: user?.ip || user?.ipAddress,
      hostname: user?.hostname || undefined,
      isGuest: (user?.isGuest ?? user?.is_guest ?? user?.guest) == null ? undefined : this.toBoolean(user?.isGuest ?? user?.is_guest ?? user?.guest, false),
      isWireless,
      isWired,
      isBlocked: this.toBoolean(user?.isBlocked ?? user?.blocked, false),
      authorized: user?.authorized == null ? undefined : this.toBoolean(user.authorized, false),
      apMac: user?.apMac || user?.ap_mac,
      apName: user?.apName || user?.ap_name,
      ssid: user?.ssid || user?.essid,
      channel: this.toOptionalNumber(user?.channel),
      uptime: this.toOptionalNumber(user?.uptime),
      rxBytes: this.toOptionalNumber(user?.rxBytes ?? user?.rx_bytes),
      txBytes: this.toOptionalNumber(user?.txBytes ?? user?.tx_bytes),
      rxPackets: this.toOptionalNumber(user?.rxPackets ?? user?.rx_packets),
      txPackets: this.toOptionalNumber(user?.txPackets ?? user?.tx_packets),
      signal: this.toOptionalNumber(user?.signal ?? user?.rssi),
      noise: this.toOptionalNumber(user?.noise),
      rssi: this.toOptionalNumber(user?.rssi),
      assocTime: this.toOptionalNumber(user?.assocTime ?? user?.assoc_time),
      inactivityTime: this.toOptionalNumber(user?.inactivityTime ?? user?.idle),
      txRetries: this.toOptionalNumber(user?.txRetries ?? user?.tx_retries),
      firstSeen: this.toOptionalNumber(user?.firstSeen ?? user?.first_seen),
      lastSeen: this.toOptionalNumber(user?.lastSeen ?? user?.last_seen),
      networkName: user?.networkName || user?.network || user?.network_name,
      osName: user?.osName || user?.fingerprintOs || user?.fingerprint_os,
    };
  }

  private normalizeAlert(alert: any): UnifiAlert {
    const timestamp = this.toOptionalNumber(alert?.datetime ?? alert?.time ?? alert?.timestamp) || Date.now();
    const rawSeverity = String(alert?.severity || alert?.subsystem || 'info').toLowerCase();
    const severity: UnifiAlert['severity'] =
      rawSeverity.includes('critical') || rawSeverity.includes('error')
        ? 'critical'
        : rawSeverity.includes('warn')
          ? 'warning'
          : rawSeverity.includes('notice')
            ? 'notice'
            : 'info';

    return {
      ...alert,
      _id: alert?._id || alert?.id || alert?.key || `alert-${timestamp}`,
      key: alert?.key || alert?.event_type || alert?.subsystem || 'event',
      name: alert?.name || alert?.event_type || alert?.subsystem || 'UniFi Event',
      message: alert?.message || alert?.msg || alert?.text || alert?.description || '',
      datetime: timestamp,
      severity,
      siteId: alert?.siteId || alert?.site_id || this.site,
      isArchived: this.toBoolean(alert?.isArchived ?? alert?.archived, false),
      isRead: this.toBoolean(alert?.isRead ?? alert?.read, false),
      isDismissed: this.toBoolean(alert?.isDismissed ?? alert?.dismissed, false),
    };
  }

  private normalizeSsid(ssid: any): UnifiWlanConf {
    const normalizedName = ssid?.ssid || ssid?.name || '';

    return {
      ...ssid,
      _id: ssid?._id || ssid?.id || normalizedName,
      name: ssid?.name || normalizedName,
      ssid: normalizedName,
      enabled: this.toBoolean(ssid?.enabled ?? ssid?.is_enabled, true),
      security: ssid?.security || 'open',
      wpaPsk: ssid?.wpaPsk || ssid?.wpa_psk || ssid?.x_passphrase || ssid?.passphrase || ssid?.wpa_passphrase,
      wpaCipher: ssid?.wpaCipher || ssid?.wpa_cipher,
      wpaVersion: ssid?.wpaVersion || ssid?.wpa_version,
      hiddenSSID: this.toBoolean(ssid?.hiddenSSID ?? ssid?.hideSSID ?? ssid?.hide_ssid, false),
      isGuest: this.toBoolean(ssid?.isGuest ?? ssid?.is_guest ?? ssid?.purpose === 'guest', false),
      userGroupId: ssid?.userGroupId || ssid?.usergroup_id,
      userGroupName: ssid?.userGroupName || ssid?.usergroup_name,
      vlanId: this.toOptionalNumber(ssid?.vlanId ?? ssid?.vlan),
      vlanEnabled: this.toBoolean(ssid?.vlanEnabled ?? (ssid?.vlanId ?? ssid?.vlan) !== undefined, false),
      macFilterEnabled: this.toBoolean(ssid?.macFilterEnabled ?? ssid?.mac_filter_enabled, false),
      macFilterList: Array.isArray(ssid?.macFilterList)
        ? ssid.macFilterList
        : Array.isArray(ssid?.mac_filter_list)
          ? ssid.mac_filter_list
          : [],
      macFilterPolicy: ssid?.macFilterPolicy || ssid?.mac_filter_policy,
      dtim: this.toOptionalNumber(ssid?.dtim),
      beaconInterval: this.toOptionalNumber(ssid?.beaconInterval ?? ssid?.beacon_interval),
      wlanBand: ssid?.wlanBand || ssid?.wlan_band || ssid?.band,
      scheduleEnabled: this.toBoolean(ssid?.scheduleEnabled ?? ssid?.schedule_enabled, false),
      schedule: ssid?.schedule,
      minRSSI: this.toOptionalNumber(ssid?.minRSSI ?? ssid?.minrssi),
      loadBalanceEnabled: this.toBoolean(ssid?.loadBalanceEnabled ?? ssid?.loadBalancingEnabled ?? ssid?.load_balance_enabled, false),
      isolationEnabled: this.toBoolean(ssid?.isolationEnabled ?? ssid?.isolateClients ?? ssid?.isolation_enabled, false),
      authPortal: ssid?.authPortal || ssid?.auth_portal,
      portalEnabled: this.toBoolean(ssid?.portalEnabled ?? ssid?.portal_enabled, false),
      captivePortalBypassEnabled: this.toBoolean(ssid?.captivePortalBypassEnabled ?? ssid?.captive_portal_bypass_enabled, false),
      wpa3Transition: this.toBoolean(ssid?.wpa3Transition ?? ssid?.wpa3_transition, false),
      siteId: ssid?.siteId || ssid?.site_id || this.site,
    };
  }

  private normalizeNetwork(network: any): UnifiNetwork {
    return {
      ...network,
      _id: network?._id || network?.id || network?.name,
      siteId: network?.siteId || network?.site_id || this.site,
      name: network?.name || 'Unknown Network',
      purpose: network?.purpose || 'corporate',
      vlanId: this.toOptionalNumber(network?.vlanId ?? network?.vlan),
      vlanEnabled: this.toBoolean(network?.vlanEnabled ?? network?.vlan_enabled ?? network?.vlan !== undefined, false),
      ipSubnet: network?.ipSubnet || network?.ip_subnet,
      ipSubnetGw: network?.ipSubnetGw || network?.ip_subnet_gw,
      dhcpdEnabled: this.toBoolean(network?.dhcpdEnabled ?? network?.dhcpd_enabled, false),
      dhcpdStart: network?.dhcpdStart || network?.dhcpd_start,
      dhcpdStop: network?.dhcpdStop || network?.dhcpd_stop,
      dhcpdLease: this.toOptionalNumber(network?.dhcpdLease ?? network?.dhcpd_lease),
      domainName: network?.domainName || network?.domain_name,
      enabled: this.toBoolean(network?.enabled ?? !network?.disabled, true),
      isNat: this.toBoolean(network?.isNat ?? network?.nat_enabled ?? network?.wan_nat_enabled, true),
      numStations: this.toOptionalNumber(network?.numStations ?? network?.num_sta),
    };
  }

  private normalizeHealth(rawHealth: any): UnifiHealth {
    if (rawHealth && Array.isArray(rawHealth.subsystems)) {
      return rawHealth as UnifiHealth;
    }

    const source = Array.isArray(rawHealth) ? rawHealth : [];

    return {
      subsystems: source.map((item: any) => {
        const status = (item?.status || 'ok') as 'ok' | 'degraded' | 'down';
        const valueCandidates = [
          item?.num_user,
          item?.num_sta,
          item?.num_ap,
          item?.num_gw,
          item?.num_sw,
          item?.xput_down,
          item?.xput_up,
          item?.latency,
          item?.percentage,
        ];
        const numericValue = valueCandidates
          .map((candidate) => this.toOptionalNumber(candidate))
          .find((candidate) => candidate !== undefined) ?? 0;

        return {
          name: item?.subsystem || item?.name || 'unknown',
          status,
          statusColor:
            status === 'ok'
              ? 'green'
              : status === 'degraded'
                ? 'amber'
                : 'red',
          metric: item?.subsystem || item?.name || 'metric',
          value: numericValue,
          unit: typeof item?.unit === 'string' ? item.unit : '',
        };
      }),
    };
  }

  private async resolveSite(): Promise<void> {
    if (this.siteResolved) return;
    // Explicit site names/IDs never fall back to another site.
    if (!/^[A-Za-z0-9_-]+$/.test(this.site)) throw new Error('Site UniFi không hợp lệ');
    this.siteResolved = true;
  }

  getSiteId(): string { return this.site; }

  isOfficialApi(): boolean { return this.apiMode === 'official'; }

  private async officialList(path: string): Promise<any[]> {
    const rows: any[] = [];
    for (;;) {
      const page: any = await this.officialGet(`${path}?offset=${rows.length}&limit=200`);
      if (!Array.isArray(page.data)) throw new Error('Phản hồi danh sách API chính thức không hợp lệ');
      rows.push(...page.data);
      if (typeof page.totalCount === 'number' ? rows.length >= page.totalCount : page.data.length < (page.limit || 200)) return rows;
      if (!page.data.length || rows.length >= 100000) throw new Error('Danh sách API không tiến triển hoặc vượt giới hạn an toàn');
    }
  }

  async officialGet(path: string): Promise<unknown> {
    if (!this.apiKey) throw new Error('API chính thức yêu cầu khóa API đã cấu hình');
    return this.request(`${this.apiPrefix}${path}`, { method: 'GET' });
  }

  async rawRequest(path: string, method = 'GET', body?: unknown): Promise<any> {
    const { validateRelativePath } = await import('@/lib/network/paths');
    validateRelativePath(path);
    return this.request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async siteRequest(path: string, method = 'GET', body?: unknown): Promise<any> {
    if (this.isOfficialApi()) throw new Error('Quản lý cấu hình cũ cần phiên đăng nhập; chế độ khóa API chỉ hỗ trợ endpoint chính thức đã phát hiện');
    return this.rawRequest(`/api/s/${this.site}/${path}`, method, body);
  }

  // ============================================
  // Core HTTP Methods
  // ============================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { validateRelativePath } = await import('@/lib/network/paths');
    validateRelativePath(endpoint);
    if (this.isOfficialApi() && !endpoint.startsWith(this.apiPrefix)) throw new Error('Endpoint này cần kết nối phiên đăng nhập cũ; không được hỗ trợ trong chế độ API chính thức');
    const read = !options.method || options.method === 'GET';
    const candidates = read ? this.getEndpointCandidates(endpoint) : [this.legacyPrefix && endpoint.startsWith('/api/s/') ? `${this.legacyPrefix}${endpoint}` : endpoint];
    let lastError: Error | undefined;
    for (const candidate of candidates) {
      const response = await deviceFetch(`${this.baseUrl}${candidate}`, {
        ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(this.csrfToken ? { 'X-CSRF-Token': this.csrfToken } : {}), ...(options.headers || {}) },
      }, !this.rejectUnauthorized);
      const text = await response.text();
      let payload: any = {};
      let isJson = false;
      try {
        if (text) {
          payload = JSON.parse(text);
          isJson = true;
        } else {
          payload = {};
          isJson = true;
        }
      } catch {
        isJson = false;
      }
      if (!response.ok || !isJson || payload?.meta?.rc === 'error') {
        const errorMsg = payload?.meta?.msg || payload?.message || (!isJson && response.ok ? 'Controller trả về JSON không hợp lệ' : `UniFi API error: ${response.status}`);
        const isLoginEndpoint = candidate.includes('/login');
        if (!isLoginEndpoint && (response.status === 401 || errorMsg === 'api.err.LoginRequired') && !(options as any)?._retried) {
          const cacheKey = `${this.baseUrl}:${this.username}`;
          UnifiClient.sessionCache.delete(cacheKey);
          this.cookie = null;
          this.csrfToken = null;
          try {
            await this.login();
            return await this.request<T>(endpoint, { ...(options || {}), _retried: true } as RequestInit);
          } catch {
            // If re-login fails, throw original error
          }
        }
        lastError = Object.assign(new Error(errorMsg), { status: response.status });
        if (read && response.status === 404) continue;
        throw lastError;
      }
      if (candidate.startsWith('/proxy/network/api/s/') || candidate.startsWith('/proxy/network/v2/api/')) this.legacyPrefix = '/proxy/network';
      const cookie = response.headers.get('set-cookie');
      if (cookie) this.cookie = cookie.split(';')[0];
      this.csrfToken = response.headers.get('x-csrf-token') || this.csrfToken;
      return payload as T;
    }
    throw lastError || new Error('UniFi request failed');
  }

  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  private async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  private async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ============================================
  // Authentication
  // ============================================

  async login(credentials?: UnifiLoginRequest): Promise<UnifiLoginResponse> {
    if (this.apiKey) {
      const info = await this.officialGet('/info') as {applicationVersion?:string};
      if (!info.applicationVersion) throw new Error('API chính thức không trả về phiên bản ứng dụng');
      this.version = info.applicationVersion;
      await this.resolveSite();
      return { username: this.username } as UnifiLoginResponse;
    }
    const loginData = credentials || { username: this.username, password: this.password };
    const cacheKey = `${this.baseUrl}:${loginData.username}`;

    // 1. Check cached session first
    const cached = UnifiClient.sessionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt - 60000) {
      this.cookie = cached.cookie;
      this.csrfToken = cached.csrfToken;
      await this.resolveSite();
      return { username: loginData.username } as UnifiLoginResponse;
    }

    // 2. Try classic controller /api/login first, then UniFi OS /api/auth/login
    const endpoints = [
      '/api/login',
      '/api/auth/login',
      `/api/s/${this.site}/login`,
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await this.post<any>(endpoint, {
          username: loginData.username,
          password: loginData.password,
        });

        // Login success: captured cookie/csrfToken in request(), or valid response payload
        if (
          this.cookie ||
          this.csrfToken ||
          response?.token ||
          response?.cookie ||
          response?.username ||
          response?.id ||
          response?.meta?.rc === 'ok'
        ) {
          let expiresAt = Date.now() + 3600 * 1000;
          if (this.cookie) {
            const match = this.cookie.match(/TOKEN=([^;]+)/);
            if (match) {
              try {
                const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
                if (payload.exp) {
                  expiresAt = payload.exp * 1000;
                }
              } catch {}
            }
          }

          if (this.cookie) {
            UnifiClient.sessionCache.set(cacheKey, {
              cookie: this.cookie,
              csrfToken: this.csrfToken,
              expiresAt,
            });
          }

          await this.resolveSite();
          return response;
        }
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw lastError || new Error('Login failed');
  }

  async logout(remote = false): Promise<void> {
    if (remote) {
      const endpoints = [
        '/api/auth/logout',
        '/api/logout',
      ];

      for (const endpoint of endpoints) {
        try {
          await this.post(endpoint);
        } catch {
          // Ignore errors during logout
        }
      }
      UnifiClient.sessionCache.delete(`${this.baseUrl}:${this.username}`);
    }

    this.csrfToken = null;
    this.cookie = null;
  }

  isAuthenticated(): boolean {
    return !!(this.csrfToken || this.cookie);
  }

  getCurrentSite(): string {
    return this.site;
  }

  // ============================================
  // System Info
  // ============================================

  async getControllerInfo(): Promise<UnifiControllerInfo> {
    if (this.isOfficialApi()) { if(!this.version)await this.login(); return {name:'UniFi Network',version:this.version||'Unknown',baseUrl:this.baseUrl}; }
    const endpoints = [
      `/api/s/${this.site}/stat/sysinfo`,
      '/status',
      '/api/v1/info',
      '/api/systat',
    ];

    let lastMissing: unknown;
    for (const endpoint of Array.from(new Set(endpoints))) {
      try {
        const response = await this.get<{ data: Array<UnifiControllerInfo> } | UnifiControllerInfo>(endpoint);
        const serverVersion=(response as {meta?:{server_version?:string}}).meta?.server_version;
        if(serverVersion)return {name:'UniFi Network',version:serverVersion,baseUrl:this.baseUrl};
        if (Array.isArray(response)) {
          return response[0];
        }
        if ('data' in response && Array.isArray(response.data)) {
          return response.data[0];
        }
        return response as UnifiControllerInfo;
      } catch (error) {
        if ((error as {status?:number}).status !== 404) throw error;
        lastMissing = error;
      }
    }

    throw lastMissing || new Error('Không tìm thấy endpoint thông tin controller');
  }

  async getSites(): Promise<UnifiSite[]> {
    if (this.isOfficialApi()) return (await this.officialList('/sites')).map((s:any) => ({ ...s, _id:s.id, name:s.id, desc:s.name }));
    const response = await this.get<UnifiListResponse<UnifiSite>>('/api/self/sites');
    if (!Array.isArray(response.data)) throw new Error('Phản hồi danh sách site không hợp lệ');
    return response.data;
  }

  async getDevices(): Promise<UnifiDevice[]> {
    const rows = this.isOfficialApi() ? await this.officialList(`/sites/${this.site}/devices`) : (await this.get<UnifiListResponse<UnifiDevice>>(`/api/s/${this.site}/stat/device`)).data;
    if (!Array.isArray(rows)) throw new Error('Phản hồi danh sách thiết bị không hợp lệ');
    return rows.map((d:any) => this.normalizeDevice({ ...d, status: d.state?.toLowerCase?.() || d.status }));
  }

  async getDevice(deviceId: string): Promise<UnifiDevice | null> {
    if (this.isOfficialApi()) return this.normalizeDevice(await this.officialGet(`/sites/${this.site}/devices/${recordId(deviceId)}`));
    const endpoints = [
      `/api/s/${this.site}/stat/device/${recordId(deviceId)}`,
      `/api/s/${this.site}/stat/device/${recordId(deviceId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: UnifiDevice[] } | UnifiDevice>(endpoint);
        if ('data' in response && response.data) {
          return response.data[0] ? this.normalizeDevice(response.data[0]) : null;
        }
        return this.normalizeDevice(response);
      } catch (error) { throw error; }
    }

    return null;
  }

  async getAccessPoints(): Promise<UnifiDevice[]> {
    const devices = await this.getDevices();
    return devices.filter(d =>
      d.type === 'uap' ||
      d.type === 'udm' ||
      d.model?.toLowerCase().includes('uap') ||
      d.model?.toLowerCase().includes('unifi')
    );
  }

  async getSwitches(): Promise<UnifiDevice[]> {
    const devices = await this.getDevices();
    return devices.filter(d =>
      d.type === 'usw' ||
      d.type === 'switch' ||
      d.model?.toLowerCase().includes('usw') ||
      d.model?.toLowerCase().includes('switch')
    );
  }

  async getGateways(): Promise<UnifiDevice[]> {
    const devices = await this.getDevices();
    return devices.filter(d =>
      d.type === 'ugw' ||
      d.type === 'router' ||
      d.model?.toLowerCase().includes('ugw') ||
      d.model?.toLowerCase().includes('router')
    );
  }

  private async deviceCommand(deviceId: string, cmd: string): Promise<boolean> {
    const device = await this.getDevice(deviceId);
    if (!device?.mac) throw new Error('Thiết bị không có địa chỉ MAC quan sát được');
    const response = await this.post<{meta?:{rc:string}}>(`/api/s/${this.site}/cmd/devmgr`, cmd==='forget'?{cmd,macs:[device.mac]}:{cmd,mac:device.mac});
    return response?.meta?.rc==='ok';
  }

  async adoptDevice(deviceId: string): Promise<boolean> { return this.deviceCommand(deviceId, 'adopt'); }

  async renameDevice(deviceId: string, name: string): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${recordId(deviceId)}`,
        { name }
      );

      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async setDeviceLedSettings(deviceId: string, settings: UnifiLedSettingsRequest): Promise<boolean> {
    try {
      const payload: Record<string, unknown> = {};
      if (settings.enabled !== undefined) payload.led_enabled = settings.enabled;
      if (settings.reverse !== undefined) payload.led_reverse = settings.reverse;

      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${recordId(deviceId)}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async rebootDevice(deviceId: string): Promise<boolean> { return this.deviceCommand(deviceId, 'restart'); }
  async restartDevice(deviceId: string): Promise<boolean> { return this.deviceCommand(deviceId, 'restart'); }
  async setLocate(deviceId: string, locate = true): Promise<boolean> { return this.deviceCommand(deviceId, locate ? 'set-locate' : 'unset-locate'); }
  async forceProvision(deviceId: string): Promise<boolean> { return this.deviceCommand(deviceId, 'force-provision'); }
  async upgradeDeviceFirmware(deviceId: string): Promise<boolean> { return this.deviceCommand(deviceId, 'upgrade'); }
  async forgetDevice(deviceId: string): Promise<boolean> { return this.deviceCommand(deviceId, 'forget'); }

  async getDeviceUplink(mac: string): Promise<UnifiUplink | null> {
    try {
      const response = await this.get<{ uplink?: UnifiUplink }>(
        `/api/s/${this.site}/stat/uplink/${recordId(mac)}`
      );
      return response?.uplink || null;
    } catch (error) { throw error; }
  }

  // ============================================
  // Clients / Users
  // ============================================

  async getClients(_force?: boolean): Promise<UnifiUser[]> {
    const rows = this.isOfficialApi() ? await this.officialList(`/sites/${this.site}/clients`) : (await this.get<UnifiListResponse<UnifiUser>>(`/api/s/${this.site}/stat/sta`)).data;
    if (!Array.isArray(rows)) throw new Error('Phản hồi danh sách máy khách không hợp lệ');
    return rows.map((c:any) => this.normalizeClient(c));
  }

  async getGuests(): Promise<UnifiUser[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiUser>>(
        `/api/s/${this.site}/stat/guest`
      );
      return (response.data || []).map((user) => this.normalizeClient(user));
    } catch (error) { throw error; }
  }

  async getClient(mac: string): Promise<UnifiUser | null> {
    if (this.isOfficialApi()) return (await this.getClients()).find(client=>client.mac.toLowerCase()===mac.toLowerCase()||client._id===mac)||null;
    try {
      const response = await this.get<{ data: UnifiUser[] }>(
        `/api/s/${this.site}/stat/sta/${recordId(mac)}`
      );
      return response.data?.[0] ? this.normalizeClient(response.data[0]) : null;
    } catch (error) { throw error; }
  }

  private async clientCommand(mac: string, cmd: string): Promise<boolean> {
    if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(mac)) throw new Error('Địa chỉ MAC không hợp lệ');
    const response = await this.post<{meta?:{rc:string}}>(`/api/s/${this.site}/cmd/stamgr`, {cmd,mac});
    return response?.meta?.rc==='ok';
  }
  async blockClient(mac: string): Promise<boolean> { return this.clientCommand(mac,'block-sta'); }
  async unblockClient(mac: string): Promise<boolean> { return this.clientCommand(mac,'unblock-sta'); }
  async reconnectClient(mac: string): Promise<boolean> { return this.clientCommand(mac,'kick-sta'); }
  async kickClient(mac: string): Promise<boolean> { return this.clientCommand(mac,'kick-sta'); }
  async authorizeGuest(mac: string, minutes = 1440, apMac?: string): Promise<boolean> {
    if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(mac)) throw new Error('Địa chỉ MAC không hợp lệ');
    if (apMac !== undefined && !/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(apMac)) throw new Error('Địa chỉ MAC AP không hợp lệ');
    const response = await this.post<{ meta?: { rc: string } }>(`/api/s/${this.site}/cmd/stamgr`, {
      cmd: 'authorize-guest',
      mac,
      minutes,
      ...(apMac ? { ap_mac: apMac.toLowerCase() } : {}),
    });
    return response?.meta?.rc === 'ok';
  }
  async unauthorizeGuest(mac: string): Promise<boolean> {
    if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(mac)) throw new Error('Địa chỉ MAC không hợp lệ');
    const response = await this.post<{ meta?: { rc: string } }>(`/api/s/${this.site}/cmd/stamgr`, {
      cmd: 'unauthorize-guest',
      mac,
    });
    return response?.meta?.rc === 'ok';
  }
  async setClientNoteAndName(mac: string, name?: string, note?: string): Promise<boolean> {
    if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(mac)) throw new Error('Địa chỉ MAC không hợp lệ');
    let userId: string | null = null;
    const client = await this.getClient(mac).catch(() => null);
    userId = (client as any)?._id || (client as any)?.user_id || null;

    const payload: Record<string, any> = {};
    if (name !== undefined) payload.name = name.trim();
    if (note !== undefined) {
      payload.note = note.trim();
      payload.noted = Boolean(note.trim());
    }

    if (userId) {
      const res = await this.post<{ meta?: { rc: string } }>(`/api/s/${this.site}/upd/user/${userId}`, payload);
      if (res?.meta?.rc === 'ok') return true;
    }

    // Fallback: try rest/user with mac
    const res = await this.post<{ meta?: { rc: string } }>(`/api/s/${this.site}/rest/user`, {
      mac,
      ...payload,
    });
    return res?.meta?.rc === 'ok';
  }

  async getRogueAps(): Promise<UnifiRogueAp[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiRogueAp>>(
        `/api/s/${this.site}/stat/rogueap`
      );
      return response.data || [];
    } catch (error) { throw error; }
  }

  // ============================================
  // SSID / WLAN Configuration
  // ============================================

  async getWlanConfs(): Promise<UnifiWlanConf[]> {
    const endpoints = [
      `/api/s/${this.site}/rest/wlanconf`,
      `/api/s/${this.site}/list/wlanconf`,
      `/api/s/${this.site}/rest/wlanconf`,
      `/api/s/${this.site}/list/wlanconf`,
    ];

    const merged = new Map<string, UnifiWlanConf>();

    let lastMissing: unknown;
    let succeeded = false;
    for (const endpoint of Array.from(new Set(endpoints))) {
      try {
        const response = await this.get<UnifiListResponse<UnifiWlanConf>>(endpoint);
        if (!Array.isArray(response.data)) throw new Error('Phản hồi danh sách UniFi không hợp lệ');
        succeeded = true;
        if (response.data) {
          for (const item of response.data) {
            const normalized = this.normalizeSsid(item);
            const key = normalized._id || normalized.ssid || normalized.name;
            if (!key) {
              continue;
            }

            const existing = merged.get(key);
            if (!existing) {
              merged.set(key, normalized);
              continue;
            }

            merged.set(key, {
              ...normalized,
              wpaPsk: normalized.wpaPsk || existing.wpaPsk,
              ssid: normalized.ssid || existing.ssid,
              name: normalized.name || existing.name,
            });
          }
        }
      } catch (error) {
        if ((error as {status?:number}).status !== 404) throw error;
        lastMissing = error;
      }
    }

    if (!succeeded) throw lastMissing || new Error('Không tìm thấy endpoint danh sách UniFi');
    return Array.from(merged.values());
  }

  async getSsidById(wlanConfId: string): Promise<UnifiWlanConf | null> {
    const endpoints = [
      `/api/s/${this.site}/rest/wlanconf/${recordId(wlanConfId)}`,
      `/api/s/${this.site}/list/wlanconf/${recordId(wlanConfId)}`,
      `/api/s/${this.site}/rest/wlanconf/${recordId(wlanConfId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: UnifiWlanConf[] }>(endpoint);
        if (response.data?.[0]) {
          return this.normalizeSsid(response.data[0]);
        }
      } catch (error) { throw error; }
    }

    return null;
  }

  private mapSecurityToUniFi(security?: string, wpa3Transition?: boolean): {
    security: string;
    wpa_mode?: string;
    wpa_enc?: string;
    wpa3_support?: boolean;
    wpa3_transition?: boolean;
    pmf_mode?: string;
  } {
    const sec = (security || 'wpapsk').toLowerCase().trim();
    if (sec === 'open') {
      return { security: 'open' };
    }
    if (sec === 'wep') {
      return { security: 'wep' };
    }
    if (sec === 'wpaeap' || sec === 'wpa3-ent' || sec === 'wpaowpa2ent') {
      return {
        security: 'wpaeap',
        wpa_mode: 'wpa2',
        wpa_enc: 'ccmp',
      };
    }
    if (sec === 'wpapsk+ wpa2psk' || sec === 'wpawpa2psk' || sec === 'both') {
      return {
        security: 'wpapsk',
        wpa_mode: 'both',
        wpa_enc: 'both',
      };
    }
    if (sec === 'wpa3') {
      return {
        security: 'wpapsk',
        wpa_mode: 'wpa2',
        wpa_enc: 'ccmp',
        wpa3_support: true,
        wpa3_transition: true,
        pmf_mode: 'optional',
      };
    }
    // Default to WPA2 Personal (wpapsk / wpa2psk)
    return {
      security: 'wpapsk',
      wpa_mode: 'wpa2',
      wpa_enc: 'ccmp',
      wpa3_support: Boolean(wpa3Transition),
      wpa3_transition: Boolean(wpa3Transition),
      pmf_mode: wpa3Transition ? 'optional' : 'disabled',
    };
  }

  async createSsid(ssid: UnifiSsidRequest): Promise<UnifiWlanConf | null> {
    try {
      // 1. Discover AP Group IDs for UniFi OS / Network 7+
      let apGroupIds = ssid.apGroupIds || [];
      if (!apGroupIds || apGroupIds.length === 0) {
        try {
          let apGroupRes: any = null;
          try {
            apGroupRes = await this.get<any>(`/v2/api/site/${this.site}/apgroups`);
          } catch {
            apGroupRes = await this.get<any>(`/proxy/network/v2/api/site/${this.site}/apgroups`).catch(() => null);
          }
          if (Array.isArray(apGroupRes)) {
            const defaultGroup = apGroupRes.find((g: any) => g.attr_hidden_id === 'default') || apGroupRes[0];
            if (defaultGroup?._id) {
              apGroupIds = [defaultGroup._id];
            }
          }
        } catch {
          // Gracefully continue even if AP groups cannot be queried
        }
      }

      const wlanBands = ssid.wlanBand === '2g'
        ? ['2g']
        : ssid.wlanBand === '5g'
          ? ['5g']
          : ssid.wlanBand === '6g'
            ? ['6g']
            : ['2g', '5g'];

      const secConf = this.mapSecurityToUniFi(ssid.security, ssid.wpa3Transition);

      const payload: Record<string, any> = {
        name: ssid.name,
        ssid: ssid.name,
        ...secConf,
        enabled: ssid.enabled ?? true,
        is_guest: ssid.isGuest ?? false,
        hide_ssid: ssid.hideSsid || false,
        wlan_band: ssid.wlanBand || 'both',
        wlan_bands: wlanBands,
        ap_group_mode: 'all',
      };

      if (apGroupIds.length > 0) {
        payload.ap_group_ids = apGroupIds;
      }

      if (secConf.security !== 'open' && ssid.passphrase) {
        payload.passphrase = ssid.passphrase;
        payload.x_passphrase = ssid.passphrase;
      }

      if (ssid.vlanEnabled && ssid.vlanId) {
        payload.vlan_enabled = true;
        payload.vlan = Number(ssid.vlanId);
      }

      if (ssid.userGroupId && ssid.userGroupId !== 'default') {
        payload.usergroup_id = ssid.userGroupId;
      }

      if (ssid.isolateClients) {
        payload.l2_isolation = true;
      }

      const response = await this.post<{ data: UnifiWlanConf[] }>(
        `/api/s/${this.site}/rest/wlanconf`,
        payload
      );

      return response.data?.[0] ? this.normalizeSsid(response.data[0]) : null;
    } catch (err) { throw err; }
  }

  async updateSsid(wlanConfId: string, ssid: Partial<UnifiSsidRequest>): Promise<boolean> {
    try {
      const payload: Record<string, unknown> = {};
      if (ssid.name !== undefined) { payload.name = ssid.name; payload.ssid = ssid.name; }
      if (ssid.security !== undefined) {
        const secConf = this.mapSecurityToUniFi(ssid.security, ssid.wpa3Transition);
        Object.assign(payload, secConf);
      }
      if (ssid.passphrase !== undefined && ssid.passphrase) {
        payload.passphrase = ssid.passphrase;
        payload.x_passphrase = ssid.passphrase;
      }
      if (ssid.hideSsid !== undefined) payload.hide_ssid = ssid.hideSsid;
      if (ssid.enabled !== undefined) payload.enabled = ssid.enabled;
      if (ssid.isGuest !== undefined) payload.is_guest = ssid.isGuest;
      if (ssid.vlanId !== undefined) payload.vlan = Number(ssid.vlanId);
      if (ssid.vlanEnabled !== undefined) payload.vlan_enabled = ssid.vlanEnabled;
      if (ssid.userGroupId !== undefined) payload.usergroup_id = ssid.userGroupId;
      if (ssid.isolateClients !== undefined) payload.l2_isolation = ssid.isolateClients;
      if (ssid.macFilterEnabled !== undefined) payload.mac_filter_enabled = ssid.macFilterEnabled;
      if (ssid.macFilterList !== undefined) payload.mac_filter_list = ssid.macFilterList;
      if (ssid.macFilterPolicy !== undefined) payload.mac_filter_policy = ssid.macFilterPolicy;
      if (ssid.wlanBand !== undefined) {
        payload.wlan_band = ssid.wlanBand;
        payload.wlan_bands = ssid.wlanBand === '2g'
          ? ['2g']
          : ssid.wlanBand === '5g'
            ? ['5g']
            : ssid.wlanBand === '6g'
              ? ['6g']
              : ['2g', '5g'];
      }

      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/wlanconf/${recordId(wlanConfId)}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch (err) { throw err; }
  }

  async deleteSsid(wlanConfId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/wlanconf/${recordId(wlanConfId)}`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async enableSsid(wlanConfId: string): Promise<boolean> {
    return this.updateSsid(wlanConfId, { enabled: true });
  }

  async disableSsid(wlanConfId: string): Promise<boolean> {
    return this.updateSsid(wlanConfId, { enabled: false });
  }

  // ============================================
  // Networks
  // ============================================

  async getNetworks(): Promise<UnifiNetwork[]> {
    const endpoints = [
      `/api/s/${this.site}/rest/networkconf`,
      `/api/s/${this.site}/list/networkconf`,
      `/api/s/${this.site}/rest/networkconf`,
      `/api/s/${this.site}/list/networkconf`,
    ];

    const merged = new Map<string, UnifiNetwork>();

    let lastMissing: unknown;
    let succeeded = false;
    for (const endpoint of Array.from(new Set(endpoints))) {
      try {
        const response = await this.get<UnifiListResponse<UnifiNetwork>>(endpoint);
        if (!Array.isArray(response.data)) throw new Error('Phản hồi danh sách UniFi không hợp lệ');
        succeeded = true;
        if (response.data) {
          for (const item of response.data) {
            const normalized = this.normalizeNetwork(item);
            const key = normalized._id || normalized.name;
            if (!key) {
              continue;
            }
            merged.set(key, {
              ...(merged.get(key) || {}),
              ...normalized,
            });
          }
        }
      } catch (error) {
        if ((error as {status?:number}).status !== 404) throw error;
        lastMissing = error;
      }
    }

    if (!succeeded) throw lastMissing || new Error('Không tìm thấy endpoint danh sách UniFi');
    return Array.from(merged.values());
  }

  async getNetwork(networkId: string): Promise<UnifiNetwork | null> {
    const endpoints = [
      `/api/s/${this.site}/rest/networkconf/${recordId(networkId)}`,
      `/api/s/${this.site}/rest/networkconf/${recordId(networkId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: UnifiNetwork[] }>(endpoint);
        if (response.data?.[0]) {
          return this.normalizeNetwork(response.data[0]);
        }
      } catch (error) { throw error; }
    }

    return null;
  }

  async createNetwork(network: UnifiNetworkRequest): Promise<UnifiNetwork | null> {
    try {
      const payload = {
        name: network.name,
        purpose: network.purpose,
        vlanId: network.vlanId,
        vlanEnabled: network.vlanEnabled || false,
        ipSubnet: network.ipSubnet || '',
        ipSubnetGw: network.ipSubnetGw || '',
        dhcpdEnabled: network.dhcpdEnabled ?? true,
        dhcpdStart: network.dhcpdStart || '',
        dhcpdStop: network.dhcpdStop || '',
        dhcpdLease: network.dhcpdLease || 86400,
        domainName: network.domainName || '',
        dnsServer1: network.dnsServer1 || '',
        dnsServer2: network.dnsServer2 || '',
        enabled: network.enabled ?? true,
        isNat: network.isNat ?? true,
        igmpSnooping: network.igmpSnooping || '',
      };

      const response = await this.post<{ data: UnifiNetwork[] }>(
        `/api/s/${this.site}/rest/networkconf`,
        payload
      );
      return response.data?.[0] || null;
    } catch (error) { throw error; }
  }

  async updateNetwork(networkId: string, network: Partial<UnifiNetworkRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/networkconf/${recordId(networkId)}`,
        network
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async deleteNetwork(networkId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/networkconf/${recordId(networkId)}`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  // ============================================
  // User Groups
  // ============================================

  async getUserGroups(): Promise<UnifiUserGroup[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiUserGroup>>(
        `/api/s/${this.site}/rest/usergroup`
      );
      return response.data || [];
    } catch (error) { throw error; }
  }

  async createUserGroup(group: UnifiUserGroupRequest): Promise<UnifiUserGroup | null> {
    try {
      const response = await this.post<{ data: UnifiUserGroup[] }>(
        `/api/s/${this.site}/rest/usergroup`,
        group
      );
      return response.data?.[0] || null;
    } catch (error) { throw error; }
  }

  async updateUserGroup(groupId: string, group: Partial<UnifiUserGroupRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/usergroup/${recordId(groupId)}`,
        group
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async deleteUserGroup(groupId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/usergroup/${recordId(groupId)}`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  // ============================================
  // Port Management
  // ============================================

  async getPortTable(deviceId: string): Promise<UnifiDevice['portTable'] | null> {
    try {
      const device = await this.getDevice(deviceId);
      return device?.portTable || null;
    } catch (error) { throw error; }
  }

  async setPortSettings(deviceId: string, portIdx: number, settings: Partial<UnifiPortRequest>): Promise<boolean> {
    if (!Number.isInteger(portIdx) || portIdx < 1) throw new Error('Chỉ số cổng không hợp lệ');
    const device = await this.getDevice(deviceId) as any;
    if (!device || !(device.port_table || device.portTable || []).some((p:any)=>p.port_idx===portIdx)) throw new Error('Không tìm thấy cổng trên thiết bị');
    const overrides = device.port_overrides || device.portOverrides || [];
    const current = overrides.find((p:any)=>p.port_idx===portIdx) || {port_idx:portIdx};
    const updated = {...current};
    if (settings.poeMode) { if (!['auto','off','passthrough'].includes(settings.poeMode)) throw new Error('Chế độ PoE không hợp lệ'); updated.poe_mode=settings.poeMode; }
    if (settings.name!==undefined) updated.name=settings.name;
    if (settings.enable!==undefined) updated.op_mode=settings.enable?'switch':'disabled';
    const port_overrides = overrides.some((p:any)=>p.port_idx===portIdx)?overrides.map((p:any)=>p.port_idx===portIdx?updated:p):[...overrides,updated];
    const response=await this.put<{meta?:{rc:string}}>(`/api/s/${this.site}/rest/device/${recordId(deviceId)}`,{port_overrides});
    return response?.meta?.rc==='ok';
  }

  async enablePoE(deviceId: string, portIdx: number): Promise<boolean> {
    return this.setPortSettings(deviceId, portIdx, { poeMode: 'auto' });
  }

  async disablePoE(deviceId: string, portIdx: number): Promise<boolean> {
    return this.setPortSettings(deviceId, portIdx, { poeMode: 'off' });
  }

  // ============================================
  // Radio Settings
  // ============================================

  async getRadioSettings(deviceId: string): Promise<UnifiDevice['radioTable'] | null> {
    try {
      const device = await this.getDevice(deviceId);
      return device?.radioTable || null;
    } catch (error) { throw error; }
  }

  async updateRadioSettings(deviceId: string, settings: UnifiRadioRequest): Promise<boolean> {
    try {
      const payload: Record<string, unknown> = {};

      // Find and update the specific radio
      const radios = await this.getRadioSettings(deviceId);
      if (radios) {
        const radioIndex = radios.findIndex(r => r.radio === settings.radio);
        if (radioIndex >= 0) {
          const radio = radios[radioIndex];
          if (settings.enabled !== undefined) radio.isEnabled = settings.enabled;
          if (settings.channel !== undefined) {
            if (!radio.arm) radio.arm = {};
            radio.arm.channel = settings.channel;
          }
          if (settings.txPower !== undefined) {
            if (!radio.arm) radio.arm = {};
            radio.arm.txPower = settings.txPower;
            radio.arm.overrideTxPower = true;
          }
          if (settings.overrideChannelWidth !== undefined) {
            if (!radio.arm) radio.arm = {};
            radio.arm.overrideChannelWidth = settings.overrideChannelWidth;
          }
          payload.radio_table = radios;
        }
      }

      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${recordId(deviceId)}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async enableRadio(deviceId: string, radio: string): Promise<boolean> {
    return this.updateRadioSettings(deviceId, { deviceId, radio, enabled: true });
  }

  async disableRadio(deviceId: string, radio: string): Promise<boolean> {
    return this.updateRadioSettings(deviceId, { deviceId, radio, enabled: false });
  }

  // ============================================
  // Firewall Rules
  // ============================================

  async getFirewallRules(): Promise<UnifiFirewallRule[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiFirewallRule>>(
        `/api/s/${this.site}/rest/firewallrule`
      );
      return response.data || [];
    } catch (error) { throw error; }
  }

  async createFirewallRule(rule: UnifiFirewallRuleRequest): Promise<UnifiFirewallRule | null> {
    try {
      const payload = {
        name: rule.name,
        enabled: rule.enabled ?? true,
        action: rule.action,
        ruleset: rule.ruleset || 'WAN',
        src_ip: rule.src_ip || 'any',
        src_mac: rule.src_mac || '',
        dst_ip: rule.dst_ip || 'any',
        dst_port: rule.dst_port || '',
        protocols: rule.protocols || ['tcp'],
        logging: rule.logging ?? false,
      };

      const response = await this.post<{ data: UnifiFirewallRule[] }>(
        `/api/s/${this.site}/rest/firewallrule`,
        payload
      );
      return response.data?.[0] || null;
    } catch (error) { throw error; }
  }

  async updateFirewallRule(ruleId: string, rule: Partial<UnifiFirewallRuleRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/firewallrule/${recordId(ruleId)}`,
        rule
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async deleteFirewallRule(ruleId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/firewallrule/${recordId(ruleId)}`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  // ============================================
  // Port Forwards
  // ============================================

  async getPortForwards(): Promise<UnifiPortForward[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiPortForward>>(
        `/api/s/${this.site}/rest/portforward`
      );
      return response.data || [];
    } catch (error) { throw error; }
  }

  async createPortForward(forward: UnifiPortForwardRequest): Promise<UnifiPortForward | null> {
    try {
      const response = await this.post<{ data: UnifiPortForward[] }>(
        `/api/s/${this.site}/rest/portforward`,
        forward
      );
      return response.data?.[0] || null;
    } catch (error) { throw error; }
  }

  async updatePortForward(forwardId: string, forward: Partial<UnifiPortForwardRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/portforward/${recordId(forwardId)}`,
        forward
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async deletePortForward(forwardId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/portforward/${recordId(forwardId)}`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  // ============================================
  // DHCP
  // ============================================

  async getDhcpReservations(): Promise<UnifiDhcpReservation[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiDhcpReservation>>(
        `/api/s/${this.site}/rest/dhcpreservation`
      );
      return response.data || [];
    } catch (error) { throw error; }
  }

  async createDhcpReservation(reservation: UnifiDhcpReservationRequest): Promise<UnifiDhcpReservation | null> {
    try {
      const response = await this.post<{ data: UnifiDhcpReservation[] }>(
        `/api/s/${this.site}/rest/dhcpreservation`,
        reservation
      );
      return response.data?.[0] || null;
    } catch (error) { throw error; }
  }

  async deleteDhcpReservation(reservationId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/dhcpreservation/${recordId(reservationId)}`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async getDhcpPools(): Promise<UnifiDhcpPool[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiDhcpPool>>(
        `/api/s/${this.site}/rest/dhcppool`
      );
      return response.data || [];
    } catch (error) { throw error; }
  }

  // ============================================
  // Health & Stats
  // ============================================

  async getHealth(): Promise<UnifiHealth> {
    const endpoints = [
      `/api/s/${this.site}/stat/health`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: any[] }>(endpoint);
        if (Array.isArray(response.data) && response.data.length > 0) {
          return this.normalizeHealth(response.data);
        }
      } catch {
        // Continue to fallback
      }
    }

    return { subsystems: [] };
  }

  async getDashboardStats(): Promise<UnifiDashboardStats> {
    try {
      const response = await this.get<{ data: UnifiDashboardStats[] }>(
        `/api/s/${this.site}/stat/report/dashboard`
      );
      if (response.data?.[0]) {
        return response.data[0];
      }
    } catch {
      // /stat/report/dashboard is not supported on all controllers (e.g. returns 400 InvalidArgs or 404).
      // Fall through to compute dashboard stats from devices and clients.
    }

    const [devices, clients] = await Promise.all([
      this.getDevices().catch(() => []),
      this.getClients().catch(() => []),
    ]);

    const onlineDevices = devices.filter((device) => device.status === 'online').length;
    const guestCount = clients.filter((client) => client.isGuest).length;
    const totalRxBytes = clients.reduce((sum, client) => sum + this.toNumber(client.rxBytes, 0), 0);
    const totalTxBytes = clients.reduce((sum, client) => sum + this.toNumber(client.txBytes, 0), 0);

    return {
      siteId: this.site,
      siteName: 'Default',
      deviceCount: devices.length,
      onlineDevices,
      offlineDevices: Math.max(devices.length - onlineDevices, 0),
      userCount: clients.length,
      guestCount,
      activeUsers: clients.length - guestCount,
      totalRxBytes,
      totalTxBytes,
      uptime: 0,
    };
  }

  async getTopology() {
    const { buildUnifiTopology } = await import('@/lib/network/topology');
    const [devices, clients] = await Promise.all([this.getDevices(), this.getClients()]);
    return buildUnifiTopology(devices as any[], clients as any[]);
  }

  async runSpeedtest(): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/sitemgr/run-speedtest`
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  async getSpeedtestResults(): Promise<unknown> {
    try {
      const response = await this.get(`/api/s/${this.site}/stat/speedtest`);
      return response;
    } catch (error) { throw error; }
  }

  async getDpiStats(): Promise<unknown> {
    try {
      const response = await this.get(`/api/s/${this.site}/stat/dpi`);
      return response;
    } catch (error) { throw error; }
  }

  async setDpiEnabled(siteId: string, enabled: boolean): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${recordId(siteId)}/rest/setting/dpi`,
        { enabled }
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  // ============================================
  // Alerts & Events
  // ============================================

  async getAlerts(archived?: boolean): Promise<UnifiAlert[]> {
    try {
      const url = archived !== undefined
        ? `/api/s/${this.site}/stat/alarm?archived=${archived}`
        : `/api/s/${this.site}/stat/alarm`;
      let response: UnifiListResponse<UnifiAlert> | null = null;
      try {
        response = await this.get<UnifiListResponse<UnifiAlert>>(url);
      } catch {
        const eventUrl = archived !== undefined
          ? `/api/s/${this.site}/stat/event?archived=${archived}`
          : `/api/s/${this.site}/stat/event`;
        response = await this.get<UnifiListResponse<UnifiAlert>>(eventUrl).catch(() => ({ data: [] }));
      }
      return (response?.data || []).map((alert) => this.normalizeAlert(alert));
    } catch {
      return [];
    }
  }

  async getEvents(limit?: number): Promise<UnifiEvent[]> {
    try {
      const url = limit
        ? `/api/s/${this.site}/stat/event?limit=${limit}`
        : `/api/s/${this.site}/stat/event`;
      const response = await this.get<UnifiListResponse<UnifiEvent>>(url).catch(() => ({ data: [] }));
      return (response?.data || []).map((event) => this.normalizeAlert(event) as unknown as UnifiEvent);
    } catch {
      return [];
    }
  }

  async dismissAlert(alertId: string): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/event/${recordId(alertId)}`,
        { isDismissed: true, isArchived: true }
      );
      return response?.meta?.rc === 'ok';
    } catch (error) { throw error; }
  }

  // ============================================
  // Overview
  // ============================================

  async getOverview(): Promise<UnifiOverview> {
    const [sites, devices, clients, stats, health, alerts] = await Promise.all([
      this.getSites(),
      this.getDevices(),
      this.getClients(),
      this.getDashboardStats(),
      this.getHealth(),
      this.getAlerts(),
    ]);

    return {
      sites,
      devices,
      clients,
      stats,
      health,
      alerts,
    };
  }

  // ============================================
  // Static Methods for Quick Access
  // ============================================

  static async createAndLogin(config?: Partial<UnifiClientConfig>): Promise<UnifiClient> {
    const client = new UnifiClient(config);
    await client.login();
    return client;
  }

  static getDefaultConfig(): UnifiClientConfig {
    return {
      controllerUrl: DEFAULT_CONTROLLER_URL,
      username: DEFAULT_USERNAME,
      password: DEFAULT_PASSWORD,
      site: DEFAULT_SITE,
      rejectUnauthorized: true,
    };
  }
}

// ============================================
// Export singleton instance
// ============================================

let _unifiClient: UnifiClient | null = null;

export function getUnifiClient(config?: Partial<UnifiClientConfig>): UnifiClient {
  if (config) {
    return new UnifiClient(config);
  }

  if (!_unifiClient) {
    _unifiClient = new UnifiClient();
  }

  return _unifiClient;
}

export function resetUnifiClient(): void {
  _unifiClient = null;
}

export * from '@/lib/network/format';
