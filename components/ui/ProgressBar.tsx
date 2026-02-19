import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface ProgressBarProps {
  progress: number;
  label?: string;
  value?: string;
  sublabel?: string;
  showPercentage?: boolean;
  height?: number;
  color?: string;
  gradientColors?: string[];
  backgroundColor?: string;
  eta?: string;
}

export const ProgressBar = React.memo(function ProgressBar({
  progress,
  label,
  value,
  sublabel,
  showPercentage = true,
  height = 8,
  color,
  gradientColors,
  backgroundColor = 'rgba(255,255,255,0.1)',
  eta,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const defaultGradient = [COLORS.beigeWarm, COLORS.goldDark];
  const fillColors = gradientColors || (color ? [color, color] : defaultGradient);

  return (
    <View style={styles.container}>
      {(label || showPercentage || eta) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          <View style={styles.headerRight}>
            {showPercentage && (
              <Text style={styles.percentage}>{clampedProgress.toFixed(1)}%</Text>
            )}
            {eta && <Text style={styles.eta}>ETA: {eta}</Text>}
          </View>
        </View>
      )}
      
      <View style={[styles.track, { height, backgroundColor }]}>
        <LinearGradient
          colors={fillColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.fill,
            { width: `${clampedProgress}%`, height },
          ]}
        />
      </View>
      
      {(value || sublabel) && (
        <View style={styles.footer}>
          {value && <Text style={styles.value}>{value}</Text>}
          {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  percentage: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  eta: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  track: {
    width: '100%',
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: BORDER_RADIUS.round,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  sublabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
});
