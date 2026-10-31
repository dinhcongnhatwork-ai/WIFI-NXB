// ============================================
// UniFi Controller API - TypeScript Types
// ============================================

// Basic UniFi Device Types
export interface UnifiDevice {
  _id: string;
  deviceId: string;
  mac: string;
  name: string;
  model: string;
  type: 'uap' | 'usw' | 'ugw' | 'udm' | 'switch' | 'router' | 'gateway';
  firmwareVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  serialNumber?: string;
  uptime?: number;
  status: 'online' | 'offline' | 'upgrading' | 'disconnected' | 'unknown';
  isConnected: boolean;
  lastSeen?: number;
  uptimeSince?: number;
  guestNumSta?: number;
  userNumSta?: number;
  txBytes?: number;
  rxBytes?: number;
  txPackets?: number;
  rxPackets?: number;
  cpuUsage?: number;
  memUsage?: number;
  memory?: number;
  cpu?: number;
  state?: number;
  siteId?: string;
  siteName?: string;
  tags?: string[];
  adoptionStats?: {
    adoptionState?: string;
    lastError?: string;
  };
  radioTable?: UnifiRadio[];
  ethernet?: UnifiEthernetPort[];
  portTable?: UnifiPortTable[];
  vapTable?: UnifiVapTable[];
  networkTable?: UnifiNetwork[];
  uplink?: UnifiUplink;
  generalTemperature?: number;
  generalTemperatureThreshold?: number;
  vapIndex?: number;
  key?: string;
  fwUpdate?: string;
  firmwareUpgrading?: boolean;
  isolated?: boolean;
  disabled?: boolean;
  hasAdopted?: boolean;
}

export interface UnifiRadio {
  _id: string;
  radio: string;
  name: string;
  builtinAntGain: number;
  antennaGain?: number;
  arm?: {
    channel?: number;
    txPowerMode?: string;
    txPower?: number;
    minPower?: number;
    maxPower?: number;
    overrideChannelWidth?: boolean;
    overrideDfs?: boolean;
    overrideMinTxPower?: boolean;
    overridePower?: boolean;
    overrideTxPower?: boolean;
  };
  is11kReport?: boolean;
  is11rReport?: boolean;
  isAirtimeFairness?: boolean;
  isEnabled: boolean;
  isLegacy: boolean;
  minChannel?: number;
  maxChannel?: number;
  channel?: number;
  ht?: string;
  maxTxPower?: number;
  minTxPower?: number;
  nameForEnclosure?: string;
  opMode?: string;
  radarDetected?: boolean;
  speedtestLatencyAverage?: number;
  speedtestPingLast?: number;
  speedtestPingMinLast?: number;
  txPower?: number;
  txPowerMode?: string;
  radioAvailability?: string;
  scanRadioStats?: {
    availableChannels?: number[];
    rssiStats?: { [key: string]: number };
  };
}

export interface UnifiEthernetPort {
  port_idx: number;
  name: string;
  portPoe?: boolean;
  enable?: boolean;
  operational?: boolean;
  poe?: boolean;
  speed?: number;
  fullDuplex?: boolean;
  rxBroadcast?: number;
  rxBytes?: number;
  rxDropped?: number;
  rxErrors?: number;
  rxMulticast?: number;
  rxPackets?: number;
  txBroadcast?: number;
  txBytes?: number;
  txDropped?: number;
  txErrors?: number;
  txMulticast?: number;
  txPackets?: number;
  up?: boolean;
  mac?: string;
  ip?: string;
  netmask?: string;
  gateway?: string;
  dnsServers?: string[];
  type?: string;
  PoESupported?: boolean;
  PoEVoltage?: number;
  PoECurrent?: number;
  PoEPower?: number;
  PoEEnable?: boolean;
}

export interface UnifiPortTable extends UnifiEthernetPort {
  macTable?: UnifiMacTable[];
}

