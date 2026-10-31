import { networkLabel } from './labels';
export type Provider = 'unifi' | 'mikrotik';
export type Field = { key: string; label: string; type?: 'text'|'number'|'password'|'checkbox'|'select'|'string-array'; required?: boolean; options?: string[]; reference?: string; min?:number; max?:number };
export type Resource = { id:string; label:string; group:string; path:string; fields:Field[]; create?:boolean; update?:boolean; delete?:boolean; toggle?:string; reorder?:boolean; singleton?:boolean; command?:string; admin?:boolean; reason?:string };
const text = (key:string,label:string,required=false,reference?:string):Field => ({key,label,required,reference,type:'text'});
const array = (key:string,label:string):Field => ({key,label,type:'string-array'});
const bool = (key:string,label:string):Field => ({key,label,type:'checkbox'});
const num = (key:string,label:string,min=0,max=2147483647):Field => ({key,label,type:'number',min,max});
const select = (key:string,label:string,options:string[],required=true):Field => ({key,label,options,required,type:'select'});
const disabled=bool('disabled','Disabled');
const comment=text('comment','Comment');
const name=text('name','Name',true);
const iface=text('interface','Interface',true,'interfaces');
const firewall=[select('chain','Chain',['input','forward','output','prerouting','postrouting']),text('action','Action',true),text('protocol','Protocol'),text('src-address','Source address'),text('dst-address','Destination address'),text('src-port','Source port'),text('dst-port','Destination port'),text('in-interface','Incoming interface',false,'interfaces'),text('out-interface','Outgoing interface',false,'interfaces'),comment,disabled];
const mk=(id:string,label:string,group:string,path:string,fields:Field[],extra:Partial<Resource>={}):Resource=>({id,label,group,path,fields,create:true,update:true,delete:true,toggle:'disabled',...extra});
export const mikrotikResources:Resource[]=[
 mk('interfaces','Interfaces','Interfaces','/interface',[name,comment,disabled],{create:false,delete:false}),
 mk('ethernet','Ethernet / PoE','Interfaces','/interface/ethernet',[name,num('mtu','MTU',68,9216),select('poe-out','PoE output',['auto-on','forced-on','off'],false),comment,disabled],{create:false,delete:false}),
 mk('bridge','Bridges','Interfaces','/interface/bridge',[name,select('protocol-mode','Spanning tree',['rstp','mstp','none']),bool('vlan-filtering','VLAN filtering'),comment,disabled]),
 mk('bridgeports','Bridge ports','Interfaces','/interface/bridge/port',[text('bridge','Bridge',true,'bridge'),iface,num('pvid','Port VLAN ID',1,4094),comment,disabled]),
 mk('bridgevlan','Bridge VLAN table','Interfaces','/interface/bridge/vlan',[text('bridge','Bridge',true,'bridge'),text('vlan-ids','VLAN IDs',true),text('tagged','Tagged interfaces'),text('untagged','Untagged interfaces'),comment,disabled]),
 mk('vlan','VLAN interfaces','Interfaces','/interface/vlan',[name,iface,num('vlan-id','VLAN ID',1,4094),comment,disabled]),
 mk('bonding','Bonding','Interfaces','/interface/bonding',[name,text('slaves','Member interfaces',true),select('mode','Mode',['802.3ad','active-backup','balance-rr','balance-xor','broadcast','balance-tlb','balance-alb']),comment,disabled]),
 mk('addresses','IP addresses','IP / DHCP','/ip/address',[text('address','Address / prefix',true),iface,comment,disabled]),
 mk('dns','DNS','IP / DHCP','/ip/dns',[text('servers','DNS servers'),bool('allow-remote-requests','Allow remote requests'),num('cache-size','Cache size (KiB)')],{singleton:true,create:false,delete:false,toggle:undefined}),
 mk('pools','Address pools','IP / DHCP','/ip/pool',[name,text('ranges','Address ranges',true),text('next-pool','Next pool',false,'pools')],{toggle:undefined}),
 mk('dhcpservers','DHCP servers','IP / DHCP','/ip/dhcp-server',[name,iface,text('address-pool','Address pool',true,'pools'),text('lease-time','Lease time'),disabled]),
 mk('dhcpnetworks','DHCP networks','IP / DHCP','/ip/dhcp-server/network',[text('address','Network / prefix',true),text('gateway','Gateway'),text('dns-server','DNS servers'),text('domain','Domain'),comment],{toggle:undefined}),
 mk('leases','DHCP reservations / leases','IP / DHCP','/ip/dhcp-server/lease',[text('address','Reserved address',true),text('mac-address','MAC address',true),text('server','DHCP server',false,'dhcpservers'),comment,disabled]),
 mk('routes','Routes','Routing','/ip/route',[text('dst-address','Destination / prefix',true),text('gateway','Gateway',true),text('routing-table','Routing table',false,'routingtables'),num('distance','Distance',1,255),comment,disabled]),
 mk('routingtables','Routing tables','Routing','/routing/table',[name,bool('fib','Install routes in FIB')],{toggle:undefined}),
 mk('routingrules','Routing rules','Routing','/routing/rule',[text('src-address','Source / prefix'),text('dst-address','Destination / prefix'),select('action','Action',['lookup','lookup-only-in-table','drop','unreachable']),text('table','Routing table',false,'routingtables'),comment,disabled],{reorder:true}),
 ...['filter','nat','mangle','raw'].map(id=>mk(id,`Firewall ${id}`,'Firewall',`/ip/firewall/${id}`,firewall,{reorder:true})),
 mk('addresslists','Address lists','Firewall','/ip/firewall/address-list',[text('list','List',true),text('address','Address / prefix',true),text('timeout','Timeout'),comment,disabled]),
 mk('hotspotservers','Hotspot servers','Hotspot','/ip/hotspot',[name,iface,text('profile','Server profile',false,'hotspotprofiles'),text('address-pool','Address pool',false,'pools'),disabled]),
 mk('hotspotprofiles','Hotspot server profiles','Hotspot','/ip/hotspot/profile',[name,text('dns-name','DNS name'),text('hotspot-address','Hotspot address'),text('html-directory','HTML directory'),text('login-by','Login methods')],{toggle:undefined}),
 mk('hotspotuserprofiles','Hotspot user profiles','Hotspot','/ip/hotspot/user/profile',[name,text('rate-limit','Rate limit'),text('session-timeout','Session timeout'),num('shared-users','Shared users',1)],{toggle:undefined}),
 mk('hotspotusers','Hotspot users','Hotspot','/ip/hotspot/user',[name,{key:'password',label:'Password',type:'password'},text('profile','User profile',false,'hotspotuserprofiles'),text('server','Server',false,'hotspotservers'),text('limit-uptime','Uptime limit'),comment,disabled]),
 mk('hotspotactive','Active sessions','Hotspot','/ip/hotspot/active',[],{create:false,update:false,toggle:undefined}),
 mk('bindings','IP bindings','Hotspot','/ip/hotspot/ip-binding',[text('mac-address','MAC address'),text('address','Address'),select('type','Binding type',['regular','bypassed','blocked']),text('server','Server',false,'hotspotservers'),comment,disabled]),
 mk('simplequeues','Simple queues','Queues / VPN','/queue/simple',[name,text('target','Target address / interface',true),text('max-limit','Upload / download limit',true),text('parent','Parent queue',false,'simplequeues'),comment,disabled],{reorder:true}),
 mk('queuetrees','Queue trees','Queues / VPN','/queue/tree',[name,text('parent','Parent interface / queue',true),text('packet-mark','Packet mark'),text('max-limit','Maximum rate'),num('priority','Priority',1,8),comment,disabled]),
 mk('wireguard','WireGuard interfaces','Queues / VPN','/interface/wireguard',[name,num('listen-port','Listen port',1,65535),num('mtu','MTU',68,9216),comment,disabled]),
 mk('wireguardpeers','WireGuard peers','Queues / VPN','/interface/wireguard/peers',[text('interface','WireGuard interface',true,'wireguard'),text('public-key','Public key',true),text('allowed-address','Allowed addresses',true),text('endpoint-address','Endpoint address'),num('endpoint-port','Endpoint port',1,65535),text('persistent-keepalive','Keepalive interval'),comment,disabled]),
 mk('identity','Identity','System','/system/identity',[name],{singleton:true,create:false,delete:false,toggle:undefined}),
 mk('ntp','NTP client','System','/system/ntp/client',[bool('enabled','Enabled'),select('mode','Mode',['unicast','broadcast','multicast'])],{singleton:true,create:false,delete:false,toggle:undefined}),
 mk('ntpservers','NTP servers','System','/system/ntp/client/servers',[text('address','Server address',true),disabled]),
 mk('services','IP services','System','/ip/service',[num('port','Port',1,65535),text('address','Allowed source addresses'),disabled],{create:false,delete:false}),
 mk('backup','Save backup','System','/file',[name,{key:'password',label:'Backup password',type:'password'}],{create:false,update:false,delete:false,toggle:undefined,command:'/system/backup/save',admin:true}),
 mk('export','Export configuration','System','/file',[text('file','Export filename',true)],{create:false,update:false,delete:false,toggle:undefined,command:'/export',admin:true}),
 mk('reboot','Reboot router','System','/system/resource',[],{create:false,update:false,delete:false,toggle:undefined,command:'/system/reboot',admin:true}),
];
const uf=(id:string,label:string,group:string,path:string,fields:Field[],extra:Partial<Resource>={}):Resource=>({id,label,group,path,fields,create:true,update:true,delete:true,...extra});
export const unifiResources:Resource[]=[
 uf('devices','Devices','Devices / clients','stat/device',[text('name','Name',true),select('led_override','Status LED',['default','on','off'],false)],{create:false,delete:false}),
 uf('clients','Clients','Devices / clients','stat/sta',[],{create:false,update:false,delete:false,reason:'Dùng trang Máy khách để chặn, bỏ chặn và kết nối lại.'}),
 uf('ssids','Wi-Fi / SSIDs','Wireless','rest/wlanconf',[name,select('security','Security',['open','wpapsk']),{key:'x_passphrase',label:'WPA passphrase',type:'password'},bool('enabled','Enabled'),bool('hide_ssid','Hidden SSID'),bool('is_guest','Guest network'),text('usergroup_id','User group',false,'usergroups'),array('ap_group_ids','AP group IDs')],{toggle:'enabled'}),
 uf('radio','AP radio configuration','Wireless','stat/device',[num('channel','Channel (0 = auto)',0,233),select('ht','Channel width',['20','40','80','160'],false),select('tx_power_mode','Transmit power mode',['auto','low','medium','high','custom'],false),num('tx_power','Transmit power (dBm)',0,40),bool('min_rssi_enabled','Minimum RSSI enabled'),num('min_rssi','Minimum RSSI (dBm)',-100,-30)],{create:false,delete:false}),
 uf('apgroups','AP groups','Wireless','rest/apgroup',[name,array('device_macs','AP MAC addresses')]),
 uf('networks','Networks / DHCP','Networks','rest/networkconf',[name,select('purpose','Purpose',['corporate','guest','vlan-only','wan']),num('vlan','VLAN ID',1,4094),text('ip_subnet','Gateway / prefix'),bool('dhcpd_enabled','DHCP server enabled'),text('dhcpd_start','DHCP range start'),text('dhcpd_stop','DHCP range end'),num('dhcpd_leasetime','Lease time (seconds)',60)]),
 uf('reservations','DHCP reservations','Networks','rest/user',[text('name','Name'),text('mac','MAC address',true),text('fixed_ip','Reserved IP address',true),text('network_id','Network',true,'networks'),bool('use_fixedip','Use fixed IP')],{create:false}),
 uf('ports','Switch ports / PoE','Switching','stat/device',[text('name','Port name'),text('portconf_id','Port profile',false,'portprofiles'),select('poe_mode','PoE mode',['auto','off','passthrough'],false),select('op_mode','Port operation',['switch','disabled','mirror'],false)],{create:false,delete:false}),
 uf('portprofiles','Port profiles','Switching','rest/portconf',[name,text('native_networkconf_id','Native network',false,'networks'),array('tagged_networkconf_ids','Tagged network IDs'),select('poe_mode','PoE mode',['auto','passthrough','off'],false)]),
 uf('firewall','Firewall rules','Security','rest/firewallrule',[name,bool('enabled','Enabled'),select('ruleset','Ruleset',['LAN_IN','LAN_OUT','LAN_LOCAL','GUEST_IN','GUEST_OUT','GUEST_LOCAL','WAN_IN','WAN_OUT','WAN_LOCAL']),select('action','Action',['accept','drop','reject']),text('protocol','Protocol'),num('rule_index','Rule order',1),text('src_address','Source address'),text('dst_address','Destination address'),text('dst_port','Destination port')],{toggle:'enabled'}),
 uf('portforwards','Port forwarding','Security','rest/portforward',[name,bool('enabled','Enabled'),select('proto','Protocol',['tcp','udp','tcp_udp']),text('dst_port','WAN port',true),text('fwd','Forward IP',true),text('fwd_port','Forward port',true)],{toggle:'enabled'}),
 uf('usergroups','User groups','Security','rest/usergroup',[name,num('qos_rate_max_down','Download limit (Kbit/s)',-1),num('qos_rate_max_up','Upload limit (Kbit/s)',-1)]),
];
export const resourcesFor = (provider:Provider) => provider==='unifi'?unifiResources:mikrotikResources;
export function getResource(provider:Provider,id:string):Resource {
 const resource=resourcesFor(provider).find(r=>r.id===id); if(!resource)throw new Error('Tài nguyên không hợp lệ');return resource;
}
export function validateFields(resource:Resource,input:unknown,creating:boolean):Record<string,unknown> {
 if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Các trường phải là một đối tượng');
 const values=input as Record<string,unknown>; const result:Record<string,unknown>={};
 for(const key of Object.keys(values)) if(!resource.fields.some(f=>f.key===key))throw new Error(`Trường không hỗ trợ: ${key}`);
 for(const field of resource.fields){const value=values[field.key];
  if(value===undefined || value===''){if(creating&&field.required)throw new Error(`${field.label} là bắt buộc`);continue;}
  if(field.type==='string-array'){if(!Array.isArray(value)||value.length>1024||value.some(item=>typeof item!=='string'||!item.trim()||item.length>160))throw new Error(`${field.label} phải là danh sách văn bản`);}
  else if(field.type==='checkbox'){if(typeof value!=='boolean')throw new Error(`${field.label} phải có giá trị bật / tắt`);}
  else if(field.type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||value<(field.min??-Infinity)||value>(field.max??Infinity))throw new Error(`${field.label} nằm ngoài phạm vi cho phép`);}
  else if(typeof value!=='string'||value.length>4096)throw new Error(`${field.label} phải là văn bản`);
  if(field.options&&!field.options.includes(String(value)))throw new Error(`Giá trị ${field.label} không hợp lệ`);
  result[field.key]=value;
 }return result;
}

for(const resource of [...mikrotikResources,...unifiResources]){resource.label=networkLabel(resource.label);resource.group=networkLabel(resource.group);for(const field of resource.fields)field.label=networkLabel(field.label);}
