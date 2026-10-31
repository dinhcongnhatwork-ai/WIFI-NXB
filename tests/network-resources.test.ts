import { describe, it, expect } from 'vitest';
import { resourcesFor, getResource, validateFields } from '@/lib/network/resources';
import { validateRelativePath, recordId } from '@/lib/network/paths';
describe('network resource safety',()=>{
 it.each(['https://evil.test/api','//evil.test/api','/ip/../system','/ip/%2e%2e/system','/ip/%252e%252e/system','/ip/\\system','/ip/%5csystem','/ip/%00system','/ip/./address'])('rejects host overrides and traversal: %s',path=>expect(()=>validateRelativePath(path)).toThrow());
 it.each(['/ip/address/*1','/api/s/site-a/stat/device','/proxy/network/integration/v1/sites?offset=0&limit=200'])('accepts fixed-server relative paths: %s',path=>expect(validateRelativePath(path)).toBe(path));
 it('rejects unknown fields, wrong types, missing required values, and out of range VLANs',()=>{
  const resource=getResource('mikrotik','vlan');
  expect(()=>validateFields(resource,{name:'vlan10',interface:'bridge','vlan-id':4095},true)).toThrow();
  expect(()=>validateFields(resource,{name:'vlan10',interface:'bridge','vlan-id':10,disabled:'false'},true)).toThrow();
  expect(()=>validateFields(resource,{name:'vlan10','vlan-id':10},true)).toThrow();
  expect(()=>validateFields(resource,{command:'/system/reboot'},false)).toThrow();
  expect(validateFields(resource,{name:'vlan10',interface:'bridge','vlan-id':10,disabled:false},true)).toEqual({name:'vlan10',interface:'bridge','vlan-id':10,disabled:false});
 });
 it('does not offer create/delete for fixed interfaces or singleton settings',()=>{
  expect(getResource('mikrotik','ethernet')).toMatchObject({create:false,delete:false,update:true});
  expect(getResource('mikrotik','identity')).toMatchObject({singleton:true,create:false,delete:false});
  for(const id of ['backup','export','reboot'])expect(getResource('mikrotik',id).admin).toBe(true);
 });
 it('provides unique registries and valid reference resources for all real forms',()=>{
  for(const provider of ['unifi','mikrotik'] as const){const resources=resourcesFor(provider);expect(new Set(resources.map(r=>r.id)).size).toBe(resources.length);for(const resource of resources){expect(resource.label).toBeTruthy();for(const field of resource.fields)if(field.reference)expect(()=>getResource(provider,field.reference!)).not.toThrow();}}
  expect(()=>recordId('../reboot')).toThrow();expect(recordId('*1')).toBe('*1');
 });
});

describe('UniFi array fields',()=>{
 it('keeps existing SSID AP groups as arrays when changing its name',()=>{
  const resource=getResource('unifi','ssids');
  expect(validateFields(resource,{name:'Renamed',ap_group_ids:['group-a','group-b']},false)).toEqual({name:'Renamed',ap_group_ids:['group-a','group-b']});
 });
 it('rejects strings and nonstring members rather than sending malformed arrays',()=>{
  for(const [id,key] of [['ssids','ap_group_ids'],['apgroups','device_macs'],['portprofiles','tagged_networkconf_ids']]){
   const resource=getResource('unifi',id);
   expect(()=>validateFields(resource,{[key]:'a,b'},false)).toThrow();
   expect(()=>validateFields(resource,{[key]:['a',123]},false)).toThrow();
   expect(validateFields(resource,{[key]:[]},false)).toEqual({[key]:[]});
  }
 });
});
