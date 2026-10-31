import type { ObservedClient } from './state-machine';
export const normalizedMac = (value:unknown) => typeof value==='string'?value.trim().toLowerCase().replace(/-/g,':'):'';
export function onlineAccessPoint(device:any) {
  return device.state===1 || device.isConnected===true || ['online','connected','ONLINE','CONNECTED'].includes(device.status);
}
export function observedClients(clients:any[],devices:any[]): ObservedClient[] {
  return clients.filter(c=>c.isWired!==true && c.is_wired!==true && c.connected!==false && !['offline','disconnected','OFFLINE','DISCONNECTED'].includes(c.status)).map(c=>({
    mac:normalizedMac(c.mac || c.macAddress),ip:c.ip || c.ipAddress,
    apMac:normalizedMac(c.apMac || c.ap_mac || devices.find(d=>(d._id || d.id)===c.uplinkDeviceId)?.mac),
    apName:c.apName || c.ap_name,ssid:c.ssid || c.essid, rssi:c.signal ?? c.rssi,
  })).filter(c=>c.mac);
}
export function attendanceDurations(intervals:Array<{status:string;joinedAt:Date|string;leftAt?:Date|string|null;durationSeconds?:number|null}>, firstSeenAt:Date|string|null, now:Date) {
  const seconds=(status:string)=>intervals.filter(i=>i.status===status).reduce((sum,i)=>sum+Math.max(0,Math.floor((Math.min(now.getTime(),i.leftAt?new Date(i.leftAt).getTime():now.getTime())-new Date(i.joinedAt).getTime())/1000)),0);
  const present=seconds('PRESENT'), unknown=seconds('UNKNOWN');
  const elapsed=firstSeenAt?Math.max(0,Math.floor((now.getTime()-new Date(firstSeenAt).getTime())/1000)):0;
  return {totalPresentSeconds:present,totalUnknownSeconds:unknown,totalAbsentSeconds:Math.max(0,elapsed-present-unknown)};
}
