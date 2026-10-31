import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

function signingSecret(): string {
  const secret=process.env.JWT_SECRET;
  if(!secret || secret==='change-me-in-production')throw new Error('Máy chủ chưa cấu hình JWT_SECRET.');
  return secret;
}

export function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, signingSecret(), { expiresIn: '24h' });
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    return jwt.verify(token, signingSecret(), { algorithms: ['HS256'] }) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.cookies.get('token')?.value || null;
}

export function authenticateRequest(req: NextRequest): Record<string, unknown> | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}
