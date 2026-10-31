import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({findUnique:vi.fn(),findFirst:vi.fn(),findMany:vi.fn(),legacy:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{networkConnection:{findUnique:mocks.findUnique,findFirst:mocks.findFirst,findMany:mocks.findMany},systemSetting:{findUnique:mocks.legacy}}}));
import { normalizeBaseUrl, publicConnection, resolveConnection } from '@/lib/network/connections';
import { encryptCredentials } from '@/lib/network/secrets';
beforeEach(()=>{process.env.NETWORK_CREDENTIALS_KEY='1'.repeat(64);vi.resetAllMocks();});
describe('network connection scope',()=>{
  it('requires an explicit local HTTP(S) endpoint without embedded credentials or fragments',()=>{
    expect(normalizeBaseUrl('https://192.168.1.10:8443/')).toBe('https://192.168.1.10:8443');
    expect(()=>normalizeBaseUrl('https://user:secret@host')).toThrow();
    expect(()=>normalizeBaseUrl('file:///etc/passwd')).toThrow();
    expect(()=>normalizeBaseUrl('https://router/#admin')).toThrow();
  });
  it('does not expose encrypted or plaintext credentials in connection DTOs',()=>{
    const dto=publicConnection({id:'router',provider:'MIKROTIK',name:'Router',baseUrl:'https://router',encryptedCredentials:'cipher',config:{token:'sensitive',site:'default'},username:'ops',isDefault:true});
    expect(JSON.stringify(dto)).not.toContain('cipher');expect(JSON.stringify(dto)).not.toContain('sensitive');expect(dto.hasCredentials).toBe(true);
  });
  it('rejects a connection ID from the wrong provider instead of falling back to a default',async()=>{
    mocks.findUnique.mockResolvedValue({id:'router',provider:'MIKROTIK'});
    await expect(resolveConnection('UNIFI',new Request('http://app/api/unifi/devices?connectionId=router'))).rejects.toMatchObject({status:404});
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it('does not resurrect an explicitly deleted connection from legacy environment settings',async()=>{
    process.env.UNIFI_CONTROLLER_URL='https://old-controller';
    mocks.findFirst.mockResolvedValue(null);
    mocks.legacy.mockImplementation(async ({where}:any)=>where.key==='networkImport:UNIFI'?{value:{completed:true,connectionId:'deleted'}}:null);
    await expect(resolveConnection('UNIFI')).rejects.toMatchObject({status:503});
    delete process.env.UNIFI_CONTROLLER_URL;
  });
  it('ignores browser-supplied endpoint and password headers',async()=>{
    mocks.findFirst.mockResolvedValue({id:'router',provider:'MIKROTIK',name:'Main',baseUrl:'https://configured',encryptedCredentials:encryptCredentials({password:'stored'}),username:'ops',config:{},isDefault:true,version:'7.20'});
    const result=await resolveConnection('MIKROTIK',new Request('http://app/api/mikrotik/overview',{headers:{'x-mikrotik-host':'https://attacker','x-mikrotik-pass':'injected'}}));
    expect(result.baseUrl).toBe('https://configured');expect(result.credentials.password).toBe('stored');
  });
});
