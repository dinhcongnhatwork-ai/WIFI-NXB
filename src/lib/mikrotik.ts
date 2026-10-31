import { recordId } from '@/lib/network/paths';
import { deviceFetch } from '@/lib/network/transport';
import {
  MikrotikAddressList,
  MikrotikArpEntry,
  MikrotikConnectionInfo,
  MikrotikDhcpLease,
  MikrotikDhcpServer,
  MikrotikFirewallRule,
  MikrotikHotspotActiveSession,
  MikrotikHotspotCookie,
  MikrotikHotspotProfile,
  MikrotikHotspotServer,
  MikrotikHotspotUser,
  MikrotikHotspotUserProfile,
  MikrotikInterface,
  MikrotikIpAddress,
  MikrotikIpBinding,
  MikrotikIpPool,
  MikrotikNatRule,
  MikrotikOverview,
  MikrotikRawRecord,
  MikrotikRoute,
  MikrotikRouterboard,
  MikrotikSimpleQueue,
  MikrotikSystemIdentity,
  MikrotikSystemLog,
  MikrotikSystemResource,
} from '@/types/mikrotik';

export interface MikrotikClientConfig {
  host: string;
  username: string;
  password: string;
  timeoutMs: number;
  allowInsecure: boolean;
}

const DEFAULT_HOST = process.env.MIKROTIK_HOST || process.env.MIKROTIK_IP || '192.168.1.200';
const DEFAULT_USERNAME = process.env.MIKROTIK_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.MIKROTIK_PASSWORD || '';
const DEFAULT_TIMEOUT_MS = Number(process.env.MIKROTIK_TIMEOUT_MS || 12000);
const DEFAULT_ALLOW_INSECURE = (process.env.MIKROTIK_ALLOW_INSECURE || 'false').toLowerCase() === 'true';

let dynamicMikrotikResolver: (() => Partial<MikrotikClientConfig>) | null = null;

export function registerMikrotikConfigResolver(resolver: () => Partial<MikrotikClientConfig>): void {
  dynamicMikrotikResolver = resolver;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toRecord(value: unknown): MikrotikRawRecord {
  return isRecord(value) ? value : {};
}

function toRecordList(value: unknown): MikrotikRawRecord[] {
  if (Array.isArray(value)) {
    return value.filter((entry) => isRecord(entry)) as MikrotikRawRecord[];
  }

  if (isRecord(value)) {
    return [value];
  }

  return [];
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'yes', 'on', 'enabled', 'running'].includes(normalized);
  }

  return false;
}

function toNumberValue(value: unknown): number | undefined {
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

function getId(record: MikrotikRawRecord): string {
  return toStringValue(record['.id']) || toStringValue(record.id) || '';
}

function normalizePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  if (withSlash.startsWith('/rest/')) {
    return withSlash;
  }
  return `/rest${withSlash}`;
}

function normalizeBaseHost(host: string): string {
  return host.trim().replace(/\/$/, '');
}

export class MikrotikClient {
  private host: string;
  private username: string;
  private password: string;
  private timeoutMs: number;
  private allowInsecure: boolean;
  private connectedProtocol: 'http' | 'https' = 'https';

  constructor(config: Partial<MikrotikClientConfig> = {}) {
    const dynamic = dynamicMikrotikResolver ? dynamicMikrotikResolver() : {};
    this.host = config.host || dynamic.host || DEFAULT_HOST;
    this.username = config.username || dynamic.username || DEFAULT_USERNAME;
    this.password = config.password || dynamic.password || DEFAULT_PASSWORD;
    this.timeoutMs = config.timeoutMs ?? dynamic.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.allowInsecure = config.allowInsecure ?? dynamic.allowInsecure ?? DEFAULT_ALLOW_INSECURE;
  }

