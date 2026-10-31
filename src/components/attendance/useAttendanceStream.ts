'use client';
import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';
export function useAttendanceStream(id:string, enabled:boolean, onData:(data:any)=>void, onDeleted:()=>void) {
  const handler=useRef(onData),deleted=useRef(onDeleted);handler.current=onData;deleted.current=onDeleted;
  const [connected,setConnected]=useState(false);
  useEffect(()=>{
    if(!enabled){setConnected(false);return;}
    let stopped=false,request:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined,lastMessage=Date.now();
    const watch=setInterval(()=>{if(Date.now()-lastMessage>20000){setConnected(false);request?.abort();}},5000);
    async function connect(){
      request=new AbortController();lastMessage=Date.now();
      try{
        const response=await authenticatedFetch(`/api/attendance/sessions/${id}/stream`,{headers:{Accept:'text/event-stream'},signal:request.signal});
        if(!response.ok || !response.body)throw new Error('Không kết nối được luồng dữ liệu.');
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
        try{while(!stopped){
          const {done,value}=await reader.read();if(done || stopped)break;buffer+=decoder.decode(value,{stream:true});
          let boundary:number;
          while((boundary=buffer.indexOf('\n\n'))>=0){
            const message=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
            if(message.includes('event: session_deleted')){deleted.current();return;}
            const line=message.split('\n').find(line=>line.startsWith('data: '));
            if(line){try{const data=JSON.parse(line.slice(6));if(data.sessionId===id){handler.current(data);setConnected(true);lastMessage=Date.now();}}catch{}}
          }
        }}finally{await reader.cancel().catch(()=>{});}
      }catch{/* reconnect without issuing write requests */}finally{
        if(!stopped){setConnected(false);timer=setTimeout(()=>void connect(),3000);}
      }
    }
    void connect();return()=>{stopped=true;request?.abort();clearInterval(watch);if(timer)clearTimeout(timer);};
  },[id,enabled]);
  return connected;
}
