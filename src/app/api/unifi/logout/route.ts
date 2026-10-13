import { NextRequest, NextResponse } from 'next/server';
import { UnifiClient } from '@/lib/unifi';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { controllerUrl, username, password, site } = body;

    const config = {
      controllerUrl: controllerUrl || process.env.UNIFI_CONTROLLER_URL || 'https://192.168.1.200:11443',
      username: username || process.env.UNIFI_USERNAME || 'congnhat',
      password: password || process.env.UNIFI_PASSWORD || 'Congnhat2002@',
      site: site || process.env.UNIFI_SITE || 'default',
      rejectUnauthorized: false,
    };

    const client = new UnifiClient(config);
    await client.login({ username: config.username, password: config.password });
    client.logout();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Logout failed' },
      { status: 500 }
    );
  }
}
