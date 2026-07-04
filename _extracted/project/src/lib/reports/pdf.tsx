import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { DailySummaryReportRow } from '@/types';

/**
 * PDF export — สรุปยอดบัญชีประจำวัน สำหรับพิมพ์/ส่งผู้บริหาร
 * ปิด gap ที่เหลือจาก Report Engine (Excel ทำไว้แล้วใน src/lib/reports/excel.ts)
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 16 },
  table: { display: 'flex', flexDirection: 'column', width: '100%' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 6 },
  headerRow: { flexDirection: 'row', backgroundColor: '#1e3a8a', paddingVertical: 8 },
  headerCell: { color: '#fff', fontWeight: 700, fontSize: 9 },
  cell: { fontSize: 9 },
  colBrand: { width: '28%' },
  colJobs: { width: '16%', textAlign: 'right' },
  colRevenue: { width: '20%', textAlign: 'right' },
  colCommission: { width: '18%', textAlign: 'right' },
  colAdvance: { width: '18%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 2, borderTopColor: '#1e3a8a', marginTop: 4 },
  footer: { marginTop: 24, fontSize: 8, color: '#888' },
});

interface DailySummaryPdfProps {
  reportDate: string;
  rows: DailySummaryReportRow[];
}

function DailySummaryDocument({ reportDate, rows }: DailySummaryPdfProps) {
  const totals = rows.reduce(
    (acc, row) => ({
      totalJobs: acc.totalJobs + row.totalJobs,
      totalNetRevenue: acc.totalNetRevenue + row.totalNetRevenue,
      totalCommission: acc.totalCommission + row.totalCommission,
      totalAdvanceDeducted: acc.totalAdvanceDeducted + row.totalAdvanceDeducted,
    }),
    { totalJobs: 0, totalNetRevenue: 0, totalCommission: 0, totalAdvanceDeducted: 0 }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CKT Online — รายงานสรุปยอดบัญชีประจำวัน</Text>
        <Text style={styles.subtitle}>วันที่ {reportDate}</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.colBrand]}>บริษัทขนส่ง</Text>
            <Text style={[styles.headerCell, styles.colJobs]}>จำนวนงาน</Text>
            <Text style={[styles.headerCell, styles.colRevenue]}>รายได้สุทธิ (บาท)</Text>
            <Text style={[styles.headerCell, styles.colCommission]}>คอมมิชชั่น (บาท)</Text>
            <Text style={[styles.headerCell, styles.colAdvance]}>หักเงินสำรอง (บาท)</Text>
          </View>

          {rows.map((row) => (
            <View style={styles.row} key={row.courierBrand}>
              <Text style={[styles.cell, styles.colBrand]}>{row.courierBrand}</Text>
              <Text style={[styles.cell, styles.colJobs]}>{row.totalJobs.toLocaleString()}</Text>
              <Text style={[styles.cell, styles.colRevenue]}>{row.totalNetRevenue.toLocaleString()}</Text>
              <Text style={[styles.cell, styles.colCommission]}>{row.totalCommission.toLocaleString()}</Text>
              <Text style={[styles.cell, styles.colAdvance]}>{row.totalAdvanceDeducted.toLocaleString()}</Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={[styles.cell, styles.colBrand, { fontWeight: 700 }]}>รวมทั้งหมด</Text>
            <Text style={[styles.cell, styles.colJobs, { fontWeight: 700 }]}>{totals.totalJobs.toLocaleString()}</Text>
            <Text style={[styles.cell, styles.colRevenue, { fontWeight: 700 }]}>
              {totals.totalNetRevenue.toLocaleString()}
            </Text>
            <Text style={[styles.cell, styles.colCommission, { fontWeight: 700 }]}>
              {totals.totalCommission.toLocaleString()}
            </Text>
            <Text style={[styles.cell, styles.colAdvance, { fontWeight: 700 }]}>
              {totals.totalAdvanceDeducted.toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          ออกโดยระบบ CKT Online อัตโนมัติ — เอกสารนี้เป็นสรุปข้อมูลเพื่อการบริหาร ไม่ใช่ใบเสร็จหรือใบกำกับภาษี
        </Text>
      </Page>
    </Document>
  );
}

export async function buildDailySummaryPdf(
  reportDate: string,
  rows: DailySummaryReportRow[]
): Promise<Buffer> {
  return renderToBuffer(<DailySummaryDocument reportDate={reportDate} rows={rows} />);
}
