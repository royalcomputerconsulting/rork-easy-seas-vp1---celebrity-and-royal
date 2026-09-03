import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, Database, Sigma } from 'lucide-react-native';
import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';
import type { DataProvenance } from '@/types/provenance';
import { useExperience } from '@/state/ExperienceProvider';

export function ProvenanceDisclosure({ provenance, label = 'Where did this come from?' }:{ provenance: DataProvenance; label?: string }) {
  const [open, setOpen] = useState(false);
  const { colors, textScale, minimumControlSize } = useExperience();
  const sourceLabel = provenance.sourceType.replaceAll('_', ' ');
  return <View style={styles.wrap}>
    <TouchableOpacity style={[styles.button, { minHeight: minimumControlSize }]} onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label}. ${sourceLabel}, ${provenance.confidence} confidence`}>
      {provenance.isDerived ? <Sigma size={16} color={T.color.estimated}/> : <Database size={16} color={T.color.success}/>}<Text style={[styles.buttonText, { color: colors.accent, fontSize: T.type.supporting * textScale }]}>{label}</Text>{open ? <ChevronUp size={16} color={colors.text}/> : <ChevronDown size={16} color={colors.text}/>}</TouchableOpacity>
    {open ? <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.source, { color: colors.text }]}>{sourceLabel} · {provenance.confidence}</Text><Text style={[styles.line, { color: colors.muted }]}>{provenance.sourceRecord}</Text><Text style={[styles.line, { color: colors.muted }]}>{new Date(provenance.observedAt).toLocaleString()}</Text>{provenance.formula ? <Text style={styles.formula}>Formula: {provenance.formula}</Text> : null}{provenance.isDerived ? <Text style={styles.derived}>Calculated or estimated value—not a provider-reported fact.</Text> : null}</View> : null}
  </View>;
}

const styles = StyleSheet.create({ wrap: { marginTop: T.space.sm }, button: { minHeight: T.control.minimum, flexDirection: 'row', alignItems: 'center', gap: T.space.sm }, buttonText: { flex: 1, color: T.color.navy, fontWeight: '800' }, panel: { backgroundColor: T.color.surfaceAlt, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.border, padding: T.space.md }, source: { color: T.color.text, fontWeight: '900', textTransform: 'capitalize' }, line: { color: T.color.muted, fontSize: T.type.supporting, marginTop: 4 }, formula: { color: T.color.estimated, fontWeight: '700', marginTop: 7 }, derived: { color: T.color.warning, fontWeight: '800', marginTop: 7 } });
