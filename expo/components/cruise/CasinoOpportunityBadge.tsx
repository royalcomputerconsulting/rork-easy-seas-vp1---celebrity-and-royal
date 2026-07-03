import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Dice5, Ship, Timer } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { CasinoOpportunityLabel, CasinoOpportunityScore } from '@/lib/cruise/casinoOpportunityScore';

type CasinoOpportunityBadgeProps = {
  result: CasinoOpportunityScore;
  compact?: boolean;
  showWarnings?: boolean;
};

function getLabelMeta(label: CasinoOpportunityLabel) {
  switch (label) {
    case 'excellent':
      return { color: COLORS.success, backgroundColor: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.30)' };
    case 'strong':
      return { color: COLORS.pointsDark, backgroundColor: 'rgba(0, 151, 167, 0.12)', borderColor: 'rgba(0, 151, 167, 0.30)' };
    case 'good':
      return { color: COLORS.primary, backgroundColor: 'rgba(30, 58, 95, 0.10)', borderColor: 'rgba(30, 58, 95, 0.24)' };
    case 'limited':
      return { color: COLORS.warning, backgroundColor: 'rgba(245, 158, 11, 0.13)', borderColor: 'rgba(245, 158, 11, 0.30)' };
    case 'poor':
      return { color: COLORS.error, backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: 'rgba(220, 38, 38, 0.28)' };
    case 'unknown':
    default:
      return { color: COLORS.textSecondary, backgroundColor: COLORS.bgTertiary, borderColor: COLORS.borderLight };
  }
}

function titleCase(label: string): string {
  return label
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function CasinoOpportunityBadge({ result, compact = false, showWarnings = false }: CasinoOpportunityBadgeProps) {
  const safeResult: CasinoOpportunityScore = result ?? {
    score: null,
    label: 'unknown',
    casinoOpenDayCount: 0,
    estimatedCasinoHours: null,
    seaDayCount: 0,
    portDayCount: 0,
    privateIslandDayCount: 0,
    restrictedDayCount: 0,
    unknownDayCount: 0,
    reasons: [],
    warnings: ['No casino opportunity score provided.'],
    dayBreakdown: [],
  };
  const meta = getLabelMeta(safeResult.label);
  const scoreLabel = safeResult.score === null ? '—' : String(safeResult.score);
  const hasWarnings = safeResult.warnings.length > 0;

  return (
    <View
      style={[
        styles.container,
        compact && styles.compactContainer,
        { backgroundColor: meta.backgroundColor, borderColor: meta.borderColor },
      ]}
      testID="casino-opportunity-badge"
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Dice5 size={compact ? 13 : 15} color={meta.color} />
          <Text style={[styles.title, { color: meta.color }]}>Casino Opportunity</Text>
        </View>
        {hasWarnings && <AlertTriangle size={14} color={COLORS.warning} />}
      </View>

      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: meta.color }]}>{scoreLabel}</Text>
        <Text style={styles.label}>{titleCase(safeResult.label)}</Text>
      </View>

      {!compact && (
        <View style={styles.metricsRow}>
          <View style={styles.metricPill}>
            <Ship size={12} color={COLORS.textSecondary} />
            <Text style={styles.metricText}>{safeResult.casinoOpenDayCount} casino days</Text>
          </View>
          <View style={styles.metricPill}>
            <Timer size={12} color={COLORS.textSecondary} />
            <Text style={styles.metricText}>{safeResult.estimatedCasinoHours ?? '—'} hrs est.</Text>
          </View>
        </View>
      )}

      {showWarnings && hasWarnings && (
        <Text style={styles.warningText}>{safeResult.warnings[0]}</Text>
      )}
    </View>
  );
}

export default CasinoOpportunityBadge;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  compactContainer: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  score: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  metricText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  warningText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.warning,
    lineHeight: 16,
  },
});
