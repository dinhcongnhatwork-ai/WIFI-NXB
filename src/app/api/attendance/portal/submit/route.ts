import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectDeviceVendor } from '@/lib/attendance/constants';
import { broadcastSessionUpdate } from '@/lib/attendance/monitor';
import { FormFieldDefinition } from '@/types/attendance';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      campaignId,
      ssid,
      mac,
      ip,
      answers = {},
      trial,
      linkLogin,
    } = body;

    if (!mac) {
      return NextResponse.json(
        { success: false, error: 'Không nhận diện được địa chỉ MAC của thiết bị. Vui lòng kết nối lại WiFi.' },
        { status: 400 }
      );
    }

    const normMac = mac.trim().toLowerCase();

    // Find session: by sessionId, or active session on this SSID
    let session = sessionId
      ? await prisma.attendanceSession.findUnique({ where: { id: sessionId } })
      : null;

    if (!session && ssid) {
      session = await prisma.attendanceSession.findFirst({
        where: {
          ssid: ssid.trim(),
          status: 'ACTIVE',
        },
      });
    }

    if (!session) {
      // Fallback: any currently ACTIVE attendance session
      session = await prisma.attendanceSession.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Hiện không có buổi điểm danh nào đang diễn ra.' },
        { status: 404 }
      );
    }

    // Validate form schema fields
    const formSchema = (session.formSchema as unknown as FormFieldDefinition[]) || [];
    const fieldErrors: Record<string, string> = {};

    for (const field of formSchema) {
      const val = answers[field.id];
      if (field.required) {
        if (val === undefined || val === null || String(val).trim() === '') {
          fieldErrors[field.id] = `Vui lòng nhập ${field.label}`;
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ các thông tin bắt buộc.',
          fieldErrors,
        },
        { status: 422 }
      );
    }

    // Extract Display Name & Identity value
    const nameFieldKey = session.nameFieldKey || 'fullname';
    const idFieldKey = session.idFieldKey || 'employee_code';

    const displayName = String(answers[nameFieldKey] || answers['fullname'] || 'Người tham dự').trim();
    const identityValue = String(answers[idFieldKey] || answers['employee_code'] || normMac).trim();

    if (!identityValue) {
      return NextResponse.json(
        { success: false, error: 'Mã định danh người tham dự không được để trống.' },
        { status: 400 }
      );
    }

    // Check duplicate identity: Has this identityValue already been registered with ANOTHER MAC in this session?
    const existingRegistration = await prisma.attendanceRegistration.findUnique({
      where: {
        sessionId_identityValue: {
          sessionId: session.id,
          identityValue,
        },
      },
    });

    if (existingRegistration && existingRegistration.primaryMac.toLowerCase() !== normMac) {
      // RULE from PLAN.MD:
      // "Nếu định danh đã gắn với thiết bị khác, hiển thị yêu cầu người chủ trì xác nhận đổi thiết bị.
      // Không tự ghi đè hồ sơ hoặc tiết lộ thông tin của người đăng ký trước."
      return NextResponse.json(
        {
          success: false,
          error: `Mã định danh "${identityValue}" đã được đăng ký trên một thiết bị khác. Nếu bạn đổi thiết bị, vui lòng liên hệ Ban Tổ chức / Chủ trì cuộc họp để được xác nhận đổi thiết bị chính.`,
          isDeviceConflict: true,
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const deviceVendor = detectDeviceVendor(normMac);

    let registration;

    if (existingRegistration) {
      // Same identity and same MAC: update answers
      registration = await prisma.attendanceRegistration.update({
        where: { id: existingRegistration.id },
        data: {
          displayName,
          formAnswers: answers,
          primaryIp: ip || existingRegistration.primaryIp,
          lastSeenAt: now,
          status: 'PRESENT',
          consecutiveMissCount: 0,
        },
      });
    } else {
      // New attendee registration
      registration = await prisma.attendanceRegistration.create({
        data: {
          sessionId: session.id,
          identityValue,
          displayName,
          formAnswers: answers,
          primaryMac: normMac,
          primaryIp: ip || null,
          deviceVendor,
          firstSeenAt: now,
          lastSeenAt: now,
          status: 'PRESENT',
          consecutiveMissCount: 0,
        },
      });

      // Start initial presence interval
      await prisma.attendanceInterval.create({
        data: {
          registrationId: registration.id,
          joinedAt: now,
          status: 'PRESENT',
        },
      });

      // Remove from unregistered clients list if present
      await prisma.attendanceUnregisteredClient.deleteMany({
        where: {
          sessionId: session.id,
          mac: normMac,
        },
      });

      // Log registration event
      await prisma.attendanceLog.create({
        data: {
          sessionId: session.id,
          registrationId: registration.id,
          type: 'REGISTER',
          message: `${displayName} (${identityValue}) đã hoàn tất biểu mẫu điểm danh từ thiết bị ${normMac}.`,
          details: { ip, deviceVendor },
          createdAt: now,
        },
      });
    }

    // Upsert to general WifiUser table for persistence
    try {
      await prisma.wifiUser.upsert({
        where: { mac: normMac },
        update: {
          ip: ip || undefined,
          phone: answers['phone'] ? String(answers['phone']) : undefined,
        },
        create: {
          mac: normMac,
          ip: ip || null,
          phone: answers['phone'] ? String(answers['phone']) : null,
        },
      });
    } catch {
      // Ignore user upsert error
    }

    // Broadcast realtime update to admin
    await broadcastSessionUpdate(session.id, {
      type: 'ATTENDEE_REGISTERED',
      registrationId: registration.id,
      displayName,
      identityValue,
      timestamp: now.toISOString(),
    });

    // Build MikroTik connect URL
    // Filter: only pass URLs that look like valid HTTP(S) URLs (MikroTik $(trial) can be "yes"/"no")
    const isValidUrl = (s: string) => s && /^https?:\/\//i.test(s);
    
    let redirectConnectUrl = `/api/connect?mac=${encodeURIComponent(normMac)}&ip=${encodeURIComponent(ip || '')}&ssid=${encodeURIComponent(ssid || session.ssid)}`;
    
    // Forward trial URL (only if it's a real URL, not "yes"/"no")
    if (isValidUrl(trial)) {
      redirectConnectUrl += `&trial=${encodeURIComponent(trial)}`;
    }
    // Forward link-login URL
    if (isValidUrl(linkLogin)) {
      redirectConnectUrl += `&link-login=${encodeURIComponent(linkLogin)}`;
    }
    // Also forward link-login-only if present (the actual MikroTik trial login URL)
    const linkLoginOnly = body.linkLoginOnly || '';
    if (isValidUrl(linkLoginOnly)) {
      redirectConnectUrl += `&link-login-only=${encodeURIComponent(linkLoginOnly)}`;
    }
    if (campaignId || session.campaignId) {
      redirectConnectUrl += `&campaignId=${encodeURIComponent(campaignId || session.campaignId || '')}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        registration,
        message: session.successMessage || 'Điểm danh thành công! Đang kết nối Internet...',
        redirectConnectUrl,
      },
    });
  } catch (error) {
    console.error('[api/attendance/portal/submit POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
