import ExcelJS from 'exceljs';
import type { DailySummaryReportRow } from '@/types';

/**
 * สร้างไฟล์ Excel สรุปยอดบัญชีประจำวัน
 * คืนค่าเป็น Buffer เพื่อให้ API route ส่งเป็น response ได้ตรงๆ
 */
export async function buildDailySummaryExcel(
  reportDate: string,
  rows: DailySummaryReportRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CKT Online';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('สรุปยอด');
  summarySheet.columns = [
    { header: 'บริษัทขนส่ง', key: 'courierBrand', width: 20 },
    { header: 'จำนวนงาน', key: 'totalJobs', width: 12 },
    { header: 'รายได้สุทธิ (บาท)', key: 'totalNetRevenue', width: 18 },
    { header: 'ค่าคอมมิชชั่นหัก (บาท)', key: 'totalCommission', width: 20 },
    { header: 'หักเงินสำรอง (บาท)', key: 'totalAdvanceDeducted', width: 18 },
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' },
  };

  for (const row of rows) {
    summarySheet.addRow({
      courierBrand: row.courierBrand,
      totalJobs: row.totalJobs,
      totalNetRevenue: row.totalNetRevenue,
      totalCommission: row.totalCommission,
      totalAdvanceDeducted: row.totalAdvanceDeducted,
    });
  }

  const totalRow = summarySheet.addRow({
    courierBrand: 'รวมทั้งหมด',
    totalJobs: sumBy(rows, (r) => r.totalJobs),
    totalNetRevenue: sumBy(rows, (r) => r.totalNetRevenue),
    totalCommission: sumBy(rows, (r) => r.totalCommission),
    totalAdvanceDeducted: sumBy(rows, (r) => r.totalAdvanceDeducted),
  });
  totalRow.font = { bold: true };

  summarySheet.insertRow(1, [`รายงานสรุปยอดบัญชีประจำวันที่ ${reportDate}`]);
  summarySheet.mergeCells('A1:E1');
  summarySheet.getRow(1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return Math.round(items.reduce((acc, item) => acc + selector(item), 0) * 100) / 100;
}
