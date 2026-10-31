export const SESSION_LABELS:Record<string,string>={DRAFT:'Bản nháp',READY:'Sẵn sàng',ACTIVE:'Đang diễn ra',ENDED:'Đã kết thúc'};
export const REGISTRATION_LABELS:Record<string,string>={PRESENT:'Hiện diện',TEMPORARY_ABSENT:'Mất kết nối',ALERT_ABSENT:'Vắng quá ngưỡng',UNKNOWN:'Chưa xác định'};
export function vietnamMonthKey(value:string|Date) {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date(value));}
export function monthLabel(key:string){return `Tháng ${key.slice(5,7)}/${key.slice(0,4)}`;}
export function meetingDate(value:string|Date|null|undefined){return value?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'—';}
export function durationLabel(seconds:number){const minutes=Math.floor(Math.max(0,seconds)/60);return minutes>=60?`${Math.floor(minutes/60)} giờ ${minutes%60} phút`:`${minutes} phút`;}
