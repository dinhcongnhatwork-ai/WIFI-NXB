import { NextRequest, NextResponse } from 'next/server';
import { normalizeStoredMedia } from '@/lib/template-publishing';
import { prisma } from '@/lib/prisma';
import { normalizeRedirectUrl } from '@/lib/redirect-url';
import { attendanceSessionDto, parseDevice, PortalContextError, resolvePortalRuntime } from '@/lib/attendance/runtime';
import { createPresetDocument } from '@/lib/template-presets';
import { isTemplateDocumentV2 } from '@/lib/template-document';
import { isTemplateConfig } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pickFirst = (...keys: string[]) => keys.map(key => searchParams.get(key)?.trim()).find(Boolean) || '';
    const ssid = pickFirst('ssid', 'SSID', 'ssid-name', 'called-station-id');
    const mac = pickFirst('mac', 'MAC', 'mac-address', 'macaddress', 'client-mac');
    const ip = pickFirst('ip', 'IP', 'ip-address', 'client-ip');
    const apMac = pickFirst('apMac', 'ap-mac', 'ap', 'AP');
    const templateId = pickFirst('templateId', 'template_id', 'template', 'id');
    const preset = pickFirst('preset', 'presetId');

    const runtime = await resolvePortalRuntime(prisma, {
      ssid,
      mac,
      apMac,
      templateId: templateId || undefined,
      unifiSite: pickFirst('unifiSite', 'site'),
      device: parseDevice(searchParams.get('device')),
    });

    let layout = runtime.layout ? normalizeStoredMedia(runtime.layout) : null;
    if (!layout || (!isTemplateDocumentV2(layout) && !isTemplateConfig(layout))) {
      try {
        layout = createPresetDocument(preset || 'van-hoa-doc');
      } catch {
        layout = createPresetDocument('van-hoa-doc');
      }
    }

    const params = {
      mac,
      ip,
      ssid,
      apMac,
      device: runtime.device,
      unifiSite: pickFirst('unifiSite', 'site'),
      'link-login': pickFirst('link-login', 'linklogin', 'link_login', 'linkLogin'),
      'link-login-only': pickFirst('link-login-only', 'linkLoginOnly'),
      'link-orig': pickFirst('link-orig', 'linkorig', 'link_orig', 'linkOrig'),
      trial: pickFirst('trial', 'link-trial', 'linktrial'),
    };

    return NextResponse.json({
      success: true,
      data: {
        layout,
        templateId: runtime.effectiveTemplateId,
        effectiveTemplateId: runtime.effectiveTemplateId,
        publishedRevisionId: runtime.publishedRevisionId,
        portalSessionId: runtime.portalSessionId,
        campaignId: runtime.campaign?.id || null,
        redirectUrl: normalizeRedirectUrl(runtime.campaign?.redirectUrl) || '',
        params,
        attendanceSession: runtime.attendanceSession ? attendanceSessionDto(runtime.attendanceSession) : null,
        isAlreadyRegistered: runtime.isAlreadyRegistered,
        attendanceAmbiguous: runtime.attendanceAmbiguous,
      },
    });
  } catch (error) {
    if (error instanceof PortalContextError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('Portal API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

