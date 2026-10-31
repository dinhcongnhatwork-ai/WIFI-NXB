import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api-access';
import { getUnifiClientFromRequest } from '@/lib/settings';
export const dynamic='force-dynamic';
export const POST=withPermission('operate',async(req:NextRequest)=>{const client=await getUnifiClientFromRequest(req);await client.logout();return NextResponse.json({success:true});});
