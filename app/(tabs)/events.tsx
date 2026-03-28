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

function getLuckBg(luck: LuckInfo | null, inCurrentMonth: boolean): string {
  if (!inCurrentMonth) return '#1A2A40';
  if (!luck) return '#172333';
  return luck.hex;
}

function getLuckTextColor(luck: LuckInfo | null, inCurrentMonth: boolean): string {
  if (!inCurrentMonth) return 'rgba(255,255,255,0.35)';
  if (!luck) return 'rgba(255,255,255,0.7)';
  if (luck.color === 'Yellow' || luck.color === 'Orange') return '#102544';
  return '#FFFFFF';
}

function getAgendaAccentColor(category: TimelineCategory, luck: LuckInfo | null): string {
  if (category === 'bookedCruise') return '#F59E0B';
  if (category === 'availableCruise') return '#0EA5E9';
  if (luck?.hex) return luck.hex;
  return COLORS.navyDeep;
}

export default function EventsScreen() {
  const router = useRouter();
  const { cruises, calendarEvents, bookedCruises, isLoading } = useCoreData();
  const { clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(normalizeDate(new Date()));

  useEffect(() => {
    console.log('[EventsScreen] Mounted', {
      cruises: cruises.length,
      calendarEvents: calendarEvents.length,
      bookedCruises: bookedCruises.length,
    });
  }, [bookedCruises.length, calendarEvents.length, cruises.length]);

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
  }, [currentMonth, eventCountsByDate]);

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

  const renderDayCell = useCallback(
    (day: CalendarDay) => {
      const bgColor = getLuckBg(day.luck, day.inCurrentMonth);
      const textColor = getLuckTextColor(day.luck, day.inCurrentMonth);
      const hasBooked = day.counts.bookedCruise > 0;
      const hasAvailable = day.counts.availableCruise > 0;
      const hasTravel = day.counts.travel > 0;
      const hasPersonal = day.counts.personal > 0;

      const gradientColors: [string, string] = day.inCurrentMonth && day.luck
        ? [day.luck.hex, `${day.luck.hex}CC`]
        : day.inCurrentMonth
          ? ['#172333', '#0F1A28']
          : ['#0D1620', '#0A1219'];

      return (
        <TouchableOpacity
          key={day.key}
          activeOpacity={0.82}
          onPress={() => handleDayPress(day)}
          style={[
            styles.dayCell,
            day.isToday && styles.todayCell,
            hasBooked && styles.bookedCell,
          ]}
          testID={`luck-day-${day.key}`}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dayCellGradient}
          >
            <View style={styles.dayCellTop}>
              <Text style={[styles.dayNumber, { color: textColor }]}>
                {String(day.dayNumber)}
              </Text>
              {day.inCurrentMonth && day.luck ? (
                <View style={[styles.luckScorePill, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
                  <Text style={[styles.luckScoreText, { color: textColor }]}>
                    {String(day.luck.score)}
                  </Text>
                </View>
              ) : null}
            </View>

            {day.inCurrentMonth ? (
              <Text style={[styles.luckLabel, { color: textColor }]} numberOfLines={1}>
                {day.luck ? day.luck.label : 'No data'}
              </Text>
            ) : null}

            <View style={styles.dayCellDots}>
              {hasBooked ? <View style={styles.dotBooked} /> : null}
              {hasAvailable ? <View style={styles.dotAvailable} /> : null}
              {hasTravel ? <View style={styles.dotTravel} /> : null}
              {hasPersonal ? <View style={styles.dotPersonal} /> : null}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [handleDayPress],
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
              <Text style={styles.statLabel}>{'Booked Cruise Days'}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAvail]}>
              <Text style={[styles.statValue, styles.statValueAvail]}>{String(monthSummary.availableCruiseDays)}</Text>
              <Text style={styles.statLabel}>{'Offer Sail Days'}</Text>
            </View>
          </View>

          {mode === 'month' ? (
            <View style={styles.calendarCard} testID="calendar-month-card">
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

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label: string) => (
                  <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                ))}
              </View>

              {calendarWeeks.map((week: CalendarDay[], wi: number) => (
                <View key={`week-${wi}`} style={styles.weekRow}>
                  {week.map((day: CalendarDay) => renderDayCell(day))}
                </View>
              ))}
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

          <View style={styles.legendCard} testID="calendar-luck-legend">
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Sparkles size={17} color="#FFE28F" />
                <Text style={styles.sectionTitle}>{'Luck + Cruise Legend'}</Text>
              </View>
            </View>

            <View style={styles.luckGrid}>
              {LUCK_ORDER.map((luckColor: LuckColor) => {
                const info = LUCK_SCALE[luckColor];
                const txtColor = getLuckTextColor(info, true);
                return (
                  <View key={luckColor} style={[styles.luckTile, { backgroundColor: info.hex }]}>
                    <Text style={[styles.luckTileScore, { color: txtColor }]}>{String(info.score)}</Text>
                    <Text style={[styles.luckTileName, { color: txtColor }]}>{info.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.dotLegendRow}>
              <View style={styles.dotLegendItem}>
                <View style={[styles.dotSample, styles.dotBooked]} />
                <Text style={styles.dotLegendText}>{'Booked cruise'}</Text>
              </View>
              <View style={styles.dotLegendItem}>
                <View style={[styles.dotSample, styles.dotAvailable]} />
                <Text style={styles.dotLegendText}>{'Available cruise'}</Text>
              </View>
              <View style={styles.dotLegendItem}>
                <View style={[styles.dotSample, styles.dotTravel]} />
                <Text style={styles.dotLegendText}>{'Travel'}</Text>
              </View>
              <View style={styles.dotLegendItem}>
                <View style={[styles.dotSample, styles.dotPersonal]} />
                <Text style={styles.dotLegendText}>{'Personal'}</Text>
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
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.35)',
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
    color: '#FBBF24',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...SHADOW.md,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 3,
  },
  dayCell: {
    flex: 1,
    minHeight: 88,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#FFE28F',
  },
  bookedCell: {
    borderColor: '#F59E0B',
  },
  dayCellGradient: {
    flex: 1,
    padding: 5,
    justifyContent: 'space-between',
  },
  dayCellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '800' as const,
    lineHeight: 18,
  },
  luckScorePill: {
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  luckScoreText: {
    fontSize: 9,
    fontWeight: '800' as const,
  },
  luckLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    marginTop: 3,
    opacity: 0.92,
  },
  dayCellDots: {
    flexDirection: 'row',
    gap: 3,
    minHeight: 7,
    marginTop: 4,
  },
  dotBooked: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  dotAvailable: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  dotTravel: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#818CF8',
  },
  dotPersonal: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  luckTile: {
    width: '30%',
    minWidth: 88,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  luckTileScore: {
    fontSize: 22,
    fontWeight: '800' as const,
  },
  luckTileName: {
    marginTop: 3,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  dotLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  dotLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotSample: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLegendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600' as const,
  },
});
