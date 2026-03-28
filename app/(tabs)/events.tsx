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
import type { BookedCruise, CalendarEvent } from '@/types/models';
import { createDateFromString, formatDate } from '@/lib/date';
import { formatDateKey, getLuckForDate, LUCK_SCALE, type LuckColor, type LuckInfo } from '../../constants/luckScores';

const HERO_COLORS = ['#102544', '#1E3A5F', '#2E5077'] as const;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const LUCK_ORDER = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'] as const satisfies readonly LuckColor[];
const CARD_SURFACE = 'rgba(241, 247, 255, 0.97)';
const CARD_BORDER = 'rgba(125, 184, 255, 0.26)';
const INNER_SURFACE = 'rgba(16, 37, 68, 0.06)';
const INNER_BORDER = 'rgba(30, 58, 95, 0.08)';

type CalendarMode = 'month' | 'agenda';
type EventCategory = 'cruise' | 'travel' | 'personal';

interface EventCounts {
  cruise: number;
  travel: number;
  personal: number;
  total: number;
}

interface TimelineEvent {
  id: string;
  title: string;
  category: EventCategory;
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
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getEventCategory(type: CalendarEvent['type'] | 'cruise'): EventCategory {
  if (type === 'cruise') {
    return 'cruise';
  }

  if (type === 'travel' || type === 'flight' || type === 'hotel') {
    return 'travel';
  }

  return 'personal';
}

function getEmptyCounts(): EventCounts {
  return {
    cruise: 0,
    travel: 0,
    personal: 0,
    total: 0,
  };
}

function getLuckTextColor(luck: LuckInfo | null): string {
  if (!luck) {
    return COLORS.navyDeep;
  }

  if (luck.color === 'Yellow') {
    return COLORS.navyDeep;
  }

  return COLORS.white;
}

function getLuckSurface(luck: LuckInfo | null, inCurrentMonth: boolean): string {
  if (!inCurrentMonth) {
    return 'rgba(255,255,255,0.05)';
  }

  if (!luck) {
    return 'rgba(255,255,255,0.88)';
  }

  return luck.hex;
}

function buildDateKeysInRange(startDate: Date, endDate: Date): string[] {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const orderedStart = start.getTime() <= end.getTime() ? start : end;
  const orderedEnd = start.getTime() <= end.getTime() ? end : start;
  const keys: string[] = [];
  const span = Math.min(120, Math.max(0, Math.round((orderedEnd.getTime() - orderedStart.getTime()) / 86400000)));

  for (let index = 0; index <= span; index += 1) {
    keys.push(formatDateKey(addDays(orderedStart, index)));
  }

  return keys;
}

export default function EventsScreen() {
  const router = useRouter();
  const { calendarEvents, bookedCruises, isLoading } = useCoreData();
  const { clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(normalizeDate(new Date()));

  useEffect(() => {
    console.log('[EventsScreen] Mounted with data', {
      calendarEvents: calendarEvents.length,
      bookedCruises: bookedCruises.length,
      mode,
    });
  }, [bookedCruises.length, calendarEvents.length, mode]);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    const importedEvents = calendarEvents.map((event: CalendarEvent): TimelineEvent => {
      const startDate = createDateFromString(event.startDate || event.start || '');
      const fallbackEndDate = event.endDate || event.end || event.startDate || event.start || '';
      const endDate = createDateFromString(fallbackEndDate);

      return {
        id: event.id,
        title: event.title || 'Untitled event',
        category: getEventCategory(event.type),
        startDate,
        endDate,
        location: event.location,
      };
    });

    const cruiseEvents = bookedCruises
      .filter((cruise: BookedCruise) => Boolean(cruise.sailDate))
      .map((cruise: BookedCruise): TimelineEvent => {
        const startDate = createDateFromString(cruise.sailDate);
        const endDate = cruise.returnDate
          ? createDateFromString(cruise.returnDate)
          : addDays(startDate, Math.max(0, (cruise.nights || 1) - 1));

        return {
          id: `cruise-${cruise.id}`,
          title: cruise.shipName || 'Cruise',
          category: 'cruise',
          startDate,
          endDate,
          location: cruise.destination || cruise.departurePort,
          shipName: cruise.shipName,
        };
      });

    const sortedEvents = [...importedEvents, ...cruiseEvents].sort(
      (left, right) => left.startDate.getTime() - right.startDate.getTime(),
    );

    console.log('[EventsScreen] Timeline events prepared', { count: sortedEvents.length });
    return sortedEvents;
  }, [bookedCruises, calendarEvents]);

