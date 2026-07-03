import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, ChevronRight, Pencil, X } from 'lucide-react-native';
import {
  CASINO_DASHBOARD_COLORS,
  SOURCE_CONFIDENCE_COLOR,
  SOURCE_CONFIDENCE_LABEL,
  type SourceConfidence,
} from '@/constants/casinoDashboardTheme';

export type DrillDownSourceRecord = {
  label: string;
  value: string;
  confidence?: SourceConfidence;
  detail?: string;
};

export type DrillDownInputRow = { label: string; value: string };

export type CalculationDrillDownData = {
  title: string;
  subtitle?: string;
  /** Plain-English summary of what this value means. */
  summary?: string;
  /** Formula shown in readable form, e.g. "Net Make-Out = Comp Value + ... - Cash Paid". */
  formula?: string;
  /** The exact numbers plugged into the formula above. */
  inputs?: DrillDownInputRow[];
  /** Itemized ledger of the real records that contributed to this value. */
  sourceRecords?: DrillDownSourceRecord[];
  /** Assumptions used when data was incomplete (e.g. default VOOM rate). */
  assumptions?: string[];
  /** Anything missing, stale, or excluded from this calculation. */
  missing?: string[];
  /** Optional callback + label to let the user edit the underlying records. */
  onEdit?: () => void;
  editLabel?: string;
};

