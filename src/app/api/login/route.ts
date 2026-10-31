import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isVideoWatched } from '@/lib/redis';
import { hasPublishedGate, parseDevice, PortalContextError, requiresSignedPortalSession, resolvePortalAccess } from '@/lib/attendance/runtime';
import { normalizeRedirectUrl, resolvePortalFallbackUrl } from '@/lib/redirect-url';

import {GuestClientPendingError} from '@/lib/network/campaign-hotspot-policy';
import { authorizeUnifiPortal, CampaignHotspotError, isUnifiPortalRequest } from '@/lib/network/campaign-hotspot';

export const dynamic = 'force-dynamic';

function normalizeHostValue(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
    );
    return parsed.hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .trim()
      .toLowerCase();
  }
}

function isPrivateIpv4Host(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 127
  );
}

function isIpv4Host(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function addTrustedHostVariants(target: Set<string>, rawHost: string | undefined): void {
  const host = normalizeHostValue(rawHost);
  if (!host) {
    return;
  }

  target.add(host);

  if (isIpv4Host(host) || host === 'localhost') {
    return;
  }

  const baseHost = host.startsWith('www.') ? host.slice(4) : host;
  if (baseHost) {
    target.add(baseHost);
  }

  if (baseHost && !baseHost.startsWith('hotspot.')) {
    target.add(`hotspot.${baseHost}`);
  }
}

function getTrustedHotspotHosts(): Set<string> {
  const trustedHosts = new Set<string>();

  addTrustedHostVariants(trustedHosts, process.env.NEXT_PUBLIC_APP_URL);

  addTrustedHostVariants(trustedHosts, process.env.MIKROTIK_HOST || process.env.MIKROTIK_IP);
  addTrustedHostVariants(
    trustedHosts,
    process.env.HOTSPOT_DNS_NAME || process.env.MIKROTIK_HOTSPOT_DNS_NAME
  );

  return trustedHosts;
}

function buildHotspotLoginRedirect(
  rawUrl: string,
  finalRedirect: string,
  trustedHosts: Set<string>
): string | null {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return null;
  }

  try {
    const loginUrl = new URL(rawUrl);
    const hostname = loginUrl.hostname.toLowerCase();

    const isTrustedHost =
      trustedHosts.has(hostname) || hostname === 'localhost' || isPrivateIpv4Host(hostname);

    if (!isTrustedHost) {
      return null;
    }

    loginUrl.searchParams.set('dst', finalRedirect);
    return loginUrl.toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstString = (...values: unknown[]) => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
      }
      return '';
    };

    const mac = firstString(body?.mac, body?.['mac-address'], body?.macAddress, body?.MAC);
    const ip = firstString(body?.ip, body?.['ip-address'], body?.ipAddress, body?.IP);
    const ssid = firstString(body?.ssid, body?.SSID, body?.['ssid-name']);
    const phone = firstString(body?.phone);
    const linkLogin = firstString(
      body?.linkLogin,
      body?.['link-login'],
      body?.linklogin,
      body?.linkLoginOnly,
      body?.['link-login-only']
    );
    const trial = firstString(
      body?.trial,
      body?.['link-trial'],
      body?.linktrial,
      body?.['link-login-only'],
      body?.linkLoginOnly
    );
    const campaignId = firstString(body?.campaignId, body?.['campaign-id']);
    const portalSessionId = firstString(body?.portalSessionId, body?.sessionId);
    const unifiSite = firstString(body?.unifiSite, body?.site);
    const unifiRequest = isUnifiPortalRequest(portalSessionId, unifiSite);
    if (unifiRequest && (!portalSessionId || !mac)) throw new CampaignHotspotError('Signed UniFi portal session required');
    const requestRedirectUrl = normalizeRedirectUrl(firstString(body?.redirectUrl));

    if (!mac && !trial && !linkLogin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu thông tin đăng nhập hotspot (cần mac hoặc trial/link-login)',
        },
        { status: 400 }
      );
    }

    if (!portalSessionId && !ssid) return NextResponse.json({ success: false, error: 'Signed portal session required' }, { status: 403 });
    const device = body?.device ? parseDevice(body.device) : undefined;
    const runtime = await resolvePortalAccess(prisma, { ssid, mac, device, unifiSite, apMac: firstString(body?.apMac, body?.['ap-mac']), campaignId }, portalSessionId);
    if (!runtime) return NextResponse.json({ success: false, error: 'Invalid or expired portal session' }, { status: 400 });
    if (!runtime.effectiveTemplateId) return NextResponse.json({ success: false, error: 'No published portal is configured for this network' }, { status: 403 });
    if (runtime.attendanceAmbiguous) return NextResponse.json({ success: false, error: 'Attendance network context is ambiguous' }, { status: 403 });
    if (!portalSessionId && requiresSignedPortalSession(runtime)) return NextResponse.json({ success: false, error: 'Signed portal session required' }, { status: 403 });
    const campaign = runtime.campaign;
    if (hasPublishedGate(runtime.layout, 'video_gate', runtime.device)) {
      if (!portalSessionId || !(await isVideoWatched(`${runtime.portalSessionId}:${mac.toLowerCase().replace(/-/g, ':') || 'unknown-client'}`))) {
        return NextResponse.json({ success: false, error: 'Video not watched' }, { status: 403 });
      }
    }
    if (unifiRequest && hasPublishedGate(runtime.layout, 'attendance_gate', runtime.device) && !runtime.attendanceSession) {
      return NextResponse.json({ success: false, error: 'Effective attendance session required' }, { status: 403 });
    }
    if (runtime.attendanceSession && hasPublishedGate(runtime.layout, 'attendance_gate', runtime.device) && !runtime.isAlreadyRegistered) {
      return NextResponse.json({ success: false, error: 'Attendance registration required' }, { status: 403 });
    }

    const unifiAuthorization = unifiRequest ? await authorizeUnifiPortal(portalSessionId) : null;

    // Upsert wifi user
    if (mac) {
      await prisma.wifiUser.upsert({
        where: { mac },
        update: { ip: ip || undefined, phone: phone || undefined },
        create: { mac, ip, phone },
      });
    }

    // Log the login
    if (campaign && mac) {
      await prisma.log.create({
        data: {
          mac,
          campaignId: campaign.id,
          phone,
          metadata: { ip, ssid, linkLogin },
        },
      });
    }

    // Always return users to configured portal/campaign redirect after authorization.
    // Never send them back to raw trial/link-login URLs (can be OS connectivity pages).
    const finalRedirect =
      requestRedirectUrl ||
      normalizeRedirectUrl(campaign?.redirectUrl) ||
      resolvePortalFallbackUrl(process.env.NEXT_PUBLIC_APP_URL);

    if (unifiAuthorization) return NextResponse.json({ success: true, data: unifiAuthorization });

    const trustedHosts = getTrustedHotspotHosts();

    const trialRedirect = buildHotspotLoginRedirect(trial, finalRedirect, trustedHosts);
    if (trialRedirect) {
      return NextResponse.json({
        success: true,
        data: { redirect: trialRedirect },
      });
    }

    const linkLoginRedirect = buildHotspotLoginRedirect(linkLogin, finalRedirect, trustedHosts);
    if (linkLoginRedirect) {
      return NextResponse.json({
        success: true,
        data: { redirect: linkLoginRedirect },
      });
    }

    // No trial/link-login URL and no MAC — cannot authorize
    return NextResponse.json(
      {
        success: false,
        error: 'Không có thông tin link hotspot hợp lệ để xác thực truy cập. Vui lòng kết nối lại WiFi.',
      },
      { status: 400 }
    );
  } catch (error) {
    if(error instanceof GuestClientPendingError)return NextResponse.json({success:false,pending:true,code:'UNIFI_AUTHORIZING',error:error.message},{status:202,headers:{'Cache-Control':'no-store','Retry-After':'2'}});
    if (error instanceof CampaignHotspotError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    if (error instanceof PortalContextError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
