import { NextRequest, NextResponse } from 'next/server';
import { getUnifiClientFromRequest } from '@/lib/settings';
import { UnifiWlanConf } from '@/types/unifi';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const searchParams = req.nextUrl.searchParams;
    const wlanConfId = searchParams.get('id');

    if (wlanConfId) {
      const ssid = await client.getSsidById(wlanConfId);
      return NextResponse.json({ success: true, data: ssid });
    }

    const ssids = await client.getWlanConfs();
    return NextResponse.json({ success: true, data: ssids });
  } catch (error) {
    console.error('Unifi ssids error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch SSIDs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const body = await req.json();
    const { action, id, ...data } = body;

    let result: boolean | UnifiWlanConf | null = null;

    switch (action) {
      case 'create':
        result = await client.createSsid(data);
        break;
      case 'update':
        if (id) {
          result = await client.updateSsid(id, data);
        }
        break;
      case 'delete':
        if (id) {
          result = await client.deleteSsid(id);
        }
        break;
      case 'enable':
        if (id) {
          result = await client.enableSsid(id);
        }
        break;
      case 'disable':
        if (id) {
          result = await client.disableSsid(id);
        }
        break;
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    if (result === null) {
      return NextResponse.json({ success: false, error: 'Action failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Unifi ssid action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}
