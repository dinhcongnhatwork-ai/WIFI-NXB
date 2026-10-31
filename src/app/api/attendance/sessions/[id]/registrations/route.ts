import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { detectDeviceVendor } from '@/lib/attendance/constants';
import { broadcastSessionUpdate } from '@/lib/attendance/monitor';

export const dynamic = 'force-dynamic';

async function handleGET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = params;
    const registrations = await prisma.attendanceRegistration.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        intervals: {
          orderBy: { joinedAt: 'desc' },
        },
        deviceHistories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json({ success: true, data: registrations });
  } catch (error) {
    console.error('[api/attendance/sessions/[id]/registrations GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Admin updates attendee info or changes their primary MAC address
 */
async function handlePATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id: sessionId } = params;
    const body = await req.json();
    const {
      registrationId,
      newMac,
      reason,
      performedBy = 'Ban Chủ trì / Admin',
      displayName,
      formAnswers,
    } = body;

    if (!registrationId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã người tham dự (registrationId).' },
        { status: 400 }
      );
    }

    const reg = await prisma.attendanceRegistration.findFirst({
      where: { id: registrationId, sessionId },
    });

    if (!reg) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy người tham dự.' },
        { status: 404 }
      );
    }

    const now = new Date();
    const updateData: any = {};

    if (displayName) updateData.displayName = displayName.trim();
    if (formAnswers) updateData.formAnswers = formAnswers;

    // Handle MAC device swap
    if (newMac && newMac.trim().toLowerCase() !== reg.primaryMac.toLowerCase()) {
      const normNewMac = newMac.trim().toLowerCase();

      // Check if new MAC is already registered in this session
      const existingWithNewMac = await prisma.attendanceRegistration.findFirst({
        where: {
          sessionId,
          primaryMac: normNewMac,
          NOT: { id: registrationId },
        },
      });

      if (existingWithNewMac) {
        return NextResponse.json(
          {
            success: false,
            error: `Địa chỉ MAC ${newMac} đang được liên kết với người tham dự khác (${existingWithNewMac.displayName}).`,
          },
          { status: 400 }
        );
      }

      const oldMac = reg.primaryMac;
      updateData.primaryMac = normNewMac;
      updateData.deviceVendor = detectDeviceVendor(normNewMac);

      // Record device history
      await prisma.attendanceDeviceHistory.create({
        data: {
          registrationId,
          oldMac,
          newMac: normNewMac,
          reason: reason?.trim() || 'Người dùng đổi thiết bị và được Admin xác nhận',
          performedBy,
          createdAt: now,
        },
      });

      // Log device change event
      await prisma.attendanceLog.create({
        data: {
          sessionId,
          registrationId,
          type: 'DEVICE_CHANGE',
          message: `${performedBy} đã xác nhận đổi thiết bị cho ${reg.displayName} từ ${oldMac} sang ${normNewMac}.`,
          details: { oldMac, newMac: normNewMac, reason, performedBy },
          createdAt: now,
        },
      });
    }

    const updated = await prisma.attendanceRegistration.update({
      where: { id: registrationId },
      data: updateData,
    });

    await broadcastSessionUpdate(sessionId, {
      type: 'REGISTRATION_UPDATED',
      registrationId,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[api/attendance/sessions/[id]/registrations PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);

export const PATCH = withPermission('operate', handlePATCH);
