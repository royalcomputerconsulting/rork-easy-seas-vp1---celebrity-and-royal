import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CloudSun, MapPin, Waves, Wind } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useSailingWeather, type SailingWeatherCruiseInput, type SailingWeatherForecast } from '@/state/SailingWeatherProvider';

interface SailingWeatherCardProps {
  cruise: SailingWeatherCruiseInput;
  selectedDate: Date;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatUpdatedTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMetricValue(value: number | null, suffix: string, decimals = 0): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}${suffix}`;
}

function formatDirectionLabel(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((value % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;
  return directions[index] ?? '—';
}

function getSourceMeta(forecast: SailingWeatherForecast | null): { label: string; style: object } {
  if (!forecast) {
    return {
      label: 'Pending',
      style: styles.statusPending,
    };
  }

  if (forecast.source === 'live') {
    return {
      label: 'Live',
      style: styles.statusLive,
    };
  }

  if (forecast.source === 'cache-stale') {
    return {
      label: 'Offline saved',
      style: styles.statusOffline,
    };
  }

  return {
    label: 'Cached',
    style: styles.statusCached,
  };
}

function getAdvisoryMeta(severity: 'info' | 'watch' | 'warning'): { accent: string; backgroundColor: string; borderColor: string } {
  if (severity === 'warning') {
    return {
      accent: '#FCA5A5',
      backgroundColor: 'rgba(239, 68, 68, 0.16)',
      borderColor: 'rgba(252, 165, 165, 0.32)',
    };
  }

  if (severity === 'watch') {
    return {
      accent: '#FCD34D',
      backgroundColor: 'rgba(245, 158, 11, 0.16)',
      borderColor: 'rgba(252, 211, 77, 0.30)',
    };
  }

  return {
    accent: '#93C5FD',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderColor: 'rgba(147, 197, 253, 0.28)',
  };
}


function WeatherMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailModalMetricRow}>
      <Text style={styles.detailModalMetricLabel}>{label}</Text>
      <Text style={styles.detailModalMetricValue}>{value}</Text>
    </View>
  );
}

function SailingWeatherDetailModal({
  visible,
  forecast,
  cruise,
  onClose,
}: {
  visible: boolean;
  forecast: SailingWeatherForecast | null;
  cruise: SailingWeatherCruiseInput;
  onClose: () => void;
}) {
  if (!forecast) return null;

  const strongestAlert = forecast.advisories.find((item) => item.severity === 'warning')
    ?? forecast.advisories.find((item) => item.severity === 'watch')
    ?? forecast.advisories[0]
    ?? null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.detailModalOverlay}>
        <View style={styles.detailModalSheet}>
          <View style={styles.detailModalHeader}>
            <View style={styles.detailModalHeaderText}>
              <Text style={styles.detailModalEyebrow}>Full marine forecast</Text>
              <Text style={styles.detailModalTitle}>{forecast.locationName}</Text>
              <Text style={styles.detailModalSubtitle}>{cruise.shipName} · {forecast.dateKey} · {forecast.zoneLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.detailModalCloseButton} activeOpacity={0.85}>
              <Text style={styles.detailModalCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailModalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailModalSummaryCard}>
              <Text style={styles.detailModalHeadline}>{forecast.headline}</Text>
              <Text style={styles.detailModalSummary}>{forecast.summary}</Text>
              {strongestAlert ? (
                <View style={[styles.detailModalAlert, { borderColor: getAdvisoryMeta(strongestAlert.severity).borderColor, backgroundColor: getAdvisoryMeta(strongestAlert.severity).backgroundColor }]}>
                  <Text style={[styles.detailModalAlertTitle, { color: getAdvisoryMeta(strongestAlert.severity).accent }]}>{strongestAlert.title}</Text>
                  <Text style={styles.detailModalAlertDetail}>{strongestAlert.detail}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.detailModalSection}>
              <Text style={styles.detailModalSectionTitle}>Marine metrics</Text>
              <WeatherMetricRow label="Temp range" value={forecast.metrics.lowTempF !== null && forecast.metrics.highTempF !== null ? `${Math.round(forecast.metrics.lowTempF)}°–${Math.round(forecast.metrics.highTempF)}°F` : '—'} />
              <WeatherMetricRow label="Current / max wind" value={`${formatMetricValue(forecast.metrics.maxWindMph, ' mph')} ${formatDirectionLabel(forecast.metrics.dominantWindDirectionDegrees)}`} />
              <WeatherMetricRow label="Wind gusts" value={formatMetricValue(forecast.metrics.maxWindGustMph, ' mph')} />
              <WeatherMetricRow label="Wave height" value={formatMetricValue(forecast.metrics.maxWaveHeightFt, ' ft', 1)} />
              <WeatherMetricRow label="Wave period" value={formatMetricValue(forecast.metrics.maxWavePeriodSeconds, ' sec', 0)} />
              <WeatherMetricRow label="Wave direction" value={formatDirectionLabel(forecast.metrics.dominantWaveDirectionDegrees)} />
              <WeatherMetricRow label="Swell height" value={formatMetricValue(forecast.metrics.maxSwellHeightFt, ' ft', 1)} />
              <WeatherMetricRow label="Swell direction" value={formatDirectionLabel(forecast.metrics.dominantSwellDirectionDegrees)} />
              <WeatherMetricRow label="Precipitation" value={formatMetricValue(forecast.metrics.precipitationChance, '%')} />
              <WeatherMetricRow label="Condition" value={forecast.metrics.conditionLabel} />
            </View>

            {forecast.advisories.length > 0 ? (
              <View style={styles.detailModalSection}>
                <Text style={styles.detailModalSectionTitle}>Alerts & watchouts</Text>
                {forecast.advisories.map((advisory) => (
                  <View key={advisory.id} style={[styles.detailModalAlert, { borderColor: getAdvisoryMeta(advisory.severity).borderColor, backgroundColor: getAdvisoryMeta(advisory.severity).backgroundColor }]}>
                    <Text style={[styles.detailModalAlertTitle, { color: getAdvisoryMeta(advisory.severity).accent }]}>{advisory.title}</Text>
                    <Text style={styles.detailModalAlertDetail}>{advisory.detail}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.detailModalSection}>
              <Text style={styles.detailModalSectionTitle}>Hourly marine forecast</Text>
              {forecast.hourly.slice(0, 24).map((hour) => (
                <View key={hour.isoTime} style={styles.hourlyRow}>
                  <Text style={styles.hourlyTime}>{hour.label}</Text>
                  <Text style={styles.hourlyValue}>{hour.temperatureF !== null ? `${Math.round(hour.temperatureF)}°` : '—'}</Text>
                  <Text style={styles.hourlyValue}>{formatMetricValue(hour.windMph, ' mph')}</Text>
                  <Text style={styles.hourlyValue}>{formatMetricValue(hour.waveHeightFt, ' ft', 1)}</Text>
                  <Text style={styles.hourlyValue}>{formatMetricValue(hour.precipitationProbability, '%')}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.detailModalFooter}>Source: Open-Meteo weather + marine APIs · Updated {formatUpdatedTime(forecast.updatedAt)} · {forecast.timezone} · Saved offline for this cruise day.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SailingWeatherCard({ cruise, selectedDate }: SailingWeatherCardProps) {
  const { isHydrated, getForecastForCruiseDay } = useSailingWeather();
  const [detailVisible, setDetailVisible] = useState(false);
  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const weatherQuery = useQuery({
    queryKey: ['sailing-weather', cruise.id, dateKey],
    queryFn: async () => getForecastForCruiseDay(cruise, selectedDate),
    enabled: isHydrated,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 12,
    retry: 1,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60 * 60 * 6,
  });

  const forecast = weatherQuery.data ?? null;
  const sourceMeta = getSourceMeta(forecast);
  const primaryAlert = useMemo(() => {
    if (!forecast) return null;
    return forecast.advisories.find((advisory) => advisory.severity !== 'info') ?? forecast.advisories[0] ?? null;
  }, [forecast]);

  if (!forecast && weatherQuery.isLoading) {
    return (
      <LinearGradient
        colors={['rgba(9, 24, 52, 0.98)', 'rgba(16, 63, 117, 0.94)', 'rgba(8, 116, 143, 0.90)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
        testID={`sailing-weather-card-${cruise.id}`}
      >
        <View style={styles.topRow}>
          <View style={styles.headerBadge}>
            <CloudSun size={14} color="#8BE0FF" />
            <Text style={styles.headerBadgeText}>Weather & Sea State</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPending]}>
            <Text style={styles.statusText}>Loading</Text>
          </View>
        </View>
        <Text style={styles.headline}>Pulling the full-day marine forecast…</Text>
        <Text style={styles.summary}>This card caches today’s weather, wind, and wave outlook for offline use.</Text>
      </LinearGradient>
    );
  }

  if (!forecast) {
    return (
      <LinearGradient
        colors={['rgba(9, 24, 52, 0.98)', 'rgba(16, 63, 117, 0.94)', 'rgba(8, 116, 143, 0.90)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
        testID={`sailing-weather-card-${cruise.id}`}
      >
        <View style={styles.topRow}>
          <View style={styles.headerBadge}>
            <CloudSun size={14} color="#8BE0FF" />
            <Text style={styles.headerBadgeText}>Weather & Sea State</Text>
          </View>
          <View style={[styles.statusPill, styles.statusOffline]}>
            <Text style={styles.statusText}>Unavailable</Text>
          </View>
        </View>
        <Text style={styles.headline}>Forecast needs a connection first</Text>
        <Text style={styles.summary}>
          Once the app can resolve this sailing’s location online, it will save the day forecast locally for spotty-at-sea usage.
        </Text>
      </LinearGradient>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setDetailVisible(true)}
        testID={`sailing-weather-card-open-detail-${cruise.id}`}
      >
        <LinearGradient
          colors={['rgba(9, 24, 52, 0.98)', 'rgba(14, 54, 103, 0.95)', 'rgba(6, 111, 147, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
          testID={`sailing-weather-card-${cruise.id}`}
        >
      <View style={styles.topRow}>
        <View style={styles.headerBadge}>
          <CloudSun size={14} color="#8BE0FF" />
          <Text style={styles.headerBadgeText}>Weather & Sea State</Text>
        </View>
        <View style={[styles.statusPill, sourceMeta.style]}>
          <Text style={styles.statusText}>{sourceMeta.label}</Text>
        </View>
      </View>

      <Text style={styles.shipLabel}>{cruise.shipName}</Text>
      <Text style={styles.headline}>{forecast.headline}</Text>
      <Text style={styles.summary}>{forecast.summary}</Text>

      {primaryAlert ? (
        <View
          style={[
            styles.primaryAlertBanner,
            {
              backgroundColor: getAdvisoryMeta(primaryAlert.severity).backgroundColor,
              borderColor: getAdvisoryMeta(primaryAlert.severity).borderColor,
            },
          ]}
          testID={`sailing-weather-primary-alert-${cruise.id}`}
        >
          <View
            style={[
              styles.primaryAlertIconBadge,
              { backgroundColor: `${getAdvisoryMeta(primaryAlert.severity).accent}22` },
            ]}
          >
            <AlertTriangle size={14} color={getAdvisoryMeta(primaryAlert.severity).accent} />
          </View>
          <View style={styles.primaryAlertCopy}>
            <Text style={[styles.primaryAlertTitle, { color: getAdvisoryMeta(primaryAlert.severity).accent }]}>
              {primaryAlert.title}
            </Text>
            <Text style={styles.primaryAlertDetail} numberOfLines={2}>
              {primaryAlert.detail}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.locationRow}>
        <MapPin size={13} color="#D9F3FF" />
        <Text style={styles.locationText}>{forecast.zoneLabel}</Text>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard} testID={`sailing-weather-temp-${cruise.id}`}>
          <Text style={styles.metricLabel}>Temp</Text>
          <Text style={styles.metricValue}>
            {forecast.metrics.lowTempF !== null && forecast.metrics.highTempF !== null
              ? `${Math.round(forecast.metrics.lowTempF)}°–${Math.round(forecast.metrics.highTempF)}°`
              : '—'}
          </Text>
        </View>
        <View style={styles.metricCard} testID={`sailing-weather-wind-${cruise.id}`}>
          <View style={styles.metricHeaderInline}>
            <Wind size={13} color="#B4EBFF" />
            <Text style={styles.metricLabel}>Wind</Text>
          </View>
          <Text style={styles.metricValue}>{formatMetricValue(forecast.metrics.maxWindMph, ' mph')}</Text>
        </View>
        <View style={styles.metricCard} testID={`sailing-weather-wave-${cruise.id}`}>
          <View style={styles.metricHeaderInline}>
            <Waves size={13} color="#B4EBFF" />
            <Text style={styles.metricLabel}>Seas</Text>
          </View>
          <Text style={styles.metricValue}>{formatMetricValue(forecast.metrics.maxWaveHeightFt, ' ft', 1)}</Text>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <View style={styles.detailChip} testID={`sailing-weather-gusts-${cruise.id}`}>
          <Text style={styles.detailChipLabel}>Gusts</Text>
          <Text style={styles.detailChipValue}>{formatMetricValue(forecast.metrics.maxWindGustMph, ' mph')}</Text>
        </View>
        <View style={styles.detailChip} testID={`sailing-weather-swell-${cruise.id}`}>
          <Text style={styles.detailChipLabel}>Swell</Text>
          <Text style={styles.detailChipValue}>{formatMetricValue(forecast.metrics.maxSwellHeightFt, ' ft', 1)}</Text>
        </View>
        <View style={styles.detailChip} testID={`sailing-weather-direction-${cruise.id}`}>
          <Text style={styles.detailChipLabel}>Wind Dir</Text>
          <Text style={styles.detailChipValue}>{formatDirectionLabel(forecast.metrics.dominantWindDirectionDegrees)}</Text>
        </View>
        <View style={styles.detailChip} testID={`sailing-weather-rain-${cruise.id}`}>
          <Text style={styles.detailChipLabel}>Rain Risk</Text>
          <Text style={styles.detailChipValue}>{formatMetricValue(forecast.metrics.precipitationChance, '%')}</Text>
        </View>
      </View>

      <View style={styles.snapshotHeaderRow}>
        <Text style={styles.snapshotSectionTitle}>4 daily snapshots</Text>
        <Text style={styles.snapshotSectionHint}>Morning · Midday · Afternoon · Evening</Text>
      </View>

      <View style={styles.snapshotGrid}>
        {forecast.snapshots.map((snapshot) => (
          <View key={`${snapshot.label}-${snapshot.isoTime || 'empty'}`} style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>{snapshot.label}</Text>
            <Text style={styles.snapshotTemp}>{snapshot.temperatureF !== null ? `${Math.round(snapshot.temperatureF)}°` : '—'}</Text>
            <Text style={styles.snapshotDetail}>{formatMetricValue(snapshot.windMph, ' mph')}</Text>
            <Text style={styles.snapshotDetail}>{formatMetricValue(snapshot.waveHeightFt, ' ft', 1)}</Text>
          </View>
        ))}
      </View>

      {forecast.advisories.length > 0 ? (
        <View style={styles.advisoriesSection} testID={`sailing-weather-advisories-${cruise.id}`}>
          <Text style={styles.advisoriesTitle}>Marine watchouts</Text>
          {forecast.advisories.map((advisory) => {
            const advisoryMeta = getAdvisoryMeta(advisory.severity);
            return (
              <View
                key={advisory.id}
                style={[
                  styles.advisoryCard,
                  {
                    backgroundColor: advisoryMeta.backgroundColor,
                    borderColor: advisoryMeta.borderColor,
                  },
                ]}
              >
                <View style={[styles.advisoryIconBadge, { backgroundColor: `${advisoryMeta.accent}22` }]}>
                  <AlertTriangle size={13} color={advisoryMeta.accent} />
                </View>
                <View style={styles.advisoryTextWrap}>
                  <Text style={[styles.advisoryTitle, { color: advisoryMeta.accent }]}>{advisory.title}</Text>
                  <Text style={styles.advisoryDetail}>{advisory.detail}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Updated {formatUpdatedTime(forecast.updatedAt)} · {forecast.timezone}
        </Text>
        <Text style={styles.footerText}>Updates up to 4x/day</Text>
      </View>
      <Text style={styles.offlineHint}>
        Tap for the full detailed forecast. Saved locally for this sailing day, so you can still read it when service gets patchy offshore.
      </Text>
        </LinearGradient>
      </TouchableOpacity>
      <SailingWeatherDetailModal
        visible={detailVisible}
        forecast={forecast}
        cruise={cruise}
        onClose={() => setDetailVisible(false)}
      />
    </>
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
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
  },
  headerBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#E7F8FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  shipLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  summary: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(231, 248, 255, 0.82)',
  },
  primaryAlertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  primaryAlertIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAlertCopy: {
    flex: 1,
    gap: 3,
  },
  primaryAlertTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  primaryAlertDetail: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    color: 'rgba(231, 248, 255, 0.82)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#D9F3FF',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 4,
  },
  metricHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  detailChip: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  detailChipLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.70)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailChipValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  snapshotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  snapshotSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#E7F8FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  snapshotSectionHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.68)',
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  snapshotCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 3,
  },
  snapshotLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: 'rgba(231, 248, 255, 0.70)',
  },
  snapshotTemp: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  snapshotDetail: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#D9F3FF',
  },
  advisoriesSection: {
    gap: SPACING.sm,
  },
  advisoriesTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#E7F8FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  advisoryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  advisoryIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryTextWrap: {
    flex: 1,
    gap: 4,
  },
  advisoryTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  advisoryDetail: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.80)',
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  footerText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.66)',
  },
  offlineHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    color: 'rgba(231, 248, 255, 0.66)',
  },
  statusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
  },
  statusCached: {
    backgroundColor: 'rgba(59, 130, 246, 0.28)',
  },
  statusOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.28)',
  },
  statusPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },

  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  detailModalSheet: {
    maxHeight: '92%',
    backgroundColor: '#07111F',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.22)',
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: 'rgba(14, 54, 103, 0.96)',
  },
  detailModalHeaderText: {
    flex: 1,
    gap: 4,
  },
  detailModalEyebrow: {
    color: '#BAE6FD',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  detailModalTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  detailModalSubtitle: {
    color: 'rgba(231, 248, 255, 0.82)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 19,
  },
  detailModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  detailModalCloseText: {
    color: COLORS.white,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  detailModalContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  detailModalSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: SPACING.sm,
  },
  detailModalHeadline: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
  },
  detailModalSummary: {
    color: 'rgba(231, 248, 255, 0.84)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  detailModalSection: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: SPACING.sm,
  },
  detailModalSectionTitle: {
    color: '#E7F8FF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBlack,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  detailModalMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailModalMetricLabel: {
    color: 'rgba(231, 248, 255, 0.74)',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  detailModalMetricValue: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'right',
  },
  detailModalAlert: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    gap: 4,
  },
  detailModalAlertTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  detailModalAlertDetail: {
    color: 'rgba(231, 248, 255, 0.82)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
  },
  hourlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  hourlyTime: {
    width: 58,
    color: '#BAE6FD',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  hourlyValue: {
    flex: 1,
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeXS,
    textAlign: 'right',
  },
  detailModalFooter: {
    color: 'rgba(231, 248, 255, 0.62)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    textAlign: 'center',
  },
});
