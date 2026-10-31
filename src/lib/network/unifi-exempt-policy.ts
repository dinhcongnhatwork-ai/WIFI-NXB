import {CampaignHotspotError} from './campaign-hotspot-policy';
export const EXEMPT_PREFIX='unifi:portal-exempt:';
export interface DeviceInput {ownerName:string;deviceName:string;mac:string;enabled:boolean}
export interface DeviceExemption extends DeviceInput {version:1;connectionId:string;site:string;approvedAt:number|null;approvedBy:string|null;createdAt:number;updatedAt:number}
export function canonicalDeviceMac(input:unknown):string {
 const text=typeof input==='string'?input.trim():'';
 if(!/^(?:[a-f\d]{12}|(?:[a-f\d]{2}:){5}[a-f\d]{2}|(?:[a-f\d]{2}-){5}[a-f\d]{2}|(?:[a-f\d]{4}\.){2}[a-f\d]{4})$/i.test(text))throw new CampaignHotspotError('Địa chỉ MAC không hợp lệ.',400);
 const hex=text.replace(/[:.\-]/g,'').toLowerCase();
 if(hex==='000000000000'||(parseInt(hex.slice(0,2),16)&1))throw new CampaignHotspotError('MAC phải là địa chỉ của một thiết bị WiFi.',400);
 return hex.match(/.{2}/g)!.join(':');
}
export function deviceInput(input:unknown):DeviceInput {
 const value=input as DeviceInput;
 const name=(s:unknown)=>{if(typeof s!=='string'||!s.trim()||s.trim().length>120||/[\x00-\x1f]/.test(s))throw new CampaignHotspotError('Tên người dùng và thiết bị phải từ 1 đến 120 ký tự.',400);return s.trim();};
 if(!value||typeof value.enabled!=='boolean')throw new CampaignHotspotError('Trạng thái miễn xác thực không hợp lệ.',400);
 return {ownerName:name(value.ownerName),deviceName:name(value.deviceName),mac:canonicalDeviceMac(value.mac),enabled:value.enabled};
}
export function exemptionKey(scope:{connectionId:string;site:string;mac:string}):string {
 if(![scope.connectionId,scope.site].every(s=>typeof s==='string'&&/^[a-zA-Z\d_-]{1,100}$/.test(s)))throw new CampaignHotspotError('Controller/site không hợp lệ.',400);
 return `${EXEMPT_PREFIX}${scope.connectionId}:${scope.site}:${canonicalDeviceMac(scope.mac)}`;
}
export function parseExemption(key:string,input:unknown):DeviceExemption {
 const v=input as DeviceExemption;deviceInput(v);
 if(v.version!==1||canonicalDeviceMac(v.mac)!==v.mac||exemptionKey(v)!==key||!Number.isFinite(v.createdAt)||!Number.isFinite(v.updatedAt)||
  (v.enabled&&(!Number.isFinite(v.approvedAt)||v.approvedAt===null||typeof v.approvedBy!=='string'||!v.approvedBy)))throw new CampaignHotspotError('Dữ liệu miễn xác thực không hợp lệ.',503);
 return v;
}
export function validateDeviceBatch(input:unknown):DeviceInput[] {
 if(!Array.isArray(input)||!input.length||input.length>100)throw new CampaignHotspotError('Mỗi lần nhập từ 1 đến 100 thiết bị.',400);
 const devices=input.map(deviceInput);if(new Set(devices.map(d=>d.mac)).size!==devices.length)throw new CampaignHotspotError('Danh sách có địa chỉ MAC trùng nhau.',400);return devices;
}
/** Three columns: person, device and MAC. Quotes may contain separators. */
export function parseDeviceList(text:string):DeviceInput[] {
 const lines=text.trim().split(/\r?\n/).filter(line=>line.trim());
 const rows=lines.map((line,index)=>{
  const separator=line.includes('\t')?'\t':line.includes(';')?';':',';const cells:string[]=[];let cell='',quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){cells.push(cell.trim());cell='';}else cell+=c;}
  cells.push(cell.trim());if(quoted||cells.length!==3)throw new CampaignHotspotError(`Dòng ${index+1} cần đúng 3 cột: Tên; Thiết bị; MAC.`,400);return cells;
 });
 if(rows.length&&/^mac(?:\s|$)/i.test(rows[0][2]))rows.shift();
 return validateDeviceBatch(rows.map(([ownerName,deviceName,mac])=>({ownerName,deviceName,mac,enabled:true})));
}
