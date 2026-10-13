'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import { isTemplateDocumentV2 } from '@/lib/template-document';
import PortalRenderer from '@/components/renderer/PortalRenderer';
import ParticipantAttendanceDialog from '@/components/attendance/ParticipantAttendanceDialog';
import type { TemplateConfig, PortalParams } from '@/types';
import { isTemplateConfig, createDefaultTemplateConfig, normalizeTemplateConfigMedia } from '@/types';
import { AttendanceSessionDto } from '@/types/attendance';
import { Wifi, Sparkles, CheckCircle2 } from 'lucide-react';

interface PortalData {
  layout: unknown;
  params: Partial<PortalParams>;
  templateId?: string;
  campaignId?: string;
  redirectUrl?: string;
  attendanceSession?: AttendanceSessionDto | null;
  isAlreadyRegistered?: boolean;
}

function getAttendanceGateElement(layout: unknown): any {
  if (!layout || typeof layout !== 'object') return null;
  const doc = layout as any;
  if (doc.variants) {
    for (const vKey of ['mobile', 'tablet', 'desktop']) {
      const variant = doc.variants[vKey];
      if (variant?.sections) {
        for (const s of variant.sections) {
          for (const n of s.nodes || []) {
            if (n.element?.type === 'attendance_gate') return n.element;
          }
        }
      }
      if (variant?.flow?.attendanceGate?.element) {
        return variant.flow.attendanceGate.element;
      }
    }
  }
  if (Array.isArray(doc.elements)) {
    return doc.elements.find((el: any) => el.type === 'attendance_gate') || null;
  }
  return null;
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}

function PortalContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    const pickFirst = (...keys: string[]) => {
      for (const key of keys) {
        const value = searchParams.get(key);
        if (value && value.trim()) return value.trim();
      }
      return '';
    };

    const mac = pickFirst('mac', 'MAC', 'mac-address', 'macaddress', 'client-mac');
    const ip = pickFirst('ip', 'IP', 'ip-address', 'client-ip');
    const ssid = pickFirst('ssid', 'SSID', 'ssid-name', 'called-station-id');
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

    if (mac) params.set('mac', mac);
    if (ip) params.set('ip', ip);
    if (ssid) params.set('ssid', ssid);
    if (linkLogin) params.set('link-login', linkLogin);
    if (linkLoginOnly) params.set('link-login-only', linkLoginOnly);
    if (linkOrig) params.set('link-orig', linkOrig);
    if (trial) params.set('trial', trial);

    fetch(`/api/portal?${params}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          // If meeting attendance is active and this device is not yet registered, show dialog
          if (res.data?.attendanceSession && !res.data?.isAlreadyRegistered) {
            setShowAttendanceDialog(true);
          }
        } else {
          setError(res.error || 'Failed to load portal');
        }
      })
      .catch(() => setError('Connection error'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800 mb-2">WiFi Portal</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const clientMac = data.params?.mac || '';
  const clientIp = data.params?.ip || '';
  const clientSsid = data.params?.ssid || '';

  // MikroTik $(trial) returns "yes"/"no" — NOT a URL.
  // The real trial login URL is in $(link-login-only).
  // Only accept values that look like valid HTTP(S) URLs.
  const isValidHttpUrl = (s: string) => /^https?:\/\//i.test(s);

  const rawTrialUrl = (data.params as any)?.trial || '';
  const rawLinkLogin = (data.params as any)?.['link-login'] || '';
  const rawLinkLoginOnly = (data.params as any)?.['link-login-only'] || '';

  // Pick the best valid URL for trial login
  const trialUrl = [rawTrialUrl, rawLinkLoginOnly, rawLinkLogin].find(isValidHttpUrl) || '';
  const linkLoginUrl = [rawLinkLogin, rawLinkLoginOnly].find(isValidHttpUrl) || '';

  const gateElement = getAttendanceGateElement(data?.layout);
  const dialogTheme = gateElement?.dialogTheme || 'luxury_gold';

  return (
    <>
      {/* Attendance Session Floating Prompt */}
      {data.attendanceSession && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%]">
          <div className="rounded-full bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 shadow-2xl ring-1 ring-white/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full ${data.isAlreadyRegistered ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'} flex-shrink-0`} />
              <div className="truncate">
                <p className="font-bold truncate">{data.attendanceSession.name}</p>
                <p className="text-[10px] text-slate-300">
                  {data.isAlreadyRegistered ? 'Đã điểm danh • Bấm "Kết nối ngay" bên dưới' : 'Yêu cầu điểm danh trước khi truy cập'}
                </p>
              </div>
            </div>
            {!data.isAlreadyRegistered ? (
              <button
                type="button"
                onClick={() => setShowAttendanceDialog(true)}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-bold text-[11px] shadow-sm flex-shrink-0 transition-transform active:scale-95"
              >
                Điểm danh ngay
              </button>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã xác thực
              </span>
            )}
          </div>
        </div>
      )}

      {/* Participant Attendance Modal Dialog */}
      {data.attendanceSession && (
        <ParticipantAttendanceDialog
          isOpen={showAttendanceDialog}
          onClose={() => setShowAttendanceDialog(false)}
          onSuccess={() => {
            setData((prev) => (prev ? { ...prev, isAlreadyRegistered: true } : prev));
            setShowAttendanceDialog(false);
          }}
          session={data.attendanceSession}
          clientMac={clientMac}
          clientIp={clientIp}
          ssid={clientSsid}
          trialUrl={trialUrl}
          linkLoginUrl={linkLoginUrl}
          linkLoginOnly={rawLinkLoginOnly}
          campaignId={data.campaignId}
          theme={dialogTheme}
          gateElement={gateElement}
        />
      )}

      {isTemplateDocumentV2(data.layout) ? (
        <DocumentRenderer
          document={data.layout}
          params={data.params}
          campaignId={data.campaignId}
          redirectUrl={data.redirectUrl}
        />
      ) : data.layout && typeof data.layout === 'object' && 'schemaVersion' in data.layout ? (
        <p role="alert">Phiên bản mẫu không được hỗ trợ.</p>
      ) : (
        <PortalRenderer
          config={
            isTemplateConfig(data.layout)
              ? normalizeTemplateConfigMedia(data.layout)
              : createDefaultTemplateConfig()
          }
          params={data.params}
          redirectUrl={data.redirectUrl}
          campaignId={data.campaignId}
        />
      )}
    </>
  );
}
