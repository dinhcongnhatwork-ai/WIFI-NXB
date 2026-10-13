import { NextRequest, NextResponse } from 'next/server';
import { getUnifiClientFromRequest } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'networks';

    let data: unknown;

    switch (type) {
      case 'networks':
        data = await client.getNetworks();
        break;
      case 'usergroups':
        data = await client.getUserGroups();
        break;
      case 'firewall':
        data = await client.getFirewallRules();
        break;
      case 'portforwards':
        data = await client.getPortForwards();
        break;
      case 'dhcp':
        data = await client.getDhcpReservations();
        break;
      case 'dpi':
        data = await client.getDpiStats();
        break;
      case 'topology':
        data = await client.getTopology();
        break;
      default:
        data = [];
    }

    await client.logout().catch(() => {});

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unifi settings error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const body = await req.json();
    const { action, type, id, ...data } = body;

    let result: boolean | unknown = null;

    switch (type) {
      case 'network':
        if (action === 'create') {
          result = await client.createNetwork(data as Parameters<typeof client.createNetwork>[0]);
        } else if (action === 'update' && id) {
          result = await client.updateNetwork(id, data);
        } else if (action === 'delete' && id) {
          result = await client.deleteNetwork(id);
        }
        break;
      case 'usergroup':
        if (action === 'create') {
          result = await client.createUserGroup(data as Parameters<typeof client.createUserGroup>[0]);
        } else if (action === 'update' && id) {
          result = await client.updateUserGroup(id, data);
        } else if (action === 'delete' && id) {
          result = await client.deleteUserGroup(id);
        }
        break;
      case 'firewall':
        if (action === 'create') {
          result = await client.createFirewallRule(data as Parameters<typeof client.createFirewallRule>[0]);
        } else if (action === 'update' && id) {
          result = await client.updateFirewallRule(id, data);
        } else if (action === 'delete' && id) {
          result = await client.deleteFirewallRule(id);
        }
        break;
      case 'portforward':
        if (action === 'create') {
          result = await client.createPortForward(data as Parameters<typeof client.createPortForward>[0]);
        } else if (action === 'update' && id) {
          result = await client.updatePortForward(id, data);
        } else if (action === 'delete' && id) {
          result = await client.deletePortForward(id);
        }
        break;
      case 'dhcp':
        if (action === 'create') {
          result = await client.createDhcpReservation(data as Parameters<typeof client.createDhcpReservation>[0]);
        } else if (action === 'delete' && id) {
          result = await client.deleteDhcpReservation(id);
        }
        break;
      case 'dpi':
        if (data.enabled !== undefined) {
          const siteId = typeof data.siteId === 'string' && data.siteId.length > 0
            ? data.siteId
            : process.env.UNIFI_SITE || 'default';
          result = await client.setDpiEnabled(siteId, data.enabled);
        }
        break;
      case 'speedtest':
        result = await client.runSpeedtest();
        break;
      default:
        await client.logout().catch(() => {});
        return NextResponse.json({ success: false, error: 'Unknown type or action' }, { status: 400 });
    }

    await client.logout().catch(() => {});

    if (result === null) {
      return NextResponse.json({ success: false, error: 'Action failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Unifi settings action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}
