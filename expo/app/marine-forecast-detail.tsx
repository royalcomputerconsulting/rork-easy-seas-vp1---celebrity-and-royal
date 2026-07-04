import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  CloudSun,
  Wind,
  Waves,
  Droplets,
  MapPin,
  AlertTriangle,
  Ship,
  Compass,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useSailingWeather, type SailingWeatherForecast } from '@/state/SailingWeatherProvider';
import { parseMarineForecastDetailParams } from '@/lib/navigation/marineForecastDetail';

function parseDateKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatFullDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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

function getAdvisoryMeta(severity: 'info' | 'watch' | 'warning'): { accent: string; backgroundColor: string; borderColor: string } {
  if (severity === 'warning') {
    return { accent: '#FCA5A5', backgroundColor: 'rgba(239, 68, 68, 0.16)', borderColor: 'rgba(252, 165, 165, 0.32)' };
  }
  if (severity === 'watch') {
    return { accent: '#FCD34D', backgroundColor: 'rgba(245, 158, 11, 0.16)', borderColor: 'rgba(252, 211, 77, 0.30)' };
  }
  return { accent: '#93C5FD', backgroundColor: 'rgba(59, 130, 246, 0.14)', borderColor: 'rgba(147, 197, 253, 0.28)' };
}

export default function MarineForecastDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const { isHydrated, getForecastForCruiseDay } = useSailingWeather();

  const cruise = useMemo(() => parseMarineForecastDetailParams(params), [params]);
  const dateKey = typeof params.dateKey === 'string' ? params.dateKey : '';
  const targetDate = useMemo(() => (dateKey ? parseDateKey(dateKey) : null), [dateKey]);

  const forecastQuery = useQuery({
    queryKey: ['marine-forecast-detail', cruise?.id, dateKey],
    queryFn: async (): Promise<SailingWeatherForecast | null> => {
      if (!cruise || !targetDate) return null;
      return getForecastForCruiseDay(cruise, targetDate);
    },
    enabled: isHydrated && !!cruise && !!targetDate,
    staleTime: 1000 * 60 * 20,
  });

  const forecast = forecastQuery.data ?? null;
  const isLoading = forecastQuery.isLoading || !isHydrated;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#050B18', '#0B2547', '#0A4E63']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ResponsiveContainer>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7} testID="marine-forecast-back">
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <CloudSun size={18} color="#8BE0FF" />
              <Text style={styles.headerTitle}>Marine Forecast</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </ResponsiveContainer>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            {!cruise || !targetDate ? (
              <View style={styles.emptyState} testID="marine-forecast-detail-error">
                <AlertTriangle size={28} color="#FCD34D" />
                <Text style={styles.emptyTitle}>Forecast details unavailable</Text>
                <Text style={styles.emptyText}>This forecast card couldn&apos;t find its cruise day details. Go back and try again.</Text>
              </View>
            ) : isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color="#8BE0FF" size="large" />
                <Text style={styles.loadingText}>Pulling the full marine forecast…</Text>
              </View>
            ) : !forecast ? (
              <View style={styles.emptyState} testID="marine-forecast-detail-unavailable">
                <CloudSun size={28} color="#8BE0FF" />
                <Text style={styles.emptyTitle}>Forecast needs a connection first</Text>
                <Text style={styles.emptyText}>
                  Once the app can resolve this sailing day&apos;s location online, the forecast will save locally for offline use.
                </Text>
              </View>
            ) : (
              <View style={styles.content}>
                <View style={styles.titleBlock}>
                  <View style={styles.shipRow}>
                    <Ship size={14} color="#8BE0FF" />
                    <Text style={styles.shipLabel}>{cruise.shipName}</Text>
                  </View>
                  <Text style={styles.dateLabel}>{formatFullDate(forecast.dateKey)}</Text>
                  <Text style={styles.headline}>{forecast.headline}</Text>
                  <Text style={styles.summary}>{forecast.summary}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={13} color="#D9F3FF" />
                    <Text style={styles.locationText}>{forecast.zoneLabel}</Text>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Temp</Text>
                    <Text style={styles.metricValue}>
                      {forecast.metrics.lowTempF !== null && forecast.metrics.highTempF !== null
                        ? `${Math.round(forecast.metrics.lowTempF)}°–${Math.round(forecast.metrics.highTempF)}°`
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <View style={styles.metricHeaderInline}>
                      <Wind size={13} color="#B4EBFF" />
                      <Text style={styles.metricLabel}>Wind</Text>
                    </View>
                    <Text style={styles.metricValue}>{formatMetricValue(forecast.metrics.maxWindMph, ' mph')}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <View style={styles.metricHeaderInline}>
                      <Waves size={13} color="#B4EBFF" />
                      <Text style={styles.metricLabel}>Seas</Text>
                    </View>
                    <Text style={styles.metricValue}>{formatMetricValue(forecast.metrics.maxWaveHeightFt, ' ft', 1)}</Text>
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipLabel}>Gusts</Text>
                    <Text style={styles.detailChipValue}>{formatMetricValue(forecast.metrics.maxWindGustMph, ' mph')}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipLabel}>Swell</Text>
                    <Text style={styles.detailChipValue}>{formatMetricValue(forecast.metrics.maxSwellHeightFt, ' ft', 1)}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <View style={styles.detailChipHeaderInline}>
                      <Compass size={11} color="#B4EBFF" />
                      <Text style={styles.detailChipLabel}>Wind Dir</Text>
                    </View>
                    <Text style={styles.detailChipValue}>{formatDirectionLabel(forecast.metrics.dominantWindDirectionDegrees)}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <View style={styles.detailChipHeaderInline}>
                      <Droplets size={11} color="#B4EBFF" />
                      <Text style={styles.detailChipLabel}>Rain Risk</Text>
                    </View>
                    <Text style={styles.detailChipValue}>{formatMetricValue(forecast.metrics.precipitationChance, '%')}</Text>
                  </View>
                </View>

                {forecast.advisories.length > 0 ? (
                  <View style={styles.advisoriesSection} testID="marine-forecast-detail-advisories">
                    <Text style={styles.sectionTitle}>Marine watchouts</Text>
                    {forecast.advisories.map((advisory) => {
                      const advisoryMeta = getAdvisoryMeta(advisory.severity);
                      return (
                        <View
                          key={advisory.id}
                          style={[styles.advisoryCard, { backgroundColor: advisoryMeta.backgroundColor, borderColor: advisoryMeta.borderColor }]}
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

                <View style={styles.hourlySection}>
                  <Text style={styles.sectionTitle}>Hourly outlook</Text>
                  {forecast.hourly.length === 0 ? (
                    <Text style={styles.emptyHourlyText}>Hourly detail isn&apos;t available for this day yet.</Text>
                  ) : (
                    forecast.hourly
                      .filter((_, index) => index % 3 === 0)
                      .map((point) => (
                        <View key={point.isoTime} style={styles.hourlyRow}>
                          <Text style={styles.hourlyLabel}>{point.label}</Text>
                          <Text style={styles.hourlyValue}>
                            {point.temperatureF !== null ? `${Math.round(point.temperatureF)}°` : '—'}
                          </Text>
                          <Text style={styles.hourlyValue}>{formatMetricValue(point.windMph, ' mph')}</Text>
                          <Text style={styles.hourlyValue}>{formatMetricValue(point.waveHeightFt, ' ft', 1)}</Text>
                          <Text style={styles.hourlyValue}>{formatMetricValue(point.precipitationProbability, '%')}</Text>
                        </View>
                      ))
                  )}
                </View>

                <Text style={styles.footerText}>
                  Source: {forecast.source === 'live' ? 'Live' : forecast.source === 'cache-stale' ? 'Offline saved' : 'Cached'} · Updated{' '}
                  {new Date(forecast.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ·{' '}
                  {forecast.timezone}
                </Text>
              </View>
            )}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navyDeep,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  loadingText: {
    color: 'rgba(231, 248, 255, 0.82)',
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(231, 248, 255, 0.76)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    gap: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  titleBlock: {
    gap: 6,
  },
  shipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shipLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#BDEBFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  headline: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  summary: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(231, 248, 255, 0.82)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
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
  detailChipHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#E7F8FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  advisoriesSection: {
    gap: SPACING.sm,
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
  hourlySection: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.md,
  },
  emptyHourlyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(231, 248, 255, 0.7)',
  },
  hourlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  hourlyLabel: {
    flex: 1.2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#D9F3FF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  hourlyValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.85)',
  },
  footerText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(231, 248, 255, 0.6)',
    textAlign: 'center',
  },
});
