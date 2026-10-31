export const dynamic = 'force-dynamic';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where = search
      ? {
          OR: [
            { mac: { contains: search } },
            { phone: { contains: search } },
            { ip: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.wifiUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wifiUser.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withPermission('read', handleGET);
