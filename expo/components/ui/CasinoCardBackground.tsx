import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CasinoCardBackgroundProps {
  style?: StyleProp<ViewStyle>;
}

export const CasinoCardBackground = React.memo(function CasinoCardBackground({ style }: CasinoCardBackgroundProps) {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <LinearGradient
        colors={['rgba(120, 43, 143, 0.96)', 'rgba(164, 77, 122, 0.92)', 'rgba(210, 156, 39, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.03)', 'rgba(255,240,201,0.18)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.veinOne} />
      <View style={styles.veinTwo} />
      <View style={styles.veinThree} />
      <View style={styles.glowOrb} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  veinOne: {
    position: 'absolute',
    top: -42,
    right: -28,
    width: 228,
    height: 164,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    transform: [{ rotate: '16deg' }],
  },
  veinTwo: {
    position: 'absolute',
    left: -54,
    bottom: 26,
    width: 212,
    height: 96,
    borderRadius: 72,
    backgroundColor: 'rgba(255,244,214,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,244,214,0.16)',
    transform: [{ rotate: '-14deg' }],
  },
  veinThree: {
    position: 'absolute',
    right: 44,
    bottom: -22,
    width: 184,
    height: 84,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '10deg' }],
  },
  glowOrb: {
    position: 'absolute',
    top: -38,
    left: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
