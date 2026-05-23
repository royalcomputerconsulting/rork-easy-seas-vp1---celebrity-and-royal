import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CloudSun, Ship, Waves, Wind } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useSailingWeather, type SailingWeatherCruiseInput } from '@/state/SailingWeatherProvider';

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

const EMPTY_ALERTS: MarineAlertItem[] = [];

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

function buildCruiseDatesInWindow(cruise: SailingWeatherCruiseInput, startDate: Date, daysAhead: number): Date[] {
  const windowStart = startOfDay(startDate);
  const windowEnd = startOfDay(addDays(windowStart, Math.max(0, daysAhead)));
  const cruiseStart = startOfDay(new Date(cruise.sailDate));
  const cruiseEnd = startOfDay(new Date(cruise.returnDate));

  if (Number.isNaN(cruiseStart.getTime()) || Number.isNaN(cruiseEnd.getTime()) || cruiseEnd < cruiseStart) {
    return [];
  }

  const effectiveStart = cruiseStart > windowStart ? cruiseStart : windowStart;
  const effectiveEnd = cruiseEnd < windowEnd ? cruiseEnd : windowEnd;
  if (effectiveEnd < effectiveStart) {
    return [];
  }

  const dates: Date[] = [];
  const cursor = new Date(effectiveStart);
  while (cursor <= effectiveEnd) {
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
  title = 'Rough seas / weather alerts',
  description = 'Upcoming marine alerts for your sailing window.',
  testID,
}: MarineAlertsPanelProps) {
  const { isHydrated, getForecastForCruiseDay } = useSailingWeather();
  const normalizedStartDate = useMemo(() => startOfDay(startDate), [startDate]);
  const cruisesSignature = useMemo(
    () => cruises.map((cruise) => `${cruise.id}:${cruise.sailDate}:${cruise.returnDate}`).join('|'),
    [cruises],
  );

  const alertsQuery = useQuery({
    queryKey: ['marine-alerts-panel', cruisesSignature, formatDateKey(normalizedStartDate), daysAhead],
    queryFn: async (): Promise<MarineAlertItem[]> => {
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

      forecastResults.forEach(({ cruise, forecast }) => {
        if (!forecast || forecast.advisories.length === 0) {
          return;
        }

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

      return dedupedAlerts;
    },
    enabled: isHydrated && cruises.length > 0,
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 60 * 6,
    retry: 1,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60 * 30,
  });

  const alerts = alertsQuery.data ?? EMPTY_ALERTS;
  const visibleAlerts = useMemo(() => alerts.slice(0, maxItems), [alerts, maxItems]);
  const strongestSeverity = alerts[0]?.severity ?? null;
  const panelColors = getPanelGradientColors(alerts.length > 0, strongestSeverity);

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
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{alerts.length}</Text>
        </View>
      </View>

      <Text style={styles.description}>{description}</Text>

      {alertsQuery.isLoading ? (
        <View style={styles.emptyState}>
          <CloudSun size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>Scanning the forecast window…</Text>
          <Text style={styles.emptySubtitle}>Checking wind, wave height, and marine advisories for your sailing dates.</Text>
        </View>
      ) : null}

      {!alertsQuery.isLoading && visibleAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ship size={18} color="#CFEFFF" />
          <Text style={styles.emptyTitle}>No rough-seas or bad-weather alerts right now</Text>
          <Text style={styles.emptySubtitle}>
            Forecast looks manageable for the next {Math.max(1, daysAhead + 1)} day{daysAhead === 0 ? '' : 's'} in your sailing window.
          </Text>
        </View>
      ) : null}

      {!alertsQuery.isLoading && visibleAlerts.length > 0 ? (
        <View style={styles.alertsList}>
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
});
