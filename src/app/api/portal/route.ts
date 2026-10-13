import { NextRequest, NextResponse } from 'next/server';
import { normalizeStoredMedia } from '@/lib/template-publishing';
import { prisma } from '@/lib/prisma';
import { normalizeRedirectUrl } from '@/lib/redirect-url';

export const dynamic = 'force-dynamic';

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

    const ssid = pickFirst('ssid', 'SSID', 'ssid-name', 'called-station-id');
    const mac = pickFirst('mac', 'MAC', 'mac-address', 'macaddress', 'client-mac');
    const ip = pickFirst('ip', 'IP', 'ip-address', 'client-ip');
    const linkLogin = pickFirst(
      'link-login',
      'linklogin',
      'link_login',
      'linkLogin'
    );
    const linkLoginOnly = pickFirst(
      'link-login-only',
      'linkLoginOnly'
    );
    const linkOrig = pickFirst('link-orig', 'linkorig', 'link_orig', 'linkOrig');
    const trial = pickFirst('trial', 'link-trial', 'linktrial');

    // Check for active Meeting Attendance Session matching SSID or any ACTIVE session
    let attendanceSession = null;
    let isAlreadyRegistered = false;

    if (ssid) {
      attendanceSession = await prisma.attendanceSession.findFirst({
        where: {
          ssid: ssid.trim(),
          status: 'ACTIVE',
        },
      });
    }

    if (!attendanceSession) {
      attendanceSession = await prisma.attendanceSession.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (attendanceSession && mac) {
      const existingReg = await prisma.attendanceRegistration.findFirst({
        where: {
          sessionId: attendanceSession.id,
          primaryMac: mac.trim().toLowerCase(),
        },
      });
      isAlreadyRegistered = Boolean(existingReg);
    }

    // Priority 0 (HIGHEST): If an ACTIVE attendance session has a linked campaign, use it.
    // This ensures the admin's chosen campaign/template is always shown during meetings.
    let campaign = attendanceSession?.campaignId
      ? await prisma.campaign.findFirst({
          where: {
            id: attendanceSession.campaignId,
            template: { publishedRevisionId: { not: null } },
          },
          include: { template: { include: { publishedRevision: true } } },
        })
      : null;

    // Priority 1: Find campaign with portalEnabled = true (explicit portal assignment)
    if (!campaign) {
      campaign = await prisma.campaign.findFirst({
        where: {
          portalEnabled: true,
          active: true,
          template: { publishedRevisionId: { not: null } },
        },
        include: { template: { include: { publishedRevision: true } } },
      });
    }

    // Priority 2: Find active campaign matching SSID
    if (!campaign && ssid) {
      campaign = await prisma.campaign.findFirst({
        where: {
          ssid,
          active: true,
          template: { publishedRevisionId: { not: null } },
        },
        include: { template: { include: { publishedRevision: true } } },
      });
    }

    if (!campaign || !campaign.template.publishedRevision) {
      return NextResponse.json({
        success: true,
        data: {
          layout: { type: 'page', children: [{ type: 'text', props: { content: '<h2>WiFi Portal</h2><p>Vui lòng kết nối WiFi</p>', align: 'center' } }] },
          params: { mac, ip, ssid, 'link-login': linkLogin, 'link-login-only': linkLoginOnly, 'link-orig': linkOrig, trial },
          attendanceSession: attendanceSession ? {
            id: attendanceSession.id,
            name: attendanceSession.name,
            location: attendanceSession.location,
            ssid: attendanceSession.ssid,
            formSchema: attendanceSession.formSchema,
            dialogTitle: attendanceSession.dialogTitle,
            dialogDescription: attendanceSession.dialogDescription,
            confirmButtonText: attendanceSession.confirmButtonText,
            successMessage: attendanceSession.successMessage,
          } : null,
          isAlreadyRegistered,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        layout: normalizeStoredMedia(campaign.template.publishedRevision.layoutJson),
        templateId: campaign.template.id,
        campaignId: campaign.id,
        redirectUrl: normalizeRedirectUrl(campaign.redirectUrl) || '',
        params: { mac, ip, ssid, 'link-login': linkLogin, 'link-login-only': linkLoginOnly, 'link-orig': linkOrig, trial },
        attendanceSession: attendanceSession ? {
          id: attendanceSession.id,
          name: attendanceSession.name,
          location: attendanceSession.location,
          ssid: attendanceSession.ssid,
          formSchema: attendanceSession.formSchema,
          dialogTitle: attendanceSession.dialogTitle,
          dialogDescription: attendanceSession.dialogDescription,
          confirmButtonText: attendanceSession.confirmButtonText,
          successMessage: attendanceSession.successMessage,
        } : null,
        isAlreadyRegistered,
      },
    });
  } catch (error) {
    console.error('Portal API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
