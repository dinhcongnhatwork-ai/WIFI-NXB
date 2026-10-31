import { legacyMutation } from '@/lib/network/legacy-mutation';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { getUnifiClientFromRequest } from '@/lib/settings';
import { UnifiUser } from '@/types/unifi';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const mac = searchParams.get('mac');
    const force = searchParams.get('force') === 'true';

    let users: UnifiUser[];

    if (mac) {
      const user = await client.getClient(mac);
      users = user ? [user] : [];
    } else if (type === 'guest') {
      users = await client.getGuests();
    } else {
      users = await client.getClients(force);
    }

    await client.logout().catch(() => {});

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('Unifi clients error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const body = await req.json();
    const { action, mac, minutes, name, note } = body;

    let result: boolean | null = null;

    switch (action) {
      case 'block':
        if (mac) {
          result = await client.blockClient(mac);
        }
        break;
      case 'unblock':
        if (mac) {
          result = await client.unblockClient(mac);
        }
        break;
      case 'kick':
      case 'reconnect':
        if (mac) {
          result = await client.reconnectClient(mac);
        }
        break;
      case 'authorize':
        if (mac) {
          result = await client.authorizeGuest(mac, minutes || 1440);
        }
        break;
      case 'unauthorize':
        if (mac) {
          result = await client.unauthorizeGuest(mac);
        }
        break;
      case 'note':
      case 'rename':
      case 'update':
        if (mac) {
          result = await client.setClientNoteAndName(mac, name, note);
        }
        break;
      default:
        await client.logout().catch(() => {});
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    await client.logout().catch(() => {});

    if (result === null) {
      return NextResponse.json({ success: false, error: 'Action failed' }, { status: 400 });
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('Unifi client action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
export const POST = withPermission('operate', legacyMutation('UNIFI', handlePOST, handleGET));
