import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudSun, Crown, Dices, MapPinned, Ship } from 'lucide-react-native';

import { TYPOGRAPHY } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

export type ArtworkKind = 'ship' | 'destination' | 'casino' | 'weather' | 'loyalty';

const LOCAL_ARTWORK = {
  ship: require('../../assets/images/section-themes/booked-voyages-v1.png'),
  destination: require('../../assets/images/section-themes/cruises-discovery-v1.png'),
  casino: require('../../assets/images/section-themes/casino-intelligence-v1.png'),
  weather: require('../../assets/images/section-themes/calendar-agenda-v1.png'),
  loyalty: require('../../assets/images/section-themes/settings-trust-v1.png'),
} as const;

const THEMES: Record<ArtworkKind, { colors: [string, string, string]; Icon: typeof Ship }> = {
  ship: { colors: ['#0F2247', '#123D73', '#0E7FA7'], Icon: Ship },
  destination: { colors: ['#123D73', '#0E7FA7', '#4EC0A5'], Icon: MapPinned },
  casino: { colors: ['#22201E', '#2C1D9A', '#D87924'], Icon: Dices },
  weather: { colors: ['#0F2247', '#3D87BF', '#E6B63D'], Icon: CloudSun },
  loyalty: { colors: ['#0F2247', '#273D9A', '#8A1FD1'], Icon: Crown },
};

interface Props {
  uri?: string;
  ship: string;
  destination?: string;
  height?: number;
  kind?: ArtworkKind;
  testID?: string;
  showCaption?: boolean;
}

/**
 * Story-level artwork only. Remote voyage art is cached on disk; failure falls
 * back to bundled, owned section photography and finally to a neutral gradient.
 * Dense facts belong in readable cards below this component.
 */
export function PremiumVoyageArtwork({ uri, ship, destination, height = 150, kind = 'ship', testID, showCaption = true }: Props) {
  const { width } = useWindowDimensions();
  const { colors, preferences } = useExperience();
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [localFailed, setLocalFailed] = useState(false);
  const theme = THEMES[kind];
  const Icon = theme.Icon;
  const useRemote = Boolean(uri && !remoteFailed);
  const source = useRemote ? { uri } : LOCAL_ARTWORK[kind];
  const responsiveHeight = Math.max(96, Math.min(height, width >= 768 ? height * 1.18 : height));

  useEffect(() => { setRemoteFailed(false); setLocalFailed(false); }, [kind, uri]);

  return <View style={[styles.wrap, { height: responsiveHeight, backgroundColor: colors.surface }]} testID={testID ?? `premium-artwork-${kind}`}>
    {!localFailed ? <Image
      source={source}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      contentPosition="center"
      cachePolicy="memory-disk"
      transition={preferences.reducedMotion ? 0 : 180}
      onError={() => useRemote ? setRemoteFailed(true) : setLocalFailed(true)}
      accessibilityLabel={`${ship} ${kind} artwork${destination ? `, ${destination}` : ''}`}
      accessibilityIgnoresInvertColors
    /> : <LinearGradient colors={theme.colors} style={StyleSheet.absoluteFillObject}>
      <View style={styles.fallback}><Icon size={40} color="#FFFFFF"/><Text style={styles.ship}>{ship}</Text><Text style={styles.dest}>{destination || kind.replace(/^\w/, (letter) => letter.toUpperCase())}</Text></View>
    </LinearGradient>}
    <LinearGradient colors={preferences.theme === 'high-contrast' ? ['rgba(0,0,0,.12)', 'rgba(0,0,0,.96)'] : ['transparent', 'rgba(3,14,28,.82)']} style={StyleSheet.absoluteFillObject}/>
    {showCaption ? <View style={styles.caption}><Text style={styles.captionShip} numberOfLines={2}>{ship}</Text>{destination ? <Text style={styles.captionDest} numberOfLines={2}>{destination}</Text> : null}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#0F2247' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  ship: { color: '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 17, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  dest: { color: '#D6F5EE', fontSize: 12, marginTop: 3, textAlign: 'center' },
  caption: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  captionShip: { color: '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18, fontWeight: '900' },
  captionDest: { color: '#E5F5FA', fontSize: 12, marginTop: 2 },
});