export interface UnifiMacTable {
  mac: string;
  ip?: string;
  hostname?: string;
  isCurController?: boolean;
  essid?: string;
  expiresInSeconds?: number;
  lastSeen?: number;
  firstSeen?: number;
  apMac?: string;
  apName?: string;
  ssid?: string;
  duration?: number;
  oui?: string;
  authorized?: boolean;
  byUAP?: boolean;
  byUGW?: boolean;
  blocked?: number;
  isGuest?: boolean;
  isReplayProtected?: number;
  isRoboseguardProtected?: number;
  isStatic?: boolean;
  note?: string;
  name?: string;
  userId?: string;
  macPrefix?: string;
  isWireless?: boolean;
}

export interface UnifiVapTable {
  _id: string;
  bssid: string;
  essid: string;
  radio: string;
  radioName?: string;
  wlanconfId?: string;
  siteId?: string;
  isEnabled: boolean;
  security: string;
  wpaEncryption?: string;
  wpaFlags?: string;
  dtimMode?: string;
  dtim?: number;
  beaconMode?: string;
  beaconInterval?: number;
  mimoMode?: string;
  channel?: number;
  txPower?: number;
  minRSSI?: number;
  minSignalToNoiseRatio?: number;
  loadBalancingEnabled?: boolean;
  macFilterEnabled?: boolean;
  macFilterList?: string[];
  macAddress?: string;
  wlanConfigId?: string;
  wpaPsk?: string;
  wpaCipher?: string;
  wpaVersion?: string;
  hideSSID?: boolean;
  multicastenhance?: string;
  minRate?: string;
  maxRate?: string;
 广电Enabled?: boolean;
 广电AutoAdjustment?: boolean;
 广电Down?: number;
 广电Up?: number;
 广电AutoMax?: number;
 广电Max?: number;
 广电Show?: boolean;
 广电AutoMaxEnable?: boolean;
 广电AutoAdjustmentInterval?: number;
 广电AutoAdjustmentDelay?: number;
 广电AutoAdjustmentThreshold?: number;
 广电AutoAdjustmentMaxThreshold?: number;
 广电MinBandwidth?: number;
 广电MaxBandwidth?: number;
 广电MinSignal?: number;
 广电MaxStations?: number;
 广电ShowInClientTable?: boolean;
 广电WlangroupId?: number;
 广电Wlangroup?: string;
 广电WlangroupKey?: string;
 广电NasId?: string;
 广电AcctServer?: string;
 广电AcctPort?: number;
 广电AcctSecret?: string;
 广电CoaServer?: string;
 广电CoaPort?: number;
 广电CoaSecret?: string;
 广电DynamicVlan?: string;
 广电VlanId?: number;
 广电DynamicVlanPool?: string;
 广电VlanPool?: number[];
 广电DynamicVlanPoolKey?: string;
 广电AuthServer?: string;
 广电AuthPort?: number;
 广电AuthSecret?: string;
 广电AuthMethod?: string;
 广电AuthSar?: string;
 广电EapolKey?: string;
 广电PmMode?: string;
 广电PmAllow?: string;
 广电PmIgnoreBss?: string;
 广电PmIgnoreUclient?: string;
 广电PmIgnoreUeap?: string;
 广电PmStrict?: string;
 广电PmReauthInterval?: string;
 广电Wpa?: string;
 广电WpaInCiphers?: string;
 广电WpaIn8021X?: string;
 广电WpaOutCiphers?: string;
 广电WpaOut8021X?: string;
 广电ProxyArp?: string;
 广电Multicast?: string;
 广电LocalProxy?: string;
 广电GroupRekey?: number;
 广电RekeyInterval?: number;
 广电Opt82Enabled?: string;
 广电Opt82Format?: string;
 广电Opt82Match?: string;
 广电Opt82Insert?: string;
 广电Opt82Strip?: string;
 广电Opt82Vlan?: string;
 广电Opt82VlanName?: string;
 广电UserGroupId?: string;
 广电UserGroup?: string;
 广电UserGroupKey?: string;
 广电L2Isolate?: string;
 广电ApGroupId?: string;
 广电ApGroup?: string;
 广电ApGroupKey?: string;
 广电ApTable?: string[];
 广电ApTableKey?: string;
 广电ApMacsList?: string[];
 广电ApMacsKey?: string;
 广电ApMacsFilter?: string;
 广电ApMacsFilterKey?: string;
 广电ScheduleEnabled?: string;
 广电Schedule?: string;
 广电ScheduleKey?: string;
 广电ScheduleTimes?: string;
 广电ScheduleTimesKey?: string;
 广电ScheduleMode?: string;
 广电ScheduleDeny?: string;
 广电ScheduleDenyKey?: string;
 广电ScheduleDenyTimes?: string;
 广电ScheduleDenyTimesKey?: string;
 广电ScheduleDenyExclude?: string;
 广电ScheduleDenyExcludeKey?: string;
 广电ScheduleDenyExcludeTimes?: string;
 广电ScheduleDenyExcludeTimesKey?: string;
 广电ScheduleDenyExcludeMode?: string;
 广电ScheduleExemptEnabled?: string;
 广电ScheduleExempt?: string;
 广电ScheduleExemptKey?: string;
 广电ScheduleExemptTimes?: string;
 广电ScheduleExemptTimesKey?: string;
 广电ScheduleExemptMode?: string;
 广电ScheduleExemptDeny?: string;
 广电ScheduleExemptDenyKey?: string;
 广电ScheduleExemptDenyTimes?: string;
 广电ScheduleExemptDenyTimesKey?: string;
 广电ScheduleExemptDenyExclude?: string;
 广电ScheduleExemptDenyExcludeKey?: string;
 广电ScheduleExemptDenyExcludeTimes?: string;
 广电ScheduleExemptDenyExcludeTimesKey?: string;
 广电ScheduleExemptDenyExcludeMode?: string;
}

