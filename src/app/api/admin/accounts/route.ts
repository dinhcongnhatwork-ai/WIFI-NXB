import { NextRequest,NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withPermission,getIdentity,AccessError } from '@/lib/api-access';
import { validateAccountChange } from '@/lib/accounts';
export const dynamic='force-dynamic';
const select={id:true,username:true,role:true,disabled:true,createdAt:true};
export const GET=withPermission('admin',async()=>NextResponse.json({success:true,data:await prisma.admin.findMany({select,orderBy:{username:'asc'}})}));
export const POST=withPermission('admin',async(req:NextRequest)=>{
 const input=await req.json();const actor=await getIdentity(req);
 const password=input.password?await bcrypt.hash(String(input.password),12):undefined;
 try{
 const saved=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-accounts'))`;
  const current=input.id?await tx.admin.findUnique({where:{id:input.id}}):null;
  if(input.id&&!current)throw new AccessError(404,'Tài khoản không tồn tại.');
  const activeAdmins=await tx.admin.count({where:{role:'ADMIN',disabled:false}});validateAccountChange(input,current,activeAdmins);
  const data={username:input.username,role:input.role,disabled:input.disabled===true,...(password?{password}:{})};
  const account=current?await tx.admin.update({where:{id:current.id},data,select}):await tx.admin.create({data:{...data,password:password!},select});
  await tx.auditLog.create({data:{actorId:actor.id,actorName:actor.username,action:current?'account.update':'account.create',before:current?{id:current.id,username:current.username,role:current.role,disabled:current.disabled}:undefined,after:account as any,status:'verified'}});
  return account;
 });return NextResponse.json({success:true,data:saved});
 }catch(error){if((error as {code?:string}).code==='P2002')throw new AccessError(409,'Tên đăng nhập đã tồn tại.');throw error;}
});
