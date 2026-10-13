import { NextRequest, NextResponse } from 'next/server';
import { UnifiClient } from '@/lib/unifi';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { controllerUrl, username, password, site } = body;

    const config = {
      controllerUrl: controllerUrl || process.env.UNIFI_CONTROLLER_URL,
      username: username || process.env.UNIFI_USERNAME,
      password: password || process.env.UNIFI_PASSWORD,
      site: site || process.env.UNIFI_SITE || 'default',
      rejectUnauthorized: false,
    };

    const client = new UnifiClient(config);
    const result = await client.login({ username: config.username!, password: config.password! });
    const resolvedSite = client.getCurrentSite();

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        controllerUrl: config.controllerUrl,
        username: config.username,
        site: resolvedSite,
        loginResult: result,
      },
    });
  } catch (error) {
    console.error('Unifi login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      },
      { status: 401 }
    );
  }
}
