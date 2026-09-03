import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ExternalLink, FileCheck2, Link2, Pencil, Save, X } from 'lucide-react-native';

import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  CERTIFICATE_STACKING_LEDGER_BASE_KEY,
  STACKING_COMBINATIONS,
  loadCertificateStackingLedger,
  mergeStackingLedger,
  saveCertificateStackingLedger,
  validateStackingRule,
  type CertificateStackingRule,
  type StackingEvidenceStatus,
  type StackingOutcome,
} from '@/lib/certificates/certificateStackingLedger';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { useAuth } from '@/state/AuthProvider';
import { useCertificates } from '@/state/CertificatesProvider';

const STATUSES: Array<{ id: StackingEvidenceStatus; label: string }> = [
  { id: 'verified', label: 'Verified' },
  { id: 'host_confirmed', label: 'Host confirmed' },
  { id: 'terms_inferred', label: 'Terms inferred' },
  { id: 'unknown', label: 'Unknown' },
];
const OUTCOMES: Array<{ id: StackingOutcome; label: string }> = [
  { id: 'can_stack', label: 'Can stack' },
  { id: 'cannot_stack', label: 'Cannot stack' },
  { id: 'conditional', label: 'Conditional' },
  { id: 'unknown', label: 'Unknown' },
];

function evidenceLabel(status: StackingEvidenceStatus): string {
  return STATUSES.find((entry) => entry.id === status)?.label ?? 'Unknown';
}

function outcomeLabel(outcome: StackingOutcome): string {
  return OUTCOMES.find((entry) => entry.id === outcome)?.label ?? 'Unknown';
}

