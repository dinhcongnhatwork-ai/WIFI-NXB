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
  cpuFrequency?: number;
  freeHddSpace?: number;
  totalHddSpace?: number;
  architectureName?: string;
  boardName?: string;
  platform?: string;
}

export interface MikrotikRouterboard {
  routerboard?: boolean;
  model?: string;
  serialNumber?: string;
  currentFirmware?: string;
  upgradeFirmware?: string;
  firmwareType?: string;
  revision?: string;
}

export interface MikrotikSystemLog {
  id: string;
  time: string;
  topics: string;
  message: string;
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
  rxPacket?: number;
  txPacket?: number;
  rxError?: number;
  txError?: number;
  lastLinkUpTime?: string;
  linkDowns?: number;
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
  expiresAfter?: string;
  dynamic: boolean;
  blocked: boolean;
  disabled: boolean;
  comment?: string;
}

export interface MikrotikArpEntry {
  id: string;
  address: string;
  macAddress?: string;
  interface: string;
  dynamic: boolean;
  complete: boolean;
  disabled: boolean;
  comment?: string;
}

export interface MikrotikIpPool {
  id: string;
  name: string;
  ranges: string;
  total?: number;
  used?: number;
  available?: number;
}

export interface MikrotikIpBinding {
  id: string;
  macAddress?: string;
  address?: string;
  toAddress?: string;
  server?: string;
  type?: 'regular' | 'bypassed' | 'blocked' | string;
  comment?: string;
  disabled?: boolean;
}

export interface MikrotikRoute {
  id: string;
  dstAddress?: string;
  gateway?: string;
  distance?: number;
  routingTable?: string;
  active: boolean;
  dynamic: boolean;
  disabled: boolean;
  comment?: string;
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
  bytes?: number;
  packets?: number;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
}

export interface MikrotikNatRule {
  id: string;
  chain: string;
  action: string;
  toAddresses?: string;
  toPorts?: string;
  srcAddress?: string;
  dstAddress?: string;
  protocol?: string;
  srcPort?: string;
  dstPort?: string;
  outInterface?: string;
  inInterface?: string;
  bytes?: number;
  packets?: number;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
}

export interface MikrotikAddressList {
  id: string;
  list: string;
  address: string;
  timeout?: string;
  creationTime?: string;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
}

export interface MikrotikSimpleQueue {
  id: string;
  name: string;
  target?: string;
  maxLimit?: string;
  limitAt?: string;
  priority?: string;
  bytes?: string;
  totalBytes?: number;
  rate?: string;
  comment?: string;
  disabled: boolean;
  dynamic?: boolean;
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

export interface MikrotikHotspotUserProfile {
  id: string;
  name: string;
  rateLimit?: string;
  sharedUsers?: number | string;
  sessionTimeout?: string;
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
  limitBytesTotal?: number;
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
  packetsIn?: number;
  packetsOut?: number;
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
  routerboard?: MikrotikRouterboard | null;
  interfaces: MikrotikInterface[];
  addresses: MikrotikIpAddress[];
  dhcpServers: MikrotikDhcpServer[];
  hotspotServers: MikrotikHotspotServer[];
  hotspotProfiles: MikrotikHotspotProfile[];
  hotspotUsers: MikrotikHotspotUser[];
  hotspotActive: MikrotikHotspotActiveSession[];
  firewallRules: MikrotikFirewallRule[];
  natRules?: MikrotikNatRule[];
  routes: MikrotikRoute[];
  connection: MikrotikConnectionInfo;
}
