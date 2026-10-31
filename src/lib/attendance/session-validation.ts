import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_FORM_FIELDS } from './constants';
import { isAttendanceTemplateReady } from './runtime';
export class AttendanceInputError extends Error { constructor(message: string, public status = 400) { super(message); } }
const nullableString = (value: unknown, label: string): string | null => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new AttendanceInputError(`${label} không hợp lệ.`);
  return value.trim() || null;
};
const requiredString = (value: unknown, label: string): string => {
  const result = nullableString(value, label);
  if (!result) throw new AttendanceInputError(`Thiếu ${label}.`);
  return result;
};
// Merge existing fields before validation so partial PATCH and create obey identical rules.
export function validateSessionInput(body: Record<string, unknown>, current?: Record<string, any>) {
  if(!body || typeof body!=='object' || Array.isArray(body))throw new AttendanceInputError('Dữ liệu buổi họp không hợp lệ.');
  const value: Record<string, any> = { status: 'DRAFT', unifiSite: 'default', targetApMacs: [], formSchema: DEFAULT_FORM_FIELDS, nameFieldKey: 'fullname', idFieldKey: 'fullname', dialogTitle: 'Điểm danh cuộc họp', confirmButtonText: 'Xác nhận điểm danh và kết nối', successMessage: 'Điểm danh thành công! Đang cấp quyền truy cập Internet...', warningThresholdMinutes: 15, ...current, ...body };
  const name = requiredString(value.name, 'tên buổi họp');
  const ssid = requiredString(value.ssid, 'SSID');
  const startTime = new Date(value.startTime as string | Date);
  const endTime = new Date(value.endTime as string | Date);
  for (const key of ['startTime', 'endTime']) if (typeof value[key] === 'string' && !/(Z|[+-]\d{2}:\d{2})$/i.test(value[key])) throw new AttendanceInputError('Thời gian phải là ISO có múi giờ.');
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || startTime >= endTime) throw new AttendanceInputError('Thời gian bắt đầu phải trước thời gian kết thúc.');
  if (!['DRAFT', 'READY', 'ACTIVE', 'ENDED'].includes(value.status as string)) throw new AttendanceInputError('Trạng thái buổi họp không hợp lệ.');
  if (current?.status === 'ENDED' && value.status !== 'ENDED') throw new AttendanceInputError('Buổi họp đã kết thúc không thể kích hoạt lại.');
  if (!Array.isArray(value.targetApMacs) || value.targetApMacs.some((item: unknown) => typeof item !== 'string')) throw new AttendanceInputError('Danh sách AP không hợp lệ.');
  const targetApMacs = Array.from(new Set((value.targetApMacs as string[]).map(mac => mac.trim().toLowerCase().replace(/-/g, ':')).filter(Boolean)));
  if (!Array.isArray(value.formSchema) || value.formSchema.some((field: any) => !field || typeof field !== 'object' || typeof field.id !== 'string' || typeof field.label !== 'string' || typeof field.type !== 'string')) throw new AttendanceInputError('Biểu mẫu điểm danh không hợp lệ.');
  if (new Set(value.formSchema.map((field: any) => field.id)).size !== value.formSchema.length) throw new AttendanceInputError('Mã trường biểu mẫu phải duy nhất.');
  const warningThresholdMinutes = Number(value.warningThresholdMinutes);
  if (!Number.isInteger(warningThresholdMinutes) || warningThresholdMinutes < 1 || warningThresholdMinutes > 120) throw new AttendanceInputError('Ngưỡng cảnh báo phải từ 1 đến 120 phút.');
  return { name, ssid, startTime, endTime, targetApMacs, warningThresholdMinutes, status: value.status as string,
    location: nullableString(value.location, 'địa điểm'), campaignId: nullableString(value.campaignId, 'chiến dịch'), templateId: nullableString(value.templateId, 'mẫu trực tiếp'),
    unifiSite: requiredString(value.unifiSite, 'UniFi site'), wlanConfId: nullableString(value.wlanConfId, 'WLAN'), formSchema: value.formSchema as unknown as Prisma.InputJsonValue,
    nameFieldKey: requiredString(value.nameFieldKey, 'trường tên'), idFieldKey: requiredString(value.idFieldKey, 'trường định danh'),
    dialogTitle: requiredString(value.dialogTitle, 'tiêu đề'), dialogDescription: nullableString(value.dialogDescription, 'mô tả'), confirmButtonText: requiredString(value.confirmButtonText, 'nút xác nhận'), successMessage: requiredString(value.successMessage, 'thông báo thành công') };
}
export async function validateSessionRelations(db: Pick<PrismaClient, 'attendanceSession' | 'campaign' | 'template'>, data: ReturnType<typeof validateSessionInput>, current?: Record<string, any>) {
  const campaign = data.campaignId ? await db.campaign.findUnique({ where: { id: data.campaignId }, include: { template: { include: { publishedRevision: true } } } }) : null;
  if (data.campaignId && !campaign) throw new AttendanceInputError('Không tìm thấy chiến dịch.');
  const direct = data.templateId ? await db.template.findUnique({ where: { id: data.templateId }, include: { publishedRevision: true } }) : null;
  if (data.templateId && !direct) throw new AttendanceInputError('Không tìm thấy mẫu trực tiếp.');
  // Only new activation (or changing an active meeting's template) needs the publication gate.
  if (data.status === 'ACTIVE' && (current?.status !== 'ACTIVE' || current?.templateId !== data.templateId || current?.campaignId !== data.campaignId)) {
    const template = direct || campaign?.template;
    if (!template?.publishedRevision || !isAttendanceTemplateReady(template.publishedRevision.layoutJson)) throw new AttendanceInputError('Hãy xuất bản mẫu có bật Điểm danh họp trước khi kích hoạt.');
  }
  if (data.status === 'READY' || data.status === 'ACTIVE') {
    if(campaign && ((campaign.ssid && campaign.ssid!==data.ssid) || (campaign.unifiSite && campaign.unifiSite!==data.unifiSite)))throw new AttendanceInputError('SSID hoặc site của buổi họp không khớp chiến dịch. Chọn lại chiến dịch hoặc bỏ liên kết.');
    const overlaps = await db.attendanceSession.findMany({ where: { ...(current?.id ? { id: { not: current.id } } : {}), ssid: data.ssid, unifiSite: data.unifiSite, status: { in: ['READY', 'ACTIVE'] }, startTime: { lt: data.endTime }, endTime: { gt: data.startTime } } });
    for (const other of overlaps) {
      const targets = Array.isArray(other.targetApMacs) ? other.targetApMacs as string[] : [];
      if (!data.targetApMacs.length || !targets.length || data.targetApMacs.some(mac => targets.map(item => item.toLowerCase().replace(/-/g, ':')).includes(mac))) throw new AttendanceInputError(`Buổi họp "${other.name}" trùng thời gian, SSID và AP.`);
    }
  }
}
