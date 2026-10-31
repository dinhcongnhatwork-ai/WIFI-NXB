import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lockAttendanceSchedules, lockAttendanceSession } from '@/lib/attendance/locking';
import { attendanceSessionView } from '@/lib/attendance/session-view';
import { broadcastSessionUpdate } from '@/lib/attendance/monitor';
import { attendanceDurations } from '@/lib/attendance/observations';
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

    const data = await attendanceSessionView(id);
    if (!data) return NextResponse.json({success:false,error:'Không tìm thấy buổi điểm danh.'},{status:404});

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
      const current = await tx.attendanceSession.findUnique({ where: { id: params.id }, include: { registrations: { include: { intervals: true } } } });
      if (!current) throw new AttendanceInputError('Không tìm thấy buổi điểm danh.', 404);
      const data = validateSessionInput(body, current);
      if(current.status==='ENDED'){
        const baseline=validateSessionInput({},current);
        for(const key of ['ssid','unifiSite','targetApMacs','templateId','campaignId','startTime','endTime','warningThresholdMinutes','formSchema','nameFieldKey','idFieldKey'] as const){
          if(JSON.stringify(data[key])!==JSON.stringify(baseline[key]))throw new AttendanceInputError('Buổi họp đã chốt: chỉ sửa thông tin mô tả, giữ nguyên mạng, lịch và cấu hình điểm danh.',409);
        }
      }
      await lockAttendanceSchedules(tx, [current, data]);
      await validateSessionRelations(tx, data, current);
      const now = new Date();
      const closingTime=new Date(Math.min(now.getTime(),current.endTime.getTime()));
      if (data.status === 'ENDED' && current.status !== 'ENDED') {
        for (const registration of current.registrations) {
          const intervals = [...registration.intervals];
          for (const interval of registration.intervals.filter(i => !i.leftAt)) {
            const closed = await tx.attendanceInterval.update({where:{id:interval.id},data:{leftAt:new Date(Math.max(closingTime.getTime(),interval.joinedAt.getTime())),durationSeconds:Math.max(0,Math.floor((closingTime.getTime()-interval.joinedAt.getTime())/1000))}});
            intervals[intervals.indexOf(interval)] = closed;
          }
          await tx.attendanceRegistration.update({where:{id:registration.id},data:attendanceDurations(intervals,registration.firstSeenAt,closingTime)});
        }
        await tx.attendanceLog.create({ data: { sessionId: current.id, type: 'SESSION_END', message: 'Buổi họp đã kết thúc và chốt dữ liệu báo cáo.', createdAt: now } });
      } else if (data.status === 'ACTIVE' && current.status !== 'ACTIVE') {
        await tx.attendanceLog.create({ data: { sessionId: current.id, type: 'SESSION_START', message: 'Buổi họp được kích hoạt chế độ giám sát trực tiếp.', createdAt: now } });
      }
      return tx.attendanceSession.update({ where: { id: current.id }, data: { ...data, ...(data.status === 'ENDED' && current.status !== 'ENDED' ? { endedAt: closingTime } : {}) } });
    }, { isolationLevel: 'ReadCommitted',timeout:30000 });
    await broadcastSessionUpdate(params.id,{type:'SESSION_UPDATED'});
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
    await prisma.$transaction(async tx => {
      await lockAttendanceSession(tx,id);
      const session=await tx.attendanceSession.findUnique({where:{id}});
      if(!session)throw new AttendanceInputError('Không tìm thấy buổi điểm danh.',404);
      if(session.status==='ACTIVE')throw new AttendanceInputError('Hãy kết thúc buổi họp trước khi xóa.',409);
      await tx.attendanceSession.delete({where:{id}});
    });
    await broadcastSessionUpdate(id,{type:'SESSION_DELETED'});

    return NextResponse.json({ success: true });
  } catch (error) {
    if(error instanceof AttendanceInputError)return NextResponse.json({success:false,error:error.message},{status:error.status});
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
