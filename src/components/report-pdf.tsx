'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { CampaignReport } from '@/lib/exports/types';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 8, color: '#555', marginBottom: 10 },
  row: { flexDirection: 'row', borderBottom: '0.5px solid #ddd' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' },
  cell: { padding: 3, flexGrow: 1, flexBasis: 0 },
  cellName: { flexGrow: 1.6 },
  cellVoc: { flexGrow: 1.4 },
  headerText: { fontFamily: 'Helvetica-Bold' },
});

const COLS: { key: keyof CampaignReport['rows'][number]; label: string; wide?: 'name' | 'voc' }[] = [
  { key: 'campaign', label: 'Campaign', wide: 'name' },
  { key: 'customer_name', label: 'Customer', wide: 'name' },
  { key: 'contact', label: 'Contact' },
  { key: 'product', label: 'Product', wide: 'name' },
  { key: 'attempt_number', label: 'Attempt #' },
  { key: 'status', label: 'Status' },
  { key: 'language', label: 'Lang' },
  { key: 'started_at', label: 'Started' },
  { key: 'sealed_voc_id', label: 'Sealed VOC ID', wide: 'voc' },
  { key: 'dtmf', label: 'DTMF' },
  { key: 'duration', label: 'Duration' },
];

export function ReportDoc({ report }: { report: CampaignReport }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{report.campaignName} — Client Report</Text>
        <Text style={styles.meta}>
          {report.orderReference} · {report.rows.length} calls · Generated {report.generatedAt}
        </Text>

        <View style={styles.headerRow}>
          {COLS.map((c) => (
            <View
              key={c.key}
              style={[styles.cell, c.wide === 'name' ? styles.cellName : {}, c.wide === 'voc' ? styles.cellVoc : {}]}
            >
              <Text style={styles.headerText}>{c.label}</Text>
            </View>
          ))}
        </View>

        {report.rows.map((r, i) => (
          <View key={i} style={styles.row} wrap={false}>
            {COLS.map((c) => (
              <View
                key={c.key}
                style={[styles.cell, c.wide === 'name' ? styles.cellName : {}, c.wide === 'voc' ? styles.cellVoc : {}]}
              >
                <Text>{r[c.key]}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
