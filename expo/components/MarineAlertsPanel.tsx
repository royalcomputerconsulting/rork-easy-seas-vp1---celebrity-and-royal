import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, CloudSun, Ship, Waves, Wind, X } from 'lucide-react-native';
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
  fullForecast: SailingWeatherForecast;
  cruiseInput: SailingWeatherCruiseInput;
  targetDate: Date;
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
}

const EMPTY_PANEL_DATA: MarinePanelData = { alerts: [], forecasts: [] };

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

function getCruiseEndDate(cruise: Pick<SailingWeatherCruiseInput, 'sailDate' | 'returnDate' | 'nights'>): Date | null {
  const start = startOfDay(new Date(cruise.sailDate));
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const explicitEnd = startOfDay(new Date(cruise.returnDate));
  if (!Number.isNaN(explicitEnd.getTime()) && explicitEnd >= start) {
    return explicitEnd;
  }

  const inferredNights = typeof cruise.nights === 'number' && Number.isFinite(cruise.nights) && cruise.nights >= 0
    ? cruise.nights
    : 0;
  return addDays(start, inferredNights);
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

function buildCruiseDatesInWindow(cruise: SailingWeatherCruiseInput, startDate: Date, daysAhead: number): Date[] {
  const windowStart = startOfDay(startDate);
  const windowEnd = startOfDay(addDays(windowStart, Math.max(0, daysAhead)));
  const cruiseStart = startOfDay(new Date(cruise.sailDate));
  const cruiseEnd = getCruiseEndDate(cruise);

  if (Number.isNaN(cruiseStart.getTime()) || !cruiseEnd || cruiseEnd < cruiseStart) {
    return [];
  }

  if (cruiseEnd < windowStart || cruiseStart > windowEnd) {
    return [];
  }

  const effectiveEnd = cruiseEnd < windowEnd ? cruiseEnd : windowEnd;
  const dates: Date[] = [];
  const effectiveStart = cruiseStart > windowStart ? cruiseStart : windowStart;
  const cursor = new Date(effectiveStart);
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

function buildForecastItem(
  forecast: SailingWeatherForecast,
  anchorDate: Date,
  cruiseInput: SailingWeatherCruiseInput,
  targetDate: Date,
): MarineForecastItem {
  return {
    id: forecast.cacheKey,
    cruiseInput,
    targetDate,
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

function getSourceLabel(source: 'live' | 'cache-fresh' | 'cache-stale' | 'offline-placeholder'): string {
  if (source === 'live') return 'Live';
  if (source === 'cache-stale') return 'Offline saved';
  if (source === 'offline-placeholder') return 'Offline route';
  return 'Cached';
}

export function MarineAlertsPanel({
  cruises,
  startDate = new Date(),
  daysAhead = 10,
  maxItems = 3,
  title = 'Maritime Weather',
  description = 'Weather, wind, wave, and rough-seas outlook for your sailing window.',
  testID,
}: MarineAlertsPanelProps) {
  const { isHydrated, getForecastForCruiseDay } = useSailingWeather();
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedStartDate = useMemo(() => startOfDay(startDate), [startDate]);
  const cruisesSignature = useMemo(
    () => cruises.map((cruise) => `${cruise.id}:${cruise.sailDate}:${cruise.returnDate}`).join('|'),
    [cruises],
  );

  const alertsQuery = useQuery({
    queryKey: ['marine-alerts-panel', cruisesSignature, formatDateKey(normalizedStartDate), daysAhead],
    queryFn: async (): Promise<MarinePanelData> => {
      const requests = cruises.flatMap((cruise) => {
        return buildCruiseDatesInWindow(cruise, normalizedStartDate, daysAhead).map(async (targetDate) => {
          const forecast = await getForecastForCruiseDay(cruise, targetDate);
          return {
            cruise,
            forecast,
          };
        });
      });

      const forecastResults = await Promise.all(requests);
      const nextAlerts: MarineAlertItem[] = [];
      const nextForecasts: MarineForecastItem[] = [];

      forecastResults.forEach(({ cruise, forecast }) => {
        if (!forecast) {
          return;
        }

        nextForecasts.push(buildForecastItem(forecast, normalizedStartDate, cruise, new Date(`${forecast.dateKey}T12:00:00`)));

        forecast.advisories.forEach((advisory) => {
          nextAlerts.push({
            id: `${cruise.id}:${forecast.dateKey}:${advisory.id}`,
            cruiseId: cruise.id,
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
  const [selectedForecast, setSelectedForecast] = useState<SailingWeatherForecast | null>(null);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [detailRefreshError, setDetailRefreshError] = useState<string | null>(null);

  const handleOpenForecastDetail = useCallback(async (forecast: MarineForecastItem) => {
    setSelectedForecast(forecast.fullForecast);
    setIsDetailRefreshing(true);
    setDetailRefreshError(null);

    try {
      const refreshedForecast = await getForecastForCruiseDay(forecast.cruiseInput, forecast.targetDate, { force: true });
      if (refreshedForecast) {
        setSelectedForecast(refreshedForecast);
      } else {
        setDetailRefreshError('No detailed marine forecast is available for this itinerary day yet.');
      }
    } catch (error) {
      setDetailRefreshError('Live refresh failed. Showing the saved/offline forecast for this card.');
    } finally {
      setIsDetailRefreshing(false);
    }
  }, [getForecastForCruiseDay]);

  const visibleAlerts = useMemo(() => alerts.slice(0, maxItems), [alerts, maxItems]);
  const strongestSeverity = alerts[0]?.severity ?? null;
  const panelColors = getPanelGradientColors(alerts.length > 0, strongestSeverity);
  const collapsedStatusLabel = useMemo(() => {
    if (alerts.length > 0) {
      return `${alerts.length} Alert${alerts.length === 1 ? '' : 's'}`;
    }
    if (alertsQuery.isLoading || alertsQuery.isFetching) {
      return 'Scanning';
    }
    if (forecasts.length > 0) {
      return 'Clear';
    }
    return 'Tap';
  }, [alerts.length, alertsQuery.isFetching, alertsQuery.isLoading, forecasts.length]);

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
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setIsExpanded((current) => !current)}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} Maritime Weather`}
        testID={`${testID ?? 'marine-alerts-panel'}-toggle`}
      >
        <View style={styles.headerBadge}>
          {isExpanded ? <ChevronDown size={16} color="#FFD59E" /> : <ChevronRight size={16} color="#FFD59E" />}
          <Text style={styles.headerBadgeText}>Maritime Weather</Text>
        </View>
        <View style={[styles.countPill, alerts.length > 0 ? styles.countPillAlert : null]}>
          {alerts.length > 0 ? <AlertTriangle size={12} color={strongestSeverity === 'warning' ? '#FCA5A5' : '#FCD34D'} /> : null}
          <Text style={[styles.countPillText, alerts.length > 0 ? styles.countPillTextAlert : null]}>
            {isExpanded ? (forecasts.length > 0 ? `${forecasts.length}D • ${collapsedStatusLabel}` : collapsedStatusLabel) : collapsedStatusLabel}
          </Text>
        </View>
      </TouchableOpacity>

      {isExpanded ? <Text style={styles.description}>{description}</Text> : null}

      {isExpanded && title !== 'Maritime Weather' ? <Text style={styles.collapsedSubTitle}>{title}</Text> : null}

      {isExpanded && alertsQuery.isLoading ? (
        <View style={styles.emptyState}>
          <CloudSun size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>Scanning the forecast window…</Text>
          <Text style={styles.emptySubtitle}>Checking wind, wave height, and marine advisories for your sailing dates.</Text>
        </View>
      ) : null}

      {isExpanded && !alertsQuery.isLoading && forecasts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ship size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>Forecast not loaded yet</Text>
          <Text style={styles.emptySubtitle}>
            The forecast window needs a cruise date plus a resolvable departure port or itinerary port before detailed weather can be shown.
          </Text>
        </View>
      ) : null}

      {isExpanded && !alertsQuery.isLoading && forecasts.length > 0 && visibleAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ship size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>No rough-seas or bad-weather alerts right now</Text>
          <Text style={styles.emptySubtitle}>
            Forecast looks manageable across the loaded {forecasts.length}-day sailing outlook below.
          </Text>
        </View>
      ) : null}

      {isExpanded && !alertsQuery.isLoading && forecasts.length > 0 ? (
        <View style={styles.forecastSection}>
          <View style={styles.sectionHeaderRow}>
            <CloudSun size={14} color="#B4EBFF" />
            <Text style={styles.sectionTitle}>Detailed {Math.max(1, daysAhead + 1)}-day forecast</Text>
          </View>
          {forecasts.map((forecast) => {
            const severityMeta = forecast.strongestSeverity ? getSeverityMeta(forecast.strongestSeverity) : null;
            return (
              <TouchableOpacity key={forecast.id} style={styles.forecastCard} testID={`marine-forecast-item-${forecast.cruiseId}-${forecast.dateKey}`} activeOpacity={0.86} onPress={() => void handleOpenForecastDetail(forecast)}>
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
                <Text style={styles.tapHint}>Tap for full marine forecast</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {isExpanded && !alertsQuery.isLoading && visibleAlerts.length > 0 ? (
        <View style={styles.alertsList}>
          <View style={styles.sectionHeaderRow}>
            <AlertTriangle size={14} color="#FFD59E" />
            <Text style={styles.sectionTitle}>Rough-seas watchouts</Text>
          </View>
          {visibleAlerts.map((alert) => {
            const severityMeta = getSeverityMeta(alert.severity);
            return (
              <View
                key={alert.id}
                style={[
                  styles.alertCard,
                  {
                    backgroundColor: severityMeta.backgroundColor,
                    borderColor: severityMeta.borderColor,
                  },
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
              </View>
            );
          })}
        </View>
      ) : null}


      <Modal visible={Boolean(selectedForecast)} animationType="slide" transparent onRequestClose={() => setSelectedForecast(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailHeaderText}>
                <Text style={styles.detailEyebrow}>Full marine forecast</Text>
                <Text style={styles.detailTitle}>{selectedForecast?.shipName ?? 'Sailing weather'}</Text>
                <Text style={styles.detailSubtitle}>{selectedForecast?.dateKey ?? ''} • {selectedForecast?.locationName ?? ''}</Text>
              </View>
              <TouchableOpacity style={styles.detailCloseButton} onPress={() => { setSelectedForecast(null); setDetailRefreshError(null); setIsDetailRefreshing(false); }} accessibilityLabel="Close marine forecast detail">
                <X size={20} color="#EAF7FF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
              {selectedForecast ? (
                <>
                  <View style={styles.detailStatusRow}>
                    <Text style={styles.detailZone}>{selectedForecast.zoneLabel}</Text>
                    <TouchableOpacity
                      style={styles.detailRefreshButton}
                      onPress={() => {
                        const matchingForecast = forecasts.find((candidate) => candidate.fullForecast.cacheKey === selectedForecast.cacheKey || (candidate.cruiseId === selectedForecast.cruiseId && candidate.dateKey === selectedForecast.dateKey));
                        if (matchingForecast) {
                          void handleOpenForecastDetail(matchingForecast);
                        }
                      }}
                      disabled={isDetailRefreshing}
                    >
                      <Text style={styles.detailRefreshText}>{isDetailRefreshing ? 'Refreshing…' : 'Refresh live'}</Text>
                    </TouchableOpacity>
                  </View>
                  {isDetailRefreshing ? <Text style={styles.detailStatusText}>Fetching and saving the full marine forecast for this card…</Text> : null}
                  {detailRefreshError ? <Text style={styles.detailErrorText}>{detailRefreshError}</Text> : null}
                  <Text style={styles.detailSummary}>{selectedForecast.summary}</Text>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Temp</Text><Text style={styles.detailMetricValue}>{formatTempRange(selectedForecast.metrics.lowTempF, selectedForecast.metrics.highTempF)}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Wind</Text><Text style={styles.detailMetricValue}>{formatMetricValue(selectedForecast.metrics.maxWindMph, ' mph')}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Gusts</Text><Text style={styles.detailMetricValue}>{formatMetricValue(selectedForecast.metrics.maxWindGustMph, ' mph')}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Waves</Text><Text style={styles.detailMetricValue}>{formatMetricValue(selectedForecast.metrics.maxWaveHeightFt, ' ft', 1)}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Period</Text><Text style={styles.detailMetricValue}>{formatMetricValue(selectedForecast.metrics.maxWavePeriodSeconds, ' sec', 0)}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Swell</Text><Text style={styles.detailMetricValue}>{formatMetricValue(selectedForecast.metrics.maxSwellHeightFt, ' ft', 1)}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Rain</Text><Text style={styles.detailMetricValue}>{formatMetricValue(selectedForecast.metrics.precipitationChance, '%')}</Text></View>
                    <View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Condition</Text><Text style={styles.detailMetricValue}>{selectedForecast.metrics.conditionLabel}</Text></View>
                  </View>

                  {selectedForecast.advisories.length > 0 ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Alerts and watchouts</Text>
                      {selectedForecast.advisories.map((advisory) => (
                        <View key={advisory.id} style={styles.detailAlertCard}>
                          <Text style={styles.detailAlertTitle}>{advisory.title}</Text>
                          <Text style={styles.detailAlertText}>{advisory.detail}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Hourly marine breakdown</Text>
                    {selectedForecast.hourly.slice(0, 24).map((hour) => (
                      <View key={hour.isoTime} style={styles.hourlyRow}>
                        <Text style={styles.hourlyTime}>{hour.isoTime.slice(11, 16)}</Text>
                        <Text style={styles.hourlyValue}>Wind {formatMetricValue(hour.windMph, ' mph')}</Text>
                        <Text style={styles.hourlyValue}>Gust {formatMetricValue(hour.windGustMph, ' mph')}</Text>
                        <Text style={styles.hourlyValue}>Wave {formatMetricValue(hour.waveHeightFt, ' ft', 1)}</Text>
                        <Text style={styles.hourlyValue}>Rain {formatMetricValue(hour.precipitationProbability, '%')}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.detailSource}>Source: {getSourceLabel(selectedForecast.source)} • Updated {new Date(selectedForecast.updatedAt).toLocaleString()} {selectedForecast.isStale ? '• Cached/offline result' : ''}</Text>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
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
  countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: SPACING.sm,
  },
  countPillAlert: {
    backgroundColor: 'rgba(120, 53, 15, 0.42)',
    borderColor: 'rgba(252, 211, 77, 0.48)',
  },
  countPillText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  countPillTextAlert: {
    color: '#FFE8A3',
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

  tapHint: {
    color: '#B4EBFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.76)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    maxHeight: '86%',
    backgroundColor: '#071B2D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(180,235,255,0.22)',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailHeaderText: { flex: 1 },
  detailEyebrow: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  detailSubtitle: {
    color: '#CFEFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  detailCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScrollContent: { paddingVertical: 16, paddingBottom: 28 },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  detailRefreshButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(180, 235, 255, 0.42)',
    backgroundColor: 'rgba(180, 235, 255, 0.10)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  detailRefreshText: {
    color: '#EAF7FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  detailStatusText: {
    color: '#B4EBFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 6,
  },
  detailErrorText: {
    color: '#FCA5A5',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 6,
  },
  detailZone: { color: '#EAF7FF', fontSize: 14, fontWeight: '800', flex: 1 },
  detailSummary: { color: '#CFEFFF', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailMetric: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  detailMetricLabel: { color: '#9EDCF7', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  detailMetricValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 3 },
  detailSection: { marginTop: 16 },
  detailSectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  detailAlertCard: {
    backgroundColor: 'rgba(255,213,158,0.12)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,213,158,0.24)',
  },
  detailAlertTitle: { color: '#FFD59E', fontSize: 13, fontWeight: '900' },
  detailAlertText: { color: '#FFF4DF', fontSize: 12, lineHeight: 17, marginTop: 4 },
  hourlyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
  },
  hourlyTime: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', width: 46 },
  hourlyValue: { color: '#CFEFFF', fontSize: 12, fontWeight: '700' },
  detailSource: { color: '#8BAFD4', fontSize: 11, fontWeight: '600', marginTop: 16, lineHeight: 16 },

});
