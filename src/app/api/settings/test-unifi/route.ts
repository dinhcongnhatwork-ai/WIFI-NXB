import { NextRequest, NextResponse } from 'next/server';
import { UnifiClient } from '@/lib/unifi';
import { getUnifiConfig } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const current = await getUnifiConfig();

    const controllerUrl = (body.controllerUrl || current.controllerUrl || '').trim();
    const username = (body.username || current.username || '').trim();
    const password = body.password ? String(body.password).trim() : current.password;
    const site = (body.site || current.site || 'default').trim();

    if (!controllerUrl || !username) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đầy đủ Controller URL và Username' },
        { status: 400 }
      );
    }

    const client = new UnifiClient({
      controllerUrl,
      username,
      password,
      site,
      rejectUnauthorized: false,
    });

    await client.login();
    const [sites, devices] = await Promise.all([
      client.getSites().catch(() => []),
      client.getDevices().catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Kết nối UniFi Controller thành công!',
      details: {
        site,
        availableSitesCount: sites.length,
        devicesCount: devices.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể kết nối đến UniFi Controller',
      },
      { status: 500 }
    );
  }
}
