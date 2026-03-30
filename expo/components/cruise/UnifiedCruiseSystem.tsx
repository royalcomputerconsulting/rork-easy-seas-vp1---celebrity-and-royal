import React, { memo, useMemo, useState } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Coins,
  MapPin,
  Ship,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react-native';
import { SHADOW, SPACING } from '@/constants/theme';
import type { DisplayField } from '../../lib/cruisePresentation';

export type AccentTone = 'gold' | 'teal' | 'emerald' | 'violet' | 'rose' | 'slate';

export interface AccentBadge {
  label: string;
  tone: AccentTone;
}

export interface SummaryPill {
  label: string;
  value: string;
  tone?: AccentTone;
}

export interface ActionItem {
  key: string;
  label: string;
  onPress: () => void;
  tone?: AccentTone;
}

export interface ChipItem {
  key: string;
  label: string;
  active?: boolean;
  onPress: () => void;
  tone?: AccentTone;
}

function getToneStyles(tone: AccentTone = 'slate') {
  switch (tone) {
    case 'gold':
      return {
        bg: 'rgba(212, 160, 10, 0.12)',
        border: 'rgba(212, 160, 10, 0.35)',
        text: '#92400E',
      };
    case 'teal':
      return {
        bg: 'rgba(0, 151, 167, 0.10)',
        border: 'rgba(0, 151, 167, 0.35)',
        text: '#0E7490',
      };
    case 'emerald':
      return {
        bg: 'rgba(5, 150, 105, 0.10)',
        border: 'rgba(5, 150, 105, 0.35)',
        text: '#065F46',
      };
    case 'violet':
      return {
        bg: 'rgba(123, 45, 142, 0.10)',
        border: 'rgba(123, 45, 142, 0.35)',
        text: '#6B21A8',
      };
    case 'rose':
      return {
        bg: 'rgba(220, 38, 38, 0.08)',
        border: 'rgba(220, 38, 38, 0.30)',
        text: '#9F1239',
      };
    default:
      return {
        bg: '#F1F5F9',
        border: '#E2E8F0',
        text: '#475569',
      };
  }
}

function getFieldToneColor(tone?: DisplayField['tone']) {
  switch (tone) {
    case 'success':
      return '#059669';
    case 'warning':
      return '#D97706';
    case 'danger':
      return '#DC2626';
    case 'accent':
      return '#1E3A5F';
    default:
      return '#1A2A3D';
  }
}

export const PremiumPageBackground = memo(function PremiumPageBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pageBackground}>
      {children}
    </View>
  );
});

