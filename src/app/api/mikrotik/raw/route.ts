import { NextRequest, NextResponse } from 'next/server';
import { createMikrotikClientFromRequest } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

type SupportedMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parseMethod(value: string | null | undefined): SupportedMethod {
  const normalized = (value || 'GET').toUpperCase();
  if (normalized === 'POST') return 'POST';
  if (normalized === 'PUT') return 'PUT';
  if (normalized === 'PATCH') return 'PATCH';
  if (normalized === 'DELETE') return 'DELETE';
  return 'GET';
}

export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json({ success: false, error: 'Thiếu query path' }, { status: 400 });
    }

    const client = createMikrotikClientFromRequest(req);
    const data = await client.rawGet(path);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể call MikroTik raw API',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, method, payload } = body as { path?: string; method?: string; payload?: unknown };

    if (!path) {
      return NextResponse.json({ success: false, error: 'Thiếu path' }, { status: 400 });
    }

    const resolvedMethod = parseMethod(method);
    const client = createMikrotikClientFromRequest(req);
    const data = await client.rawRequest(path, resolvedMethod, payload);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể call MikroTik raw API',
      },
      { status: 500 }
    );
  }
}
