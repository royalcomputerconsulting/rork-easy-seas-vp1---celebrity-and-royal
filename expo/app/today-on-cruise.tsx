import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Anchor,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Compass,
  MapPin,
  Ship,
  Sparkles,
  TicketCheck,
  CloudDownload,
  FolderLock,
  Utensils,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW, TYPOGRAPHY } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useAppState } from '@/state/AppStateProvider';
import { dedupeBookedCruises, dedupeCalendarEvents } from '@/lib/dataIdentity';
import { buildTodayOnCruiseBrief, selectOperationalCruise, type VoyageAgendaKind } from '@/lib/todayOnCruise';
import { createDateFromString } from '@/lib/date';
import { SailingWeatherCard } from '@/components/SailingWeatherCard';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatVoyageDate(value: string): string {
  return createDateFromString(value).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function agendaIcon(kind: VoyageAgendaKind) {
  if (kind === 'dining') return <Utensils size={16} color="#B45309" />;
  if (kind === 'excursion') return <Compass size={16} color="#0369A1" />;
  return <CalendarDays size={16} color="#6D28D9" />;
}

export default function TodayOnCruiseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cruiseId?: string | string[] }>();
  const { bookedCruises, calendarEvents } = useCoreData();
  const { localData } = useAppState();

  const cruises = useMemo(
    () => dedupeBookedCruises([...(localData.booked ?? []), ...bookedCruises], 'today on my cruise'),
    [bookedCruises, localData.booked],
  );
  const events = useMemo(
    () => dedupeCalendarEvents(
      [...(localData.calendar ?? []), ...(localData.tripit ?? []), ...calendarEvents],
      'today on my cruise agenda',
    ),
    [calendarEvents, localData.calendar, localData.tripit],
  );
  const selectedCruise = useMemo(
    () => selectOperationalCruise(cruises, new Date(), firstParam(params.cruiseId)),
    [cruises, params.cruiseId],
  );
  const brief = useMemo(
    () => selectedCruise ? buildTodayOnCruiseBrief(selectedCruise, events) : null,
    [events, selectedCruise],
  );

  if (!brief) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <ChevronLeft size={22} color={COLORS.navyDeep} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState} testID="today-on-cruise-empty">
          <Ship size={42} color="#64748B" />
          <Text style={styles.emptyTitle}>No upcoming voyage found</Text>
          <Text style={styles.emptyCopy}>Add or sync a booked cruise and Easy Seas will build the onboard brief from your saved itinerary.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const weatherDate = createDateFromString(brief.dateKey);
  const hasItineraryWarning = brief.itineraryConfidence === 'conflict' || brief.itineraryConfidence === 'unknown';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        <ResponsiveContainer>
          <LinearGradient colors={['#07182D', '#0B3F67', '#087A8B']} style={styles.hero}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.heroButton} onPress={() => router.back()} accessibilityLabel="Go back">
                <ChevronLeft size={22} color={COLORS.white} />
              </TouchableOpacity>
              <View style={styles.heroBadge}>
                <Sparkles size={14} color="#FDE68A" />
                <Text style={styles.heroBadgeText}>TODAY ON MY CRUISE</Text>
              </View>
              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => router.push({ pathname: '/cruise-details' as any, params: buildCruiseDetailsParams(brief.cruise, { source: 'booked' }) })}
                accessibilityLabel="Open cruise details"
              >
                <ChevronRight size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.shipName}>{brief.cruise.shipName}</Text>
            <Text style={styles.voyageName}>{brief.cruise.itineraryName || brief.cruise.destination || `${brief.cruise.nights}-night voyage`}</Text>
            <View style={styles.statusPill}>
              <Anchor size={15} color="#082F49" />
              <Text style={styles.statusPillText}>{brief.statusLabel}</Text>
            </View>
          </LinearGradient>

          <View style={styles.sectionCard} testID="today-on-cruise-location-card">
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: '#E0F2FE' }]}><MapPin size={18} color="#0369A1" /></View>
              <View style={styles.sectionTitleCopy}>
                <Text style={styles.eyebrow}>{formatVoyageDate(brief.dateKey)}</Text>
                <Text style={styles.locationTitle}>{brief.locationLabel}</Text>
              </View>
            </View>
            {(brief.arrival || brief.departure) ? (
              <View style={styles.portTimesRow}>
                {brief.arrival ? <View style={styles.timePill}><Text style={styles.timeLabel}>ARRIVE</Text><Text style={styles.timeValue}>{brief.arrival}</Text></View> : null}
                {brief.departure ? <View style={styles.timePill}><Text style={styles.timeLabel}>DEPART</Text><Text style={styles.timeValue}>{brief.departure}</Text></View> : null}
              </View>
            ) : null}
            {hasItineraryWarning ? (
              <View style={styles.warningBanner} testID="today-on-cruise-itinerary-warning">
                <CircleAlert size={15} color="#92400E" />
                <Text style={styles.warningText}>{brief.itineraryIssues[0] || 'This itinerary day needs review.'}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.weatherWrap} testID="today-on-cruise-weather-card">
            <SailingWeatherCard cruise={brief.cruise} selectedDate={weatherDate} />
          </View>

          <View style={styles.sectionCard} testID="today-on-cruise-agenda-card">
            <View style={styles.simpleHeader}>
              <CalendarDays size={18} color="#6D28D9" />
              <Text style={styles.simpleHeaderTitle}>Today’s agenda</Text>
              <TouchableOpacity
                style={styles.openAgendaButton}
                onPress={() => router.push({ pathname: '/day-agenda' as any, params: { date: brief.dateKey } })}
                accessibilityLabel="Open full day agenda"
              >
                <Text style={styles.openAgendaText}>Full day</Text>
                <ChevronRight size={14} color="#6D28D9" />
              </TouchableOpacity>
            </View>
            {brief.agenda.length === 0 ? (
              <View style={styles.noAgenda}>
                <Clock3 size={20} color="#64748B" />
                <Text style={styles.noAgendaText}>No dining, excursion, or calendar reservations are saved for this day.</Text>
              </View>
            ) : brief.agenda.map((item) => (
              <View key={item.id} style={styles.agendaRow}>
                <View style={styles.agendaIcon}>{agendaIcon(item.kind)}</View>
                <View style={styles.agendaCopy}>
                  <Text style={styles.agendaTitle}>{item.title}</Text>
                  <Text style={styles.agendaMeta}>{[item.time, item.location, item.detail].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard} testID="today-on-cruise-essentials-card">
            <View style={styles.simpleHeader}>
              <TicketCheck size={18} color="#0F766E" />
              <Text style={styles.simpleHeaderTitle}>Voyage essentials</Text>
            </View>
            {brief.essentials.length === 0 ? (
              <Text style={styles.noEssentials}>Reservation and stateroom details have not been saved yet.</Text>
            ) : (
              <View style={styles.essentialsGrid}>
                {brief.essentials.map((item) => (
                  <View key={item.label} style={styles.essentialCell}>
                    <Text style={styles.essentialLabel}>{item.label}</Text>
                    <Text style={styles.essentialValue} numberOfLines={2}>{item.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.offlinePackButton} onPress={() => router.push({ pathname: '/offline-voyage-pack' as any, params: { cruiseId: brief.cruise.id } })} testID="today-offline-voyage-pack">
            <CloudDownload size={18} color="#082F49" />
            <Text style={styles.offlinePackButtonText}>PRELOAD OFFLINE VOYAGE PACK</Text>
            <ChevronRight size={17} color="#082F49" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.readinessVaultButton} onPress={() => router.push({ pathname: '/travel-readiness-vault' as any, params: { cruiseId: brief.cruise.id } })} testID="today-travel-readiness-vault">
            <FolderLock size={18} color="#E7F8FF" />
            <Text style={styles.readinessVaultButtonText}>TRAVEL READINESS VAULT</Text>
            <ChevronRight size={17} color="#E7F8FF" />
          </TouchableOpacity>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EAF4F7' },
  scrollContent: { paddingBottom: 42 },
  hero: { margin: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, ...SHADOW.lg },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadgeText: { color: '#FDE68A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  shipName: { marginTop: SPACING.lg, color: COLORS.white, fontSize: 28, fontWeight: '900' },
  voyageName: { marginTop: 4, color: '#CDEBFA', fontSize: TYPOGRAPHY.fontSizeMD, lineHeight: 22 },
  statusPill: { alignSelf: 'flex-start', marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FDE68A', borderRadius: BORDER_RADIUS.round, paddingHorizontal: 12, paddingVertical: 7 },
  statusPillText: { color: '#082F49', fontWeight: '900', fontSize: TYPOGRAPHY.fontSizeSM },
  sectionCard: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#D6E3EA', ...SHADOW.sm },
  weatherWrap: { marginHorizontal: SPACING.md, marginTop: SPACING.sm },
  offlinePackButton: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FDE68A', borderRadius: BORDER_RADIUS.lg, paddingVertical: 14, ...SHADOW.sm },
  offlinePackButtonText: { color: '#082F49', fontSize: 12, fontWeight: '900' },
  readinessVaultButton: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0B3F67', borderRadius: BORDER_RADIUS.lg, paddingVertical: 14, ...SHADOW.sm },
  readinessVaultButtonText: { color: '#E7F8FF', fontSize: 12, fontWeight: '900' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitleCopy: { flex: 1, marginLeft: SPACING.sm },
  eyebrow: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  locationTitle: { marginTop: 2, color: COLORS.navyDeep, fontSize: 22, fontWeight: '900' },
  portTimesRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  timePill: { flex: 1, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F1F5F9' },
  timeLabel: { color: '#64748B', fontSize: 10, fontWeight: '900' },
  timeValue: { marginTop: 2, color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '800' },
  warningBanner: { marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: '#FEF3C7' },
  warningText: { flex: 1, color: '#78350F', fontSize: TYPOGRAPHY.fontSizeXS, lineHeight: 17 },
  simpleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  simpleHeaderTitle: { flex: 1, color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '900' },
  openAgendaButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 5 },
  openAgendaText: { color: '#6D28D9', fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '800' },
  noAgenda: { marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F8FAFC' },
  noAgendaText: { flex: 1, color: '#64748B', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 19 },
  agendaRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  agendaIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  agendaCopy: { flex: 1, marginLeft: SPACING.sm },
  agendaTitle: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '800' },
  agendaMeta: { marginTop: 2, color: '#64748B', fontSize: TYPOGRAPHY.fontSizeXS, lineHeight: 16 },
  noEssentials: { marginTop: SPACING.sm, color: '#64748B', fontSize: TYPOGRAPHY.fontSizeSM },
  essentialsGrid: { marginTop: SPACING.sm, flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  essentialCell: { minWidth: '46%', flexGrow: 1, flexBasis: 150, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: '#ECFDF5' },
  essentialLabel: { color: '#0F766E', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  essentialValue: { marginTop: 3, color: '#134E4A', fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '800' },
  emptyHeader: { padding: SPACING.md },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, ...SHADOW.sm },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl },
  emptyTitle: { marginTop: SPACING.md, color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: '900' },
  emptyCopy: { marginTop: SPACING.sm, textAlign: 'center', color: '#64748B', fontSize: TYPOGRAPHY.fontSizeSM, lineHeight: 21 },
});
