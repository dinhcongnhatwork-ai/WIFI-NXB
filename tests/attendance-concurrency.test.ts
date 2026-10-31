import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const dependencies = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_target, key) => dependencies.db[key] }) }));
vi.mock('@/lib/auth', () => ({ authenticateRequest: () => ({ id: 'admin', username: 'admin' }) }));
vi.mock('@/lib/attendance/monitor', () => ({ broadcastSessionUpdate: vi.fn() }));
vi.mock('@/lib/unifi', () => ({ UnifiClient: class {} }));
vi.mock('@/lib/settings', () => ({ getUnifiClientFromRequest: vi.fn(async () => { throw new Error('Controller unavailable in isolated route test'); }) }));
import { POST as submit } from '@/app/api/attendance/portal/submit/route';
import { PATCH as patch } from '@/app/api/attendance/sessions/[id]/route';
import { POST as create } from '@/app/api/attendance/sessions/route';
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
const request = (body: unknown) => new NextRequest('http://localhost/api/attendance', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const fixture = (id = 'meeting', status = 'ACTIVE') => ({ id, status, name: id, ssid: 'Office', unifiSite: 'default', templateId: 'template', campaignId: null, location: null, targetApMacs: [], formSchema: [{ id: 'fullname', label: 'Full name', type: 'text', required: true }], nameFieldKey: 'fullname', idFieldKey: 'fullname', dialogTitle: 'Attendance', confirmButtonText: 'Confirm', successMessage: 'Success', warningThresholdMinutes: 15, startTime: new Date(Date.now() - 3600000), endTime: new Date(Date.now() + 3600000), createdAt: new Date(), updatedAt: new Date() });
/** A behavioral DB double: transaction-scoped SQL locks actually queue competing writers.
 * Dates and interval/registration rows are stored, so assertions observe persisted outcomes.
 */
function memoryDatabase(initial: any[]) {
  const sessions = initial.map(value => structuredClone(value));
  const registrations: any[] = [];
  const intervals: any[] = [];
  const queues = new Map<string, Promise<void>>();
  const hooks: { beforeEnd?: () => Promise<void>; beforeRegister?: () => Promise<void> } = {};
  const client = (releases?: Array<() => void>) => ({
    admin: {findUnique: async () => ({id:'admin',username:'admin',role:'ADMIN',disabled:false})},
    $executeRaw: async (query: any) => {
      if (!releases) throw new Error('Locks must be acquired in a transaction');
      const sql = query.strings.join('');
      const key = sql.includes('pg_advisory_xact_lock') ? `network:${query.values[0]}` : `row:${query.values[0]}`;
      const previous = queues.get(key) || Promise.resolve();
      const acquired = deferred();
      queues.set(key, acquired.promise);
      await previous;
      releases.push(acquired.release);
      return 1;
    },
    attendanceSession: {
      findMany: async ({ where }: any) => structuredClone(sessions.filter(value =>
        (!where.ssid || where.ssid === value.ssid) && (!where.unifiSite || where.unifiSite === value.unifiSite)
        && (!where.id || (typeof where.id === 'string' ? value.id === where.id : value.id !== where.id.not))
        && (!where.status || (typeof where.status === 'string' ? value.status === where.status : where.status.in.includes(value.status)))
        && (!where.startTime?.lte || value.startTime <= where.startTime.lte) && (!where.startTime?.lt || value.startTime < where.startTime.lt)
        && (!where.endTime?.gte || value.endTime >= where.endTime.gte) && (!where.endTime?.gt || value.endTime > where.endTime.gt))),
      findUnique: async ({ where, include }: any) => {
        const value = sessions.find(item => item.id === where.id);
        if (!value) return null;
        return structuredClone({ ...value, ...(include?.registrations ? { registrations: registrations.filter(registration => registration.sessionId === value.id).map(registration => ({ ...registration, intervals: intervals.filter(interval => interval.registrationId === registration.id && !interval.leftAt) })) } : {}) });
      },
      create: async ({ data }: any) => { const value = { ...fixture(`new-${sessions.length}`), ...data }; sessions.push(value); return structuredClone(value); },
      update: async ({ where, data }: any) => { if (data.status === 'ENDED') await hooks.beforeEnd?.(); const value = sessions.find(item => item.id === where.id); Object.assign(value, data); return structuredClone(value); },
    },
    attendanceRegistration: {
      findFirst: async ({ where }: any) => registrations.find(value => value.sessionId === where.sessionId && value.primaryMac === where.primaryMac) || null,
      findUnique: async ({ where }: any) => registrations.find(value => value.sessionId === where.sessionId_identityValue.sessionId && value.identityValue === where.sessionId_identityValue.identityValue) || null,
      create: async ({ data }: any) => { await hooks.beforeRegister?.(); const value = { id: `reg-${registrations.length}`, ...data }; registrations.push(value); return structuredClone(value); },
      update: async ({ where, data }: any) => { const value = registrations.find(item => item.id === where.id); Object.assign(value, data); return structuredClone(value); },
    },
    attendanceInterval: {
      create: async ({ data }: any) => { const value = { id: `interval-${intervals.length}`, leftAt: null, ...data }; intervals.push(value); return structuredClone(value); },
      update: async ({ where, data }: any) => { const value = intervals.find(item => item.id === where.id); Object.assign(value, data); return structuredClone(value); },
    },
    template: { findUnique: async () => ({ id: 'template', publishedRevision: { layoutJson: { elements: [{ type: 'attendance_gate', enabled: true }] } } }) },
    campaign: { findUnique: async () => null },
    attendanceUnregisteredClient: { deleteMany: async () => ({ count: 0 }) },
    attendanceLog: { create: async ({ data }: any) => data },
    wifiUser: { upsert: async () => ({}) },
  });
  const db: any = client();
  db.$transaction = async (fn: (tx: any) => Promise<unknown>) => { const releases: Array<() => void> = []; try { return await fn(client(releases)); } finally { releases.reverse().forEach(release => release()); } };
  return { db, sessions, registrations, intervals, hooks };
}
beforeEach(() => { dependencies.db = {}; });
describe('attendance concurrent session transitions', () => {
  it('does not register a visitor after END wins the session row lock', async () => {
    const state = memoryDatabase([fixture()]); dependencies.db = state.db;
    const endReached = deferred(); const endMayFinish = deferred();
    state.hooks.beforeEnd = async () => { endReached.release(); await endMayFinish.promise; };
    const ending = patch(request({ status: 'ENDED' }), { params: { id: 'meeting' } });
    await endReached.promise;
    const submitting = submit(request({ sessionId: 'meeting', ssid: 'Office', mac: 'aa', answers: { fullname: 'Visitor' } }));
    await new Promise(resolve => setTimeout(resolve, 5));
    endMayFinish.release();
    const [ended, submitted] = await Promise.all([ending, submitting]);
    expect(ended.status).toBe(200);
    expect(submitted.status).toBe(404);
    expect(state.sessions[0].status).toBe('ENDED');
    expect(state.registrations).toHaveLength(0);
    expect(state.intervals).toHaveLength(0);
  });
  it('closes the interval when registration wins the session row lock before END', async () => {
    const state = memoryDatabase([fixture()]); dependencies.db = state.db;
    const registrationReached = deferred(); const registrationMayFinish = deferred();
    state.hooks.beforeRegister = async () => { registrationReached.release(); await registrationMayFinish.promise; };
    const submitting = submit(request({ sessionId: 'meeting', ssid: 'Office', mac: 'aa', answers: { fullname: 'Visitor' } }));
    await registrationReached.promise;
    const ending = patch(request({ status: 'ENDED' }), { params: { id: 'meeting' } });
    await new Promise(resolve => setTimeout(resolve, 5));
    registrationMayFinish.release();
    const [submitted, ended] = await Promise.all([submitting, ending]);
    expect(submitted.status).toBe(200); expect(ended.status).toBe(200);
    expect(state.registrations).toHaveLength(1); expect(state.intervals).toHaveLength(1);
    expect(state.sessions[0].status).toBe('ENDED');
    expect(state.intervals[0].leftAt).toBeInstanceOf(Date);
    expect(state.intervals[0].leftAt).toEqual(state.sessions[0].endedAt);
  });
  it('accepts at most one concurrent overlapping READY creation', async () => {
    const state = memoryDatabase([]); dependencies.db = state.db;
    const { id, createdAt, updatedAt, ...data } = fixture('new', 'READY');
    const results = await Promise.all([create(request(data)), create(request({ ...data, name: 'Other meeting' }))]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    expect(state.sessions).toHaveLength(1);
  });
  it('accepts at most one concurrent DRAFT-to-READY update on overlapping scope', async () => {
    const state = memoryDatabase([fixture('one', 'DRAFT'), fixture('two', 'DRAFT')]); dependencies.db = state.db;
    const results = await Promise.all(['one', 'two'].map(id => patch(request({ status: 'READY' }), { params: { id } })));
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    expect(state.sessions.filter(value => value.status === 'READY')).toHaveLength(1);
  });
});
