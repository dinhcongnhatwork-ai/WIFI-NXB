import { NextRequest, NextResponse } from 'next/server';
import { getUnifiClientFromRequest } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'sites';

    let data: unknown;

    switch (type) {
      case 'sites':
        data = await client.getSites();
        break;
      case 'controller':
        data = await client.getControllerInfo();
        break;
      case 'health':
        data = await client.getHealth();
        break;
      case 'stats':
        data = await client.getDashboardStats();
        break;
      case 'alerts':
        const archived = searchParams.get('archived');
        data = await client.getAlerts(archived === 'true');
        break;
      case 'events':
        const limit = parseInt(searchParams.get('limit') || '50');
        data = await client.getEvents(limit);
        break;
      case 'speedtest':
        data = await client.getSpeedtestResults();
        break;
      default:
        data = null;
    }

    await client.logout().catch(() => {});

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unifi misc error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
