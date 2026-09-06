import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, EASY_SEAS_TYPE_STYLES } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

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
  surfaceTone?: 'light' | 'dark' | 'auto';
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
  backgroundColor,
  eta,
  surfaceTone = 'auto',
}: ProgressBarProps) {
  const { textScale, colors } = useExperience();
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const defaultGradient = [colors.accent, colors.accentSecondary ?? colors.accent];
  const fillColors = gradientColors || (color ? [color, color] : defaultGradient);
  const resolvedTrack = backgroundColor ?? colors.track;
  const useLightText = surfaceTone === 'dark';
  const primaryTextColor = useLightText ? COLORS.textOnDark : colors.text;
  const secondaryTextColor = useLightText ? COLORS.textOnDarkSecondary : colors.muted;
  const emphasisTextColor = useLightText ? COLORS.white : fillColors[0];

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress), text: label || value || `${Math.round(clampedProgress)} percent` }}>
      {(label || showPercentage || eta) && (
        <View style={styles.header}>
          {label && <Text style={[styles.label, { color: primaryTextColor, fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}>{label}</Text>}
          <View style={styles.headerRight}>
            {showPercentage && (
              <Text style={[styles.percentage, { color: emphasisTextColor, fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}>{clampedProgress.toFixed(1)}%</Text>
            )}
            {eta && <Text style={[styles.eta, { color: secondaryTextColor, fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}>ETA: {eta}</Text>}
          </View>
        </View>
      )}
      
      <View style={[styles.track, { height, backgroundColor: resolvedTrack }]}> 
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
          {value && <Text style={[styles.value, { color: primaryTextColor, fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}>{value}</Text>}
          {sublabel && <Text style={[styles.sublabel, { color: secondaryTextColor, fontSize: TYPOGRAPHY.fontSizeXS * textScale }]}>{sublabel}</Text>}
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  label: {
    ...EASY_SEAS_TYPE_STYLES.label,
    color: COLORS.textPrimary,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 150,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  percentage: {
    ...EASY_SEAS_TYPE_STYLES.caption,
    color: COLORS.beigeWarm,
    fontVariant: ['tabular-nums'],
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  value: {
    ...EASY_SEAS_TYPE_STYLES.caption,
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
  },
  sublabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
});
