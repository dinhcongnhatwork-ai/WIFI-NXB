// ============================================
// Attendance & Meeting System - TypeScript Types (PLAN.MD)
// ============================================

export type AttendanceSessionStatus = 'DRAFT' | 'READY' | 'ACTIVE' | 'ENDED';

export type AttendanceRegistrationStatus =
  | 'PRESENT'           // Đang hiện diện (Xanh lục)
  | 'TEMPORARY_ABSENT'  // Tạm mất kết nối < 15 phút (Vàng hổ phách)
  | 'ALERT_ABSENT'      // Vắng kết nối liên tục ≥ 15 phút (Đỏ cảnh báo)
  | 'UNKNOWN';          // Không xác định do gián đoạn nguồn Controller (Xám)

export type AttendanceIntervalStatus = 'PRESENT' | 'ABSENT' | 'UNKNOWN';

export type AttendanceLogType =
  | 'REGISTER'          // Đăng ký mới qua biểu mẫu
  | 'CONNECT'           // Kết nối vào AP mục tiêu
  | 'DISCONNECT'        // Mất kết nối (lần quét đầu tiên không thấy)
  | 'CONFIRMED_MISS'    // Xác nhận tạm mất kết nối (2 lần quan sát liên tiếp)
  | 'RECONNECT'         // Quay lại vùng phủ sóng
  | 'ROAM_AP'           // Chuyển giữa các AP trong phòng họp
  | 'DEVICE_CHANGE'     // Admin xác nhận đổi thiết bị chính
  | 'ALERT_TRIGGERED'   // Kích hoạt cảnh báo đỏ (≥ 15 phút)
  | 'RECOVERED'         // Phục hồi sau cảnh báo đỏ
  | 'SYSTEM_SYNC'       // Đồng bộ dữ liệu Controller
  | 'SESSION_START'     // Bắt đầu buổi họp
  | 'SESSION_END';       // Kết thúc buổi họp

// Form Field Type for Custom Attendance Forms
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date';

export interface FormFieldDefinition {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  options?: string[]; // Cho select, radio, checkbox
  required: boolean;
  maxLength?: number;
  defaultValue?: string | boolean;
  isDisplayName?: boolean; // Trường được chọn làm Tên hiển thị
  isIdentifier?: boolean;  // Trường được chọn làm Mã định danh duy nhất (Mã NV, SĐT, CCCD...)
}

export interface AttendanceFormSchema {
  fields: FormFieldDefinition[];
  title?: string;
  description?: string;
  confirmButtonText?: string;
  successMessage?: string;
}

export interface TargetAccessPoint {
  mac: string;
  name: string;
  model?: string;
  ip?: string;
}

export interface AttendanceSessionDto {
  id: string;
  name: string;
  location?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  unifiSite: string;
  ssid: string;
  wlanConfId?: string | null;
  targetApMacs: string[];
  targetAps?: TargetAccessPoint[];
  formSchema: FormFieldDefinition[];
  nameFieldKey: string;
  idFieldKey: string;
  dialogTitle: string;
  dialogDescription?: string | null;
  confirmButtonText: string;
  successMessage: string;
  warningThresholdMinutes: number;
  status: AttendanceSessionStatus;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: AttendanceSessionStats;
}

export interface AttendanceSessionStats {
  totalRegistered: number;
  presentCount: number;
  temporaryAbsentCount: number;
  alertAbsentCount: number;
  unknownCount: number;
  unregisteredCount: number;
  totalWarnings: number;
  lastSyncTime?: string | null;
  syncHealth: 'healthy' | 'warning' | 'error';
  syncLagSeconds?: number;
}

export interface AttendanceRegistrationDto {
  id: string;
  sessionId: string;
  identityValue: string;
  displayName: string;
  formAnswers: Record<string, any>;
  primaryMac: string;
  primaryIp?: string | null;
  deviceVendor?: string | null;
  deviceOs?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  currentApMac?: string | null;
  currentApName?: string | null;
  currentRssi?: number | null;
  status: AttendanceRegistrationStatus;
  totalPresentSeconds: number;
  totalAbsentSeconds: number;
  totalUnknownSeconds: number;
  warningCount: number;
  absentStartedAt?: string | null;
  consecutiveMissCount: number;
  createdAt: string;
  updatedAt: string;
  intervals?: AttendanceIntervalDto[];
  deviceHistories?: AttendanceDeviceHistoryDto[];
}

export interface AttendanceIntervalDto {
  id: string;
  registrationId: string;
  apMac?: string | null;
  apName?: string | null;
  joinedAt: string;
  leftAt?: string | null;
  durationSeconds?: number | null;
  status: AttendanceIntervalStatus;
}

export interface AttendanceDeviceHistoryDto {
  id: string;
  registrationId: string;
  oldMac: string;
  newMac: string;
  reason?: string | null;
  performedBy: string;
  createdAt: string;
}

export interface AttendanceLogDto {
  id: string;
  sessionId: string;
  registrationId?: string | null;
  registrationName?: string | null;
  type: AttendanceLogType;
  message: string;
  details?: Record<string, any> | null;
  createdAt: string;
}

export interface AttendanceUnregisteredClientDto {
  id: string;
  sessionId: string;
  mac: string;
  ip?: string | null;
  apMac?: string | null;
  apName?: string | null;
  signal?: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

// Portal Submission Payload
export interface PortalAttendanceSubmitRequest {
  sessionId?: string;
  campaignId?: string;
  ssid?: string;
  mac: string;
  ip?: string;
  answers: Record<string, any>;
}

// Admin MAC Change Payload
export interface AdminChangeDeviceRequest {
  registrationId: string;
  newMac: string;
  reason: string;
  performedBy?: string;
}
