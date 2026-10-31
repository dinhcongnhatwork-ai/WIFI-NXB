import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export interface ConnectionCredentials { password?: string; apiKey?: string }
function key(): Buffer {
  const value = process.env.NETWORK_CREDENTIALS_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('NETWORK_CREDENTIALS_KEY phải là khóa hex 32 byte (64 ký tự).');
  return Buffer.from(value, 'hex');
}
export function encryptCredentials(value: ConnectionCredentials): string {
  const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',key(),iv);
  const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),body.toString('base64url')].join('.');
}
export function decryptCredentials(value: string): ConnectionCredentials {
  const [version,nonce,tag,body,...extra]=value.split('.');
  if(version!=='v1'||!nonce||!tag||!body||extra.length)throw new Error('Thông tin kết nối mã hóa không hợp lệ.');
  const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(nonce,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8')) as ConnectionCredentials;
}
const secretKey = /password|passwd|passphrase|secret|credential|api[-_]?key|authorization|cookie|token|wpa[-_]?psk|private[-_]?key|preshared[-_]?key|community/i;
export function redactSecrets(value: unknown, depth = 0): any {
  if(depth>20)return '[TRUNCATED]';
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map(v=>redactSecrets(v,depth+1));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,secretKey.test(k)?'[REDACTED]':redactSecrets(v,depth+1)]));
  if(typeof value==='string')return value.replace(/(Bearer\s+)\S+/gi,'$1[REDACTED]').replace(/((?:password|passwd|secret|token|api[-_]?key|wpa[-_]?psk|private[-_]?key)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,'$1[REDACTED]').replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1[REDACTED]@');
  return value;
}
