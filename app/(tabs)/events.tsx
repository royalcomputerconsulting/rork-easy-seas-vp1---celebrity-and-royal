import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock4,
  Plane,
  RefreshCw,
  Ship,
  Sparkles,
  User,
} from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import type { BookedCruise, CalendarEvent, Cruise } from '@/types/models';
import { createDateFromString, formatDate } from '@/lib/date';
import { formatDateKey, getLuckForDate, LUCK_SCALE, type LuckColor, type LuckInfo } from '../../constants/luckScores';

const HERO_GRADIENT = ['#051120', '#0B1D38', '#132A4D', '#26143C'] as const;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const LUCK_ORDER = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'] as const satisfies readonly LuckColor[];

// Outline border colors for event types
const OUTLINE_BOOKED = '#16A34A';   // green - booked cruise
const OUTLINE_TRAVEL = '#2563EB';   // blue - travel days
const OUTLINE_PERSONAL = '#7C3AED'; // purple - personal days

type CalendarMode = 'month' | 'agenda';
type TimelineCategory = 'bookedCruise' | 'availableCruise' | 'travel' | 'personal';

interface EventCounts {
  bookedCruise: number;
  availableCruise: number;
  travel: number;
  personal: number;
  total: number;
}

interface TimelineEvent {
  id: string;
  title: string;
  category: TimelineCategory;
  startDate: Date;
  endDate: Date;
  location?: string;
  shipName?: string;
}

interface CalendarDay {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  luck: LuckInfo | null;
  counts: EventCounts;
}

function normalizeDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEventCategory(type: CalendarEvent['type'] | 'bookedCruise' | 'availableCruise'): TimelineCategory {
  if (type === 'bookedCruise' || type === 'cruise') return 'bookedCruise';
  if (type === 'availableCruise') return 'availableCruise';
  if (type === 'travel' || type === 'flight' || type === 'hotel') return 'travel';
  return 'personal';
}

function getEmptyCounts(): EventCounts {
  return { bookedCruise: 0, availableCruise: 0, travel: 0, personal: 0, total: 0 };
}

function buildDateKeysInRange(startDate: Date, endDate: Date): string[] {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const orderedStart = start.getTime() <= end.getTime() ? start : end;
  const orderedEnd = start.getTime() <= end.getTime() ? end : start;
  const keys: string[] = [];
  const span = Math.min(180, Math.max(0, Math.round((orderedEnd.getTime() - orderedStart.getTime()) / 86400000)));
  for (let i = 0; i <= span; i += 1) {
    keys.push(formatDateKey(addDays(orderedStart, i)));
  }
  return keys;
}

function getAgendaAccentColor(category: TimelineCategory, luck: LuckInfo | null): string {
  if (category === 'bookedCruise') return OUTLINE_BOOKED;
  if (category === 'availableCruise') return '#0EA5E9';
  if (luck?.hex) return luck.hex;
  return COLORS.navyDeep;
}

function formatSyncDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventsScreen() {
  const router = useRouter();
  const { cruises, calendarEvents, bookedCruises, isLoading } = useCoreData();
  const { clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(normalizeDate(new Date()));
  const [syncKey, setSyncKey] = useState<number>(0);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    console.log('[EventsScreen] Mounted', {
      cruises: cruises.length,
      calendarEvents: calendarEvents.length,
      bookedCruises: bookedCruises.length,
    });
  }, [bookedCruises.length, calendarEvents.length, cruises.length]);

  const handleSync = useCallback(() => {
    setIsSyncing(true);
    console.log('[EventsScreen] Syncing luck calendars...');
    setTimeout(() => {
      setSyncKey((k) => k + 1);
      setLastSynced(new Date());
      setIsSyncing(false);
      console.log('[EventsScreen] Luck calendars synced');
    }, 1200);
  }, []);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    const bookedCruiseIds = new Set<string>(bookedCruises.map((c: BookedCruise) => c.id));

    const importedEvents = calendarEvents.map((ev: CalendarEvent): TimelineEvent => ({
      id: `calendar-${ev.id}`,
      title: ev.title || 'Untitled event',
      category: getEventCategory(ev.type),
      startDate: createDateFromString(ev.startDate || ev.start || ''),
      endDate: createDateFromString(ev.endDate || ev.end || ev.startDate || ev.start || ''),
      location: ev.location,
    }));

    const bookedCruiseEvents = bookedCruises
      .filter((c: BookedCruise) => Boolean(c.sailDate))
      .map((c: BookedCruise): TimelineEvent => ({
        id: `booked-${c.id}`,
        title: c.shipName || 'Booked cruise',
        category: 'bookedCruise',
        startDate: createDateFromString(c.sailDate),
        endDate: c.returnDate
          ? createDateFromString(c.returnDate)
          : addDays(createDateFromString(c.sailDate), Math.max(0, (c.nights || 1) - 1)),
        location: c.destination || c.itineraryName || c.departurePort,
        shipName: c.shipName,
      }));

    const availableCruiseEvents = cruises
      .filter((c: Cruise) => {
        if (!c.sailDate) return false;
        if (bookedCruiseIds.has(c.id)) return false;
        if (c.status === 'booked' || c.status === 'completed') return false;
        return true;
      })
      .map((c: Cruise): TimelineEvent => ({
        id: `available-${c.id}`,
        title: c.shipName || 'Available cruise',
        category: 'availableCruise',
        startDate: createDateFromString(c.sailDate),
        endDate: c.returnDate
          ? createDateFromString(c.returnDate)
          : addDays(createDateFromString(c.sailDate), Math.max(0, (c.nights || 1) - 1)),
        location: c.destination || c.itineraryName || c.departurePort,
        shipName: c.shipName,
      }));

    return [...importedEvents, ...bookedCruiseEvents, ...availableCruiseEvents]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [bookedCruises, calendarEvents, cruises]);

  const eventCountsByDate = useMemo(() => {
    const map = new Map<string, EventCounts>();
    timelineEvents.forEach((ev: TimelineEvent) => {
      buildDateKeysInRange(ev.startDate, ev.endDate).forEach((key) => {
        const cur = map.get(key) ?? getEmptyCounts();
        cur[ev.category] += 1;
        cur.total += 1;
        map.set(key, cur);
      });
    });
    return map;
  }, [timelineEvents]);

  const calendarWeeks = useMemo((): CalendarDay[][] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = normalizeDate(new Date(year, month, 1));
    const lastDay = normalizeDate(new Date(year, month + 1, 0));
    const gridStart = addDays(firstDay, -firstDay.getDay());
    const gridEnd = addDays(lastDay, 6 - lastDay.getDay());
    const todayKey = formatDateKey(new Date());
    const allDays: CalendarDay[] = [];
    let walker = gridStart;

    while (walker.getTime() <= gridEnd.getTime()) {
      const key = formatDateKey(walker);
      allDays.push({
        key,
        date: walker,
        dayNumber: walker.getDate(),
        inCurrentMonth: walker.getMonth() === month,
        isToday: key === todayKey,
        luck: getLuckForDate(key),
        counts: eventCountsByDate.get(key) ?? getEmptyCounts(),
      });
      walker = addDays(walker, 1);
    }

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }
    return weeks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, eventCountsByDate, syncKey]);

  const monthSummary = useMemo(() => {
    let bestDays = 0;
    let cautionDays = 0;
    let bookedCruiseDays = 0;
    let availableCruiseDays = 0;

    calendarWeeks.flat().forEach((day: CalendarDay) => {
      if (!day.inCurrentMonth) return;
      if (day.luck) {
        if (day.luck.score >= 6) bestDays += 1;
        if (day.luck.score <= 2) cautionDays += 1;
      }
      if (day.counts.bookedCruise > 0) bookedCruiseDays += 1;
      if (day.counts.availableCruise > 0) availableCruiseDays += 1;
    });

    return { bestDays, cautionDays, bookedCruiseDays, availableCruiseDays };
  }, [calendarWeeks]);

  const upcomingEvents = useMemo((): TimelineEvent[] => {
    const today = normalizeDate(new Date());
    return timelineEvents
      .filter((ev: TimelineEvent) => normalizeDate(ev.endDate).getTime() >= today.getTime())
      .slice(0, 14);
  }, [timelineEvents]);

  const navigateMonth = useCallback((direction: 'previous' | 'next') => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1), 1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  }, []);

  const goToToday = useCallback(() => {
    setCurrentMonth(normalizeDate(new Date()));
  }, []);

  const handleDayPress = useCallback(
    (day: CalendarDay) => {
      router.push({ pathname: '/day-agenda' as any, params: { date: day.key } });
    },
    [router],
  );

  // Determine cell outline color: priority = booked > travel > personal
  const getCellOutlineColor = useCallback((counts: EventCounts): string | null => {
    if (counts.bookedCruise > 0) return OUTLINE_BOOKED;
    if (counts.travel > 0) return OUTLINE_TRAVEL;
    if (counts.personal > 0) return OUTLINE_PERSONAL;
    return null;
  }, []);

  const renderDayCell = useCallback(
    (day: CalendarDay) => {
      const outlineColor = day.inCurrentMonth ? getCellOutlineColor(day.counts) : null;
      const hasEvent = outlineColor !== null;

      // Cell bg: white for current month, very light gray for out-of-month
      const cellBg = day.inCurrentMonth ? '#FFFFFF' : '#E8EDF3';

      // Luck number color: use the luck hex color so it's visible on white
      const luckNumColor = day.luck && day.inCurrentMonth ? day.luck.hex : '#9CA3AF';

      // Date number color
      const dateNumColor = day.inCurrentMonth ? '#111827' : '#9CA3AF';

      // Border: today gets gold, event gets colored outline, else thin gray
      const borderColor = day.isToday
        ? '#D97706'
        : hasEvent
          ? (outlineColor as string)
          : '#D1D5DB';
      const borderWidth = day.isToday || hasEvent ? 2.5 : 1;

      return (
        <TouchableOpacity
          key={day.key}
          activeOpacity={0.78}
          onPress={() => handleDayPress(day)}
          style={[
            styles.dayCell,
            {
              backgroundColor: cellBg,
              borderColor,
              borderWidth,
            },
          ]}
          testID={`luck-day-${day.key}`}
        >
          <Text style={[styles.dayNumber, { color: dateNumColor }]}>
            {String(day.dayNumber)}
          </Text>

          {day.inCurrentMonth ? (
            <Text
              style={[
                styles.luckNumber,
                { color: day.luck ? luckNumColor : '#C7D2E0' },
              ]}
            >
              {day.luck ? String(day.luck.score) : '–'}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    },
    [handleDayPress, getCellOutlineColor],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          testID="calendar-scroll"
        >
          <View style={styles.heroRow}>
            <Image source={{ uri: IMAGES.logo }} style={styles.heroLogo} resizeMode="contain" />
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>{'Easy Seas™ Calendar'}</Text>
              <Text style={styles.heroSubtitle}>
                {'Luck scores, booked cruises & offer sailings in one view'}
              </Text>
            </View>
          </View>

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Sparkles size={13} color="#FFE28F" />
              <Text style={styles.heroBadgeText}>{clubRoyaleTier}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ship size={13} color="#9EFDF2" />
              <Text style={styles.heroBadgeText}>{`${bookedCruises.length} booked`}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Clock4 size={13} color="#D8C0FF" />
              <Text style={styles.heroBadgeText}>{isLoading ? 'Syncing' : crownAnchorLevel}</Text>
            </View>
          </View>

          <View style={styles.modeRow}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setMode('month')}
              style={[styles.modeButton, mode === 'month' && styles.modeButtonActive]}
              testID="calendar-mode-month"
            >
              <Text style={[styles.modeText, mode === 'month' && styles.modeTextActive]}>
                {'Month'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setMode('agenda')}
              style={[styles.modeButton, mode === 'agenda' && styles.modeButtonActive]}
              testID="calendar-mode-agenda"
            >
              <Text style={[styles.modeText, mode === 'agenda' && styles.modeTextActive]}>
                {'Agenda'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{String(monthSummary.bestDays)}</Text>
              <Text style={styles.statLabel}>{'Best Luck Days'}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardBooked]}>
              <Text style={[styles.statValue, styles.statValueBooked]}>{String(monthSummary.bookedCruiseDays)}</Text>
              <Text style={styles.statLabel}>{'Booked Days'}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAvail]}>
              <Text style={[styles.statValue, styles.statValueAvail]}>{String(monthSummary.availableCruiseDays)}</Text>
              <Text style={styles.statLabel}>{'Offer Days'}</Text>
            </View>
          </View>

          {mode === 'month' ? (
            <View style={styles.calendarCard} testID="calendar-month-card">
              {/* Month header */}
              <View style={styles.calHeader}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigateMonth('previous')}
                  style={styles.navBtn}
                  testID="calendar-prev-month"
                >
                  <ChevronLeft size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={goToToday}
                  style={styles.calHeaderCenter}
                >
                  <Text style={styles.monthTitle}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.monthHint}>{'Tap to go to today'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigateMonth('next')}
                  style={styles.navBtn}
                  testID="calendar-next-month"
                >
                  <ChevronRight size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Weekday labels */}
              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label: string) => (
                  <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                ))}
              </View>

              {/* Calendar grid — white bg section */}
              <View style={styles.calendarGridBg}>
                {calendarWeeks.map((week: CalendarDay[], wi: number) => (
                  <View key={`week-${wi}`} style={styles.weekRow}>
                    {week.map((day: CalendarDay) => renderDayCell(day))}
                  </View>
                ))}
              </View>

              {/* Last updated + sync */}
              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>
                  {`Updated: ${formatSyncDate(lastSynced)}`}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSync}
                  style={[styles.syncBtn, isSyncing && styles.syncBtnSyncing]}
                  disabled={isSyncing}
                  testID="calendar-sync-btn"
                >
                  <RefreshCw size={13} color={isSyncing ? 'rgba(255,255,255,0.5)' : '#FFFFFF'} />
                  <Text style={[styles.syncBtnText, isSyncing && { opacity: 0.5 }]}>
                    {isSyncing ? 'Syncing…' : 'Sync Luck'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.agendaCard} testID="calendar-agenda-card">
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <CalendarDays size={18} color="#FFE28F" />
                  <Text style={styles.sectionTitle}>{'Upcoming'}</Text>
                </View>
                <Text style={styles.sectionCount}>{`${upcomingEvents.length} items`}</Text>
              </View>

              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((ev: TimelineEvent) => {
                  const dateKey = formatDateKey(ev.startDate);
                  const dayLuck = getLuckForDate(dateKey);
                  const accentColor = getAgendaAccentColor(ev.category, dayLuck);
                  const EventIcon = ev.category === 'travel' ? Plane : ev.category === 'personal' ? User : Ship;
                  const badgeLabel = ev.category === 'bookedCruise'
                    ? 'BOOKED'
                    : ev.category === 'availableCruise'
                      ? 'CRUISE'
                      : ev.category === 'travel'
                        ? 'TRAVEL'
                        : 'PERSONAL';

                  return (
                    <TouchableOpacity
                      key={ev.id}
                      activeOpacity={0.84}
                      onPress={() => router.push({ pathname: '/day-agenda' as any, params: { date: dateKey } })}
                      style={styles.agendaItem}
                      testID={`agenda-item-${ev.id}`}
                    >
                      <View style={[styles.agendaAccentBar, { backgroundColor: accentColor }]} />
                      <View style={[styles.agendaIconWrap, { backgroundColor: `${accentColor}22` }]}>
                        <EventIcon size={17} color={accentColor} />
                      </View>
                      <View style={styles.agendaTextBlock}>
                        <View style={styles.agendaTitleRow}>
                          <Text style={styles.agendaItemTitle} numberOfLines={1}>{ev.title}</Text>
                          <View style={[styles.agendaBadge, { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}44` }]}>
                            <Text style={[styles.agendaBadgeText, { color: accentColor }]}>{badgeLabel}</Text>
                          </View>
                        </View>
                        <Text style={styles.agendaMeta}>{formatDate(ev.startDate, 'long')}</Text>
                        {ev.location ? (
                          <Text style={styles.agendaMeta}>{ev.location}</Text>
                        ) : null}
                      </View>
                      {dayLuck ? (
                        <View style={[styles.agendaLuckBadge, { backgroundColor: `${dayLuck.hex}22`, borderColor: `${dayLuck.hex}44` }]}>
                          <Text style={[styles.agendaLuckScore, { color: dayLuck.hex }]}>{String(dayLuck.score)}</Text>
                          <Text style={[styles.agendaLuckLabel, { color: dayLuck.hex }]}>{dayLuck.label}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <CalendarDays size={28} color="rgba(255,255,255,0.28)" />
                  <Text style={styles.emptyTitle}>{'No upcoming events'}</Text>
                  <Text style={styles.emptyBody}>
                    {'Booked cruises, offer sailings, and imported events will appear here.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Legend */}
          <View style={styles.legendCard} testID="calendar-luck-legend">
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Sparkles size={17} color="#FFE28F" />
                <Text style={styles.sectionTitle}>{'Luck Scale (1–9)'}</Text>
              </View>
            </View>

            <View style={styles.luckGrid}>
              {LUCK_ORDER.map((luckColor: LuckColor) => {
                const info = LUCK_SCALE[luckColor];
                return (
                  <View key={luckColor} style={[styles.luckTile, { borderColor: info.hex, borderLeftWidth: 4 }]}>
                    <Text style={[styles.luckTileScore, { color: info.hex }]}>{String(info.score)}</Text>
                    <Text style={styles.luckTileName}>{info.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.outlineLegend}>
              <Text style={styles.outlineLegendTitle}>{'Cell Outline Colors'}</Text>
              <View style={styles.outlineLegendRow}>
                <View style={[styles.outlineSwatch, { borderColor: OUTLINE_BOOKED }]} />
                <Text style={styles.outlineLegendText}>{'Booked Cruise'}</Text>
              </View>
              <View style={styles.outlineLegendRow}>
                <View style={[styles.outlineSwatch, { borderColor: OUTLINE_TRAVEL }]} />
                <Text style={styles.outlineLegendText}>{'Travel Day'}</Text>
              </View>
              <View style={styles.outlineLegendRow}>
                <View style={[styles.outlineSwatch, { borderColor: OUTLINE_PERSONAL }]} />
                <Text style={styles.outlineLegendText}>{'Personal Day'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#051120',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 140,
    gap: SPACING.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: 4,
  },
  heroLogo: {
    width: 60,
    height: 60,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.66)',
    marginTop: 3,
    lineHeight: 18,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,226,143,0.18)',
    borderColor: 'rgba(255,226,143,0.55)',
  },
  modeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.55)',
  },
  modeTextActive: {
    color: '#FFE28F',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  statCardBooked: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: 'rgba(22,163,74,0.4)',
  },
  statCardAvail: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderColor: 'rgba(14,165,233,0.35)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  statValueBooked: {
    color: '#4ADE80',
  },
  statValueAvail: {
    color: '#38BDF8',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  calendarCard: {
    backgroundColor: '#0D1E33',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...SHADOW.md,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: '#0A1628',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  calHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  monthHint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGridBg: {
    backgroundColor: '#E8EDF3',
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    minHeight: 56,
    borderRadius: 6,
    paddingTop: 5,
    paddingHorizontal: 4,
    paddingBottom: 5,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '700' as const,
    lineHeight: 16,
    alignSelf: 'flex-end',
  },
  luckNumber: {
    fontSize: 18,
    fontWeight: '900' as const,
    lineHeight: 22,
    textAlign: 'center',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  syncLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500' as const,
    flex: 1,
    flexShrink: 1,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(79,70,229,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(129,120,255,0.5)',
    marginLeft: SPACING.sm,
  },
  syncBtnSyncing: {
    backgroundColor: 'rgba(79,70,229,0.35)',
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  agendaCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  sectionCount: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.45)',
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  agendaAccentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  agendaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.sm,
  },
  agendaTextBlock: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  agendaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  agendaItemTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  agendaBadge: {
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  agendaBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
  },
  agendaMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.55)',
  },
  agendaLuckBadge: {
    marginRight: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 44,
  },
  agendaLuckScore: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
  },
  agendaLuckLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    marginTop: 1,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.55)',
  },
  emptyBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  legendCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  luckGrid: {
    gap: 6,
    marginBottom: SPACING.md,
  },
  luckTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  luckTileScore: {
    fontSize: 20,
    fontWeight: '900' as const,
    width: 24,
    textAlign: 'center',
  },
  luckTileName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  outlineLegend: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  outlineLegendTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  outlineLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outlineSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2.5,
    backgroundColor: '#FFFFFF',
  },
  outlineLegendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600' as const,
  },
});
