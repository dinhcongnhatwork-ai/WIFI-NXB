import {Prisma} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getIdentity,withPermission} from '@/lib/api-access';
import {CampaignHotspotError} from '@/lib/network/campaign-hotspot-policy';
import {readSessionPolicy,sessionPolicyKey,validateSessionMinutes} from '@/lib/network/campaign-session-policy';
import {queueCampaignDisconnect} from '@/lib/network/campaign-session-management';
export const dynamic='force-dynamic';
type Context={params:{id:string}};
const fail=(error:unknown)=>NextResponse.json({success:false,error:error instanceof CampaignHotspotError?error.message:'Không thể cập nhật thời hạn phiên WiFi.'},{status:error instanceof CampaignHotspotError?error.status:500});
async function existing(id:string){if(!await prisma.campaign.findUnique({where:{id}}))throw new CampaignHotspotError('Không tìm thấy chiến dịch.',404);}
export const GET=withPermission('read',async(_req:NextRequest,{params}:Context)=>{
 try{const key=sessionPolicyKey(params.id);await existing(params.id);const row=await prisma.systemSetting.findUnique({where:{key}});return NextResponse.json({success:true,data:{sessionMinutes:readSessionPolicy(row?.value),minMinutes:1,maxMinutes:1440}},{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}
});
export const PUT=withPermission('operate',async(req:NextRequest,{params}:Context)=>{
 try{
  const body=await req.json().catch(()=>null);const minutes=validateSessionMinutes(body?.sessionMinutes);const key=sessionPolicyKey(params.id);await existing(params.id);const actor=await getIdentity(req);
  await prisma.$transaction(async tx=>{
   const before=await tx.systemSetting.findUnique({where:{key}});const value={version:1,sessionMinutes:minutes};
   await tx.systemSetting.upsert({where:{key},create:{key,value},update:{value}});
   await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.username,action:'campaign.session-policy.update',deviceId:params.id,before:(before?.value??Prisma.JsonNull) as Prisma.InputJsonValue,after:value,status:'verified'}});
  });
  return NextResponse.json({success:true,data:{sessionMinutes:minutes}});
 }catch(error){return fail(error);}
});
export const POST=withPermission('admin',async(req:NextRequest,{params}:Context)=>{
 let auditId:string|undefined;
 try{
  sessionPolicyKey(params.id);await existing(params.id);const actor=await getIdentity(req);
  // Persist operator intent before any per-device revocation is queued.
  const audit=await prisma.auditLog.create({data:{actorId:actor.id,actorName:actor.username,action:'campaign.sessions.disconnect',deviceId:params.id,status:'applying'}});auditId=audit?.id;
  const result=await queueCampaignDisconnect(params.id);
  if(auditId)await prisma.auditLog.update({where:{id:auditId},data:{status:'accepted',after:result}});
  return NextResponse.json({success:true,data:result},{status:202});
 }catch(error){if(auditId)await prisma.auditLog.update({where:{id:auditId},data:{status:'failed',error:'Không thể hoàn tất yêu cầu ngắt phiên chiến dịch.'}}).catch(()=>{});return fail(error);}
});
