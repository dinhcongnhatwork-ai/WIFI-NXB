import { AccessError } from '@/lib/api-access';
import { isAdminRole } from '@/lib/permissions';
export interface AccountChange {username:string;role:string;password?:string;disabled?:boolean}
export function validateAccountChange(input:AccountChange,current:{id:string;role:string;disabled:boolean}|null,activeAdmins:number){
 if(typeof input.username!=='string'||!/^[a-zA-Z\d_.-]{3,64}$/.test(input.username))throw new AccessError(400,'Tên đăng nhập cần 3–64 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
 if(!isAdminRole(input.role))throw new AccessError(400,'Vai trò không hợp lệ.');
 if((!current||input.password)&& (typeof input.password!=='string'||input.password.length<12||input.password.length>128))throw new AccessError(400,'Mật khẩu cần từ 12 đến 128 ký tự.');
 if(input.disabled!==undefined&&typeof input.disabled!=='boolean')throw new AccessError(400,'Trạng thái tài khoản không hợp lệ.');
 if(current?.role==='ADMIN'&&!current.disabled&&(input.role!=='ADMIN'||input.disabled===true)&&activeAdmins<=1)throw new AccessError(409,'Không thể vô hiệu hóa hoặc hạ quyền quản trị viên cuối cùng.');
}
