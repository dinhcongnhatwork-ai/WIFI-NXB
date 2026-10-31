import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lockAttendanceSchedules, lockAttendanceSession } from '@/lib/attendance/locking';
import { getUnifiClientFromRequest } from '@/lib/settings';
import { authenticateRequest } from '@/lib/auth';
import { AttendanceInputError, validateSessionInput, validateSessionRelations } from '@/lib/attendance/session-validation';

export const dynamic = 'force-dynamic';

async function handleGET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        template: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true, ssid: true } },
        registrations: {
          orderBy: { createdAt: 'desc' },
          include: {
            intervals: {
              orderBy: { joinedAt: 'desc' },
              take: 20,
            },
            deviceHistories: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        unregisteredClients: {
          orderBy: { lastSeenAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy buổi điểm danh.' },
        { status: 404 }
      );
    }

    // Try fetching target AP info from UniFi Controller
    let targetAps: Array<{ mac: string; name: string; model?: string; status?: string }> = [];
    const targetApMacs = Array.isArray(session.targetApMacs)
      ? (session.targetApMacs as string[])
      : [];

    try {
      const url=new URL(req.url);url.searchParams.set('siteId',session.unifiSite||'default');
      const client = await getUnifiClientFromRequest(new Request(url));
      await client.login();
      const devices = await client.getDevices();

      targetAps = targetApMacs.map((mac) => {
        const found = devices.find((d) => d.mac?.toLowerCase() === mac.toLowerCase());
        return {
          mac,
          name: found?.name || found?.model || `AP ${mac}`,
          model: found?.model,
          status: found?.status || 'offline',
        };
      });
    } catch {
      targetAps = targetApMacs.map((mac) => ({
        mac,
        name: `AP ${mac}`,
        status: 'unknown',
      }));
    }

    const presentCount = session.registrations.filter((r) => r.status === 'PRESENT').length;
    const temporaryAbsentCount = session.registrations.filter((r) => r.status === 'TEMPORARY_ABSENT').length;
    const alertAbsentCount = session.registrations.filter((r) => r.status === 'ALERT_ABSENT').length;
    const unknownCount = session.registrations.filter((r) => r.status === 'UNKNOWN').length;
    const totalWarnings = session.registrations.reduce((acc, r) => acc + (r.warningCount || 0), 0);

    const data = {
      ...session,
      templateName: session.template?.name || null,
      campaignName: session.campaign?.name || null,
      targetAps,
      stats: {
        totalRegistered: session.registrations.length,
        presentCount,
        temporaryAbsentCount,
        alertAbsentCount,
        unknownCount,
        unregisteredCount: session.unregisteredClients.length,
        totalWarnings,
        syncHealth: 'healthy',
      },
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[api/attendance/sessions/[id] GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const updated = await prisma.$transaction(async tx => {
      await lockAttendanceSession(tx, params.id);
      const current = await tx.attendanceSession.findUnique({ where: { id: params.id }, include: { registrations: { include: { intervals: { where: { leftAt: null } } } } } });
      if (!current) throw new AttendanceInputError('Không tìm thấy buổi điểm danh.', 404);
      const data = validateSessionInput(body, current);
      await lockAttendanceSchedules(tx, [current, data]);
      await validateSessionRelations(tx, data, current);
      const now = new Date();
      if (data.status === 'ENDED' && current.status !== 'ENDED') {
        for (const registration of current.registrations) for (const interval of registration.intervals) {
          await tx.attendanceInterval.update({ where: { id: interval.id }, data: { leftAt: now, durationSeconds: Math.max(0, Math.floor((now.getTime() - interval.joinedAt.getTime()) / 1000)) } });
        }
        await tx.attendanceLog.create({ data: { sessionId: current.id, type: 'SESSION_END', message: 'Buổi họp đã kết thúc và chốt dữ liệu báo cáo.', createdAt: now } });
      } else if (data.status === 'ACTIVE' && current.status !== 'ACTIVE') {
        await tx.attendanceLog.create({ data: { sessionId: current.id, type: 'SESSION_START', message: 'Buổi họp được kích hoạt chế độ giám sát trực tiếp.', createdAt: now } });
      }
      return tx.attendanceSession.update({ where: { id: current.id }, data: { ...data, ...(data.status === 'ENDED' && current.status !== 'ENDED' ? { endedAt: now } : {}) } });
    }, { isolationLevel: 'ReadCommitted' });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AttendanceInputError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error('[api/attendance/sessions/[id] PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Không thể lưu buổi điểm danh. Vui lòng thử lại.' }, { status: 500 });
  }
}

async function handleDELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = params;
    await prisma.attendanceSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/attendance/sessions/[id] DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể xóa buổi điểm danh.' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);

export const PATCH = withPermission('operate', handlePATCH);

export const DELETE = withPermission('operate', handleDELETE);
