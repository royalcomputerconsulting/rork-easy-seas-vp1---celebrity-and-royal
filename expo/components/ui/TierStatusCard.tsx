import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

import {
  EasySeasColors,
  EasySeasRadius,
  EasySeasShadows,
  EasySeasSpacing,
  EasySeasTypography,
  resolveTierColor,
  withAlpha,
  type TierProgram,
} from '@/constants/easySeasTheme';

const PROGRAM_LABELS: Record<TierProgram, string> = {
  celebrityClubPoints: "Captain's Club",
  crownAndAnchor: 'Crown & Anchor',
  clubRoyale: 'Club Royale',
  blueChipClub: 'Blue Chip Club',
};

interface TierStatusCardProps {
  program: TierProgram;
  tier: string;
  currentPoints?: number;
  pointsUnitLabel?: string;
  nextTier?: string | null;
  pointsToNext?: number;
  percentComplete?: number;
  dataAsOfLabel?: string;
  onPress?: () => void;
}

/**
 * Reusable premium loyalty/casino status card. Automatically resolves the
 * correct tier color for whichever program it's showing, and uses the next
 * tier's color for the progress bar (current tier color for the identity
 * chip) per the SeaPass-inspired color rules.
 */
export const TierStatusCard = React.memo(function TierStatusCard({
  program,
  tier,
  currentPoints,
  pointsUnitLabel = 'pts',
  nextTier,
  pointsToNext,
  percentComplete,
  dataAsOfLabel,
  onPress,
}: TierStatusCardProps) {
  const currentColor = resolveTierColor(program, tier);
  const nextColor = nextTier ? resolveTierColor(program, nextTier) : currentColor;
  const clampedProgress = Math.min(100, Math.max(0, percentComplete ?? 0));
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.wrapper}
      {...(onPress ? { onPress, activeOpacity: 0.88 } : {})}
    >
      <LinearGradient
        colors={[withAlpha(currentColor, 0.14), withAlpha(EasySeasColors.navy, 0.06)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: withAlpha(currentColor, 0.28) }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.programLabel}>{PROGRAM_LABELS[program]}</Text>
          {onPress ? <ChevronRight size={16} color={EasySeasColors.textMuted} /> : null}
        </View>

        <View style={styles.tierRow}>
          <View style={[styles.tierChip, { backgroundColor: currentColor }]}>
            <Text style={styles.tierChipText} numberOfLines={1}>{tier}</Text>
          </View>
          {currentPoints !== undefined ? (
            <Text style={styles.pointsText}>
              {currentPoints.toLocaleString()} {pointsUnitLabel}
            </Text>
          ) : null}
        </View>

        {nextTier ? (
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Progress to {nextTier}</Text>
              {pointsToNext !== undefined ? (
                <Text style={[styles.progressLabel, { color: nextColor, fontWeight: '800' }]}>
                  {pointsToNext.toLocaleString()} {pointsUnitLabel} to go
                </Text>
              ) : null}
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${clampedProgress}%`, backgroundColor: nextColor }]} />
            </View>
          </View>
        ) : null}

        {dataAsOfLabel ? <Text style={styles.dataAsOf}>{dataAsOfLabel}</Text> : null}
      </LinearGradient>
    </Wrapper>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: EasySeasRadius.card,
  },
  card: {
    borderRadius: EasySeasRadius.card,
    borderWidth: 1,
    padding: EasySeasSpacing.lg,
    ...EasySeasShadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: EasySeasSpacing.sm,
  },
  programLabel: {
    ...EasySeasTypography.small,
    color: EasySeasColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EasySeasSpacing.sm,
    marginBottom: EasySeasSpacing.md,
  },
  tierChip: {
    paddingHorizontal: EasySeasSpacing.md,
    paddingVertical: 6,
    borderRadius: EasySeasRadius.pill,
  },
  tierChipText: {
    ...EasySeasTypography.cardTitle,
    fontSize: 16,
    color: '#FFFFFF',
  },
  pointsText: {
    ...EasySeasTypography.body,
    fontWeight: '700',
    color: EasySeasColors.textPrimary,
  },
  progressSection: {
    marginTop: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    ...EasySeasTypography.small,
    color: EasySeasColors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: EasySeasRadius.pill,
    backgroundColor: withAlpha(EasySeasColors.navy, 0.08),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: EasySeasRadius.pill,
  },
  dataAsOf: {
    ...EasySeasTypography.micro,
    color: EasySeasColors.textMuted,
    marginTop: EasySeasSpacing.sm,
  },
});
