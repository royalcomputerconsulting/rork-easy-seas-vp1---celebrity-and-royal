import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudSun, MapPin, RefreshCw, Ship, Waves, Wind, X } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useSailingWeather, type SailingWeatherCruiseInput, type SailingWeatherForecast } from '@/state/SailingWeatherProvider';

interface MarineAlertsPanelProps {
  cruises: SailingWeatherCruiseInput[];
  startDate?: Date;
  daysAhead?: number;
  maxItems?: number;
  title?: string;
  description?: string;
  testID?: string;
}

type MarineAlertSeverity = 'info' | 'watch' | 'warning';

interface MarineAlertItem {
  id: string;
  cruiseId: string;
  forecastId: string;
  shipName: string;
  dateKey: string;
  severity: MarineAlertSeverity;
  title: string;
  detail: string;
  zoneLabel: string;
  summary: string;
  sourceLabel: string;
  windMph: number | null;
  waveHeightFt: number | null;
}

interface MarineForecastItem {
  id: string;
  cruiseId: string;
  shipName: string;
  dateKey: string;
  dayLabel: string;
  locationName: string;
  zoneLabel: string;
  sourceLabel: string;
  headline: string;
  summary: string;
  conditionLabel: string;
  highTempF: number | null;
  lowTempF: number | null;
  windMph: number | null;
  windGustMph: number | null;
  waveHeightFt: number | null;
  precipitationChance: number | null;
  advisoryCount: number;
  strongestSeverity: MarineAlertSeverity | null;
}

interface MarinePanelData {
  alerts: MarineAlertItem[];
  forecasts: MarineForecastItem[];
  liveCount: number;
  cacheCount: number;
  offlineCount: number;
}

const EMPTY_PANEL_DATA: MarinePanelData = { alerts: [], forecasts: [], liveCount: 0, cacheCount: 0, offlineCount: 0 };

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 * Parses a cruise date string as a LOCAL calendar date. Avoids the off-by-one
 * day bug where `new Date("YYYY-MM-DD")` is parsed as UTC midnight and can
 * shift to the previous day once read back in local time (any timezone west
 * of UTC), which would misalign marine alert windows by a day.
 */
function parseLocalCruiseDate(value: string): Date {
  const dateOnlyMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/);
  if (dateOnlyMatch) {
    return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
  }
  return new Date(value);
}

