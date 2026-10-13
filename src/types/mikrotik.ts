export type MikrotikRawRecord = Record<string, unknown>;

export interface MikrotikConnectionInfo {
  host: string;
  username: string;
  protocol: 'http' | 'https';
  connected: boolean;
}

export interface MikrotikSystemIdentity {
  name: string;
}

export interface MikrotikSystemResource {
  uptime?: string;
  version?: string;
  buildTime?: string;
  freeMemory?: number;
  totalMemory?: number;
  cpuLoad?: number;
  cpuCount?: number;
  freeHddSpace?: number;
  totalHddSpace?: number;
  architectureName?: string;
  boardName?: string;
  platform?: string;
}

export interface MikrotikInterface {
  id: string;
  name: string;
  type?: string;
  disabled: boolean;
  running: boolean;
  mtu?: number;
  actualMtu?: number;
  macAddress?: string;
  comment?: string;
  rxByte?: number;
  txByte?: number;
  lastLinkUpTime?: string;
}

export interface MikrotikIpAddress {
  id: string;
  address: string;
  network?: string;
  interface?: string;
  dynamic: boolean;
  disabled: boolean;
  comment?: string;
}

export interface MikrotikDhcpServer {
  id: string;
  name: string;
  interface?: string;
  addressPool?: string;
  leaseTime?: string;
  disabled: boolean;
}

export interface MikrotikDhcpLease {
  id: string;
  address?: string;
  macAddress?: string;
  hostName?: string;
  server?: string;
  status?: string;
  dynamic: boolean;
  blocked: boolean;
  disabled: boolean;
}

export interface MikrotikIpBinding {
  id: string;
  macAddress?: string;
  address?: string;
  type?: string;
  comment?: string;
}

export interface MikrotikRoute {
  id: string;
  dstAddress?: string;
  gateway?: string;
  distance?: number;
  active: boolean;
  dynamic: boolean;
  disabled: boolean;
}

export interface MikrotikFirewallRule {
  id: string;
  chain?: string;
  action?: string;
  protocol?: string;
  srcAddress?: string;
  dstAddress?: string;
  srcPort?: string;
  dstPort?: string;
  inInterface?: string;
  outInterface?: string;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
}

export interface MikrotikHotspotProfile {
  id: string;
  name: string;
  dnsName?: string;
  htmlDirectory?: string;
  loginBy?: string;
  idleTimeout?: string;
  keepaliveTimeout?: string;
  statusAutorefresh?: string;
}

export interface MikrotikHotspotServer {
  id: string;
  name: string;
  interface?: string;
  profile?: string;
  addressPool?: string;
  idleTimeout?: string;
  keepaliveTimeout?: string;
  disabled: boolean;
}

export interface MikrotikHotspotUser {
  id: string;
  name: string;
  password?: string;
  profile?: string;
  server?: string;
  limitUptime?: string;
  comment?: string;
  disabled: boolean;
}

export interface MikrotikHotspotActiveSession {
  id: string;
  user?: string;
  address?: string;
  macAddress?: string;
  server?: string;
  loginBy?: string;
  uptime?: string;
  idleTime?: string;
  bytesIn?: number;
  bytesOut?: number;
}

export interface MikrotikHotspotCookie {
  id: string;
  user?: string;
  macAddress?: string;
  ipAddress?: string;
  expiresAfter?: string;
}

export interface MikrotikOverview {
  identity: MikrotikSystemIdentity | null;
  resource: MikrotikSystemResource | null;
  interfaces: MikrotikInterface[];
  addresses: MikrotikIpAddress[];
  dhcpServers: MikrotikDhcpServer[];
  hotspotServers: MikrotikHotspotServer[];
  hotspotProfiles: MikrotikHotspotProfile[];
  hotspotUsers: MikrotikHotspotUser[];
  hotspotActive: MikrotikHotspotActiveSession[];
  firewallRules: MikrotikFirewallRule[];
  routes: MikrotikRoute[];
  connection: MikrotikConnectionInfo;
}
