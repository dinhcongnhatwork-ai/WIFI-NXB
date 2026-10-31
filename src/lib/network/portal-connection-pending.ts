import {NextRequest,NextResponse} from 'next/server';
import {readPortalSessionId} from '@/lib/attendance/runtime';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function refreshedPortalUrl(token:unknown):string|null{
 const s=readPortalSessionId(token);if(!s?.unifiSite)return null;
 const q=new URLSearchParams({mac:s.mac,ssid:s.ssid,apMac:s.apMac,unifiSite:s.unifiSite});return '/portal?'+q;
}
/** Only reached after an explicit connect request, never from loading the portal. */
export function portalConnectionPending(req:NextRequest):NextResponse{
 const incoming=new URL(req.url);const raw=Number(incoming.searchParams.get('_wifiRetry')||0);const attempt=Number.isInteger(raw)&&raw>=0?raw:20;const started=Number(incoming.searchParams.get('_wifiStarted')||Date.now());const startedAt=Number.isFinite(started)&&started>0&&started<=Date.now()?started:Date.now();const again=attempt<20&&Date.now()-startedAt<45000;
 incoming.searchParams.set('_wifiRetry',String(attempt+1));incoming.searchParams.set('_wifiStarted',String(startedAt));const next=escape(incoming.pathname+incoming.search);const portal=escape(refreshedPortalUrl(incoming.searchParams.get('portalSessionId'))||'/portal');
 const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${again?`<meta http-equiv="refresh" content="2;url=${next}">`:''}<title>Kết nối WiFi</title><style>body{font:17px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#172033}main{padding:28px;max-width:420px;text-align:center}a{display:inline-block;margin-top:20px;padding:14px 20px;background:#b91c1c;color:#fff;border-radius:10px;text-decoration:none}</style></head><body><main><h1>${again?'Đang xác thực kết nối WiFi':'Chưa xác minh được thiết bị'}</h1><p>${again?'Đang mở quyền truy cập Internet. Trang sẽ tự chuyển khi kết nối sẵn sàng.':'Hãy giữ kết nối với WiFi này và mở lại trang kết nối.'}</p><a href="${portal}">Mở lại trang kết nối</a></main></body></html>`;
 return new NextResponse(html,{status:again?202:408,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Retry-After':'2','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}

/** Captive browsers need a readable recovery screen rather than raw server JSON or a portal loop. */
export function portalConnectionFailure(req:NextRequest,status=503):NextResponse{
 const incoming=new URL(req.url);incoming.searchParams.delete('_wifiRetry');incoming.searchParams.delete('_wifiStarted');
 const retry=escape(incoming.pathname+incoming.search),portal=escape(refreshedPortalUrl(incoming.searchParams.get('portalSessionId'))||'/portal');
 return new NextResponse(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kết nối WiFi</title></head><body style="font:17px system-ui;padding:28px;max-width:440px;margin:15vh auto"><h1>Chưa hoàn tất kết nối WiFi</h1><p>Điểm phát chưa xác nhận quyền Internet. Hãy giữ kết nối WiFi và thử lại.</p><p><a href="${retry}">Thử lại kết nối</a></p><p><a href="${portal}">Mở lại trang WiFi</a></p></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
