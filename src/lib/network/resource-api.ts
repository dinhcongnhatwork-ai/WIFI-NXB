import { NextRequest, NextResponse } from 'next/server';
import { AccessError, getIdentity, withPermission } from '@/lib/api-access';
import { resolveConnection } from './connections';
import { networkChange, redact } from './audit';
import { getResource, resourcesFor, validateFields, type Provider, type Resource } from './resources';
import { recordId } from './paths';
import { MikrotikClient } from '@/lib/mikrotik';
import { UnifiClient } from '@/lib/unifi';

type Adapter={request:(path:string,method?:string,body?:unknown)=>Promise<any>;resourcePath:(r:Resource)=>string;official:boolean;version:string|null};
export async function connectionAdapter(provider:Provider,req:NextRequest):Promise<{connection:Awaited<ReturnType<typeof resolveConnection>>;adapter:Adapter}> {
 const connection=await resolveConnection(provider==='unifi'?'UNIFI':'MIKROTIK',req);
 if(provider==='mikrotik'){
  const client=new MikrotikClient({host:connection.baseUrl,username:connection.username||'',password:connection.credentials.password||'',allowInsecure:connection.config.allowInsecure===true});
  return {connection,adapter:{official:false,version:connection.version,resourcePath:r=>r.path,request:(p,m='GET',b)=>client.rawRequest(p,m as any,b)}};
 }
 const site=req.nextUrl.searchParams.get('siteId')||String(connection.config.site||'default');
 if(!/^[A-Za-z0-9_-]+$/.test(site))throw new AccessError(400,"Mã site không hợp lệ");
 const client=new UnifiClient({controllerUrl:connection.baseUrl,username:connection.username||'',password:connection.credentials.password||'',apiKey:connection.credentials.apiKey,site,rejectUnauthorized:connection.config.allowInsecure!==true,apiMode:connection.config.apiMode==='legacy'?'legacy':connection.config.apiMode==='official'?'official':undefined,version:connection.version,apiPrefix:connection.config.apiPrefix as string});
 await client.login();
 return {connection,adapter:{official:client.isOfficialApi(),version:connection.version,resourcePath:r=>`/api/s/${site}/${r.path}`,request:(p,m='GET',b)=>client.rawRequest(p,m,b)}};
}
function records(payload:any):Record<string,any>[] {
 const rows=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:[payload];
 return rows.filter((r:any)=>r&&typeof r==='object');
}
function displayRecords(provider:Provider,resource:Resource,rows:Record<string,any>[]):Record<string,any>[] {
 if(provider!=='unifi'||!['ports','radio'].includes(resource.id))return rows;
 return rows.flatMap(device=>{
  const entries=resource.id==='ports'?(device.port_table||device.portTable||[]):(device.radio_table||device.radioTable||[]);
  return entries.map((entry:Record<string,any>)=>{
   const subId=resource.id==='ports'?entry.port_idx:entry.radio;
   const override=resource.id==='ports'?(device.port_overrides||[]).find((p:any)=>p.port_idx===entry.port_idx)||{}:{};
   return {...entry,...override,_id:`${device._id||device.id}:${subId}`,deviceId:device._id||device.id,deviceName:device.name||device.mac};
  });
 });
}
const idOf=(row:Record<string,any>)=>String(row['.id']||row._id||row.id||'');
function unavailable(error:unknown){const status=(error as any)?.status;const message=error instanceof Error?error.message:'Request failed';return {state:status===401||status===403?'forbidden':status===404?'unsupported':'error',reason:message,observedAt:new Date().toISOString()};}
export function resourceHandlers(provider:Provider){
 const GET=withPermission('read',async(req:NextRequest)=>{
  const resourceId=req.nextUrl.searchParams.get('resource');
  if(!resourceId)return NextResponse.json({success:true,data:resourcesFor(provider)});
  let resource:Resource;try{resource=getResource(provider,resourceId);}catch{throw new AccessError(400,'Unknown resource');}
  const {connection,adapter}=await connectionAdapter(provider,req);
  if(provider==='unifi'&&adapter.official){
   if(!['devices','clients'].includes(resource.id))return NextResponse.json({success:true,data:[],capability:{state:'unsupported',reason:"Biểu mẫu này dùng API cấu hình Network cũ. Chọn kết nối phiên đăng nhập để cấu hình; chế độ khóa API chỉ hiển thị endpoint chính thức đã phát hiện."}});
   // Official list endpoints are paginated and version-specific in the UniFi adapter.
   const {getUnifiClientFromRequest}=await import('@/lib/settings');const client=await getUnifiClientFromRequest(req);
   const rows=resource.id==='devices'?await client.getDevices():await client.getClients();
   return NextResponse.json({success:true,data:redact(rows),capability:{state:'available',read:true,write:false,reason:"API chính thức đã phản hồi; biểu mẫu cấu hình cần chế độ phiên đăng nhập cũ.",version:adapter.version}});
  }
  try{const data=displayRecords(provider,resource,records(await adapter.request(adapter.resourcePath(resource))));return NextResponse.json({success:true,data:redact(data),connectionId:connection.id,capability:{state:'available',read:true,write:'unverified',reason:resource.reason||"Đã đọc dữ liệu. Quyền thiết bị và hỗ trợ từng trường được kiểm tra khi gửi thay đổi.",observedAt:new Date().toISOString(),version:adapter.version}});}catch(error){return NextResponse.json({success:true,data:null,capability:unavailable(error)});}
 });
 const POST=withPermission('operate',async(req:NextRequest)=>{
  const body=await req.json();const {resource:resourceId,operation,id,fields,confirmed,destination}=body;
  if(typeof resourceId!=='string')throw new AccessError(400,"Cần chọn tài nguyên");
  let resource:Resource;try{resource=getResource(provider,resourceId);}catch{throw new AccessError(400,'Unknown resource');}
  const identity=await getIdentity(req);if(resource.admin&&identity.role!=='ADMIN')throw new AccessError(403,"Cần quyền Quản trị");
  if(confirmed!==true)throw new AccessError(400,"Xem trước và xác nhận thay đổi trước khi gửi");
  if(!['create','update','delete','toggle','reorder','command'].includes(operation))throw new AccessError(400,"Thao tác không hỗ trợ");
  if(operation==='command'?!resource.command:operation==='reorder'?!resource.reorder:operation==='toggle'?!resource.toggle:!resource[operation as 'create'|'update'|'delete'])throw new AccessError(400,"Tài nguyên không hỗ trợ thao tác này");
  let values:Record<string,unknown>={};try{values=validateFields(resource,fields||{},operation==='create'||operation==='command');}catch(error){throw new AccessError(400,(error as Error).message);}
  if(['update','delete','toggle','reorder'].includes(operation)&&!resource.singleton){try{recordId(id);}catch{throw new AccessError(400,"Cần mã bản ghi hợp lệ");}}
  if(operation==='toggle'&&(Object.keys(values).length!==1||typeof values[resource.toggle!]!=='boolean'))throw new AccessError(400,"Cần giá trị bật / tắt hợp lệ");
  if(operation==='reorder'){try{recordId(destination);}catch{throw new AccessError(400,"Cần chọn bản ghi đích");}}
  const {connection,adapter}=await connectionAdapter(provider,req);
  if(adapter.official)throw new AccessError(409,"Biểu mẫu cấu hình cũ không hỗ trợ API chính thức");
  const base=adapter.resourcePath(resource);let before:Record<string,any>[]=[];
  let rawRows:Record<string,any>[]=[];
  const read=async()=>{rawRows=records(await adapter.request(base));return displayRecords(provider,resource,rawRows);};
  const path=resource.singleton?base:`${base}/${id?recordId(id):''}`.replace(/\/$/,'');
  // Singleton menus use POST set; Ethernet/interface records cannot be created or removed.
  const outcome=await networkChange(req,{
   action:`${provider}.${resource.id}.${operation}`,connectionId:connection.id,deviceId:id,
   before:async()=>{before=await read();if(id&&!resource.singleton&&!before.some(row=>idOf(row)===id))throw new AccessError(404,"Bản ghi không còn tồn tại");return before;},
   execute:()=>{
    if(provider==='unifi'&&['ports','radio'].includes(resource.id)){
     const observed=before.find(row=>idOf(row)===id)!;const device=rawRows.find(row=>String(row._id||row.id)===observed.deviceId);
     if(!device)throw new AccessError(404,"Thiết bị không còn tồn tại");
     const field=resource.id==='ports'?'port_overrides':'radio_table';
     const entries=resource.id==='ports'?(device.port_overrides||[]):(device.radio_table||device.radioTable||[]);
     const match=(entry:any)=>resource.id==='ports'?entry.port_idx===observed.port_idx:entry.radio===observed.radio;
     const updated=entries.some(match)?entries.map((entry:any)=>match(entry)?{...entry,...values}:entry):[...entries,{port_idx:observed.port_idx,...values}];
     return adapter.request(base.replace('/stat/device',`/rest/device/${recordId(observed.deviceId)}`),'PUT',{[field]:updated});
    }
    if(operation==='command')return adapter.request(resource.command!,'POST',values);
    if(operation==='reorder')return adapter.request(`${base}/move`,'POST',{numbers:id,destination});
    if(resource.singleton)return adapter.request(`${base}/set`,'POST',values);
    if(operation==='delete')return adapter.request(path,'DELETE');
    // Device stats are observed at stat/device but configured at rest/device.
    const target=provider==='unifi'&&resource.id==='devices'?path.replace('/stat/device/','/rest/device/'):path;
    return adapter.request(operation==='create'?base:target,operation==='create'?(provider==='mikrotik'?'PUT':'POST'):(provider==='mikrotik'?'PATCH':'PUT'),values);
   },
   verify:async(result)=>{
    const after=await read();
    if(operation==='command'){
     const filename=String(values.name||values.file||'');
     return {verified:resource.id!=='reboot'&&!!filename&&after.some(row=>String(row.name||'').startsWith(filename)),value:after};
    }
    if(operation==='delete')return {verified:!after.some(row=>idOf(row)===id),value:after};
    if(operation==='reorder'){const from=after.findIndex(r=>idOf(r)===id),to=after.findIndex(r=>idOf(r)===destination);return {verified:from>=0&&to===from+1,value:after};}
    const returned=records(result)[0];const targetId=id||idOf(returned||{});
    const candidate=resource.singleton?after[0]:after.find(row=>idOf(row)===targetId)||after.find(row=>!before.some(old=>idOf(old)===idOf(row))&&Object.entries(values).every(([key,value])=>String(row[key])===String(value)));
    const secretKeys=/password|passphrase|private.key|secret/i;
    const comparable=Object.entries(values).filter(([key])=>!secretKeys.test(key));
    return {verified:!!candidate&&comparable.length>0&&comparable.every(([key,value])=>String(candidate[key])===String(value))&&!Object.keys(values).some(k=>secretKeys.test(k)),value:after};
   }
  });
  return NextResponse.json({success:true,data:redact(outcome.result),status:outcome.status,auditId:outcome.auditId});
 });return {GET,POST};
}
