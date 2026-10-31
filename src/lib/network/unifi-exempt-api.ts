import {Prisma} from '@prisma/client';
import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getIdentity} from '@/lib/api-access';
import {resolveConnection} from './connections';
import {configuredHotspotSites} from './campaign-hotspot';
import {CampaignHotspotError} from './campaign-hotspot-policy';
import {sessionKey,withGuestLease} from './campaign-sessions';
import {canonicalDeviceMac,DeviceExemption,deviceInput,exemptionKey,parseExemption,validateDeviceBatch} from './unifi-exempt-policy';
import {listDeviceExemptions} from './unifi-exempt-store';
export function exemptError(error:unknown){
 const status=error&&typeof error==='object'&&'status'in error&&typeof error.status==='number'?error.status:500;
 return NextResponse.json({success:false,error:status<500&&error instanceof Error?error.message:'Không thể cập nhật danh sách miễn xác thực. Vui lòng thử lại.'},{status,headers:{'Cache-Control':'no-store'}});
}
async function requestScope(req:NextRequest){
 const connection=await resolveConnection('UNIFI',req);const sites=configuredHotspotSites(connection);const site=req.nextUrl.searchParams.get('siteId')||sites[0];
 if(!connection.isDefault||!sites.includes(site))throw new CampaignHotspotError('Chỉ hỗ trợ controller/site đang quản lý portal.',400);
 return {connectionId:connection.id,site};
}
export async function listApprovedDevices(req:NextRequest){const scope=await requestScope(req);return NextResponse.json({success:true,data:await listDeviceExemptions(scope)},{headers:{'Cache-Control':'no-store'}});}
export async function createApprovedDevices(req:NextRequest){
 const scope=await requestScope(req);const body=await req.json().catch(()=>null);const devices=validateDeviceBatch(body?.devices);const actor=await getIdentity(req);
 const ordered=devices.slice().sort((a,b)=>a.mac.localeCompare(b.mac));
 // Same per-MAC lease as grants and revocation, acquired in a consistent order.
 const checks:Array<()=>Promise<void>>=[];
 const locked=async(index:number):Promise<DeviceExemption[]>=>{
  if(index<ordered.length)return withGuestLease(sessionKey({...scope,mac:ordered[index].mac}),async check=>{checks.push(check);return locked(index+1);});
  return prisma.$transaction(async tx=>{
   const result:DeviceExemption[]=[];
   for(const device of devices){
    await Promise.all(checks.map(check=>check()));const key=exemptionKey({...scope,mac:device.mac});
    if(await tx.systemSetting.findUnique({where:{key}}))throw new CampaignHotspotError(`MAC ${device.mac} đã có trong danh sách.`,409);
    const now=Date.now();const value:DeviceExemption={...scope,...device,version:1,approvedAt:device.enabled?now:null,approvedBy:device.enabled?actor.id:null,createdAt:now,updatedAt:now};
    const json=value as unknown as Prisma.InputJsonValue;
    await tx.systemSetting.upsert({where:{key},create:{key,value:json},update:{value:json}});
    await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.username,connectionId:scope.connectionId,action:'unifi.portal-exemption.create',deviceId:device.mac,after:json,status:'verified'}});result.push(value);
   }
   await Promise.all(checks.map(check=>check()));return result;
  },{timeout:30000});
 };
 return NextResponse.json({success:true,data:await locked(0)},{status:201});
}
export async function changeApprovedDevice(req:NextRequest,macInput:string,remove=false){
 const scope=await requestScope(req);const mac=canonicalDeviceMac(macInput);const key=exemptionKey({...scope,mac});const actor=await getIdentity(req);
 const input=remove?null:deviceInput(await req.json().catch(()=>null));if(input&&input.mac!==mac)throw new CampaignHotspotError('Không thể đổi MAC của bản ghi. Hãy thêm thiết bị mới.',400);
 const value=await withGuestLease(sessionKey({...scope,mac}),async check=>prisma.$transaction(async tx=>{
  const row=await tx.systemSetting.findUnique({where:{key}});if(!row)throw new CampaignHotspotError('Không tìm thấy thiết bị.',404);
  const before=parseExemption(key,row.value);const now=Date.now();
  const after:DeviceExemption|null=input?{...before,...input,approvedAt:input.enabled?now:null,approvedBy:input.enabled?actor.id:null,updatedAt:now}:null;
  await check();
  if(after){const json=after as unknown as Prisma.InputJsonValue;await tx.systemSetting.upsert({where:{key},create:{key,value:json},update:{value:json}});}else await tx.systemSetting.delete({where:{key}});
  await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.username,connectionId:scope.connectionId,action:remove?'unifi.portal-exemption.delete':'unifi.portal-exemption.update',deviceId:mac,before:before as unknown as Prisma.InputJsonValue,after:after?after as unknown as Prisma.InputJsonValue:Prisma.JsonNull,status:'verified'}});
  await check();return after;
 }));
 return NextResponse.json({success:true,data:value});
}
