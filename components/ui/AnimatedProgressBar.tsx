import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface AnimatedProgressBarProps {
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
  animated?: boolean;
  showGlow?: boolean;
  milestones?: number[];
}

export function AnimatedProgressBar({
  progress,
  label,
  value,
  sublabel,
  showPercentage = true,
  height = 10,
  color,
  gradientColors,
  backgroundColor = 'rgba(255,255,255,0.1)',
  eta,
  animated = true,
  showGlow = true,
  milestones = [],
}: AnimatedProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const defaultGradient = [COLORS.beigeWarm, COLORS.goldDark];
  const fillColors = gradientColors || (color ? [color, color] : defaultGradient);

  const animatedWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.spring(animatedWidth, {
        toValue: clampedProgress,
        useNativeDriver: false,
        friction: 8,
        tension: 40,
      }).start();

      if (clampedProgress >= 100) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }

      if (showGlow && clampedProgress > 0) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress, animated, showGlow, animatedWidth, pulseAnim, glowAnim]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      {(label || showPercentage || eta) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          <View style={styles.headerRight}>
            {showPercentage && (
              <Text style={styles.percentage}>{clampedProgress.toFixed(0)}%</Text>
            )}
          </View>
        </View>
      )}
      
      <View style={[styles.track, { height, backgroundColor }]}>
        {milestones.map((milestone, index) => (
          <View 
            key={index}
            style={[
              styles.milestone,
              { left: `${milestone}%` },
              milestone <= clampedProgress && styles.milestoneReached
            ]}
          />
        ))}
        
        <Animated.View style={[styles.fillContainer, { width: widthInterpolation, height }]}>
          <LinearGradient
            colors={fillColors as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { height }]}
          />
          {showGlow && Platform.OS !== 'web' && (
            <Animated.View 
              style={[
                styles.glow,
                { 
                  opacity: glowOpacity,
                  backgroundColor: fillColors[0],
                }
              ]}
            />
          )}
        </Animated.View>
      </View>
      
      {eta && (
        <View style={styles.etaContainer}>
          <Text style={styles.eta}>{eta}</Text>
        </View>
      )}
      
      {(value || sublabel) && (
        <View style={styles.footer}>
          {value && <Text style={styles.value}>{value}</Text>}
          {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
        </View>
      )}
    </Animated.View>
  );
}

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
    flex: 1,
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
  track: {
    width: '100%',
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
    position: 'relative',
  },
  fillContainer: {
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    borderRadius: BORDER_RADIUS.round,
  },
  glow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
    borderRadius: BORDER_RADIUS.round,
  },
  milestone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1,
  },
  milestoneReached: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  etaContainer: {
    marginTop: SPACING.xs,
    alignItems: 'flex-end',
  },
  eta: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
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