export interface UnifiNetwork {
  _id: string;
  siteId: string;
  vlanId?: number;
  name: string;
  purpose: string;
  isNasEnabled?: boolean;
  isUbrouted?: boolean;
  isGuest?: boolean;
  isCorporate?: boolean;
  isNat?: boolean;
  isDynamic?: boolean;
  isDnsOverride?: boolean;
  isManual?: boolean;
  ipSubnet?: string;
  ipSubnetGw?: string;
  ipSubnetNum?: number;
  dhcpdEnabled?: boolean;
  dhcpdStart?: string;
  dhcpdStop?: string;
  dhcpdLease?: number;
  dhcpRelay?: boolean;
  dhcpServerAddress?: string;
  domainName?: string;
  dnsResolved?: boolean;
  dnsService?: string;
  enabled?: boolean;
  hidden?: boolean;
  igmpSnooping?: string;
  localDhcpEnabled?: boolean;
  mac?: string;
  multicastGroupRange?: string;
  networkgroup?: string;
  numStations?: number;
  rxBytes?: number;
  rxPackets?: number;
  txBytes?: number;
  txPackets?: number;
  uri?: string;
  vlan?: number;
  vpnType?: string;
  x_domain?: string;
  attrHiddenId?: string;
  attrNoDelete?: boolean;
  dhcpdBootEnabled?: boolean;
  dhcpdBootFilename?: string;
  dhcpdBootServer?: string;
  dhcpdNtpServerEnabled?: boolean;
  dhcpdNtpServer?: string;
  dhcpdTimeOffsetEnabled?: boolean;
  dhcpdTimeOffset?: number;
  dhcpdUnifiController?: string;
  domainNameProtocol?: string;
  gatewayEnabled?: boolean;
  ipv6InterfaceType?: string;
  ipv6pdInterface?: string;
  ipv6pdStart?: string;
  ipv6pdStop?: string;
  ipv6raEnabled?: string;
  matchId?: string;
  mtu?: number;
  multicastToUnicast?: string;
  networkType?: string;
  qosId?: number;
  qosPriority?: number;
  siteIdProtocol?: string;
  subjectMatch?: string;
  useGroupPolicies?: string;
  vpn?: string;
  wifiCredentials?: {
    id?: string;
    name?: string;
    passphrase?: string;
    type?: string;
    x_password?: string;
  };
}

