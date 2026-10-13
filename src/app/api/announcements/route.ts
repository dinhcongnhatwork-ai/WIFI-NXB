import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

/**
 * GET /api/announcements
 * Returns the latest announcement and current version.
 */
export async function GET() {
  try {
    const latest = await prisma.announcement.findFirst({
      orderBy: { version: 'desc' },
    });

    const count = await prisma.announcement.count();

    return NextResponse.json({
      success: true,
      data: {
        currentVersion: latest?.version || 0,
        totalAnnouncements: count,
        latest: latest || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi tải thông báo' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 *
 * Actions:
 *   - "create": Create a new announcement (increments version)
 *   - "reset-wifi": Create announcement + clear all MikroTik active sessions/cookies
 *                   This forces all clients to re-authenticate through the portal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, message } = body as {
      action?: string;
      title?: string;
      message?: string;
    };

    if (action === 'create' || action === 'reset-wifi') {
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Tiêu đề thông báo không được để trống' },
          { status: 400 }
        );
      }

      // Create the announcement
      const announcement = await prisma.announcement.create({
        data: {
          title,
          message: message || null,
          createdBy: 'admin',
        },
      });

      const result: Record<string, unknown> = {
        success: true,
        announcement,
      };

      // If reset-wifi is requested, clear all MikroTik hotspot sessions
      if (action === 'reset-wifi') {
        try {
          const client = createMikrotikClientFromRequest();

          // 1. Remove all active sessions (forces re-auth)
          const activeRemoved = await client.removeAllHotspotActiveSessions();

          // 2. Remove all cookies (prevents cookie-based auto-login)
          const cookiesRemoved = await client.removeAllHotspotCookies();

           // 3. Remove any leftover portal ip-bindings (cleanup old mechanism)
          const bindingsRemoved = await client.removeAllPortalBindings();

          // 3.5. Remove all tracked hosts from Hotspot Hosts list
          // This forces a clean state in MikroTik's active device table
          const hostsCleared = await client.removeAllHotspotHosts();

          // 4. Temporarily disable & re-enable the hotspot interface
          // This bounces the physical link of the AP, forcing wireless clients to disconnect & reconnect.
          // Re-connecting forces their OS to run captive portal detection and instantly popup the portal!
          const interfaceBounced = await client.bounceHotspotInterface(2);

          result.mikrotikReset = {
            activeSessionsCleared: activeRemoved,
            cookiesCleared: cookiesRemoved,
            bindingsRemoved,
            hostsCleared,
            interfaceBounced,
          };

          console.log(
            `[announcements] ✅ Reset WiFi completed. Version=${announcement.version}, ` +
            `Active cleared=${activeRemoved}, Cookies cleared=${cookiesRemoved}, ` +
            `Bindings removed=${bindingsRemoved}, Hosts cleared=${hostsCleared}, ` +
            `Interface bounced=${interfaceBounced}`
          );
        } catch (mikrotikError) {
          console.error('[announcements] MikroTik reset error:', mikrotikError);
          result.mikrotikReset = {
            error: mikrotikError instanceof Error ? mikrotikError.message : 'MikroTik reset failed',
          };
        }
      }

      return NextResponse.json(result);
    }

    if (action === 'list') {
      const announcements = await prisma.announcement.findMany({
        orderBy: { version: 'desc' },
        take: 50,
      });

      return NextResponse.json({ success: true, data: announcements });
    }

    return NextResponse.json(
      { success: false, error: 'Action không hợp lệ. Sử dụng: create, reset-wifi, list' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi xử lý thông báo' },
      { status: 500 }
    );
  }
}
