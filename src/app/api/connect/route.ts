import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isVideoWatched } from '@/lib/redis';
import { cleanMac, hasPublishedGate, parseDevice, PortalContextError, requiresSignedPortalSession, resolvePortalAccess } from '@/lib/attendance/runtime';
import { normalizeRedirectUrl, resolvePortalFallbackUrl } from '@/lib/redirect-url';

export const dynamic = 'force-dynamic';

/**
 * GET /api/connect
 *
 * A redirect-based login endpoint that works reliably in captive portal browsers.
 * Instead of requiring a fetch() POST call (which can fail in restricted captive
 * portal WebView environments), the "Kết nối ngay" button navigates here directly.
 *
 * This endpoint:
 *   1. Logs the connection attempt
 *   2. Upserts the WiFi user record
 *   3. Redirects the browser to MikroTik trial login URL (creates active session)
 *
 * NOTE: We intentionally do NOT use ip-binding bypass. Instead, we redirect
 * to the MikroTik trial login URL which creates a proper active user session.
 * This allows admin to force re-authentication by clearing active sessions.
 *
 * Query parameters:
 *   - mac:        Client MAC address
 *   - ip:         Client IP address
 *   - trial:      MikroTik trial login URL
 *   - link-login: MikroTik link-login URL (used as fallback)
 *   - ssid:       WiFi network name
 *   - phone:      (optional) phone number
 *   - campaignId: (optional) campaign ID
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const pickFirst = (...keys: string[]) => {
      for (const key of keys) {
        const value = searchParams.get(key);
        if (value && value.trim()) return value.trim();
      }
      return '';
    };

    const mac = pickFirst('mac', 'MAC', 'mac-address', 'macaddress', 'client-mac');
    const ip = pickFirst('ip', 'IP', 'ip-address', 'client-ip');
    const ssid = pickFirst('ssid', 'SSID', 'ssid-name');
    const phone = pickFirst('phone');
    const trial = pickFirst('trial', 'link-trial', 'linktrial');
    const linkLogin = pickFirst('link-login', 'link-login-only', 'linklogin', 'linkLogin');
    const campaignId = pickFirst('campaignId', 'campaign-id');
    const redirectUrlParam = pickFirst('redirectUrl');
    const portalSessionId = pickFirst('portalSessionId', 'sessionId');

    if (!mac && !trial && !linkLogin) {
      // No way to authorize — redirect to portal with error
      const fallback = resolvePortalFallbackUrl(process.env.NEXT_PUBLIC_APP_URL);
      return NextResponse.redirect(fallback, 302);
    }

    if (!portalSessionId && !ssid) return NextResponse.json({ success: false, error: 'Signed portal session required' }, { status: 403 });
    const device = pickFirst('device') ? parseDevice(pickFirst('device')) : undefined;
    const runtime = await resolvePortalAccess(prisma, { ssid, mac, device, apMac: pickFirst('apMac', 'ap-mac', 'ap'), campaignId }, portalSessionId);
    if (!runtime) return NextResponse.json({ success: false, error: 'Invalid or expired portal session' }, { status: 400 });
    if (!runtime.effectiveTemplateId) return NextResponse.json({ success: false, error: 'No published portal is configured for this network' }, { status: 403 });
    if (runtime.attendanceAmbiguous) return NextResponse.json({ success: false, error: 'Attendance network context is ambiguous' }, { status: 403 });
    if (!portalSessionId && requiresSignedPortalSession(runtime)) return NextResponse.json({ success: false, error: 'Signed portal session required' }, { status: 403 });
    const campaign = runtime.campaign;
    if (hasPublishedGate(runtime.layout, 'video_gate', runtime.device)) {
      if (!portalSessionId || !(await isVideoWatched(`${runtime.portalSessionId}:${cleanMac(mac) || 'unknown-client'}`))) {
        return NextResponse.json({ success: false, error: 'Video not watched' }, { status: 403 });
      }
    }
    if (runtime.attendanceSession && hasPublishedGate(runtime.layout, 'attendance_gate', runtime.device) && !runtime.isAlreadyRegistered) {
      return NextResponse.json({ success: false, error: 'Attendance registration required' }, { status: 403 });
    }

    // Upsert wifi user
    if (mac) {
      try {
        await prisma.wifiUser.upsert({
          where: { mac },
          update: { ip: ip || undefined, phone: phone || undefined },
          create: { mac, ip, phone },
        });
      } catch (e) {
        console.error('Upsert wifi user error:', e);
      }
    }

    // Log the connection
    if (campaign && mac) {
      try {
        await prisma.log.create({
          data: {
            mac,
            campaignId: campaign.id,
            phone,
            metadata: { ip, ssid, linkLogin, method: 'get-redirect-trial' },
          },
        });
      } catch (e) {
        console.error('Log creation error:', e);
      }
    }

    // Build the final destination URL after hotspot authorization
    const finalRedirect =
      normalizeRedirectUrl(redirectUrlParam) ||
      normalizeRedirectUrl(campaign?.redirectUrl) ||
      'https://www.nxbctqg.org.vn/';

    // ──────────────────────────────────────────────────────────────────
    // Strategy: Redirect to MikroTik trial login URL (active session)
    // This creates a proper hotspot active user session on the router.
    // The session has a time limit and can be cleared by admin.
    //
    // MikroTik variables:
    //   $(trial) = "yes" or "no" (just a flag, NOT a URL)
    //   $(link-login-only) = the actual trial login URL e.g. "http://10.10.20.1/login?..."
    //   $(link-login) = login URL with dst parameter
    // ──────────────────────────────────────────────────────────────────

    // Helper: check if a string is a valid HTTP(S) URL
    const isValidUrl = (s: string) => /^https?:\/\//i.test(s);

    // Pick the best hotspot login URL, filtering out non-URL values like "yes"/"no"
    const linkLoginOnly = pickFirst('link-login-only', 'linkLoginOnly');
    const candidates = [trial, linkLoginOnly, linkLogin].filter(u => u && isValidUrl(u));
    const hotspotLoginUrl = candidates[0] || '';

    if (hotspotLoginUrl) {
      try {
        const loginUrl = new URL(hotspotLoginUrl);
        loginUrl.searchParams.set('dst', finalRedirect);
        if (mac) {
          loginUrl.searchParams.set('username', `T-${mac.trim().toUpperCase()}`);
        }

        console.log(`[connect] ✅ Redirecting MAC=${mac} IP=${ip} → trial login ${loginUrl.toString()}`);

        return NextResponse.redirect(loginUrl.toString(), 302);
      } catch {
        // URL parsing failed, try raw concatenation
        const separator = hotspotLoginUrl.includes('?') ? '&' : '?';
        let redirectTarget = `${hotspotLoginUrl}${separator}dst=${encodeURIComponent(finalRedirect)}`;
        if (mac) {
          redirectTarget += `&username=T-${encodeURIComponent(mac.trim().toUpperCase())}`;
        }

        console.log(`[connect] ✅ Redirecting MAC=${mac} IP=${ip} → trial login (raw) → ${redirectTarget}`);

        return NextResponse.redirect(redirectTarget, 302);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Fallback: Direct redirect (no valid trial URL available)
    // This should rarely happen if MikroTik is configured correctly
    // ──────────────────────────────────────────────────────────────────
    console.warn(`[connect] ⚠️ No valid trial/link-login URL for MAC=${mac} IP=${ip}, redirecting directly to ${finalRedirect}`);
    return NextResponse.redirect(finalRedirect, 302);
  } catch (error) {
    if (error instanceof PortalContextError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('Connect redirect error:', error);
    const fallback = resolvePortalFallbackUrl(process.env.NEXT_PUBLIC_APP_URL);
    return NextResponse.redirect(fallback, 302);
  }
}
