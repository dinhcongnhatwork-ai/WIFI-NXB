import { withPermission } from '@/lib/api-access';
import { NextResponse } from 'next/server';
import { runAttendanceMonitorTick } from '@/lib/attendance/monitor';

export const dynamic = 'force-dynamic';

async function handlePOST() {
  try {
    const result = await runAttendanceMonitorTick();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[api/attendance/monitor/tick POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGET() { return NextResponse.json({success:false,error:'Sử dụng POST để chạy đồng bộ.'},{status:405,headers:{Allow:'POST'}}); }

export const POST = withPermission('operate', handlePOST);

export const GET = withPermission('operate', handleGET);
