import { NextResponse } from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({status:'ok',mode:process.env.APP_SERVER_MODE||'unknown',at:new Date().toISOString()});}
