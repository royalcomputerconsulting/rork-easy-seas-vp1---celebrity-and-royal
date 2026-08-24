import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Ship, Waves } from 'lucide-react-native';
import { buildCruiseDayPlan } from '@/lib/cruiseDayPipeline';
import { createDateFromString } from '@/lib/date';
import { SailingWeatherCard } from '@/components/SailingWeatherCard';
import { OfficialVoyageAlerts } from '@/components/OfficialVoyageAlerts';
import { useSailingWeather, type SailingWeatherCruiseInput } from '@/state/SailingWeatherProvider';

export function VoyageWeatherSection({ cruise }: { cruise: SailingWeatherCruiseInput }) {
  const queryClient = useQueryClient();
  const { prefetchCruiseForecastWindow } = useSailingWeather();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [officialAlertRefreshToken, setOfficialAlertRefreshToken] = useState(0);
  const plan = useMemo(() => buildCruiseDayPlan(cruise), [cruise]);

  const syncWeather = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage('');
    try {
      const report = await prefetchCruiseForecastWindow(cruise, { force: true });
      await queryClient.invalidateQueries({ queryKey: ['sailing-weather', cruise.id] });
      setOfficialAlertRefreshToken((value) => value + 1);
      const unavailable = report.unavailableDates.length;
      setSyncMessage(unavailable
        ? `${report.refreshedDates.length}/${report.voyageDates.length} voyage days refreshed. Remaining provider forecasts publish around ${report.forecastAvailableFrom ?? 'the provider forecast window'}.`
        : `${report.refreshedDates.length}/${report.voyageDates.length} voyage days refreshed and saved for offline use.`);
    } finally {
      setSyncing(false);
    }
  }, [cruise, prefetchCruiseForecastWindow, queryClient, syncing]);

  if (!plan) return null;
  const start = createDateFromString(plan.sailDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const end = createDateFromString(plan.returnDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return <View style={styles.root} testID={`voyage-weather-${cruise.id}`}>
    <View style={styles.header}>
      <View style={styles.headerIcon}><Ship size={19} color="#063b55" /></View>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>CURRENT OR NEXT AVAILABLE SAILING</Text><Text style={styles.title}>{cruise.shipName}</Text><Text style={styles.dates}>{start}–{end}</Text></View>
    </View>
    <TouchableOpacity style={styles.syncButton} onPress={() => void syncWeather()} disabled={syncing} testID={`sync-voyage-weather-${cruise.id}`}>
      {syncing ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={17} color="#fff" />}
      <Text style={styles.syncText}>{syncing ? 'Syncing every voyage day…' : 'Sync Weather for Entire Sailing'}</Text>
    </TouchableOpacity>
    {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
    <OfficialVoyageAlerts cruise={cruise} refreshToken={officialAlertRefreshToken} />
    <View style={styles.days}>
      {plan.days.map((day) => <View key={`${cruise.id}-${day.date}`} style={styles.day} testID={`voyage-weather-day-${day.day}`}>
        <View style={styles.dayHeading}><View style={styles.dayBadge}><Text style={styles.dayBadgeText}>DAY {day.day}</Text></View><View style={styles.dayCopy}><Text style={styles.dayDate}>{createDateFromString(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={styles.dayLocation}>{day.isSeaDay ? `AT SEA${day.port ? ` · ${day.port}` : ''}` : day.port || (day.day === 1 ? cruise.departurePort || 'Embarkation port pending' : 'Itinerary location pending')}</Text></View>{day.isSeaDay ? <Waves size={18} color="#0e7490" /> : null}</View>
        <SailingWeatherCard cruise={cruise} selectedDate={createDateFromString(day.date)} />
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 12 }, header: { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: '#b9d9df' }, headerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d9f2f1', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1 }, eyebrow: { color: '#08766d', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { color: '#092b43', fontSize: 19, fontWeight: '900', marginTop: 2 }, dates: { color: '#506a78', fontSize: 12, fontWeight: '700', marginTop: 2 }, syncButton: { backgroundColor: '#08766d', padding: 14, borderRadius: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, syncText: { color: '#fff', fontWeight: '900', fontSize: 14 }, syncMessage: { color: '#385563', fontSize: 11, lineHeight: 16, paddingHorizontal: 4 }, days: { gap: 14 }, day: { gap: 7 }, dayHeading: { backgroundColor: '#eff9f8', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#cde4e5' }, dayBadge: { backgroundColor: '#0e7490', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, dayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' }, dayCopy: { flex: 1 }, dayDate: { color: '#102f45', fontSize: 14, fontWeight: '900' }, dayLocation: { color: '#4e6572', fontSize: 11, fontWeight: '700', marginTop: 2 },
});