export default function CertificateStackingLedgerScreen() {
  const router = useRouter();
  const { authenticatedEmail } = useAuth();
  const { searchableCertificates, refreshCertificateDocuments } = useCertificates();
  const storageKey = useMemo(() => getUserScopedKey(CERTIFICATE_STACKING_LEDGER_BASE_KEY, authenticatedEmail), [authenticatedEmail]);
  const certificateCodes = useMemo(() => Array.from(new Set(searchableCertificates.map((certificate) => certificate.certificateCode?.trim().toUpperCase()).filter((code): code is string => Boolean(code)))).sort(), [searchableCertificates]);
  const [rules, setRules] = useState<CertificateStackingRule[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [editing, setEditing] = useState<CertificateStackingRule | null>(null);

  useEffect(() => {
    const interaction = runAfterUiSettles(() => void refreshCertificateDocuments());
    return () => interaction.cancel();
  }, [refreshCertificateDocuments]);

  useEffect(() => {
    let cancelled = false;
    void loadCertificateStackingLedger(storageKey).then((stored) => {
      if (cancelled) return;
      setRules(mergeStackingLedger(certificateCodes, stored));
    }).catch((error) => Alert.alert('Stacking ledger could not load', error instanceof Error ? error.message : String(error)));
    return () => { cancelled = true; };
  }, [certificateCodes, storageKey]);

  useEffect(() => {
    if (selectedCode && certificateCodes.includes(selectedCode)) return;
    setSelectedCode(certificateCodes[0] ?? rules[0]?.certificateCode ?? '');
  }, [certificateCodes, rules, selectedCode]);

  const selectedRules = useMemo(() => rules.filter((rule) => rule.certificateCode === selectedCode), [rules, selectedCode]);
  const coverage = useMemo(() => ({
    supported: selectedRules.filter((rule) => rule.status !== 'unknown').length,
    verified: selectedRules.filter((rule) => rule.status === 'verified').length,
    unknown: selectedRules.filter((rule) => rule.status === 'unknown').length,
  }), [selectedRules]);

  const saveEditing = useCallback(async () => {
    if (!editing) return;
    const errors = validateStackingRule(editing);
    if (errors.length > 0) {
      Alert.alert('Evidence required', errors.join('\n'));
      return;
    }
    const updated = rules.map((rule) => rule.id === editing.id ? { ...editing, updatedAt: new Date().toISOString() } : rule);
    try {
      await saveCertificateStackingLedger(storageKey, updated);
      setRules(updated);
      setEditing(null);
    } catch (error) {
      Alert.alert('Rule could not be saved', error instanceof Error ? error.message : String(error));
    }
  }, [editing, rules, storageKey]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#F3F3F2', '#FFFFFF', '#E8F7FB']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} testID="stacking-ledger.back"><ChevronLeft size={20} color="#1C2F7A" /></TouchableOpacity>
          <View style={styles.circleButton}><Link2 size={17} color="#0E7FA7" /></View>
        </View>
        <Text style={styles.eyebrow}>Certificate evidence</Text>
        <Text style={styles.title}>Stacking Rules Ledger</Text>
        <Text style={styles.subtitle}>Record what combines with each certificate, how certain the rule is, and the terms or host evidence supporting it. Unknown remains unknown until documented.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {certificateCodes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeRow}>
            {certificateCodes.map((code) => (
              <TouchableOpacity key={code} style={[styles.codeChip, selectedCode === code && styles.codeChipActive]} onPress={() => setSelectedCode(code)} testID={`stacking-ledger.code-${code}`}>
                <Text style={[styles.codeChipText, selectedCode === code && styles.codeChipTextActive]}>{code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {selectedCode ? (
          <>
            <View style={styles.coverageCard} testID="stacking-ledger.coverage">
              <Text style={styles.coverageTitle}>{selectedCode}</Text>
              <Text style={styles.coverageSubtitle}>{coverage.verified} verified • {coverage.supported} supported • {coverage.unknown} unknown</Text>
            </View>
            {selectedRules.map((rule) => {
              const combination = STACKING_COMBINATIONS.find((entry) => entry.id === rule.combination);
              return (
                <TouchableOpacity key={rule.id} style={styles.ruleCard} onPress={() => setEditing({ ...rule })} testID={`stacking-ledger.rule-${rule.combination}`}>
                  <View style={styles.ruleHeader}>
                    <View style={styles.ruleCopy}>
                      <Text style={styles.ruleTitle}>{combination?.label}</Text>
                      <Text style={styles.ruleHelp}>{combination?.help}</Text>
                    </View>
                    <Pencil size={16} color={COLORS.navyDeep} />
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, rule.status === 'verified' && styles.verifiedBadge]}><Text style={styles.badgeText}>{evidenceLabel(rule.status)}</Text></View>
                    <View style={styles.outcomeBadge}><Text style={styles.outcomeText}>{outcomeLabel(rule.outcome)}</Text></View>
                  </View>
                  <Text style={styles.evidenceText}>{rule.evidence || 'No evidence recorded yet.'}</Text>
                  {rule.sourceLabel ? <Text style={styles.sourceText}>Source: {rule.sourceLabel}</Text> : null}
                  {rule.sourceUrl ? (
                    <TouchableOpacity style={styles.sourceLink} onPress={() => void Linking.openURL(rule.sourceUrl as string)}><ExternalLink size={12} color="#0F766E" /><Text style={styles.sourceLinkText}>Open evidence</Text></TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyCard} testID="stacking-ledger.empty">
            <FileCheck2 size={25} color="#92400E" />
            <Text style={styles.emptyTitle}>Download certificate PDFs first</Text>
            <Text style={styles.emptyText}>The ledger creates seven evidence rows for every locally saved certificate code.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/certificate-codes')}><Text style={styles.primaryText}>Open Certificate Codes</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="stacking-ledger.editor">
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>{editing ? STACKING_COMBINATIONS.find((entry) => entry.id === editing.combination)?.label : ''}</Text><Text style={styles.modalSubtitle}>{editing?.certificateCode}</Text></View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setEditing(null)}><X size={18} color={COLORS.navyDeep} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Evidence status</Text>
              <View style={styles.optionWrap}>{STATUSES.map((status) => <TouchableOpacity key={status.id} style={[styles.optionChip, editing?.status === status.id && styles.optionChipActive]} onPress={() => setEditing((current) => current ? { ...current, status: status.id } : current)}><Text style={[styles.optionText, editing?.status === status.id && styles.optionTextActive]}>{status.label}</Text></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>Observed result</Text>
              <View style={styles.optionWrap}>{OUTCOMES.map((outcome) => <TouchableOpacity key={outcome.id} style={[styles.optionChip, editing?.outcome === outcome.id && styles.optionChipActive]} onPress={() => setEditing((current) => current ? { ...current, outcome: outcome.id } : current)}><Text style={[styles.optionText, editing?.outcome === outcome.id && styles.optionTextActive]}>{outcome.label}</Text></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>Supporting evidence</Text>
              <TextInput style={[styles.input, styles.multiline]} multiline value={editing?.evidence ?? ''} onChangeText={(evidence) => setEditing((current) => current ? { ...current, evidence } : current)} placeholder="Paste the relevant terms or summarize exactly what the host confirmed." />
              <Text style={styles.fieldLabel}>Source label</Text>
              <TextInput style={styles.input} value={editing?.sourceLabel ?? ''} onChangeText={(sourceLabel) => setEditing((current) => current ? { ...current, sourceLabel } : current)} placeholder="Royal terms, host name, email, call notes…" />
              <Text style={styles.fieldLabel}>Source URL (optional)</Text>
              <TextInput style={styles.input} value={editing?.sourceUrl ?? ''} onChangeText={(sourceUrl) => setEditing((current) => current ? { ...current, sourceUrl } : current)} placeholder="https://…" autoCapitalize="none" keyboardType="url" />
              <Text style={styles.fieldLabel}>Observed or confirmed date</Text>
              <TextInput style={styles.input} value={editing?.observedAt ?? ''} onChangeText={(observedAt) => setEditing((current) => current ? { ...current, observedAt } : current)} placeholder="YYYY-MM-DD" />
              <TouchableOpacity style={styles.saveButton} onPress={() => void saveEditing()} testID="stacking-ledger.save"><Save size={16} color="#FFFFFF" /><Text style={styles.saveText}>Save evidence</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F3F2' },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  circleButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5D5D0', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#0E7FA7', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#1C2F7A', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 29, fontWeight: '700', marginTop: 4 },
  subtitle: { color: '#66737F', fontSize: 13, lineHeight: 20, marginTop: SPACING.sm },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  codeRow: { gap: SPACING.xs, paddingBottom: SPACING.lg },
  codeChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 999, paddingHorizontal: SPACING.md, paddingVertical: 9 },
  codeChipActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep },
  codeChipText: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '900' },
  codeChipTextActive: { color: '#FFFFFF' },
  coverageCard: { backgroundColor: '#E1F4F5', borderWidth: 1, borderColor: '#A7D9DD', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  coverageTitle: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' },
  coverageSubtitle: { color: '#476371', fontSize: 12, marginTop: 3 },
  ruleCard: { backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: '#D5E4E9', marginBottom: SPACING.sm, ...SHADOW.sm },
  ruleHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  ruleCopy: { flex: 1 },
  ruleTitle: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '900' },
  ruleHelp: { color: '#667885', fontSize: 12, lineHeight: 17, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.md },
  badge: { backgroundColor: '#D5D5D0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedBadge: { backgroundColor: '#CFF7E8' },
  badgeText: { color: '#334155', fontSize: 10, fontWeight: '900' },
  outcomeBadge: { backgroundColor: '#DDEAF8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  outcomeText: { color: '#183C63', fontSize: 10, fontWeight: '900' },
  evidenceText: { color: '#334155', fontSize: 13, lineHeight: 19, marginTop: SPACING.sm },
  sourceText: { color: '#64748B', fontSize: 11, marginTop: 5 },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  sourceLinkText: { color: '#0F766E', fontSize: 11, fontWeight: '800' },
  emptyCard: { alignItems: 'center', gap: SPACING.sm, padding: SPACING.xl, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F1D38A', borderRadius: BORDER_RADIUS.xl },
  emptyTitle: { color: '#78350F', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' },
  emptyText: { color: '#64748B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primaryButton: { backgroundColor: COLORS.navyDeep, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 13, 26, 0.68)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '90%', backgroundColor: '#F8FBFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#DCE7EB' },
  modalTitle: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' },
  modalSubtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6EEF2', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  fieldLabel: { color: COLORS.navyDeep, fontSize: 12, fontWeight: '900', marginTop: SPACING.md, marginBottom: 6 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  optionChip: { borderRadius: 999, borderWidth: 1, borderColor: '#B9CDD6', backgroundColor: '#FFFFFF', paddingHorizontal: SPACING.md, paddingVertical: 8 },
  optionChipActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep },
  optionText: { color: COLORS.navyDeep, fontSize: 11, fontWeight: '800' },
  optionTextActive: { color: '#FFFFFF' },
  input: { minHeight: 46, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C8D8DF', borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, color: COLORS.navyDeep, fontSize: 14 },
  multiline: { minHeight: 100, paddingTop: SPACING.md, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: '#0F766E', borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md, marginTop: SPACING.xl },
  saveText: { color: '#FFFFFF', fontWeight: '900' },
});
