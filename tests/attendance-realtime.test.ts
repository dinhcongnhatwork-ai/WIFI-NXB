import { describe, expect, it } from 'vitest';
import { evaluateRegistrationState, type CurrentRegistrationState } from '../src/lib/attendance/state-machine';
import { attendanceListQuery, vietnamMonthKey } from '../src/lib/attendance/list-query';
const state: CurrentRegistrationState = {id:'r',primaryMac:'aa:bb:cc:dd:ee:ff',displayName:'Đại biểu',identityValue:'01',status:'PRESENT',currentApMac:'room-ap',lastSeenAt:new Date('2026-10-28T17:00:00Z'),consecutiveMissCount:0,totalPresentSeconds:100,totalAbsentSeconds:0,totalUnknownSeconds:0,warningCount:0};
describe('attendance observations',()=>{
 it('marks the first confirmed missing observation without the old 25-second hold',()=>{
  const result=evaluateRegistrationState(state,null,['room-ap'],'Meeting',new Date('2026-10-28T17:00:03Z'),5,true);
  expect(result.newStatus).toBe('TEMPORARY_ABSENT'); expect(result.isNewlyDisconnected).toBe(true);
  expect(result.shouldOpenInterval?.status).toBe('ABSENT');
 });
 it('records a separate unknown interval during a controller outage',()=>{
  const result=evaluateRegistrationState(state,null,['room-ap'],'Meeting',new Date('2026-10-28T17:00:03Z'),5,false);
  expect(result.newStatus).toBe('UNKNOWN'); expect(result.shouldOpenInterval?.status).toBe('UNKNOWN');
  expect(result.deltaAbsentSeconds).toBe(0); expect(result.newWarningCount).toBe(0);
 });
 it('recovers from unknown to absence when the healthy controller confirms no client',()=>{
  const result=evaluateRegistrationState({...state,status:'UNKNOWN'},null,['room-ap'],'Meeting',new Date('2026-10-28T17:00:30Z'),5,true);
  expect(result.newStatus).toBe('TEMPORARY_ABSENT'); expect(result.shouldCloseInterval).toBeDefined();
 });
 it('does not let a controller outage count toward an absence warning',()=>{
  const result=evaluateRegistrationState({...state,status:'UNKNOWN',absentStartedAt:new Date('2026-10-28T16:00:00Z')},null,['room-ap'],'Meeting',new Date('2026-10-28T17:00:30Z'),5,true);
  expect(result.newStatus).toBe('TEMPORARY_ABSENT'); expect(result.newWarningCount).toBe(0);
  expect(result.absentStartedAt).toEqual(new Date('2026-10-28T17:00:30Z'));
 });
});
describe('monthly meeting queries',()=>{
 it('uses Vietnam month boundaries including year rollover',()=>{
  const query=attendanceListQuery(new URLSearchParams('month=2026-01&status=ENDED&search=Hội&page=2&limit=25'));
  expect(query.where.startTime).toEqual({gte:new Date('2025-12-31T17:00:00Z'),lt:new Date('2026-01-31T17:00:00Z')});
  expect(query.where.status).toBe('ENDED');expect(query.skip).toBe(25);
  expect(vietnamMonthKey('2026-10-31T18:00:00Z')).toBe('2026-11');
 });
 it('rejects invalid filters instead of a database error',()=>{
  for(const q of ['month=2026-13','month=wrong','status=INVALID','page=-1','limit=200'])expect(()=>attendanceListQuery(new URLSearchParams(q))).toThrow();
 });
});

describe('published attendance screen readiness',()=>{
 it('rejects a hidden functional screen even if the controller element is enabled',async()=>{
  const {createDocument,flowNode}=await import('../src/lib/template-document');
  const {isAttendanceTemplateReady}=await import('../src/lib/attendance/runtime');
  const document=createDocument();
  for(const device of ['mobile','tablet','desktop'] as const)flowNode(document.variants[device],'attendance_gate')!.element.enabled=true;
  expect(isAttendanceTemplateReady(document)).toBe(true);
  document.variants.tablet.screens!.attendance_gate!.sections[0].hidden=true;
  expect(isAttendanceTemplateReady(document)).toBe(false);
 });
});
