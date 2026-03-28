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

const HERO_COLORS = ['#081626', '#123155', '#224975'] as const;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const LUCK_ORDER = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'] as const satisfies readonly LuckColor[];
const CARD_SURFACE = 'rgba(244, 248, 255, 0.97)';
const CARD_BORDER = 'rgba(111, 167, 230, 0.28)';
const INNER_SURFACE = 'rgba(10, 28, 52, 0.06)';
const INNER_BORDER = 'rgba(12, 37, 66, 0.1)';
const MUTED_DAY_GRADIENT = ['#DFE7F1', '#F2F6FA'] as const;
const DEFAULT_DAY_GRADIENT = ['#EEF4FF', '#DCEBFF'] as const;

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

function getEventCategory(type: CalendarEvent['type'] | 'bookedCruise' | 'availableCruise'): TimelineCategory {
  if (type === 'bookedCruise') {
    return 'bookedCruise';
  }

  if (type === 'availableCruise') {
    return 'availableCruise';
  }

  if (type === 'cruise') {
    return 'bookedCruise';
  }

  if (type === 'travel' || type === 'flight' || type === 'hotel') {
    return 'travel';
  }

  return 'personal';
}

function getEmptyCounts(): EventCounts {
  return {
    bookedCruise: 0,
    availableCruise: 0,
    travel: 0,
    personal: 0,
    total: 0,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitizedHex = hex.replace('#', '');
  const normalizedHex = sanitizedHex.length === 3
    ? sanitizedHex
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : sanitizedHex;

  const red = parseInt(normalizedHex.slice(0, 2), 16);
  const green = parseInt(normalizedHex.slice(2, 4), 16);
  const blue = parseInt(normalizedHex.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(30, 58, 95, ${alpha})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getLuckTextColor(luck: LuckInfo | null, inCurrentMonth: boolean): string {
  if (!inCurrentMonth) {
    return '#8CA0B8';
  }

  if (!luck) {
    return COLORS.navyDeep;
  }

  if (luck.color === 'Yellow' || luck.color === 'Orange') {
    return '#102544';
  }

  return COLORS.white;
}

function getDayGradientColors(day: CalendarDay): [string, string] {
  if (!day.inCurrentMonth) {
    return [...MUTED_DAY_GRADIENT];
  }

  if (!day.luck) {
    return [...DEFAULT_DAY_GRADIENT];
  }

  return [
    hexToRgba(day.luck.hex, 0.96),
    hexToRgba(day.luck.hex, 0.78),
  ];
}

function getDayBorderColor(day: CalendarDay): string {
  if (day.counts.bookedCruise > 0) {
    return '#F59E0B';
  }

  if (day.counts.availableCruise > 0) {
    return '#38BDF8';
  }

  if (day.luck) {
    return hexToRgba(day.luck.hex, 0.9);
  }

  return 'rgba(111, 167, 230, 0.24)';
}

function buildDateKeysInRange(startDate: Date, endDate: Date): string[] {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const orderedStart = start.getTime() <= end.getTime() ? start : end;
  const orderedEnd = start.getTime() <= end.getTime() ? end : start;
  const keys: string[] = [];
  const span = Math.min(180, Math.max(0, Math.round((orderedEnd.getTime() - orderedStart.getTime()) / 86400000)));

  for (let index = 0; index <= span; index += 1) {
    keys.push(formatDateKey(addDays(orderedStart, index)));
  }

  return keys;
}

function getAgendaAccentColor(category: TimelineCategory, luck: LuckInfo | null): string {
  if (category === 'bookedCruise') {
    return '#F59E0B';
  }

  if (category === 'availableCruise') {
    return '#0EA5E9';
  }

  if (luck?.hex) {
    return luck.hex;
  }

  return COLORS.navyDeep;
}

export default function EventsScreen() {
  const router = useRouter();
  const { cruises, calendarEvents, bookedCruises, isLoading } = useCoreData();
  const { clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(normalizeDate(new Date()));

  useEffect(() => {
    console.log('[EventsScreen] Mounted with data', {
      cruises: cruises.length,
      calendarEvents: calendarEvents.length,
      bookedCruises: bookedCruises.length,
      mode,
    });
  }, [bookedCruises.length, calendarEvents.length, cruises.length, mode]);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    const bookedCruiseIds = new Set<string>(bookedCruises.map((cruise: BookedCruise) => cruise.id));

    const importedEvents = calendarEvents.map((event: CalendarEvent): TimelineEvent => {
      const startDate = createDateFromString(event.startDate || event.start || '');
      const fallbackEndDate = event.endDate || event.end || event.startDate || event.start || '';
      const endDate = createDateFromString(fallbackEndDate);

      return {
        id: `calendar-${event.id}`,
        title: event.title || 'Untitled event',
        category: getEventCategory(event.type),
        startDate,
        endDate,
        location: event.location,
      };
    });

    const bookedCruiseEvents = bookedCruises
      .filter((cruise: BookedCruise) => Boolean(cruise.sailDate))
      .map((cruise: BookedCruise): TimelineEvent => {
        const startDate = createDateFromString(cruise.sailDate);
        const endDate = cruise.returnDate
          ? createDateFromString(cruise.returnDate)
          : addDays(startDate, Math.max(0, (cruise.nights || 1) - 1));

        return {
          id: `booked-${cruise.id}`,
          title: cruise.shipName || 'Booked cruise',
          category: 'bookedCruise',
          startDate,
          endDate,
          location: cruise.destination || cruise.itineraryName || cruise.departurePort,
          shipName: cruise.shipName,
        };
      });

    const availableCruiseEvents = cruises
      .filter((cruise: Cruise) => {
        if (!cruise.sailDate) {
          return false;
        }

        if (bookedCruiseIds.has(cruise.id)) {
          return false;
        }

        if (cruise.status === 'booked' || cruise.status === 'completed') {
          return false;
        }

        return true;
      })
      .map((cruise: Cruise): TimelineEvent => {
        const startDate = createDateFromString(cruise.sailDate);
        const endDate = cruise.returnDate
          ? createDateFromString(cruise.returnDate)
          : addDays(startDate, Math.max(0, (cruise.nights || 1) - 1));

        return {
          id: `available-${cruise.id}`,
          title: cruise.shipName || 'Available cruise',
          category: 'availableCruise',
          startDate,
          endDate,
          location: cruise.destination || cruise.itineraryName || cruise.departurePort,
          shipName: cruise.shipName,
        };
      });

    const sortedEvents = [...importedEvents, ...bookedCruiseEvents, ...availableCruiseEvents].sort(
      (left, right) => left.startDate.getTime() - right.startDate.getTime(),
    );

    console.log('[EventsScreen] Timeline events prepared', {
      count: sortedEvents.length,
      bookedCruises: bookedCruiseEvents.length,
      availableCruises: availableCruiseEvents.length,
      importedEvents: importedEvents.length,
    });

    return sortedEvents;
  }, [bookedCruises, calendarEvents, cruises]);

  const eventCountsByDate = useMemo(() => {
    const countsMap = new Map<string, EventCounts>();

    timelineEvents.forEach((event: TimelineEvent) => {
      const dateKeys = buildDateKeysInRange(event.startDate, event.endDate);
      dateKeys.forEach((dateKey) => {
        const currentCounts = countsMap.get(dateKey) ?? getEmptyCounts();
        currentCounts[event.category] = currentCounts[event.category] + 1;
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

  const monthSummary = useMemo(() => {
    let bestDays = 0;
    let cautionDays = 0;
    let scoredDays = 0;
    let totalScore = 0;
    let bookedCruiseDays = 0;
    let availableCruiseDays = 0;

    calendarWeeks.flat().forEach((day: CalendarDay) => {
      if (!day.inCurrentMonth) {
        return;
      }

      if (day.luck) {
        scoredDays += 1;
        totalScore += day.luck.score;

        if (day.luck.score >= 6) {
          bestDays += 1;
        }

        if (day.luck.score <= 2) {
          cautionDays += 1;
        }
      }

      if (day.counts.bookedCruise > 0) {
        bookedCruiseDays += 1;
      }

      if (day.counts.availableCruise > 0) {
        availableCruiseDays += 1;
      }
    });

    const averageScore = scoredDays > 0 ? totalScore / scoredDays : 0;

    console.log('[EventsScreen] Month summary ready', {
      bestDays,
      cautionDays,
      averageScore,
      bookedCruiseDays,
      availableCruiseDays,
    });

    return {
      bestDays,
      cautionDays,
      averageScore,
      bookedCruiseDays,
      availableCruiseDays,
    };
  }, [calendarWeeks]);

  const upcomingEvents = useMemo((): TimelineEvent[] => {
    const today = normalizeDate(new Date());
    const list = timelineEvents
      .filter((event: TimelineEvent) => normalizeDate(event.endDate).getTime() >= today.getTime())
      .slice(0, 14);

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
        bookedCruises: day.counts.bookedCruise,
        availableCruises: day.counts.availableCruise,
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
      const textColor = getLuckTextColor(day.luck, day.inCurrentMonth);
      const subtitleColor = day.inCurrentMonth ? hexToRgba(textColor, textColor === COLORS.white ? 0.84 : 0.7) : '#8CA0B8';
      const gradientColors = getDayGradientColors(day);
      const dayBorderColor = getDayBorderColor(day);
      const hasBookedCruise = day.counts.bookedCruise > 0;
      const hasAvailableCruise = day.counts.availableCruise > 0;
      const hasTravel = day.counts.travel > 0;
      const hasPersonal = day.counts.personal > 0;
      const hasAnyEvent = day.counts.total > 0;

      return (
        <TouchableOpacity
          key={day.key}
          activeOpacity={0.88}
          onPress={() => handleDayPress(day)}
          style={[
            styles.dayCell,
            { borderColor: dayBorderColor },
            day.isToday && styles.todayDayCell,
            !day.inCurrentMonth && styles.dayCellMuted,
          ]}
          testID={`luck-day-${day.key}`}
        >
          <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dayCellGradient}>
            <View style={styles.dayCellHeader}>
              <Text style={[styles.dayNumber, { color: textColor }, day.isToday && styles.todayDayNumber]}>
                {day.dayNumber}
              </Text>
              {day.inCurrentMonth && day.luck ? (
                <View style={[styles.scorePill, { backgroundColor: textColor === COLORS.white ? 'rgba(255,255,255,0.18)' : 'rgba(10,22,38,0.12)' }]}>
                  <Text style={[styles.scorePillText, { color: textColor }]}>{day.luck.score}</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.dayLuckLabel, { color: subtitleColor }]} numberOfLines={1}>
              {day.inCurrentMonth ? day.luck?.label ?? 'Luck pending' : 'Outside month'}
            </Text>

            <View style={styles.dayFooter}>
              <View style={styles.dayDotRow}>
                {hasTravel ? <View style={[styles.eventDot, styles.travelDot]} /> : null}
                {hasPersonal ? <View style={[styles.eventDot, styles.personalDot]} /> : null}
                {hasBookedCruise ? <View style={[styles.eventDot, styles.bookedDot]} /> : null}
                {hasAvailableCruise ? <View style={[styles.eventDot, styles.availableDot]} /> : null}
              </View>
              <View style={styles.dayBadgeRow}>
                {hasBookedCruise ? (
                  <View style={[styles.dayBadge, styles.dayBadgeBooked]}>
                    <Text style={styles.dayBadgeTextBooked} numberOfLines={1}>
                      {`Booked ${day.counts.bookedCruise}`}
                    </Text>
                  </View>
                ) : null}
                {hasAvailableCruise ? (
                  <View style={[styles.dayBadge, styles.dayBadgeAvailable]}>
                    <Text style={styles.dayBadgeTextAvailable} numberOfLines={1}>
                      {`Cruise ${day.counts.availableCruise}`}
                    </Text>
                  </View>
                ) : null}
                {!hasBookedCruise && !hasAvailableCruise && hasAnyEvent ? (
                  <View style={[styles.dayBadge, styles.dayBadgeNeutral]}>
                    <Text style={styles.dayBadgeTextNeutral} numberOfLines={1}>
                      {`${day.counts.total} item${day.counts.total === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                ) : null}
              </View>
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
                <Text style={styles.heroSubtitle}>Booked cruises, offer sailings, imported events, and Earth Rooster luck now share the same premium offers theme.</Text>
              </View>
            </View>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Sparkles size={14} color={COLORS.goldLight} />
                <Text style={styles.heroBadgeText}>{clubRoyaleTier}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ship size={14} color={COLORS.skyBlue} />
                <Text style={styles.heroBadgeText}>{`${bookedCruises.length} booked`}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Clock4 size={14} color={COLORS.seafoam} />
                <Text style={styles.heroBadgeText}>{isLoading ? 'Syncing' : crownAnchorLevel}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.modeRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setMode('month')}
              style={[styles.modeButton, mode === 'month' && styles.modeButtonActive]}
              testID="calendar-mode-month"
            >
              <Text style={[styles.modeButtonText, mode === 'month' && styles.modeButtonTextActive]}>Month</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setMode('agenda')}
              style={[styles.modeButton, mode === 'agenda' && styles.modeButtonActive]}
              testID="calendar-mode-agenda"
            >
              <Text style={[styles.modeButtonText, mode === 'agenda' && styles.modeButtonTextActive]}>Agenda</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Best luck</Text>
              <Text style={styles.summaryValue}>{monthSummary.bestDays}</Text>
              <Text style={styles.summaryCaption}>Days scoring 6-7</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Booked days</Text>
              <Text style={styles.summaryValue}>{monthSummary.bookedCruiseDays}</Text>
              <Text style={styles.summaryCaption}>Cruises on calendar</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Offer days</Text>
              <Text style={styles.summaryValue}>{monthSummary.availableCruiseDays}</Text>
              <Text style={styles.summaryCaption}>Available sailings</Text>
            </View>
          </View>

          {mode === 'month' ? (
            <View style={styles.contentCard} testID="calendar-month-card">
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  activeOpacity={0.84}
                  onPress={() => navigateMonth('previous')}
                  style={styles.iconButton}
                  testID="calendar-prev-month"
                >
                  <ChevronLeft size={20} color={COLORS.navyDeep} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.84} onPress={goToToday} style={styles.calendarHeaderCenter}>
                  <Text style={styles.monthTitle}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.monthSubtitle}>Tap to jump back to today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.84}
                  onPress={() => navigateMonth('next')}
                  style={styles.iconButton}
                  testID="calendar-next-month"
                >
                  <ChevronRight size={20} color={COLORS.navyDeep} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label: string) => (
                  <Text key={label} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              {calendarWeeks.map((week: CalendarDay[], weekIndex: number) => (
                <View key={`week-${weekIndex}`} style={styles.weekRow}>
                  {week.map((day: CalendarDay) => renderDayCell(day))}
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
                <Text style={styles.sectionMeta}>{`${upcomingEvents.length} items`}</Text>
              </View>

              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event: TimelineEvent) => {
                  const dateKey = formatDateKey(event.startDate);
                  const dayLuck = getLuckForDate(dateKey);
                  const accentColor = getAgendaAccentColor(event.category, dayLuck);
                  const EventIcon = event.category === 'travel' ? Plane : event.category === 'personal' ? User : Ship;
                  const badgeLabel = event.category === 'bookedCruise'
                    ? 'BOOKED'
                    : event.category === 'availableCruise'
                      ? 'CRUISE'
                      : event.category === 'travel'
                        ? 'TRAVEL'
                        : 'PERSONAL';

                  return (
                    <TouchableOpacity
                      key={event.id}
                      activeOpacity={0.88}
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
                      <View style={[styles.agendaIconWrap, { backgroundColor: hexToRgba(accentColor, 0.12) }]}>
                        <EventIcon size={18} color={accentColor} />
                      </View>
                      <View style={styles.agendaTextWrap}>
                        <View style={styles.agendaTitleRow}>
                          <Text style={styles.agendaTitle}>{event.title}</Text>
                          <View style={[styles.agendaCategoryBadge, { backgroundColor: hexToRgba(accentColor, 0.12), borderColor: hexToRgba(accentColor, 0.24) }]}>
                            <Text style={[styles.agendaCategoryText, { color: accentColor }]}>{badgeLabel}</Text>
                          </View>
                        </View>
                        <Text style={styles.agendaMeta}>{formatDate(event.startDate, 'long')}</Text>
                        <Text style={styles.agendaMeta}>{event.location ?? event.shipName ?? 'Tap for day details'}</Text>
                      </View>
                      {dayLuck ? (
                        <View style={[styles.agendaLuckBadge, { backgroundColor: hexToRgba(dayLuck.hex, 0.12), borderColor: hexToRgba(dayLuck.hex, 0.22) }]}>
                          <Text style={[styles.agendaLuckScore, { color: dayLuck.hex }]}>{dayLuck.score}</Text>
                          <Text style={[styles.agendaLuckText, { color: dayLuck.hex }]}>{dayLuck.label}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <CalendarDays size={26} color={COLORS.textSecondary} />
                  <Text style={styles.emptyTitle}>No upcoming items yet</Text>
                  <Text style={styles.emptyText}>Booked cruises, imported events, and offer sailings will appear here.</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.contentCard} testID="calendar-luck-legend">
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={18} color={COLORS.goldDark} />
                <Text style={styles.sectionTitle}>Luck + cruise legend</Text>
              </View>
              <Text style={styles.sectionMeta}>Every day shows luck plus cruise presence</Text>
            </View>

            <View style={styles.luckLegendGrid}>
              {LUCK_ORDER.map((luckColor: LuckColor) => {
                const info = LUCK_SCALE[luckColor];
                const textColor = getLuckTextColor(info, true);
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
                <View style={[styles.eventDot, styles.bookedDot]} />
                <Text style={styles.eventLegendText}>Booked cruise</Text>
              </View>
              <View style={styles.eventLegendItem}>
                <View style={[styles.eventDot, styles.availableDot]} />
                <Text style={styles.eventLegendText}>Available cruise</Text>
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
    backgroundColor: '#071221',
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(255,255,255,0.96)',
  },
  modeButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.72)',
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
    borderRadius: BORDER_RADIUS.xl,
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
    marginTop: 8,
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
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
    minHeight: 98,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: 2,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  dayCellGradient: {
    flex: 1,
    paddingHorizontal: 7,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  dayCellMuted: {
    opacity: 0.65,
  },
  todayDayCell: {
    borderWidth: 2.5,
    borderColor: COLORS.goldDark,
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
    minWidth: 24,
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
  dayFooter: {
    minHeight: 30,
    justifyContent: 'flex-end',
  },
  dayDotRow: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 8,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  bookedDot: {
    backgroundColor: '#F59E0B',
  },
  availableDot: {
    backgroundColor: '#0EA5E9',
  },
  travelDot: {
    backgroundColor: '#2563EB',
  },
  personalDot: {
    backgroundColor: '#7C3AED',
  },
  dayBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  dayBadge: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  dayBadgeBooked: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  dayBadgeAvailable: {
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
  },
  dayBadgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dayBadgeTextBooked: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#5F3700',
  },
  dayBadgeTextAvailable: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#0C4A6E',
  },
  dayBadgeTextNeutral: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.sm,
  },
  agendaTextWrap: {
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
  agendaTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  agendaCategoryBadge: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  agendaCategoryText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
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
    flexWrap: 'wrap',
    gap: SPACING.md,
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
});