export interface UnifiUplink {
  mac: string;
  ip: string;
  uplinkType: 'wired' | 'wireless' | 'cell' | 'lte' | 'none';
  uplinkName?: string;
  uplinkRemotePort?: number;
  dns?: string[];
  gateway?: string;
  isGwUplink?: boolean;
  isUplink?: boolean;
  maxSpeed?: number;
  netmask?: string;
  numPort?: number;
  poeClass?: string;
  poeEnable?: boolean;
  poeMode?: string;
  poePower?: string;
  poeVoltage?: number;
  rxBytes?: number;
  rxBytesR?: number;
  rxErrors?: number;
  rxPackets?: number;
  rxRate?: number;
 服务质量?: string;
  signal?: number;
  txBytes?: number;
  txBytesR?: number;
  txErrors?: number;
  txPackets?: number;
  txRate?: number;
  uptime?: number;
}

export interface UnifiUser {
  _id: string;
  mac: string;
  ip?: string;
  hostname?: string;
  firstSeen?: number;
  lastSeen?: number;
  isGuest?: boolean;
  isWireless?: boolean;
  isBlocked?: boolean;
  isUbrouted?: boolean;
  isRemoteUser?: boolean;
  isWired?: boolean;
  authorized?: boolean;
  manualAp?: boolean;
  name?: string;
  note?: string;
  oui?: string;
  siteId?: string;
  userGroupId?: string;
  userGroupName?: string;
  apMac?: string;
  apName?: string;
  ssid?: string;
  bssid?: string;
  channel?: number;
  uptime?: number;
  rxBytes?: number;
  txBytes?: number;
  rxPackets?: number;
  txPackets?: number;
  signal?: number;
  noise?: number;
  rssi?: number;
  assocTime?: number;
  inactivityTime?: number;
  lastSession?: string;
  txRetries?: number;
  macAddress?: string;
  bytes?: number;
  generalTemperature?: number;
  fwUpdate?: string;
  osName?: string;
  networkGroup?: string;
  networkName?: string;
  qosStrategy?: string;
  qosUnsupportedReason?: string;
  qosOverridden?: boolean;
  qosOverriddenRules?: string;
  qosApplied?: string;
  fingerprintAlias?: string;
  fingerprintOs?: string;
  fingerprintBrowser?: string;
  fingerprintMatch?: string;
  fixedIp?: boolean;
  ipAddress?: string;
  macAddressProtocol?: string;
  macFilterEnabled?: boolean;
  macFilterList?: string[];
  macFilterMac?: string[];
  minSignalToNoiseRatio?: number;
  networkIdProtocol?: string;
  notes?: Array<{
    key?: string;
    value?: string;
    by?: string;
    at?: number;
  }>;
 排水沟qosStats?: {
    downPackets?: number;
    downBytes?: number;
    upPackets?: number;
    upBytes?: number;
  };
}