export const PremiumHeroCard = memo(function PremiumHeroCard({
  title,
  subtitle,
  badge,
  imageUri,
  pills,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: AccentBadge;
  imageUri: string;
  pills: SummaryPill[];
  children?: React.ReactNode;
}) {
  const badgeTone = badge ? getToneStyles(badge.tone) : null;

  return (
    <View style={styles.heroShadowWrap}>
      <ImageBackground source={{ uri: imageUri }} style={styles.heroCard} imageStyle={styles.heroImage}>
        <LinearGradient
          colors={['rgba(6,14,30,0.22)', 'rgba(7,19,40,0.72)', 'rgba(10,26,52,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroOverlay}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBubble}>
              <Sparkles size={18} color="#FFE28F" />
            </View>
            {badgeTone ? (
              <View style={[styles.badge, { backgroundColor: badgeTone.bg, borderColor: badgeTone.border }]}>
                <Text style={[styles.badgeText, { color: badgeTone.text }]}>{badge?.label}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
          <View style={styles.pillsRow}>
            {pills.map((pill) => {
              return (
                <View key={pill.label} style={[styles.summaryPill, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }]}> 
                  <Text style={styles.summaryPillLabel}>{pill.label}</Text>
                  <Text style={[styles.summaryPillValue, { color: '#FFFFFF' }]}>{pill.value}</Text>
                </View>
              );
            })}
          </View>
          {children ? <View style={styles.heroChildContainer}>{children}</View> : null}
        </LinearGradient>
      </ImageBackground>
    </View>
  );
});

export const PremiumActionBar = memo(function PremiumActionBar({ actions }: { actions: ActionItem[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.actionRow}
      testID="premium-action-bar"
    >
      {actions.map((action) => {
        const tone = getToneStyles(action.tone);
        return (
          <TouchableOpacity
            key={action.key}
            style={[styles.actionButton, { backgroundColor: tone.bg, borderColor: tone.border }]}
            onPress={action.onPress}
            activeOpacity={0.82}
            testID={`action-${action.key}`}
          >
            <Text style={[styles.actionButtonText, { color: tone.text }]}>{action.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

export const PremiumChipBar = memo(function PremiumChipBar({ chips }: { chips: ChipItem[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      testID="premium-chip-bar"
    >
      {chips.map((chip) => {
        const tone = getToneStyles(chip.active ? chip.tone ?? 'gold' : 'slate');
        return (
          <TouchableOpacity
            key={chip.key}
            onPress={chip.onPress}
            activeOpacity={0.8}
            style={[
              styles.chip,
              {
                backgroundColor: chip.active ? tone.bg : '#F1F5F9',
                borderColor: chip.active ? tone.border : '#E2E8F0',
              },
            ]}
            testID={`chip-${chip.key}`}
          >
            <Text style={[styles.chipText, { color: chip.active ? tone.text : '#64748B' }]}>{chip.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

export const PremiumStatGrid = memo(function PremiumStatGrid({ title, fields }: { title?: string; fields: DisplayField[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <View style={styles.surfaceCard} testID="premium-stat-grid">
      {title ? <Text style={styles.sectionHeading}>{title}</Text> : null}
      <View style={styles.statGrid}>
        {fields.map((field) => (
          <View key={field.key} style={styles.statTile}>
            <Text style={styles.statTileLabel}>{field.label}</Text>
            <Text style={[styles.statTileValue, { color: getFieldToneColor(field.tone) }]}>{field.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

export const PremiumDataSection = memo(function PremiumDataSection({
  title,
  fields,
  defaultExpanded = true,
}: {
  title: string;
  fields: DisplayField[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  if (fields.length === 0) {
    return null;
  }

  return (
    <View style={styles.surfaceCard} testID={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setExpanded((current) => !current)} activeOpacity={0.82}>
        <Text style={styles.sectionHeading}>{title}</Text>
        <View style={styles.sectionChevronWrap}>
          {expanded ? <ChevronUp size={18} color="#4B5563" /> : <ChevronDown size={18} color="#4B5563" />}
        </View>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.fieldStack}>
          {fields.map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={[styles.fieldValue, { color: getFieldToneColor(field.tone) }]}>{field.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

export const PremiumEntityCard = memo(function PremiumEntityCard({
  title,
  subtitle,
  imageUri,
  badge,
  chips,
  primaryFields,
  extraFields,
  footerText,
  onPress,
}: {
  title: string;
  subtitle?: string;
  imageUri: string;
  badge?: AccentBadge;
  chips?: string[];
  primaryFields: DisplayField[];
  extraFields?: DisplayField[];
  footerText?: string;
  onPress?: () => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const badgeTone = useMemo(() => (badge ? getToneStyles(badge.tone) : null), [badge]);

  return (
    <TouchableOpacity style={styles.entityCardWrap} activeOpacity={0.92} onPress={onPress} testID="premium-entity-card">
      <ImageBackground source={{ uri: imageUri }} style={styles.entityHeader} imageStyle={styles.entityHeaderImage}>
        <LinearGradient
          colors={['rgba(8,18,37,0.15)', 'rgba(10,24,49,0.72)', 'rgba(16,18,42,0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.entityHeaderOverlay}
        >
          <View style={styles.entityTopRow}>
            {badgeTone ? (
              <View style={[styles.badge, { backgroundColor: badgeTone.bg, borderColor: badgeTone.border }]}>
                <Text style={[styles.badgeText, { color: badgeTone.text }]}>{badge?.label}</Text>
              </View>
            ) : <View />}
            {onPress ? (
              <View style={styles.inlineActionBadge}>
                <ArrowRight size={16} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <Text style={styles.entityTitle}>{title}</Text>
          {subtitle ? <Text style={styles.entitySubtitle}>{subtitle}</Text> : null}
          {chips && chips.length > 0 ? (
            <View style={styles.inlineChipWrap}>
              {chips.map((chip) => (
                <View key={chip} style={styles.inlineChip}>
                  <Text style={styles.inlineChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </LinearGradient>
      </ImageBackground>
      <View style={styles.entityBody}>
        <View style={styles.entityPrimaryGrid}>
          {primaryFields.map((field) => (
            <View key={field.key} style={styles.entityFieldTile}>
              <Text style={styles.entityFieldLabel}>{field.label}</Text>
              <Text style={[styles.entityFieldValue, { color: getFieldToneColor(field.tone) }]}>{field.value}</Text>
            </View>
          ))}
        </View>
        {extraFields && extraFields.length > 0 ? (
          <View style={styles.extraBlock}>
            <TouchableOpacity style={styles.moreButton} onPress={() => setExpanded((current) => !current)} activeOpacity={0.85}>
              <Text style={styles.moreButtonText}>{expanded ? 'Hide full data' : 'Show full data'}</Text>
              {expanded ? <ChevronUp size={16} color="#4B5563" /> : <ChevronDown size={16} color="#4B5563" />}
            </TouchableOpacity>
            {expanded ? (
              <View style={styles.fieldStack}>
                {extraFields.map((field) => (
                  <View key={field.key} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={[styles.fieldValue, { color: getFieldToneColor(field.tone) }]}>{field.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {footerText ? <Text style={styles.footerHint}>{footerText}</Text> : null}
      </View>
    </TouchableOpacity>
  );
});

export const PremiumEmptyState = memo(function PremiumEmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.emptyCard} testID="premium-empty-state">
      <View style={styles.emptyIconBubble}>
        <Ship size={26} color="#1E3A5F" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
});

export const PremiumQuickFacts = memo(function PremiumQuickFacts({ fields }: { fields: DisplayField[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <View style={styles.quickFactsRow}>
      {fields.map((field) => {
        const Icon = field.key.toLowerCase().includes('date') ? CalendarDays : field.key.toLowerCase().includes('port') ? MapPin : field.key.toLowerCase().includes('value') || field.key.toLowerCase().includes('free') ? Wallet : field.key.toLowerCase().includes('point') ? Coins : field.key.toLowerCase().includes('ship') ? Ship : Star;
        return (
          <View key={field.key} style={styles.quickFactCard}>
            <Icon size={15} color="#1E3A5F" />
            <Text style={styles.quickFactLabel}>{field.label}</Text>
            <Text style={[styles.quickFactValue, { color: getFieldToneColor(field.tone) }]}>{field.value}</Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  heroShadowWrap: {
    borderRadius: 28,
    overflow: 'hidden',
    ...SHADOW.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
  },
  heroCard: {
    minHeight: 248,
    justifyContent: 'flex-end',
  },
  heroImage: {
    borderRadius: 28,
  },
  heroOverlay: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'flex-end',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heroIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  pillsRow: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryPill: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  summaryPillLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryPillValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  heroChildContainer: {
    marginTop: 18,
  },
  actionRow: {
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  chipRow: {
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  surfaceCard: {
    borderRadius: 26,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.card,
  },
  sectionHeading: {
    color: '#1A2A3D',
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  statGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statTile: {
    width: '47%',
    minHeight: 92,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statTileLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  statTileValue: {
    marginTop: 8,
    color: '#1A2A3D',
    fontSize: 18,
    fontWeight: '800' as const,
    lineHeight: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldStack: {
    marginTop: 14,
    gap: 12,
  },
  fieldRow: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fieldLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  fieldValue: {
    marginTop: 7,
    color: '#1A2A3D',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  entityCardWrap: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.lg,
    shadowOpacity: 0.08,
  },
  entityHeader: {
    minHeight: 178,
    justifyContent: 'flex-end',
  },
  entityHeaderImage: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  entityHeaderOverlay: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 18,
  },
  entityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  inlineActionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  entityTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  entitySubtitle: {
    marginTop: 7,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  inlineChipWrap: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  inlineChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  entityBody: {
    padding: SPACING.lg,
    gap: 14,
  },
  entityPrimaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  entityFieldTile: {
    width: '47%',
    minHeight: 82,
    borderRadius: 18,
    padding: 13,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  entityFieldLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  entityFieldValue: {
    marginTop: 7,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  extraBlock: {
    marginTop: 2,
  },
  moreButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moreButtonText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  footerHint: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyCard: {
    borderRadius: 28,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.card,
  },
  emptyIconBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4F8',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    marginTop: 16,
    color: '#1A2A3D',
    fontSize: 20,
    fontWeight: '800' as const,
  },
  emptySubtitle: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  quickFactsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickFactCard: {
    flexGrow: 1,
    minWidth: 150,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  quickFactLabel: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  quickFactValue: {
    marginTop: 6,
    color: '#1A2A3D',
    fontSize: 17,
    fontWeight: '800' as const,
    lineHeight: 22,
  },
});
