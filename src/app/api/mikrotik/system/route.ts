import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
    const [identity, resource, routerboard, logs] = await Promise.all([
      client.getSystemIdentity(),
      client.getSystemResource(),
      client.getRouterboard(),
      client.getSystemLogs(100),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        identity,
        resource,
        routerboard,
        logs,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải thông tin hệ thống MikroTik',
      },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    const client = await createMikrotikClientFromRequest(req);

    if (action === 'reboot') {
      const result = await client.rebootRouter();
      return NextResponse.json({ success: result });
    }

    return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Lỗi thực thi lệnh hệ thống MikroTik',
      },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('MIKROTIK', handlePOST, handleGET));
