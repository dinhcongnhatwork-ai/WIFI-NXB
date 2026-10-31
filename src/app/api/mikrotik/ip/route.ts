import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await createMikrotikClientFromRequest(req);
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

    if (type === 'arp') {
      const data = await client.getArpEntries();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'pools') {
      const data = await client.getIpPools();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'routes') {
      const data = await client.getRoutes();
      return NextResponse.json({ success: true, data });
    }

    const [addresses, dhcpServers, dhcpLeases, routes, arp, pools] = await Promise.all([
      client.getIpAddresses(),
      client.getDhcpServers(),
      client.getDhcpLeases(),
      client.getRoutes(),
      client.getArpEntries(),
      client.getIpPools(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        addresses,
        dhcpServers,
        dhcpLeases,
        routes,
        arp,
        pools,
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

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, address, interface: iface, comment, macAddress, server, name, ranges } = body as {
      action?: string;
      id?: string;
      address?: string;
      interface?: string;
      comment?: string;
      macAddress?: string;
      server?: string;
      name?: string;
      ranges?: string;
    };

    const client = await createMikrotikClientFromRequest(req);

    // IP Address
    if (action === 'add-address') {
      if (!address || !iface) {
        return NextResponse.json({ success: false, error: 'Thiếu address/interface' }, { status: 400 });
      }
      const result = await client.addIpAddress({ address, interface: iface, comment });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-address') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu address id' }, { status: 400 });
      const result = await client.removeIpAddress(id);
      return NextResponse.json({ success: result });
    }

    // DHCP Lease
    if (action === 'make-lease-static') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu lease id' }, { status: 400 });
      const result = await client.makeDhcpLeaseStatic(id);
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-lease') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu lease id' }, { status: 400 });
      const result = await client.removeDhcpLease(id);
      return NextResponse.json({ success: result });
    }

    if (action === 'add-lease') {
      if (!address || !macAddress) {
        return NextResponse.json({ success: false, error: 'Thiếu IP hoặc MAC address' }, { status: 400 });
      }
      const result = await client.addStaticDhcpLease({ address, macAddress, server, comment });
      return NextResponse.json({ success: result });
    }

    // ARP
    if (action === 'remove-arp') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu ARP entry id' }, { status: 400 });
      const result = await client.removeArpEntry(id);
      return NextResponse.json({ success: result });
    }

    if (action === 'add-arp') {
      if (!address || !macAddress || !iface) {
        return NextResponse.json({ success: false, error: 'Thiếu IP, MAC hoặc Interface' }, { status: 400 });
      }
      const result = await client.addArpEntry({ address, macAddress, interface: iface, comment });
      return NextResponse.json({ success: result });
    }

    // IP Pool
    if (action === 'add-pool') {
      if (!name || !ranges) {
        return NextResponse.json({ success: false, error: 'Thiếu tên pool hoặc dải IP ranges' }, { status: 400 });
      }
      const result = await client.addIpPool({ name, ranges });
      return NextResponse.json({ success: result });
    }

    if (action === 'remove-pool') {
      if (!id) return NextResponse.json({ success: false, error: 'Thiếu pool id' }, { status: 400 });
      const result = await client.removeIpPool(id);
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

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('MIKROTIK', handlePOST, handleGET));
