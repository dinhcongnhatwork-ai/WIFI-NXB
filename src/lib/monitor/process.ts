import { availableParallelism, totalmem } from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { redis } from '@/lib/redis';
import { enqueueLog, redactLog } from './logs';
const state=globalThis as unknown as {monitorSampler?:ReturnType<typeof setInterval>;monitorLogCapture?:boolean};
export function startProcessSampler() {
  if(state.monitorSampler)return;
  const mode=process.env.APP_SERVER_MODE||'backend';
  const delay=monitorEventLoopDelay({resolution:20});delay.enable();
  let previous=process.cpuUsage(),at=process.hrtime.bigint();
  const sample=async()=>{
    const now=process.hrtime.bigint(),usage=process.cpuUsage(),elapsed=Number(now-at)/1000;
    const memory=process.memoryUsage();
    const metrics={...getRequestMetrics(),'cpu.percent':Math.min(100,Math.max(0,(usage.user+usage.system-previous.user-previous.system)/elapsed/availableParallelism()*100)),'memory.percent':memory.rss/totalmem()*100,'memory.total.bytes':totalmem(),'memory.rss.bytes':memory.rss,'memory.heap.bytes':memory.heapUsed,'memory.heap_total.bytes':memory.heapTotal,'eventloop.ms':Number.isFinite(delay.mean)?delay.mean/1e6:undefined,'uptime.seconds':process.uptime(),'available':1};
    previous=usage;at=now;delay.reset();
    try{await redis.set(`monitor:process:${mode}`,JSON.stringify({at:Date.now(),pid:process.pid,metrics}),'EX',120);}catch{/* Collector exposes Redis outage separately. */}
  };
  state.monitorSampler=setInterval(()=>void sample(),30_000);state.monitorSampler.unref();
  void sample();
}
export function startAppLogCapture() {
  if(state.monitorLogCapture)return;state.monitorLogCapture=true;
  for(const level of ['warn','error'] as const){const original=console[level].bind(console);console[level]=(...args:unknown[])=>{original(...args.map(v=>redactLog(v)));void enqueueLog({source:process.env.APP_SERVER_MODE||'application',severity:level==='warn'?'warning':'error',message:args.map(v=>v instanceof Error?redactLog(v.message):typeof v==='string'?redactLog(v):JSON.stringify(redactLog(v))).join(' '),metadata:{args}});};}
}
const requests={count:0,errors:0,totalMs:0,maxMs:0};
export function recordApiRequest(durationMs:number,status:number){requests.count++;if(status>=500)requests.errors++;requests.totalMs+=durationMs;requests.maxMs=Math.max(requests.maxMs,durationMs);}
export function getRequestMetrics(){return {'http.requests.count':requests.count,'http.errors.count':requests.errors,'http.latency.mean.ms':requests.count?requests.totalMs/requests.count:undefined,'http.latency.max.ms':requests.count?requests.maxMs:undefined};}
