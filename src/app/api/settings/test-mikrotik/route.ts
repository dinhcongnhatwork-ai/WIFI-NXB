import { NextRequest, NextResponse } from 'next/server';
import { MikrotikClient } from '@/lib/mikrotik';
import { getMikrotikConfig } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const current = await getMikrotikConfig();

    const host = (body.host || current.host || '').trim();
    const port = Number(body.port) || current.port || 80;
    const username = (body.username || current.username || '').trim();
    const password = body.password ? String(body.password).trim() : current.password;
    const allowInsecure = body.allowInsecure !== undefined ? Boolean(body.allowInsecure) : current.allowInsecure;

    if (!host || !username) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đầy đủ Host/IP và Username MikroTik' },
        { status: 400 }
      );
    }

    const clientHost = port && port !== 80 && port !== 443 && !host.includes(':')
      ? `${host}:${port}`
      : host;

    const client = new MikrotikClient({
      host: clientHost,
      username,
      password,
      allowInsecure,
      timeoutMs: 5000,
    });

    const [resource, identity] = await Promise.all([
      client.getSystemResource(),
      client.getSystemIdentity().catch(() => ({ name: 'MikroTik' })),
    ]);

    if (!resource) {
      throw new Error('Không thể đọc thông tin hệ thống từ MikroTik RouterOS');
    }

    return NextResponse.json({
      success: true,
      message: 'Kết nối MikroTik RouterOS thành công!',
      details: {
        identity: identity?.name || 'MikroTik',
        version: resource.version || 'Unknown',
        boardName: resource.boardName || 'RouterOS',
        uptime: resource.uptime || '-',
        cpuLoad: resource.cpuLoad !== undefined ? `${resource.cpuLoad}%` : '-',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể kết nối đến MikroTik RouterOS',
      },
      { status: 500 }
    );
  }
}
