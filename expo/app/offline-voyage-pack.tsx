import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, CloudDownload, TriangleAlert } from 'lucide-react-native';

import { DARK_ROYAL_COLORS as C } from '@/constants/darkRoyalTheme';
import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import { buildOfflineVoyagePackStatus } from '@/lib/offlineVoyagePack';
import { useAuth } from '@/state/AuthProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useDeckPlan } from '@/state/DeckPlanProvider';
import { useSailingWeather } from '@/state/SailingWeatherProvider';

type Manifest = { cruiseId: string; lastRequestedAt: string; lastCompletedAt?: string; completionPercent: number };

function formatAvailabilityDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default function OfflineVoyagePackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cruiseId?: string }>();
  const { bookedCruises, calendarEvents, refreshData } = useCoreData();
  const weather = useSailingWeather();
  const certs = useCertificates();
  const deck = useDeckPlan();
  const { authenticatedEmail } = useAuth();
  const [running, setRunning] = useState(false);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  const cruise = bookedCruises.find((row) => row.id === params.cruiseId)
    ?? bookedCruises.filter((row) => row.returnDate >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.sailDate.localeCompare(b.sailDate))[0];
  const key = useMemo(() => getUserScopedKey(ALL_STORAGE_KEYS.OFFLINE_VOYAGE_PACKS, authenticatedEmail), [authenticatedEmail]);
  const status = useMemo(() => cruise ? buildOfflineVoyagePackStatus({
    cruise,
    forecasts: weather.cachedForecasts,
    certificateCount: certs.searchableCertificates.length,
    certificateDocumentCount: certs.certificateDocuments.length,
    deckMappingCount: deck.getMappingsByShip(cruise.shipName).length,
    calendarEvents,
  }) : null, [calendarEvents, certs.certificateDocuments.length, certs.searchableCertificates.length, cruise, deck, weather.cachedForecasts]);

  useEffect(() => {
    if (!cruise) return;
    void quotaSafeGetJsonItem<Manifest[]>(key, [], Array.isArray)
      .then((rows) => setManifest(rows.find((row) => row.cruiseId === cruise.id) ?? null));
  }, [cruise, key]);

  const preload = useCallback(async () => {
    if (!cruise || !status || running) return;
    setRunning(true);
    try {
      await refreshData();
      const [weatherReport] = await Promise.all([
        weather.prefetchCruiseForecastWindow(cruise, { force: true }),
        certs.refreshCertificateDocuments({ force: true }),
        deck.refreshData(),
      ]);
      const now = new Date().toISOString();
      const record: Manifest = { cruiseId: cruise.id, lastRequestedAt: now, lastCompletedAt: now, completionPercent: status.completionPercent };
      const rows = await quotaSafeGetJsonItem<Manifest[]>(key, [], Array.isArray);
      await quotaSafeSetJsonItem(key, [record, ...rows.filter((row) => row.cruiseId !== cruise.id)].slice(0, 50));
      setManifest(record);

      const availableFrom = formatAvailabilityDate(weatherReport.forecastAvailableFrom);
      const itineraryMissing = !Array.isArray(cruise.itinerary) || cruise.itinerary.length === 0;
      const details = [
        weatherReport.refreshedDates.length > 0
          ? `${weatherReport.refreshedDates.length} weather day${weatherReport.refreshedDates.length === 1 ? '' : 's'} refreshed and saved.`
          : availableFrom
            ? `The live provider has not published this voyage yet. Automatic preload begins around ${availableFrom}.`
            : 'No weather day could be refreshed. Check the itinerary locations and internet connection.',
        itineraryMissing
          ? 'This booking still has no day-by-day itinerary. Run the cruise-line sync again to import its verified ports; Easy Seas will not invent them.'
          : 'The saved itinerary was retained.',
      ];
      Alert.alert('Offline voyage refresh finished', details.join('\n\n'));
    } catch (error) {
      Alert.alert('Preload incomplete', error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  }, [certs, cruise, deck, key, refreshData, running, status, weather]);

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><ArrowLeft size={20} color={C.gold} /></TouchableOpacity>
          <View><Text style={s.title}>Offline Voyage Pack</Text><Text style={s.sub}>One local pack for the full sailing</Text></View>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          {!cruise || !status ? <View style={s.card}><Text style={s.muted}>No upcoming cruise is available.</Text></View> : <>
            <View style={s.hero}>
              <Text style={s.ship}>{cruise.shipName}</Text>
              <Text style={s.date}>{cruise.sailDate} → {cruise.returnDate}</Text>
              <Text style={s.percent}>{status.completionPercent}% ready offline</Text>
              <View style={s.track}><View style={[s.fill, { width: `${status.completionPercent}%` }]} /></View>
              <Text style={s.muted}>{manifest?.lastCompletedAt ? `Last preload: ${new Date(manifest.lastCompletedAt).toLocaleString()}` : 'This cruise has not been explicitly preloaded yet.'}</Text>
            </View>
            {status.sections.map((section) => <View key={section.key} style={s.card} testID={`offline-pack-${section.key}`}>
              <View style={s.row}>
                {section.ready ? <CheckCircle2 size={18} color="#34D399" /> : <TriangleAlert size={18} color="#FBBF24" />}
                <View style={s.copy}>
                  <Text style={s.label}>{section.label}</Text>
                  <Text style={s.detail}>{section.detail}</Text>
                  {section.missing.length ? <Text style={s.missing}>Missing: {section.missing.slice(0, 5).join(', ')}{section.missing.length > 5 ? ` +${section.missing.length - 5} more` : ''}</Text> : null}
                </View>
              </View>
            </View>)}
            <TouchableOpacity onPress={() => void preload()} disabled={running} style={s.button} testID="offline-voyage-pack-preload">
              {running ? <ActivityIndicator color={C.deepNavy} /> : <CloudDownload size={19} color={C.deepNavy} />}
              <Text style={s.buttonText}>{running ? 'Refreshing voyage…' : 'Preload / Refresh Entire Voyage'}</Text>
            </TouchableOpacity>
            <Text style={s.disclaimer}>Weather is fetched only when the provider publishes the requested dates. Easy Seas automatically retries online and retains successful forecasts for offline use; it never substitutes invented weather or itinerary ports.</Text>
          </>}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.deepNavy }, safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: C.textPrimary, fontSize: 18, fontWeight: '900' }, sub: { color: C.mutedText, fontSize: 11 },
  content: { padding: 16, paddingBottom: 70 },
  hero: { backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 16, padding: 16, marginBottom: 12 },
  ship: { color: C.textPrimary, fontSize: 21, fontWeight: '900' }, date: { color: C.mutedText, fontSize: 11, marginTop: 3 },
  percent: { color: C.gold, fontSize: 20, fontWeight: '900', marginTop: 12 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,.12)', marginVertical: 8 }, fill: { height: 8, borderRadius: 4, backgroundColor: C.gold },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 9 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, copy: { flex: 1 }, label: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },
  detail: { color: C.mutedText, fontSize: 11, marginTop: 3 }, missing: { color: '#FDE68A', fontSize: 10, marginTop: 4 }, muted: { color: C.mutedText, fontSize: 11, lineHeight: 16 },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, borderRadius: 14, padding: 15, marginTop: 5 },
  buttonText: { color: C.deepNavy, fontWeight: '900' }, disclaimer: { color: C.mutedText, fontSize: 10, lineHeight: 15, marginTop: 10 },
});
