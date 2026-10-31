import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
    const data = await client.getInterfaces();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải danh sách interface',
      },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id } = body as { action?: string; id?: string };

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu interface id' }, { status: 400 });
    }

    const client = await createMikrotikClientFromRequest(req);

    let result = false;
    if (action === 'enable') {
      result = await client.setInterfaceDisabled(id, false);
    } else if (action === 'disable') {
      result = await client.setInterfaceDisabled(id, true);
    } else {
      return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật interface',
      },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('MIKROTIK', handlePOST, handleGET));
