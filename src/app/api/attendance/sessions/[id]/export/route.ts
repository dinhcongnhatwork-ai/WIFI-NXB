import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAttendanceExcelWorkbook } from '@/lib/attendance/excel';

export const dynamic = 'force-dynamic';

async function handleGET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        campaign: { select: { name: true } },
        registrations: {
          orderBy: { createdAt: 'asc' },
          include: {
            intervals: {
              orderBy: { joinedAt: 'asc' },
            },
            deviceHistories: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy buổi điểm danh.' },
        { status: 404 }
      );
    }

    // Flatten all intervals with attendee identity
    const flatIntervals: any[] = [];
    const flatDeviceHistories: any[] = [];

    session.registrations.forEach((reg) => {
      reg.intervals.forEach((interval) => {
        flatIntervals.push({
          id: interval.id,
          registrationId: reg.id,
          registrationName: reg.displayName,
          identityValue: reg.identityValue,
          apMac: interval.apMac,
          joinedAt: interval.joinedAt.toISOString(),
          leftAt: interval.leftAt?.toISOString() || null,
          durationSeconds: interval.durationSeconds,
          status: interval.status as any,
        });
      });

      reg.deviceHistories.forEach((dh) => {
        flatDeviceHistories.push({
          id: dh.id,
          registrationId: reg.id,
          registrationName: reg.displayName,
          identityValue: reg.identityValue,
          oldMac: dh.oldMac,
          newMac: dh.newMac,
          reason: dh.reason,
          performedBy: dh.performedBy,
          createdAt: dh.createdAt.toISOString(),
        });
      });
    });

    // Map session logs
    const logDtos = session.logs.map((l) => {
      const reg = session.registrations.find((r) => r.id === l.registrationId);
      return {
        id: l.id,
        sessionId: session.id,
        registrationId: l.registrationId,
        registrationName: reg?.displayName || null,
        type: l.type as any,
        message: l.message,
        details: l.details as any,
        createdAt: l.createdAt.toISOString(),
      };
    });

    const sessionDto = {
      id: session.id,
      name: session.name,
      location: session.location,
      campaignId: session.campaignId,
      campaignName: session.campaign?.name,
      unifiSite: session.unifiSite,
      ssid: session.ssid,
      wlanConfId: session.wlanConfId,
      targetApMacs: (session.targetApMacs as string[]) || [],
      formSchema: (session.formSchema as any) || [],
      nameFieldKey: session.nameFieldKey,
      idFieldKey: session.idFieldKey,
      dialogTitle: session.dialogTitle || 'Điểm danh cuộc họp',
      dialogDescription: session.dialogDescription,
      confirmButtonText: session.confirmButtonText || 'Xác nhận điểm danh và kết nối',
      successMessage: session.successMessage || 'Điểm danh thành công! Đang cấp quyền truy cập Internet...',
      warningThresholdMinutes: session.warningThresholdMinutes,
      status: session.status as any,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      endedAt: session.endedAt?.toISOString() || null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };

    const registrationDtos = session.registrations.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      identityValue: r.identityValue,
      displayName: r.displayName,
      formAnswers: (r.formAnswers as any) || {},
      primaryMac: r.primaryMac,
      primaryIp: r.primaryIp,
      deviceVendor: r.deviceVendor,
      deviceOs: r.deviceOs,
      firstSeenAt: r.firstSeenAt?.toISOString() || null,
      lastSeenAt: r.lastSeenAt?.toISOString() || null,
      currentApMac: r.currentApMac,
      currentRssi: r.currentRssi,
      status: r.status as any,
      totalPresentSeconds: r.totalPresentSeconds,
      totalAbsentSeconds: r.totalAbsentSeconds,
      totalUnknownSeconds: r.totalUnknownSeconds,
      warningCount: r.warningCount,
      absentStartedAt: r.absentStartedAt?.toISOString() || null,
      consecutiveMissCount: r.consecutiveMissCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    const excelBuffer = await generateAttendanceExcelWorkbook({
      session: sessionDto,
      registrations: registrationDtos,
      intervals: flatIntervals,
      logs: logDtos,
      deviceHistories: flatDeviceHistories,
      isDraftOrActive: session.status !== 'ENDED',
    });

    const cleanFilename = session.name
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')
      .slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `BaoCao_DiemDanh_${cleanFilename}_${dateStr}.xlsx`;

    return new Response(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[api/attendance/sessions/[id]/export GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi tạo file Excel.' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
