import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
    const data = await client.getSimpleQueues();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải danh sách Queues',
      },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, name, target, maxLimit, comment, disabled } = body as {
      action?: string;
      id?: string;
      name?: string;
      target?: string;
      maxLimit?: string;
      comment?: string;
      disabled?: boolean;
    };

    const client = await createMikrotikClientFromRequest(req);

    if (action === 'add') {
      if (!name || !target || !maxLimit) {
        return NextResponse.json(
          { success: false, error: 'Thiếu tên queue, target IP/subnet hoặc maxLimit' },
          { status: 400 }
        );
      }
      const result = await client.addSimpleQueue({ name, target, maxLimit, comment });
      return NextResponse.json({ success: result });
    }

    if (action === 'toggle') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu queue id' }, { status: 400 });
      const result = await client.setSimpleQueueDisabled(id, disabled === true);
      return NextResponse.json({ success: result });
    }

    if (action === 'remove') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu queue id' }, { status: 400 });
      const result = await client.removeSimpleQueue(id);
      return NextResponse.json({ success: result });
    }

    return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật cấu hình Queues',
      },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('MIKROTIK', handlePOST, handleGET));
