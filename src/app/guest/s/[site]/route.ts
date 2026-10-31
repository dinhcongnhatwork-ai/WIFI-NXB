import { NextRequest, NextResponse } from 'next/server';
import { resolveCallbackSsid } from '@/lib/network/unifi-callback-context';
import { GuestClientPendingError } from '@/lib/network/campaign-hotspot-policy';
import { normalizeMac, validMac } from '@/lib/network/campaign-hotspot-policy';
export const dynamic = 'force-dynamic';
/** Legacy external-portal callback. Site membership and live identity are validated by /api/portal. */
export async function GET(req: NextRequest, { params }: { params: { site: string } }) {
  const query = new URL(req.url).searchParams;
  const mac = normalizeMac(query.get('id')), apMac = normalizeMac(query.get('ap'));
  let ssid = query.get('ssid')?.trim() || '';
  if (!/^[a-zA-Z\d_-]{1,100}$/.test(params.site) || !validMac(mac) || !validMac(apMac) || ssid.length > 128) {
    return NextResponse.json({ success: false, error: 'Invalid UniFi portal callback' }, { status: 400 });
  }
  if (!ssid) {
    try { ssid = await resolveCallbackSsid(params.site, mac, apMac); }
    catch (error) {
      if (!(error instanceof GuestClientPendingError)) return NextResponse.json({success:false,error:'Không xác minh được WiFi của thiết bị.'},{status:403,headers:{'Cache-Control':'no-store'}});
      // Allow AP association to settle, without authorizing or retrying forever.
      const url=new URL(req.url),attempt=Number(url.searchParams.get('_portalRetry')||0);
      const again=Number.isInteger(attempt)&&attempt>=0&&attempt<10;
      url.searchParams.set('_portalRetry',String(again?attempt+1:0));
      const href=(url.pathname+url.search).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
      return new NextResponse(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${again?`<meta http-equiv="refresh" content="2;url=${href}">`:''}<title>Đăng nhập WiFi</title></head><body style="font:17px system-ui;padding:28px;max-width:440px;margin:15vh auto"><h1>${again?'Đang mở trang WiFi':'Chưa nhận diện được kết nối WiFi'}</h1><p>Hãy giữ kết nối với WiFi này để mở trang xác thực.</p><a href="${href}">Mở lại trang WiFi</a></body></html>`,{status:again?202:408,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
    }
  }
  try {
    const publicUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
    if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password) throw new Error('Invalid portal configuration');
    const target = new URL('/portal', publicUrl);
    for (const [key, value] of Object.entries({ mac, apMac, ssid, unifiSite: params.site })) target.searchParams.set(key, value);
    return NextResponse.redirect(target, {status:302,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  } catch {
    return NextResponse.json({ success: false, error: 'Public HTTPS portal is not configured' }, { status: 503 });
  }
}
