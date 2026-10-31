import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, isAdminRole, requiresAdminAction, type AdminRole, type Permission } from '@/lib/permissions';
import { redactSecrets } from '@/lib/network/secrets';
export interface AdminIdentity { id: string; username: string; role: AdminRole }
export class AccessError extends Error { constructor(public status: number, message: string) { super(message); this.name='AccessError'; } }
export async function getIdentity(req: NextRequest): Promise<AdminIdentity> {
  const payload=authenticateRequest(req);
  if(!payload || typeof payload.id!=='string')throw new AccessError(401,'Vui lòng đăng nhập để tiếp tục.');
  const account=await prisma.admin.findUnique({where:{id:payload.id},select:{id:true,username:true,role:true,disabled:true}});
  if(!account || account.disabled || !isAdminRole(account.role))throw new AccessError(401,'Tài khoản không còn hiệu lực. Vui lòng đăng nhập lại.');
  return {id:account.id,username:account.username,role:account.role};
}
export function errorResponse(error: unknown): NextResponse {
  if(error instanceof AccessError)return NextResponse.json({success:false,error:error.message},{status:error.status});
  console.error('[admin-api]',redactSecrets(error instanceof Error?error.message:String(error)));
  return NextResponse.json({success:false,error:'Không thể xử lý yêu cầu. Kiểm tra kết nối và nhật ký hệ thống.'},{status:500});
}
function checkWriteOrigin(req: NextRequest) {
  if(['GET','HEAD','OPTIONS'].includes(req.method))return;
  const origin=req.headers.get('origin');
  if(req.headers.get('sec-fetch-site')==='cross-site')throw new AccessError(403,'Nguồn yêu cầu không được phép.');
  // A verified, explicitly sent bearer token is not ambient cookie authority.
  // Frontend rewrites change req.url to the backend address on LAN deployments.
  if(req.headers.get('authorization')?.startsWith('Bearer '))return;
  if(!origin)return;
  const allowed=new Set([new URL(req.url).origin]);
  for(const value of [process.env.NEXT_PUBLIC_APP_URL,process.env.NEXT_PUBLIC_API_URL]){try{if(value)allowed.add(new URL(value).origin);}catch{}}
  if(!allowed.has(origin))throw new AccessError(403,'Nguồn yêu cầu không được phép.');
}
export function withPermission<C = any>(level: Permission, handler: (req: NextRequest, context: C) => Promise<Response> | Response) {
  return async function protectedHandler(req: NextRequest, context?: C): Promise<Response> {
    const started=Date.now();
    let response:Response;
    try {
      const user=await getIdentity(req); checkWriteOrigin(req);
      let required=level;
      if(!['GET','HEAD','OPTIONS'].includes(req.method)){
        let body:unknown;
        try{body=await req.clone().json();}catch{}
        if(requiresAdminAction(body))required='admin';
      }
      if(!hasPermission(user.role,required))throw new AccessError(403,'Tài khoản không có quyền thực hiện thao tác này.');
      response=await handler(req,context as C);
      if(user.role==='VIEWER' && /^\/api\/(unifi|mikrotik)\//.test(new URL(req.url).pathname) && response.headers.get('content-type')?.includes('application/json')){
        const headers=new Headers(response.headers);headers.delete('content-length');
        response=new NextResponse(JSON.stringify(redactSecrets(await response.clone().json())),{status:response.status,headers});
      }
    } catch(error) {response=errorResponse(error);}
    // Include rejected requests and handler failures in error/latency counters.
    if(process.env.MONITOR_PROCESS_ENABLED!=='false')void import('@/lib/monitor/process').then(m=>m.recordApiRequest(Date.now()-started,response.status)).catch(()=>{});
    return response;
  };
}
