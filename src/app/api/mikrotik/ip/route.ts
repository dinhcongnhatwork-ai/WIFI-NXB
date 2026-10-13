import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const client = createMikrotikClientFromRequest(req);
    const type = req.nextUrl.searchParams.get('type') || 'all';

    if (type === 'addresses') {
      const data = await client.getIpAddresses();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'dhcp-servers') {
      const data = await client.getDhcpServers();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'dhcp-leases') {
      const data = await client.getDhcpLeases();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'routes') {
      const data = await client.getRoutes();
      return NextResponse.json({ success: true, data });
    }

    const [addresses, dhcpServers, dhcpLeases, routes] = await Promise.all([
      client.getIpAddresses(),
      client.getDhcpServers(),
      client.getDhcpLeases(),
      client.getRoutes(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        addresses,
        dhcpServers,
        dhcpLeases,
        routes,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải dữ liệu IP',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, address, interface: iface, comment } = body as {
      action?: string;
      id?: string;
      address?: string;
      interface?: string;
      comment?: string;
    };

    const client = createMikrotikClientFromRequest(req);

    if (action === 'add-address') {
      if (!address || !iface) {
        return NextResponse.json({ success: false, error: 'Thiếu address/interface' }, { status: 400 });
      }

      const result = await client.addIpAddress({ address, interface: iface, comment });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-address') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Thiếu address id' }, { status: 400 });
      }

      const result = await client.removeIpAddress(id);
      return NextResponse.json({ success: result });
    }

    return NextResponse.json({ success: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật cấu hình IP',
      },
      { status: 500 }
    );
  }
}
