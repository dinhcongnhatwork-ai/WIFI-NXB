import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { getUnifiClientFromRequest } from '@/lib/settings';
import { resolveConnection } from '@/lib/network/connections';
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
async function handleGET(req: NextRequest) {
  try {
    const connection = await resolveConnection('UNIFI', req);
    const client = await getUnifiClientFromRequest(req);
    const controllerUrl = connection.baseUrl;
    const username = connection.username;
    await client.login();
    const resolvedSite = client.getCurrentSite();

    const warnings: string[] = [];
    const optional = async <T,>(name: string, read:()=>Promise<T>, empty:T):Promise<T> => {
      try { return await read(); } catch { warnings.push(`${name}: unavailable or forbidden`); return empty; }
    };
    const [devices, clients, sites, topology] = await Promise.all([client.getDevices(), client.getClients(), client.getSites(), client.getTopology()]);
    const [ssids, health, alerts, networks, stats] = await Promise.all([
      optional('Wi-Fi configuration',()=>client.getWlanConfs(),[]),
      optional('Health',()=>client.getHealth(),{subsystems:[]}),
      optional('Alerts',()=>client.getAlerts(),[]),
      optional('Networks',()=>client.getNetworks(),[]),
      optional('Dashboard statistics',()=>client.getDashboardStats(),null as any),
    ]);
    const onlineDevices = (devices as UnifiDevice[]).filter((d) => d.status === 'online').length;
    const computedStats = stats || {
      siteId: resolvedSite,
      siteName: resolvedSite,
      deviceCount: devices.length,
      onlineDevices,
      offlineDevices: Math.max(devices.length - onlineDevices, 0),
      userCount: clients.length,
      guestCount: (clients as UnifiUser[]).filter((c) => c.isGuest).length,
      activeUsers: (clients as UnifiUser[]).filter((c) => !c.isGuest).length,
      totalRxBytes: (clients as UnifiUser[]).reduce((sum, c) => sum + toNumber(c.rxBytes), 0),
      totalTxBytes: (clients as UnifiUser[]).reduce((sum, c) => sum + toNumber(c.txBytes), 0),
      uptime: 0,
    };
    const summary = {gateways:topology.nodes.filter(n=>n.type==='gateway').length,switches:topology.nodes.filter(n=>n.type==='switch').length,accessPoints:topology.nodes.filter(n=>n.type==='ap').length,networks:0,clients:clients.length};
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
        stats: computedStats,
        topology: {...topology, summary},
        warnings,
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

export const GET = withPermission('read', handleGET);
