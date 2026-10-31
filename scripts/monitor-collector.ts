import { collectOnce } from '../src/lib/monitor/collector';
import { enqueueLog } from '../src/lib/monitor/logs';
import { startProcessSampler, startAppLogCapture } from '../src/lib/monitor/process';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
let stopping=false;process.env.APP_SERVER_MODE='collector';startProcessSampler();startAppLogCapture();
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function main(){while(!stopping){const started=Date.now();try{await collectOnce();}catch(error){await enqueueLog({source:'collector',severity:'error',message:'Collection cycle failed',metadata:{error}});}if(process.argv.includes('--once'))break;await new Promise(r=>setTimeout(r,Math.max(1000,30_000-(Date.now()-started))));}await prisma.$disconnect();await redis.quit();}
void main().catch(error=>{console.error(error);process.exitCode=1;});
