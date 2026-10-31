import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
    const data = await client.getOverview();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải dữ liệu MikroTik overview',
      },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
