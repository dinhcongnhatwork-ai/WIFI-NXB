import {mkdtempSync,cpSync,readdirSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
// The ignored pre-baseline portal ALTER is already in the 20260909 baseline.
// Stage an explicit history without moving/deleting any user's local migration.
const root=process.cwd(),stage=mkdtempSync(join(tmpdir(),'wifi-network-migrate-'));
try{
 const dir=join(stage,'migrations');mkdirSync(dir);
 cpSync(resolve('prisma/schema.prisma'),join(stage,'schema.prisma'));
 for(const name of readdirSync(resolve('prisma/migrations'))){
  if(name==='migration_lock.toml'||(/^\d{14}_/.test(name)&&name>='20260909000000_existing_schema_baseline'))cpSync(resolve('prisma/migrations',name),join(dir,name),{recursive:true});
 }
 // Prisma reads the root .env; process environment overrides it for isolated rehearsals.
 const result=spawnSync(resolve('node_modules/.bin/prisma'),['migrate','deploy','--schema',join(stage,'schema.prisma')],{cwd:root,env:process.env,stdio:'inherit'});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}finally{rmSync(stage,{recursive:true,force:true});}
