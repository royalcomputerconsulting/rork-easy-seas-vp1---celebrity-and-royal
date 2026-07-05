import React, { type ReactNode } from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { EasySeasRadius, EasySeasSpacing, withAlpha } from '@/constants/easySeasTheme';

/**
 * A glassmorphism panel meant to sit on top of a photoreal/gradient hero
 * image so text stays readable (per the "important text on images must have
 * a dark/blur/glass layer" rule).
 */
export function GlassOverlayCard({
  children,
  style,
  tint = 'dark',
}: {
  children?: ReactNode;
  style?: ViewStyle;
  tint?: 'dark' | 'light';
}) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webFallback, tint === 'dark' ? styles.webFallbackDark : styles.webFallbackLight, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={tint === 'dark' ? 40 : 60}
        tint={tint === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: tint === 'dark' ? withAlpha('#000000', 0.22) : withAlpha('#FFFFFF', 0.18) },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: EasySeasRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  content: {
    padding: EasySeasSpacing.lg,
  },
  webFallback: {
    borderRadius: EasySeasRadius.card,
    padding: EasySeasSpacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  webFallbackDark: {
    backgroundColor: 'rgba(15, 36, 57, 0.55)',
  },
  webFallbackLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
});