  const eventCountsByDate = useMemo(() => {
    const countsMap = new Map<string, EventCounts>();

    timelineEvents.forEach((event: TimelineEvent) => {
      const dateKeys = buildDateKeysInRange(event.startDate, event.endDate);
      dateKeys.forEach((dateKey) => {
        const currentCounts = countsMap.get(dateKey) ?? getEmptyCounts();
        const category = event.category;
        currentCounts[category] = currentCounts[category] + 1;
        currentCounts.total += 1;
        countsMap.set(dateKey, currentCounts);
      });
    });

    console.log('[EventsScreen] Event count map ready', { keyedDays: countsMap.size });
    return countsMap;
  }, [timelineEvents]);

  const calendarWeeks = useMemo((): CalendarDay[][] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = normalizeDate(new Date(year, month, 1));
    const lastDayOfMonth = normalizeDate(new Date(year, month + 1, 0));
    const gridStart = addDays(firstDayOfMonth, -firstDayOfMonth.getDay());
    const gridEnd = addDays(lastDayOfMonth, 6 - lastDayOfMonth.getDay());
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
    for (let index = 0; index < allDays.length; index += 7) {
      weeks.push(allDays.slice(index, index + 7));
    }

    console.log('[EventsScreen] Calendar grid built', {
      weeks: weeks.length,
      month: `${year}-${month + 1}`,
    });

    return weeks;
  }, [currentMonth, eventCountsByDate]);

  const monthLuckSummary = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    let bestDays = 0;
    let cautionDays = 0;
    let scoredDays = 0;
    let totalScore = 0;

    calendarWeeks.flat().forEach((day) => {
      if (!day.inCurrentMonth || !day.luck) {
        return;
      }

      scoredDays += 1;
      totalScore += day.luck.score;

      if (day.luck.score >= 6) {
        bestDays += 1;
      }

      if (day.luck.score <= 2) {
        cautionDays += 1;
      }
    });

    const averageScore = scoredDays > 0 ? totalScore / scoredDays : 0;

    console.log('[EventsScreen] Luck summary ready', {
      year,
      month: month + 1,
      bestDays,
      cautionDays,
      averageScore,
    });

    return {
      bestDays,
      cautionDays,
      averageScore,
    };
  }, [calendarWeeks, currentMonth]);

  const upcomingEvents = useMemo(() => {
    const today = normalizeDate(new Date());
    const list = timelineEvents
      .filter((event) => normalizeDate(event.endDate).getTime() >= today.getTime())
      .slice(0, 10);

    console.log('[EventsScreen] Upcoming events ready', { count: list.length });
    return list;
  }, [timelineEvents]);

  const navigateMonth = useCallback((direction: 'previous' | 'next') => {
    setCurrentMonth((previousMonth) => {
      const nextMonth = new Date(previousMonth);
      nextMonth.setMonth(previousMonth.getMonth() + (direction === 'next' ? 1 : -1), 1);
      nextMonth.setHours(0, 0, 0, 0);
      console.log('[EventsScreen] Navigating month', { direction, nextMonth: formatDateKey(nextMonth) });
      return nextMonth;
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = normalizeDate(new Date());
    console.log('[EventsScreen] Returning to today', { today: formatDateKey(today) });
    setCurrentMonth(today);
  }, []);

  const handleDayPress = useCallback(
    (day: CalendarDay) => {
      console.log('[EventsScreen] Day selected', {
        date: day.key,
        score: day.luck?.score ?? null,
        totalEvents: day.counts.total,
      });

      router.push({
        pathname: '/day-agenda' as any,
        params: { date: day.key },
      });
    },
    [router],
  );

  const renderDayCell = useCallback(
    (day: CalendarDay) => {
      const textColor = getLuckTextColor(day.luck);
      const surfaceColor = getLuckSurface(day.luck, day.inCurrentMonth);
      const hasEvents = day.counts.total > 0;
      const hasCruise = day.counts.cruise > 0;

      return (
        <TouchableOpacity
          key={day.key}
          activeOpacity={0.86}
          onPress={() => handleDayPress(day)}
          style={[
            styles.dayCell,
            { backgroundColor: surfaceColor },
            !day.inCurrentMonth && styles.dayCellMuted,
            day.isToday && styles.todayDayCell,
            hasCruise && styles.cruiseDayCell,
          ]}
          testID={`luck-day-${day.key}`}
        >
          <View style={styles.dayCellHeader}>
            <Text
              style={[
                styles.dayNumber,
                { color: day.inCurrentMonth ? textColor : 'rgba(255,255,255,0.45)' },
                day.isToday && styles.todayDayNumber,
              ]}
            >
              {day.dayNumber}
            </Text>
            {day.inCurrentMonth && day.luck ? (
              <View style={[styles.scorePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[styles.scorePillText, { color: textColor }]}>{day.luck.score}</Text>
              </View>
            ) : null}
          </View>

          {day.inCurrentMonth && day.luck ? (
            <Text style={[styles.dayLuckLabel, { color: textColor }]} numberOfLines={1}>
              {day.luck.label}
            </Text>
          ) : (
            <Text style={styles.dayLuckLabelMuted} numberOfLines={1}>
              {day.inCurrentMonth ? 'No score' : ''}
            </Text>
          )}

          <View style={styles.dayFooter}>
            {hasEvents ? (
              <>
                <View style={styles.eventDotsRow}>
                  {day.counts.cruise > 0 ? <View style={[styles.eventDot, styles.cruiseDot]} /> : null}
                  {day.counts.travel > 0 ? <View style={[styles.eventDot, styles.travelDot]} /> : null}
                  {day.counts.personal > 0 ? <View style={[styles.eventDot, styles.personalDot]} /> : null}
                </View>
                <View style={[styles.dayEventBadge, hasCruise ? styles.dayEventBadgeCruise : styles.dayEventBadgeNeutral]}>
                  {hasCruise ? <Ship size={10} color={COLORS.white} /> : null}
                  <Text style={[styles.dayEventBadgeText, hasCruise ? styles.dayEventBadgeTextCruise : styles.dayEventBadgeTextNeutral]} numberOfLines={1}>
                    {hasCruise
                      ? `${day.counts.cruise} cruise${day.counts.cruise === 1 ? '' : 's'}`
                      : `${day.counts.total} item${day.counts.total === 1 ? '' : 's'}`}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handleDayPress],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          testID="calendar-scroll"
        >
          <LinearGradient colors={HERO_COLORS} style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Image source={{ uri: IMAGES.logo }} style={styles.heroLogo} resizeMode="contain" />
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle}>Easy Seas™ Calendar</Text>
                <Text style={styles.heroSubtitle}>Offers-tab styling with Earth Rooster daily luck colors</Text>
              </View>
            </View>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Sparkles size={14} color={COLORS.goldLight} />
                <Text style={styles.heroBadgeText}>{clubRoyaleTier}</Text>
              </View>
              <View style={styles.heroBadge}>
                <CalendarDays size={14} color={COLORS.skyBlue} />
                <Text style={styles.heroBadgeText}>{crownAnchorLevel}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Clock4 size={14} color={COLORS.seafoam} />
                <Text style={styles.heroBadgeText}>{isLoading ? 'Syncing' : 'Live'}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.modeRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setMode('month')}
              style={[styles.modeButton, mode === 'month' && styles.modeButtonActive]}
              testID="calendar-mode-month"
            >
              <Text style={[styles.modeButtonText, mode === 'month' && styles.modeButtonTextActive]}>Month</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setMode('agenda')}
              style={[styles.modeButton, mode === 'agenda' && styles.modeButtonActive]}
              testID="calendar-mode-agenda"
            >
              <Text style={[styles.modeButtonText, mode === 'agenda' && styles.modeButtonTextActive]}>Agenda</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Best days</Text>
              <Text style={styles.summaryValue}>{monthLuckSummary.bestDays}</Text>
              <Text style={styles.summaryCaption}>Score 6 or 7</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Average</Text>
              <Text style={styles.summaryValue}>{monthLuckSummary.averageScore.toFixed(1)}</Text>
              <Text style={styles.summaryCaption}>Monthly score</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Caution days</Text>
              <Text style={styles.summaryValue}>{monthLuckSummary.cautionDays}</Text>
              <Text style={styles.summaryCaption}>Score 1 or 2</Text>
            </View>
          </View>

          {mode === 'month' ? (
            <View style={styles.contentCard} testID="calendar-month-card">
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => navigateMonth('previous')}
                  style={styles.iconButton}
                  testID="calendar-prev-month"
                >
                  <ChevronLeft size={20} color={COLORS.navyDeep} />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.82} onPress={goToToday} style={styles.calendarHeaderCenter}>
                  <Text style={styles.monthTitle}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.monthSubtitle}>Tap here to return to today</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => navigateMonth('next')}
                  style={styles.iconButton}
                  testID="calendar-next-month"
                >
                  <ChevronRight size={20} color={COLORS.navyDeep} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              {calendarWeeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.weekRow}>
                  {week.map((day) => renderDayCell(day))}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.contentCard} testID="calendar-agenda-card">
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <CalendarDays size={18} color={COLORS.navyDeep} />
                  <Text style={styles.sectionTitle}>Upcoming agenda</Text>
                </View>
                <Text style={styles.sectionMeta}>{upcomingEvents.length} items</Text>
              </View>

              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => {
                  const dateKey = formatDateKey(event.startDate);
                  const dayLuck = getLuckForDate(dateKey);
                  const accentColor = dayLuck?.hex ?? COLORS.navyDeep;
                  const eventIcon = event.category === 'cruise' ? Ship : event.category === 'travel' ? Plane : User;
                  const EventIcon = eventIcon;

                  return (
                    <TouchableOpacity
                      key={event.id}
                      activeOpacity={0.86}
                      onPress={() =>
                        router.push({
                          pathname: '/day-agenda' as any,
                          params: { date: dateKey },
                        })
                      }
                      style={styles.agendaItem}
                      testID={`agenda-item-${event.id}`}
                    >
                      <View style={[styles.agendaAccent, { backgroundColor: accentColor }]} />
                      <View style={styles.agendaIconWrap}>
                        <EventIcon size={18} color={accentColor} />
                      </View>
                      <View style={styles.agendaTextWrap}>
                        <Text style={styles.agendaTitle}>{event.title}</Text>
                        <Text style={styles.agendaMeta}>
                          {formatDate(event.startDate, 'long')}
                        </Text>
                        <Text style={styles.agendaMeta}>
                          {event.location ?? event.shipName ?? 'Tap for day details'}
                        </Text>
                      </View>
                      {dayLuck ? (
                        <View style={[styles.agendaLuckBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}45` }]}>
                          <Text style={[styles.agendaLuckScore, { color: accentColor }]}>{dayLuck.score}</Text>
                          <Text style={[styles.agendaLuckText, { color: accentColor }]}>{dayLuck.label}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <CalendarDays size={26} color={COLORS.textSecondary} />
                  <Text style={styles.emptyTitle}>No upcoming events yet</Text>
                  <Text style={styles.emptyText}>Imported calendar items and booked cruises will appear here.</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.contentCard} testID="calendar-luck-legend">
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={18} color={COLORS.goldDark} />
                <Text style={styles.sectionTitle}>Earth Rooster luck scale</Text>
              </View>
              <Text style={styles.sectionMeta}>Daily scores are always visible</Text>
            </View>

            <View style={styles.luckLegendGrid}>
              {LUCK_ORDER.map((luckColor) => {
                const info = LUCK_SCALE[luckColor];
                const textColor = getLuckTextColor(info);
                return (
                  <View key={luckColor} style={[styles.luckLegendItem, { backgroundColor: info.hex }]}>
                    <Text style={[styles.luckLegendScore, { color: textColor }]}>{info.score}</Text>
                    <Text style={[styles.luckLegendName, { color: textColor }]}>{info.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.eventLegendRow}>
              <View style={styles.eventLegendItem}>
                <View style={[styles.eventDot, styles.cruiseDot]} />
                <Text style={styles.eventLegendText}>Cruise</Text>
              </View>
              <View style={styles.eventLegendItem}>
                <View style={[styles.eventDot, styles.travelDot]} />
                <Text style={styles.eventLegendText}>Travel</Text>
              </View>
              <View style={styles.eventLegendItem}>
                <View style={[styles.eventDot, styles.personalDot]} />
                <Text style={styles.eventLegendText}>Personal</Text>
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
    backgroundColor: '#0A1628',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 140,
  },
  heroCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...SHADOW.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLogo: {
    width: 68,
    height: 68,
    marginRight: SPACING.md,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(255,255,255,0.94)',
  },
  modeButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  modeButtonTextActive: {
    color: COLORS.navyDeep,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: CARD_SURFACE,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.sm,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    marginTop: 8,
  },
  summaryCaption: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  contentCard: {
    backgroundColor: CARD_SURFACE,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INNER_SURFACE,
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  calendarHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  monthSubtitle: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayCell: {
    flex: 1,
    minHeight: 84,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: 2,
    paddingHorizontal: 6,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  todayDayCell: {
    borderWidth: 3,
    borderColor: COLORS.goldDark,
  },
  cruiseDayCell: {
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  dayCellHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dayNumber: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
  },
  todayDayNumber: {
    textDecorationLine: 'underline',
  },
  scorePill: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
  },
  scorePillText: {
    fontSize: 10,
    fontWeight: '800' as const,
  },
  dayLuckLabel: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  dayLuckLabelMuted: {
    marginTop: 8,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
  },
  dayFooter: {
    minHeight: 28,
    justifyContent: 'flex-end',
  },
  eventDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cruiseDot: {
    backgroundColor: '#059669',
  },
  travelDot: {
    backgroundColor: '#2563EB',
  },
  personalDot: {
    backgroundColor: '#7C3AED',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  sectionMeta: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: INNER_SURFACE,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  agendaAccent: {
    width: 5,
    alignSelf: 'stretch',
  },
  agendaIconWrap: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaTextWrap: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  agendaTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  agendaMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  agendaLuckBadge: {
    marginRight: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  agendaLuckScore: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
  },
  agendaLuckText: {
    fontSize: 10,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  emptyText: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  luckLegendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  luckLegendItem: {
    width: '31%',
    minWidth: 92,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  luckLegendScore: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '800' as const,
  },
  luckLegendName: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  eventLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: INNER_BORDER,
  },
  eventLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventLegendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: '700' as const,
  },
  dayEventBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  dayEventBadgeCruise: {
    backgroundColor: 'rgba(5, 150, 105, 0.88)',
  },
  dayEventBadgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dayEventBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
  },
  dayEventBadgeTextCruise: {
    color: COLORS.white,
  },
  dayEventBadgeTextNeutral: {
    color: COLORS.navyDeep,
  },
});
