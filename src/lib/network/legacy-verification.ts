type Row=Record<string,any>;
const rows=(value:any):Row[]=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value).flatMap(v=>Array.isArray(v)?v:[]):[];
const idOf=(row:Row)=>String(row.id||row._id||row['.id']||'');
const bool=(value:any)=>value===true||value==='true'||value==='yes';
/** Only compare fields whose observed representation is known. Commands stay uncertain. */
export function verifyLegacyChange(provider:'UNIFI'|'MIKROTIK',path:string,body:Row,before:any,after:any,result?:any):boolean{
 const oldRows=rows(before),newRows=rows(after);const id=String(body.id||body.deviceId||'');
 const target=newRows.find(row=>idOf(row)===id);const existed=oldRows.some(row=>idOf(row)===id);
 const action=String(body.action||'');
 if(['reboot','upgrade','adopt','kick','reconnect','radio','port','led'].includes(action))return false;
 if(['delete','remove-user','remove-address','forget'].includes(action))return !!id&&existed&&!target;
 if(provider==='MIKROTIK'){
  if(['enable','disable','enable-user','disable-user'].includes(action))return !!target&&bool(target.disabled)===action.startsWith('disable');
  if(action==='add-address')return newRows.some(r=>r.address===body.address&&r.interface===body.interface&&!oldRows.some(old=>idOf(old)===idOf(r)));
  if(action==='add-user')return !body.password&&newRows.some(r=>r.name===body.name&&!oldRows.some(old=>idOf(old)===idOf(r)));
  return false;
 }
 if(path.endsWith('/clients')){
  const client=newRows.find(r=>String(r.mac).toLowerCase()===String(body.mac).toLowerCase());
  return !!client&&['block','unblock'].includes(action)&&bool(client.isBlocked??client.blocked)===(action==='block');
 }
 if(action==='rename')return !!target&&target.name===body.name;
 if(['enable','disable'].includes(action))return !!target&&bool(target.enabled)===(action==='enable');
 if(action!=='create'&&action!=='update')return false;
 if(Object.keys(body).some(k=>/passphrase|password|wpaPsk/i.test(k)&&body[k]))return false;
 const created=result?.data;const createdId=created&&typeof created==='object'?idOf(created):'';
 const candidate=target||newRows.find(r=>createdId?idOf(r)===createdId:!oldRows.some(old=>idOf(old)===idOf(r))&&r.name===body.name);
 if(!candidate)return false;
 const aliases:Record<string,string>={ssid:'ssid',vlanId:'vlanId',ipSubnet:'ipSubnet',dhcpdEnabled:'dhcpdEnabled',dhcpdStart:'dhcpdStart',dhcpdStop:'dhcpdStop',userGroupId:'userGroupId',bandwidthPolicyDown:'bandwidthPolicyDown',bandwidthPolicyUp:'bandwidthPolicyUp'};
 const comparable=Object.entries(body).filter(([k,v])=>!['action','type','id','deviceId','siteId'].includes(k)&&v!==undefined&&v!==''&&typeof v!=='object');
 return comparable.length>0&&comparable.every(([key,value])=>String(candidate[aliases[key]||key])===String(value));
}
export function legacyReadUrl(url:string,body:Row):string {
 const parsed=new URL(url);
 if(parsed.pathname.endsWith('/settings')){const map:Record<string,string>={network:'networks',usergroup:'usergroups',firewall:'firewall',portforward:'portforwards',dhcp:'dhcp',dpi:'dpi'};if(map[body.type])parsed.searchParams.set('type',map[body.type]);}
 return parsed.href;
}
