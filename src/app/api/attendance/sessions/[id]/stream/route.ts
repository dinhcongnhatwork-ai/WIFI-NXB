import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { attendanceSessionView } from '@/lib/attendance/session-view';
import Redis from 'ioredis';
export const dynamic='force-dynamic';
async function handleGET(req:NextRequest,{params}:{params:{id:string}}) {
  const initial=await attendanceSessionView(params.id);
  if(!initial)return NextResponse.json({success:false,error:'Không tìm thấy buổi điểm danh.'},{status:404});
  let abort=()=>{};
  let closed=false,subscriber:Redis|null=null,timer:ReturnType<typeof setInterval>|null=null,pushing=false;
  const cleanup=()=>{if(closed)return;closed=true;if(timer)clearInterval(timer);subscriber?.disconnect();req.signal.removeEventListener('abort',abort);};
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      const send=(data:NonNullable<typeof initial>)=>{
        if(closed)return;
        try{controller.enqueue(new TextEncoder().encode(`event: attendance_update\ndata: ${JSON.stringify({...data,sessionId:data.id})}\n\n`));}catch{cleanup();}
      };
      send(initial);
      const push=async()=>{
        if(closed || pushing)return;pushing=true;
        try{const data=await attendanceSessionView(params.id);if(data)send(data);else{controller.enqueue(new TextEncoder().encode('event: session_deleted\ndata: {}\n\n'));controller.close();cleanup();}}catch{/* next fallback poll retries */}finally{pushing=false;}
      };
      abort=()=>{try{controller.close();}catch{}cleanup();};
      req.signal.addEventListener('abort',abort,{once:true});
      if(req.signal.aborted){abort();return;}
      timer=setInterval(()=>void push(),5000);
      try{
        subscriber=new Redis(process.env.REDIS_URL || 'redis://localhost:6379',{lazyConnect:true,maxRetriesPerRequest:1,retryStrategy:()=>null});
        subscriber.on('error',()=>{});
        subscriber.on('message',()=>void push());
        void subscriber.subscribe(`attendance:${params.id}`).catch(()=>subscriber?.disconnect());
      }catch{}
    },cancel:cleanup,
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
}
export const GET=withPermission('read',handleGET);
