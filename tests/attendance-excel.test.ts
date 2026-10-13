import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  generateAttendanceExcelWorkbook,
  AttendanceExportData,
  formatVietnamTime,
  formatDurationMinutes,
} from '@/lib/attendance/excel';

describe('Attendance Excel Workbook Generator', () => {
  const mockData: AttendanceExportData = {
    session: {
      id: 'session-123',
      name: 'Họp giao ban Tầng 11',
      location: 'Hội trường Tầng 11',
      unifiSite: 'default',
      ssid: 'HOP_TANG_11',
      targetApMacs: ['70:a7:41:e8:a2:33', '70:a7:41:e8:a2:34'],
      formSchema: [
        {
          id: 'fullname',
          type: 'text',
          label: 'Họ và tên',
          required: true,
          isDisplayName: true,
          isIdentifier: false,
        },
        {
          id: 'employee_code',
          type: 'text',
          label: 'Mã nhân viên',
          required: true,
          isDisplayName: false,
          isIdentifier: true,
        },
        {
          id: 'dept',
          type: 'text',
          label: 'Phòng ban',
          required: false,
          isDisplayName: false,
          isIdentifier: false,
        },
      ],
      nameFieldKey: 'fullname',
      idFieldKey: 'employee_code',
      dialogTitle: 'Điểm danh cuộc họp',
      confirmButtonText: 'Xác nhận',
      successMessage: 'Thành công',
      warningThresholdMinutes: 15,
      status: 'ENDED',
      startTime: '2026-09-09T08:00:00Z',
      endTime: '2026-09-09T11:00:00Z',
      endedAt: '2026-09-09T11:05:00Z',
      createdAt: '2026-09-09T07:30:00Z',
      updatedAt: '2026-09-09T11:05:00Z',
    },
    registrations: [
      {
        id: 'reg-1',
        sessionId: 'session-123',
        identityValue: '012345', // Leading zero test
        displayName: 'Nguyễn Văn A',
        formAnswers: { dept: '=CMD|calc' }, // Formula injection test
        primaryMac: '70:a7:41:11:22:33',
        deviceVendor: 'Apple iPhone',
        firstSeenAt: '2026-09-09T08:02:00Z',
        lastSeenAt: '2026-09-09T10:55:00Z',
        currentApMac: '70:a7:41:e8:a2:33',
        status: 'PRESENT',
        totalPresentSeconds: 10200,
        totalAbsentSeconds: 180,
        totalUnknownSeconds: 0,
        warningCount: 0,
        consecutiveMissCount: 0,
        createdAt: '2026-09-09T08:02:00Z',
        updatedAt: '2026-09-09T10:55:00Z',
      },
    ],
    intervals: [
      {
        id: 'int-1',
        registrationId: 'reg-1',
        registrationName: 'Nguyễn Văn A',
        identityValue: '012345',
        apMac: '70:a7:41:e8:a2:33',
        joinedAt: '2026-09-09T08:02:00Z',
        leftAt: '2026-09-09T10:55:00Z',
        durationSeconds: 10380,
        status: 'PRESENT',
      },
    ],
    logs: [
      {
        id: 'log-1',
        sessionId: 'session-123',
        registrationName: 'Nguyễn Văn A',
        type: 'REGISTER',
        message: 'Nguyễn Văn A đã hoàn tất biểu mẫu điểm danh',
        createdAt: '2026-09-09T08:02:00Z',
      },
      {
        id: 'log-2',
        sessionId: 'session-123',
        registrationName: 'Nguyễn Văn A',
        type: 'DEVICE_CHANGE',
        message: 'Admin đổi thiết bị cho Nguyễn Văn A',
        details: { oldMac: '70:a7:41:11:22:33', newMac: '70:a7:41:99:88:77', performedBy: 'Admin' },
        createdAt: '2026-09-09T09:15:00Z',
      },
      {
        id: 'log-3',
        sessionId: 'session-123',
        registrationName: 'Nguyễn Văn A',
        type: 'DISCONNECT',
        message: 'Thiết bị ngắt kết nối khỏi mạng WiFi họp',
        details: { mac: '70:a7:41:99:88:77' },
        createdAt: '2026-09-09T09:30:00Z',
      },
      {
        id: 'log-4',
        sessionId: 'session-123',
        registrationName: 'Nguyễn Văn A',
        type: 'RECONNECT',
        message: 'Thiết bị đã kết nối lại vào mạng WiFi họp',
        details: { mac: '70:a7:41:99:88:77' },
        createdAt: '2026-09-09T09:35:00Z',
      },
    ],
    deviceHistories: [
      {
        id: 'dh-1',
        registrationId: 'reg-1',
        registrationName: 'Nguyễn Văn A',
        identityValue: '012345',
        oldMac: '70:a7:41:11:22:33',
        newMac: '70:a7:41:99:88:77',
        reason: 'Hết pin điện thoại',
        performedBy: 'Admin',
        createdAt: '2026-09-09T09:15:00Z',
      },
    ],
  };

  it('generates a valid 3-sheet Excel workbook with correct metadata and sanitization', async () => {
    const buffer = await generateAttendanceExcelWorkbook(mockData);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    // Read back workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // Verify 3 sheets exist
    expect(workbook.worksheets.length).toBe(3);
    expect(workbook.getWorksheet('Báo cáo Tổng hợp')).toBeDefined();
    expect(workbook.getWorksheet('Lịch sử Ra - Vào')).toBeDefined();
    expect(workbook.getWorksheet('Sự cố và Điều chỉnh')).toBeDefined();

    // Verify Sheet 1 contents
    const sheet1 = workbook.getWorksheet('Báo cáo Tổng hợp')!;
    expect(sheet1.getCell('A2').value).toContain('BÁO CÁO ĐIỂM DANH VÀ HIỆN DIỆN CUỘC HỌP');

    // Verify Row 8 Headers include 'Thời điểm ra gần nhất'
    const row8 = sheet1.getRow(8);
    const headers = row8.values as string[];
    expect(headers).toContain('Thời điểm ra gần nhất');

    // Verify Row 9 (First data row)
    const row9 = sheet1.getRow(9);
    // STT
    expect(row9.getCell(1).value).toBe(1);
    // Identity with leading zeros
    expect(row9.getCell(2).value).toBe('012345');
    // Display name
    expect(row9.getCell(3).value).toBe('Nguyễn Văn A');
    // Formula sanitization check: "=CMD|calc" should be prepended with "'"
    expect(row9.getCell(4).value).toBe("'=CMD|calc");

    // Verify Sheet 2 contents
    const sheet2 = workbook.getWorksheet('Lịch sử Ra - Vào')!;
    expect(sheet2.getCell('A1').value).toContain('NHẬT KÝ CHI TIẾT CÁC KHOẢNG HIỆN DIỆN');

    // Verify Sheet 3 contents (Sự cố, điều chỉnh & log kết nối / ra ngoài)
    const sheet3 = workbook.getWorksheet('Sự cố và Điều chỉnh')!;
    expect(sheet3.getCell('A1').value).toContain('NHẬT KÝ SỰ CỐ, CẢNH BÁO VÀ ĐỔI THIẾT BỊ');
    
    // Check DISCONNECT & RECONNECT entries in sheet 3
    let foundDisconnect = false;
    let foundReconnect = false;
    sheet3.eachRow((row) => {
      const eventType = row.getCell(3).value?.toString();
      if (eventType?.includes('Rời phòng / Mất kết nối')) foundDisconnect = true;
      if (eventType?.includes('Kết nối lại phòng họp')) foundReconnect = true;
    });
    expect(foundDisconnect).toBe(true);
    expect(foundReconnect).toBe(true);
  });

  it('correctly formats Vietnam time and durations', () => {
    const vnTime = formatVietnamTime('2026-09-09T08:30:00Z');
    expect(vnTime).toBeDefined();
    expect(vnTime).toContain('2026');

    expect(formatDurationMinutes(0)).toBe('0 phút');
    expect(formatDurationMinutes(45)).toBe('45s');
    expect(formatDurationMinutes(300)).toBe('5 phút');
    expect(formatDurationMinutes(3665)).toBe('61 phút 5s');
  });
});
