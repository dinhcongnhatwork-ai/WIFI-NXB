import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UnifiClient } from '@/lib/unifi';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
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
      const client = new UnifiClient();
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const current = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            intervals: {
              where: { leftAt: null },
            },
          },
        },
      },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy buổi điểm danh.' },
        { status: 404 }
      );
    }

    const now = new Date();
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.location !== undefined) updateData.location = body.location?.trim() || null;
    if (body.ssid !== undefined) updateData.ssid = body.ssid.trim();
    if (body.targetApMacs !== undefined) {
      updateData.targetApMacs = Array.isArray(body.targetApMacs)
        ? body.targetApMacs.map((m: string) => m.toLowerCase().trim())
        : [];
    }
    if (body.formSchema !== undefined) updateData.formSchema = body.formSchema;
    if (body.dialogTitle !== undefined) updateData.dialogTitle = body.dialogTitle.trim();
    if (body.dialogDescription !== undefined) updateData.dialogDescription = body.dialogDescription?.trim() || null;
    if (body.confirmButtonText !== undefined) updateData.confirmButtonText = body.confirmButtonText.trim();
    if (body.successMessage !== undefined) updateData.successMessage = body.successMessage.trim();
    if (body.warningThresholdMinutes !== undefined) {
      updateData.warningThresholdMinutes = Number(body.warningThresholdMinutes) || 15;
    }
    if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime);
    if (body.endTime !== undefined) updateData.endTime = new Date(body.endTime);

    // Status transition handling
    if (body.status && body.status !== current.status) {
      updateData.status = body.status;

      if (body.status === 'ENDED') {
        updateData.endedAt = now;

        // Close all open intervals
        for (const reg of current.registrations) {
          for (const openInt of reg.intervals) {
            const duration = Math.max(
              1,
              Math.floor((now.getTime() - new Date(openInt.joinedAt).getTime()) / 1000)
            );
            await prisma.attendanceInterval.update({
              where: { id: openInt.id },
              data: {
                leftAt: now,
                durationSeconds: duration,
              },
            });
          }
        }

        // Log session end
        await prisma.attendanceLog.create({
          data: {
            sessionId: id,
            type: 'SESSION_END',
            message: `Buổi họp đã kết thúc và chốt dữ liệu báo cáo lúc ${now.toLocaleTimeString('vi-VN')}.`,
            createdAt: now,
          },
        });
      } else if (body.status === 'ACTIVE') {
        await prisma.attendanceLog.create({
          data: {
            sessionId: id,
            type: 'SESSION_START',
            message: `Buổi họp được kích hoạt chế độ giám sát trực tiếp.`,
            createdAt: now,
          },
        });
      }
    }

    const updated = await prisma.attendanceSession.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[api/attendance/sessions/[id] PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
