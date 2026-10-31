import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { UnifiClient } from '@/lib/unifi';
import { getUnifiConfig } from '@/lib/settings';
import { evaluateRegistrationState, type CurrentRegistrationState } from './state-machine';
import { lockAttendanceSession } from './locking';
import { normalizedMac, observedClients, onlineAccessPoint, attendanceDurations } from './observations';
import { writeAttendanceSync, bestEffortSync } from './sync-health';

export async function broadcastSessionUpdate(sessionId:string,payload:unknown) {
  try { await bestEffortSync(redis.publish(`attendance:${sessionId}`,JSON.stringify(payload))); } catch {}
}
interface TickResult {activeSessionsCount:number;processedRegistrations:number;unregisteredClientsCount:number;timestamp:string}
let pending:Promise<TickResult>|null=null;
/** One source snapshot per site per cycle; viewers never create additional monitor loops. */
export function runAttendanceMonitorTick():Promise<TickResult> {
  if(pending)return pending;
  const operation=monitorCycle(); pending=operation;
  void operation.finally(()=>{if(pending===operation)pending=null;}).catch(()=>{});
  return operation;
}
async function monitorCycle():Promise<TickResult> {
  const sessions=await prisma.attendanceSession.findMany({where:{status:'ACTIVE'}});
  const result:TickResult={activeSessionsCount:sessions.length,processedRegistrations:0,unregisteredClientsCount:0,timestamp:new Date().toISOString()};
  if(!sessions.length)return result;
  const sites=Array.from(new Set(sessions.map(s=>s.unifiSite || 'default')));
  const observations=new Map<string,{clients:any[];devices:any[];healthy:boolean;sampledAt:Date}>();
  await Promise.all(sites.map(async site=>{
    try {
      const config=await getUnifiConfig(); const client=new UnifiClient({...config,site});
      await client.login();
      const [clients,devices]=await Promise.all([client.getClients(true),client.getDevices()]);
      observations.set(site,{clients,devices,healthy:true,sampledAt:new Date()});
    }catch(error){
      console.warn('[attendance-monitor] Cannot observe site',site,error instanceof Error?error.message:'Controller unavailable');
      observations.set(site,{clients:[],devices:[],healthy:false,sampledAt:new Date()});
    }
  }));
  for(const candidate of sessions) {
    const source=observations.get(candidate.unifiSite || 'default')!;
    const now=source.sampledAt;
    const devices=source.devices, online=new Set(devices.filter(onlineAccessPoint).map(d=>normalizedMac(d.mac)));
    const targets=(Array.isArray(candidate.targetApMacs)?candidate.targetApMacs as string[]:[]).map(normalizedMac);
    const clients=observedClients(source.clients,devices), byMac=new Map(clients.map(c=>[c.mac,c]));
    const targetAps=(targets.length?targets:devices.filter(d=>d.type==='uap' || d.type==='ap').map(d=>normalizedMac(d.mac))).map(mac=>{
      const d=devices.find(d=>normalizedMac(d.mac)===mac);
      return {mac,name:d?.name || d?.model || mac,model:d?.model,status:online.has(mac)?'online':'offline'};
    });
    const healthy=source.healthy && online.size>0 && (!targets.length || targets.every(mac=>online.has(mac)));
    try { await prisma.$transaction(async tx=>{
      await lockAttendanceSession(tx,candidate.id);
      const session=await tx.attendanceSession.findUnique({where:{id:candidate.id},include:{registrations:{include:{intervals:{orderBy:{joinedAt:'asc'}}}}}});
      if(!session || session.status!=='ACTIVE')return;
      const ended=now>=session.endTime;
      const cutoff=ended?session.endTime:now;
      for(const reg of session.registrations) {
        // Never overwrite a registration/device swap submitted after this source snapshot.
        if(reg.updatedAt>now)continue;
        const observed=byMac.get(normalizedMac(reg.primaryMac));
        const knownAp=normalizedMac(observed?.apMac || reg.currentApMac);
        const apHealthy=(!observed || (!!observed.apMac && !!observed.ssid)) && source.healthy && online.size>0 && (targets.length===0 || (knownAp && targets.includes(knownAp)?online.has(knownAp):healthy));
        const transition=evaluateRegistrationState(reg as CurrentRegistrationState,observed,targets,session.ssid,cutoff,session.warningThresholdMinutes,apHealthy);
        const intervals=[...reg.intervals];
        const open=intervals.find(i=>!i.leftAt);
        if((ended || transition.shouldCloseInterval) && open) {
          const leftAt=ended?cutoff:transition.shouldCloseInterval!.leftAt;
          const closed=await tx.attendanceInterval.update({where:{id:open.id},data:{leftAt:new Date(Math.max(open.joinedAt.getTime(),leftAt.getTime())),durationSeconds:Math.max(0,Math.floor((leftAt.getTime()-open.joinedAt.getTime())/1000))}});
          intervals[intervals.indexOf(open)]=closed;
        }
        const nextInterval=transition.shouldOpenInterval || (!open?{status:transition.newStatus==='PRESENT'?'PRESENT':transition.newStatus==='UNKNOWN'?'UNKNOWN':'ABSENT',joinedAt:cutoff,apMac:transition.currentApMac}:null);
        if(!ended && nextInterval && (!open || transition.shouldCloseInterval)) {
          intervals.push(await tx.attendanceInterval.create({data:{registrationId:reg.id,...nextInterval}}));
        }
        const firstSeenAt=reg.firstSeenAt || (transition.newStatus==='PRESENT'?cutoff:null);
        await tx.attendanceRegistration.update({where:{id:reg.id},data:{
          ...(ended?{}:{status:transition.newStatus,currentApMac:transition.currentApMac,lastSeenAt:transition.lastSeenAt,absentStartedAt:transition.absentStartedAt,consecutiveMissCount:transition.consecutiveMissCount,warningCount:transition.newWarningCount,currentRssi:observed?.rssi ?? reg.currentRssi,primaryIp:observed?.ip || reg.primaryIp}),
          firstSeenAt,...attendanceDurations(intervals,firstSeenAt,cutoff),
        }});
        if(!ended)for(const event of transition.logEvents)await tx.attendanceLog.create({data:{sessionId:session.id,registrationId:reg.id,type:event.type,message:event.message,details:event.details as any || {},createdAt:cutoff}});
        result.processedRegistrations++;
      }
      if(ended){
        await tx.attendanceSession.update({where:{id:session.id},data:{status:'ENDED',endedAt:cutoff}});
        await tx.attendanceLog.create({data:{sessionId:session.id,type:'SESSION_END',message:'Đã kết thúc buổi họp theo thời gian đã thiết lập.',createdAt:cutoff}});
      }else if(source.healthy){
        const registered=new Set(session.registrations.map(r=>normalizedMac(r.primaryMac)));
        for(const client of clients.filter(c=>!registered.has(c.mac) && (!targets.length || targets.includes(c.apMac || '')) && c.ssid===session.ssid && online.has(c.apMac || ''))){
          await tx.attendanceUnregisteredClient.upsert({where:{sessionId_mac:{sessionId:session.id,mac:client.mac}},update:{ip:client.ip,apMac:client.apMac,signal:client.rssi,lastSeenAt:now},create:{sessionId:session.id,mac:client.mac,ip:client.ip,apMac:client.apMac,signal:client.rssi,firstSeenAt:now,lastSeenAt:now}});
          result.unregisteredClientsCount++;
        }
        await tx.attendanceUnregisteredClient.deleteMany({where:{sessionId:session.id,lastSeenAt:{lt:new Date(now.getTime()-15000)}}});
      }
    },{isolationLevel:'ReadCommitted',timeout:30000}); } catch(error) {
      console.warn('[attendance-monitor] Cannot persist meeting snapshot',candidate.id,error instanceof Error?error.message:'Database unavailable');
      await writeAttendanceSync(candidate.id,{sampledAt:now.toISOString(),healthy:false,targetAps,message:'Không lưu được chu kỳ đồng bộ. Dữ liệu trước đó được giữ lại.'});
      await broadcastSessionUpdate(candidate.id,{type:'SYNC_ERROR'});
      continue;
    }
    await writeAttendanceSync(candidate.id,{sampledAt:now.toISOString(),healthy,targetAps,message:healthy?'Đã nhận dữ liệu từ UniFi Controller.':source.healthy?'Một hoặc nhiều AP chưa xác nhận trực tuyến.':'Không kết nối được UniFi Controller; không tính thời gian này là vắng.'});
    await broadcastSessionUpdate(candidate.id,{type:'TICK_UPDATE',sessionId:candidate.id,timestamp:now.toISOString()});
  }
  return result;
}
