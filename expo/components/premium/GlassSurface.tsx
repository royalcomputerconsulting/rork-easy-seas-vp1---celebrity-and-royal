import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

type GlassBackdropMode = 'liquid' | 'static';

const WEB_SHADOW_FIX = Platform.select<ViewStyle>({
  web: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});

function getBackdropMode(): GlassBackdropMode {
  if (Platform.OS !== 'ios') {
    return 'static';
  }

  try {
    return isLiquidGlassAvailable() ? 'liquid' : 'static';
  } catch (error) {
    console.log('[GlassSurface] Native glass availability check failed:', error);
    return 'static';
  }
}

const backdropMode = getBackdropMode();

const GlassBackdrop = React.memo(function GlassBackdrop({ mode }: { mode: GlassBackdropMode }) {
  return (
    <View pointerEvents="none" style={styles.backdropLayer}>
      {mode === 'liquid' ? (
        <GlassView style={styles.absoluteFill} glassEffectStyle="regular" tintColor="rgba(255,255,255,0.14)" />
      ) : (
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(214,228,244,0.14)', 'rgba(186,206,230,0.10)']}
          locations={[0, 0.52, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['rgba(255,255,255,0.56)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
        locations={[0, 0.3, 1]}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={styles.highlightBand}
      />
      <View style={styles.glowSpot} />
      <View style={styles.glassStroke} />
    </View>
  );
});

export const GlassSurface = React.memo(function GlassSurface({ children, style, contentStyle, testID }: GlassSurfaceProps) {
  return (
    <View style={[styles.glassShell, style]} testID={testID ?? 'glass-surface'}>
      <View style={styles.glassClip}>
        <GlassBackdrop mode={backdropMode} />
        <View style={[styles.contentLayer, contentStyle]}>{children}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  glassShell: {
    borderRadius: 24,
    backgroundColor: 'transparent',
    shadowColor: '#03111F',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
    ...(WEB_SHADOW_FIX ?? {}),
  },
  glassClip: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: 'rgba(244,248,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  contentLayer: {
    zIndex: 1,
  },
  highlightBand: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: '64%',
  },
  glowSpot: {
    position: 'absolute',
    top: -48,
    right: -24,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  glassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});
