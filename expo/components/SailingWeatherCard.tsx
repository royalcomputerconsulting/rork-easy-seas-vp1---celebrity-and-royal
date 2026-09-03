import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudSun, MapPin, RefreshCw, Waves, Wind } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { SAILING_WEATHER_REFRESH_MS, useSailingWeather, type SailingWeatherCruiseInput, type SailingWeatherForecast } from '@/state/SailingWeatherProvider';
import { getCruiseDayForDate, isWithinForecastWindow } from '@/lib/cruiseDayPipeline';
import { createUtcDateFromLocalCalendarDay } from '@/lib/date';
import { getItineraryFingerprint } from '@/lib/itineraryIntegrity';
import { buildOperationalMarineSummary } from '@/lib/marineForecastOperations';
import { EntityProvenanceDisclosure } from '@/components/ui/EntityProvenanceDisclosure';
import { buildWeatherPositionPresentation } from '@/lib/weatherPositionPresentation';
import { VisibleItineraryMap } from '@/components/VisibleItineraryMap';

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

function formatObservationTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'time unavailable';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function getForecastAvailabilityLabel(targetDate: Date, horizonDays = 15): string {
  const availableDate = new Date(targetDate);
  availableDate.setUTCDate(availableDate.getUTCDate() - horizonDays);
  return availableDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function buildPlanningOutlook(cruise: SailingWeatherCruiseInput, targetDate: Date): { location: string; wind: string; seas: string; context: string } {
  const day = getCruiseDayForDate(cruise, targetDate);
  const port = String(day?.port || (day?.day === 1 ? cruise.departurePort : '') || '').trim();
  const normalized = port.toLowerCase();
  const isFloridaAtlantic = /orlando|port canaveral|brevard|coco.?cay|bahamas|nassau/.test(normalized) || /bahamas|perfect day/.test(String(cruise.destination || cruise.itineraryName || '').toLowerCase());
  if (day?.isSeaDay && isFloridaAtlantic) return {
    location: 'AT SEA · Atlantic route toward/near the Bahamas',
    wind: 'Typical September planning range: E–SE trade winds around 10–20 kt; locally higher near squalls.',
    seas: 'Typical planning range: 2–5 ft Atlantic/Bahamas seas; tropical systems can change this substantially.',
    context: 'Route-position numerical wind, wave height, period, swell, and gusts replace this planning range when the dated model window opens.',
  };
  if (/coco.?cay|perfect day|nassau|bahamas/.test(normalized)) return {
    location: port || 'Bahamas port area',
    wind: 'Typical September planning range: E–SE winds around 10–15 kt, with stronger gusts in showers.',
    seas: 'Typical planning range: 2–4 ft in adjacent Atlantic/Bahamas waters.',
    context: 'September is within Atlantic tropical season; the dated forecast may change quickly and supersedes this climatology.',
  };
  if (isFloridaAtlantic || day?.day === 1) return {
    location: /orlando|port canaveral|brevard/.test(normalized) ? 'Port Canaveral · Atlantic waters off Brevard County (Orlando-area embarkation)' : port || cruise.departurePort || 'Embarkation waters',
    wind: 'Typical mid-September pattern: light S–SW morning flow, shifting to an E–SE sea breeze around 5–15 kt.',
    seas: 'Typical planning range: 1–3 ft near the central Florida Atlantic coast, absent a tropical disturbance.',
    context: 'September 10 is near the statistical Atlantic hurricane-season peak. Reliable NWS coastal detail is normally available about 5–7 days ahead.',
  };
  return {
    location: day?.isSeaDay ? 'AT SEA · route position pending verified surrounding ports' : port || 'Itinerary location pending',
    wind: 'A location-specific numerical wind forecast has not been published for this date.',
    seas: 'Wave height is not estimated without a verified port or route position.',
    context: 'Sync the cruise itinerary; Easy Seas will replace this notice when the location and dated provider window are available.',
  };
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

  if (forecast.source === 'historical') {
    return {
      label: 'Historical',
      style: styles.statusCached,
    };
  }

  if (forecast.source === 'planning') {
    if (
      forecast.weatherSourceLabel?.toLowerCase().includes('current area')
      || forecast.nearestBuoyObservation
      || forecast.metrics.maxWindMph !== null
      || forecast.metrics.maxWaveHeightFt !== null
      || forecast.metrics.maxSwellHeightFt !== null
    ) {
      return {
        label: 'Current area',
        style: styles.statusCached,
      };
    }
    return {
      label: 'Planning',
      style: styles.statusPending,
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

export function SailingWeatherCard({ cruise, selectedDate }: SailingWeatherCardProps) {
  const { isHydrated, getForecastForCruiseDay } = useSailingWeather();
  const queryClient = useQueryClient();
  const [manualRefreshBusy, setManualRefreshBusy] = useState(false);
  const [manualRefreshMessage, setManualRefreshMessage] = useState('');
  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const weatherTargetDate = useMemo(() => createUtcDateFromLocalCalendarDay(selectedDate), [selectedDate]);
  const itineraryFingerprint = useMemo(() => getItineraryFingerprint(cruise), [cruise]);

  const weatherQueryKey = useMemo(() => ['sailing-weather', cruise.id, itineraryFingerprint, dateKey] as const, [cruise.id, dateKey, itineraryFingerprint]);
  const weatherQuery = useQuery({
    queryKey: ['sailing-weather', cruise.id, itineraryFingerprint, dateKey],
    queryFn: async () => getForecastForCruiseDay(cruise, weatherTargetDate),
    enabled: isHydrated,
    staleTime: SAILING_WEATHER_REFRESH_MS,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    refetchOnMount: 'always',
    refetchInterval: SAILING_WEATHER_REFRESH_MS,
  });

  const forecast = weatherQuery.data ?? null;
  const forecastWindowAvailable = useMemo(() => isWithinForecastWindow(weatherTargetDate), [weatherTargetDate]);
  const planningOutlook = useMemo(() => buildPlanningOutlook(cruise, weatherTargetDate), [cruise, weatherTargetDate]);
  const hasResolvedCruiseDay = useMemo(() => Boolean(getCruiseDayForDate(cruise, weatherTargetDate)), [cruise, weatherTargetDate]);
  const sourceMeta = getSourceMeta(forecast);
  const operationalMarine = useMemo(() => forecast ? buildOperationalMarineSummary(forecast) : null, [forecast]);
  const primaryAlert = useMemo(() => {
    if (!forecast) return null;
    return forecast.advisories.find((advisory) => advisory.severity !== 'info') ?? forecast.advisories[0] ?? null;
  }, [forecast]);

  const handleManualRefresh = useCallback(async () => {
    if (manualRefreshBusy) return;
    setManualRefreshBusy(true);
    setManualRefreshMessage('');
    try {
      const refreshed = await getForecastForCruiseDay(cruise, weatherTargetDate, { force: true });
      queryClient.setQueryData(weatherQueryKey, refreshed);
      setManualRefreshMessage(refreshed
        ? `Updated ${refreshed.zoneLabel} at ${formatUpdatedTime(refreshed.updatedAt)} and saved it for offline use.`
        : forecastWindowAvailable
          ? 'The location resolved, but neither live forecast provider returned usable data. Confirm that the device is online, then check live weather again.'
          : `A numerical forecast has not been published for this date. Automatic live refresh begins around ${getForecastAvailabilityLabel(weatherTargetDate)}.`);
    } catch (error) {
      setManualRefreshMessage(`Weather refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setManualRefreshBusy(false);
    }
  }, [cruise, forecastWindowAvailable, getForecastForCruiseDay, manualRefreshBusy, queryClient, weatherQueryKey, weatherTargetDate]);

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
            <Text style={styles.headerBadgeText}>Weather & sea state</Text>
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
          <View style={[styles.statusPill, hasResolvedCruiseDay ? styles.statusPending : styles.statusOffline]}>
            <Text style={styles.statusText}>{hasResolvedCruiseDay ? 'Planning' : 'Unavailable'}</Text>
          </View>
        </View>
        <Text style={styles.headline}>
          {hasResolvedCruiseDay
            ? forecastWindowAvailable
              ? 'Provider refresh pending · planning outlook (not live)'
              : 'Forecast not available yet · planning outlook (not live)'
            : 'Cruise-day location unavailable—sync itinerary'}
        </Text>
        <View style={styles.planningLocation}><MapPin size={13} color="#D9F3FF" /><Text style={styles.planningLocationText}>{planningOutlook.location}</Text></View>
        <Text style={styles.planningLine}><Text style={styles.planningLabel}>Wind: </Text>{planningOutlook.wind}</Text>
        <Text style={styles.planningLine}><Text style={styles.planningLabel}>Seas: </Text>{planningOutlook.seas}</Text>
        <Text style={styles.summary}>{planningOutlook.context}</Text>
        {!forecastWindowAvailable ? <Text style={styles.availabilityHint}>Dated model refresh begins around {getForecastAvailabilityLabel(weatherTargetDate)}. Easy Seas then refreshes and caches the numerical forecast every four hours while online.</Text> : null}
        <TouchableOpacity style={styles.refreshButton} onPress={() => void handleManualRefresh()} disabled={manualRefreshBusy} testID={`sailing-weather-refresh-${cruise.id}-${dateKey}`}>
          {manualRefreshBusy ? <ActivityIndicator size="small" color="#071426" /> : <RefreshCw size={15} color="#071426" />}
          <Text style={styles.refreshButtonText}>{manualRefreshBusy ? 'Refreshing weather…' : 'Check live weather again'}</Text>
        </TouchableOpacity>
        {manualRefreshMessage ? <Text style={styles.refreshMessage}>{manualRefreshMessage}</Text> : null}
      </LinearGradient>
    );
  }

  const planningHasCurrentAreaEvidence = forecast.source === 'planning' && (
    forecast.weatherSourceLabel?.toLowerCase().includes('current area')
    || forecast.nearestBuoyObservation
    || forecast.metrics.maxWindMph !== null
    || forecast.metrics.maxWaveHeightFt !== null
    || forecast.metrics.maxSwellHeightFt !== null
  );
  const positionPresentation = buildWeatherPositionPresentation(
    forecast.dateKey,
    forecast.latitude,
    forecast.longitude,
    forecast.zoneLabel,
  );

  if (forecast.source === 'planning' && !planningHasCurrentAreaEvidence) {
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
            <Text style={styles.headerBadgeText}>Weather & sea state</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPending]}><Text style={styles.statusText}>Planning</Text></View>
        </View>
        <Text style={styles.shipLabel}>{cruise.shipName}</Text>
        <Text style={styles.headline}>Planning outlook · not a dated forecast</Text>
        <View style={styles.planningLocation}><MapPin size={13} color="#D9F3FF" /><Text style={styles.planningLocationText}>{planningOutlook.location}</Text></View>
        <VisibleItineraryMap
          latitude={forecast.latitude}
          longitude={forecast.longitude}
          title={positionPresentation.label}
          subtitle={`${forecast.zoneLabel} · ${positionPresentation.coordinatesLabel} · ${positionPresentation.disclaimer}`}
          mapUrl={positionPresentation.mapUrl}
          testID={`sailing-weather-visible-map-${cruise.id}-${dateKey}`}
        />
        <Text style={styles.planningLine}><Text style={styles.planningLabel}>Wind: </Text>{planningOutlook.wind}</Text>
        <Text style={styles.planningLine}><Text style={styles.planningLabel}>Seas: </Text>{planningOutlook.seas}</Text>
        <Text style={styles.summary}>{planningOutlook.context}</Text>
        <Text style={styles.availabilityHint}>Live numerical weather and marine data normally enters the provider window around {getForecastAvailabilityLabel(weatherTargetDate)}. This planning record remains available offline until replaced.</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => void handleManualRefresh()} disabled={manualRefreshBusy} testID={`sailing-weather-refresh-${cruise.id}-${dateKey}`}>
          {manualRefreshBusy ? <ActivityIndicator size="small" color="#071426" /> : <RefreshCw size={15} color="#071426" />}
          <Text style={styles.refreshButtonText}>{manualRefreshBusy ? 'Refreshing weather…' : 'Check for dated forecast'}</Text>
        </TouchableOpacity>
        {manualRefreshMessage ? <Text style={styles.refreshMessage}>{manualRefreshMessage}</Text> : null}
      </LinearGradient>
    );
  }

  return (
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
      <EntityProvenanceDisclosure ownerId={null} entityType="weather" entityId={forecast.cacheKey} field="forecast" label="Weather and marine sources" fallback={{ sourceType: 'official_weather', observedAt: forecast.updatedAt, ownerId: null, confidence: forecast.dataConfidence === 'verified' ? 'high' : 'medium', sourceRecord: `${forecast.weatherSourceLabel ?? 'Weather provider'} · ${forecast.marineSourceLabel ?? 'Marine provider'} · ${forecast.zoneLabel}`, formula: null, provider: `${forecast.weatherSourceLabel ?? ''}; ${forecast.marineSourceLabel ?? ''}`, sourceHash: null, notes: forecast.source === 'planning' ? 'Current-area or planning evidence; not a dated forecast unless explicitly labeled live.' : null }} />

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
      {forecast.nwsMarineZoneId ? (
        <TouchableOpacity
          style={styles.officialMarineZone}
          accessibilityRole={forecast.nwsMarineZoneUrl ? 'link' : 'text'}
          accessibilityLabel={`Official NOAA National Weather Service marine zone ${forecast.nwsMarineZoneId}, ${forecast.nwsMarineZoneName ?? ''}`}
          disabled={!forecast.nwsMarineZoneUrl}
          onPress={() => forecast.nwsMarineZoneUrl ? void Linking.openURL(forecast.nwsMarineZoneUrl) : undefined}
          testID={`sailing-weather-marine-zone-${cruise.id}-${dateKey}`}
        >
          <Text style={styles.officialMarineZoneTitle}>NOAA/NWS marine zone {forecast.nwsMarineZoneId}</Text>
          <Text style={styles.officialMarineZoneText}>{forecast.nwsMarineZoneName}</Text>
          <Text style={styles.officialMarineZoneMeta}>Mapped from this itinerary coordinate{forecast.nwsMarineZoneResolvedAt ? ` · checked ${formatObservationTime(forecast.nwsMarineZoneResolvedAt)}` : ''}</Text>
        </TouchableOpacity>
      ) : null}
      <VisibleItineraryMap
        latitude={forecast.latitude}
        longitude={forecast.longitude}
        title={positionPresentation.label}
        subtitle={`${forecast.zoneLabel} · ${positionPresentation.coordinatesLabel} · ${positionPresentation.disclaimer}`}
        mapUrl={positionPresentation.mapUrl}
        testID={`sailing-weather-visible-map-${cruise.id}-${dateKey}`}
      />
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={`${positionPresentation.label}. Open expected itinerary position in Maps. ${positionPresentation.disclaimer}`}
        style={styles.positionMapButton}
        onPress={() => void Linking.openURL(positionPresentation.mapUrl)}
        testID={`sailing-weather-position-map-${cruise.id}-${dateKey}`}
      >
        <View style={styles.positionMapIcon}>
          <MapPin size={16} color="#071426" />
        </View>
        <View style={styles.positionMapCopy}>
          <Text style={styles.positionMapTitle}>{positionPresentation.label}</Text>
          <Text style={styles.positionMapCoordinates}>{positionPresentation.coordinatesLabel}</Text>
          <Text style={styles.positionMapDisclaimer}>{positionPresentation.disclaimer}</Text>
        </View>
        <Text style={styles.positionMapAction}>Open map</Text>
      </TouchableOpacity>
      {manualRefreshMessage ? <Text style={styles.refreshMessage}>{manualRefreshMessage}</Text> : null}

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
          <Text style={styles.metricValue}>
            {forecast.metrics.marineDataStatus === 'pending'
              ? 'Pending'
              : forecast.metrics.marineDataStatus === 'unavailable'
                ? 'Unavailable'
                : formatMetricValue(forecast.metrics.maxWaveHeightFt, ' ft', 1)}
          </Text>
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

      {operationalMarine ? (
        <View style={styles.operationalPanel} testID={`sailing-weather-operational-marine-${cruise.id}`}>
          <View style={styles.operationalHeader}>
            <Text style={styles.operationalTitle}>Operational marine detail</Text>
            <Text style={styles.operationalConfidence}>{operationalMarine.confidence} confidence · {operationalMarine.availability.replaceAll('_', ' ')}</Text>
          </View>
          <View style={styles.operationalGrid}>
            <View style={styles.operationalMetric}><Text style={styles.operationalLabel}>Waves</Text><Text style={styles.operationalValue}>{formatMetricValue(operationalMarine.waveHeightFt, ' ft', 1)} · {formatMetricValue(operationalMarine.wavePeriodSeconds, ' sec')}</Text><Text style={styles.operationalMeta}>{operationalMarine.waveDirection}</Text></View>
            <View style={styles.operationalMetric}><Text style={styles.operationalLabel}>Swell</Text><Text style={styles.operationalValue}>{formatMetricValue(operationalMarine.swellHeightFt, ' ft', 1)} · {formatMetricValue(operationalMarine.swellPeriodSeconds, ' sec')}</Text><Text style={styles.operationalMeta}>{operationalMarine.swellDirection}</Text></View>
            <View style={styles.operationalMetric}><Text style={styles.operationalLabel}>Wind gusts</Text><Text style={styles.operationalValue}>{formatMetricValue(operationalMarine.windGustMph, ' mph')}</Text><Text style={styles.operationalMeta}>Max forecast</Text></View>
            <View style={styles.operationalMetric}><Text style={styles.operationalLabel}>Horizon</Text><Text style={styles.operationalValue}>{operationalMarine.forecastHorizonHours === null ? '—' : `${Math.round(operationalMarine.forecastHorizonHours)} hr`}</Text><Text style={styles.operationalMeta}>{operationalMarine.sourceAgeHours === null ? 'Source time unknown' : `Source age ${Math.round(operationalMarine.sourceAgeHours)} hr`}</Text></View>
          </View>
          <Text style={styles.motionExplanation}>{operationalMarine.motionExplanation}</Text>
          <Text style={styles.operationalSource}>Source: {operationalMarine.sourceLabel} · forecast saved {forecast.updatedAt}</Text>
        </View>
      ) : null}

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
          <Text style={styles.advisoriesTitle}>EasySeas model notes</Text>
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

      {forecast.nearestBuoyObservation ? (
        <Text style={styles.offlineHint} testID={`sailing-weather-buoy-${cruise.id}`}>
          NOAA/NDBC station {forecast.nearestBuoyObservation.stationId} · {forecast.nearestBuoyObservation.distanceMiles.toFixed(0)} mi from expected position · observed {formatObservationTime(forecast.nearestBuoyObservation.observedAt)} · {forecast.nearestBuoyObservation.freshness ?? 'freshness unknown'} · {forecast.nearestBuoyObservation.confidence ?? 'confidence unknown'} confidence · wind {formatMetricValue(forecast.nearestBuoyObservation.windMph, ' mph')} · wave {formatMetricValue(forecast.nearestBuoyObservation.waveHeightFt, ' ft', 1)}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Updated {formatUpdatedTime(forecast.updatedAt)} · {forecast.timezone} · {forecast.weatherSourceLabel ?? 'Open-Meteo weather'} · {forecast.marineSourceLabel ?? 'Open-Meteo marine'}
        </Text>
        <Text style={styles.footerText}>Refreshes every 4 hours online</Text>
      </View>
      <TouchableOpacity style={styles.refreshButton} onPress={() => void handleManualRefresh()} disabled={manualRefreshBusy} testID={`sailing-weather-refresh-${cruise.id}`}>
        {manualRefreshBusy ? <ActivityIndicator size="small" color="#071426" /> : <RefreshCw size={15} color="#071426" />}
        <Text style={styles.refreshButtonText}>{manualRefreshBusy ? 'Refreshing forecast…' : 'Refresh Weather & Waves Now'}</Text>
      </TouchableOpacity>
      <Text style={styles.offlineHint}>
        Saved locally for this sailing day. Opening Easy Seas online refreshes stale data; the saved copy remains readable offline.
      </Text>
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
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 8,
  },
  refreshButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#A7E7F6',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.xs,
  },
  refreshButtonText: {
    color: '#071426',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900',
  },
  refreshMessage: {
    color: '#E7F8FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
    backgroundColor: 'rgba(2, 20, 39, 0.32)',
    borderRadius: 10,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  availabilityHint: {
    color: '#D9F3FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
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
  operationalPanel: { backgroundColor: 'rgba(2, 20, 39, 0.42)', borderWidth: 1, borderColor: 'rgba(139,224,255,.22)', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  operationalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  operationalTitle: { color: '#E7F8FF', fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold },
  operationalConfidence: { color: '#8BE0FF', fontSize: 9, textTransform: 'uppercase' },
  operationalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  operationalMetric: { width: '48%', backgroundColor: 'rgba(255,255,255,.07)', borderRadius: 10, padding: 9 },
  operationalLabel: { color: 'rgba(231,248,255,.68)', fontSize: 9, textTransform: 'uppercase' },
  operationalValue: { color: COLORS.white, fontSize: 13, fontWeight: '800', marginTop: 3 },
  operationalMeta: { color: '#B4EBFF', fontSize: 9, marginTop: 2 },
  motionExplanation: { color: '#E7F8FF', fontSize: 11, lineHeight: 17 },
  operationalSource: { color: 'rgba(231,248,255,.62)', fontSize: 9 },
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
  officialMarineZone: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(167, 231, 246, 0.35)',
    backgroundColor: 'rgba(231, 248, 255, 0.10)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: 3,
  },
  officialMarineZoneTitle: { color: '#A7E7F6', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.45 },
  officialMarineZoneText: { color: COLORS.white, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  officialMarineZoneMeta: { color: 'rgba(231, 248, 255, 0.66)', fontSize: 9, lineHeight: 14 },
  positionMapButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(167, 231, 246, 0.35)',
    backgroundColor: 'rgba(231, 248, 255, 0.11)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  positionMapIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A7E7F6',
  },
  positionMapCopy: {
    flex: 1,
    gap: 2,
  },
  positionMapTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  positionMapCoordinates: {
    color: '#B4EBFF',
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  positionMapDisclaimer: {
    color: 'rgba(231, 248, 255, 0.68)',
    fontSize: 10,
    lineHeight: 14,
  },
  positionMapAction: {
    color: '#8BE0FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
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
  planningLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  planningLocationText: {
    flex: 1,
    color: '#D9F3FF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    lineHeight: 20,
  },
  planningLine: {
    color: 'rgba(231, 248, 255, 0.84)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
  },
  planningLabel: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
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
});
