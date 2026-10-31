import ExcelJS from 'exceljs';
import {
  AttendanceSessionDto,
  AttendanceRegistrationDto,
  AttendanceIntervalDto,
  AttendanceLogDto,
  AttendanceDeviceHistoryDto,
} from '@/types/attendance';
import { STATUS_CONFIG } from './constants';

/**
 * Format a Date or ISO string into Asia/Ho_Chi_Minh timezone
 */
export function formatVietnamTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Format seconds to readable hours/minutes
 */
export function formatDurationMinutes(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 phút';
  const mins = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (mins === 0) return `${remainingSecs}s`;
  return `${mins} phút ${remainingSecs > 0 ? `${remainingSecs}s` : ''}`.trim();
}

/**
 * Sanitize text to prevent Excel Formula Injection (=, +, -, @)
 */
function sanitizeExcelText(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export interface AttendanceExportData {
  session: AttendanceSessionDto;
  registrations: AttendanceRegistrationDto[];
  intervals: (AttendanceIntervalDto & { registrationName: string; identityValue: string })[];
  logs: AttendanceLogDto[];
  deviceHistories: (AttendanceDeviceHistoryDto & { registrationName: string; identityValue: string })[];
  isDraftOrActive?: boolean;
}

/**
 * Generate 3-Sheet Excel Workbook for Attendance Session
 */
export async function generateAttendanceExcelWorkbook(data: AttendanceExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ thống WiFi Marketing & Điểm danh họp - NXB Chính trị Quốc gia Sự thật';
  workbook.created = new Date();

  const isTemporary = data.session.status !== 'ENDED';

  // Define brand colors
  const primaryNavy = '1E3A8A';
  const lightHeaderBg = 'F1F5F9';
  const borderThin = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } },
  } as const;

  // =========================================================================
  // SHEET 1: TỔNG HỢP (SUMMARY)
  // =========================================================================
  const sheetSummary = workbook.addWorksheet('Báo cáo Tổng hợp', {
    views: [{ showGridLines: true }],
  });

  // Title block
  sheetSummary.mergeCells('A1:L1');
  const titleCell = sheetSummary.getCell('A1');
  titleCell.value = 'NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT';
  titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '334155' } };
  titleCell.alignment = { horizontal: 'center' };

  sheetSummary.mergeCells('A2:L2');
  const reportCell = sheetSummary.getCell('A2');
  reportCell.value = `BÁO CÁO ĐIỂM DANH VÀ HIỆN DIỆN CUỘC HỌP ${isTemporary ? '(BẢN TẠM THỜI)' : ''}`;
  reportCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: primaryNavy } };
  reportCell.alignment = { horizontal: 'center' };

  // Metadata block
  sheetSummary.getCell('B4').value = 'Tên buổi họp:';
  sheetSummary.getCell('B4').font = { bold: true };
  sheetSummary.getCell('C4').value = sanitizeExcelText(data.session.name);

  sheetSummary.getCell('F4').value = 'Thời gian diễn ra:';
  sheetSummary.getCell('F4').font = { bold: true };
  sheetSummary.getCell('G4').value = `${formatVietnamTime(data.session.startTime)} - ${formatVietnamTime(data.session.endTime)}`;

  sheetSummary.getCell('B5').value = 'Địa điểm:';
  sheetSummary.getCell('B5').font = { bold: true };
  sheetSummary.getCell('C5').value = sanitizeExcelText(data.session.location || 'Tầng 11');

  sheetSummary.getCell('F5').value = 'SSID & AP phát sóng:';
  sheetSummary.getCell('F5').font = { bold: true };
  sheetSummary.getCell('G5').value = `${data.session.ssid} (${data.session.targetApMacs.join(', ') || 'AP Tầng 11'})`;

  sheetSummary.getCell('B6').value = 'Trạng thái chốt:';
  sheetSummary.getCell('B6').font = { bold: true };
  sheetSummary.getCell('C6').value = isTemporary ? 'Đang diễn ra (Tạm thời)' : 'Đã kết thúc và chốt số liệu';

  sheetSummary.getCell('F6').value = 'Thời điểm xuất file:';
  sheetSummary.getCell('F6').font = { bold: true };
  sheetSummary.getCell('G6').value = formatVietnamTime(new Date());

  // Dynamic extra form fields
  const dynamicFields = (data.session.formSchema || []).filter(
    (f) => !f.isDisplayName && !f.isIdentifier
  );

  // Table Headers (Row 8)
  const headers = [
    'STT',
    'Mã định danh',
    'Tên hiển thị',
    ...dynamicFields.map((f) => f.label),
    'Thiết bị chính (MAC)',
    'Hệ điều hành / Loại máy',
    'AP cuối',
    'Lần vào đầu',
    'Thời điểm ra gần nhất',
    'Lần thấy cuối',
    'Tổng hiện diện (phút)',
    'Tổng vắng mặt (phút)',
    'Không xác định (phút)',
    'Số cảnh báo đỏ',
    'Trạng thái',
  ];

  const headerRow = sheetSummary.getRow(8);
  headerRow.values = headers;
  headerRow.height = 32;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryNavy },
    };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderThin;
  });

  // Table Data
  data.registrations.forEach((reg, index) => {
    const extraAnswers = dynamicFields.map((f) => {
      const val = reg.formAnswers?.[f.id];
      return sanitizeExcelText(val);
    });

    const statusLabel = STATUS_CONFIG[reg.status]?.label || reg.status;

    // Determine latest out / disconnect time
    const regIntervals = data.intervals.filter((i) => i.registrationId === reg.id);
    const lastLeftInterval = regIntervals.filter(i=>i.status==='PRESENT' && i.leftAt).sort((a,b)=>Date.parse(b.leftAt!)-Date.parse(a.leftAt!))[0];
    const lastLeftTime = reg.absentStartedAt || lastLeftInterval?.leftAt;

    const row = sheetSummary.addRow([
      index + 1,
      sanitizeExcelText(reg.identityValue),
      sanitizeExcelText(reg.displayName),
      ...extraAnswers,
      sanitizeExcelText(reg.primaryMac),
      sanitizeExcelText(reg.deviceVendor || reg.deviceOs || 'WiFi Device'),
      sanitizeExcelText(reg.currentApMac || '-'),
      formatVietnamTime(reg.firstSeenAt),
      formatVietnamTime(lastLeftTime),
      formatVietnamTime(reg.lastSeenAt),
      Math.round(reg.totalPresentSeconds / 60),
      Math.round(reg.totalAbsentSeconds / 60),
      Math.round((reg.totalUnknownSeconds || 0) / 60),
      reg.warningCount,
      statusLabel,
    ]);

    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber >= 10 ? 'center' : 'left',
      };

      // Ensure text format for employee code / MAC
      if (colNumber === 2 || colNumber === (dynamicFields.length + 4)) {
        cell.numFmt = '@';
      }
    });

    // Colorize status cell
    const statusCell = row.getCell(headers.length);
    if (reg.status === 'PRESENT') {
      statusCell.font = { color: { argb: '047857' }, bold: true };
    } else if (reg.status === 'ALERT_ABSENT') {
      statusCell.font = { color: { argb: 'B91C1C' }, bold: true };
    } else if (reg.status === 'TEMPORARY_ABSENT') {
      statusCell.font = { color: { argb: 'B45309' }, bold: true };
    }
  });

  // Auto-fit column widths
  sheetSummary.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len + 4, 45);
    });
    column.width = maxLen;
  });

  // =========================================================================
  // SHEET 2: LỊCH SỬ RA/VÀO (INTERVALS)
  // =========================================================================
  const sheetIntervals = workbook.addWorksheet('Lịch sử Ra - Vào', {
    views: [{ showGridLines: true }],
  });

  sheetIntervals.mergeCells('A1:H1');
  const intTitle = sheetIntervals.getCell('A1');
  intTitle.value = `NHẬT KÝ CHI TIẾT CÁC KHOẢNG HIỆN DIỆN VÀ RỜI PHÒNG`;
  intTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: primaryNavy } };
  intTitle.alignment = { horizontal: 'center' };

  const intervalHeaders = [
    'STT',
    'Mã định danh',
    'Tên người tham dự',
    'AP kết nối',
    'Thời điểm vào',
    'Thời điểm ra',
    'Thời lượng (phút)',
    'Trạng thái khoảng',
  ];

  const intHeaderRow = sheetIntervals.getRow(3);
  intHeaderRow.values = intervalHeaders;
  intHeaderRow.height = 28;
  intHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '334155' },
    };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });

  data.intervals.forEach((interval, idx) => {
    const durationMins = interval.durationSeconds
      ? Math.round(interval.durationSeconds / 60)
      : interval.leftAt
        ? Math.round(
            (new Date(interval.leftAt).getTime() - new Date(interval.joinedAt).getTime()) / 60000
          )
        : '-';

    const intRow = sheetIntervals.addRow([
      idx + 1,
      sanitizeExcelText(interval.identityValue),
      sanitizeExcelText(interval.registrationName),
      sanitizeExcelText(interval.apMac || '-'),
      formatVietnamTime(interval.joinedAt),
      formatVietnamTime(interval.leftAt),
      durationMins,
      interval.status === 'PRESENT' ? 'Hiện diện' : interval.status === 'ABSENT' ? 'Vắng mặt' : 'Không xác định',
    ]);

    intRow.height = 22;
    intRow.eachCell((cell, colNum) => {
      cell.border = borderThin;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNum === 1 || colNum >= 5 ? 'center' : 'left',
      };
      if (colNum === 2) cell.numFmt = '@';
    });
  });

  sheetIntervals.columns.forEach((column) => {
    let maxLen = 14;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len + 4, 40);
    });
    column.width = maxLen;
  });

  // =========================================================================
  // SHEET 3: SỰ CỐ VÀ ĐIỀU CHỈNH (AUDIT & INCIDENTS)
  // =========================================================================
  const sheetAudit = workbook.addWorksheet('Sự cố và Điều chỉnh', {
    views: [{ showGridLines: true }],
  });

  sheetAudit.mergeCells('A1:G1');
  const auditTitle = sheetAudit.getCell('A1');
  auditTitle.value = `NHẬT KÝ SỰ CỐ, CẢNH BÁO VÀ ĐỔI THIẾT BỊ`;
  auditTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: primaryNavy } };
  auditTitle.alignment = { horizontal: 'center' };

  const auditHeaders = [
    'STT',
    'Thời gian',
    'Loại sự kiện',
    'Người liên quan / Đối tượng',
    'Chi tiết / Thông điệp',
    'Thiết bị cũ / mới',
    'Người thực hiện',
  ];

  const auditHeaderRow = sheetAudit.getRow(3);
  auditHeaderRow.values = auditHeaders;
  auditHeaderRow.height = 28;
  auditHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '475569' },
    };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });

  // Filter logs for all relevant connection & audit events
  const auditEvents = data.logs.filter((l) =>
    [
      'DISCONNECT',
      'CONNECT',
      'RECONNECT',
      'ALERT_TRIGGERED',
      'RECOVERED',
      'DEVICE_CHANGE',
      'SYSTEM_SYNC',
      'SESSION_START',
      'SESSION_END',
    ].includes(l.type)
  );

  auditEvents.forEach((log, idx) => {
    const typeLabel =
      log.type === 'DISCONNECT'
        ? 'Rời phòng / Mất kết nối'
        : log.type === 'CONNECT'
          ? 'Kết nối phòng họp (Vào)'
          : log.type === 'RECONNECT'
            ? 'Kết nối lại phòng họp'
            : log.type === 'ALERT_TRIGGERED'
              ? `Cảnh báo đỏ (≥ ${data.session.warningThresholdMinutes}p)`
              : log.type === 'RECOVERED'
                ? 'Quay lại sau cảnh báo'
                : log.type === 'DEVICE_CHANGE'
                  ? 'Đổi thiết bị chính'
                  : log.type === 'SYSTEM_SYNC'
                    ? 'Đồng bộ / Điều chỉnh hệ thống'
                    : log.type;

    const devInfo =
      log.type === 'DEVICE_CHANGE' && log.details
        ? `${log.details.oldMac || ''} → ${log.details.newMac || ''}`
        : log.details?.mac || '-';

    const row = sheetAudit.addRow([
      idx + 1,
      formatVietnamTime(log.createdAt),
      typeLabel,
      sanitizeExcelText(log.registrationName || 'Hệ thống'),
      sanitizeExcelText(log.message),
      sanitizeExcelText(devInfo),
      sanitizeExcelText(log.details?.performedBy || 'Tự động'),
    ]);

    row.height = 22;
    row.eachCell((cell, colNum) => {
      cell.border = borderThin;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNum === 1 || colNum === 2 ? 'center' : 'left',
      };
    });

    if (log.type === 'ALERT_TRIGGERED') {
      row.getCell(3).font = { color: { argb: 'DC2626' }, bold: true };
    } else if (log.type === 'DISCONNECT') {
      row.getCell(3).font = { color: { argb: 'D97706' }, bold: true };
    } else if (log.type === 'CONNECT' || log.type === 'RECONNECT') {
      row.getCell(3).font = { color: { argb: '059669' }, bold: true };
    } else if (log.type === 'SYSTEM_SYNC') {
      row.getCell(3).font = { color: { argb: '2563EB' } };
    }
  });

  sheetAudit.columns.forEach((column) => {
    let maxLen = 14;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len + 4, 50);
    });
    column.width = maxLen;
  });

  // Return workbook as node Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
