import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

function getGlassAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return isLiquidGlassAvailable();
  } catch (error) {
    console.log('[GlassSurface] Native glass availability check failed:', error);
    return false;
  }
}

const glassSupported = getGlassAvailable();

export function GlassSurface({ children, style, contentStyle, testID }: GlassSurfaceProps) {
  return (
    <View style={[styles.glassShell, style]} testID={testID ?? 'glass-surface'}>
      {glassSupported ? (
        <GlassView style={styles.absoluteFill} glassEffectStyle="regular" tintColor="rgba(255,255,255,0.18)" />
      ) : Platform.OS !== 'web' ? (
        <BlurView intensity={28} tint="light" style={styles.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={['rgba(255,255,255,0.66)', 'rgba(255,255,255,0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.absoluteFill}
      />
      <View style={styles.glassStroke} pointerEvents="none" />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  glassShell: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#03111F',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  glassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
});
