import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ identity: vi.fn(), findAdmin: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authenticateRequest: mocks.identity }));
vi.mock('@/lib/prisma', () => ({ prisma: { admin: { findUnique: mocks.findAdmin } } }));
import { hasPermission, requiresAdminAction } from '@/lib/permissions';
import { withPermission } from '@/lib/api-access';
import { encryptCredentials, decryptCredentials, redactSecrets } from '@/lib/network/secrets';

beforeEach(() => {
  mocks.identity.mockReturnValue({ id: 'staff', role: 'ADMIN' });
  mocks.findAdmin.mockResolvedValue({ id: 'staff', username: 'staff', role: 'VIEWER', disabled: false });
  process.env.NETWORK_CREDENTIALS_KEY = 'c4e099d70f089efb6d30ca3a95934d8c4564ebc9836dca55290331621480920c';
});
describe('administration authorization', () => {
  it('enforces the three role levels and denies unknown roles', () => {
    expect(hasPermission('VIEWER', 'read')).toBe(true);
    expect(hasPermission('VIEWER', 'operate')).toBe(false);
    expect(hasPermission('OPERATOR', 'operate')).toBe(true);
    expect(hasPermission('OPERATOR', 'admin')).toBe(false);
    expect(hasPermission('ADMIN', 'admin')).toBe(true);
    expect(hasPermission('unexpected', 'read')).toBe(false);
  });
  it('never trusts the role in an old token after the account was demoted', async () => {
    const handler = vi.fn(async () => NextResponse.json({ success: true }));
    const response = await withPermission('operate', handler)(new NextRequest('http://localhost/api/unifi/devices', {method:'POST', headers:{'content-type':'application/json'},body:JSON.stringify({action:'rename'})}));
    expect(response.status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it('rejects missing, deleted and disabled identities before touching the operation', async () => {
    const handler = vi.fn(async () => NextResponse.json({success:true})); const route = withPermission('read', handler);
    mocks.identity.mockReturnValue(null);
    expect((await route(new NextRequest('http://localhost/api/settings'))).status).toBe(401);
    mocks.identity.mockReturnValue({id:'staff'}); mocks.findAdmin.mockResolvedValue(null);
    expect((await route(new NextRequest('http://localhost/api/settings'))).status).toBe(401);
    mocks.findAdmin.mockResolvedValue({id:'staff',role:'ADMIN',disabled:true});
    expect((await route(new NextRequest('http://localhost/api/settings'))).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
  it('restricts lifecycle commands even when submitted to an operator endpoint', async () => {
    expect(requiresAdminAction({action:'reboot'})).toBe(true);
    expect(requiresAdminAction({path:'/system/reboot',method:'POST'})).toBe(true);
    expect(requiresAdminAction({action:'rename'})).toBe(false);
    mocks.findAdmin.mockResolvedValue({id:'staff',username:'staff',role:'OPERATOR'});
    const route = withPermission('operate', async () => NextResponse.json({success:true}));
    expect((await route(new NextRequest('http://localhost/api/unifi/devices',{method:'POST',body:JSON.stringify({action:'forget'})}))).status).toBe(403);
  });
  it('rejects cookie-authenticated cross-origin writes', async () => {
    mocks.findAdmin.mockResolvedValue({id:'staff',username:'staff',role:'ADMIN'});
    const route = withPermission('operate', async () => NextResponse.json({success:true}));
    const response = await route(new NextRequest('http://localhost/api/settings',{method:'POST',headers:{cookie:'token=jwt',origin:'https://unrelated.invalid'},body:'{}'}));
    expect(response.status).toBe(403);
  });
  it('accepts an authenticated same-origin bearer write through the LAN frontend proxy',async()=>{
    mocks.findAdmin.mockResolvedValue({id:'staff',username:'staff',role:'ADMIN'});
    const handler=vi.fn(async()=>NextResponse.json({success:true}));
    const route=withPermission('admin',handler);
    const response=await route(new NextRequest('http://127.0.0.1:3001/api/network/connections',{method:'POST',headers:{authorization:'Bearer jwt',origin:'http://192.168.1.56:3000','sec-fetch-site':'same-origin'},body:'{}'}));
    expect(response.status).toBe(200);expect(handler).toHaveBeenCalled();
    const rejected=await route(new NextRequest('http://127.0.0.1:3001/api/network/connections',{method:'POST',headers:{authorization:'Bearer jwt',origin:'https://unrelated.invalid','sec-fetch-site':'cross-site'},body:'{}'}));
    expect(rejected.status).toBe(403);
  });
});
describe('connection secrets', () => {
  it('encrypts with authenticated encryption and detects corruption and wrong keys', () => {
    const secret = {password:'device-secret',apiKey:'private-key'};
    const encrypted=encryptCredentials(secret);
    expect(encrypted).not.toContain('device-secret'); expect(decryptCredentials(encrypted)).toEqual(secret);
    expect(()=>decryptCredentials(encrypted.slice(0,-4)+'AAAA')).toThrow();
    process.env.NETWORK_CREDENTIALS_KEY='0'.repeat(64);
    expect(()=>decryptCredentials(encrypted)).toThrow();
  });
  it('requires an explicit encryption key instead of a hardcoded fallback', () => {
    delete process.env.NETWORK_CREDENTIALS_KEY;
    expect(()=>encryptCredentials({password:'secret'})).toThrow(/NETWORK_CREDENTIALS_KEY/);
  });
  it('redacts nested credentials while preserving values needed for auditing', () => {
    expect(redactSecrets({host:'router',password:'secret',nested:{'wpa-psk':'wifi',apiKey:'token',port:443},items:[{authorization:'Bearer secret'}]})).toEqual({host:'router',password:'[REDACTED]',nested:{'wpa-psk':'[REDACTED]',apiKey:'[REDACTED]',port:443},items:[{authorization:'[REDACTED]'}]});
  });
});
describe('read-only network responses',()=>{
 it('masks device configuration secrets for viewers while preserving network information',async()=>{
  const route=withPermission('read',async()=>NextResponse.json({success:true,data:{ssid:'Office',wpaPsk:'office-secret',nested:{password:'secret'}}}));
  const response=await route(new NextRequest('http://localhost/api/unifi/ssids'));
  expect((await response.json()).data).toEqual({ssid:'Office',wpaPsk:'[REDACTED]',nested:{password:'[REDACTED]'}});
 });
});