export interface UnifiWlanConf {
  _id: string;
  name: string;
  ssid: string;
  enabled: boolean;
  security: string;
  wpaPsk?: string;
  wpaCipher?: string;
  wpaVersion?: string;
  hiddenSSID?: boolean;
  isGuest: boolean;
  userGroupId?: string;
  userGroupName?: string;
  vlanId?: number;
  vlanEnabled?: boolean;
  multicastenhance?: string;
  macFilterEnabled?: boolean;
  macFilterList?: string[];
  macFilterPolicy?: string;
  minRate?: string;
  maxRate?: string;
  dtimMode?: string;
  dtim?: number;
  beaconMode?: string;
  beaconInterval?: number;
  mimoMode?: string;
  apGroupId?: string;
  apGroupName?: string;
  scheduleEnabled?: boolean;
  schedule?: string;
  wlanBand?: string;
  wlangroupId?: string;
  wlangroupName?: string;
  loadBalanceEnabled?: boolean;
  minRSSI?: number;
  minSignalToNoiseRatio?: number;
  auth?: string;
  authPortal?: string;
  authRADIUS?: string;
  acctServer?: string;
  acctPort?: number;
  acctSecret?: string;
  coaServer?: string;
  coaPort?: number;
  coaSecret?: string;
  dynamicVlan?: string;
  vlanPool?: string;
  nasId?: string;
  dpiEnabled?: boolean;
  l3AclTemplateId?: string;
  portalEnabled?: boolean;
  portalType?: string;
  captivePortalBypassEnabled?: boolean;
  captivePortalBypassAuthorized?: boolean;
  captivePortalBypassForMembers?: boolean;
  walledGardenEnabled?: boolean;
  walledGardenEntries?: Array<{
    desc?: string;
    url?: string;
  }>;
  siteId: string;
  attrHiddenId?: string;
  attrNoDelete?: boolean;
  attrRoaming?: boolean;
  hideSSID?: boolean;
  multicastToUnicast?: string;
  igmpSnooping?: string;
  proxyArp?: string;
  groupRekeyInterval?: number;
  uapsdEnabled?: boolean;
  vlanPoolList?: string[];
  isolationEnabled?: boolean;
}

export interface UnifiSite {
  _id: string;
  name: string;
  desc: string;
  attrNoDelete?: boolean;
  attrHiddenId?: string;
  role?: string;
  pingCheckEnabled?: boolean;
  pingCheckTarget?: string;
  pingCheckFailureThreshold?: number;
  pingCheckInterval?: number;
  pingCheckKillTimeout?: number;
  numDevices?: number;
  numUsers?: number;
  twakeEnabled?: boolean;
  siteId: string;
  oltId?: string;
  countryCode?: string;
  lang?: string;
  timezone?: string;
  timezoneArea?: string;
  time?: string;
  timezoneOffset?: number;
  now?: number;
  startTime?: number;
  endTime?: number;
  sysStats?: {
    cpu: number;
    mem: number;
    uptime: number;
    loadavg: [number, number, number];
    cpuUsage?: number;
    memUsage?: number;
  };
}

export interface UnifiDashboardStats {
  siteId: string;
  siteName: string;
  deviceCount: number;
  onlineDevices: number;
  offlineDevices: number;
  userCount: number;
  guestCount: number;
  activeUsers: number;
  totalRxBytes: number;
  totalTxBytes: number;
  uptime: number;
}

export interface UnifiSpeedtestResult {
  latency: number;
  jitter: number;
  rxBps: number;
  txBps: number;
  rxBytes: number;
  txBytes: number;
  status: string;
  timestamp: number;
}

export interface UnifiClientStats {
  mac: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  signal: number;
  uptime: number;
  lastSeen: number;
}

export interface UnifiFirewallRule {
  _id: string;
  enabled: boolean;
  name: string;
  action: 'accept' | 'drop' | 'reject';
  protocols?: string[];
  src_firewallGroupTypes?: string[];
  src_address?: string;
  src_networkConf?: string[];
  src_networkTable?: string[];
  src_firewallGroups?: string[];
  src_cidr?: string;
  src_country?: string[];
  src_ip?: string;
  src_mac?: string;
  src_network?: string;
  dst_address?: string;
  dst_networkConf?: string[];
  dst_networkTable?: string[];
  dst_firewallGroups?: string[];
  dst_cidr?: string;
  dst_country?: string[];
  dst_ip?: string;
  dst_mac?: string;
  dst_network?: string;
  dst_port?: string;
  logging?: boolean;
  ruleset?: 'WAN' | 'LAN' | 'GUEST' | 'WANv6' | 'LANv6' | 'GUESTv6';
  rule_index?: number;
  siteId: string;
  attrNoDelete?: boolean;
  attrRoaming?: boolean;
}

