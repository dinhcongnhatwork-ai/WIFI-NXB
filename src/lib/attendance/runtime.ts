import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { flowNode, GateScreenId, isTemplateDocumentV2, DeviceVariant, DEVICE_KEYS } from '@/lib/template-document';
import { AttendanceSessionDto } from '@/types/attendance';

type RuntimeDb = Pick<PrismaClient, 'attendanceSession' | 'attendanceRegistration' | 'campaign' | 'template'>;
export interface NetworkContext { ssid?: string; apMac?: string; mac?: string; sessionId?: string; campaignId?: string; templateId?: string; unifiSite?: string; device?: DeviceVariant }
export function cleanMac(value: unknown): string { return typeof value === 'string' ? value.trim().toLowerCase().replace(/-/g, ':') : ''; }
export class PortalContextError extends Error {}
export function parseDevice(value: unknown): DeviceVariant {
  if (value === undefined || value === null || value === '') return 'mobile';
  if (!DEVICE_KEYS.includes(value as DeviceVariant)) throw new PortalContextError('Invalid portal device');
  return value as DeviceVariant;
}
export function hasPublishedGate(layout: unknown, screen: GateScreenId, device: DeviceVariant = 'mobile'): boolean {
  if (isTemplateDocumentV2(layout)) {
    const variant = layout.variants[device];
    if (!variant) return false;
    const node = flowNode(variant, screen);
    return !!node && !node.hidden && node.element.type === screen && node.element.enabled !== false;
  }
  if (!layout || typeof layout !== 'object') return false;
  const value = layout as { elements?: Array<{type: string; enabled?: boolean; hidden?: boolean}>; children?: Array<{type: string; enabled?: boolean; hidden?: boolean; props?: {enabled?: boolean}}> };
  return !!(value.elements?.some(element => element.type === screen && !element.hidden && element.enabled !== false)
    || value.children?.some(element => element.type === screen && !element.hidden && element.enabled !== false && element.props?.enabled !== false));
}
export function isAttendanceTemplateReady(layout: unknown): boolean {
  return isTemplateDocumentV2(layout) ? DEVICE_KEYS.every(device => hasPublishedGate(layout, 'attendance_gate', device)) : hasPublishedGate(layout, 'attendance_gate');
}
export async function resolveAttendanceContext(db: RuntimeDb, context: NetworkContext, now = new Date()) {
  const ssid = context.ssid?.trim();
  if (!ssid) return { session: null, ambiguous: false };
  const where = { ssid, status: 'ACTIVE', startTime: { lte: now }, endTime: { gt: now }, ...(context.unifiSite ? { unifiSite: context.unifiSite } : {}) };
  const candidates = await db.attendanceSession.findMany({ where, orderBy: [{ startTime: 'desc' }, { id: 'asc' }] });
  const apMac = cleanMac(context.apMac);
  // Recheck context as defense against ambiguous IDs and reuse in route tests.
  const matches = candidates.filter(session => {
    const targets = Array.isArray(session.targetApMacs) ? session.targetApMacs.filter((item): item is string => typeof item === 'string').map(cleanMac) : [];
    return session.ssid === ssid && session.status === 'ACTIVE' && new Date(session.startTime) <= now && new Date(session.endTime) > now
      && (!context.unifiSite || session.unifiSite === context.unifiSite)
      && (targets.length === 0 || !apMac || targets.includes(apMac));
  });
  // Ambiguous overlapping sessions must never enroll a visitor arbitrarily.
  return { session: matches.length === 1 && (!context.sessionId || matches[0].id === context.sessionId) ? matches[0] : null, ambiguous: matches.length > 1 };
}
export async function resolveAttendanceSession(db: RuntimeDb, context: NetworkContext, now = new Date()) {
  return (await resolveAttendanceContext(db, context, now)).session;
}
export async function resolvePortalRuntime(db: RuntimeDb, context: NetworkContext, now = new Date()) {
  const device = parseDevice(context.device);
  const attendance = await resolveAttendanceContext(db, context, now);
  const attendanceSession = attendance.session;
  const include = { template: { include: { publishedRevision: true } } } as const;
  let campaign = attendanceSession?.campaignId ? await db.campaign.findUnique({ where: { id: attendanceSession.campaignId }, include }) : null;
  let template = attendanceSession?.templateId ? await db.template.findUnique({ where: { id: attendanceSession.templateId }, include: { publishedRevision: true } }) : null;
  if (!template?.publishedRevision) template = campaign?.template ?? null;
  if (!template?.publishedRevision) {
    const ssid = context.ssid?.trim();
    const valid = { active: true, startTime: { lte: now }, endTime: { gt: now }, template: { publishedRevisionId: { not: null } } };
    campaign = await db.campaign.findFirst({
      where: { ...valid, ...(ssid ? { ssid } : { portalEnabled: true }) },
      include, orderBy: [{ portalEnabled: 'desc' }, { startTime: 'desc' }, { id: 'asc' }],
    });
    template = campaign?.template ?? null;
  }
  if (!template?.publishedRevision && context.templateId) {
    template = await db.template.findUnique({ where: { id: context.templateId }, include: { publishedRevision: true } });
  }
  if (!template) {
    template = await db.template.findFirst({
      where: { status: 'published', publishedRevisionId: { not: null } },
      include: { publishedRevision: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
  if (!template) {
    template = await db.template.findFirst({
      include: { publishedRevision: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
  const revision = template?.publishedRevision ?? null;
  const layout = revision?.layoutJson ?? template?.layoutJson ?? null;
  const isAlreadyRegistered = attendanceSession && cleanMac(context.mac) ? !!(await db.attendanceRegistration.findFirst({ where: { sessionId: attendanceSession.id, primaryMac: cleanMac(context.mac) } })) : false;
  const effectiveTemplateId = template?.id || null;
  const publishedRevisionId = revision ? revision.id : null;
  const portalSessionId = makePortalSessionId({ device, ssid: context.ssid?.trim() || '', apMac: cleanMac(context.apMac), mac: cleanMac(context.mac), unifiSite: context.unifiSite || '', attendanceSessionId: attendanceSession?.id || '', templateId: effectiveTemplateId || '', revisionId: publishedRevisionId || '', campaignId: campaign?.id || '' });
  return { attendanceSession, attendanceAmbiguous: attendance.ambiguous, device, campaign, template, layout, isAlreadyRegistered, effectiveTemplateId, publishedRevisionId, portalSessionId };
}
interface PortalContext { device: DeviceVariant; ssid: string; apMac: string; mac: string; unifiSite: string; attendanceSessionId: string; templateId: string; revisionId: string; campaignId: string }
const secret = () => process.env.JWT_SECRET || 'change-me-in-production';
function signature(value: string): string { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function makePortalSessionId(context: PortalContext): string {
  const payload = Buffer.from(JSON.stringify(context)).toString('base64url');
  return `portal.${payload}.${signature(payload)}`;
}
export function readPortalSessionId(value: unknown): PortalContext | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  const [prefix, payload, supplied, extra] = value.split('.');
  if (prefix !== 'portal' || !payload || !supplied || extra) return null;
  const expected = signature(payload);
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  try {
    const context = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return ['ssid', 'apMac', 'mac', 'unifiSite', 'attendanceSessionId', 'templateId', 'revisionId', 'campaignId'].every(key => typeof context[key] === 'string') && DEVICE_KEYS.includes(context.device) ? context : null;
  } catch { return null; }
}
export async function resolvePortalAccess(db: RuntimeDb, context: NetworkContext, portalSessionId?: unknown) {
  if (!portalSessionId) return resolvePortalRuntime(db, context);
  const signed = readPortalSessionId(portalSessionId);
  if (!signed || (context.device && parseDevice(context.device) !== signed.device) || cleanMac(context.mac) !== signed.mac || (context.ssid && context.ssid.trim() !== signed.ssid) || (context.apMac && cleanMac(context.apMac) !== signed.apMac)) return null;
  const runtime = await resolvePortalRuntime(db, { device: signed.device, ssid: signed.ssid, apMac: signed.apMac, mac: signed.mac, unifiSite: signed.unifiSite, sessionId: signed.attendanceSessionId, campaignId: signed.campaignId });
  return runtime.portalSessionId === portalSessionId ? runtime : null;
}
export function requiresSignedPortalSession(runtime: Awaited<ReturnType<typeof resolvePortalRuntime>>): boolean {
  return !!runtime.attendanceSession || runtime.attendanceAmbiguous || hasPublishedGate(runtime.layout, 'video_gate', runtime.device) || hasPublishedGate(runtime.layout, 'attendance_gate', runtime.device) || hasPublishedGate(runtime.layout, 'announcement', runtime.device);
}
export function attendanceSessionDto(session: NonNullable<Awaited<ReturnType<typeof resolveAttendanceSession>>>): AttendanceSessionDto {
  return { ...session, formSchema: session.formSchema as unknown as AttendanceSessionDto['formSchema'], targetApMacs: session.targetApMacs as string[], status: session.status as AttendanceSessionDto['status'], dialogTitle: session.dialogTitle || 'Điểm danh cuộc họp', confirmButtonText: session.confirmButtonText || 'Xác nhận điểm danh và kết nối', successMessage: session.successMessage || 'Điểm danh thành công!', startTime: session.startTime.toISOString(), endTime: session.endTime.toISOString(), endedAt: session.endedAt?.toISOString() ?? null, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() };
}
