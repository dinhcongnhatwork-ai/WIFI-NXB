import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
    const type = req.nextUrl.searchParams.get('type') || 'all';

    if (type === 'profiles') {
      const data = await client.getHotspotProfiles();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'user-profiles') {
      const data = await client.getHotspotUserProfiles();
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

    if (type === 'bindings') {
      const data = await client.getIpBindings();
      return NextResponse.json({ success: true, data });
    }

    const [profiles, userProfiles, servers, users, active, bindings] = await Promise.all([
      client.getHotspotProfiles(),
      client.getHotspotUserProfiles(),
      client.getHotspotServers(),
      client.getHotspotUsers(),
      client.getHotspotActiveSessions(),
      client.getIpBindings(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profiles,
        userProfiles,
        servers,
        users,
        active,
        bindings,
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

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      id,
      name,
      password,
      profile,
      server,
      comment,
      macAddress,
      address,
      toAddress,
      type: bindingType,
    } = body as {
      action?: string;
      id?: string;
      name?: string;
      password?: string;
      profile?: string;
      server?: string;
      comment?: string;
      macAddress?: string;
      address?: string;
      toAddress?: string;
      type?: string;
    };

    const client = await createMikrotikClientFromRequest(req);

    // User actions
    if (action === 'enable-user') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu user id' }, { status: 400 });
      const result = await client.setHotspotUserDisabled(id, false);
      return NextResponse.json({ success: result });
    }

    if (action === 'disable-user') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu user id' }, { status: 400 });
      const result = await client.setHotspotUserDisabled(id, true);
      return NextResponse.json({ success: result });
    }

    if (action === 'add-user') {
      if (!name) return NextResponse.json({ success: false, error: 'Thiếu username' }, { status: 400 });
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
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu user id' }, { status: 400 });
      const result = await client.removeHotspotUser(id);
      return NextResponse.json({ success: result });
    }

    // Active session kick
    if (action === 'kick-active') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu session id' }, { status: 400 });
      const result = await client.kickHotspotActive(id);
      return NextResponse.json({ success: result });
    }

    // IP Binding actions
    if (action === 'add-binding') {
      if (!bindingType) {
        return NextResponse.json({ success: false, error: 'Thiếu loại binding (bypassed/blocked/regular)' }, { status: 400 });
      }
      const result = await client.addIpBinding({
        macAddress,
        address,
        toAddress,
        server,
        type: bindingType,
        comment,
      });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-binding') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu binding id' }, { status: 400 });
      const result = await client.removeIpBinding(id);
      return NextResponse.json({ success: result });
    }

    if (action === 'toggle-binding') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu binding id' }, { status: 400 });
      const result = await client.setIpBindingDisabled(id, body.disabled === true);
      return NextResponse.json({ success: result });
    }

    return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật cấu hình hotspot',
      },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('MIKROTIK', handlePOST, handleGET));
