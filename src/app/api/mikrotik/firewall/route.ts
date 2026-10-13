import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const client = createMikrotikClientFromRequest(req);
    const data = await client.getFirewallFilterRules();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải firewall rules',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id } = body as { action?: string; id?: string };

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu rule id' }, { status: 400 });
    }

    const client = createMikrotikClientFromRequest(req);

    let result = false;
    if (action === 'enable') {
      result = await client.setFirewallRuleDisabled(id, false);
    } else if (action === 'disable') {
      result = await client.setFirewallRuleDisabled(id, true);
    } else {
      return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật firewall rule',
      },
      { status: 500 }
    );
  }
}
