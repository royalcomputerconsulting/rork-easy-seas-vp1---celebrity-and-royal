import React, { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { buildVisibleMapTileLayout } from '@/lib/visibleMapTiles';

const MAP_HEIGHT = 176;

export function VisibleItineraryMap({
  latitude,
  longitude,
  title,
  subtitle,
  mapUrl,
  testID,
}: {
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  mapUrl: string;
  testID: string;
}) {
  const [width, setWidth] = useState(320);
  const layout = useMemo(
    () => buildVisibleMapTileLayout(latitude, longitude, width, MAP_HEIGHT),
    [latitude, longitude, width],
  );

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${subtitle}. Open this expected itinerary position in Maps.`}
      onPress={() => void Linking.openURL(mapUrl)}
      onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.map} pointerEvents="none">
        {layout.tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={[styles.tile, { left: tile.left, top: tile.top }]}
            resizeMode="cover"
          />
        ))}
        <View style={styles.shade} />
        <View style={[styles.marker, { left: layout.markerLeft - 18, top: layout.markerTop - 34 }]}>
          <MapPin size={28} color="#FFFFFF" fill="#0E7FA7" />
        </View>
        <View style={styles.mapLabel}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.attribution}><Text style={styles.attributionText}>© OpenStreetMap contributors</Text></View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { height: MAP_HEIGHT, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(167,231,246,0.45)', backgroundColor: '#DCEFF3' },
  pressed: { opacity: 0.82 },
  map: { flex: 1, overflow: 'hidden' },
  tile: { position: 'absolute', width: 256, height: 256 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,24,40,0.16)' },
  marker: { position: 'absolute', width: 36, height: 38, alignItems: 'center', justifyContent: 'center', shadowColor: '#001827', shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  mapLabel: { position: 'absolute', left: 10, top: 10, right: 10, backgroundColor: 'rgba(4,28,45,0.88)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  subtitle: { color: '#D9F3FF', fontSize: 10, lineHeight: 14, marginTop: 2, fontWeight: '700' },
  attribution: { position: 'absolute', right: 5, bottom: 4, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.82)' },
  attributionText: { color: '#244353', fontSize: 8, fontWeight: '700' },
});
