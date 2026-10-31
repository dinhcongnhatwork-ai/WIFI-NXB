import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({role:'OPERATOR',authenticated:true,findUnique:vi.fn(),auditCreate:vi.fn(),auditUpdate:vi.fn(),resolve:vi.fn()}));
vi.mock('@/lib/auth',()=>({authenticateRequest:()=>mocks.authenticated?{id:'actor'}:null}));
vi.mock('@/lib/prisma',()=>({prisma:{admin:{findUnique:mocks.findUnique},auditLog:{create:mocks.auditCreate,update:mocks.auditUpdate}}}));
vi.mock('@/lib/network/connections',()=>({resolveConnection:mocks.resolve}));
import { resourceHandlers } from '@/lib/network/resource-api';
import { rawHandlers } from '@/lib/network/raw-api';
const resources=resourceHandlers('mikrotik'),raw=rawHandlers('mikrotik');
const request=(body?:unknown,resource='addresses')=>new NextRequest(`http://app/api/mikrotik/resources?connectionId=saved&resource=${resource}`,body?{method:'POST',headers:{'Content-Type':'application/json',origin:'http://app'},body:JSON.stringify(body)}:undefined);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{vi.resetAllMocks();process.env.MONITOR_PROCESS_ENABLED='false';mocks.authenticated=true;mocks.role='OPERATOR';mocks.findUnique.mockImplementation(async()=>({id:'actor',username:'operator',role:mocks.role,disabled:false}));mocks.resolve.mockResolvedValue({id:'saved',baseUrl:'https://saved.test',username:'ops',credentials:{password:'stored'},config:{},version:'7.20'});mocks.auditCreate.mockResolvedValue({id:'audit-1'});mocks.auditUpdate.mockResolvedValue({});});
afterEach(()=>vi.unstubAllGlobals());
describe('protected network resource APIs',()=>{
 it('denies unauthenticated reads and viewer writes before contacting a router',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);mocks.authenticated=false;expect((await resources.GET(request())).status).toBe(401);
  mocks.authenticated=true;mocks.role='VIEWER';expect((await resources.POST(request({resource:'addresses',operation:'create',confirmed:true,fields:{address:'10.0.0.1/24',interface:'ether1'}}))).status).toBe(403);expect(fetch).not.toHaveBeenCalled();expect(mocks.resolve).not.toHaveBeenCalled();
 });
 it('denies raw explorer and lifecycle commands to operators',async()=>{
  expect((await raw.GET(new NextRequest('http://app/api/mikrotik/raw?path=/system/resource'))).status).toBe(403);
  expect((await resources.POST(request({resource:'reboot',operation:'command',confirmed:true,fields:{}}))).status).toBe(403);
 });
 it('rejects unconfirmed writes, forbidden fixed-interface creates and unknown fields',async()=>{
  expect((await resources.POST(request({resource:'addresses',operation:'create',fields:{address:'10.0.0.1/24',interface:'ether1'}}))).status).toBe(400);
  expect((await resources.POST(request({resource:'ethernet',operation:'create',confirmed:true,fields:{name:'new'}}))).status).toBe(400);
  expect((await resources.POST(request({resource:'addresses',operation:'update',id:'*1',confirmed:true,fields:{script:'reboot'}}))).status).toBe(400);
  expect(mocks.resolve).not.toHaveBeenCalled();
 });
 it('writes once to the stored target, then semantically verifies and audits read-back',async()=>{
  const row={'.id':'*1',address:'10.0.0.1/24',interface:'ether1',disabled:'false'};
  const fetch=vi.fn().mockImplementation(async(_url,options)=>{if(options.method==='PATCH'){Object.assign(row,JSON.parse(options.body));return json(row);}return json([row]);});vi.stubGlobal('fetch',fetch);
  const response=await resources.POST(request({resource:'addresses',operation:'update',id:'*1',confirmed:true,fields:{address:'10.20.0.1/24'}}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({success:true,status:'verified',auditId:'audit-1'});
  expect(fetch.mock.calls.filter(([,o])=>o.method==='PATCH')).toHaveLength(1);expect(fetch.mock.calls.every(([url])=>String(url).startsWith('https://saved.test/rest/ip/address'))).toBe(true);
  expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'applying',connectionId:'saved'})}));expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'verified'})}));
 });
 it('shows forbidden capability separately from a healthy empty resource',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({message:'Forbidden'},403)));
  const response=await resources.GET(request());expect(await response.json()).toMatchObject({success:true,data:null,capability:{state:'forbidden'}});
 });
 it('records uncertain outcomes after a timed-out write without retry',async()=>{
  const fetch=vi.fn().mockImplementation(async(_url,options)=>{if(options.method==='PATCH')throw new Error('request timeout');return json([{'.id':'*1',address:'10.0.0.1/24',interface:'ether1'}]);});vi.stubGlobal('fetch',fetch);
  const response=await resources.POST(request({resource:'addresses',operation:'update',id:'*1',confirmed:true,fields:{address:'10.2.0.1/24'}}));expect(response.status).toBe(500);expect(fetch.mock.calls.filter(([,o])=>o.method==='PATCH')).toHaveLength(1);expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'uncertain'})}));
 });
});
