import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission,AccessError } from '@/lib/api-access';
import { publicConnection } from '@/lib/network/connections';
export const dynamic='force-dynamic';
export const GET=withPermission('admin',async()=>{
 const rows=await prisma.networkConnection.findMany({orderBy:{name:'asc'}});
 return NextResponse.json({success:true,data:{connections:rows.map(publicConnection),monitoring:{configured:Boolean(process.env.ZABBIX_API_URL&&process.env.ZABBIX_API_TOKEN),endpoint:process.env.ZABBIX_API_URL||null,collectorIntervalSeconds:30},encryptionConfigured:/^[a-f\d]{64}$/i.test(process.env.NETWORK_CREDENTIALS_KEY||'')}});
});
export const POST=withPermission('admin',async()=>{throw new AccessError(400,'Lưu cấu hình thiết bị tại /api/network/connections.');});