/** Small colored pill explaining how confident/verified a number is. */
export function SourceConfidenceBadge({ confidence }: { confidence: SourceConfidence }) {
  const color = SOURCE_CONFIDENCE_COLOR[confidence];
  return (
    <View style={[badgeStyles.pill, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <Text style={[badgeStyles.text, { color }]} numberOfLines={1}>{SOURCE_CONFIDENCE_LABEL[confidence]}</Text>
    </View>
  );
}

/** Monospace-feeling readable formula block, e.g. "Net Make-Out = A + B - C". */
export function FormulaBlock({ formula }: { formula: string }) {
  return (
    <View style={blockStyles.formulaBox}>
      <Text style={blockStyles.formulaText}>{formula}</Text>
    </View>
  );
}

/** Itemized list of the real records/values that fed a calculation. */
export function SourceRecordLedger({ records }: { records: DrillDownSourceRecord[] }) {
  if (records.length === 0) return null;
  return (
    <View style={blockStyles.ledger}>
      {records.map((record, index) => (
        <View
          key={`${record.label}-${index}`}
          style={[blockStyles.ledgerRow, index === records.length - 1 && { borderBottomWidth: 0 }]}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={blockStyles.ledgerLabel} numberOfLines={2}>{record.label}</Text>
            {record.detail ? <Text style={blockStyles.ledgerDetail} numberOfLines={2}>{record.detail}</Text> : null}
            {record.confidence ? (
              <View style={{ marginTop: 4 }}>
                <SourceConfidenceBadge confidence={record.confidence} />
              </View>
            ) : null}
          </View>
          <Text style={blockStyles.ledgerValue} numberOfLines={1}>{record.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Bulleted list of assumptions used when real data was incomplete. */
export function AssumptionList({ assumptions }: { assumptions: string[] }) {
  if (assumptions.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {assumptions.map((assumption, index) => (
        <View key={`${assumption}-${index}`} style={blockStyles.bulletRow}>
          <View style={blockStyles.bulletDot} />
          <Text style={blockStyles.bulletText}>{assumption}</Text>
        </View>
      ))}
    </View>
  );
}

/** Orange warning banner listing what's missing, stale, or excluded. */
export function MissingDataWarning({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={blockStyles.warningBox}>
      <AlertTriangle size={15} color={CASINO_DASHBOARD_COLORS.orange} />
      <View style={{ flex: 1, gap: 4 }}>
        {items.map((item, index) => (
          <Text key={`${item}-${index}`} style={blockStyles.warningText}>{item}</Text>
        ))}
      </View>
    </View>
  );
}

/** "Edit inputs" link/button surfaced at the bottom of a drill-down. */
export function EditableSourceLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={blockStyles.editLink} activeOpacity={0.8} onPress={onPress}>
      <Pencil size={14} color={CASINO_DASHBOARD_COLORS.royalBlue} />
      <Text style={blockStyles.editLinkText}>{label}</Text>
      <ChevronRight size={14} color={CASINO_DASHBOARD_COLORS.royalBlue} />
    </TouchableOpacity>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <Text style={blockStyles.sectionHeading}>{children}</Text>;
}

/** Full bottom-sheet style "How EasySeas calculated this" drill-down. */
export function CalculationDrillDownDrawer({
  data,
  onClose,
}: {
  data: CalculationDrillDownData | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={Boolean(data)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={drawerStyles.overlay}>
        <TouchableOpacity style={drawerStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={drawerStyles.sheet}>
          <View style={drawerStyles.handle} />
          <View style={drawerStyles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={drawerStyles.title} numberOfLines={2}>{data?.title}</Text>
              {data?.subtitle ? <Text style={drawerStyles.subtitle} numberOfLines={2}>{data.subtitle}</Text> : null}
            </View>
            <TouchableOpacity style={drawerStyles.closeButton} onPress={onClose} activeOpacity={0.7} testID="close-drilldown">
              <X size={16} color={CASINO_DASHBOARD_COLORS.deepNavy} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {data?.summary ? (
              <View style={{ marginBottom: 14 }}>
                <SectionHeading>Summary</SectionHeading>
                <Text style={blockStyles.bodyText}>{data.summary}</Text>
              </View>
            ) : null}

            {data?.formula ? (
              <View style={{ marginBottom: 14 }}>
                <SectionHeading>How EasySeas calculated this</SectionHeading>
                <FormulaBlock formula={data.formula} />
              </View>
            ) : null}

            {data?.inputs && data.inputs.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <SectionHeading>Inputs Used</SectionHeading>
                <SourceRecordLedger records={data.inputs.map((row) => ({ label: row.label, value: row.value }))} />
              </View>
            ) : null}

            {data?.sourceRecords && data.sourceRecords.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <SectionHeading>Source Records</SectionHeading>
                <SourceRecordLedger records={data.sourceRecords} />
              </View>
            ) : null}

            {data?.assumptions && data.assumptions.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <SectionHeading>Assumptions</SectionHeading>
                <AssumptionList assumptions={data.assumptions} />
              </View>
            ) : null}

            {data?.missing && data.missing.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <SectionHeading>Missing or Excluded Data</SectionHeading>
                <MissingDataWarning items={data.missing} />
              </View>
            ) : null}

            {data?.onEdit ? (
              <EditableSourceLink label={data.editLabel ?? 'Edit inputs'} onPress={data.onEdit} />
            ) : null}
          </ScrollView>

          <TouchableOpacity style={drawerStyles.closeCta} activeOpacity={0.85} onPress={onClose}>
            <Text style={drawerStyles.closeCtaText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Convenience hook so screens can `const drill = useDrillDown();` and call `drill.open({...})`. */
export function useDrillDown() {
  const [data, setData] = useState<CalculationDrillDownData | null>(null);
  const open = useCallback((next: CalculationDrillDownData) => setData(next), []);
  const close = useCallback(() => setData(null), []);
  const element = useMemo(() => <CalculationDrillDownDrawer data={data} onClose={close} />, [data, close]);
  return { open, close, element, isOpen: Boolean(data) };
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700' as const },
});

const blockStyles = StyleSheet.create({
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
  formulaBox: {
    backgroundColor: '#F1F5FE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE6FA',
    padding: 12,
  },
  formulaText: {
    fontSize: 13,
    lineHeight: 19,
    color: CASINO_DASHBOARD_COLORS.softNavy,
    fontWeight: '600' as const,
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
  ledger: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    overflow: 'hidden',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
  },
  ledgerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
  ledgerDetail: {
    fontSize: 11.5,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    marginTop: 2,
  },
  ledgerValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.deepNavy,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: CASINO_DASHBOARD_COLORS.purple,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF6E7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F6E2B8',
    padding: 12,
  },
  warningText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#8A5B10',
    fontWeight: '600' as const,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  editLinkText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.royalBlue,
  },
});

const drawerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 27, 77, 0.45)',
  },
  sheet: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: CASINO_DASHBOARD_COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: CASINO_DASHBOARD_COLORS.deepNavy,
  },
  subtitle: {
    fontSize: 12.5,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    marginTop: 3,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CASINO_DASHBOARD_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCta: {
    marginTop: 12,
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  closeCtaText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
