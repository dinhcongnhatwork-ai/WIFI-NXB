import { NextRequest, NextResponse } from 'next/server';
import { getUnifiConfig, getMikrotikConfig, saveSystemSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [unifi, mikrotik] = await Promise.all([
      getUnifiConfig(),
      getMikrotikConfig(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        unifi: {
          controllerUrl: unifi.controllerUrl,
          username: unifi.username,
          hasPassword: Boolean(unifi.password),
          site: unifi.site,
        },
        mikrotik: {
          host: mikrotik.host,
          port: mikrotik.port,
          username: mikrotik.username,
          hasPassword: Boolean(mikrotik.password),
          allowInsecure: mikrotik.allowInsecure,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { unifi, mikrotik } = body;

    if (unifi) {
      const current = await getUnifiConfig();
      const updated = {
        controllerUrl: (unifi.controllerUrl || current.controllerUrl || '').trim(),
        username: (unifi.username || current.username || '').trim(),
        password: unifi.password ? String(unifi.password).trim() : current.password,
        site: (unifi.site || current.site || 'default').trim(),
      };
      await saveSystemSetting('unifi', updated);
    }

    if (mikrotik) {
      const current = await getMikrotikConfig();
      const updated = {
        host: (mikrotik.host || current.host || '').trim(),
        port: Number(mikrotik.port) || current.port || 80,
        username: (mikrotik.username || current.username || '').trim(),
        password: mikrotik.password ? String(mikrotik.password).trim() : current.password,
        allowInsecure: mikrotik.allowInsecure !== undefined ? Boolean(mikrotik.allowInsecure) : current.allowInsecure,
      };
      await saveSystemSetting('mikrotik', updated);
    }

    return NextResponse.json({
      success: true,
      message: 'Cài đặt hệ thống đã được lưu thành công và áp dụng ngay lập tức!',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}
