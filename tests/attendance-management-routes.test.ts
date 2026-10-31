import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({db:{} as any,auth:vi.fn(),view:vi.fn(),disconnect:vi.fn(),tick:vi.fn(),start:vi.fn(),broadcast:vi.fn()}));
vi.mock('../src/lib/prisma',()=>({prisma:new Proxy({},{get:(_,key)=>m.db[key]})}));
vi.mock('../src/lib/auth',()=>({authenticateRequest:m.auth}));
vi.mock('../src/lib/attendance/monitor',()=>({broadcastSessionUpdate:m.broadcast,runAttendanceMonitorTick:m.tick}));
vi.mock('../src/lib/attendance/worker',()=>({startAttendanceWorker:m.start}));
vi.mock('../src/lib/attendance/session-view',()=>({attendanceSessionView:m.view}));
vi.mock('ioredis',()=>({default:class{on(){return this;}subscribe(){return Promise.resolve();}disconnect=m.disconnect;}}));
import {PATCH} from '../src/app/api/attendance/sessions/[id]/registrations/route';
import {GET as stream} from '../src/app/api/attendance/sessions/[id]/stream/route';
const context={params:{id:'meeting'}};
const request=(body:unknown)=>new NextRequest('http://localhost/api/attendance/sessions/meeting/registrations',{method:'PATCH',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
let registration:any;
beforeEach(()=>{
 vi.clearAllMocks();m.auth.mockReturnValue({id:'operator',username:'operator'});
 registration={id:'reg',sessionId:'meeting',displayName:'Nguyễn An',primaryMac:'aa:bb:cc:dd:ee:01',formAnswers:{fullname:'Nguyễn An',department:'Biên tập'},status:'PRESENT'};
 m.db={admin:{findUnique:vi.fn(async()=>({id:'operator',username:'operator',role:'ADMIN',disabled:false}))},attendanceSession:{findUnique:vi.fn(async()=>({id:'meeting',status:'ACTIVE',nameFieldKey:'fullname'}))},attendanceRegistration:{findFirst:vi.fn(async({where}:any)=>where.id?registration:null),update:vi.fn(async({data}:any)=>({...registration,...data}))},attendanceInterval:{findMany:vi.fn(async()=>[{id:'interval',joinedAt:new Date(Date.now()-60000)}]),update:vi.fn(async()=>({})),create:vi.fn(async()=>({}))},attendanceDeviceHistory:{create:vi.fn(async()=>({}))},attendanceLog:{create:vi.fn(async()=>({}))},$executeRaw:vi.fn(async()=>1)};
 m.db.$transaction=async(fn:any)=>fn(m.db);
 m.view.mockResolvedValue({id:'meeting',status:'ACTIVE',registrations:[],stats:{syncHealth:'healthy'}});
});
describe('atomic attendance corrections',()=>{
 it('updates names and the corresponding form answer together',async()=>{
  const response=await PATCH(request({registrationId:'reg',displayName:'Nguyễn Bình',newMac:'aa:bb:cc:dd:ee:01'}),context);
  const data=(await response.json()).data;expect(response.status).toBe(200);expect(data.formAnswers).toEqual({fullname:'Nguyễn Bình',department:'Biên tập'});expect(m.db.$executeRaw).toHaveBeenCalled();
 });
 it('records a device swap with verified operator attribution and awaits the next Controller observation',async()=>{
  const response=await PATCH(request({registrationId:'reg',newMac:'AA-BB-CC-DD-EE-02',reason:'Đổi điện thoại',performedBy:'spoofed'}),context);
  expect(response.status).toBe(200);expect((await response.json()).data.status).toBe('UNKNOWN');
  expect(m.db.attendanceDeviceHistory.create.mock.calls[0][0].data.performedBy).toBe('operator');
  expect(m.db.attendanceInterval.update).toHaveBeenCalled();expect(m.db.attendanceInterval.create.mock.calls[0][0].data.status).toBe('UNKNOWN');
 });
 it('refuses duplicate or invalid MACs without changing history',async()=>{
  expect((await PATCH(request({registrationId:'reg',newMac:'wrong',reason:'Đổi'}),context)).status).toBe(400);
  m.db.attendanceRegistration.findFirst.mockImplementation(async({where}:any)=>where.id?registration:{id:'other'});
  expect((await PATCH(request({registrationId:'reg',newMac:'aa:bb:cc:dd:ee:02',reason:'Đổi'}),context)).status).toBe(409);
  expect(m.db.attendanceDeviceHistory.create).not.toHaveBeenCalled();expect(m.db.attendanceRegistration.update).not.toHaveBeenCalled();
 });
 it('keeps ended session devices sealed while permitting name corrections',async()=>{
  m.db.attendanceSession.findUnique.mockResolvedValue({id:'meeting',status:'ENDED',nameFieldKey:'fullname'});
  expect((await PATCH(request({registrationId:'reg',newMac:'aa:bb:cc:dd:ee:02',reason:'Đổi'}),context)).status).toBe(409);
  expect((await PATCH(request({registrationId:'reg',displayName:'Tên hiệu chỉnh'}),context)).status).toBe(200);
 });
});
describe('read-only authenticated attendance streaming',()=>{
 it('streams to a viewer without starting a worker/tick and releases resources on disconnect',async()=>{
  m.db.admin.findUnique.mockResolvedValue({id:'operator',username:'operator',role:'VIEWER',disabled:false});
  const abort=new AbortController();const response=await stream(new NextRequest('http://localhost/api/attendance/sessions/meeting/stream',{signal:abort.signal}),context);
  expect(response.status).toBe(200);expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  const reader=response.body!.getReader();expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: attendance_update');
  abort.abort();expect((await reader.read()).done).toBe(true);
  expect(m.disconnect).toHaveBeenCalledTimes(1);expect(m.tick).not.toHaveBeenCalled();expect(m.start).not.toHaveBeenCalled();
 });
 it('returns 404 for a missing meeting and rejects unauthenticated streams',async()=>{
  m.view.mockResolvedValue(null);expect((await stream(new NextRequest('http://localhost/api/attendance/sessions/missing/stream'),context)).status).toBe(404);
  m.auth.mockReturnValue(null);expect((await stream(new NextRequest('http://localhost/api/attendance/sessions/meeting/stream'),context)).status).toBe(401);
 });
});
