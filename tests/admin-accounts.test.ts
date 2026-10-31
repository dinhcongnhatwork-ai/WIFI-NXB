import { describe,expect,it } from 'vitest';
import { validateAccountChange } from '@/lib/accounts';
describe('administration account lifecycle',()=>{
 it('prevents locking out the last enabled administrator',()=>{
  const current={id:'one',role:'ADMIN',disabled:false};
  expect(()=>validateAccountChange({username:'admin',role:'VIEWER',disabled:false},current,1)).toThrow(/cuối cùng/);
  expect(()=>validateAccountChange({username:'admin',role:'ADMIN',disabled:true},current,1)).toThrow(/cuối cùng/);
  expect(()=>validateAccountChange({username:'admin',role:'VIEWER',disabled:false},current,2)).not.toThrow();
 });
 it('requires strong passwords only for new accounts or explicit replacement',()=>{
  expect(()=>validateAccountChange({username:'viewer',role:'VIEWER',password:'short'},null,1)).toThrow(/12/);
  expect(()=>validateAccountChange({username:'viewer',role:'VIEWER',password:''},{id:'x',role:'VIEWER',disabled:false},1)).not.toThrow();
  expect(()=>validateAccountChange({username:'viewer',role:'ROOT',password:'long-password-example'},null,1)).toThrow();
 });
});
