import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, RefreshCw, Ship, Waves } from 'lucide-react-native';
import { buildCruiseDayPlan } from '@/lib/cruiseDayPipeline';
import { createDateFromString } from '@/lib/date';
import { SailingWeatherCard } from '@/components/SailingWeatherCard';
import { OfficialVoyageAlerts } from '@/components/OfficialVoyageAlerts';
import { useSailingWeather, type SailingWeatherCruiseInput } from '@/state/SailingWeatherProvider';
import { PremiumVoyageArtwork } from '@/components/ui/PremiumVoyageArtwork';
import { OperationStatusCard, type OperationFeedback } from '@/components/ui/OperationStatusCard';

const expandedWeatherSections = new Set<string>();

export function VoyageWeatherSection({ cruise, defaultExpanded = false, selectedDate, compact = false }: { cruise: SailingWeatherCruiseInput; defaultExpanded?: boolean; selectedDate?: Date; compact?: boolean }) {
  const queryClient = useQueryClient();
  const { prefetchCruiseForecastWindow } = useSailingWeather();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [weatherOperation, setWeatherOperation] = useState<OperationFeedback | null>(null);
  const [officialAlertRefreshToken, setOfficialAlertRefreshToken] = useState(0);
  const weatherSectionKey = `${cruise.id || cruise.shipName}:${cruise.sailDate || ''}:${cruise.returnDate || ''}`;
  const [expanded, setExpanded] = useState(() => defaultExpanded || expandedWeatherSections.has(weatherSectionKey));
  const plan = useMemo(() => buildCruiseDayPlan(cruise), [cruise]);
  const selectedDateKey = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : '';
  const compactDayDate = compact && plan
    ? (plan.days.find((day) => day.date === selectedDateKey)?.date ?? plan.days[0]?.date ?? '')
    : '';
  useEffect(() => {
    setExpanded(defaultExpanded || expandedWeatherSections.has(weatherSectionKey));
  }, [defaultExpanded, weatherSectionKey]);
  const setPersistentExpanded = useCallback((nextExpanded: boolean) => {
    if (nextExpanded) expandedWeatherSections.add(weatherSectionKey);
    else expandedWeatherSections.delete(weatherSectionKey);
    setExpanded(nextExpanded);
  }, [weatherSectionKey]);
  const toggleExpanded = useCallback(() => setPersistentExpanded(!expanded), [expanded, setPersistentExpanded]);

  const syncWeather = useCallback(async () => {
    if (syncing) return;
    setPersistentExpanded(true);
    setSyncing(true);
    setSyncMessage('');
    setWeatherOperation({
      id: `weather-${cruise.id}`,
      title: 'Voyage forecast refresh',
      status: 'running',
      message: 'Requesting route-aware forecast and marine data for every itinerary day.',
      current: 0,
      total: plan?.days.length || 1,
      committed: false,
      startedAt: new Date().toISOString(),
    });
    try {
      const report = await prefetchCruiseForecastWindow(cruise, {
        force: true,
        onProgress: (progress) => {
          setWeatherOperation((current) => current ? {
            ...current,
            message: `Processed ${progress.completed}/${progress.total} voyage days · ${progress.dateKey}`,
            current: progress.completed,
            total: progress.total,
          } : current);
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['sailing-weather', cruise.id] });
      setOfficialAlertRefreshToken((value) => value + 1);
      const unavailable = report.unavailableDates.length;
      const processed = report.voyageDates.length - report.failedDates.length;
      const evidenceSummary = `${report.datedForecastDates.length} dated forecast${report.datedForecastDates.length === 1 ? '' : 's'} · ${report.planningDates.length} planning/current-area card${report.planningDates.length === 1 ? '' : 's'}`;
      const message = unavailable
        ? `${processed}/${report.voyageDates.length} voyage days processed and saved for offline use (${evidenceSummary}). Dated provider forecasts for the remaining future dates publish around ${report.forecastAvailableFrom ?? 'the provider forecast window'}.`
        : `${processed}/${report.voyageDates.length} voyage days processed and saved for offline use (${evidenceSummary}).`;
      setSyncMessage(message);
      setWeatherOperation((current) => current ? {
        ...current,
        status: 'success',
        message,
        current: processed,
        total: report.voyageDates.length || current.total,
        committed: processed > 0,
        completedAt: new Date().toISOString(),
      } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Weather providers did not return a usable voyage update.';
      setSyncMessage(`Forecast refresh failed: ${message}`);
      setWeatherOperation((current) => current ? {
        ...current,
        status: 'error',
        message: `${message} Existing saved weather remains available.`,
        committed: false,
        completedAt: new Date().toISOString(),
      } : current);
    } finally {
      setSyncing(false);
      setPersistentExpanded(true);
    }
  }, [cruise, plan?.days.length, prefetchCruiseForecastWindow, queryClient, setPersistentExpanded, syncing]);

  if (!plan) return null;
  const start = createDateFromString(plan.sailDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const end = createDateFromString(plan.returnDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return <View style={styles.root} testID={`voyage-weather-${cruise.id}`}>
    <Pressable
      style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      onPress={toggleExpanded}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? 'Close' : 'Open'} weather for ${cruise.shipName}`}
      accessibilityHint="Shows the daily weather, wind, waves, and official voyage alerts"
      accessibilityState={{ expanded }}
      testID={`toggle-voyage-weather-${cruise.id}`}
    >
      <View style={styles.headerIcon}><Ship size={19} color="#063b55" /></View>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>VOYAGE FORECAST</Text><Text style={styles.title}>{cruise.shipName}</Text><Text style={styles.dates}>{start}–{end} · {plan.days.length}-day voyage</Text><Text style={styles.openHint}>{expanded ? 'Tap to close forecast' : 'Tap to open forecast'}</Text></View>
      {expanded ? <ChevronUp size={22} color="#08766d" /> : <ChevronDown size={22} color="#08766d" />}
      <View pointerEvents="none" style={styles.toggleBadge}><Text style={styles.toggleBadgeText}>{expanded ? 'CLOSE' : 'OPEN'}</Text></View>
    </Pressable>
    {expanded ? <>
    {!compact ? <PremiumVoyageArtwork kind="weather" ship={cruise.shipName} destination={`${start}–${end} · daily wind, waves, and sea state`} height={112} /> : null}
    <TouchableOpacity style={styles.syncButton} onPress={() => void syncWeather()} disabled={syncing} testID={`sync-voyage-weather-${cruise.id}`}>
      {syncing ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={17} color="#fff" />}
      <Text style={styles.syncText}>{syncing ? 'Refreshing…' : 'Refresh forecast'}</Text>
    </TouchableOpacity>
    {weatherOperation ? <OperationStatusCard operation={weatherOperation} onRetry={weatherOperation.status === 'error' ? () => void syncWeather() : undefined} onDismiss={weatherOperation.status !== 'running' ? () => setWeatherOperation(null) : undefined} /> : null}
    {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
    {!compact ? <OfficialVoyageAlerts cruise={cruise} refreshToken={officialAlertRefreshToken} /> : null}
    <View style={styles.days}>
      {plan.days.map((day) => compact && day.date !== compactDayDate ? null : <View key={`${cruise.id}-${day.date}`} style={styles.day} testID={`voyage-weather-day-${day.day}`}>
        <View style={styles.dayHeading}><View style={styles.dayBadge}><Text style={styles.dayBadgeText}>DAY {day.day}</Text></View><View style={styles.dayCopy}><Text style={styles.dayDate}>{createDateFromString(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text><Text style={styles.dayLocation}>{day.isSeaDay ? `AT SEA${day.port ? ` · ${day.port}` : ''}` : day.port || (day.day === 1 ? cruise.departurePort || 'Embarkation port pending' : 'Itinerary location pending')}</Text></View>{day.isSeaDay ? <Waves size={18} color="#0e7490" /> : null}</View>
        <SailingWeatherCard cruise={cruise} selectedDate={createDateFromString(day.date)} />
      </View>)}
    </View>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 10, position: 'relative' }, header: { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 11, paddingRight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#B9DCE3', minHeight: 72, position: 'relative', zIndex: 2 }, headerPressed: { opacity: 0.78, transform: [{ scale: 0.995 }] }, headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F7F5', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1 }, eyebrow: { color: '#08766d', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, title: { color: '#092b43', fontSize: 17, fontWeight: '900', marginTop: 1 }, dates: { color: '#506a78', fontSize: 11, fontWeight: '700', marginTop: 1 }, openHint: { color: '#08766d', fontSize: 11, fontWeight: '800', marginTop: 3 }, toggleBadge: { position: 'absolute', right: 10, bottom: 10, backgroundColor: '#08766d', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }, toggleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }, syncButton: { alignSelf: 'flex-start', minHeight: 40, backgroundColor: '#08766d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }, syncText: { color: '#fff', fontWeight: '900', fontSize: 12 }, syncMessage: { color: '#385563', fontSize: 11, lineHeight: 16, paddingHorizontal: 4 }, days: { gap: 14 }, day: { gap: 7 }, dayHeading: { backgroundColor: '#eff9f8', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#cde4e5' }, dayBadge: { backgroundColor: '#0e7490', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, dayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' }, dayCopy: { flex: 1 }, dayDate: { color: '#102f45', fontSize: 14, fontWeight: '900' }, dayLocation: { color: '#4e6572', fontSize: 11, fontWeight: '700', marginTop: 2 },
});