  private getBaseCandidates(): Array<{ baseUrl: string; protocol: 'http' | 'https' }> {
    const normalizedHost = normalizeBaseHost(this.host);

    if (/^https?:\/\//i.test(normalizedHost)) {
      const protocol = normalizedHost.startsWith('https://') ? 'https' : 'http';
      const candidates: Array<{ baseUrl: string; protocol: 'http' | 'https' }> = [
        { baseUrl: normalizedHost, protocol },
      ];

      if (this.allowInsecure) {
        const fallbackProtocol: 'http' | 'https' = protocol === 'https' ? 'http' : 'https';
        const fallbackBase = normalizedHost.replace(/^https?:\/\//i, `${fallbackProtocol}://`);
        candidates.push({ baseUrl: fallbackBase, protocol: fallbackProtocol });
      }

      return candidates;
    }

    const secure = `https://${normalizedHost}`;
    const insecure = `http://${normalizedHost}`;

    if (this.allowInsecure) {
      return [
        { baseUrl: insecure, protocol: 'http' },
        { baseUrl: secure, protocol: 'https' },
      ];
    }

    return [
      { baseUrl: secure, protocol: 'https' },
      { baseUrl: insecure, protocol: 'http' },
    ];
  }

  private getAuthorizationHeader(): string {
    const token = Buffer.from(`${this.username}:${this.password}`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const endpoint = normalizePath(path);
    const candidates = this.getBaseCandidates().slice(0, 1);
    let lastError: Error | null = null;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await deviceFetch(
          `${candidate.baseUrl}${endpoint}`,
          {
            ...init,
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: this.getAuthorizationHeader(),
              ...(init.headers || {}),
            },
            cache: 'no-store',
            redirect: 'error',
          },
          this.allowInsecure
        );

        clearTimeout(timeout);

        const text = await response.text();
        let payload: unknown = null;

        if (text.trim().length > 0) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { raw: text };
          }
        }

        if (!response.ok) {
          const body = toRecord(payload);
          const bodyMessage =
            toStringValue(body.detail) ||
            toStringValue(body.message) ||
            toStringValue(body.error) ||
            toStringValue(body.raw);

          throw Object.assign(new Error(bodyMessage || `MikroTik API error: ${response.status}`), {
            status: response.status,
          });
        }

        this.connectedProtocol = candidate.protocol;

        return payload as T;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error instanceof Error ? error : new Error(String(error));

