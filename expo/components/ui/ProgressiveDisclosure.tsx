import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';
import { EASY_SEAS_COMPONENT_TOKENS, EASY_SEAS_TYPE_STYLES } from '@/constants/theme';
import { loadDisclosure, saveDisclosure } from '@/lib/experience/experiencePreferences';
import { useExperience } from '@/state/ExperienceProvider';

export interface EssentialConclusion {
  id: string;
  label: string;
  value: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'estimated' | 'missing';
  onPress?: () => void;
  actionLabel?: string;
}

export function ProgressiveDisclosure({ ownerId, screenId, sectionId, title, conclusions, children, defaultOpen = false, testID }:{
  ownerId: string; screenId: string; sectionId: string; title: string; conclusions: EssentialConclusion[]; children: React.ReactNode; defaultOpen?: boolean; testID?: string;
}) {
  const { colors, textScale, minimumControlSize } = useExperience();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { void loadDisclosure(ownerId, screenId, sectionId, defaultOpen).then(setOpen); }, [ownerId, screenId, sectionId, defaultOpen]);
  const toggle = () => { const next = !open; setOpen(next); void saveDisclosure(ownerId, screenId, sectionId, next); };
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel={`${title}, ${open ? 'expanded' : 'collapsed'}`} testID={testID}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: Math.min(28, EASY_SEAS_TYPE_STYLES.sectionTitle.fontSize * textScale), lineHeight: Math.min(34, EASY_SEAS_TYPE_STYLES.sectionTitle.lineHeight * textScale) }]}>{title}</Text>
    <View style={styles.conclusions}>{conclusions.slice(0, 3).map((item) => {
      const content = <>
        <Text style={[styles.label, { color: colors.muted, fontSize: Math.max(11, EASY_SEAS_TYPE_STYLES.caption.fontSize * textScale) }]}>{item.label}</Text>
        <Text style={[styles.value, { color: colors.text, fontSize: EASY_SEAS_TYPE_STYLES.cardTitle.fontSize * textScale }]}>{item.value}</Text>
        {item.status ? <Text style={[styles.status, { color: colors.accent, fontSize: Math.max(11, EASY_SEAS_TYPE_STYLES.badge.fontSize * textScale) }]}>{item.status}</Text> : null}
        {item.actionLabel ? <Text style={[styles.actionLabel, { color: colors.accent }]}>{item.actionLabel}</Text> : null}
      </>;
      return item.onPress ? <TouchableOpacity key={item.id} style={[styles.conclusion, styles.actionableConclusion, { backgroundColor: colors.background, borderColor: colors.border, minHeight: minimumControlSize }]} onPress={item.onPress} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.value}. ${item.actionLabel ?? 'Open'}`} testID={`progressive-conclusion-${item.id}`}>{content}</TouchableOpacity> : <View key={item.id} style={[styles.conclusion, { backgroundColor: colors.background }]}>{content}</View>;
    })}</View>
    <TouchableOpacity style={[styles.control, { minHeight: minimumControlSize }]} onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${open ? 'Hide' : 'Show'} formulas, evidence, comparisons, and source records`}>
      <Text style={[styles.controlText, { color: colors.accent, fontSize: T.type.body * textScale }]}>{open ? 'Hide evidence and formulas' : 'Show evidence and formulas'}</Text>{open ? <ChevronUp size={19} color={colors.accent}/> : <ChevronDown size={19} color={colors.accent}/>}</TouchableOpacity>
    {open ? <View style={[styles.detail, { borderTopColor: colors.border }]}>{children}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: T.color.surface, borderRadius: EASY_SEAS_COMPONENT_TOKENS.cardRadius, borderWidth: EASY_SEAS_COMPONENT_TOKENS.borderWidth, borderColor: T.color.border, padding: EASY_SEAS_COMPONENT_TOKENS.cardPadding, marginBottom: EASY_SEAS_COMPONENT_TOKENS.cardGap, ...T.elevation.card },
  title: { ...EASY_SEAS_TYPE_STYLES.sectionTitle, color: T.color.deepNavy }, conclusions: { flexDirection: 'row', flexWrap: 'wrap', gap: EASY_SEAS_COMPONENT_TOKENS.grid, marginTop: EASY_SEAS_COMPONENT_TOKENS.cardGap },
  conclusion: { flexGrow: 1, minWidth: 92, backgroundColor: T.color.surfaceAlt, borderRadius: EASY_SEAS_COMPONENT_TOKENS.controlRadius, padding: EASY_SEAS_COMPONENT_TOKENS.grid + EASY_SEAS_COMPONENT_TOKENS.halfGrid }, label: { ...EASY_SEAS_TYPE_STYLES.caption, color: T.color.muted },
  value: { ...EASY_SEAS_TYPE_STYLES.cardTitle, color: T.color.text, marginTop: 3 }, status: { ...EASY_SEAS_TYPE_STYLES.badge, color: T.color.estimated, textTransform: 'uppercase', marginTop: 3 },
  actionableConclusion: { borderWidth: 1 }, actionLabel: { ...EASY_SEAS_TYPE_STYLES.badge, marginTop: 5 },
  control: { minHeight: EASY_SEAS_COMPONENT_TOKENS.minimumTarget, marginTop: EASY_SEAS_COMPONENT_TOKENS.cardGap, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, controlText: { ...EASY_SEAS_TYPE_STYLES.button, color: T.color.navy },
  detail: { borderTopWidth: EASY_SEAS_COMPONENT_TOKENS.dividerWidth, borderTopColor: T.color.border, paddingTop: EASY_SEAS_COMPONENT_TOKENS.cardGap },
});
