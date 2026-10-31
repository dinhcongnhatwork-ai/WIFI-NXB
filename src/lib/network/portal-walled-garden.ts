import {isIP} from 'node:net';
export interface PortalAddressEntry {field:string;value:string}
function validAddress(ip:string){return isIP(ip)===4&&!/^(0|127|169\.254|22[4-9]|23\d|24\d|25[0-5])\./.test(ip);}
export function ownedPortalAddresses(input:unknown):PortalAddressEntry[]{
 if(!Array.isArray(input)||input.length>128||input.some(e=>!e||typeof e.field!=='string'||!/^allowed_subnet_([1-9]|[1-5]\d|6[0-4])$/.test(e.field)||typeof e.value!=='string'||!e.value.endsWith('/32')||!validAddress(e.value.slice(0,-3))))throw Error('Invalid portal address ownership');
 const entries=input as PortalAddressEntry[];if(new Set(entries.map(e=>e.field+'='+e.value)).size!==entries.length)throw Error('Duplicate portal ownership');return entries;
}
/** Retire only addresses still equal to the service-owned value; preserve manual edits. */
export function portalAddressPlan(settings:Record<string,unknown>,addresses:string[],input:PortalAddressEntry[]=[]):{patch:Record<string,string>;entries:PortalAddressEntry[]}{
 const ips=Array.from(new Set(addresses)).sort();if(!ips.length||ips.length>8||ips.some(ip=>!validAddress(ip)))throw Error('Invalid portal DNS addresses');
 const owned=ownedPortalAddresses(input).filter(e=>settings[e.field]===e.value),patch:Record<string,string>={},entries:PortalAddressEntry[]=[];
 for(const entry of owned){if(ips.includes(entry.value.slice(0,-3)))entries.push(entry);else patch[entry.field]='';}
 const existing=Object.entries(settings).filter(([k])=>/^allowed_subnet_\d+$/.test(k));
 for(const ip of ips){
  if(existing.some(([k,v])=>patch[k]!==''&&(v===ip||v===ip+'/32')))continue;
  let slot=1;while((Object.hasOwn(patch,`allowed_subnet_${slot}`)?patch[`allowed_subnet_${slot}`]:settings[`allowed_subnet_${slot}`]))slot++;
  if(slot>64)throw Error('Portal preauthorization list is full');const field=`allowed_subnet_${slot}`,value=ip+'/32';patch[field]=value;entries.push({field,value});
 }
 return {patch,entries:entries.sort((a,b)=>a.field.localeCompare(b.field))};
}
/** Explicit A records cover clients using cached DNS instead of the AP DNS proxy. */
export function portalAddressPatch(settings:Record<string,unknown>,addresses:string[]):Record<string,string>{return portalAddressPlan(settings,addresses).patch;}
