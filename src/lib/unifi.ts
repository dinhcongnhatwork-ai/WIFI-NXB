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
const DEFAULT_USERNAME = process.env.UNIFI_USERNAME || 'congnhat';
const DEFAULT_PASSWORD = process.env.UNIFI_PASSWORD || 'Congnhat2002@';
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

  constructor(config: Partial<UnifiClientConfig> = {}) {
    const dynamic = dynamicUnifiResolver ? dynamicUnifiResolver() : {};
    let rawUrl = (config.controllerUrl || dynamic.controllerUrl || DEFAULT_CONTROLLER_URL).trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.username = config.username || dynamic.username || DEFAULT_USERNAME;
    this.password = config.password || dynamic.password || DEFAULT_PASSWORD;
    this.site = config.site || dynamic.site || DEFAULT_SITE;
    this.rejectUnauthorized = config.rejectUnauthorized ?? dynamic.rejectUnauthorized ?? false;
  }

  private getEndpointCandidates(endpoint: string): string[] {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    if (normalized.startsWith('/proxy/network')) {
      return [normalized];
    }

    const candidates = [normalized];

    if (normalized.startsWith('/api/')) {
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
      (device?.disconnected_at ? 'offline' : 'online');

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
      _id: device?._id || device?.id || device?.mac || `device-${Math.random().toString(36).slice(2, 10)}`,
      deviceId: device?.deviceId || device?._id || device?.id || device?.mac || '',
      mac: device?.mac || device?.macAddress || '',
      name: device?.name || device?.hostname || device?.model || device?.mac || 'Unknown Device',
      model: device?.model || 'Unknown',
      type: normalizedType,
      status,
      isConnected: status === 'online',
      ipAddress: device?.ipAddress || device?.ip || device?.config_network?.ip,
      serialNumber: device?.serialNumber || device?.serial,
      uptime: this.toNumber(device?.uptime, 0),
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
      _id: user?._id || mac || `client-${Math.random().toString(36).slice(2, 10)}`,
      mac,
      ip: user?.ip || user?.ipAddress,
      hostname: user?.hostname || user?.name || user?.hostname_alias || user?.display_name || user?.oui || mac,
      isGuest: this.toBoolean(user?.isGuest ?? user?.is_guest ?? user?.guest, false),
      isWireless,
      isWired,
      isBlocked: this.toBoolean(user?.isBlocked ?? user?.blocked, false),
      authorized: this.toBoolean(user?.authorized, true),
      apMac: user?.apMac || user?.ap_mac,
      apName: user?.apName || user?.ap_name,
      ssid: user?.ssid || user?.essid,
      channel: this.toOptionalNumber(user?.channel),
      uptime: this.toOptionalNumber(user?.uptime ?? user?.latest_assoc_time ?? user?.assoc_time),
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
    if (this.siteResolved) {
      return;
    }

    this.siteResolved = true;

    if (this.site && this.site !== 'default') {
      return;
    }

    const endpoints = [
      '/api/self/sites',
      '/proxy/network/api/self/sites',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<UnifiListResponse<UnifiSite>>(endpoint);
        const firstSite = response.data?.[0];

        if (firstSite?.name) {
          this.site = firstSite.name;
          return;
        }
      } catch {
        // Try next endpoint.
      }
    }
  }

  // ============================================
  // Core HTTP Methods
  // ============================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const endpointCandidates = this.getEndpointCandidates(endpoint);
    let lastError: Error | null = null;
    const previousTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    if (!this.rejectUnauthorized && this.baseUrl.startsWith('https://')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    try {
      for (let index = 0; index < endpointCandidates.length; index += 1) {
        const candidate = endpointCandidates[index];
        const url = `${this.baseUrl}${candidate}`;

        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string> || {}),
        };

        if (this.csrfToken) {
          headers['X-CSRF-Token'] = this.csrfToken;
        }

        if (this.cookie) {
          headers['Cookie'] = this.cookie;
        }

        try {
          const response = await fetch(url, {
            ...options,
            headers,
          });

          const setCookie = response.headers.get('set-cookie');
          if (setCookie) {
            const tokenMatch = setCookie.match(/TOKEN=([^;]+)/);
            if (tokenMatch) {
              this.cookie = `TOKEN=${tokenMatch[1]}`;
              try {
                const parts = tokenMatch[1].split('.');
                if (parts.length === 3) {
                  const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                  if (jwtPayload.csrfToken) {
                    this.csrfToken = jwtPayload.csrfToken;
                  }
                }
              } catch {}
            } else {
              this.cookie = setCookie.split(';')[0];
            }
          }

          const csrfToken = response.headers.get('x-csrf-token');
          if (csrfToken) {
            this.csrfToken = csrfToken;
          }

          const bodyText = await response.text();
          let parsedData: any = {};

          if (bodyText.trim().length > 0) {
            try {
              parsedData = JSON.parse(bodyText);
            } catch {
              parsedData = { raw: bodyText };
            }
          }

          if (!response.ok) {
            if (response.status === 401) {
              UnifiClient.sessionCache.delete(`${this.baseUrl}:${this.username}`);
            }

            const rawErr = parsedData?.error;
            const errMsg =
              (typeof rawErr === 'string' ? rawErr : '') ||
              rawErr?.message ||
              parsedData?.error_description ||
              parsedData?.meta?.msg ||
              parsedData?.msg ||
              parsedData?.message ||
              (rawErr ? JSON.stringify(rawErr) : '') ||
              `Request failed: ${response.status}`;
            const err = new Error(errMsg);
            lastError = err;

            const hasFallback = index < endpointCandidates.length - 1;
            const shouldTryFallback = hasFallback && [401, 403, 404, 405].includes(response.status);

            if (shouldTryFallback) {
              continue;
            }

            throw err;
          }

          if (response.status === 204 || bodyText.trim().length === 0) {
            return {} as T;
          }

          return parsedData as T;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(`Network error: ${error}`);

          const hasFallback = index < endpointCandidates.length - 1;
          if (hasFallback) {
            continue;
          }
        }
      }
    } finally {
      if (!this.rejectUnauthorized && this.baseUrl.startsWith('https://')) {
        if (previousTlsReject === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsReject;
        }
      }
    }

    throw lastError || new Error('Request failed');
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

    // 2. Prioritize /api/auth/login for UniFi OS (UDM / CloudKey / UniFi OS 3+)
    const endpoints = [
      '/api/auth/login',
      '/api/login',
      '/api/s/default/login',
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
    const endpoints = [
      '/api/s/default',
      '/api/v1/info',
      '/api/systat',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: Array<UnifiControllerInfo> } | UnifiControllerInfo>(endpoint);
        if (Array.isArray(response)) {
          return response[0];
        }
        if ('data' in response && Array.isArray(response.data)) {
          return response.data[0];
        }
        return response as UnifiControllerInfo;
      } catch {
        // Try next endpoint
      }
    }

    return {
      name: 'UniFi Controller',
      version: 'Unknown',
      baseUrl: this.baseUrl,
    };
  }

  async getSites(): Promise<UnifiSite[]> {
    const endpoints = [
      '/api/self/sites',
      '/proxy/network/api/self/sites',
      '/api/s/default/stat/sites',
      '/api/sites',
      '/api/v1/sites',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<UnifiListResponse<UnifiSite>>(endpoint);
        if (response.data) {
          return response.data;
        }
      } catch {
        // Try next endpoint
      }
    }

    return [];
  }

  // ============================================
  // Devices
  // ============================================

  async getDevices(): Promise<UnifiDevice[]> {
    const endpoints = [
      `/api/s/${this.site}/stat/device`,
      '/api/v2/api/stat/device',
      '/api/s/default/stat/device',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<UnifiListResponse<UnifiDevice>>(endpoint);
        if (response.data) {
          return response.data.map((device) => this.normalizeDevice(device));
        }
      } catch {
        // Try next endpoint
      }
    }

    return [];
  }

  async getDevice(deviceId: string): Promise<UnifiDevice | null> {
    const endpoints = [
      `/api/s/${this.site}/stat/device/${deviceId}`,
      `/api/s/default/stat/device/${deviceId}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: UnifiDevice[] } | UnifiDevice>(endpoint);
        if ('data' in response && response.data) {
          return response.data[0] ? this.normalizeDevice(response.data[0]) : null;
        }
        return this.normalizeDevice(response);
      } catch {
        // Try next endpoint
      }
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

  async adoptDevice(deviceId: string): Promise<boolean> {
    try {
      const endpoints = [
        `/api/s/${this.site}/api/devices/${deviceId}/adopt`,
        `/api/s/default/devices/adopt`,
      ];

      for (const endpoint of endpoints) {
        try {
          await this.post(endpoint, { deviceId });
          return true;
        } catch {
          // Try next endpoint
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  async renameDevice(deviceId: string, name: string): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${deviceId}`,
        { name }
      );

      return response?.meta?.rc === 'ok';
    } catch {
      try {
        const response = await this.put<{ meta?: { rc: string } }>(
          `/api/s/default/rest/device/${deviceId}`,
          { name }
        );
        return response?.meta?.rc === 'ok';
      } catch {
        return false;
      }
    }
  }

  async setDeviceLedSettings(deviceId: string, settings: UnifiLedSettingsRequest): Promise<boolean> {
    try {
      const payload: Record<string, unknown> = {};
      if (settings.enabled !== undefined) payload.led_enabled = settings.enabled;
      if (settings.reverse !== undefined) payload.led_reverse = settings.reverse;

      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${deviceId}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async rebootDevice(deviceId: string): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/devmgr/force-provision`,
        { deviceId }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async upgradeDeviceFirmware(deviceId: string): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/devmgr/upgrade-device`,
        { deviceId }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async forgetDevice(deviceId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${deviceId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      try {
        const response = await this.delete<{ meta?: { rc: string } }>(
          `/api/s/default/rest/device/${deviceId}`
        );
        return response?.meta?.rc === 'ok';
      } catch {
        return false;
      }
    }
  }

  async getDeviceUplink(mac: string): Promise<UnifiUplink | null> {
    try {
      const response = await this.get<{ uplink?: UnifiUplink }>(
        `/api/s/${this.site}/stat/uplink/${mac}`
      );
      return response?.uplink || null;
    } catch {
      return null;
    }
  }

  // ============================================
  // Clients / Users
  // ============================================

  async getClients(force?: boolean): Promise<UnifiUser[]> {
    const userMap = new Map<string, UnifiUser>();

    // 1. Query active wireless stations (/stat/sta)
    const staEndpoints = [
      `/api/s/${this.site}/stat/sta`,
      `/api/s/default/stat/sta`,
    ];

    for (const endpoint of staEndpoints) {
      try {
        const url = force ? `${endpoint}?force=true` : endpoint;
        const response = await this.get<UnifiListResponse<UnifiUser>>(url);
        if (response.data && Array.isArray(response.data)) {
          for (const raw of response.data) {
            const client = this.normalizeClient(raw);
            if (client.mac) {
              userMap.set(client.mac.toLowerCase(), client);
            }
          }
          break;
        }
      } catch {
        // Try next endpoint
      }
    }

    // 2. Query guest stations (/stat/guest) to ensure captive portal / guest users are included
    const guestEndpoints = [
      `/api/s/${this.site}/stat/guest`,
      `/api/s/default/stat/guest`,
    ];

    for (const endpoint of guestEndpoints) {
      try {
        const response = await this.get<UnifiListResponse<UnifiUser>>(endpoint);
        if (response.data && Array.isArray(response.data)) {
          for (const raw of response.data) {
            const client = this.normalizeClient(raw);
            if (client.mac && !userMap.has(client.mac.toLowerCase())) {
              userMap.set(client.mac.toLowerCase(), client);
            }
          }
          break;
        }
      } catch {
        // Try next endpoint
      }
    }

    return Array.from(userMap.values());
  }

  async getGuests(): Promise<UnifiUser[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiUser>>(
        `/api/s/${this.site}/stat/guest`
      );
      return (response.data || []).map((user) => this.normalizeClient(user));
    } catch {
      try {
        const response = await this.get<UnifiListResponse<UnifiUser>>(
          '/api/s/default/stat/guest'
        );
        return (response.data || []).map((user) => this.normalizeClient(user));
      } catch {
        return [];
      }
    }
  }

  async getClient(mac: string): Promise<UnifiUser | null> {
    try {
      const response = await this.get<{ data: UnifiUser[] }>(
        `/api/s/${this.site}/stat/sta/${mac}`
      );
      return response.data?.[0] ? this.normalizeClient(response.data[0]) : null;
    } catch {
      return null;
    }
  }

  async blockClient(mac: string): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/stamgr/block-client`,
        { mac }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      try {
        const response = await this.post<{ meta?: { rc: string } }>(
          `/api/s/default/cmd/stamgr/block-client`,
          { mac }
        );
        return response?.meta?.rc === 'ok';
      } catch {
        return false;
      }
    }
  }

  async unblockClient(mac: string): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/stamgr/unblock-client`,
        { mac }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      try {
        const response = await this.post<{ meta?: { rc: string } }>(
          `/api/s/default/cmd/stamgr/unblock-client`,
          { mac }
        );
        return response?.meta?.rc === 'ok';
      } catch {
        return false;
      }
    }
  }

  async reconnectClient(mac: string): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/stamgr/reconnect-client`,
        { mac }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async kickClient(mac: string): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/stamgr/kick-sta`,
        { mac }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      try {
        const response = await this.post<{ meta?: { rc: string } }>(
          `/api/s/default/cmd/stamgr/kick-sta`,
          { mac }
        );
        return response?.meta?.rc === 'ok';
      } catch {
        return false;
      }
    }
  }

  async getRogueAps(): Promise<UnifiRogueAp[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiRogueAp>>(
        `/api/s/${this.site}/stat/rogueap`
      );
      return response.data || [];
    } catch {
      try {
        const response = await this.get<UnifiListResponse<UnifiRogueAp>>(
          '/api/s/default/stat/rogueap'
        );
        return response.data || [];
      } catch {
        return [];
      }
    }
  }

  // ============================================
  // SSID / WLAN Configuration
  // ============================================

  async getWlanConfs(): Promise<UnifiWlanConf[]> {
    const endpoints = [
      `/api/s/${this.site}/rest/wlanconf`,
      `/api/s/${this.site}/list/wlanconf`,
      '/api/s/default/rest/wlanconf',
      '/api/s/default/list/wlanconf',
    ];

    const merged = new Map<string, UnifiWlanConf>();

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<UnifiListResponse<UnifiWlanConf>>(endpoint);
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
      } catch {
        // Try next endpoint
      }
    }

    return Array.from(merged.values());
  }

  async getSsidById(wlanConfId: string): Promise<UnifiWlanConf | null> {
    const endpoints = [
      `/api/s/${this.site}/rest/wlanconf/${wlanConfId}`,
      `/api/s/${this.site}/list/wlanconf/${wlanConfId}`,
      `/api/s/default/rest/wlanconf/${wlanConfId}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: UnifiWlanConf[] }>(endpoint);
        if (response.data?.[0]) {
          return this.normalizeSsid(response.data[0]);
        }
      } catch {
        // Try next endpoint
      }
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
          const apGroupRes = await this.get<any>(`/proxy/network/v2/api/site/${this.site}/apgroups`);
          if (Array.isArray(apGroupRes)) {
            const defaultGroup = apGroupRes.find((g: any) => g.attr_hidden_id === 'default') || apGroupRes[0];
            if (defaultGroup?._id) {
              apGroupIds = [defaultGroup._id];
            }
          }
        } catch {
          // Fallback: check existing WLAN configuration
          try {
            const existing = await this.get<any>(`/api/s/${this.site}/rest/wlanconf`);
            const first = existing.data?.find((w: any) => Array.isArray(w.ap_group_ids) && w.ap_group_ids.length > 0);
            if (first) {
              apGroupIds = first.ap_group_ids;
            }
          } catch {}
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
    } catch (err) {
      console.error('[createSsid] Error creating SSID on UniFi:', err);
      throw err;
    }
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
        `/api/s/${this.site}/rest/wlanconf/${wlanConfId}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch (err) {
      console.error('[updateSsid] Error updating SSID on UniFi:', err);
      throw err;
    }
  }

  async deleteSsid(wlanConfId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/wlanconf/${wlanConfId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      try {
        const response = await this.delete<{ meta?: { rc: string } }>(
          `/api/s/default/rest/wlanconf/${wlanConfId}`
        );
        return response?.meta?.rc === 'ok';
      } catch {
        return false;
      }
    }
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
      '/api/s/default/rest/networkconf',
      '/api/s/default/list/networkconf',
    ];

    const merged = new Map<string, UnifiNetwork>();

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<UnifiListResponse<UnifiNetwork>>(endpoint);
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
      } catch {
        // Try next endpoint
      }
    }

    return Array.from(merged.values());
  }

  async getNetwork(networkId: string): Promise<UnifiNetwork | null> {
    const endpoints = [
      `/api/s/${this.site}/rest/networkconf/${networkId}`,
      `/api/s/default/rest/networkconf/${networkId}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: UnifiNetwork[] }>(endpoint);
        if (response.data?.[0]) {
          return this.normalizeNetwork(response.data[0]);
        }
      } catch {
        // Try next endpoint
      }
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
    } catch {
      return null;
    }
  }

  async updateNetwork(networkId: string, network: Partial<UnifiNetworkRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/networkconf/${networkId}`,
        network
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async deleteNetwork(networkId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/networkconf/${networkId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
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
    } catch {
      try {
        const response = await this.get<UnifiListResponse<UnifiUserGroup>>(
          '/api/s/default/rest/usergroup'
        );
        return response.data || [];
      } catch {
        return [];
      }
    }
  }

  async createUserGroup(group: UnifiUserGroupRequest): Promise<UnifiUserGroup | null> {
    try {
      const response = await this.post<{ data: UnifiUserGroup[] }>(
        `/api/s/${this.site}/rest/usergroup`,
        group
      );
      return response.data?.[0] || null;
    } catch {
      return null;
    }
  }

  async updateUserGroup(groupId: string, group: Partial<UnifiUserGroupRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/usergroup/${groupId}`,
        group
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async deleteUserGroup(groupId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/usergroup/${groupId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  // ============================================
  // Port Management
  // ============================================

  async getPortTable(deviceId: string): Promise<UnifiDevice['portTable'] | null> {
    try {
      const device = await this.getDevice(deviceId);
      return device?.portTable || null;
    } catch {
      return null;
    }
  }

  async setPortSettings(deviceId: string, portIdx: number, settings: Partial<UnifiPortRequest>): Promise<boolean> {
    try {
      const payload: Record<string, unknown> = {
        port_idx: portIdx,
      };

      if (settings.poeMode) {
        payload.poe_mode = settings.poeMode;
      }
      if (settings.name) {
        payload.name = settings.name;
      }
      if (settings.enable !== undefined) {
        payload.enable = settings.enable;
      }
      if (settings.up !== undefined) {
        payload.up = settings.up;
      }

      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/device/${deviceId}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
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
    } catch {
      return null;
    }
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
        `/api/s/${this.site}/rest/device/${deviceId}`,
        payload
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
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
    } catch {
      try {
        const response = await this.get<UnifiListResponse<UnifiFirewallRule>>(
          '/api/s/default/rest/firewallrule'
        );
        return response.data || [];
      } catch {
        return [];
      }
    }
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
    } catch {
      return null;
    }
  }

  async updateFirewallRule(ruleId: string, rule: Partial<UnifiFirewallRuleRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/firewallrule/${ruleId}`,
        rule
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async deleteFirewallRule(ruleId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/firewallrule/${ruleId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
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
    } catch {
      return [];
    }
  }

  async createPortForward(forward: UnifiPortForwardRequest): Promise<UnifiPortForward | null> {
    try {
      const response = await this.post<{ data: UnifiPortForward[] }>(
        `/api/s/${this.site}/rest/portforward`,
        forward
      );
      return response.data?.[0] || null;
    } catch {
      return null;
    }
  }

  async updatePortForward(forwardId: string, forward: Partial<UnifiPortForwardRequest>): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/portforward/${forwardId}`,
        forward
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async deletePortForward(forwardId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/portforward/${forwardId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
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
    } catch {
      return [];
    }
  }

  async createDhcpReservation(reservation: UnifiDhcpReservationRequest): Promise<UnifiDhcpReservation | null> {
    try {
      const response = await this.post<{ data: UnifiDhcpReservation[] }>(
        `/api/s/${this.site}/rest/dhcpreservation`,
        reservation
      );
      return response.data?.[0] || null;
    } catch {
      return null;
    }
  }

  async deleteDhcpReservation(reservationId: string): Promise<boolean> {
    try {
      const response = await this.delete<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/dhcpreservation/${reservationId}`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async getDhcpPools(): Promise<UnifiDhcpPool[]> {
    try {
      const response = await this.get<UnifiListResponse<UnifiDhcpPool>>(
        `/api/s/${this.site}/rest/dhcppool`
      );
      return response.data || [];
    } catch {
      return [];
    }
  }

  // ============================================
  // Health & Stats
  // ============================================

  async getHealth(): Promise<UnifiHealth> {
    const endpoints = [
      `/api/s/${this.site}/stat/health`,
      '/api/s/default/stat/health',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.get<{ data: any[] }>(endpoint);
        if (Array.isArray(response.data) && response.data.length > 0) {
          return this.normalizeHealth(response.data);
        }
      } catch {
        // Try next endpoint
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
      // Fall through to derived stats
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
    const [devices, clients, networks] = await Promise.all([
      this.getDevices(),
      this.getClients(),
      this.getNetworks(),
    ]);

    const nodeMap = new Map<string, {
      id: string;
      type: 'gateway' | 'switch' | 'ap' | 'network' | 'client';
      name: string;
      status?: string;
      mac?: string;
      ip?: string;
      meta?: Record<string, unknown>;
    }>();

    const links: Array<{
      source: string;
      target: string;
      type: 'uplink' | 'wired' | 'wireless' | 'network';
    }> = [];

    for (const network of networks) {
      const networkId = `network:${network._id || network.name}`;
      nodeMap.set(networkId, {
        id: networkId,
        type: 'network',
        name: network.name,
        status: network.enabled ? 'online' : 'offline',
        meta: {
          purpose: network.purpose,
          vlanId: network.vlanId,
          subnet: network.ipSubnet,
          stations: network.numStations,
        },
      });
    }

    const gateways: string[] = [];
    const deviceByMac = new Map<string, string>();

    for (const device of devices) {
      const deviceId = `device:${device.mac || device._id}`;
      const lowerType = String(device.type || '').toLowerCase();
      const type: 'gateway' | 'switch' | 'ap' =
        lowerType === 'ugw' || lowerType === 'udm' || lowerType === 'gateway' || lowerType === 'router'
          ? 'gateway'
          : lowerType === 'usw' || lowerType === 'switch'
            ? 'switch'
            : 'ap';

      if (device.mac) {
        deviceByMac.set(device.mac.toLowerCase(), deviceId);
      }

      if (type === 'gateway') {
        gateways.push(deviceId);
      }

      nodeMap.set(deviceId, {
        id: deviceId,
        type,
        name: device.name || device.model || device.mac,
        status: device.status,
        mac: device.mac,
        ip: device.ipAddress,
        meta: {
          model: device.model,
          clients: this.toNumber(device.userNumSta, 0) + this.toNumber(device.guestNumSta, 0),
        },
      });
    }

    for (const device of devices) {
      const deviceId = `device:${device.mac || device._id}`;
      const uplinkMac =
        (device as any)?.uplink?.mac ||
        (device as any)?.uplink?.uplinkMac ||
        (device as any)?.uplink?.uplink_mac;

      if (typeof uplinkMac === 'string' && deviceByMac.has(uplinkMac.toLowerCase())) {
        links.push({
          source: deviceByMac.get(uplinkMac.toLowerCase()) as string,
          target: deviceId,
          type: 'uplink',
        });
      }
    }

    if (gateways.length > 0) {
      const rootGateway = gateways[0];

      for (const network of networks) {
        const networkId = `network:${network._id || network.name}`;
        links.push({ source: rootGateway, target: networkId, type: 'network' });
      }
    }

    for (const client of clients.slice(0, 250)) {
      const clientId = `client:${client.mac}`;
      nodeMap.set(clientId, {
        id: clientId,
        type: 'client',
        name: client.hostname || client.name || client.mac,
        status: client.isBlocked ? 'blocked' : 'active',
        mac: client.mac,
        ip: client.ip,
        meta: {
          ssid: client.ssid,
          guest: client.isGuest,
          signal: client.signal,
        },
      });

      const apId = client.apMac ? deviceByMac.get(client.apMac.toLowerCase()) : undefined;
      if (apId) {
        links.push({
          source: apId,
          target: clientId,
          type: client.isWired ? 'wired' : 'wireless',
        });
        continue;
      }

      if (gateways[0]) {
        links.push({
          source: gateways[0],
          target: clientId,
          type: client.isWired ? 'wired' : 'wireless',
        });
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      links,
      summary: {
        gateways: Array.from(nodeMap.values()).filter((node) => node.type === 'gateway').length,
        switches: Array.from(nodeMap.values()).filter((node) => node.type === 'switch').length,
        accessPoints: Array.from(nodeMap.values()).filter((node) => node.type === 'ap').length,
        networks: Array.from(nodeMap.values()).filter((node) => node.type === 'network').length,
        clients: Array.from(nodeMap.values()).filter((node) => node.type === 'client').length,
      },
    };
  }

  async runSpeedtest(): Promise<boolean> {
    try {
      const response = await this.post<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/cmd/sitemgr/run-speedtest`
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  async getSpeedtestResults(): Promise<unknown> {
    try {
      const response = await this.get(`/api/s/${this.site}/stat/speedtest`);
      return response;
    } catch {
      return null;
    }
  }

  async getDpiStats(): Promise<unknown> {
    try {
      const response = await this.get(`/api/s/${this.site}/stat/dpi`);
      return response;
    } catch {
      return null;
    }
  }

  async setDpiEnabled(siteId: string, enabled: boolean): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${siteId}/rest/setting/dpi`,
        { enabled }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
  }

  // ============================================
  // Alerts & Events
  // ============================================

  async getAlerts(archived?: boolean): Promise<UnifiAlert[]> {
    try {
      const url = archived !== undefined
        ? `/api/s/${this.site}/stat/event?archived=${archived}`
        : `/api/s/${this.site}/stat/event`;
      const response = await this.get<UnifiListResponse<UnifiAlert>>(url);
      return (response.data || []).map((alert) => this.normalizeAlert(alert));
    } catch {
      try {
        const response = await this.get<UnifiListResponse<UnifiAlert>>(
          '/api/s/default/stat/event'
        );
        return (response.data || []).map((alert) => this.normalizeAlert(alert));
      } catch {
        return [];
      }
    }
  }

  async getEvents(limit?: number): Promise<UnifiEvent[]> {
    try {
      const url = limit
        ? `/api/s/${this.site}/stat/event?limit=${limit}`
        : `/api/s/${this.site}/stat/event`;
      const response = await this.get<UnifiListResponse<UnifiEvent>>(url);
      return (response.data || []).map((event) => this.normalizeAlert(event) as unknown as UnifiEvent);
    } catch {
      return [];
    }
  }

  async dismissAlert(alertId: string): Promise<boolean> {
    try {
      const response = await this.put<{ meta?: { rc: string } }>(
        `/api/s/${this.site}/rest/event/${alertId}`,
        { isDismissed: true, isArchived: true }
      );
      return response?.meta?.rc === 'ok';
    } catch {
      return false;
    }
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
      rejectUnauthorized: false,
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

export function formatUptime(seconds: number): string {
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
