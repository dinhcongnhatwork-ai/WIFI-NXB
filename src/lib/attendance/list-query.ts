import { Prisma } from '@prisma/client';
import { AttendanceInputError } from './session-validation';
export {vietnamMonthKey} from './presentation';
export function attendanceListQuery(params: URLSearchParams) {
  const status = params.get('status'), month = params.get('month'), search = params.get('search')?.trim();
  const page = Number(params.get('page') || 1), limit = Number(params.get('limit') || 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new AttendanceInputError('Phân trang không hợp lệ.');
  const where: Prisma.AttendanceSessionWhereInput = {};
  if (status && status !== 'ALL') {
    if (!['DRAFT','READY','ACTIVE','ENDED'].includes(status)) throw new AttendanceInputError('Bộ lọc trạng thái không hợp lệ.');
    where.status = status;
  }
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4)) < 2000 || Number(month.slice(0,4)) > 2200) throw new AttendanceInputError('Tháng không hợp lệ.');
    const [year, number] = month.split('-').map(Number);
    where.startTime = { gte: new Date(Date.UTC(year, number-1, 1, -7)), lt: new Date(Date.UTC(year, number, 1, -7)) };
  }
  if (search) where.OR = ['name','location','ssid'].map(field => ({[field]:{contains:search.slice(0,200),mode:'insensitive'}}));
  return {where,page,limit,skip:(page-1)*limit};
}
