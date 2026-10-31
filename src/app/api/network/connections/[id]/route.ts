import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission,getIdentity,AccessError } from '@/lib/api-access';
import { publicConnection } from '@/lib/network/connections';
export const DELETE=withPermission('admin',async(req:NextRequest,{params}:{params:{id:string}})=>{
 const actor=await getIdentity(req);
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('network-connections'))`;
  const row=await tx.networkConnection.findUnique({where:{id:params.id}});if(!row)throw new AccessError(404,'Kết nối không tồn tại.');
  const migrationKey=`networkImport:${row.provider}`;
  await tx.systemSetting.upsert({where:{key:migrationKey},create:{key:migrationKey,value:{completed:true,connectionId:row.id,deleted:true}},update:{value:{completed:true,connectionId:row.id,deleted:true}}});
  await tx.networkConnection.delete({where:{id:row.id}});
  if(row.isDefault){const next=await tx.networkConnection.findFirst({where:{provider:row.provider},orderBy:{createdAt:'asc'}});if(next)await tx.networkConnection.update({where:{id:next.id},data:{isDefault:true}});}
  await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.username,action:'connection.delete',connectionId:row.id,before:publicConnection(row) as any,status:'verified'}});
 });
 return NextResponse.json({success:true});
});
