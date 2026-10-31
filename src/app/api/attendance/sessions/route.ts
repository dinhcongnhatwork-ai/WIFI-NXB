import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { AttendanceInputError, validateSessionInput, validateSessionRelations } from '@/lib/attendance/session-validation';
import { lockAttendanceSchedules } from '@/lib/attendance/locking';
import { attendanceListQuery } from '@/lib/attendance/list-query';
import { readAttendanceSync } from '@/lib/attendance/sync-health';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const {where,page,limit,skip} = attendanceListQuery(req.nextUrl.searchParams);
    const total = await prisma.attendanceSession.count({where});
    const sessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: [{ startTime: 'desc' },{id:'desc'}],skip,take:limit,
      include: {
        template: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true, ssid: true,template:{select:{id:true,name:true}} } },
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

    const data = await Promise.all(sessions.map(async (s) => {
      const {targetAps,...sync}=await readAttendanceSync(s.id,s.status==='ACTIVE');
      const presentCount = s.registrations.filter((r) => r.status === 'PRESENT').length;
      const temporaryAbsentCount = s.registrations.filter((r) => r.status === 'TEMPORARY_ABSENT').length;
      const alertAbsentCount = s.registrations.filter((r) => r.status === 'ALERT_ABSENT').length;
      const unknownCount = s.registrations.filter((r) => r.status === 'UNKNOWN').length;
      const totalWarnings = s.registrations.reduce((acc, r) => acc + (r.warningCount || 0), 0);

      return {
        id: s.id,
        name: s.name,
        location: s.location,
        templateId: s.templateId,
        templateName: s.template?.name || s.campaign?.template?.name || null,
        effectiveTemplateId:s.templateId || s.campaign?.template?.id || null,
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
          ...sync,
        },
      };
    }));

    return NextResponse.json({ success: true, data,meta:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))} });
  } catch (error) {
    if(error instanceof AttendanceInputError)return NextResponse.json({success:false,error:error.message},{status:error.status});
    console.error('[api/attendance/sessions GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const data = validateSessionInput(body);
    const session = await prisma.$transaction(async tx => {
      await lockAttendanceSchedules(tx, [data]);
      await validateSessionRelations(tx, data);
      const created = await tx.attendanceSession.create({ data });
      await tx.attendanceLog.create({ data: { sessionId: created.id, type: 'SESSION_START', message: `Khởi tạo buổi điểm danh "${created.name}".`, details: { status: created.status } } });
      return created;
    }, { isolationLevel: 'ReadCommitted' });
    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    if (error instanceof AttendanceInputError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error('[api/attendance/sessions POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Không thể lưu buổi điểm danh. Vui lòng thử lại.' }, { status: 500 });
  }
}

export const GET = withPermission('read', handleGET);

export const POST = withPermission('operate', handlePOST);
