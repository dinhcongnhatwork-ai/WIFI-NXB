import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
    const type = req.nextUrl.searchParams.get('type') || 'all';

    if (type === 'filter') {
      const data = await client.getFirewallFilterRules();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'nat') {
      const data = await client.getNatRules();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'address-list') {
      const data = await client.getAddressLists();
      return NextResponse.json({ success: true, data });
    }

    const [filterRules, natRules, addressLists] = await Promise.all([
      client.getFirewallFilterRules(),
      client.getNatRules(),
      client.getAddressLists(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        filterRules,
        natRules,
        addressLists,
      },
    });
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

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      id,
      chain,
      natAction,
      outInterface,
      toAddresses,
      toPorts,
      dstPort,
      protocol,
      comment,
      list,
      address,
      timeout,
    } = body as {
      action?: string;
      id?: string;
      chain?: string;
      natAction?: string;
      outInterface?: string;
      toAddresses?: string;
      toPorts?: string;
      dstPort?: string;
      protocol?: string;
      comment?: string;
      list?: string;
      address?: string;
      timeout?: string;
    };

    const client = await createMikrotikClientFromRequest(req);

    // Filter rule enable/disable
    if (action === 'enable' || action === 'enable-filter') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu rule id' }, { status: 400 });
      const result = await client.setFirewallRuleDisabled(id, false);
      return NextResponse.json({ success: result });
    }

    if (action === 'disable' || action === 'disable-filter') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu rule id' }, { status: 400 });
      const result = await client.setFirewallRuleDisabled(id, true);
      return NextResponse.json({ success: result });
    }

    // NAT rule actions
    if (action === 'enable-nat') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu NAT rule id' }, { status: 400 });
      const result = await client.setNatRuleDisabled(id, false);
      return NextResponse.json({ success: result });
    }

    if (action === 'disable-nat') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu NAT rule id' }, { status: 400 });
      const result = await client.setNatRuleDisabled(id, true);
      return NextResponse.json({ success: result });
    }

    if (action === 'add-nat') {
      if (!chain || !natAction) {
        return NextResponse.json({ success: false, error: 'Thiếu chain hoặc action NAT' }, { status: 400 });
      }
      const result = await client.addNatRule({
        chain,
        action: natAction,
        outInterface,
        toAddresses,
        toPorts,
        dstPort,
        protocol,
        comment,
      });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-nat') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu NAT rule id' }, { status: 400 });
      const result = await client.removeNatRule(id);
      return NextResponse.json({ success: result });
    }

    // Address List actions
    if (action === 'add-address-list') {
      if (!list || !address) {
        return NextResponse.json({ success: false, error: 'Thiếu tên danh sách hoặc IP address' }, { status: 400 });
      }
      const result = await client.addAddressList({ list, address, timeout, comment });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-address-list') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu address list id' }, { status: 400 });
      const result = await client.removeAddressList(id);
      return NextResponse.json({ success: result });
    }

    if (action === 'enable-address-list') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu address list id' }, { status: 400 });
      const result = await client.setAddressListDisabled(id, false);
      return NextResponse.json({ success: result });
    }

    if (action === 'disable-address-list') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu address list id' }, { status: 400 });
      const result = await client.setAddressListDisabled(id, true);
      return NextResponse.json({ success: result });
    }

    return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
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

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('MIKROTIK', handlePOST, handleGET));
