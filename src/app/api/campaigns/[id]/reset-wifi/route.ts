import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getIdentity,withPermission} from '@/lib/api-access';
import {resetCampaignWifi} from '@/lib/network/campaign-session-management';
import {CampaignHotspotError} from '@/lib/network/campaign-hotspot-policy';
export const dynamic='force-dynamic';
export const POST=withPermission('admin',async(req:NextRequest,{params}:{params:{id:string}})=>{
 let auditId:string|undefined;
 try{
  const actor=await getIdentity(req);const audit=await prisma.auditLog.create({data:{actorId:actor.id,actorName:actor.username,deviceId:params.id,action:'campaign.wifi.reset',status:'applying'}});auditId=audit.id;
  const result=await resetCampaignWifi(params.id);const pending=result.waiting+result.skipped+result.failed;
  await prisma.auditLog.update({where:{id:auditId},data:{status:pending?'accepted':'verified',after:result}});
  return NextResponse.json({success:true,data:result},{status:pending?202:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){if(auditId)await prisma.auditLog.update({where:{id:auditId},data:{status:'failed',error:'Không thể hoàn tất Reset WiFi.'}}).catch(()=>{});return NextResponse.json({success:false,error:error instanceof CampaignHotspotError?error.message:'Không thể hoàn tất Reset WiFi. Vui lòng bấm Reset lại; các phiên đã lưu ý định thu hồi vẫn được thử lại.'},{status:error instanceof CampaignHotspotError?error.status:500});}
});
