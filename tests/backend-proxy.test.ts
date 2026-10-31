import {describe,expect,it} from 'vitest';
import {backendDestination} from '@/lib/backend-proxy';
describe('runtime frontend to backend routing',()=>{
 it('preserves API path and query only in frontend mode',()=>{
  expect(backendDestination('http://localhost:3000/api/auth/me?x=1','frontend','http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001/api/auth/me?x=1');
  expect(backendDestination('http://localhost:3001/api/auth/me','backend','http://127.0.0.1:3001')).toBeNull();
  expect(backendDestination('http://localhost:3000/admin','frontend','http://127.0.0.1:3001')).toBeNull();
 });
 it('refuses loops and credentials in backend addresses',()=>{
  expect(()=>backendDestination('http://localhost:3000/api/auth/me','frontend','http://localhost:3000')).toThrow();
  expect(()=>backendDestination('http://localhost:3000/api/auth/me','frontend','http://user:secret@localhost:3001')).toThrow();
 });
});
