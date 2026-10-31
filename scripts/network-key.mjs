import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,chmodSync} from 'node:fs';
const target=process.env.NETWORK_ENV_FILE||'.env';
let content='';try{content=readFileSync(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const match=content.match(/^[ \t]*NETWORK_CREDENTIALS_KEY[ \t]*=[ \t]*(.*)$/m);
const existing=match?.[1]?.trim().replace(/^(['"])(.*)\1$/,'$2');
if(existing){
 if(!/^[a-f\d]{64}$/i.test(existing))throw new Error(`Khóa mã hóa trong ${target} không hợp lệ. Giữ bản sao khóa cũ trước khi thay đổi.`);
 console.log(`NETWORK_CREDENTIALS_KEY đã tồn tại trong ${target}; giữ nguyên để đọc được dữ liệu đã mã hóa.`);
}else{
 const assignment=`NETWORK_CREDENTIALS_KEY=${randomBytes(32).toString('hex')}`;
 const updated=match?content.replace(match[0],assignment):`${content}\n# Device credentials encryption; retain this key in protected backups.\n${assignment}\n`;
 writeFileSync(target,updated,{mode:0o600});chmodSync(target,0o600);
 console.log(`Đã tạo khóa mã hóa trong ${target}. Khởi động lại frontend/backend/collector để áp dụng. Không đưa khóa vào Git.`);
}
