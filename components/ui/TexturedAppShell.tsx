import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_TEXTURE } from '@/constants/theme';

interface TexturedAppShellProps {
  children: React.ReactNode;
  testID?: string;
}

const TEXTURE_VEINS = [
  { top: 82, left: -26, width: 220, rotate: '-18deg', opacity: 0.14 },
  { top: 214, right: -40, width: 250, rotate: '12deg', opacity: 0.12 },
  { bottom: 188, left: 18, width: 210, rotate: '-8deg', opacity: 0.12 },
  { bottom: 72, right: 24, width: 190, rotate: '20deg', opacity: 0.1 },
] as const;

export function TexturedAppShell({ children, testID = 'textured-app-shell' }: TexturedAppShellProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.textureLayer} pointerEvents="none">
        <LinearGradient
          colors={[APP_TEXTURE.canvasTop, '#F8F1E7', APP_TEXTURE.canvasMid, APP_TEXTURE.canvasBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[APP_TEXTURE.goldWash, 'rgba(255,255,255,0)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.goldSweep}
        />
        <LinearGradient
          colors={[APP_TEXTURE.tealWash, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.tealSweep}
        />
        <LinearGradient
          colors={[APP_TEXTURE.violetWash, 'rgba(255,255,255,0)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.violetSweep}
        />
        {TEXTURE_VEINS.map((vein, index) => (
          <View
            key={`texture-vein-${index}`}
            style={[
              styles.vein,
              vein,
              { transform: [{ rotate: vein.rotate }], opacity: vein.opacity },
            ]}
          />
        ))}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_TEXTURE.canvasMid,
  },
  textureLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  goldSweep: {
    position: 'absolute',
    top: -96,
    right: -72,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  tealSweep: {
    position: 'absolute',
    bottom: -128,
    left: -64,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  violetSweep: {
    position: 'absolute',
    top: 260,
    right: -48,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  vein: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
});
