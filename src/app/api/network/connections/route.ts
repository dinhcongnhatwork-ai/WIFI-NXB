import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission, getIdentity, AccessError } from '@/lib/api-access';
import { importLegacyConnection, publicConnection, saveConnection } from '@/lib/network/connections';
export const dynamic='force-dynamic';
export const GET=withPermission('read',async(req:NextRequest)=>{
  const provider=req.nextUrl.searchParams.get('provider');
  if(provider&&!['UNIFI','MIKROTIK'].includes(provider))throw new AccessError(400,'Nhà cung cấp không hợp lệ.');
  const warnings:string[]=[];
  if(process.env.NETWORK_CREDENTIALS_KEY)for(const p of ['UNIFI','MIKROTIK'] as const){if(!provider||p===provider)try{await importLegacyConnection(p);}catch{warnings.push(`Chưa nhập được cấu hình ${p}. Kiểm tra khóa mã hóa và cấu hình cũ.`);}}
  const rows=await prisma.networkConnection.findMany({where:provider?{provider}:{},orderBy:[{provider:'asc'},{name:'asc'}]});
  return NextResponse.json({success:true,data:rows.map(publicConnection),warnings,encryptionConfigured:/^[a-f\d]{64}$/i.test(process.env.NETWORK_CREDENTIALS_KEY||'')});
});
export const POST=withPermission('admin',async(req:NextRequest)=>{
  const row=await saveConnection(await req.json(),await getIdentity(req));
  return NextResponse.json({success:true,data:publicConnection(row)});
});
