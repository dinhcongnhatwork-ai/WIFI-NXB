import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-access';
import { prisma } from '@/lib/prisma';
import { isAttendanceTemplateReady } from '@/lib/attendance/runtime';
export const dynamic='force-dynamic';
export const GET=withPermission('read',async()=>{
  const templates=await prisma.template.findMany({orderBy:{name:'asc'},select:{id:true,name:true,thumbnail:true,publishedRevisionId:true,publishedRevision:{select:{layoutJson:true}}}});
  return NextResponse.json({success:true,data:templates.map(({publishedRevision,...template})=>({...template,attendanceReady:!!publishedRevision && isAttendanceTemplateReady(publishedRevision.layoutJson)}))});
});
