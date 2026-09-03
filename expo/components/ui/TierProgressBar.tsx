import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Edit2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, GRADIENTS } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

interface TierProgressBarProps {
  tierName: string;
  currentPoints: number;
  targetPoints: number;
  percentComplete: number;
  eta?: string;
  barColor?: string;
  onEdit?: () => void;
  compact?: boolean;
  isLoyalty?: boolean;
}

export function TierProgressBar({
  tierName,
  currentPoints,
  targetPoints,
  percentComplete,
  eta,
  barColor,
  onEdit,
  compact = false,
  isLoyalty = false,
}: TierProgressBarProps) {
  const { textScale, minimumControlSize, colors } = useExperience();
  const clampedProgress = Math.min(100, Math.max(0, percentComplete));
  const defaultBarColor = isLoyalty ? COLORS.loyalty : COLORS.points;
  const actualBarColor = barColor || defaultBarColor;

  return (
    <View style={[styles.container, compact && styles.containerCompact]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress), text: `Progress to ${tierName}` }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.tierName, { color: colors.text, fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}>Progress to {tierName}</Text>
          <Text style={[styles.pointsNeeded, { color: colors.muted, fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}> 
            {currentPoints.toLocaleString()}/{targetPoints.toLocaleString()} {isLoyalty ? 'nights' : 'points'}
          </Text>
        </View>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={[styles.editButton, { minWidth: minimumControlSize, minHeight: minimumControlSize }]} accessibilityRole="button" accessibilityLabel={`Edit ${tierName} progress`}>
            <Edit2 size={16} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.barContainer}>
        <View style={[styles.barTrack, { backgroundColor: colors.track }]}> 
          <View 
            style={[
              styles.barFill, 
              { width: `${clampedProgress}%`, backgroundColor: actualBarColor }
            ]} 
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.percentText, { color: colors.muted, fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}>{clampedProgress.toFixed(1)}% complete</Text>
        {eta && (
          <Text style={[styles.etaText, { color: colors.accent, fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}>ETA: {eta}</Text>
        )}
      </View>
    </View>
  );
}

interface DualTierProgressProps {
  pinnacle: {
    currentPoints: number;
    targetPoints: number;
    percentComplete: number;
    eta?: string;
  };
  signature: {
    currentPoints: number;
    targetPoints: number;
    percentComplete: number;
    eta?: string;
  };
  onEditPinnacle?: () => void;
  onEditSignature?: () => void;
}

export function DualTierProgress({
  pinnacle,
  signature,
  onEditPinnacle,
  onEditSignature,
}: DualTierProgressProps) {
  return (
    <View style={styles.dualContainer}>
      <LinearGradient
        colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dualGradient}
      >
        <TierProgressBar
          tierName="Pinnacle"
          currentPoints={pinnacle.currentPoints}
          targetPoints={pinnacle.targetPoints}
          percentComplete={pinnacle.percentComplete}
          eta={pinnacle.eta}
          barColor={COLORS.points}
          onEdit={onEditPinnacle}
          isLoyalty
        />

        <View style={styles.divider} />

        <TierProgressBar
          tierName="Signature"
          currentPoints={signature.currentPoints}
          targetPoints={signature.targetPoints}
          percentComplete={signature.percentComplete}
          eta={signature.eta}
          barColor={COLORS.loyalty}
          onEdit={onEditSignature}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
  },
  containerCompact: {
    paddingVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tierName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
    flexShrink: 1,
  },
  pointsNeeded: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    flexShrink: 1,
  },
  editButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  barContainer: {
    marginBottom: SPACING.xs,
  },
  barTrack: {
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.round,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  percentText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    flexShrink: 1,
  },
  etaText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textNavy,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flexShrink: 1,
  },
  dualContainer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  dualGradient: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.sm,
  },
});