function buildCruiseDatesInWindow(cruise: SailingWeatherCruiseInput, startDate: Date, daysAhead: number): Date[] {
  const windowStart = startOfDay(startDate);
  const windowEnd = startOfDay(addDays(windowStart, Math.max(0, daysAhead)));
  const cruiseStart = startOfDay(parseLocalCruiseDate(cruise.sailDate));
  const cruiseEnd = startOfDay(parseLocalCruiseDate(cruise.returnDate));

  if (Number.isNaN(cruiseStart.getTime()) || Number.isNaN(cruiseEnd.getTime()) || cruiseEnd < cruiseStart) {
    return [];
  }

  if (cruiseEnd < windowStart || cruiseStart > windowEnd) {
    return [];
  }

  const effectiveEnd = cruiseEnd < windowEnd ? cruiseEnd : windowEnd;
  const dates: Date[] = [];
  const cursor = new Date(windowStart);
  while (cursor <= effectiveEnd && dates.length <= daysAhead) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getSeverityRank(severity: MarineAlertSeverity): number {
  if (severity === 'warning') return 3;
  if (severity === 'watch') return 2;
  return 1;
}

function getSeverityMeta(severity: MarineAlertSeverity): { pillLabel: string; accent: string; backgroundColor: string; borderColor: string } {
  if (severity === 'warning') {
    return {
      pillLabel: 'Warning',
      accent: '#FCA5A5',
      backgroundColor: 'rgba(127, 29, 29, 0.34)',
      borderColor: 'rgba(252, 165, 165, 0.32)',
    };
  }

  if (severity === 'watch') {
    return {
      pillLabel: 'Watch',
      accent: '#FCD34D',
      backgroundColor: 'rgba(120, 53, 15, 0.30)',
      borderColor: 'rgba(252, 211, 77, 0.28)',
    };
  }

  return {
    pillLabel: 'Heads up',
    accent: '#93C5FD',
    backgroundColor: 'rgba(30, 64, 175, 0.24)',
    borderColor: 'rgba(147, 197, 253, 0.24)',
  };
}

function getPanelGradientColors(hasAlerts: boolean, strongestSeverity: MarineAlertSeverity | null): [string, string, string] {
  if (!hasAlerts) {
    return ['rgba(9, 24, 52, 0.96)', 'rgba(14, 54, 103, 0.93)', 'rgba(6, 111, 147, 0.90)'];
  }

  if (strongestSeverity === 'warning') {
    return ['rgba(69, 10, 10, 0.96)', 'rgba(127, 29, 29, 0.94)', 'rgba(153, 27, 27, 0.90)'];
  }

  if (strongestSeverity === 'watch') {
    return ['rgba(68, 32, 6, 0.96)', 'rgba(120, 53, 15, 0.94)', 'rgba(146, 64, 14, 0.90)'];
  }

  return ['rgba(9, 24, 52, 0.96)', 'rgba(14, 54, 103, 0.93)', 'rgba(6, 111, 147, 0.90)'];
}

function formatAlertDate(dateKey: string, anchorDate: Date, isSingleDayWindow: boolean): string {
  const targetDate = parseDateKey(dateKey);
  if (!targetDate) return dateKey;

  const anchorKey = formatDateKey(anchorDate);
  const tomorrowKey = formatDateKey(addDays(anchorDate, 1));
  if (dateKey === anchorKey) return isSingleDayWindow ? 'Selected day' : 'Today';
  if (dateKey === tomorrowKey) return 'Tomorrow';

  return targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatForecastDayLabel(dateKey: string, anchorDate: Date): string {
  const targetDate = parseDateKey(dateKey);
  if (!targetDate) return dateKey;
  const relativeLabel = formatAlertDate(dateKey, anchorDate, false);
  const weekday = targetDate.toLocaleDateString('en-US', { weekday: 'short' });
  return `${relativeLabel} · ${weekday}`;
}

function formatTempRange(low: number | null, high: number | null): string {
  if (low === null && high === null) return '—';
  if (low === null) return `${Math.round(high ?? 0)}° high`;
  if (high === null) return `${Math.round(low)}° low`;
  return `${Math.round(low)}°–${Math.round(high)}°`;
}

function getStrongestSeverity(forecast: SailingWeatherForecast): MarineAlertSeverity | null {
  return forecast.advisories.reduce<MarineAlertSeverity | null>((strongest, advisory) => {
    if (!strongest) return advisory.severity;
    return getSeverityRank(advisory.severity) > getSeverityRank(strongest) ? advisory.severity : strongest;
  }, null);
}

function buildForecastItem(forecast: SailingWeatherForecast, anchorDate: Date): MarineForecastItem {
  return {
    id: forecast.cacheKey,
    cruiseId: forecast.cruiseId,
    shipName: forecast.shipName,
    dateKey: forecast.dateKey,
    dayLabel: formatForecastDayLabel(forecast.dateKey, anchorDate),
    locationName: forecast.locationName,
    zoneLabel: forecast.zoneLabel,
    sourceLabel: getSourceLabel(forecast.source),
    headline: forecast.headline,
    summary: forecast.summary,
    conditionLabel: forecast.metrics.conditionLabel,
    highTempF: forecast.metrics.highTempF,
    lowTempF: forecast.metrics.lowTempF,
    windMph: forecast.metrics.maxWindMph,
    windGustMph: forecast.metrics.maxWindGustMph,
    waveHeightFt: forecast.metrics.maxWaveHeightFt,
    precipitationChance: forecast.metrics.precipitationChance,
    advisoryCount: forecast.advisories.length,
    strongestSeverity: getStrongestSeverity(forecast),
  };
}

function formatMetricValue(value: number | null, suffix: string, decimals = 0): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}${suffix}`;
}

function getSourceLabel(source: 'live' | 'cache-fresh' | 'cache-stale'): string {
  if (source === 'live') return 'Live';
  if (source === 'cache-stale') return 'Offline saved';
  return 'Cached';
}

export function MarineAlertsPanel({
  cruises,
  startDate = new Date(),
  daysAhead = 7,
  maxItems = 3,
  title = 'Rough seas / big-wave alerts',
  description = 'Advance notice of big waves and rough seas before you sail, plus a day-by-day outlook while you\'re on board.',
  testID,
}: MarineAlertsPanelProps) {
  const { isHydrated, getForecastForCruiseDay } = useSailingWeather();
  const normalizedStartDate = useMemo(() => startOfDay(startDate), [startDate]);
  const cruisesSignature = useMemo(
    () => cruises.map((cruise) => `${cruise.id}:${cruise.sailDate}:${cruise.returnDate}`).join('|'),
    [cruises],
  );
  const forceRefreshRef = useRef<boolean>(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(null);

  const alertsQuery = useQuery({
    queryKey: ['marine-alerts-panel', cruisesSignature, formatDateKey(normalizedStartDate), daysAhead],
    queryFn: async (): Promise<MarinePanelData> => {
      const shouldForce = forceRefreshRef.current;
      forceRefreshRef.current = false;
      const requests = cruises.flatMap((cruise) => {
        return buildCruiseDatesInWindow(cruise, normalizedStartDate, daysAhead).map(async (targetDate) => {
          const forecast = await getForecastForCruiseDay(cruise, targetDate, { force: shouldForce });
          return {
            cruise,
            forecast,
          };
        });
      });

      const forecastResults = await Promise.all(requests);
      const nextAlerts: MarineAlertItem[] = [];
      const nextForecasts: MarineForecastItem[] = [];
      let liveCount = 0;
      let cacheCount = 0;
      let offlineCount = 0;

      forecastResults.forEach(({ cruise, forecast }) => {
        if (!forecast) {
          return;
        }

        if (forecast.source === 'live') liveCount += 1;
        else if (forecast.source === 'cache-stale') offlineCount += 1;
        else cacheCount += 1;

        nextForecasts.push(buildForecastItem(forecast, normalizedStartDate));

        forecast.advisories.forEach((advisory) => {
          nextAlerts.push({
            id: `${cruise.id}:${forecast.dateKey}:${advisory.id}`,
            cruiseId: cruise.id,
            forecastId: forecast.cacheKey,
            shipName: cruise.shipName,
            dateKey: forecast.dateKey,
            severity: advisory.severity,
            title: advisory.title,
            detail: advisory.detail,
            zoneLabel: forecast.zoneLabel,
            summary: forecast.summary,
            sourceLabel: getSourceLabel(forecast.source),
            windMph: forecast.metrics.maxWindGustMph ?? forecast.metrics.maxWindMph,
            waveHeightFt: forecast.metrics.maxWaveHeightFt,
          });
        });
      });

      const dedupedAlerts = Array.from(new Map(nextAlerts.map((alert) => [alert.id, alert])).values());
      dedupedAlerts.sort((left, right) => {
        const severityDiff = getSeverityRank(right.severity) - getSeverityRank(left.severity);
        if (severityDiff !== 0) return severityDiff;
        return left.dateKey.localeCompare(right.dateKey);
      });

      const dedupedForecasts = Array.from(new Map(nextForecasts.map((forecast) => [forecast.id, forecast])).values());
      dedupedForecasts.sort((left, right) => left.dateKey.localeCompare(right.dateKey));

      return {
        alerts: dedupedAlerts,
        forecasts: dedupedForecasts,
        liveCount,
        cacheCount,
        offlineCount,
      };
    },
    enabled: isHydrated && cruises.length > 0,
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 60 * 6,
    retry: 1,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60 * 30,
  });

  const panelData = alertsQuery.data ?? EMPTY_PANEL_DATA;
  const alerts = panelData.alerts;
  const forecasts = panelData.forecasts;
  const visibleAlerts = useMemo(() => alerts.slice(0, maxItems), [alerts, maxItems]);
  const strongestSeverity = alerts[0]?.severity ?? null;
  const panelColors = getPanelGradientColors(alerts.length > 0, strongestSeverity);
  const isBackgroundSyncing = alertsQuery.isFetching && !alertsQuery.isLoading && !isSyncingNow;

  const handleSyncNow = useCallback(async () => {
    forceRefreshRef.current = true;
    setIsSyncingNow(true);
    try {
      await alertsQuery.refetch();
    } finally {
      setIsSyncingNow(false);
    }
  }, [alertsQuery]);

  const selectedForecast = useMemo(
    () => forecasts.find((forecast) => forecast.id === selectedForecastId) ?? null,
    [forecasts, selectedForecastId],
  );

  const liveStatusLabel = panelData.offlineCount > 0 && panelData.liveCount === 0
    ? 'Offline · showing saved forecast'
    : panelData.liveCount > 0
      ? `Live · ${panelData.liveCount}/${forecasts.length || panelData.liveCount} day${(forecasts.length || panelData.liveCount) === 1 ? '' : 's'} fresh`
      : forecasts.length > 0
        ? 'Cached'
        : null;

  if (cruises.length === 0) {
    return null;
  }

  return (
    <LinearGradient
      colors={panelColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID={testID ?? 'marine-alerts-panel'}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerBadge}>
          <AlertTriangle size={14} color="#FFD59E" />
          <Text style={styles.headerBadgeText}>{title}</Text>
        </View>
        <View style={styles.headerRightGroup}>
          {liveStatusLabel ? (
            <View style={styles.liveStatusPill} testID="marine-alerts-live-status">
              <View style={[styles.liveStatusDot, { backgroundColor: panelData.liveCount > 0 ? '#4ADE80' : '#FCD34D' }]} />
              <Text style={styles.liveStatusText}>{liveStatusLabel}</Text>
            </View>
          ) : null}
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{forecasts.length > 0 ? `${forecasts.length}D` : alerts.length}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.description}>{description}</Text>

      <View style={styles.syncRow}>
        <Pressable
          style={({ pressed }) => [styles.syncNowButton, pressed ? styles.syncNowButtonPressed : null]}
          onPress={handleSyncNow}
          disabled={isSyncingNow}
          testID="marine-alerts-sync-now"
        >
          {isSyncingNow ? (
            <ActivityIndicator size="small" color="#0B1B33" />
          ) : (
            <RefreshCw size={14} color="#0B1B33" />
          )}
          <Text style={styles.syncNowButtonText}>{isSyncingNow ? 'Syncing forecast…' : 'Sync now'}</Text>
        </Pressable>
        {isBackgroundSyncing ? (
          <View style={styles.backgroundSyncPill} testID="marine-alerts-background-syncing">
            <ActivityIndicator size="small" color="#E8F6FF" />
            <Text style={styles.backgroundSyncText}>Checking for updates…</Text>
          </View>
        ) : null}
      </View>

      {alertsQuery.isLoading ? (
        <View style={styles.emptyState}>
          <CloudSun size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>Scanning the forecast window…</Text>
          <Text style={styles.emptySubtitle}>Checking wind, wave height, and marine advisories for your sailing dates.</Text>
        </View>
      ) : null}

      {!alertsQuery.isLoading && forecasts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ship size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>Forecast not loaded yet</Text>
          <Text style={styles.emptySubtitle}>
            The 10-day sailing window needs a resolvable departure port or itinerary before detailed weather can be shown.
          </Text>
        </View>
      ) : null}

      {!alertsQuery.isLoading && forecasts.length > 0 && visibleAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ship size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>No rough-seas or bad-weather alerts right now</Text>
          <Text style={styles.emptySubtitle}>
            Forecast looks manageable across the loaded {forecasts.length}-day sailing outlook below.
          </Text>
        </View>
      ) : null}

      {!alertsQuery.isLoading && forecasts.length > 0 ? (
        <View style={styles.forecastSection}>
          <View style={styles.sectionHeaderRow}>
            <CloudSun size={14} color="#B4EBFF" />
            <Text style={styles.sectionTitle}>Detailed {Math.max(1, daysAhead + 1)}-day forecast</Text>
            <Text style={styles.tapHint}>Tap for details</Text>
          </View>
          {forecasts.map((forecast) => {
            const severityMeta = forecast.strongestSeverity ? getSeverityMeta(forecast.strongestSeverity) : null;
            return (
              <Pressable
                key={forecast.id}
                style={({ pressed }) => [styles.forecastCard, pressed ? styles.forecastCardPressed : null]}
                onPress={() => setSelectedForecastId(forecast.id)}
                testID={`marine-forecast-item-${forecast.cruiseId}-${forecast.dateKey}`}
              >
                <View style={styles.forecastTopRow}>
                  <View style={styles.forecastTitleWrap}>
                    <Text style={styles.forecastDate}>{forecast.dayLabel}</Text>
                    <Text style={styles.forecastHeadline}>{forecast.headline}</Text>
                  </View>
                  <View style={[styles.forecastSourcePill, severityMeta ? { borderColor: severityMeta.borderColor } : null]}>
                    <Text style={[styles.forecastSourceText, severityMeta ? { color: severityMeta.accent } : null]}>
                      {forecast.advisoryCount > 0 ? `${forecast.advisoryCount} alert${forecast.advisoryCount === 1 ? '' : 's'}` : forecast.sourceLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.forecastLocation} numberOfLines={1}>{forecast.shipName} • {forecast.zoneLabel}</Text>
                <Text style={styles.forecastSummary}>{forecast.summary}</Text>
                <View style={styles.forecastMetricGrid}>
                  <View style={styles.forecastMetricChip}>
                    <Text style={styles.forecastMetricLabel}>Temp</Text>
                    <Text style={styles.forecastMetricValue}>{formatTempRange(forecast.lowTempF, forecast.highTempF)}</Text>
                  </View>
                  <View style={styles.forecastMetricChip}>
                    <Wind size={12} color="#E8F6FF" />
                    <Text style={styles.forecastMetricValue}>{formatMetricValue(forecast.windGustMph ?? forecast.windMph, ' mph')}</Text>
                  </View>
                  <View style={styles.forecastMetricChip}>
                    <Waves size={12} color="#E8F6FF" />
                    <Text style={styles.forecastMetricValue}>{formatMetricValue(forecast.waveHeightFt, ' ft', 1)}</Text>
                  </View>
                  <View style={styles.forecastMetricChip}>
                    <Text style={styles.forecastMetricLabel}>Rain</Text>
                    <Text style={styles.forecastMetricValue}>{formatMetricValue(forecast.precipitationChance, '%')}</Text>
                  </View>
                </View>
                <View style={styles.forecastTapRow}>
                  <MapPin size={11} color="rgba(232, 246, 255, 0.6)" />
                  <Text style={styles.forecastTapText}>View full marine forecast</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!alertsQuery.isLoading && visibleAlerts.length > 0 ? (
        <View style={styles.alertsList}>
          <View style={styles.sectionHeaderRow}>
            <AlertTriangle size={14} color="#FFD59E" />
            <Text style={styles.sectionTitle}>Rough-seas watchouts</Text>
          </View>
          {visibleAlerts.map((alert) => {
            const severityMeta = getSeverityMeta(alert.severity);
            return (
              <Pressable
                key={alert.id}
                onPress={() => setSelectedForecastId(alert.forecastId)}
                style={({ pressed }) => [
                  styles.alertCard,
                  {
                    backgroundColor: severityMeta.backgroundColor,
                    borderColor: severityMeta.borderColor,
                  },
                  pressed ? styles.forecastCardPressed : null,
                ]}
                testID={`marine-alert-item-${alert.cruiseId}-${alert.dateKey}`}
              >
                <View style={styles.alertTopRow}>
                  <View style={styles.alertTitleWrap}>
                    <Text style={styles.alertShip}>{alert.shipName}</Text>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                  </View>
                  <View style={[styles.severityPill, { borderColor: severityMeta.borderColor }]}> 
                    <Text style={[styles.severityPillText, { color: severityMeta.accent }]}>{severityMeta.pillLabel}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{formatAlertDate(alert.dateKey, normalizedStartDate, daysAhead === 0)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{alert.sourceLabel}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText} numberOfLines={1}>{alert.zoneLabel}</Text>
                </View>

                <Text style={styles.alertDetail}>{alert.detail}</Text>

                <View style={styles.metricRow}>
                  <View style={styles.metricChip}>
                    <Wind size={12} color="#E8F6FF" />
                    <Text style={styles.metricChipText}>{formatMetricValue(alert.windMph, ' mph')}</Text>
                  </View>
                  <View style={styles.metricChip}>
                    <Waves size={12} color="#E8F6FF" />
                    <Text style={styles.metricChipText}>{formatMetricValue(alert.waveHeightFt, ' ft', 1)}</Text>
                  </View>
                </View>
                <View style={styles.forecastTapRow}>
                  <MapPin size={11} color="rgba(232, 246, 255, 0.6)" />
                  <Text style={styles.forecastTapText}>Tap for the full marine forecast</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Modal visible={Boolean(selectedForecast)} transparent animationType="slide" onRequestClose={() => setSelectedForecastId(null)}>
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedForecastId(null)} />
          <View style={styles.modalSheet} testID="marine-forecast-detail-modal">
            <LinearGradient colors={['rgba(9, 24, 52, 0.99)', 'rgba(14, 54, 103, 0.98)', 'rgba(6, 111, 147, 0.97)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalGradient}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalHeaderBadge}>
                  <Ship size={13} color="#8BE0FF" />
                  <Text style={styles.modalHeaderBadgeText}>{selectedForecast?.shipName}</Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={() => setSelectedForecastId(null)} testID="marine-forecast-detail-close">
                  <X size={16} color="#E7F8FF" />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.modalDayLabel}>{selectedForecast?.dayLabel}</Text>
                <Text style={styles.modalHeadline}>{selectedForecast?.headline}</Text>
                <View style={styles.modalLocationRow}>
                  <MapPin size={13} color="#D9F3FF" />
                  <Text style={styles.modalLocationText}>{selectedForecast?.zoneLabel}</Text>
                </View>
                <Text style={styles.modalSummary}>{selectedForecast?.summary}</Text>
                <View style={styles.modalMetricGrid}>
                  <View style={styles.modalMetricCard}>
                    <Text style={styles.modalMetricLabel}>Temp Range</Text>
                    <Text style={styles.modalMetricValue}>{formatTempRange(selectedForecast?.lowTempF ?? null, selectedForecast?.highTempF ?? null)}</Text>
                  </View>
                  <View style={styles.modalMetricCard}>
                    <View style={styles.modalMetricHeaderInline}><Wind size={13} color="#B4EBFF" /><Text style={styles.modalMetricLabel}>Wind / Gusts</Text></View>
                    <Text style={styles.modalMetricValue}>{formatMetricValue(selectedForecast?.windMph ?? null, ' mph')} · {formatMetricValue(selectedForecast?.windGustMph ?? null, ' mph')}</Text>
                  </View>
                  <View style={styles.modalMetricCard}>
                    <View style={styles.modalMetricHeaderInline}><Waves size={13} color="#B4EBFF" /><Text style={styles.modalMetricLabel}>Sea / Waves</Text></View>
                    <Text style={styles.modalMetricValue}>{formatMetricValue(selectedForecast?.waveHeightFt ?? null, ' ft', 1)}</Text>
                  </View>
                  <View style={styles.modalMetricCard}>
                    <Text style={styles.modalMetricLabel}>Rain Risk</Text>
                    <Text style={styles.modalMetricValue}>{formatMetricValue(selectedForecast?.precipitationChance ?? null, '%')}</Text>
                  </View>
                </View>
                <View style={styles.modalConditionRow}>
                  <CloudSun size={14} color="#B4EBFF" />
                  <Text style={styles.modalConditionText}>{selectedForecast?.conditionLabel}</Text>
                  <Text style={styles.modalConditionDot}>•</Text>
                  <Text style={styles.modalConditionText}>{selectedForecast?.sourceLabel}</Text>
                </View>
                {selectedForecast && selectedForecast.advisoryCount > 0 ? (
                  <View style={styles.modalAdvisoryNote}>
                    <AlertTriangle size={13} color="#FCD34D" />
                    <Text style={styles.modalAdvisoryNoteText}>{selectedForecast.advisoryCount} marine watchout{selectedForecast.advisoryCount === 1 ? '' : 's'} for this day — see the list below for details.</Text>
                  </View>
                ) : null}
                <Text style={styles.modalFootnote}>This is the live marine forecast (wind, seas, and swell) for this ship's location on this exact day, pulled fresh each time you sync.</Text>
              </ScrollView>
            </LinearGradient>
          </View>
        </SafeAreaView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(163, 223, 255, 0.22)',
    overflow: 'hidden',
    gap: SPACING.sm,
    shadowColor: '#03111F',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadgeText: {
    color: '#FFF3E0',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  liveStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveStatusText: {
    color: '#E8F6FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F6FF',
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
  },
  syncNowButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  syncNowButtonText: {
    color: '#0B1B33',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  backgroundSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backgroundSyncText: {
    color: 'rgba(232, 246, 255, 0.85)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  tapHint: {
    flex: 1,
    textAlign: 'right',
    color: 'rgba(232, 246, 255, 0.56)',
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: SPACING.sm,
  },
  countPillText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  description: {
    color: 'rgba(237, 248, 255, 0.82)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 6,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  emptySubtitle: {
    color: 'rgba(231, 248, 255, 0.76)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  forecastSection: {
    gap: SPACING.sm,
  },
  forecastCard: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(197, 234, 255, 0.14)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 8,
  },
  forecastCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  forecastTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  forecastTapText: {
    color: 'rgba(232, 246, 255, 0.62)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontStyle: 'italic',
  },
  forecastTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  forecastTitleWrap: {
    flex: 1,
    gap: 2,
  },
  forecastDate: {
    color: '#BDEBFF',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  forecastHeadline: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  forecastSourcePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  forecastSourceText: {
    color: '#D8F3FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  forecastLocation: {
    color: 'rgba(218, 242, 255, 0.78)',
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  forecastSummary: {
    color: 'rgba(237, 248, 255, 0.88)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
  },
  forecastMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  forecastMetricChip: {
    minWidth: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  forecastMetricLabel: {
    color: 'rgba(232, 246, 255, 0.68)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  forecastMetricValue: {
    color: '#E8F6FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  alertsList: {
    gap: SPACING.sm,
  },
  alertCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 8,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  alertTitleWrap: {
    flex: 1,
    gap: 2,
  },
  alertShip: {
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  alertTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  severityPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  severityPillText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 6,
  },
  metaText: {
    color: '#D6EEFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    flexShrink: 1,
  },
  metaDot: {
    color: 'rgba(214, 238, 255, 0.56)',
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  alertDetail: {
    color: 'rgba(237, 248, 255, 0.88)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  metricChipText: {
    color: '#E8F6FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 10, 22, 0.55)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  modalHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
  },
  modalHeaderBadgeText: {
    color: '#E7F8FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  modalScrollContent: {
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  modalDayLabel: {
    color: '#BDEBFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  modalHeadline: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  modalLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalLocationText: {
    flex: 1,
    color: '#D9F3FF',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  modalSummary: {
    color: 'rgba(237, 248, 255, 0.88)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  modalMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  modalMetricCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 4,
  },
  modalMetricHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalMetricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalMetricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  modalConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  modalConditionText: {
    color: '#D9F3FF',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  modalConditionDot: {
    color: 'rgba(214, 238, 255, 0.56)',
  },
  modalAdvisoryNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.28)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  modalAdvisoryNoteText: {
    flex: 1,
    color: 'rgba(237, 248, 255, 0.9)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
  },
  modalFootnote: {
    color: 'rgba(232, 246, 255, 0.6)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
    marginTop: SPACING.xs,
  },
});
