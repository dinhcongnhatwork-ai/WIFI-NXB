import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({clients:vi.fn(),devices:vi.fn(),login:vi.fn(),db:{} as any,redis:{get:vi.fn(),set:vi.fn(),publish:vi.fn()}}));
vi.mock('../src/lib/prisma',()=>({prisma:new Proxy({},{get:(_,key)=>m.db[key]})}));
vi.mock('../src/lib/redis',()=>({redis:m.redis}));
vi.mock('../src/lib/settings',()=>({getUnifiConfig:async()=>({controllerUrl:'https://controller.test',username:'test',password:'test',site:'default'})}));
vi.mock('../src/lib/unifi',()=>({UnifiClient:class{login=m.login;getClients=m.clients;getDevices=m.devices;}}));
import {runAttendanceMonitorTick} from '../src/lib/attendance/monitor';
import {attendanceDurations,observedClients} from '../src/lib/attendance/observations';
const now=new Date('2026-10-28T17:30:00Z');
let session:any;
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(now);
 const reg={id:'r',primaryMac:'aa:bb:cc:dd:ee:ff',displayName:'Đại biểu',identityValue:'01',status:'PRESENT',currentApMac:'ap-room',lastSeenAt:new Date(now.getTime()-3000),firstSeenAt:new Date(now.getTime()-60000),updatedAt:new Date(now.getTime()-3000),absentStartedAt:null,consecutiveMissCount:0,totalPresentSeconds:57,totalAbsentSeconds:0,totalUnknownSeconds:0,warningCount:0,currentRssi:-55,intervals:[{id:'i',status:'PRESENT',joinedAt:new Date(now.getTime()-60000),leftAt:null,durationSeconds:null}]};
 session={id:'meeting',status:'ACTIVE',ssid:'Meeting',unifiSite:'default',targetApMacs:['ap-room'],warningThresholdMinutes:5,startTime:new Date(now.getTime()-120000),endTime:new Date(now.getTime()+60000),registrations:[reg]};
 m.db={
  attendanceSession:{findMany:vi.fn(async()=>[session]),findUnique:vi.fn(async()=>session),update:vi.fn(async({data}:any)=>Object.assign(session,data))},
  attendanceInterval:{update:vi.fn(async({where,data}:any)=>Object.assign(reg.intervals.find((i:any)=>i.id===where.id)!,data)),create:vi.fn(async({data}:any)=>{const interval={id:'i'+reg.intervals.length,leftAt:null,...data};reg.intervals.push(interval);return interval;})},
  attendanceRegistration:{update:vi.fn(async({data}:any)=>Object.assign(reg,data))},
  attendanceLog:{create:vi.fn(async({data}:any)=>data)},attendanceUnregisteredClient:{upsert:vi.fn(),deleteMany:vi.fn()},$executeRaw:vi.fn(async()=>1),
 };
 m.db.$transaction=async(fn:any)=>fn(m.db);
 m.clients.mockResolvedValue([]);m.devices.mockResolvedValue([{mac:'ap-room',type:'uap',state:1,name:'Hội trường'}]);m.login.mockResolvedValue(true);
});
afterEach(()=>vi.useRealTimers());
describe('controller-driven attendance monitor',()=>{
 it('persists immediate departure and closes the presence interval at observation time',async()=>{
  await runAttendanceMonitorTick();
  expect(session.registrations[0].status).toBe('TEMPORARY_ABSENT');
  expect(session.registrations[0].totalPresentSeconds).toBe(60);
  expect(session.registrations[0].intervals[0].leftAt).toEqual(now);
  expect(m.redis.publish).toHaveBeenCalled();
 });
 it('records unknown time during a Controller outage without counting absence',async()=>{
  m.clients.mockRejectedValueOnce(new Error('offline'));await runAttendanceMonitorTick();
  expect(session.registrations[0].status).toBe('UNKNOWN');
  vi.setSystemTime(new Date(now.getTime()+10000));m.clients.mockRejectedValueOnce(new Error('offline'));await runAttendanceMonitorTick();
  expect(session.registrations[0].totalUnknownSeconds).toBe(10);expect(session.registrations[0].totalAbsentSeconds).toBe(0);
 });
 it('treats an empty AP snapshot as unknown, not an empty room',async()=>{
  m.devices.mockResolvedValue([]);await runAttendanceMonitorTick();expect(session.registrations[0].status).toBe('UNKNOWN');
 });
 it('shares a single in-flight Controller request for simultaneous viewers/manual ticks',async()=>{
  await Promise.all([runAttendanceMonitorTick(),runAttendanceMonitorTick(),runAttendanceMonitorTick()]);expect(m.clients).toHaveBeenCalledTimes(1);expect(m.db.attendanceRegistration.update).toHaveBeenCalledTimes(1);
 });
 it('rechecks session state under the lock so an END cannot be overwritten by a scan',async()=>{
  m.db.attendanceSession.findUnique.mockResolvedValue({...session,status:'ENDED'});await runAttendanceMonitorTick();expect(m.db.attendanceRegistration.update).not.toHaveBeenCalled();
 });
 it('ends a meeting at the configured deadline rather than accumulating time afterward',async()=>{
  session.endTime=new Date(now.getTime()-5000);await runAttendanceMonitorTick();expect(session.status).toBe('ENDED');expect(session.endedAt).toEqual(new Date(now.getTime()-5000));expect(session.registrations[0].totalPresentSeconds).toBe(55);
 });
});
describe('observation accounting',()=>{
 it('maps official uplink device IDs and excludes explicitly disconnected or wired clients',()=>{
  const result=observedClients([{macAddress:'AA-BB-CC-DD-EE-FF',uplinkDeviceId:'device',ssid:'Meeting'},{mac:'off',connected:false},{mac:'wire',isWired:true}],[{id:'device',mac:'AP-ROOM'}]);
  expect(result).toHaveLength(1);expect(result[0].apMac).toBe('ap:room');
 });
 it('keeps UNKNOWN intervals out of absent seconds',()=>{
  const start=new Date(now.getTime()-20000);
  expect(attendanceDurations([{status:'PRESENT',joinedAt:start,leftAt:new Date(now.getTime()-10000)},{status:'UNKNOWN',joinedAt:new Date(now.getTime()-10000)}],start,now)).toEqual({totalPresentSeconds:10,totalUnknownSeconds:10,totalAbsentSeconds:0});
 });
});
