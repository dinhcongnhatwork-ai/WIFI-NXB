import {prisma} from '@/lib/prisma';
import {DeviceExemption,exemptionKey,EXEMPT_PREFIX,parseExemption} from './unifi-exempt-policy';
export async function readDeviceExemption(scope:{connectionId:string;site:string;mac:string}):Promise<DeviceExemption|null>{
 const key=exemptionKey(scope);const row=await prisma.systemSetting.findUnique({where:{key}});
 if(!row)return null;const value=parseExemption(key,row.value);return value.enabled?value:null;
}
export async function listDeviceExemptions(scope?:{connectionId:string;site:string}):Promise<DeviceExemption[]>{
 const prefix=scope?exemptionKey({...scope,mac:'02:00:00:00:00:01'}).slice(0,-17):EXEMPT_PREFIX;
 const rows=await prisma.systemSetting.findMany({where:{key:{startsWith:prefix}}});
 return rows.map(row=>parseExemption(row.key,row.value));
}
