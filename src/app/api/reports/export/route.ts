export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import ExcelJS from 'exceljs';

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'all'; // 'all' | 'overview' | 'campaigns' | 'meetings' | 'logs' | 'infrastructure'
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
    const campaignFilter = searchParams.get('campaignId') || undefined;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (fromParam) {
      const parsedFrom = new Date(fromParam);
      if (!isNaN(parsedFrom.getTime())) {
        startDate = parsedFrom;
      } else {
        startDate = new Date(now.getTime() - days * 86400000);
      }
    } else {
      startDate = new Date(now.getTime() - days * 86400000);
    }

    if (toParam) {
      const parsedTo = new Date(toParam);
      if (!isNaN(parsedTo.getTime())) {
        endDate = parsedTo;
      }
    }

    startDate.setHours(0, 0, 0, 0);

    const [campaigns, meetings, logs, targets] = await Promise.all([
      prisma.campaign.findMany({
        where: campaignFilter ? { id: campaignFilter } : undefined,
        include: {
          template: { select: { name: true } },
          _count: { select: { logs: true, attendanceSessions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.attendanceSession.findMany({
        where: campaignFilter ? { campaignId: campaignFilter } : undefined,
        take: 200,
        include: {
          campaign: { select: { name: true, ssid: true } },
          registrations: {
            select: {
              id: true,
              displayName: true,
              status: true,
              totalPresentSeconds: true,
              totalAbsentSeconds: true,
            },
          },
          _count: { select: { registrations: true, logs: true } },
        },
        orderBy: { startTime: 'desc' },
      }),
      prisma.log.findMany({
        where: {
          loginTime: { gte: startDate, lte: endDate },
          ...(campaignFilter ? { campaignId: campaignFilter } : {}),
        },
        include: {
          campaign: { select: { name: true, ssid: true } },
        },
        orderBy: { loginTime: 'desc' },
        take: 10000,
      }),
      prisma.monitoringTarget.findMany({
        where: { kind: { in: ['ap', 'router', 'switch', 'controller'] } },
        select: { id: true, name: true, kind: true, status: true, metadata: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const username = typeof user.username === 'string' ? user.username : 'Quản trị viên';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nhà Xuất Bản Chính Trị Quốc Gia Sự Thật';
    workbook.created = new Date();

    const dateRangeStr = `Từ ngày ${startDate.toLocaleDateString('vi-VN')} đến ngày ${endDate.toLocaleDateString('vi-VN')}`;
    const generatedMetaStr = `Người xuất: ${username}  |  Đơn vị: Trung tâm CNTT - NXB Chính trị quốc gia Sự thật  |  Thời điểm: ${now.toLocaleString('vi-VN')}`;

    // Helper: Style branded sheet header
    const applySheetHeader = (sheet: ExcelJS.Worksheet, reportTitle: string, lastColLetter: string) => {
      // Row 1: Brand Title
      sheet.mergeCells(`A1:${lastColLetter}1`);
      const r1 = sheet.getCell('A1');
      r1.value = 'NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT';
      r1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFF' } };
      r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Dark Navy
      r1.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 26;

      // Row 2: Subtitle
      sheet.mergeCells(`A2:${lastColLetter}2`);
      const r2 = sheet.getCell('A2');
      r2.value = 'HỆ THỐNG QUẢN TRỊ WIFI MARKETING VÀ ĐIỂM DANH ĐẠI BIỂU THÔNG MINH';
      r2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } }; // Royal Blue
      r2.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 20;

      // Row 3: Report Name
      sheet.mergeCells(`A3:${lastColLetter}3`);
      const r3 = sheet.getCell('A3');
      r3.value = reportTitle.toUpperCase();
      r3.font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1E293B' } };
      r3.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(3).height = 28;

      // Row 4: Date Range
      sheet.mergeCells(`A4:${lastColLetter}4`);
      const r4 = sheet.getCell('A4');
      r4.value = `Kỳ báo cáo: ${dateRangeStr}`;
      r4.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: '334155' } };
      r4.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(4).height = 18;

      // Row 5: Metadata
      sheet.mergeCells(`A5:${lastColLetter}5`);
      const r5 = sheet.getCell('A5');
      r5.value = generatedMetaStr;
      r5.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '64748B' } };
      r5.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(5).height = 18;

      // Row 6: Empty spacing
      sheet.getRow(6).height = 10;
    };

    // Helper: Style table headers
    const styleTableHeader = (sheet: ExcelJS.Worksheet, rowNumber: number) => {
      const row = sheet.getRow(rowNumber);
      row.height = 26;
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '1E293B' }, // Slate 800
        };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'CBD5E1' } },
          bottom: { style: 'medium', color: { argb: '0F172A' } },
          left: { style: 'thin', color: { argb: 'CBD5E1' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } },
        };
      });
    };

    // Helper: Style data row
    const styleDataRow = (row: ExcelJS.Row, isEven: boolean) => {
      row.height = 20;
      row.eachCell((cell: ExcelJS.Cell) => {
        if (!cell.fill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'F8FAFC' : 'FFFFFF' },
          };
        }
        cell.font = { name: 'Calibri', size: 10, color: { argb: '0F172A' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
      });
    };

    // -------------------------------------------------------------
    // SHEET 1: CHIẾN DỊCH (CAMPAIGNS)
    // -------------------------------------------------------------
    if (scope === 'all' || scope === 'campaigns' || scope === 'overview') {
      const sheet = workbook.addWorksheet('Chiến Dịch WiFi', {
        views: [{ showGridLines: true }],
      });

      applySheetHeader(sheet, 'Báo Cáo Hiệu Quả Chiến Dịch WiFi Marketing', 'I');

      // Summary KPI banner in Excel (Row 7 & 8)
      const activeCampaigns = campaigns.filter((c) => c.active).length;
      const totalCampaignLogins = campaigns.reduce((acc, c) => acc + c._count.logs, 0);
      const totalMeetingsLinked = campaigns.reduce((acc, c) => acc + c._count.attendanceSessions, 0);

      sheet.mergeCells('A7:C7');
      sheet.getCell('A7').value = `TỔNG SỐ CHIẾN DỊCH: ${campaigns.length} (${activeCampaigns} đang phát sóng)`;
      sheet.getCell('A7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E3A8A' } };
      sheet.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };

      sheet.mergeCells('D7:F7');
      sheet.getCell('D7').value = `TỔNG LƯỢT TRUY CẬP: ${totalCampaignLogins.toLocaleString('vi-VN')} lượt`;
      sheet.getCell('D7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
      sheet.getCell('D7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };

      sheet.mergeCells('G7:I7');
      sheet.getCell('G7').value = `CUỘC HỌP ĐIỂM DANH LIÊN KẾT: ${totalMeetingsLinked} phiên`;
      sheet.getCell('G7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '6B21A8' } };
      sheet.getCell('G7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FAF5FF' } };
      sheet.getRow(7).height = 22;

      sheet.getRow(8).height = 10;

      sheet.getRow(9).values = [
        'STT',
        'Tên Chiến Dịch',
        'Tên SSID WiFi',
        'Trạng Thái',
        'Mẫu Cổng Chào',
        'Lượt Truy Cập',
        'Cuộc Họp Liên Kết',
        'Ngày Bắt Đầu',
        'Ngày Kết Thúc',
      ];

      styleTableHeader(sheet, 9);

      sheet.columns = [
        { key: 'stt', width: 8 },
        { key: 'name', width: 38 },
        { key: 'ssid', width: 22 },
        { key: 'status', width: 16 },
        { key: 'template', width: 26 },
        { key: 'logins', width: 18 },
        { key: 'meetings', width: 20 },
        { key: 'start', width: 18 },
        { key: 'end', width: 18 },
      ];

      campaigns.forEach((c, idx) => {
        const row = sheet.addRow([
          idx + 1,
          c.name,
          c.ssid,
          c.active ? '🟢 Đang hoạt động' : '⚪ Tạm dừng',
          c.template?.name || 'Mặc định',
          c._count.logs,
          c._count.attendanceSessions,
          new Date(c.startTime).toLocaleDateString('vi-VN'),
          new Date(c.endTime).toLocaleDateString('vi-VN'),
        ]);

        styleDataRow(row, idx % 2 === 1);
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Total row
      const totalRow = sheet.addRow([
        'Tổng',
        `${campaigns.length} chiến dịch`,
        '',
        '',
        '',
        totalCampaignLogins,
        totalMeetingsLinked,
        '',
        '',
      ]);
      totalRow.height = 24;
      totalRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        cell.border = {
          top: { style: 'thin', color: { argb: '94A3B8' } },
          bottom: { style: 'double', color: { argb: '0F172A' } },
        };
      });
      totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(6).numFmt = '#,##0';
      totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    }

    // -------------------------------------------------------------
    // SHEET 2: ĐIỂM DANH CUỘC HỌP (MEETINGS)
    // -------------------------------------------------------------
    if (scope === 'all' || scope === 'meetings' || scope === 'overview') {
      const sheet = workbook.addWorksheet('Điểm Danh Họp', {
        views: [{ showGridLines: true }],
      });

      applySheetHeader(sheet, 'Báo Cáo Điểm Danh Đại Biểu Cuộc Họp & Hội Nghị', 'J');

      let grandTotalReg = 0;
      let grandTotalPresent = 0;

      meetings.forEach((m) => {
        const regs = m.registrations || [];
        grandTotalReg += regs.length;
        grandTotalPresent += regs.filter((r) => r.status?.toLowerCase() === 'present').length;
      });

      const grandRate = grandTotalReg > 0 ? (grandTotalPresent / grandTotalReg) * 100 : 0;

      // KPI banner
      sheet.mergeCells('A7:C7');
      sheet.getCell('A7').value = `TỔNG SỐ PHIÊN HỌP: ${meetings.length} phiên`;
      sheet.getCell('A7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E3A8A' } };
      sheet.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };

      sheet.mergeCells('D7:F7');
      sheet.getCell('D7').value = `TỔNG ĐẠI BIỂU: ${grandTotalReg} (Có mặt: ${grandTotalPresent} · Vắng: ${grandTotalReg - grandTotalPresent})`;
      sheet.getCell('D7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
      sheet.getCell('D7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };

      sheet.mergeCells('G7:J7');
      sheet.getCell('G7').value = `TỶ LỆ ĐIỂM DANH TRUNG BÌNH: ${grandRate.toFixed(1)}%`;
      sheet.getCell('G7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '9A3412' } };
      sheet.getCell('G7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7ED' } };
      sheet.getRow(7).height = 22;

      sheet.getRow(8).height = 10;

      sheet.getRow(9).values = [
        'STT',
        'Tên Cuộc Họp / Hội Nghị',
        'Chiến Dịch WiFi',
        'Địa Điểm',
        'Thời Gian Bắt Đầu',
        'Trạng Thái',
        'Tổng Đại Biểu',
        'Có Mặt',
        'Vắng Mặt',
        'Tỷ Lệ Điểm Danh',
      ];

      styleTableHeader(sheet, 9);

      sheet.columns = [
        { key: 'stt', width: 8 },
        { key: 'name', width: 36 },
        { key: 'campaign', width: 28 },
        { key: 'location', width: 20 },
        { key: 'startTime', width: 20 },
        { key: 'status', width: 16 },
        { key: 'total', width: 16 },
        { key: 'present', width: 14 },
        { key: 'absent', width: 14 },
        { key: 'rate', width: 18 },
      ];

      meetings.forEach((m, idx) => {
        const regs = m.registrations || [];
        const total = regs.length;
        const present = regs.filter((r) => r.status?.toLowerCase() === 'present').length;
        const absent = total - present;
        const rate = total > 0 ? present / total : 0;

        const row = sheet.addRow([
          idx + 1,
          m.name,
          m.campaign?.name || 'Không gắn chiến dịch',
          m.location || 'Hội trường NXB',
          new Date(m.startTime).toLocaleString('vi-VN'),
          m.status === 'active' || m.status === 'ACTIVE' ? '🟢 Đang diễn ra' : '⚪ Đã kết thúc',
          total,
          present,
          absent,
          rate,
        ]);

        styleDataRow(row, idx % 2 === 1);
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).numFmt = '#,##0';
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(8).numFmt = '#,##0';
        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(9).numFmt = '#,##0';
        row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(10).numFmt = '0.0%';
      });

      // Total row
      const grandRateNum = grandTotalReg > 0 ? grandTotalPresent / grandTotalReg : 0;
      const totalRow = sheet.addRow([
        'Tổng',
        `${meetings.length} phiên họp`,
        '',
        '',
        '',
        '',
        grandTotalReg,
        grandTotalPresent,
        grandTotalReg - grandTotalPresent,
        grandRateNum,
      ]);
      totalRow.height = 24;
      totalRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        cell.border = {
          top: { style: 'thin', color: { argb: '94A3B8' } },
          bottom: { style: 'double', color: { argb: '0F172A' } },
        };
      });
      totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(10).numFmt = '0.0%';
    }

    // -------------------------------------------------------------
    // SHEET 3: LỊCH SỬ TRUY CẬP (ACCESS LOGS)
    // -------------------------------------------------------------
    if (scope === 'all' || scope === 'logs') {
      const sheet = workbook.addWorksheet('Nhật Ký Truy Cập', {
        views: [{ showGridLines: true }],
      });

      applySheetHeader(sheet, 'Nhật Ký Đăng Nhập & Kết Nối Thiết Bị Khách', 'F');

      const uniqueMacsCount = new Set(logs.map((l) => l.mac)).size;

      sheet.mergeCells('A7:C7');
      sheet.getCell('A7').value = `TỔNG LƯỢT ĐĂNG NHẬP: ${logs.length.toLocaleString('vi-VN')} lượt`;
      sheet.getCell('A7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E3A8A' } };
      sheet.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };

      sheet.mergeCells('D7:F7');
      sheet.getCell('D7').value = `SỐ THIẾT BỊ DUY NHẤT (MAC): ${uniqueMacsCount} thiết bị`;
      sheet.getCell('D7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
      sheet.getCell('D7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };
      sheet.getRow(7).height = 22;

      sheet.getRow(8).height = 10;

      sheet.getRow(9).values = [
        'STT',
        'Thời Gian Đăng Nhập',
        'Địa Chỉ MAC',
        'Số Điện Thoại',
        'Chiến Dịch Áp Dụng',
        'Tên SSID',
      ];

      styleTableHeader(sheet, 9);

      sheet.columns = [
        { key: 'stt', width: 8 },
        { key: 'time', width: 22 },
        { key: 'mac', width: 22 },
        { key: 'phone', width: 18 },
        { key: 'campaign', width: 36 },
        { key: 'ssid', width: 22 },
      ];

      logs.forEach((l, idx) => {
        const row = sheet.addRow([
          idx + 1,
          new Date(l.loginTime).toLocaleString('vi-VN'),
          l.mac,
          l.phone || '—',
          l.campaign?.name || 'Khách vãng lai',
          l.campaign?.ssid || 'WIFI MARKETING',
        ]);

        styleDataRow(row, idx % 2 === 1);
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    // -------------------------------------------------------------
    // SHEET 4: HẠ TẦNG & ACCESS POINTS
    // -------------------------------------------------------------
    if (scope === 'all' || scope === 'overview' || scope === 'infrastructure') {
      const sheet = workbook.addWorksheet('Hạ Tầng AP & Mạng', {
        views: [{ showGridLines: true }],
      });

      applySheetHeader(sheet, 'Danh Mục Hạ Tầng Thiết Bị Mạng MikroTik & UniFi', 'F');

      const apList = targets.filter((t) => t.kind === 'ap');
      const onlineApsCount = apList.filter((a) => a.status === 'online').length;

      sheet.mergeCells('A7:C7');
      sheet.getCell('A7').value = `TỔNG THIẾT BỊ HẠ TẦNG: ${targets.length} (Access Point: ${apList.length})`;
      sheet.getCell('A7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E3A8A' } };
      sheet.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };

      sheet.mergeCells('D7:F7');
      sheet.getCell('D7').value = `TRẠNG THÁI ONLINE: ${onlineApsCount}/${apList.length} Access Point trực tuyến`;
      sheet.getCell('D7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
      sheet.getCell('D7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };
      sheet.getRow(7).height = 22;

      sheet.getRow(8).height = 10;

      sheet.getRow(9).values = [
        'STT',
        'Tên Thiết Bị',
        'Phân Loại',
        'Địa Chỉ IP',
        'Model / Phần Cứng',
        'Trạng Thái',
      ];

      styleTableHeader(sheet, 9);

      sheet.columns = [
        { key: 'stt', width: 8 },
        { key: 'name', width: 28 },
        { key: 'kind', width: 18 },
        { key: 'ip', width: 20 },
        { key: 'model', width: 28 },
        { key: 'status', width: 18 },
      ];

      targets.forEach((t: any, idx) => {
        const meta = t.metadata || {};
        const row = sheet.addRow([
          idx + 1,
          t.name,
          t.kind.toUpperCase(),
          meta.ip || '—',
          meta.model || meta.version || 'Hardware',
          t.status === 'online' ? '🟢 Trực tuyến' : '🔴 Ngoại tuyến',
        ]);

        styleDataRow(row, idx % 2 === 1);
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const dateSlug = now.toISOString().slice(0, 10);
    const scopeNames: Record<string, string> = {
      all: 'TongHop_HeThong',
      overview: 'TongQuan_ViecVanHanh',
      campaigns: 'ChienDich_WifiMarketing',
      meetings: 'DiemDanh_CuocHop',
      logs: 'NhatKy_TruyCapWiFi',
      infrastructure: 'HaTang_AccessPoint',
    };
    const durationLabel = fromParam ? 'TuyChon' : `${days}ngay`;
    const filename = `BaoCao_${scopeNames[scope] || 'TongHop'}_${durationLabel}_${dateSlug}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating Excel report:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tạo tệp Excel báo cáo' },
      { status: 500 },
    );
  }
}