export interface UnifiFirewallGroup {
  _id: string;
  name: string;
  type: string;
  members: string[];
  siteId: string;
  attrNoDelete?: boolean;
  attrHiddenId?: boolean;
}

export interface UnifiPortForward {
  _id: string;
  enabled: boolean;
  name: string;
  src_ip?: string;
  src_port: string;
  dst_ip: string;
  dst_port: string;
  protocol: 'tcp' | 'udp' | 'tcp_udp';
  log: boolean;
  siteId: string;
  fwMark?: string;
  rdr?: string;
  attrNoDelete?: boolean;
}

export interface UnifiDhcpReservation {
  _id: string;
  ip: string;
  mac: string;
  name: string;
  leasetime?: string;
  siteId: string;
  networkId?: string;
}

export interface UnifiDhcpPool {
  _id: string;
  enabled: boolean;
  start: string;
  end: string;
  subnet: string;
  lease: number;
  siteId: string;
  networkId?: string;
}

export interface UnifiTrafficRule {
  _id: string;
  name: string;
  enabled: boolean;
  target: 'all' | 'unlimited' | 'limited';
  downloadLimit?: number;
  uploadLimit?: number;
  downloadLimitPerUser?: number;
  uploadLimitPerUser?: number;
  qosCategoryName?: string;
  siteId: string;
  userGroupId?: string;
}

export interface UnifiUserGroup {
  _id: string;
  name: string;
  siteId: string;
  qosRateMarkDownEnabled?: boolean;
  bandwidthPolicyDown?: number;
  bandwidthPolicyUp?: number;
  attrNoDelete?: boolean;
}

export interface UnifidpiStats {
  _id: string;
  siteId: string;
  timestamp: number;
  byCat?: {
    [category: string]: {
      txBytes: number;
      rxBytes: number;
      catName?: string;
    };
  };
  byApp?: {
    [app: string]: {
      txBytes: number;
      rxBytes: number;
      appName?: string;
    };
  };
}

export interface UnifiAlert {
  _id: string;
  key: string;
  name: string;
  message: string;
  datetime: number;
  severity: 'info' | 'notice' | 'warning' | 'critical';
  siteId: string;
  isArchived: boolean;
  isRead: boolean;
  isDismissed: boolean;
  meta?: {
    [key: string]: string;
  };
}

export interface UnifiHealthMetrics {
  internet: {
    status: 'online' | 'offline' | 'degraded';
    uptime: number;
    latency: number;
    downloadSpeed: number;
    uploadSpeed: number;
    wanIp: string;
    wanMac: string;
    wan2Ip?: string;
    wan2Mac?: string;
  };
  wifi: {
    clients: number;
    accessPoints: number;
    ssids: number;
    channelUtilization: number;
  };
  wan: Array<{
    name: string;
    ip: string;
    mac: string;
    status: string;
    latency: number;
    downloadSpeed: number;
    uploadSpeed: number;
  }>;
}

export interface UnifiDeviceSettings {
  deviceId: string;
  generalSettings?: {
    name?: string;
    deviceImage?: string;
    deviceId?: string;
  };
  ipSettings?: {
    ipAddress?: string;
    netmask?: string;
    gateway?: string;
    dns?: string[];
  };
  managementSettings?: {
    informHost?: string;
    informPort?: number;
  };
  ledSettings?: {
    enabled?: boolean;
    reverse?: boolean;
  };
  upgradeSettings?: {
    lockUpgradePolicy?: boolean;
  };
}

