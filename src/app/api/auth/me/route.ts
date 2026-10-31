import { NextResponse } from 'next/server';
import { getIdentity,withPermission } from '@/lib/api-access';
export const dynamic='force-dynamic';
export const GET=withPermission('read',async req=>NextResponse.json({success:true,data:await getIdentity(req)}));
