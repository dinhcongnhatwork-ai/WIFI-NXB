import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const client = createMikrotikClientFromRequest(req);
    const type = req.nextUrl.searchParams.get('type') || 'all';

    if (type === 'profiles') {
      const data = await client.getHotspotProfiles();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'servers') {
      const data = await client.getHotspotServers();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'users') {
      const data = await client.getHotspotUsers();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'active') {
      const data = await client.getHotspotActiveSessions();
      return NextResponse.json({ success: true, data });
    }

    const [profiles, servers, users, active] = await Promise.all([
      client.getHotspotProfiles(),
      client.getHotspotServers(),
      client.getHotspotUsers(),
      client.getHotspotActiveSessions(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profiles,
        servers,
        users,
        active,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải hotspot data',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, name, password, profile, server, comment } = body as {
      action?: string;
      id?: string;
      name?: string;
      password?: string;
      profile?: string;
      server?: string;
      comment?: string;
    };

    const client = createMikrotikClientFromRequest(req);

    if (action === 'enable-user') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Thiếu user id' }, { status: 400 });
      }
      const result = await client.setHotspotUserDisabled(id, false);
      return NextResponse.json({ success: result });
    }

    if (action === 'disable-user') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Thiếu user id' }, { status: 400 });
      }
      const result = await client.setHotspotUserDisabled(id, true);
      return NextResponse.json({ success: result });
    }

    if (action === 'add-user') {
      if (!name) {
        return NextResponse.json({ success: false, error: 'Thiếu username' }, { status: 400 });
      }
      const result = await client.createHotspotUser({
        name,
        password: password || '',
        profile,
        server,
        comment,
      });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-user') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Thiếu user id' }, { status: 400 });
      }
      const result = await client.removeHotspotUser(id);
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-all-active') {
      try {
        // Clear active sessions and cookies — forces all clients to re-authenticate
        // We no longer remove DHCP leases (clients keep their IP) or ip-bindings (deprecated)
        const [activeResult, cookieResult] = await Promise.all([
          client.removeAllHotspotActiveSessions(),
          client.removeAllHotspotCookies(),
        ]);

        // Also clean up any leftover portal ip-bindings from old mechanism
        let bindingsRemoved = 0;
        try {
          bindingsRemoved = await client.removeAllPortalBindings();
        } catch {
          // Ignore — bindings may not exist
        }

        return NextResponse.json({
          success: activeResult && cookieResult,
          bindingsRemoved,
          message: 'Đã xóa tất cả active sessions và cookies. Tất cả client sẽ phải xác thực lại.',
        });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Reset thất bại' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật hotspot',
      },
      { status: 500 }
    );
  }
}
