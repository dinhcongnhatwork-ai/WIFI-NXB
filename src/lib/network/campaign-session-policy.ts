import {CampaignHotspotError} from './campaign-hotspot-policy';
export const DEFAULT_SESSION_MINUTES=240;
export const SESSION_PREFIX='campaignHotspot:session:';
export const SESSION_POLICY_PREFIX='campaignHotspot:sessionPolicy:';
export function validateSessionMinutes(value:unknown):number {
 if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>1440)throw new CampaignHotspotError('Thời hạn phiên phải là số nguyên từ 1 đến 1440 phút.',400);
 return value;
}
export function sessionPolicyKey(campaignId:string):string {
 if(!/^[a-zA-Z\d_-]{1,100}$/.test(campaignId))throw new CampaignHotspotError('Chiến dịch không hợp lệ.',400);
 return SESSION_POLICY_PREFIX+campaignId;
}
export function readSessionPolicy(value:unknown):number {
 if(value==null)return DEFAULT_SESSION_MINUTES;
 const p=value as {version?:number;sessionMinutes?:unknown};
 if(p.version!==1)throw new CampaignHotspotError('Cấu hình thời hạn phiên không hợp lệ.',503);
 return validateSessionMinutes(p.sessionMinutes);
}
