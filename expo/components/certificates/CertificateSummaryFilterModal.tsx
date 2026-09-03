import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react-native';

import { BORDER_RADIUS, COLORS, SHADOW, SPACING } from '@/constants/theme';
import type { CertificateSummaryFilter, CertificateSummaryOption } from '@/lib/certificates/certificateSummary';

interface Props {
  visible: boolean;
  options: CertificateSummaryOption[];
  value: CertificateSummaryFilter;
  lockedMonths?: string[];
  onApply: (filter: CertificateSummaryFilter) => void;
  onClose: () => void;
}

function normalized(value: string | null): string {
  return String(value ?? '').trim();
}

function unique(values: Array<string | null>, limit = 80): string[] {
  return Array.from(new Set(values.map(normalized).filter(Boolean))).sort((a, b) => a.localeCompare(b)).slice(0, limit);
}

function toggleString(values: string[] | undefined, value: string): string[] | undefined {
  const next = new Set(values ?? []);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next.size ? Array.from(next) : undefined;
}

function numberValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>{active ? <Check size={12} color="#FFFFFF" /> : null}</TouchableOpacity>;
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'numeric' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8293A2" keyboardType={keyboardType} style={styles.input} /></View>;
}

export function CertificateSummaryFilterModal({ visible, options, value, lockedMonths, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<CertificateSummaryFilter>(value);
  useEffect(() => { if (visible) setDraft(value); }, [value, visible]);

  const choices = useMemo(() => ({
    codes: unique(options.map((item) => item.certificateCode)),
    ships: unique(options.map((item) => item.shipName)),
    classes: unique(options.map((item) => item.shipClass)),
    cabins: unique(options.map((item) => item.cabinLabel)),
    ports: unique(options.map((item) => item.departurePort)),
    regions: unique(options.map((item) => item.region)),
    days: unique(options.map((item) => item.startDay), 7),
  }), [options]);

  const clear = () => setDraft(lockedMonths?.length ? { certificateMonths: lockedMonths } : {});
  const set = <K extends keyof CertificateSummaryFilter>(key: K, next: CertificateSummaryFilter[K]) => setDraft((current) => ({ ...current, [key]: next }));

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.titleRow}><View style={styles.icon}><SlidersHorizontal size={18} color="#FFFFFF" /></View><View style={styles.flex}><Text style={styles.title}>Filter Cert Summary</Text><Text style={styles.subtitle}>Selections are applied together and never alter saved certificate data.</Text></View></View>
        <TouchableOpacity style={styles.close} onPress={onClose}><X size={20} color="#FFFFFF" /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}><Text style={styles.sectionTitle}>Search all recorded fields</Text><TextInput value={draft.searchQuery ?? ''} onChangeText={(next) => set('searchQuery', next || undefined)} placeholder="Ship, port, itinerary, cabin, code, bonus…" placeholderTextColor="#8293A2" style={styles.searchInput} /></View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Certificate family</Text><View style={styles.chips}>{(['A', 'C'] as const).map((type) => <ChoiceChip key={type} label={`${type} Certificates`} active={draft.certificateTypes?.includes(type) ?? false} onPress={() => set('certificateTypes', toggleString(draft.certificateTypes, type) as Array<'A' | 'C'> | undefined)} />)}</View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Certificate codes</Text><View style={styles.chips}>{choices.codes.map((code) => <ChoiceChip key={code} label={code} active={draft.certificateCodes?.includes(code) ?? false} onPress={() => set('certificateCodes', toggleString(draft.certificateCodes, code))} />)}</View></View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Guest eligibility</Text><View style={styles.chips}><ChoiceChip label="1 Guest" active={draft.guestCounts?.includes(1) ?? false} onPress={() => { const values = new Set(draft.guestCounts ?? []); values.has(1) ? values.delete(1) : values.add(1); set('guestCounts', values.size ? Array.from(values) : undefined); }} /><ChoiceChip label="2 Guests" active={draft.guestCounts?.includes(2) ?? false} onPress={() => { const values = new Set(draft.guestCounts ?? []); values.has(2) ? values.delete(2) : values.add(2); set('guestCounts', values.size ? Array.from(values) : undefined); }} /><ChoiceChip label="Include unknown" active={draft.includeUnknownGuests !== false} onPress={() => set('includeUnknownGuests', draft.includeUnknownGuests === false ? undefined : false)} /></View></View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Ship class</Text><View style={styles.chips}>{choices.classes.map((item) => <ChoiceChip key={item} label={item} active={draft.shipClasses?.includes(item) ?? false} onPress={() => set('shipClasses', toggleString(draft.shipClasses, item))} />)}</View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Ships</Text><View style={styles.chips}>{choices.ships.map((item) => <ChoiceChip key={item} label={item} active={draft.shipNames?.includes(item) ?? false} onPress={() => set('shipNames', toggleString(draft.shipNames, item))} />)}</View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Cabin entitlement</Text><View style={styles.chips}>{choices.cabins.map((item) => <ChoiceChip key={item} label={item} active={draft.cabinLabels?.includes(item) ?? false} onPress={() => set('cabinLabels', toggleString(draft.cabinLabels, item))} />)}</View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Departure ports</Text><View style={styles.chips}>{choices.ports.map((item) => <ChoiceChip key={item} label={item} active={draft.departurePorts?.includes(item) ?? false} onPress={() => set('departurePorts', toggleString(draft.departurePorts, item))} />)}</View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Destination regions</Text><View style={styles.chips}>{choices.regions.map((item) => <ChoiceChip key={item} label={item} active={draft.regions?.includes(item) ?? false} onPress={() => set('regions', toggleString(draft.regions, item))} />)}</View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Departure day</Text><View style={styles.chips}>{choices.days.map((item) => <ChoiceChip key={item} label={item} active={draft.startDays?.includes(item) ?? false} onPress={() => set('startDays', toggleString(draft.startDays, item))} />)}</View></View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Quick eligibility filters</Text><View style={styles.chips}><ChoiceChip label="Weekend departure" active={draft.weekendDepartureOnly === true} onPress={() => set('weekendDepartureOnly', draft.weekendDepartureOnly ? undefined : true)} /><ChoiceChip label="Florida departure" active={draft.floridaDepartureOnly === true} onPress={() => set('floridaDepartureOnly', draft.floridaDepartureOnly ? undefined : true)} /><ChoiceChip label="GTY only" active={draft.gty === true} onPress={() => set('gty', draft.gty === true ? undefined : true)} /><ChoiceChip label="Non-GTY" active={draft.gty === false} onPress={() => set('gty', draft.gty === false ? undefined : false)} /><ChoiceChip label="NextCruise bonus" active={draft.hasNextCruiseBonus === true} onPress={() => set('hasNextCruiseBonus', draft.hasNextCruiseBonus === true ? undefined : true)} /></View></View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Sailing date range</Text><View style={styles.fieldRow}><Field label="From" value={draft.startDate ?? ''} onChangeText={(next) => set('startDate', next || undefined)} placeholder="YYYY-MM-DD" /><Field label="Through" value={draft.endDate ?? ''} onChangeText={(next) => set('endDate', next || undefined)} placeholder="YYYY-MM-DD" /></View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Points and duration</Text><View style={styles.fieldRow}><Field label="Minimum points" value={draft.minimumPoints?.toString() ?? ''} onChangeText={(next) => set('minimumPoints', numberValue(next))} placeholder="0" keyboardType="numeric" /><Field label="Maximum points" value={draft.maximumPoints?.toString() ?? ''} onChangeText={(next) => set('maximumPoints', numberValue(next))} placeholder="70000" keyboardType="numeric" /></View><View style={styles.fieldRow}><Field label="Minimum nights" value={draft.minimumNights?.toString() ?? ''} onChangeText={(next) => set('minimumNights', numberValue(next))} placeholder="2" keyboardType="numeric" /><Field label="Maximum nights" value={draft.maximumNights?.toString() ?? ''} onChangeText={(next) => set('maximumNights', numberValue(next))} placeholder="18" keyboardType="numeric" /></View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Recorded benefits</Text><View style={styles.fieldRow}><Field label="Minimum FreePlay" value={draft.minimumFreePlay?.toString() ?? ''} onChangeText={(next) => set('minimumFreePlay', numberValue(next))} placeholder="$0" keyboardType="numeric" /><Field label="Minimum OBC" value={draft.minimumOnBoardCredit?.toString() ?? ''} onChangeText={(next) => set('minimumOnBoardCredit', numberValue(next))} placeholder="$0" keyboardType="numeric" /></View></View>
      </ScrollView>
      <View style={styles.footer}><TouchableOpacity style={styles.clearButton} onPress={clear}><RotateCcw size={17} color={COLORS.navyDeep} /><Text style={styles.clearText}>Clear All</Text></TouchableOpacity><TouchableOpacity style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.applyButton} onPress={() => onApply(draft)}><Check size={17} color="#FFFFFF" /><Text style={styles.applyText}>Apply Filters</Text></TouchableOpacity></View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF7FA' }, header: { backgroundColor: COLORS.navyDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }, icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 }, title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' }, subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 10, lineHeight: 15, marginTop: 2 }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }, content: { padding: SPACING.lg, paddingBottom: SPACING.xxl }, section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE3EA', borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm }, sectionTitle: { color: COLORS.navyDeep, fontSize: 14, fontWeight: '900', marginBottom: SPACING.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F7F9', borderWidth: 1, borderColor: '#C8DCE4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 }, chipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' }, chipText: { color: '#35546A', fontSize: 10, fontWeight: '800' }, chipTextActive: { color: '#FFFFFF' }, searchInput: { minHeight: 48, backgroundColor: '#F6FAFB', borderWidth: 1, borderColor: '#CBDDE4', borderRadius: 13, paddingHorizontal: SPACING.md, color: COLORS.navyDeep, fontSize: 13 }, fieldRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }, field: { flex: 1 }, fieldLabel: { color: '#607486', fontSize: 10, fontWeight: '800', marginBottom: 5 }, input: { minHeight: 44, backgroundColor: '#F6FAFB', borderWidth: 1, borderColor: '#CBDDE4', borderRadius: 11, paddingHorizontal: SPACING.sm, color: COLORS.navyDeep, fontSize: 12 }, footer: { flexDirection: 'row', gap: 7, padding: SPACING.md, borderTopWidth: 1, borderTopColor: '#C8DCE4', backgroundColor: '#FFFFFF' }, clearButton: { flex: 0.9, borderWidth: 1, borderColor: '#B8D1DC', borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 }, clearText: { color: COLORS.navyDeep, fontSize: 11, fontWeight: '900' }, cancelButton: { flex: 0.75, backgroundColor: '#E8EFF3', borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }, cancelText: { color: COLORS.navyDeep, fontSize: 11, fontWeight: '900' }, applyButton: { flex: 1.2, backgroundColor: '#0F766E', borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 }, applyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});
