import { withPermission } from '@/lib/api-access';
import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { detectDeviceVendor } from '@/lib/attendance/constants';
import { broadcastSessionUpdate } from '@/lib/attendance/monitor';
import { lockAttendanceSession } from '@/lib/attendance/locking';
import { AttendanceInputError } from '@/lib/attendance/session-validation';
import { normalizedMac } from '@/lib/attendance/observations';
export const dynamic='force-dynamic';
async function handleGET(req:NextRequest,{params}:{params:{id:string}}){
  const registrations=await prisma.attendanceRegistration.findMany({where:{sessionId:params.id},orderBy:{createdAt:'desc'},include:{intervals:{orderBy:{joinedAt:'desc'}},deviceHistories:{orderBy:{createdAt:'desc'}}}});
  return NextResponse.json({success:true,data:registrations});
}
async function handlePATCH(req:NextRequest,{params}:{params:{id:string}}){
  try{
    const body=await req.json();
    if(typeof body.registrationId!=='string' || !body.registrationId)throw new AttendanceInputError('Thiếu mã người tham dự.');
    if(body.displayName!==undefined && (typeof body.displayName!=='string' || !body.displayName.trim() || body.displayName.length>200))throw new AttendanceInputError('Họ tên không được để trống và tối đa 200 ký tự.');
    const newMac=body.newMac===undefined?null:normalizedMac(body.newMac);
    if(newMac!==null && !/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(newMac))throw new AttendanceInputError('MAC phải có định dạng aa:bb:cc:dd:ee:ff.');
    if(body.formAnswers!==undefined && (!body.formAnswers || typeof body.formAnswers!=='object' || Array.isArray(body.formAnswers)))throw new AttendanceInputError('Thông tin biểu mẫu không hợp lệ.');
    const actor=authenticateRequest(req);
    const updated=await prisma.$transaction(async tx=>{
      await lockAttendanceSession(tx,params.id);
      const session=await tx.attendanceSession.findUnique({where:{id:params.id}});
      if(!session)throw new AttendanceInputError('Không tìm thấy buổi họp.',404);
      const reg=await tx.attendanceRegistration.findFirst({where:{id:body.registrationId,sessionId:params.id}});
      if(!reg)throw new AttendanceInputError('Không tìm thấy đại biểu.',404);
      const data:any={};const now=new Date();
      if(body.displayName!==undefined){data.displayName=body.displayName.trim();data.formAnswers={...(reg.formAnswers as Record<string,unknown> || {}),[session.nameFieldKey || 'fullname']:data.displayName};}
      if(body.formAnswers!==undefined)data.formAnswers={...body.formAnswers,...(data.displayName?{[session.nameFieldKey || 'fullname']:data.displayName}:{})};
      if(newMac && newMac!==normalizedMac(reg.primaryMac)){
        if(session.status==='ENDED')throw new AttendanceInputError('Buổi họp đã kết thúc, không thể đổi thiết bị.',409);
        if(typeof body.reason!=='string' || !body.reason.trim())throw new AttendanceInputError('Vui lòng nhập lý do đổi thiết bị.');
        if(await tx.attendanceRegistration.findFirst({where:{sessionId:params.id,primaryMac:newMac,NOT:{id:reg.id}}}))throw new AttendanceInputError('MAC này đã thuộc đại biểu khác trong buổi họp.',409);
        Object.assign(data,{primaryMac:newMac,deviceVendor:detectDeviceVendor(newMac),status:'UNKNOWN',currentApMac:null,currentRssi:null,lastSeenAt:null,absentStartedAt:null,consecutiveMissCount:0});
        const intervals=await tx.attendanceInterval.findMany({where:{registrationId:reg.id,leftAt:null}});
        for(const interval of intervals)await tx.attendanceInterval.update({where:{id:interval.id},data:{leftAt:now,durationSeconds:Math.max(0,Math.floor((now.getTime()-interval.joinedAt.getTime())/1000))}});
        await tx.attendanceInterval.create({data:{registrationId:reg.id,joinedAt:now,status:'UNKNOWN'}});
        const performedBy=String(actor?.username || actor?.id || 'Quản trị');
        await tx.attendanceDeviceHistory.create({data:{registrationId:reg.id,oldMac:reg.primaryMac,newMac,reason:body.reason.trim(),performedBy,createdAt:now}});
        await tx.attendanceLog.create({data:{sessionId:params.id,registrationId:reg.id,type:'DEVICE_CHANGE',message:`Đã đổi thiết bị cho ${reg.displayName}; chờ Controller xác nhận kết nối mới.`,details:{oldMac:reg.primaryMac,newMac,reason:body.reason.trim(),performedBy},createdAt:now}});
      }
      if(data.displayName && data.displayName!==reg.displayName)await tx.attendanceLog.create({data:{sessionId:params.id,registrationId:reg.id,type:'SYSTEM_SYNC',message:`Đã hiệu chỉnh họ tên đại biểu từ ${reg.displayName} thành ${data.displayName}.`,details:{performedBy:String(actor?.username || actor?.id || 'Quản trị')},createdAt:now}});
      return tx.attendanceRegistration.update({where:{id:reg.id},data});
    });
    await broadcastSessionUpdate(params.id,{type:'REGISTRATION_UPDATED',registrationId:updated.id});
    return NextResponse.json({success:true,data:updated});
  }catch(error){
    if(error instanceof AttendanceInputError)return NextResponse.json({success:false,error:error.message},{status:error.status});
    console.error('[attendance registration]',error);
    return NextResponse.json({success:false,error:'Không cập nhật được đại biểu.'},{status:500});
  }
}
export const GET=withPermission('read',handleGET);
export const PATCH=withPermission('operate',handlePATCH);
