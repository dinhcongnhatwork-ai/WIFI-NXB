import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { normalizeRedirectUrl } from '@/lib/redirect-url';

export async function POST(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawRedirectUrl =
      typeof body?.redirectUrl === 'string'
        ? body.redirectUrl
        : typeof body?.url === 'string'
          ? body.url
          : '';

    if (!rawRedirectUrl.trim()) {
      return NextResponse.json({
        success: true,
        data: { redirectUrl: '' },
      });
    }

    const normalized = normalizeRedirectUrl(rawRedirectUrl);
    if (!normalized) {
      return NextResponse.json(
        { success: false, error: 'Redirect URL không hợp lệ' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { redirectUrl: normalized },
    });
  } catch (error) {
    console.error('Normalize redirect URL error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