export interface UnifiBlockClientRequest {
  mac: string;
  reason?: string;
}

export interface UnifiUnblockClientRequest {
  mac: string;
}

export interface UnifiRogueAp {
  _id: string;
  ssid?: string;
  bssid: string;
  radio: string;
  rssi: number;
  channel: number;
  isExpanded: false;
  isUnmanaged: boolean;
  isBlocked: boolean;
  lastSeen: number;
  oui: string;
  capability: string;
  phyMode: string;
  security: string;
  siteId: string;
  nearbyRssi?: number;
}

export interface UnifiEvent {
  _id: string;
  key: string;
  name: string;
  timestamp: number;
  siteId: string;
  severity: 'info' | 'notice' | 'warning' | 'critical';
  msg: string;
  meta?: {
    [key: string]: string;
  };
}

export interface UnifiHealth {
  subsystems: Array<{
    name: string;
    status: 'ok' | 'degraded' | 'down';
    statusColor: string;
    metric: string;
    value: number;
    unit: string;
  }>;
}

export interface UnifiPacketStats {
  timestamp: number;
  rxPackets: number;
  rxErrors: number;
  rxDropped: number;
  txPackets: number;
  txErrors: number;
  txDropped: number;
}

export interface UnifiVlanPool {
  _id: string;
  name: string;
  vlans: number[];
  siteId: string;
}

export interface UnifiHotspotOperator {
  _id: string;
  name: string;
  email: string;
  siteId: string;
}

export interface UnifiHotspotVoucher {
  _id: string;
  code: string;
  status: 'active' | 'expired' | 'used';
  createTime: number;
  expireTime: number;
  downloadCapacity: number;
  uploadCapacity: number;
  dataCapacity: number;
  qosUpload: number;
  qosDownload: number;
  duration: number;
  siteId: string;
  userGroupId?: string;
  note?: string;
}

