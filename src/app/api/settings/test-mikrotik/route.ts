import { withPermission,AccessError } from '@/lib/api-access';
export const POST=withPermission('admin',async()=>{throw new AccessError(400,'Lưu kết nối rồi kiểm tra qua /api/network/connections/{id}/test.');});
