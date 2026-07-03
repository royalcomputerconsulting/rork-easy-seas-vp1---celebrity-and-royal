import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Edit2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, GRADIENTS } from '@/constants/theme';

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
  const clampedProgress = Math.min(100, Math.max(0, percentComplete));
  const defaultBarColor = isLoyalty ? COLORS.loyalty : COLORS.points;
  const actualBarColor = barColor || defaultBarColor;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.tierName}>Progress to {tierName}</Text>
          <Text style={styles.pointsNeeded}>
            {currentPoints.toLocaleString()}/{targetPoints.toLocaleString()} {isLoyalty ? 'nights' : 'points'}
          </Text>
        </View>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Edit2 size={16} color={COLORS.textNavy} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <View 
            style={[
              styles.barFill, 
              { width: `${clampedProgress}%`, backgroundColor: actualBarColor }
            ]} 
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.percentText}>{clampedProgress.toFixed(1)}% complete</Text>
        {eta && (
          <Text style={styles.etaText}>ETA: {eta}</Text>
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
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tierName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
  },
  pointsNeeded: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
  },
  editButton: {
    padding: SPACING.xs,
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
    alignItems: 'center',
  },
  percentText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
  },
  etaText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textNavy,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
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
