import React, { type ReactNode } from 'react';
import { View, StyleSheet, ImageBackground, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { EasySeasRadius } from '@/constants/easySeasTheme';

interface PhotorealHeroCardProps {
  imageUrl?: string | null;
  fallbackGradient?: [string, string, ...string[]];
  height?: number;
  scrimColors?: [string, string, ...string[]];
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * Emotional, photoreal hero section (Dashboard/Next Cruise/Offer/Casino
 * heroes). Always renders a gradient scrim under its children so overlaid
 * text/glass cards stay readable, per the photorealism safety rules.
 */
export function PhotorealHeroCard({
  imageUrl,
  fallbackGradient = ['#0F2439', '#1E3A5F', '#0097A7'],
  height = 220,
  scrimColors = ['rgba(15, 36, 57, 0.15)', 'rgba(15, 36, 57, 0.75)'],
  children,
  style,
}: PhotorealHeroCardProps) {
  const content = (
    <LinearGradient colors={scrimColors} style={[styles.scrim, { height }]}>
      {children}
    </LinearGradient>
  );

  if (imageUrl) {
    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        style={[styles.container, { height }, style]}
        imageStyle={styles.image}
        resizeMode="cover"
      >
        {content}
      </ImageBackground>
    );
  }

  return (
    <LinearGradient
      colors={fallbackGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { height }, style]}
    >
      {content}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: EasySeasRadius.section,
    overflow: 'hidden',
  },
  image: {
    borderRadius: EasySeasRadius.section,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
