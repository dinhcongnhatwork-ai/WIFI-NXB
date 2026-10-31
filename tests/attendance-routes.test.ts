import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), watched: vi.fn(), setWatched: vi.fn(),
  db: {
    admin: { findUnique: vi.fn() },
    attendanceSession: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    attendanceRegistration: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    template: { findUnique: vi.fn(), delete: vi.fn() },
    campaign: { findFirst: vi.fn(), findUnique: vi.fn() },
    attendanceLog: { create: vi.fn() }, attendanceInterval: { create: vi.fn(), update: vi.fn() }, attendanceUnregisteredClient: { deleteMany: vi.fn() },
    wifiUser: { upsert: vi.fn() }, log: { create: vi.fn() }, $transaction: vi.fn(), $executeRaw: vi.fn(),
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/auth', () => ({ authenticateRequest: mocks.auth }));
vi.mock('@/lib/redis', () => ({ isVideoWatched: mocks.watched, setVideoWatched: mocks.setWatched }));
vi.mock('@/lib/template-publishing', () => ({ normalizeStoredMedia: (v: unknown) => v }));
vi.mock('@/lib/attendance/monitor', () => ({ broadcastSessionUpdate: vi.fn() }));
vi.mock('@/lib/unifi', () => ({ UnifiClient: class {} }));
vi.mock('@/lib/settings', () => ({ getUnifiClientFromRequest: vi.fn(async () => { throw new Error('Controller unavailable in isolated route test'); }) }));
import { GET as portal } from '@/app/api/portal/route';
import { POST as submit } from '@/app/api/attendance/portal/submit/route';
import { POST as create, GET as list } from '@/app/api/attendance/sessions/route';
import { PATCH as update, DELETE as remove } from '@/app/api/attendance/sessions/[id]/route';
import { POST as complete } from '@/app/api/video-complete/route';
import { GET as connect } from '@/app/api/connect/route';
import { GET as registrations, PATCH as changeRegistration } from '@/app/api/attendance/sessions/[id]/registrations/route';
import { POST as login } from '@/app/api/login/route';
import { DELETE as deleteTemplate } from '@/app/api/templates/[id]/route';
const now = new Date();
const session = { id: 'meeting', name: 'Meeting', ssid: 'Office', unifiSite: 'default', status: 'ACTIVE', startTime: new Date(now.getTime() - 3600000), endTime: new Date(now.getTime() + 3600000), targetApMacs: [], campaignId: 'campaign', templateId: 'direct', formSchema: [{ id: 'old', type: 'text', label: 'Legacy', required: true }], nameFieldKey: 'old', idFieldKey: 'old', registrations: [], createdAt: now, updatedAt: now };
const template = (id: string, gate = 'attendance_gate') => ({ id, name: id, layoutJson: { draft: true }, publishedRevisionId: `rev-${id}`, publishedRevision: { id: `rev-${id}`, layoutJson: { elements: [{ id: 'gate', type: gate, enabled: true }] } } });
const req = (url: string, body?: unknown) => new NextRequest(`http://localhost${url}`, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockReturnValue({ id: 'admin', username: 'admin' });
  mocks.db.admin.findUnique.mockResolvedValue({id:'admin',username:'admin',role:'ADMIN',disabled:false});
  mocks.db.attendanceSession.findMany.mockResolvedValue([]);
  mocks.db.attendanceRegistration.findMany.mockResolvedValue([]);
  mocks.db.attendanceSession.findFirst.mockResolvedValue(null);
  mocks.db.attendanceSession.findUnique.mockResolvedValue(session);
  mocks.db.campaign.findFirst.mockResolvedValue(null);
  mocks.db.campaign.findUnique.mockResolvedValue({ id: 'campaign', template: template('campaign') });
  mocks.db.template.findUnique.mockImplementation(async ({ where }: any) => template(where.id));
  mocks.db.attendanceSession.count.mockResolvedValue(0);
  mocks.db.attendanceSession.update.mockImplementation(async ({ data }: any) => ({ ...session, ...data }));
  mocks.db.attendanceSession.create.mockImplementation(async ({ data }: any) => ({ ...session, ...data }));
  mocks.db.$executeRaw.mockResolvedValue(1);
  mocks.db.attendanceRegistration.create.mockImplementation(async ({ data }: any) => ({ id: 'registration', ...data }));
  mocks.db.$transaction.mockImplementation(async (fn: any) => fn(mocks.db));
});
describe('attendance/public route safety', () => {
  it('does not expose an unrelated ACTIVE meeting when SSID is absent', async () => {
    mocks.db.attendanceSession.findFirst.mockResolvedValue(session);
    const response = await portal(req('/api/portal?mac=aa'));
    expect((await response.json()).data.attendanceSession).toBeNull();
  });
  it('uses a matching meeting direct published template before its campaign and returns a stable portal session', async () => {
    mocks.db.attendanceSession.findFirst.mockResolvedValue(session);
    mocks.db.attendanceSession.findMany.mockResolvedValue([session]);
    mocks.db.campaign.findFirst.mockResolvedValue({ id: 'campaign', template: template('campaign') });
    const first = (await (await portal(req('/api/portal?ssid=Office&mac=AA'))).json()).data;
    const second = (await (await portal(req('/api/portal?ssid=Office&mac=aa'))).json()).data;
    expect(first.templateId).toBe('direct');
    expect(first.publishedRevisionId).toBe('rev-direct');
    expect(first.portalSessionId).toBeTruthy();
    expect(second.portalSessionId).toBe(first.portalSessionId);
    expect(first.attendanceSession.formSchema).toEqual(session.formSchema);
  });
  it('excludes meetings outside time or target AP context', async () => {
    mocks.db.attendanceSession.findFirst.mockResolvedValue(session);
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, targetApMacs: ['ap-room'] }]);
    const response = await portal(req('/api/portal?ssid=Office&mac=aa&apMac=ap-other'));
    expect((await response.json()).data.attendanceSession).toBeNull();
  });
  it('rejects submit session IDs on another SSID instead of registering an arbitrary meeting', async () => {
    const response = await submit(req('/api/attendance/portal/submit', { sessionId: 'meeting', ssid: 'Other', mac: 'aa', answers: {} }));
    expect(response.status).toBe(404);
  });
  it('requires admin auth for list/create/update/delete', async () => {
    mocks.auth.mockReturnValue(null);
    expect((await list(req('/api/attendance/sessions'))).status).toBe(401);
    expect((await create(req('/api/attendance/sessions', {}))).status).toBe(401);
    expect((await update(req('/api/attendance/sessions/meeting', {}), { params: { id: 'meeting' } })).status).toBe(401);
    expect((await remove(req('/api/attendance/sessions/meeting'), { params: { id: 'meeting' } })).status).toBe(401);
  });
  it('validates update date order through the same create rules', async () => {
    const response = await update(req('/api/attendance/sessions/meeting', { endTime: '2000-01-01T00:00:00Z' }), { params: { id: 'meeting' } });
    expect(response.status).toBe(400);
  });
  it('preserves legacy formSchema when editing and writes the optional direct template', async () => {
    const response = await update(req('/api/attendance/sessions/meeting', { templateId: 'new', campaignId: null, name: 'New name' }), { params: { id: 'meeting' } });
    expect(response.status).toBe(200);
    const saved = (await response.json()).data;
    expect(saved.templateId).toBe('new');
    expect(saved.campaignId).toBeNull();
    expect(saved.formSchema).toEqual(session.formSchema);
  });
  it('rejects activation when direct template lacks a published enabled attendance gate', async () => {
    mocks.db.attendanceSession.findUnique.mockResolvedValue({ ...session, status: 'READY' });
    mocks.db.template.findUnique.mockResolvedValue({ ...template('direct'), publishedRevision: null });
    expect((await update(req('/api/attendance/sessions/meeting', { status: 'ACTIVE' }), { params: { id: 'meeting' } })).status).toBe(400);
  });
  it('blocks deleting a directly referenced template', async () => {
    mocks.db.attendanceSession.count.mockResolvedValue(1);
    expect((await deleteTemplate(req('/api/templates/direct'), { params: { id: 'direct' } })).status).toBe(409);
  });
  it('rejects arbitrary announcement IDs as video completion sessions', async () => {
    expect((await complete(req('/api/video-complete', { sessionId: 'announcement-id', mac: 'aa' }))).status).toBe(400);
    expect(mocks.setWatched).not.toHaveBeenCalled();
  });
  it('blocks redirect-based connect until published video has been completed', async () => {
    const videoSession = { ...session, templateId: 'video' };
    mocks.db.attendanceSession.findFirst.mockResolvedValue(videoSession);
    mocks.db.attendanceSession.findMany.mockResolvedValue([videoSession]);
    mocks.db.template.findUnique.mockResolvedValue(template('video', 'video_gate'));
    const response = await connect(req('/api/connect?ssid=Office&mac=aa&trial=http://192.168.1.1/login'));
    expect(response.status).toBe(403);
  });
  it('protects registration reads and device changes with admin auth', async () => {
    mocks.auth.mockReturnValue(null);
    expect((await registrations(req('/api/attendance/sessions/meeting/registrations'), { params: { id: 'meeting' } })).status).toBe(401);
    expect((await changeRegistration(req('/api/attendance/sessions/meeting/registrations', {}), { params: { id: 'meeting' } })).status).toBe(401);
  });
  it('refuses an activation on a template whose only video settings are draft settings', async () => {
    const video = { ...template('draft-video'), layoutJson: { elements: [{ type: 'video_gate', enabled: true }] } };
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, templateId: video.id }]);
    mocks.db.template.findUnique.mockResolvedValue(video);
    mocks.db.attendanceRegistration.findFirst.mockResolvedValue({ id: 'registered' });
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=aa'))).json()).data;
    const response = await login(req('/api/login', { ssid: 'Office', mac: 'aa', portalSessionId: data.portalSessionId, trial: 'http://192.168.1.1/login' }));
    expect(response.status).toBe(200);
    expect(mocks.watched).not.toHaveBeenCalled();
  });
  it('completes the published video using the issued portal token and permits the same token on connect', async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, templateId: 'video' }]);
    mocks.db.template.findUnique.mockResolvedValue(template('video', 'video_gate'));
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=AA'))).json()).data;
    const completion = await complete(req('/api/video-complete', { portalSessionId: data.portalSessionId, mac: 'aa' }));
    expect(completion.status).toBe(200);
    mocks.watched.mockResolvedValue(true);
    const response = await connect(req(`/api/connect?mac=AA&portalSessionId=${encodeURIComponent(data.portalSessionId)}&trial=http://192.168.1.1/login`));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('192.168.1.1/login');
  });
  it('does not let another MAC reuse a video completion token', async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, templateId: 'video' }]);
    mocks.db.template.findUnique.mockResolvedValue(template('video', 'video_gate'));
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=aa'))).json()).data;
    const response = await complete(req('/api/video-complete', { portalSessionId: data.portalSessionId, mac: 'bb' }));
    expect(response.status).toBe(400);
    expect(mocks.setWatched).not.toHaveBeenCalled();
  });
  it('closes intervals and ends a meeting as one transaction', async () => {
    const joinedAt = new Date(Date.now() - 60000);
    const current = { ...session, registrations: [{ id: 'reg', intervals: [{ id: 'interval', joinedAt }] }] };
    let transactional = false;
    let savedLeftAt: Date | undefined;
    mocks.db.attendanceSession.findUnique.mockResolvedValue(current);
    mocks.db.$transaction.mockImplementation(async (fn: any) => { transactional = true; const result = await fn(mocks.db); transactional = false; return result; });
    mocks.db.attendanceInterval.update.mockImplementation(async ({ data }: any) => { expect(transactional).toBe(true); savedLeftAt = data.leftAt; return data; });
    const response = await update(req('/api/attendance/sessions/meeting', { status: 'ENDED' }), { params: { id: 'meeting' } });
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.status).toBe('ENDED');
    expect(data.endedAt).toBe(savedLeftAt?.toISOString());
  });

  it('does not treat an announcement controller in a legacy V2 video slot as video completion', async () => {
    const invalidVideo = template('announcement-only');
    invalidVideo.publishedRevision.layoutJson = { schemaVersion: 2, variants: { mobile: { flow: { videoGate: { element: { type: 'announcement', enabled: true } } }, sections: [] } } } as any;
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, templateId: invalidVideo.id }]);
    mocks.db.template.findUnique.mockResolvedValue(invalidVideo);
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=aa'))).json()).data;
    const response = await complete(req('/api/video-complete', { portalSessionId: data.portalSessionId, mac: 'aa' }));
    expect(response.status).toBe(400);
    expect(mocks.setWatched).not.toHaveBeenCalled();
  });

  it('ignores forged campaign selectors rather than removing published video policy', async () => {
    const protectedCampaign = { id: 'protected', template: template('protected', 'video_gate') };
    mocks.db.campaign.findFirst.mockImplementation(async ({ where }: any) => where.id === 'nonexistent' ? null : protectedCampaign);
    const result = await connect(req('/api/connect?ssid=Office&mac=aa&campaignId=nonexistent&trial=http://192.168.1.1/login'));
    expect(result.status).toBe(403);
    const response = await login(req('/api/login', { ssid: 'Office', mac: 'aa', campaignId: 'nonexistent', trial: 'http://192.168.1.1/login' }));
    expect(response.status).toBe(403);
  });
  it('cannot authorize unsigned clients that omit network context through a protected portal', async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValue([session]);
    const protectedCampaign = { id: 'protected', template: template('protected', 'video_gate') };
    mocks.db.campaign.findFirst.mockImplementation(async ({ where }: any) => where.portalEnabled ? null : protectedCampaign);
    expect((await connect(req('/api/connect?mac=aa&trial=http://192.168.1.1/login'))).status).toBe(403);
    expect((await login(req('/api/login', { mac: 'aa', trial: 'http://192.168.1.1/login' }))).status).toBe(403);
  });
  it('requires a signed context even for an already registered meeting participant', async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValue([session]);
    mocks.db.attendanceRegistration.findFirst.mockResolvedValue({ id: 'registration' });
    expect((await connect(req('/api/connect?ssid=Office&mac=aa&trial=http://192.168.1.1/login'))).status).toBe(403);
  });
  it('matches exactly one scheduled network meeting when the router cannot supply an AP', async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, targetApMacs: ['ap-room'] }]);
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=aa'))).json()).data;
    expect(data.attendanceSession?.id).toBe('meeting');
  });
  it('refuses ambiguous AP-less meeting enrollment and authorization', async () => {
    mocks.db.attendanceSession.findMany.mockResolvedValue([{ ...session, targetApMacs: ['ap-one'] }, { ...session, id: 'second', targetApMacs: ['ap-two'] }]);
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=aa'))).json()).data;
    expect(data.attendanceSession).toBeNull();
    expect((await connect(req(`/api/connect?mac=aa&portalSessionId=${encodeURIComponent(data.portalSessionId)}&trial=http://192.168.1.1/login`))).status).toBe(403);
    expect((await submit(req('/api/attendance/portal/submit', { sessionId: 'meeting', ssid: 'Office', mac: 'aa', answers: { old: 'Visitor' } }))).status).toBe(404);
  });
  it('signs and returns the requested device, and only that device visible gates apply', async () => {
    const deviceTemplate = template('devices');
    const variant = (enabled: boolean, hidden = false) => ({ flow: { videoGate: { hidden, element: { type: 'video_gate', enabled } } }, sections: [] });
    deviceTemplate.publishedRevision.layoutJson = { schemaVersion: 2, variants: { mobile: variant(false), tablet: variant(true, true), desktop: variant(true) } } as any;
    mocks.db.campaign.findFirst.mockResolvedValue({ id: 'devices', template: deviceTemplate });
    const mobile = (await (await portal(req('/api/portal?ssid=Office&mac=aa&device=mobile'))).json()).data;
    const desktop = (await (await portal(req('/api/portal?ssid=Office&mac=aa&device=desktop'))).json()).data;
    const tablet = (await (await portal(req('/api/portal?ssid=Office&mac=aa&device=tablet'))).json()).data;
    expect(desktop.params.device).toBe('desktop');
    expect(desktop.portalSessionId).not.toBe(mobile.portalSessionId);
    expect((await complete(req('/api/video-complete', { portalSessionId: mobile.portalSessionId, mac: 'aa' }))).status).toBe(400);
    expect((await complete(req('/api/video-complete', { portalSessionId: tablet.portalSessionId, mac: 'aa' }))).status).toBe(400);
    expect((await complete(req('/api/video-complete', { portalSessionId: desktop.portalSessionId, mac: 'aa' }))).status).toBe(200);
    expect((await connect(req(`/api/connect?mac=aa&portalSessionId=${encodeURIComponent(mobile.portalSessionId)}&trial=http://192.168.1.1/login`))).status).toBe(302);
    expect((await connect(req(`/api/connect?mac=aa&portalSessionId=${encodeURIComponent(tablet.portalSessionId)}&trial=http://192.168.1.1/login`))).status).toBe(302);
    expect((await connect(req(`/api/connect?mac=aa&portalSessionId=${encodeURIComponent(desktop.portalSessionId)}&trial=http://192.168.1.1/login`))).status).toBe(403);
  });
  it('rejects invalid public device selectors and attempts to change a signed device', async () => {
    expect((await portal(req('/api/portal?ssid=Office&mac=aa&device=television'))).status).toBe(400);
    const data = (await (await portal(req('/api/portal?ssid=Office&mac=aa&device=mobile'))).json()).data;
    expect((await connect(req(`/api/connect?mac=aa&device=desktop&portalSessionId=${encodeURIComponent(data.portalSessionId)}&trial=http://192.168.1.1/login`))).status).toBe(400);
  });
  it('requires visible attendance controllers on every V2 device before activation', async () => {
    const candidate = template('incomplete-attendance');
    const variant = (hidden: boolean) => ({ flow: { attendanceGate: { hidden, element: { type: 'attendance_gate', enabled: true } } }, sections: [] });
    candidate.publishedRevision.layoutJson = { schemaVersion: 2, variants: { mobile: variant(false), tablet: variant(false), desktop: variant(true) } } as any;
    mocks.db.attendanceSession.findUnique.mockResolvedValue({ ...session, status: 'READY' });
    mocks.db.template.findUnique.mockResolvedValue(candidate);
    expect((await update(req('/api/attendance/sessions/meeting', { status: 'ACTIVE' }), { params: { id: 'meeting' } })).status).toBe(400);
  });

  it('does not authorize an empty fallback token without a resolved published portal', async () => {
    const data = (await (await portal(req('/api/portal?mac=aa'))).json()).data;
    const response = await connect(req(`/api/connect?mac=aa&portalSessionId=${encodeURIComponent(data.portalSessionId)}&trial=http://192.168.1.1/login`));
    expect(response.status).toBe(403);
  });

});
