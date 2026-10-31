import { prisma } from '../src/lib/prisma';
import { runRetention } from '../src/lib/monitor/retention';
async function main(){try{console.log(JSON.stringify(await runRetention()));}finally{await prisma.$disconnect();}}
void main().catch(error=>{console.error(error);process.exitCode=1;});
