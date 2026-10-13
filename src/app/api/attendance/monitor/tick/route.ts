import { NextResponse } from 'next/server';
import { runAttendanceMonitorTick } from '@/lib/attendance/monitor';

export const dynamic = 'force-dynamic';

export async function POST() {
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

export async function GET() {
  try {
    const result = await runAttendanceMonitorTick();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[api/attendance/monitor/tick GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
