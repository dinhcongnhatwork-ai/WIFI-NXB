import { NextRequest, NextResponse } from 'next/server';
import { UnifiClient } from '@/lib/unifi';
import { getUnifiConfig } from '@/lib/settings';
import { UnifiDevice, UnifiNetwork, UnifiUser } from '@/types/unifi';

export const dynamic = 'force-dynamic';

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCharts(devices: UnifiDevice[], clients: UnifiUser[], networks: UnifiNetwork[]) {
  const deviceTypeLabel: Record<string, string> = {
    uap: 'Access Point',
    usw: 'Switch',
    ugw: 'Gateway',
    udm: 'Gateway',
    gateway: 'Gateway',
    switch: 'Switch',
    router: 'Router',
  };

  const deviceDistributionMap = new Map<string, number>();
  for (const device of devices) {
    const key = deviceTypeLabel[device.type] || device.type || 'Unknown';
    deviceDistributionMap.set(key, (deviceDistributionMap.get(key) || 0) + 1);
  }

  const signalBuckets = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };

  for (const client of clients) {
    if (client.isWired) {
      continue;
    }

    const signal = toNumber(client.signal);
    if (signal >= -50) {
      signalBuckets.excellent += 1;
    } else if (signal >= -60) {
      signalBuckets.good += 1;
    } else if (signal >= -70) {
      signalBuckets.fair += 1;
    } else {
      signalBuckets.poor += 1;
    }
  }

  const wiredClients = clients.filter((client) => client.isWired);
  const wirelessClients = clients.filter((client) => !client.isWired);

  const trafficByClientType = [
    {
      label: 'Wired',
      upload: wiredClients.reduce((sum, client) => sum + toNumber(client.txBytes), 0),
      download: wiredClients.reduce((sum, client) => sum + toNumber(client.rxBytes), 0),
    },
    {
      label: 'Wireless',
      upload: wirelessClients.reduce((sum, client) => sum + toNumber(client.txBytes), 0),
      download: wirelessClients.reduce((sum, client) => sum + toNumber(client.rxBytes), 0),
    },
  ];

  const stationsByNetwork = networks
    .map((network) => ({
      name: network.name,
      stations: toNumber(network.numStations),
    }))
    .sort((a, b) => b.stations - a.stations)
    .slice(0, 8);

  return {
    deviceDistribution: Array.from(deviceDistributionMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    signalBuckets,
    trafficByClientType,
    stationsByNetwork,
  };
}
export async function GET(req: NextRequest) {
  try {
    const config = await getUnifiConfig();
    const searchParams = req.nextUrl.searchParams;
    const controllerUrl = searchParams.get('controllerUrl') || config.controllerUrl;
    const username = searchParams.get('username') || config.username;
    const password = searchParams.get('password') || config.password;
    const site = searchParams.get('site') || config.site || 'default';

    const client = new UnifiClient({
      controllerUrl,
      username,
      password,
      site,
      rejectUnauthorized: false,
    });

    await client.login();
    const resolvedSite = client.getCurrentSite();

    const [devices, ssids, sites, health, alerts, clients, networks, stats, topology] = await Promise.all([
      client.getDevices().catch(() => []),
      client.getWlanConfs().catch(() => []),
      client.getSites().catch(() => []),
      client.getHealth().catch(() => ({ subsystems: [] })),
      client.getAlerts().catch(() => []),
      client.getClients().catch(() => []),
      client.getNetworks().catch(() => []),
      client.getDashboardStats().catch(() => null),
      client.getTopology().catch(() => ({ nodes: [], links: [], summary: { gateways: 0, switches: 0, accessPoints: 0, networks: 0, clients: 0 } })),
    ]);

    const charts = buildCharts(devices as UnifiDevice[], clients as UnifiUser[], networks as UnifiNetwork[]);

    await client.logout().catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        devices,
        ssids,
        sites,
        health,
        alerts,
        clients,
        networks,
        stats,
        topology,
        charts,
        connection: {
          controllerUrl,
          username,
          site: resolvedSite,
          connected: true,
        },
      },
    });
  } catch (error) {
    console.error('Unifi overview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch overview',
      },
      { status: 500 }
    );
  }
}
