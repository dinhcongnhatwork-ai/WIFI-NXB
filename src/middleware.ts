import {NextRequest,NextResponse} from 'next/server';
import {backendDestination} from '@/lib/backend-proxy';
export function middleware(req:NextRequest){
 try{
  const destination=backendDestination(req.url,process.env.APP_SERVER_MODE,process.env.BACKEND_URL);
  return destination?NextResponse.rewrite(new URL(destination)):NextResponse.next();
 }catch{return NextResponse.json({success:false,error:'Chưa cấu hình kết nối backend hợp lệ.'},{status:503});}
}
export const config={matcher:['/api/:path*']};