        const hasFallback = index < candidates.length - 1;
        if (!hasFallback) {
          break;
        }
      }
    }

    throw lastError || new Error('Không thể kết nối MikroTik API');
  }

  async rawGet(path: string): Promise<unknown> {
    return this.request<unknown>(path, { method: 'GET' });
  }

  async rawRequest(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown
  ): Promise<unknown> {
    return this.request<unknown>(path, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  // ============================================
  // System Resource, RouterBOARD & Logs
  // ============================================

  async getSystemIdentity(): Promise<MikrotikSystemIdentity | null> {
    try {
      const payload = await this.request<unknown>('/system/identity', { method: 'GET' });
      const record = toRecord(Array.isArray(payload) ? payload[0] : payload);
      return {
        name: toStringValue(record.name) || 'MikroTik Router',
      };
    } catch {
      return null;
    }
  }

  async getSystemResource(): Promise<MikrotikSystemResource | null> {
    try {
      const payload = await this.request<unknown>('/system/resource', { method: 'GET' });
      const record = toRecord(Array.isArray(payload) ? payload[0] : payload);
      return {
        uptime: toStringValue(record.uptime),
        version: toStringValue(record.version),
        buildTime: toStringValue(record['build-time']),
        freeMemory: toNumberValue(record['free-memory']),
        totalMemory: toNumberValue(record['total-memory']),
        cpuLoad: toNumberValue(record['cpu-load']),
        cpuCount: toNumberValue(record['cpu-count']),
        cpuFrequency: toNumberValue(record['cpu-frequency']),
        freeHddSpace: toNumberValue(record['free-hdd-space']),
        totalHddSpace: toNumberValue(record['total-hdd-space']),
        architectureName: toStringValue(record['architecture-name']),
        boardName: toStringValue(record['board-name']),
        platform: toStringValue(record.platform),
      };
    } catch {
      return null;
    }
  }

  async getRouterboard(): Promise<MikrotikRouterboard | null> {
    try {
      const payload = await this.request<unknown>('/system/routerboard', { method: 'GET' });
      const record = toRecord(Array.isArray(payload) ? payload[0] : payload);
      return {
        routerboard: toBooleanValue(record.routerboard),
        model: toStringValue(record.model),
        serialNumber: toStringValue(record['serial-number']),
        currentFirmware: toStringValue(record['current-firmware']),
        upgradeFirmware: toStringValue(record['upgrade-firmware']),
        firmwareType: toStringValue(record['firmware-type']),
        revision: toStringValue(record.revision),
      };
    } catch {
      return null;
    }
  }

  async getSystemLogs(limit: number = 100): Promise<MikrotikSystemLog[]> {
    try {
      const payload = await this.request<unknown>('/log', { method: 'GET' });
      const list = toRecordList(payload).map((record) => ({
        id: getId(record),
        time: toStringValue(record.time) || '',
        topics: toStringValue(record.topics) || 'info',
        message: toStringValue(record.message) || '',
      }));
      // Return newest logs first
      return list.reverse().slice(0, limit);
    } catch {
      return [];
    }
  }

  async rebootRouter(): Promise<boolean> {
    try {
      await this.request<unknown>('/system/reboot', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Interfaces
  // ============================================

  async getInterfaces(): Promise<MikrotikInterface[]> {
    const payload = await this.request<unknown>('/interface', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      name: toStringValue(record.name) || 'unknown',
      type: toStringValue(record.type),
      disabled: toBooleanValue(record.disabled),
      running: toBooleanValue(record.running),
      mtu: toNumberValue(record.mtu),
      actualMtu: toNumberValue(record['actual-mtu']),
      macAddress: toStringValue(record['mac-address']),
      comment: toStringValue(record.comment),
      rxByte: toNumberValue(record['rx-byte']),
      txByte: toNumberValue(record['tx-byte']),
      rxPacket: toNumberValue(record['rx-packet']),
      txPacket: toNumberValue(record['tx-packet']),
      rxError: toNumberValue(record['rx-error']),
      txError: toNumberValue(record['tx-error']),
      lastLinkUpTime: toStringValue(record['last-link-up-time']),
      linkDowns: toNumberValue(record['link-downs']),
    }));
  }

  async setInterfaceDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/interface/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // IP Addresses, ARP, Pools, DHCP
  // ============================================

  async getIpAddresses(): Promise<MikrotikIpAddress[]> {
    const payload = await this.request<unknown>('/ip/address', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      address: toStringValue(record.address) || '',
      network: toStringValue(record.network),
      interface: toStringValue(record.interface),
      dynamic: toBooleanValue(record.dynamic),
      disabled: toBooleanValue(record.disabled),
      comment: toStringValue(record.comment),
    }));
  }

  async addIpAddress(input: { address: string; interface: string; comment?: string }): Promise<boolean> {
    if (!input.address || !input.interface) return false;
    try {
      await this.request<unknown>('/ip/address', {
        method: 'PUT',
        body: JSON.stringify({
          address: input.address,
          interface: input.interface,
          comment: input.comment || '',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeIpAddress(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/address/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getArpEntries(): Promise<MikrotikArpEntry[]> {
    try {
      const payload = await this.request<unknown>('/ip/arp', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        address: toStringValue(record.address) || '',
        macAddress: toStringValue(record['mac-address']),
        interface: toStringValue(record.interface) || '',
        dynamic: toBooleanValue(record.dynamic),
        complete: toBooleanValue(record.complete),
        disabled: toBooleanValue(record.disabled),
        comment: toStringValue(record.comment),
      }));
    } catch {
      return [];
    }
  }

  async addArpEntry(input: { address: string; macAddress: string; interface: string; comment?: string }): Promise<boolean> {
    try {
      await this.request<unknown>('/ip/arp', {
        method: 'PUT',
        body: JSON.stringify({
          address: input.address,
          'mac-address': input.macAddress,
          interface: input.interface,
          comment: input.comment || '',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeArpEntry(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/arp/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getIpPools(): Promise<MikrotikIpPool[]> {
    try {
      const payload = await this.request<unknown>('/ip/pool', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        name: toStringValue(record.name) || '',
        ranges: toStringValue(record.ranges) || '',
        total: toNumberValue(record.total),
        used: toNumberValue(record.used),
        available: toNumberValue(record.available),
      }));
    } catch {
      return [];
    }
  }

  async addIpPool(input: { name: string; ranges: string }): Promise<boolean> {
    try {
      await this.request<unknown>('/ip/pool', {
        method: 'PUT',
        body: JSON.stringify({
          name: input.name,
          ranges: input.ranges,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeIpPool(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/pool/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getDhcpServers(): Promise<MikrotikDhcpServer[]> {
    const payload = await this.request<unknown>('/ip/dhcp-server', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      name: toStringValue(record.name) || '',
      interface: toStringValue(record.interface),
      addressPool: toStringValue(record['address-pool']),
      leaseTime: toStringValue(record['lease-time']),
      disabled: toBooleanValue(record.disabled),
    }));
  }

  async getDhcpLeases(): Promise<MikrotikDhcpLease[]> {
    const payload = await this.request<unknown>('/ip/dhcp-server/lease', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      address: toStringValue(record.address) || toStringValue(record['active-address']),
      macAddress: toStringValue(record['mac-address']) || toStringValue(record['active-mac-address']),
      hostName: toStringValue(record['host-name']),
      server: toStringValue(record.server) || toStringValue(record['active-server']),
      status: toStringValue(record.status),
      expiresAfter: toStringValue(record['expires-after']),
      dynamic: toBooleanValue(record.dynamic),
      blocked: toBooleanValue(record.blocked),
      disabled: toBooleanValue(record.disabled),
      comment: toStringValue(record.comment),
    }));
  }

  async makeDhcpLeaseStatic(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>('/ip/dhcp-server/lease/make-static', {
        method: 'POST',
        body: JSON.stringify({ '.id': id }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeDhcpLease(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/dhcp-server/lease/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async addStaticDhcpLease(input: { address: string; macAddress: string; server?: string; comment?: string }): Promise<boolean> {
    try {
      await this.request<unknown>('/ip/dhcp-server/lease', {
        method: 'PUT',
        body: JSON.stringify({
          address: input.address,
          'mac-address': input.macAddress,
          server: input.server || 'all',
          comment: input.comment || '',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeAllDhcpLeases(): Promise<boolean> {
    const leases = await this.getDhcpLeases();
    if (leases.length === 0) return true;
    await Promise.all(
      leases
        .filter((lease) => lease.dynamic || lease.status === 'bound')
        .map((lease) => this.request(`/ip/dhcp-server/lease/${recordId(lease.id)}`, { method: 'DELETE' }))
    );
    return true;
  }

  async removeDhcpLeaseByMac(
    mac: string
  ): Promise<{ success: boolean; removedCount: number; leases?: MikrotikDhcpLease[] }> {
    try {
      const normMac = mac.toLowerCase().trim();
      const leases = await this.getDhcpLeases();
      const matched = leases.filter(
        (l) => l.macAddress && l.macAddress.toLowerCase().trim() === normMac
      );
      if (matched.length === 0) {
        return { success: true, removedCount: 0 };
      }
      for (const lease of matched) {
        await this.request(`/ip/dhcp-server/lease/${recordId(lease.id)}`, {
          method: 'DELETE',
        }).catch((err: any) =>
          console.warn(`[mikrotik] Failed to remove DHCP lease ${lease.id} for ${mac}:`, err.message)
        );
      }
      return { success: true, removedCount: matched.length, leases: matched };
    } catch (err: any) {
      console.warn(`[mikrotik] removeDhcpLeaseByMac error for ${mac}:`, err.message);
      return { success: false, removedCount: 0 };
    }
  }

  async getRoutes(): Promise<MikrotikRoute[]> {
    const payload = await this.request<unknown>('/ip/route', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      dstAddress: toStringValue(record['dst-address']),
      gateway: toStringValue(record.gateway),
      distance: toNumberValue(record.distance),
      routingTable: toStringValue(record['routing-table']),
      active: toBooleanValue(record.active),
      dynamic: toBooleanValue(record.dynamic),
      disabled: toBooleanValue(record.disabled),
      comment: toStringValue(record.comment),
    }));
  }

  // ============================================
  // Firewall Filter, NAT & Address Lists
  // ============================================

  async getFirewallFilterRules(): Promise<MikrotikFirewallRule[]> {
    const payload = await this.request<unknown>('/ip/firewall/filter', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      chain: toStringValue(record.chain),
      action: toStringValue(record.action),
      protocol: toStringValue(record.protocol),
      srcAddress: toStringValue(record['src-address']),
      dstAddress: toStringValue(record['dst-address']),
      srcPort: toStringValue(record['src-port']),
      dstPort: toStringValue(record['dst-port']),
      inInterface: toStringValue(record['in-interface']),
      outInterface: toStringValue(record['out-interface']),
      bytes: toNumberValue(record.bytes),
      packets: toNumberValue(record.packets),
      comment: toStringValue(record.comment),
      disabled: toBooleanValue(record.disabled),
      dynamic: toBooleanValue(record.dynamic),
    }));
  }

  async setFirewallRuleDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/firewall/filter/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getNatRules(): Promise<MikrotikNatRule[]> {
    try {
      const payload = await this.request<unknown>('/ip/firewall/nat', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        chain: toStringValue(record.chain) || 'srcnat',
        action: toStringValue(record.action) || 'masquerade',
        toAddresses: toStringValue(record['to-addresses']),
        toPorts: toStringValue(record['to-ports']),
        srcAddress: toStringValue(record['src-address']),
        dstAddress: toStringValue(record['dst-address']),
        protocol: toStringValue(record.protocol),
        srcPort: toStringValue(record['src-port']),
        dstPort: toStringValue(record['dst-port']),
        outInterface: toStringValue(record['out-interface']),
        inInterface: toStringValue(record['in-interface']),
        bytes: toNumberValue(record.bytes),
        packets: toNumberValue(record.packets),
        comment: toStringValue(record.comment),
        disabled: toBooleanValue(record.disabled),
        dynamic: toBooleanValue(record.dynamic),
      }));
    } catch {
      return [];
    }
  }

  async setNatRuleDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/firewall/nat/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async addNatRule(input: {
    chain: string;
    action: string;
    outInterface?: string;
    toAddresses?: string;
    toPorts?: string;
    dstPort?: string;
    protocol?: string;
    comment?: string;
  }): Promise<boolean> {
    try {
      const body: Record<string, unknown> = {
        chain: input.chain,
        action: input.action,
        comment: input.comment || '',
      };
      if (input.outInterface) body['out-interface'] = input.outInterface;
      if (input.toAddresses) body['to-addresses'] = input.toAddresses;
      if (input.toPorts) body['to-ports'] = input.toPorts;
      if (input.dstPort) body['dst-port'] = input.dstPort;
      if (input.protocol) body.protocol = input.protocol;

      await this.request<unknown>('/ip/firewall/nat', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeNatRule(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/firewall/nat/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getAddressLists(): Promise<MikrotikAddressList[]> {
    try {
      const payload = await this.request<unknown>('/ip/firewall/address-list', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        list: toStringValue(record.list) || '',
        address: toStringValue(record.address) || '',
        timeout: toStringValue(record.timeout),
        creationTime: toStringValue(record['creation-time']),
        comment: toStringValue(record.comment),
        disabled: toBooleanValue(record.disabled),
        dynamic: toBooleanValue(record.dynamic),
      }));
    } catch {
      return [];
    }
  }

  async addAddressList(input: { list: string; address: string; timeout?: string; comment?: string }): Promise<boolean> {
    try {
      const body: Record<string, unknown> = {
        list: input.list,
        address: input.address,
        comment: input.comment || '',
      };
      if (input.timeout) body.timeout = input.timeout;

      await this.request<unknown>('/ip/firewall/address-list', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeAddressList(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/firewall/address-list/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async setAddressListDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/firewall/address-list/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Queues (Bandwidth Traffic Limit)
  // ============================================

  async getSimpleQueues(): Promise<MikrotikSimpleQueue[]> {
    try {
      const payload = await this.request<unknown>('/queue/simple', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        name: toStringValue(record.name) || '',
        target: toStringValue(record.target),
        maxLimit: toStringValue(record['max-limit']),
        limitAt: toStringValue(record['limit-at']),
        priority: toStringValue(record.priority),
        bytes: toStringValue(record.bytes),
        totalBytes: toNumberValue(record['total-bytes']),
        rate: toStringValue(record.rate),
        comment: toStringValue(record.comment),
        disabled: toBooleanValue(record.disabled),
        dynamic: toBooleanValue(record.dynamic),
      }));
    } catch {
      return [];
    }
  }

  async addSimpleQueue(input: {
    name: string;
    target: string;
    maxLimit: string; // e.g. "10M/20M" (upload/download)
    comment?: string;
  }): Promise<boolean> {
    try {
      await this.request<unknown>('/queue/simple', {
        method: 'PUT',
        body: JSON.stringify({
          name: input.name,
          target: input.target,
          'max-limit': input.maxLimit,
          comment: input.comment || '',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async setSimpleQueueDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/queue/simple/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeSimpleQueue(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/queue/simple/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Hotspot
  // ============================================

  async getHotspotProfiles(): Promise<MikrotikHotspotProfile[]> {
    const payload = await this.request<unknown>('/ip/hotspot/profile', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      name: toStringValue(record.name) || '',
      dnsName: toStringValue(record['dns-name']),
      htmlDirectory: toStringValue(record['html-directory']),
      loginBy: toStringValue(record['login-by']),
      idleTimeout: toStringValue(record['idle-timeout']),
      keepaliveTimeout: toStringValue(record['keepalive-timeout']),
      statusAutorefresh: toStringValue(record['status-autorefresh']),
    }));
  }

  async getHotspotUserProfiles(): Promise<MikrotikHotspotUserProfile[]> {
    try {
      const payload = await this.request<unknown>('/ip/hotspot/user/profile', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        name: toStringValue(record.name) || '',
        rateLimit: toStringValue(record['rate-limit']),
        sharedUsers: record['shared-users'] as string | number | undefined,
        sessionTimeout: toStringValue(record['session-timeout']),
        idleTimeout: toStringValue(record['idle-timeout']),
        keepaliveTimeout: toStringValue(record['keepalive-timeout']),
        statusAutorefresh: toStringValue(record['status-autorefresh']),
      }));
    } catch {
      return [];
    }
  }

  async getHotspotServers(): Promise<MikrotikHotspotServer[]> {
    const payload = await this.request<unknown>('/ip/hotspot', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      name: toStringValue(record.name) || '',
      interface: toStringValue(record.interface),
      profile: toStringValue(record.profile),
      addressPool: toStringValue(record['address-pool']),
      idleTimeout: toStringValue(record['idle-timeout']),
      keepaliveTimeout: toStringValue(record['keepalive-timeout']),
      disabled: toBooleanValue(record.disabled),
    }));
  }

  async getHotspotUsers(): Promise<MikrotikHotspotUser[]> {
    const payload = await this.request<unknown>('/ip/hotspot/user', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      name: toStringValue(record.name) || '',
      password: undefined,
      profile: toStringValue(record.profile),
      server: toStringValue(record.server),
      limitUptime: toStringValue(record['limit-uptime']),
      limitBytesTotal: toNumberValue(record['limit-bytes-total']),
      comment: toStringValue(record.comment),
      disabled: toBooleanValue(record.disabled),
    }));
  }

  async setHotspotUserDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/hotspot/user/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async createHotspotUser(input: {
    name: string;
    password: string;
    profile?: string;
    server?: string;
    comment?: string;
  }): Promise<boolean> {
    if (!input.name) return false;
    try {
      await this.request<unknown>('/ip/hotspot/user', {
        method: 'PUT',
        body: JSON.stringify({
          name: input.name,
          password: input.password,
          profile: input.profile || 'default',
          server: input.server || 'all',
          comment: input.comment || '',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeHotspotUser(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/hotspot/user/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getHotspotActiveSessions(): Promise<MikrotikHotspotActiveSession[]> {
    const payload = await this.request<unknown>('/ip/hotspot/active', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      user: toStringValue(record.user),
      address: toStringValue(record.address),
      macAddress: toStringValue(record['mac-address']),
      server: toStringValue(record.server),
      loginBy: toStringValue(record['login-by']),
      uptime: toStringValue(record.uptime),
      idleTime: toStringValue(record['idle-time']),
      bytesIn: toNumberValue(record['bytes-in']),
      bytesOut: toNumberValue(record['bytes-out']),
      packetsIn: toNumberValue(record['packets-in']),
      packetsOut: toNumberValue(record['packets-out']),
    }));
  }

  async kickHotspotActive(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request(`/ip/hotspot/active/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async removeAllHotspotActiveSessions(): Promise<boolean> {
    const active = await this.getHotspotActiveSessions();
    if (active.length === 0) return true;
    await Promise.all(
      active.map((session) => this.request(`/ip/hotspot/active/${recordId(session.id)}`, { method: 'DELETE' }))
    );
    return true;
  }

  async getHotspotCookies(): Promise<MikrotikHotspotCookie[]> {
    const payload = await this.request<unknown>('/ip/hotspot/cookie', { method: 'GET' });
    return toRecordList(payload).map((record) => ({
      id: getId(record),
      user: toStringValue(record.user),
      macAddress: toStringValue(record['mac-address']),
      ipAddress: toStringValue(record['ip-address']),
      expiresAfter: toStringValue(record['expires-after']),
    }));
  }

  async removeAllHotspotCookies(): Promise<boolean> {
    const cookies = await this.getHotspotCookies();
    if (cookies.length === 0) return true;
    await Promise.all(
      cookies.map((cookie) => this.request(`/ip/hotspot/cookie/${recordId(cookie.id)}`, { method: 'DELETE' }))
    );
    return true;
  }

  async getHotspotHosts(): Promise<unknown[]> {
    try {
      const payload = await this.request<unknown[]>('/ip/hotspot/host', { method: 'GET' });
      return toRecordList(payload);
    } catch {
      return [];
    }
  }

  async removeAllHotspotHosts(): Promise<boolean> {
    try {
      const hosts = await this.getHotspotHosts();
      if (hosts.length === 0) return true;
      await Promise.all(
        hosts.map(async (h) => {
          const record = toRecord(h);
          const id = getId(record);
          if (id) {
            await this.request(`/ip/hotspot/host/${recordId(id)}`, { method: 'DELETE' });
          }
        })
      );
      return true;
    } catch (error) {
      console.error('[MikrotikClient] Error removing hotspot hosts:', error);
      return false;
    }
  }

  async getIpBindings(): Promise<MikrotikIpBinding[]> {
    try {
      const payload = await this.request<unknown>('/ip/hotspot/ip-binding', { method: 'GET' });
      return toRecordList(payload).map((record) => ({
        id: getId(record),
        macAddress: toStringValue(record['mac-address']),
        address: toStringValue(record.address),
        toAddress: toStringValue(record['to-address']),
        server: toStringValue(record.server),
        type: toStringValue(record.type) || 'regular',
        comment: toStringValue(record.comment),
        disabled: toBooleanValue(record.disabled),
      }));
    } catch {
      return [];
    }
  }

  async addIpBinding(input: {
    macAddress?: string;
    address?: string;
    toAddress?: string;
    server?: string;
    type: 'regular' | 'bypassed' | 'blocked' | string;
    comment?: string;
  }): Promise<boolean> {
    try {
      const body: Record<string, unknown> = {
        type: input.type,
        comment: input.comment || '',
      };
      if (input.macAddress) body['mac-address'] = input.macAddress;
      if (input.address) body.address = input.address;
      if (input.toAddress) body['to-address'] = input.toAddress;
      if (input.server) body.server = input.server;

      await this.request<unknown>('/ip/hotspot/ip-binding', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return true;
    } catch {
      return false;
    }
  }

  async setIpBindingDisabled(id: string, disabled: boolean): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request<unknown>(`/ip/hotspot/ip-binding/${recordId(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeIpBinding(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await this.request(`/ip/hotspot/ip-binding/${recordId(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async removeAllPortalBindings(): Promise<number> {
    const bindings = await this.getIpBindings();
    const portalBindings = bindings.filter(
      (b) => b.comment?.startsWith('portal-auto-') || b.comment?.startsWith('portal-login-')
    );
    if (portalBindings.length === 0) return 0;
    await Promise.all(portalBindings.map((b) => this.removeIpBinding(b.id)));
    return portalBindings.length;
  }

  async removeAllHotspotActiveByMac(mac: string): Promise<boolean> {
    const sessions = await this.getHotspotActiveSessions();
    const matched = sessions.filter((s) => s.macAddress?.toLowerCase() === mac.toLowerCase());
    if (matched.length === 0) return true;
    await Promise.all(
      matched.map((s) => this.request(`/ip/hotspot/active/${recordId(s.id)}`, { method: 'DELETE' }))
    );
    return true;
  }

  async bounceHotspotInterface(durationSec: number = 2): Promise<boolean> {
    try {
      const hotspots = await this.request<unknown[]>('/ip/hotspot', { method: 'GET' });
      const record = toRecordList(hotspots)[0];
      const interfaceName = toStringValue(record?.interface);
      if (!interfaceName) {
        console.warn('[MikrotikClient] No active hotspot interface found to bounce');
        return false;
      }

      console.log(`[MikrotikClient] Bouncing interface ${interfaceName} (duration: ${durationSec}s)`);

      await this.request(`/interface/${encodeURIComponent(interfaceName)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: true }),
      });

      await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));

      await this.request(`/interface/${encodeURIComponent(interfaceName)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: false }),
      });

      console.log(`[MikrotikClient] Interface ${interfaceName} bounced successfully`);
      return true;
    } catch (error) {
      console.error('[MikrotikClient] Error bouncing hotspot interface:', error);
      return false;
    }
  }

  getConnectionInfo(connected: boolean): MikrotikConnectionInfo {
    const hostWithoutProtocol = normalizeBaseHost(this.host).replace(/^https?:\/\//i, '');

    return {
      host: hostWithoutProtocol,
      username: this.username,
      protocol: this.connectedProtocol,
      connected,
    };
  }

  async getOverview(): Promise<MikrotikOverview> {
    const [
      identity,
      resource,
      routerboard,
      interfaces,
      addresses,
      dhcpServers,
      hotspotServers,
      hotspotProfiles,
      hotspotUsers,
      hotspotActive,
      firewallRules,
      natRules,
      routes,
    ] = await Promise.all([
      this.getSystemIdentity(),
      this.getSystemResource(),
      this.getRouterboard(),
      this.getInterfaces(),
      this.getIpAddresses(),
      this.getDhcpServers(),
      this.getHotspotServers(),
      this.getHotspotProfiles(),
      this.getHotspotUsers(),
      this.getHotspotActiveSessions(),
      this.getFirewallFilterRules(),
      this.getNatRules(),
      this.getRoutes(),
    ]);

    const connected = !!identity || !!resource || interfaces.length > 0;

    return {
      identity,
      resource,
      routerboard,
      interfaces,
      addresses,
      dhcpServers,
      hotspotServers,
      hotspotProfiles,
      hotspotUsers,
      hotspotActive,
      firewallRules,
      natRules,
      routes,
      connection: this.getConnectionInfo(connected),
    };
  }
}

export async function createMikrotikClientFromRequest(req?: Request): Promise<MikrotikClient> {
  const { resolveConnection } = await import('@/lib/network/connections');
  const connection = await resolveConnection('MIKROTIK', req);
  return new MikrotikClient({
    host: connection.baseUrl,
    username: connection.username || '',
    password: connection.credentials.password || '',
    timeoutMs: Number(connection.config.timeoutMs || DEFAULT_TIMEOUT_MS),
    allowInsecure: connection.config.allowInsecure === true,
  });
}
