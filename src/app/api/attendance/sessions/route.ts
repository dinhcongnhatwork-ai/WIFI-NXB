import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_FORM_FIELDS, DEFAULT_WARNING_THRESHOLD_MINUTES } from '@/lib/attendance/constants';
import { AttendanceSessionStatus } from '@/types/attendance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as AttendanceSessionStatus | null;
    const search = searchParams.get('search')?.trim();

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { ssid: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true, ssid: true } },
        _count: {
          select: {
            registrations: true,
            logs: true,
            unregisteredClients: true,
          },
        },
        registrations: {
          select: {
            status: true,
            warningCount: true,
          },
        },
      },
    });

    const data = sessions.map((s) => {
      const presentCount = s.registrations.filter((r) => r.status === 'PRESENT').length;
      const temporaryAbsentCount = s.registrations.filter((r) => r.status === 'TEMPORARY_ABSENT').length;
      const alertAbsentCount = s.registrations.filter((r) => r.status === 'ALERT_ABSENT').length;
      const unknownCount = s.registrations.filter((r) => r.status === 'UNKNOWN').length;
      const totalWarnings = s.registrations.reduce((acc, r) => acc + (r.warningCount || 0), 0);

      return {
        id: s.id,
        name: s.name,
        location: s.location,
        campaignId: s.campaignId,
        campaignName: s.campaign?.name,
        unifiSite: s.unifiSite,
        ssid: s.ssid,
        wlanConfId: s.wlanConfId,
        targetApMacs: s.targetApMacs,
        formSchema: s.formSchema,
        nameFieldKey: s.nameFieldKey,
        idFieldKey: s.idFieldKey,
        dialogTitle: s.dialogTitle,
        dialogDescription: s.dialogDescription,
        confirmButtonText: s.confirmButtonText,
        successMessage: s.successMessage,
        warningThresholdMinutes: s.warningThresholdMinutes,
        status: s.status,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        endedAt: s.endedAt?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        stats: {
          totalRegistered: s._count.registrations,
          presentCount,
          temporaryAbsentCount,
          alertAbsentCount,
          unknownCount,
          unregisteredCount: s._count.unregisteredClients,
          totalWarnings,
          syncHealth: s.status === 'ACTIVE' ? 'healthy' : 'healthy',
        },
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[api/attendance/sessions GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      location,
      campaignId,
      unifiSite = 'default',
      ssid,
      wlanConfId,
      targetApMacs = [],
      formSchema = DEFAULT_FORM_FIELDS,
      nameFieldKey = 'fullname',
      idFieldKey = 'employee_code',
      dialogTitle = 'Điểm danh cuộc họp',
      dialogDescription,
      confirmButtonText = 'Xác nhận điểm danh và kết nối',
      successMessage = 'Điểm danh thành công! Đang cấp quyền truy cập Internet...',
      warningThresholdMinutes = DEFAULT_WARNING_THRESHOLD_MINUTES,
      status = 'READY',
      startTime,
      endTime,
    } = body;

    if (!name || !ssid || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: tên, SSID, thời gian bắt đầu và kết thúc.' },
        { status: 400 }
      );
    }

    // Check conflict: Không cho hai buổi điểm danh trùng thời gian trên cùng SSID và nhóm AP giao nhau
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return NextResponse.json(
        { success: false, error: 'Thời gian bắt đầu phải trước thời gian kết thúc.' },
        { status: 400 }
      );
    }

    const normTargetAps = Array.isArray(targetApMacs)
      ? targetApMacs.map((m: string) => m.toLowerCase().trim())
      : [];

    const existingSessions = await prisma.attendanceSession.findMany({
      where: {
        ssid: ssid.trim(),
        status: { in: ['READY', 'ACTIVE'] },
        AND: [
          { startTime: { lte: end } },
          { endTime: { gte: start } },
        ],
      },
    });

    for (const ex of existingSessions) {
      const exAps = Array.isArray(ex.targetApMacs)
        ? (ex.targetApMacs as string[]).map((m) => m.toLowerCase().trim())
        : [];

      // Check overlap in target APs
      const hasOverlap =
        normTargetAps.length === 0 ||
        exAps.length === 0 ||
        normTargetAps.some((m) => exAps.includes(m));

      if (hasOverlap) {
        return NextResponse.json(
          {
            success: false,
            error: `Đã có buổi họp "${ex.name}" trùng khung giờ trên cùng SSID và nhóm AP. Vui lòng kiểm tra lại.`,
          },
          { status: 400 }
        );
      }
    }

    const newSession = await prisma.attendanceSession.create({
      data: {
        name: name.trim(),
        location: location?.trim() || null,
        campaignId: campaignId || null,
        unifiSite: unifiSite.trim(),
        ssid: ssid.trim(),
        wlanConfId: wlanConfId || null,
        targetApMacs: normTargetAps,
        formSchema,
        nameFieldKey,
        idFieldKey,
        dialogTitle: dialogTitle.trim(),
        dialogDescription: dialogDescription?.trim() || null,
        confirmButtonText: confirmButtonText.trim(),
        successMessage: successMessage.trim(),
        warningThresholdMinutes: Number(warningThresholdMinutes) || DEFAULT_WARNING_THRESHOLD_MINUTES,
        status,
        startTime: start,
        endTime: end,
      },
    });

    // Write initial log
    await prisma.attendanceLog.create({
      data: {
        sessionId: newSession.id,
        type: 'SESSION_START',
        message: `Khởi tạo buổi điểm danh họp "${newSession.name}" (SSID: ${newSession.ssid}, ${normTargetAps.length} AP).`,
        details: { status: newSession.status },
      },
    });

    return NextResponse.json({ success: true, data: newSession });
  } catch (error) {
    console.error('[api/attendance/sessions POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
