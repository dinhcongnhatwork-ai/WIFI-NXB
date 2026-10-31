import { prisma } from '@/lib/prisma';
import { readAttendanceSync } from './sync-health';
import { isAttendanceTemplateReady } from './runtime';
export async function attendanceSessionView(id:string) {
  const session=await prisma.attendanceSession.findUnique({where:{id},include:{
    template:{select:{id:true,name:true,publishedRevisionId:true,publishedRevision:{select:{layoutJson:true}}}},
    campaign:{select:{id:true,name:true,ssid:true,template:{select:{id:true,name:true,publishedRevisionId:true,publishedRevision:{select:{layoutJson:true}}}}}},
    registrations:{orderBy:{createdAt:'desc'},include:{intervals:{orderBy:{joinedAt:'desc'},take:20},deviceHistories:{orderBy:{createdAt:'desc'},take:10}}},
    logs:{orderBy:{createdAt:'desc'},take:100},unregisteredClients:{orderBy:{lastSeenAt:'desc'},take:100},
  }});
  if(!session)return null;
  const sync=await readAttendanceSync(id,session.status==='ACTIVE');
  const template=session.template || session.campaign?.template;
  const {targetAps,...syncStats}=sync;
  const {template:unusedTemplate,campaign:unusedCampaign,...rest}=session;
  return {...rest,templateName:template?.name || null,effectiveTemplateId:template?.id || null,campaignName:session.campaign?.name || null,
    templateReadiness:{published:!!template?.publishedRevisionId,attendanceReady:!!template?.publishedRevision && isAttendanceTemplateReady(template.publishedRevision.layoutJson)},targetAps,
    stats:{totalRegistered:session.registrations.length,presentCount:session.registrations.filter(r=>r.status==='PRESENT').length,temporaryAbsentCount:session.registrations.filter(r=>r.status==='TEMPORARY_ABSENT').length,alertAbsentCount:session.registrations.filter(r=>r.status==='ALERT_ABSENT').length,unknownCount:session.registrations.filter(r=>r.status==='UNKNOWN').length,unregisteredCount:session.unregisteredClients.length,totalWarnings:session.registrations.reduce((sum,r)=>sum+r.warningCount,0),...syncStats},
  };
}
