import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { withPermission } from '@/lib/api-access';
import { resolveConnection } from '@/lib/network/connections';
import { POST as saveConnection,GET as listConnections } from '@/app/api/network/connections/route';
import { DELETE as deleteConnection } from '@/app/api/network/connections/[id]/route';
import { POST as login } from '@/app/api/auth/login/route';
import bcrypt from 'bcryptjs';
import { POST as saveAccount } from '@/app/api/admin/accounts/route';
const enabled=Boolean(process.env.NETWORK_TEST_DATABASE_URL);
const suite=enabled?describe:describe.skip;
const identity=(id:string)=>signToken({id,username:id,role:'ADMIN'});
const req=(url:string,id:string,body?:unknown)=>new NextRequest(`http://localhost${url}`,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${identity(id)}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
suite('administrative API and migration integration with isolated PostgreSQL',()=>{
 beforeAll(async()=>{
  if(process.env.DATABASE_URL!==process.env.NETWORK_TEST_DATABASE_URL||new URL(process.env.DATABASE_URL||'http://invalid').pathname!=='/wifi_verify')throw new Error('Integration tests require the explicitly selected isolated wifi_verify database.');
  await prisma.networkConnection.deleteMany();
  await prisma.systemSetting.deleteMany({where:{key:{startsWith:'networkImport:'}}});
  process.env.NETWORK_CREDENTIALS_KEY='a'.repeat(64);
  for(const [id,role] of [['verify-admin','ADMIN'],['verify-operator','OPERATOR'],['verify-viewer','VIEWER']])await prisma.admin.upsert({where:{id},create:{id,username:id,role,password:await bcrypt.hash('Integration-login-password-123',10)},update:{role,disabled:false,password:await bcrypt.hash('Integration-login-password-123',10)}});
 });
 afterAll(async()=>{await prisma.$disconnect();});
 it('signs current roles on real credential login and refuses disabled accounts',async()=>{
  const request=()=>new NextRequest('http://localhost/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'verify-viewer',password:'Integration-login-password-123'})});
  const response=await login(request());expect(response.status).toBe(200);expect((await response.json()).data.role).toBe('VIEWER');expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  await prisma.admin.update({where:{id:'verify-viewer'},data:{disabled:true}});
  expect((await login(request())).status).toBe(401);
  await prisma.admin.update({where:{id:'verify-viewer'},data:{disabled:false}});
 });
 it('checks role changes against current rows and denies disabled users without executing handlers',async()=>{
  let count=0;const handler=withPermission('operate',async()=>{count++;return NextResponse.json({success:true});});
  expect((await handler(req('/api/action','verify-operator',{}))).status).toBe(200);
  expect((await handler(req('/api/action','verify-viewer',{}))).status).toBe(403);
  await prisma.admin.update({where:{id:'verify-operator'},data:{disabled:true}});
  expect((await handler(req('/api/action','verify-operator',{}))).status).toBe(401);
  await prisma.admin.update({where:{id:'verify-operator'},data:{disabled:false}});
  expect(count).toBe(1);
 });
 it('persists encrypted connections, retains omitted secrets and rejects wrong-provider IDs',async()=>{
  const input={provider:'MIKROTIK',name:'Integration router',baseUrl:'https://192.0.2.10',username:'api',credentials:{password:'integration-device-secret'}};
  expect((await saveConnection(req('/api/network/connections','verify-operator',input))).status).toBe(403);
  const created=await saveConnection(req('/api/network/connections','verify-admin',input));expect(created.status).toBe(200);
  const row=(await created.json()).data;expect(JSON.stringify(row)).not.toContain('integration-device-secret');
  const stored=await prisma.networkConnection.findUniqueOrThrow({where:{id:row.id}});expect(stored.encryptedCredentials).not.toContain('integration-device-secret');
  expect((await resolveConnection('MIKROTIK',undefined,row.id)).credentials.password).toBe('integration-device-secret');
  const updated=await saveConnection(req('/api/network/connections','verify-admin',{...input,id:row.id,credentials:{password:''},name:'Renamed router'}));expect(updated.status).toBe(200);
  expect((await resolveConnection('MIKROTIK',undefined,row.id)).credentials.password).toBe('integration-device-secret');
  await expect(resolveConnection('UNIFI',undefined,row.id)).rejects.toMatchObject({status:404});
  expect(JSON.stringify(await prisma.auditLog.findMany({where:{connectionId:row.id}}))).not.toContain('integration-device-secret');
 });
 it('serializes concurrent default selection and enforces one controller',async()=>{
  const input={provider:'MIKROTIK',baseUrl:'https://192.0.2.11',username:'api',credentials:{password:'integration-device-secret'},isDefault:true};
  const responses=await Promise.all([saveConnection(req('/api/network/connections','verify-admin',{...input,name:'Router A'})),saveConnection(req('/api/network/connections','verify-admin',{...input,name:'Router B'}))]);
  expect(responses.map(r=>r.status)).toEqual([200,200]);
  expect(await prisma.networkConnection.count({where:{provider:'MIKROTIK',isDefault:true}})).toBe(1);
  const controllers=await Promise.all([saveConnection(req('/api/network/connections','verify-admin',{...input,provider:'UNIFI',name:'Controller A'})),saveConnection(req('/api/network/connections','verify-admin',{...input,provider:'UNIFI',name:'Controller B'}))]);
  expect(controllers.map(r=>r.status).sort()).toEqual([200,409]);
 });
 it('keeps selected monitoring sites and does not resurrect deleted legacy controllers',async()=>{
  const controller=await prisma.networkConnection.findFirstOrThrow({where:{provider:'UNIFI'}});
  const updated=await saveConnection(req('/api/network/connections','verify-admin',{id:controller.id,provider:'UNIFI',name:controller.name,baseUrl:controller.baseUrl,username:controller.username,config:{site:'default',sites:['default','branch','branch']}}));expect(updated.status).toBe(200);
  expect((await resolveConnection('UNIFI',undefined,controller.id)).config.sites).toEqual(['default','branch']);
  const removed=await deleteConnection(req(`/api/network/connections/${controller.id}`,'verify-admin',{}),{params:{id:controller.id}});expect(removed.status).toBe(200);
  const previous=process.env.UNIFI_CONTROLLER_URL;process.env.UNIFI_CONTROLLER_URL='https://legacy.example.invalid';
  try{const listed=await listConnections(req('/api/network/connections?provider=UNIFI','verify-viewer'));expect((await listed.json()).data).toEqual([]);await expect(resolveConnection('UNIFI')).rejects.toMatchObject({status:503});}
  finally{if(previous===undefined)delete process.env.UNIFI_CONTROLLER_URL;else process.env.UNIFI_CONTROLLER_URL=previous;}
 });
 it('allows viewer to list safe metadata and refuses demoting the last enabled administrator',async()=>{
  const listed=await listConnections(req('/api/network/connections','verify-viewer'));expect(listed.status).toBe(200);expect(JSON.stringify(await listed.json())).not.toContain('encryptedCredentials');
  const denied=await saveAccount(req('/api/admin/accounts','verify-admin',{id:'verify-admin',username:'verify-admin',role:'VIEWER',disabled:false}));expect(denied.status).toBe(409);
  expect((await prisma.admin.findUniqueOrThrow({where:{id:'verify-admin'}})).role).toBe('ADMIN');
 });
});
