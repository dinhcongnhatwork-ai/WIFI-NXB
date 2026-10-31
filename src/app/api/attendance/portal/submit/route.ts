import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectDeviceVendor } from '@/lib/attendance/constants';
import { broadcastSessionUpdate } from '@/lib/attendance/monitor';
import { FormFieldDefinition } from '@/types/attendance';
import { cleanMac, parseDevice, PortalContextError, readPortalSessionId, resolveAttendanceSession, resolvePortalAccess } from '@/lib/attendance/runtime';
import { lockAttendanceSession } from '@/lib/attendance/locking';

export const dynamic = 'force-dynamic';
class SubmissionError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, ssid, mac, ip, answers = {}, trial, linkLogin } = body;
    const normMac = cleanMac(mac);
    if (!normMac) throw new SubmissionError(400, 'Không nhận diện được địa chỉ MAC của thiết bị. Vui lòng kết nối lại WiFi.');
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new SubmissionError(400, 'Invalid answers');
    const signed = body.portalSessionId ? readPortalSessionId(body.portalSessionId) : null;
    if (body.portalSessionId && (!signed || signed.mac !== normMac || (ssid && signed.ssid !== ssid.trim()) || (sessionId && signed.attendanceSessionId !== sessionId))) throw new SubmissionError(400, 'Invalid portal session');
    const context = { sessionId: sessionId || signed?.attendanceSessionId, ssid: ssid || signed?.ssid, apMac: body.apMac || signed?.apMac, unifiSite: body.unifiSite || signed?.unifiSite, mac: normMac, device: body.device ? parseDevice(body.device) : signed?.device };
    // Resolve an ID to lock, then recheck network/time/status after that lock is held.
    const candidate = await resolveAttendanceSession(prisma, context);
    if (!candidate) throw new SubmissionError(404, 'Hiện không có buổi điểm danh nào đang diễn ra.');
    const result = await prisma.$transaction(async tx => {
      await lockAttendanceSession(tx, candidate.id);
      const now = new Date();
      const session = await resolveAttendanceSession(tx, context, now);
      if (!session || session.id !== candidate.id) throw new SubmissionError(404, 'Buổi điểm danh đã kết thúc hoặc không còn phù hợp với mạng WiFi.');
      const runtime = await resolvePortalAccess(tx, context, body.portalSessionId);
      if (!runtime || runtime.attendanceSession?.id !== session.id) throw new SubmissionError(400, 'Invalid or expired portal session');
      const fields = Array.isArray(session.formSchema) ? session.formSchema as unknown as FormFieldDefinition[] : [];
      const fieldErrors: Record<string, string> = {};
      for (const field of fields) {
        const value = answers[field.id];
        if (field.required && (value === undefined || value === null || String(value).trim() === '')) fieldErrors[field.id] = `Vui lòng nhập ${field.label}`;
      }
      if (Object.keys(fieldErrors).length) throw new SubmissionError(422, 'Vui lòng điền đầy đủ các thông tin bắt buộc.', { fieldErrors });
      const displayName = String(answers[session.nameFieldKey || 'fullname'] || answers.fullname || 'Người tham dự').trim();
      const identityValue = String(answers[session.idFieldKey || 'employee_code'] || answers.employee_code || normMac).trim();
      if (!identityValue) throw new SubmissionError(400, 'Mã định danh người tham dự không được để trống.');
      const existing = await tx.attendanceRegistration.findUnique({ where: { sessionId_identityValue: { sessionId: session.id, identityValue } } });
      if (existing && cleanMac(existing.primaryMac) !== normMac) throw new SubmissionError(409, `Mã định danh "${identityValue}" đã được đăng ký trên một thiết bị khác. Nếu bạn đổi thiết bị, vui lòng liên hệ Ban Tổ chức / Chủ trì cuộc họp để được xác nhận đổi thiết bị chính.`, { isDeviceConflict: true });
      const deviceVendor = detectDeviceVendor(normMac);
      const registration = existing
        ? await tx.attendanceRegistration.update({ where: { id: existing.id }, data: { displayName, formAnswers: answers, primaryIp: ip || existing.primaryIp, lastSeenAt: now, status: 'PRESENT', consecutiveMissCount: 0 } })
        : await tx.attendanceRegistration.create({ data: { sessionId: session.id, identityValue, displayName, formAnswers: answers, primaryMac: normMac, primaryIp: ip || null, deviceVendor, firstSeenAt: now, lastSeenAt: now, status: 'PRESENT', consecutiveMissCount: 0 } });
      if (!existing) {
        await tx.attendanceInterval.create({ data: { registrationId: registration.id, joinedAt: now, apMac: cleanMac(context.apMac) || null, status: 'PRESENT' } });
        await tx.attendanceUnregisteredClient.deleteMany({ where: { sessionId: session.id, mac: normMac } });
        await tx.attendanceLog.create({ data: { sessionId: session.id, registrationId: registration.id, type: 'REGISTER', message: `${displayName} (${identityValue}) đã hoàn tất biểu mẫu điểm danh từ thiết bị ${normMac}.`, details: { ip: ip || null, deviceVendor }, createdAt: now } });
      }
      return { session, registration, displayName, identityValue, now, portalSessionId: runtime.portalSessionId };
    }, { isolationLevel: 'ReadCommitted' });
    try {
      await prisma.wifiUser.upsert({ where: { mac: normMac }, update: { ip: ip || undefined, phone: answers.phone ? String(answers.phone) : undefined }, create: { mac: normMac, ip: ip || null, phone: answers.phone ? String(answers.phone) : null } });
    } catch { /* The attendance transaction is authoritative if the general user profile fails. */ }
    await broadcastSessionUpdate(result.session.id, { type: 'ATTENDEE_REGISTERED', registrationId: result.registration.id, displayName: result.displayName, identityValue: result.identityValue, timestamp: result.now.toISOString() });
    const params = new URLSearchParams({ mac: normMac, ip: ip || '', ssid: result.session.ssid, portalSessionId: result.portalSessionId });
    const isUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//i.test(value);
    if (isUrl(trial)) params.set('trial', trial);
    if (isUrl(linkLogin)) params.set('link-login', linkLogin);
    if (isUrl(body.linkLoginOnly)) params.set('link-login-only', body.linkLoginOnly);
    if (result.session.campaignId) params.set('campaignId', result.session.campaignId);
    if (context.apMac) params.set('apMac', context.apMac);
    return NextResponse.json({ success: true, data: { registration: result.registration, message: result.session.successMessage || 'Điểm danh thành công! Đang kết nối Internet...', redirectConnectUrl: `/api/connect?${params}` } });
  } catch (error) {
    if (error instanceof SubmissionError) return NextResponse.json({ success: false, error: error.message, ...error.extra }, { status: error.status });
    if (error instanceof PortalContextError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('[api/attendance/portal/submit POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