export interface UnifiHotspotGuest {
  _id: string;
  mac: string;
  name?: string;
  email?: string;
  status: string;
  siteId: string;
  createdAt?: number;
  note?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface UnifiLoginRequest {
  username: string;
  password: string;
}

export interface UnifiLoginResponse {
  name?: string;
  username?: string;
  lastSiteName?: string;
  token?: string;
  cookie?: string;
  redirectUrl?: string;
  roles?: string[];
  meta?: { rc: string };
}

export interface UnifiApiResponse<T> {
  data: T;
  meta?: {
    rc: string;
    msg?: string;
  };
}

export interface UnifiListResponse<T> {
  data: T[];
  meta?: {
    rc: string;
    msg?: string;
  };
}

export interface UnifiError {
  error: string;
  error_description?: string;
  meta?: {
    rc: string;
    msg?: string;
  };
}

// Controller Info
export interface UnifiControllerInfo {
  name: string;
  version: string;
  baseUrl: string;
  countryCode?: string;
  timezone?: string;
}

// Speedtest Request
export interface UnifiSpeedtestRequest {
  host?: string;
  port?: number;
  type?: 'download' | 'upload' | 'both';
}

// Firmware Update Request
export interface UnifiFirmwareUpdateRequest {
  deviceId: string;
  firmwareUrl?: string;
}

// LED Settings Request
export interface UnifiLedSettingsRequest {
  deviceId: string;
  enabled?: boolean;
  reverse?: boolean;
}

// Device Name Request
export interface UnifiDeviceNameRequest {
  name: string;
  deviceId: string;
}

// SSID Create/Update Request
export interface UnifiSsidRequest {
  name: string;
  security?: 'open' | 'wep' | 'wpapsk' | 'wpa2psk' | 'wpapsk+ wpa2psk' | 'wpa3' | 'wpa3-ent' | 'wpawpa2psk' | 'wpaowpa2ent';
  passphrase?: string;
  hideSsid?: boolean;
  isGuest?: boolean;
  enabled?: boolean;
  vlanId?: number;
  vlanEnabled?: boolean;
  userGroupId?: string;
  wpa3Transition?: boolean;
  scheduleEnabled?: boolean;
  schedule?: string;
  macFilterEnabled?: boolean;
  macFilterList?: string[];
  macFilterPolicy?: 'allow' | 'deny';
  minRate?: string;
  maxRate?: string;
  dtim?: number;
  beaconInterval?: number;
  minRSSI?: number;
  loadBalancingEnabled?: boolean;
  isolateClients?: boolean;
  multicastenhance?: string;
  wlanBand?: '2g' | '5g' | '6g' | 'both';
  apGroupIds?: string[];
}

// Device Adoption Request
export interface UnifiAdoptionRequest {
  deviceId: string;
  host: string;
  port?: number;
}

// Radio Settings Request
export interface UnifiRadioRequest {
  deviceId: string;
  radio: string;
  enabled?: boolean;
  channel?: number;
  txPowerMode?: 'auto' | 'manual';
  txPower?: number;
  minTxPower?: number;
  maxTxPower?: number;
  overrideChannelWidth?: boolean;
  overrideDfs?: boolean;
  overrideMinTxPower?: boolean;
  overridePower?: boolean;
  overrideTxPower?: boolean;
}

// PoE Port Settings Request
export interface UnifiPortRequest {
  deviceId: string;
  portIdx: number;
  poeMode?: 'auto' | 'off' | 'passive24v' | '50v' | '55v' | 'lldpmed';
  name?: string;
  enable?: boolean;
  up?: boolean;
}

// Network Create/Update Request
export interface UnifiNetworkRequest {
  name: string;
  purpose: 'corporate' | 'guest' | 'wan' | 'lan';
  vlanId?: number;
  vlanEnabled?: boolean;
  ipSubnet?: string;
  ipSubnetGw?: string;
  dhcpdEnabled?: boolean;
  dhcpdStart?: string;
  dhcpdStop?: string;
  dhcpdLease?: number;
  domainName?: string;
  dnsServer1?: string;
  dnsServer2?: string;
  enabled?: boolean;
  isNat?: boolean;
  igmpSnooping?: string;
}

// User Group Request
export interface UnifiUserGroupRequest {
  name: string;
  bandwidthPolicyDown?: number;
  bandwidthPolicyUp?: number;
  qosRateMarkDownEnabled?: boolean;
}

// DHCP Reservation Request
export interface UnifiDhcpReservationRequest {
  ip: string;
  mac: string;
  name: string;
  leasetime?: string;
}

// Port Forward Request
export interface UnifiPortForwardRequest {
  name: string;
  src_ip?: string;
  src_port: string;
  dst_ip: string;
  dst_port: string;
  protocol: 'tcp' | 'udp' | 'tcp_udp';
  log?: boolean;
  enabled?: boolean;
}

// Firewall Rule Request
export interface UnifiFirewallRuleRequest {
  name: string;
  enabled?: boolean;
  action: 'accept' | 'drop' | 'reject';
  ruleset?: 'WAN' | 'LAN' | 'GUEST' | 'WANv6' | 'LANv6' | 'GUESTv6';
  src_ip?: string;
  src_mac?: string;
  src_network?: string;
  src_cidr?: string;
  src_port?: string;
  dst_ip?: string;
  dst_mac?: string;
  dst_network?: string;
  dst_cidr?: string;
  dst_port?: string;
  protocols?: string[];
  logging?: boolean;
}

// DPI Settings Request
export interface UnifiDpiRequest {
  enabled: boolean;
  siteId?: string;
}

// ============================================
// Dashboard/Overview Types
// ============================================

export interface UnifiOverview {
  sites: UnifiSite[];
  devices: UnifiDevice[];
  clients: UnifiUser[];
  stats: UnifiDashboardStats;
  alerts: UnifiAlert[];
  health: UnifiHealth;
}
