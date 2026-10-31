import { redis } from '@/lib/redis';
export interface AttendanceSyncSnapshot {
  sampledAt: string; healthy: boolean; message?: string;
  targetAps?: Array<{mac:string;name:string;status:string;model?:string}>;
}
const cache = new Map<string, AttendanceSyncSnapshot>();
export async function bestEffortSync<T>(request:Promise<T>):Promise<T|null>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([request,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),200);})]);}finally{if(timer)clearTimeout(timer);}
}
export async function writeAttendanceSync(id:string, snapshot:AttendanceSyncSnapshot) {
  cache.set(id,snapshot);
  try { await bestEffortSync(redis.set(`attendance:sync:${id}`,JSON.stringify(snapshot),'EX',86400)); } catch { /* local fallback remains useful in a single process */ }
}
export async function readAttendanceSync(id:string, active=true) {
  let snapshot = cache.get(id);
  try { const saved=await bestEffortSync(redis.get(`attendance:sync:${id}`)); if(saved){const parsed=JSON.parse(saved);if(typeof parsed.healthy==='boolean' && Number.isFinite(Date.parse(parsed.sampledAt)))snapshot=parsed;} } catch {}
  const age = snapshot ? Math.max(0,Math.floor((Date.now()-Date.parse(snapshot.sampledAt))/1000)) : undefined;
  return {
    lastSyncTime:snapshot?.sampledAt || null,
    syncHealth:(!active ? 'healthy' : !snapshot || age===undefined || age>15 ? 'warning' : snapshot.healthy ? 'healthy' : 'error') as 'healthy'|'warning'|'error',
    syncLagSeconds:age,
    syncMessage:!active?'Buổi họp không chạy giám sát.':!snapshot?'Chờ chu kỳ đồng bộ Controller đầu tiên.':age!==undefined&&age>15?'Dữ liệu Controller đã cũ.':snapshot.message || (snapshot.healthy?'Đã nhận dữ liệu từ UniFi Controller.':'Không xác định do Controller hoặc AP gián đoạn.'),
    targetAps:snapshot?.targetAps || [],
  };
}
