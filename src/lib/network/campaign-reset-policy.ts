import {CampaignHotspotError} from './campaign-hotspot-policy';
export function campaignResetKey(id:string):string{if(!/^[a-zA-Z\d_-]{1,100}$/.test(id))throw new CampaignHotspotError('Chiến dịch không hợp lệ.',400);return 'campaignHotspot:reset:'+id;}
export async function campaignResetEpoch(db:{systemSetting?:{findUnique:(args:any)=>Promise<any>}},id:string):Promise<string>{
 if(!db.systemSetting)return '';const key=campaignResetKey(id);const row=await db.systemSetting.findUnique({where:{key}});if(!row)return '';
 if(row.value?.version!==1||typeof row.value.epoch!=='string'||!/^[a-zA-Z\d_-]{1,100}$/.test(row.value.epoch))throw new CampaignHotspotError('Dữ liệu Reset WiFi không hợp lệ.',503);return row.value.epoch;
}
