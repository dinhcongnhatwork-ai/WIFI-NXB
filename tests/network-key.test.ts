import {describe,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
describe('deployment encryption key generation',()=>{
 it('fills an empty example key once and preserves it on subsequent runs without printing secrets',()=>{
  const directory=mkdtempSync(join(tmpdir(),'wifi-network-key-test-')),file=join(directory,'.env');
  try{writeFileSync(file,'EXISTING=value\nNETWORK_CREDENTIALS_KEY=\n');const run=()=>spawnSync(process.execPath,[resolve('scripts/network-key.mjs')],{env:{...process.env,NETWORK_ENV_FILE:file},encoding:'utf8'});const first=run();expect(first.status).toBe(0);const content=readFileSync(file,'utf8');const key=content.match(/^NETWORK_CREDENTIALS_KEY=([a-f0-9]{64})$/m)?.[1];expect(key).toHaveLength(64);expect(content).toContain('EXISTING=value');const second=run();expect(second.status).toBe(0);expect(readFileSync(file,'utf8')).toBe(content);expect(first.stdout+second.stdout).not.toContain(key);}
  finally{rmSync(directory,{recursive:true,force:true});}
 });
});
