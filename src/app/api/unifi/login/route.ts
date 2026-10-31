import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-access';
import { getUnifiClientFromRequest } from '@/lib/settings';
export const dynamic='force-dynamic';
export const POST=withPermission('read',async(req:NextRequest)=>{const client=await getUnifiClientFromRequest(req);await client.login();return NextResponse.json({success:true,data:{connected:true,site:client.getCurrentSite()}});});
