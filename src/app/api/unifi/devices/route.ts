import { NextRequest, NextResponse } from 'next/server';
import { getUnifiClientFromRequest } from '@/lib/settings';
import { UnifiDevice } from '@/types/unifi';

export const dynamic = 'force-dynamic';

function transformDevice(device: any): UnifiDevice {
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'pending',
    3: 'firmware_mismatch',
    4: 'upgrading',
    5: 'provisioning',
    6: 'heartbeat_missed',
    7: 'isolated',
  };

  return {
    ...device,
    status: device.status || stateMap[device.state] || (device.disconnected_at ? 'offline' : 'online'),
    ipAddress: device.ip || device.config_network?.ip,
    serialNumber: device.serial,
    uptime: device.uptime || 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const searchParams = req.nextUrl.searchParams;
    const deviceId = searchParams.get('deviceId');
    const type = searchParams.get('type');

    let devices: UnifiDevice[];

    if (deviceId) {
      const device = await client.getDevice(deviceId);
      devices = device ? [transformDevice(device)] : [];
    } else if (type === 'ap') {
      const aps = await client.getAccessPoints();
      devices = aps.map(transformDevice);
    } else if (type === 'switch') {
      const switches = await client.getSwitches();
      devices = switches.map(transformDevice);
    } else if (type === 'gateway') {
      const gateways = await client.getGateways();
      devices = gateways.map(transformDevice);
    } else {
      const allDevices = await client.getDevices();
      devices = allDevices.map(transformDevice);
    }

    await client.logout().catch(() => {});

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error('Unifi devices error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await getUnifiClientFromRequest(req);
    await client.login();

    const body = await req.json();
    const { action, deviceId, name, settings } = body;

    let result: boolean | null = null;

    switch (action) {
      case 'rename':
        if (deviceId && name) {
          result = await client.renameDevice(deviceId, name);
        }
        break;
      case 'led':
        if (deviceId && settings) {
          result = await client.setDeviceLedSettings(deviceId, settings);
        }
        break;
      case 'reboot':
        if (deviceId) {
          result = await client.rebootDevice(deviceId);
        }
        break;
      case 'upgrade':
        if (deviceId) {
          result = await client.upgradeDeviceFirmware(deviceId);
        }
        break;
      case 'forget':
        if (deviceId) {
          result = await client.forgetDevice(deviceId);
        }
        break;
      case 'adopt':
        if (deviceId) {
          result = await client.adoptDevice(deviceId);
        }
        break;
      case 'port':
        if (deviceId && settings) {
          result = await client.setPortSettings(deviceId, settings.portIdx, settings);
        }
        break;
      case 'radio':
        if (deviceId && settings) {
          result = await client.updateRadioSettings(deviceId, settings);
        }
        break;
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    await client.logout().catch(() => {});

    if (result === null) {
      return NextResponse.json({ success: false, error: 'Action failed' }, { status: 400 });
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('Unifi device action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}
