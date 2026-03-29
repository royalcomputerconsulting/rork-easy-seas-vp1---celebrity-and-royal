import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, ChevronRight, Ship, Plane, User, Plus, AlertTriangle, Ban } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, DS } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useUser } from '@/state/UserProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { CruiseCard } from '@/components/CruiseCard';
import type { CalendarEvent, BookedCruise } from '@/types/models';
import { getLuckForDate, type LuckInfo } from '@/constants/luckScores';
import { getPersonalizedLuckForDate } from '@/lib/luckCalculator';
import { createDateFromString } from '@/lib/date';
import { CrewRecognitionSection } from '@/components/crew-recognition/CrewRecognitionSection';
import { TimeZoneConverter } from '@/components/TimeZoneConverter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ViewMode = 'events' | 'week' | 'month' | '90days';
type UpcomingDisplayFilter = 'all' | '3' | '10';

interface PersonalizedLuck {
  score: number;
  hex: string;
  label: string;
  color: string;
}

interface DayData {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: {
    cruise: number;
    travel: number;
    personal: number;
  };
  luck: LuckInfo | null;
  personalizedLuck: PersonalizedLuck | null;
}

const LUCK_COLORS: Record<number, string> = {
  1: '#DC2626',
  2: '#EA580C',
  3: '#B45309',
  4: '#CA8A04',
  5: '#4D7C0F',
  6: '#16A34A',
  7: '#2563EB',
  8: '#4F46E5',
  9: '#7C3AED',
};

const EVENT_COLORS = {
  cruise: '#22C55E',
  travel: '#3B82F6', 
  personal: '#A855F7',
};

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(rawDate: string | null | undefined): string | null {
  if (!rawDate) {
    return null;
  }

  const parsed = createDateFromString(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return formatDateKey(parsed);
}

function overlapsMonthRange(startDate: Date, endDate: Date, year: number, month: number): boolean {
  const monthStart = new Date(year, month, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  return startDate <= monthEnd && endDate >= monthStart;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getCruiseMergeKey(cruise: BookedCruise): string {
  return cruise.id || `${cruise.shipName ?? 'ship'}-${cruise.sailDate ?? 'sail'}-${cruise.returnDate ?? 'return'}`;
}

function getCruiseCompletenessScore(cruise: BookedCruise): number {
  let score = 0;
  if (cruise.sailDate) score += 4;
  if (cruise.returnDate) score += 8;
  if ((cruise.nights ?? 0) > 0) score += 3;
  if (cruise.destination) score += 2;
  if (cruise.itineraryName) score += 2;
  if (cruise.departurePort) score += 2;
  if ((cruise.ports?.length ?? 0) > 0) score += 2;
  if ((cruise.guestNames?.length ?? 0) > 0) score += 1;
  return score;
}

function mergeBookedCruiseRecords(primary: BookedCruise, candidate: BookedCruise): BookedCruise {
  const candidateWins = getCruiseCompletenessScore(candidate) >= getCruiseCompletenessScore(primary);
  const preferred = candidateWins ? candidate : primary;
  const fallback = candidateWins ? primary : candidate;

  return {
    ...fallback,
    ...preferred,
    sailDate: preferred.sailDate || fallback.sailDate,
    returnDate: preferred.returnDate || fallback.returnDate,
    destination: preferred.destination || fallback.destination,
    itineraryName: preferred.itineraryName || fallback.itineraryName,
    departurePort: preferred.departurePort || fallback.departurePort,
    cabinType: preferred.cabinType || fallback.cabinType,
    cabinNumber: preferred.cabinNumber || fallback.cabinNumber,
    nights: preferred.nights || fallback.nights,
    ports: (preferred.ports?.length ?? 0) > 0 ? preferred.ports : fallback.ports,
    guestNames: (preferred.guestNames?.length ?? 0) > 0 ? preferred.guestNames : fallback.guestNames,
  };
}

function getBookedCruiseDateRange(cruise: BookedCruise): { startDate: Date; endDate: Date } | null {
  if (!cruise.sailDate) {
    return null;
  }

  const startDate = createDateFromString(cruise.sailDate);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const explicitEndDate = cruise.returnDate ? createDateFromString(cruise.returnDate) : null;
  const fallbackEndDate = addDays(startDate, Math.max(cruise.nights ?? 0, 0));
  const endDate = explicitEndDate && !Number.isNaN(explicitEndDate.getTime())
    ? explicitEndDate
    : fallbackEndDate;

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return {
    startDate,
    endDate: endDate >= startDate ? endDate : startDate,
  };
}

function getDerivedTravelDayKeys(cruise: BookedCruise): string[] {
  const range = getBookedCruiseDateRange(cruise);
  if (!range) {
    return [];
  }

  return [
    formatDateKey(addDays(range.startDate, -1)),
    formatDateKey(addDays(range.endDate, 1)),
  ];
}

const SPECIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'manual-barcelona-travel-2026',
    title: 'Travel to Barcelona',
    startDate: '2026-08-03',
    endDate: '2026-08-04',
    type: 'travel',
    sourceType: 'personal',
    location: 'Barcelona, Spain',
    source: 'manual',
  },
  {
    id: 'manual-celeb-equinox-2026',
    title: 'Celebrity Equinox Personal Cruise',
    startDate: '2026-08-05',
    endDate: '2026-08-15',
    type: 'cruise',
    sourceType: 'personal',
    location: 'Barcelona, Spain',
    source: 'manual',
  },
];

const UPCOMING_FILTER_OPTIONS: { value: UpcomingDisplayFilter; label: string }[] = [
  { value: 'all', label: 'All Upcoming' },
  { value: '3', label: '3 Upcoming' },
  { value: '10', label: '10 Upcoming' },
];

export default function EventsScreen() {
  const router = useRouter();
  const { localData } = useAppState();
  const { clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const { currentUser } = useUser();
  const coreData = useCoreData();
  const { bookedCruises: storedBookedCruises } = coreData;
  const birthdate = currentUser?.birthdate;
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [upcomingFilter, setUpcomingFilter] = useState<UpcomingDisplayFilter>('3');

  const calendarEvents = useMemo(() => {
    const events = [...(localData.calendar || []), ...(localData.tripit || []), ...SPECIAL_CALENDAR_EVENTS];
    console.log('[Events] Calendar events updated:', events.length);
    return events;
  }, [localData.calendar, localData.tripit]);

  const bookedCruises = useMemo(() => {
    const combined = [...(localData.booked || []), ...storedBookedCruises];
    const mergedCruises = new Map<string, BookedCruise>();

    combined.forEach((cruise) => {
      const key = getCruiseMergeKey(cruise);
      const existingCruise = mergedCruises.get(key);
      if (existingCruise) {
        mergedCruises.set(key, mergeBookedCruiseRecords(existingCruise, cruise));
        return;
      }
      mergedCruises.set(key, cruise);
    });

    return Array.from(mergedCruises.values());
  }, [localData.booked, storedBookedCruises]);

  useEffect(() => {
    console.log('[Events] Data changed - calendar:', calendarEvents.length, 'cruises:', bookedCruises.length);
    setRefreshKey(prev => prev + 1);
  }, [calendarEvents.length, bookedCruises.length]);

  const _eventCounts = useMemo(() => {
    let cruise = 0;
    let travel = 0;
    let personal = 0;
    const countedCruiseIds = new Set<string>();

    calendarEvents.forEach(event => {
      if (event.type === 'cruise' || (event as any).sourceType === 'cruise') {
        cruise++;
        if ((event as any).cruiseId) countedCruiseIds.add((event as any).cruiseId);
      } else if (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') {
        travel++;
      } else {
        personal++;
      }
    });

    bookedCruises.forEach((bc) => {
      if (!countedCruiseIds.has(bc.id)) {
        cruise++;
      }
    });

    return { cruise, travel, personal };
  }, [calendarEvents, bookedCruises]);

  const totalEventsThisMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    let count = 0;

    calendarEvents.forEach(event => {
      const eventStartRaw = event.startDate || event.start || '';
      const eventEndRaw = event.endDate || event.end || eventStartRaw;
      if (!eventStartRaw) {
        return;
      }

      const eventStart = createDateFromString(eventStartRaw);
      const eventEnd = createDateFromString(eventEndRaw || eventStartRaw);
      if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) {
        return;
      }

      if (overlapsMonthRange(eventStart, eventEnd, year, month)) {
        count++;
      }
    });

    bookedCruises.forEach((bc: BookedCruise) => {
      if (!bc.sailDate) {
        return;
      }

      const range = getBookedCruiseDateRange(bc);
      if (!range) {
        return;
      }

      if (overlapsMonthRange(range.startDate, range.endDate, year, month)) {
        count++;
      }
    });

    return count;
  }, [calendarEvents, bookedCruises, currentDate]);

  const _isDateInRange = useCallback((date: Date, startStr: string, endStr: string): boolean => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return targetDate >= start && targetDate <= end;
  }, []);

  const getEventsForDate = useCallback((date: Date): { cruise: number; travel: number; personal: number } => {
    let cruise = 0;
    let travel = 0;
    let personal = 0;
    const dateStr = formatDateKey(date);

    calendarEvents.forEach(event => {
      const eventStart = event.startDate || event.start || '';
      const eventEnd = event.endDate || event.end || eventStart;

      if (!eventStart) {
        return;
      }

      const startDate = normalizeDateKey(eventStart);
      const endDate = normalizeDateKey(eventEnd || eventStart);

      if (!startDate || !endDate) {
        return;
      }

      if (dateStr >= startDate && dateStr <= endDate) {
        if (event.type === 'cruise' || (event as any).sourceType === 'cruise') {
          cruise++;
        } else if (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') {
          travel++;
        } else {
          personal++;
        }
      }
    });

    bookedCruises.forEach((bc: BookedCruise) => {
      const range = getBookedCruiseDateRange(bc);
      if (!range) {
        return;
      }

      const startDate = formatDateKey(range.startDate);
      const endDate = formatDateKey(range.endDate);
      if (dateStr >= startDate && dateStr <= endDate) {
        cruise++;
      }

      if (getDerivedTravelDayKeys(bc).includes(dateStr)) {
        travel++;
      }
    });

    return { cruise, travel, personal };
  }, [calendarEvents, bookedCruises]);

  const calendarDays = useMemo((): DayData[][] => {
    console.log('[Events] Recalculating calendar days, refreshKey:', refreshKey);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];
    
    for (let i = 0; i < startOffset; i++) {
      const prevMonthDay = new Date(year, month, -startOffset + i + 1);
      currentWeek.push({
        date: prevMonthDay,
        dayNumber: prevMonthDay.getDate(),
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(prevMonthDay),
        luck: null,
        personalizedLuck: null,
      });
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isToday = date.getTime() === today.getTime();
      
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      currentWeek.push({
        date,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(date),
        luck: getLuckForDate(dateKey),
        personalizedLuck: birthdate ? getPersonalizedLuckForDate(birthdate, dateKey) : null,
      });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    if (currentWeek.length > 0) {
      let nextMonthDay = 1;
      while (currentWeek.length < 7) {
        const nextDate = new Date(year, month + 1, nextMonthDay);
        currentWeek.push({
          date: nextDate,
          dayNumber: nextMonthDay,
          isCurrentMonth: false,
          isToday: false,
          events: getEventsForDate(nextDate),
          luck: null,
          personalizedLuck: null,
        });
        nextMonthDay++;
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  }, [currentDate, getEventsForDate, refreshKey, birthdate]);

  const weekDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const dk = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(date),
        luck: getLuckForDate(dk),
        personalizedLuck: birthdate ? getPersonalizedLuckForDate(birthdate, dk) : null,
      });
    }
    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEventsForDate, refreshKey, birthdate]);

  const next90Days = useMemo(() => {
    const today = new Date();
    const days: DayData[] = [];
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const isToday = i === 0;
      const dk2 = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(date),
        luck: getLuckForDate(dk2),
        personalizedLuck: birthdate ? getPersonalizedLuckForDate(birthdate, dk2) : null,
      });
    }
    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEventsForDate, refreshKey, birthdate]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleClearEvents = useCallback(() => {
    Alert.alert(
      'Clear All Events',
      'Are you sure you want to clear all calendar events? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' as const },
        {
          text: 'Clear',
          style: 'destructive' as const,
          onPress: () => {
            console.log('[Events] Clearing all calendar events');
            coreData.setCalendarEvents([]);
            setRefreshKey(prev => prev + 1);
          },
        },
      ]
    );
  }, [coreData]);

  const formatMonthYear = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, []);

  const _renderEventDots = useCallback((events: { cruise: number; travel: number; personal: number }) => {
    const dots = [];
    if (events.cruise > 0) {
      dots.push(<View key="cruise" style={[styles.eventDot, { backgroundColor: EVENT_COLORS.cruise }]} />);
    }
    if (events.travel > 0) {
      dots.push(<View key="travel" style={[styles.eventDot, { backgroundColor: EVENT_COLORS.travel }]} />);
    }
    if (events.personal > 0) {
      dots.push(<View key="personal" style={[styles.eventDot, { backgroundColor: EVENT_COLORS.personal }]} />);
    }
    return dots;
  }, []);

  const handleDayPress = useCallback((day: DayData) => {
    const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
    router.push({
      pathname: '/day-agenda' as any,
      params: { date: dateStr },
    });
  }, [router]);

  const getDayBorderColor = useCallback((day: DayData): string => {
    if (!day.isCurrentMonth) return 'rgba(180,190,210,0.28)';
    if (day.isToday) return '#FCD34D';
    if (day.events.cruise > 0) return '#22C55E';
    if (day.events.travel > 0) return '#3B82F6';
    if (day.events.personal > 0) return '#A855F7';
    return 'rgba(180,190,210,0.35)';
  }, []);

  const getDayBorderWidth = useCallback((day: DayData): number => {
    if (!day.isCurrentMonth) return 1;
    if (day.isToday) return 2.5;
    if (day.events.cruise > 0 || day.events.travel > 0 || day.events.personal > 0) return 2.5;
    return 1;
  }, []);

  const renderDayCell = useCallback((day: DayData) => {
    const borderColor = getDayBorderColor(day);
    const borderWidth = getDayBorderWidth(day);
    const activeLuck = day.isCurrentMonth ? (day.personalizedLuck ?? day.luck) : null;
    const bgColor = day.isCurrentMonth ? '#FFFFFF' : 'rgba(250,250,250,0.68)';
    const dateColor = day.isCurrentMonth ? '#0A1628' : 'rgba(17,17,17,0.36)';
    const luckColor = activeLuck ? (LUCK_COLORS[activeLuck.score] ?? '#0A1628') : '#0A1628';

    return (
      <TouchableOpacity
        key={day.date.toISOString()}
        style={[
          styles.dayCell,
          { backgroundColor: bgColor, borderColor, borderWidth },
          !day.isCurrentMonth && styles.otherMonthCell,
        ]}
        activeOpacity={0.75}
        onPress={() => handleDayPress(day)}
      >
        <Text style={[styles.dayNumber, { color: dateColor }]}>
          {String(day.dayNumber)}
        </Text>
        {activeLuck ? (
          <View style={styles.luckScoreCenter}>
            <Text style={[styles.luckScoreText, { color: luckColor }]}>
              {String(activeLuck.score)}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [handleDayPress, getDayBorderColor, getDayBorderWidth]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allEvents: { event: CalendarEvent | BookedCruise; type: 'calendar' | 'cruise'; date: Date }[] = [];

    calendarEvents.forEach(event => {
      const startDate = createDateFromString(event.startDate || event.start || '');
      if (startDate >= today) {
        allEvents.push({ event, type: 'calendar', date: startDate });
      }
    });

    bookedCruises.forEach(cruise => {
      const range = getBookedCruiseDateRange(cruise);
      if (range && range.startDate >= today) {
        allEvents.push({ event: cruise, type: 'cruise', date: range.startDate });
      }
    });

    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarEvents, bookedCruises]);

  const displayedUpcomingEvents = useMemo(() => {
    if (upcomingFilter === 'all') {
      return upcomingEvents;
    }

    return upcomingEvents.slice(0, Number.parseInt(upcomingFilter, 10));
  }, [upcomingEvents, upcomingFilter]);

  const renderEventCard = useCallback((item: { event: CalendarEvent | BookedCruise; type: 'calendar' | 'cruise'; date: Date }, index: number) => {
    if (item.type === 'cruise') {
      const cruise = item.event as BookedCruise;
      return (
        <View key={`cruise-${cruise.id}-${index}`} testID="calendar-next-up-cruise-card">
          <CruiseCard
            cruise={cruise}
            onPress={() => router.push({
              pathname: '/(tabs)/(overview)/cruise-details' as any,
              params: { id: cruise.id },
            })}
            variant="booked"
            mini={true}
          />
        </View>
      );
    }
    
    const event = item.event as CalendarEvent;
    const eventColor = event.type === 'cruise' ? EVENT_COLORS.cruise 
      : (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') ? EVENT_COLORS.travel 
      : EVENT_COLORS.personal;
    const EventIcon = event.type === 'cruise' ? Ship 
      : (event.type === 'travel' || event.type === 'flight') ? Plane 
      : User;
    
    return (
      <TouchableOpacity 
        key={`event-${event.id}-${index}`}
        style={styles.eventCard}
        activeOpacity={0.85}
      >
        <View style={[styles.eventTypeIndicator, { backgroundColor: eventColor }]} />
        <View style={styles.eventCardContent}>
          <View style={styles.eventCardHeader}>
            <EventIcon size={16} color={eventColor} />
            <Text style={styles.eventCardType}>{event.type}</Text>
          </View>
          <Text style={styles.eventCardTitle}>{event.title}</Text>
          {!!event.location && (
            <Text style={styles.eventCardSubtitle}>{event.location}</Text>
          )}
          <Text style={styles.eventCardDate}>
            {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroContent}>
              <View style={styles.logoSection}>
                <Image 
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/m9jyogxgz1j0xb91psbkq' }}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.heroTextSection}>
                <Text style={styles.heroTitle}>Easy Seas™</Text>
                <Text style={styles.heroSubtitle}>Manage Your Nautical Lifestyle</Text>
                <View style={styles.tierBadgesRow}>
                  <TierBadgeGroup 
                    clubRoyaleTier={clubRoyaleTier}
                    crownAnchorLevel={crownAnchorLevel}
                    size="small"
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.viewToggleContainer}>
            {(['events', 'week', 'month', '90days'] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.viewToggleButton,
                  viewMode === mode && styles.viewToggleButtonActive,
                ]}
                onPress={() => setViewMode(mode)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.viewToggleText,
                  viewMode === mode && styles.viewToggleTextActive,
                ]}>
                  {mode === 'events' ? 'Events' : mode === 'week' ? 'Week' : mode === 'month' ? 'Month' : '90 Days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(viewMode === 'month' || viewMode === 'week') && (
            <View style={styles.monthNavigation}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigateMonth('prev')}
                activeOpacity={0.7}
              >
                <ChevronLeft size={24} color={DS.text.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.monthYearContainer}
                onPress={goToToday}
                activeOpacity={0.7}
              >
                <Text style={styles.monthYearText}>{formatMonthYear(currentDate)}</Text>
                <Text style={styles.eventCountText}>{totalEventsThisMonth} events • Tap to go to today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearEventsButton}
                onPress={handleClearEvents}
                activeOpacity={0.7}
                testID="clear-events-button"
              >
                <Ban size={18} color="#DC2626" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigateMonth('next')}
                activeOpacity={0.7}
              >
                <ChevronRight size={24} color={DS.text.primary} />
              </TouchableOpacity>
            </View>
          )}

          {totalEventsThisMonth > 10 && viewMode === 'month' && (
            <View style={styles.alertBadge}>
              <AlertTriangle size={14} color={COLORS.white} />
              <Text style={styles.alertBadgeText}>{totalEventsThisMonth}</Text>
            </View>
          )}

          {viewMode === 'month' && (
            <View key={`cal-${currentDate.getMonth()}-${currentDate.getFullYear()}`} style={styles.calendarContainer}>
              <View style={styles.weekDaysHeader}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <Text key={day} style={styles.weekDayLabel}>{day}</Text>
                ))}
              </View>
              {calendarDays.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.weekRow}>
                  {week.map(day => renderDayCell(day))}
                </View>
              ))}
            </View>
          )}

          {viewMode === 'week' && (
            <View style={styles.calendarContainer}>
              <View style={styles.weekDaysHeader}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <Text key={day} style={styles.weekDayLabel}>{day}</Text>
                ))}
              </View>
              <View style={styles.weekRow}>
                {weekDays.map(day => renderDayCell(day))}
              </View>
            </View>
          )}

          {viewMode === '90days' && (
            <View style={styles.ninetyDaysContainer}>
              <View style={styles.ninetyDaysGrid}>
                {next90Days.map((day, index) => {
                  const hasEvents = day.events.cruise > 0 || day.events.travel > 0 || day.events.personal > 0;
                  const eventColor = day.events.cruise > 0 ? EVENT_COLORS.cruise
                    : day.events.travel > 0 ? EVENT_COLORS.travel
                    : day.events.personal > 0 ? EVENT_COLORS.personal
                    : 'transparent';
                  
                  return (
                    <View
                      key={`90day-${index}`}
                      style={[
                        styles.ninetyDayCell,
                        day.isToday && styles.todayNinetyCell,
                        hasEvents && { backgroundColor: `${eventColor}40` },
                      ]}
                    >
                      {hasEvents && (
                        <View style={[styles.ninetyDayDot, { backgroundColor: eventColor }]} />
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={styles.ninetyDaysLabels}>
                <Text style={styles.ninetyDaysLabel}>Today</Text>
                <Text style={styles.ninetyDaysLabel}>+30</Text>
                <Text style={styles.ninetyDaysLabel}>+60</Text>
                <Text style={styles.ninetyDaysLabel}>+90</Text>
              </View>
            </View>
          )}

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { borderColor: EVENT_COLORS.cruise }]} />
              <Text style={styles.legendText}>Easy Seas</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { borderColor: EVENT_COLORS.travel }]} />
              <Text style={styles.legendText}>Travel</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { borderColor: EVENT_COLORS.personal }]} />
              <Text style={styles.legendText}>Personal</Text>
            </View>
          </View>

          <View style={styles.luckLegendContainer}>
            <View style={styles.luckLegendHeader}>
              <Text style={styles.luckLegendTitle}>
                {birthdate ? '✨ Personalized Luck (1–9)' : '✨ General Luck Scale (1–9)'}
              </Text>
              {!birthdate && (
                <Text style={styles.luckLegendHint}>Add birthdate in Settings for personalized scores</Text>
              )}
            </View>
            <View style={styles.luckSwatchRow}>
              {[
                { hex: '#DC2626', label: '1' },
                { hex: '#EA580C', label: '2' },
                { hex: '#B45309', label: '3' },
                { hex: '#CA8A04', label: '4' },
                { hex: '#4D7C0F', label: '5' },
                { hex: '#16A34A', label: '6' },
                { hex: '#2563EB', label: '7' },
                { hex: '#4F46E5', label: '8' },
                { hex: '#7C3AED', label: '9' },
              ].map((item) => (
                <View key={item.label} style={styles.luckSwatchItem}>
                  <View style={[styles.luckSwatch, { backgroundColor: item.hex }]} />
                  <Text style={styles.luckSwatchLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.luckSwatchEnds}>
              <Text style={styles.luckSwatchEndText}>Bad Luck</Text>
              <Text style={styles.luckSwatchEndText}>Super Lucky</Text>
            </View>
          </View>

          {viewMode === 'events' && (
            <View style={styles.eventsListSection}>
              <View style={styles.sectionHeader}>
                <CalendarDays size={20} color={DS.text.primary} />
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                <Text style={styles.eventCountBadge}>{`${displayedUpcomingEvents.length}/${upcomingEvents.length}`}</Text>
              </View>
              <View style={styles.upcomingFilterRow}>
                {UPCOMING_FILTER_OPTIONS.map((option) => {
                  const isActive = upcomingFilter === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.upcomingFilterChip, isActive && styles.upcomingFilterChipActive]}
                      onPress={() => setUpcomingFilter(option.value)}
                      activeOpacity={0.8}
                      testID={`calendar-upcoming-filter-${option.value}`}
                    >
                      <Text style={[styles.upcomingFilterChipText, isActive && styles.upcomingFilterChipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {upcomingEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <CalendarDays size={48} color='rgba(255,255,255,0.6)' />
                  </View>
                  <Text style={styles.emptyTitle}>No Upcoming Events</Text>
                  <Text style={styles.emptyText}>
                    Import calendar events or book a cruise to see them here
                  </Text>
                  <TouchableOpacity 
                    style={styles.addEventButton}
                    onPress={() => router.push('/(tabs)/settings' as any)}
                    activeOpacity={0.7}
                  >
                    <Plus size={18} color={COLORS.white} />
                    <Text style={styles.addEventText}>Import Events</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.eventsList}>
                  {displayedUpcomingEvents.map((item, index) => renderEventCard(item, index))}
                </View>
              )}
            </View>
          )}

          {viewMode !== 'events' && upcomingEvents.length > 0 && (
            <View style={styles.eventsListSection}>
              <View style={styles.sectionHeader}>
                <CalendarDays size={20} color={DS.text.primary} />
                <Text style={styles.sectionTitle}>Next Up</Text>
                <Text style={styles.eventCountBadge}>{`${displayedUpcomingEvents.length}/${upcomingEvents.length}`}</Text>
              </View>
              <View style={styles.upcomingFilterRow}>
                {UPCOMING_FILTER_OPTIONS.map((option) => {
                  const isActive = upcomingFilter === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.upcomingFilterChip, isActive && styles.upcomingFilterChipActive]}
                      onPress={() => setUpcomingFilter(option.value)}
                      activeOpacity={0.8}
                      testID={`calendar-next-up-filter-${option.value}`}
                    >
                      <Text style={[styles.upcomingFilterChipText, isActive && styles.upcomingFilterChipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.eventsList}>
                {displayedUpcomingEvents.map((item, index) => renderEventCard(item, index))}
              </View>
            </View>
          )}

          <View style={styles.crewSectionContainer}>
            <TimeZoneConverter />
          </View>

          <View style={styles.crewSectionContainer}>
            <CrewRecognitionSection />
          </View>
          
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.bg.page,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroHeader: {
    backgroundColor: '#05070A',
    borderRadius: DS.radius.xl,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: '#1F2937',
    ...SHADOW.sm,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoSection: {
    marginRight: SPACING.md,
  },
  logoImage: {
    width: 100,
    height: 120,
    borderRadius: BORDER_RADIUS.md,
  },
  heroTextSection: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: DS.font.lobster,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.74)',
    marginBottom: SPACING.sm,
  },
  tierBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: DS.radius.pill,
    padding: 4,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: DS.border.default,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: DS.radius.pill,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: DS.bg.card,
    borderWidth: 1,
    borderColor: DS.border.default,
  },
  viewToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: DS.text.secondary,
  },
  viewToggleTextActive: {
    color: DS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: DS.border.default,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.border.default,
  },
  clearEventsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginLeft: 6,
  },
  monthYearContainer: {
    alignItems: 'center',
    flex: 1,
  },
  monthYearText: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: DS.text.primary,
  },
  eventCountText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: DS.text.secondary,
    marginTop: 2,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    gap: 4,
  },
  alertBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  calendarContainer: {
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.xl,
    marginHorizontal: SPACING.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: DS.border.default,
    ...SHADOW.sm,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: DS.border.divider,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: DS.text.secondary,
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: 62,
    borderRadius: DS.radius.sm,
    borderWidth: 1,
    borderColor: DS.border.default,
    overflow: 'hidden',
    margin: 2,
    padding: 3,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  otherMonthCell: {
    opacity: 0.3,
  },
  dayCellTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayNumber: {
    fontSize: 10,
    fontWeight: '700' as const,
    lineHeight: 13,
    color: DS.text.primary,
    alignSelf: 'flex-start',
  },
  luckScoreCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  luckScoreText: {
    fontSize: 26,
    fontWeight: '900' as const,
    lineHeight: 30,
    includeFontPadding: false,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  luckLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: DS.border.default,
    gap: SPACING.lg,
    ...SHADOW.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: DS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  ninetyDaysContainer: {
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: DS.border.default,
    ...SHADOW.sm,
  },
  ninetyDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  ninetyDayCell: {
    width: Math.floor((SCREEN_WIDTH - SPACING.md * 4 - 28) / 15),
    aspectRatio: 1,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNinetyCell: {
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  ninetyDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  ninetyDaysLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  ninetyDaysLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: DS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  eventsListSection: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: DS.text.primary,
    flex: 1,
  },
  eventCountBadge: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: DS.text.primary,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: DS.radius.pill,
    overflow: 'hidden',
  },
  upcomingFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  upcomingFilterChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: DS.radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DS.border.default,
  },
  upcomingFilterChipActive: {
    backgroundColor: DS.text.primary,
    borderColor: DS.text.primary,
  },
  upcomingFilterChipText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: DS.text.primary,
  },
  upcomingFilterChipTextActive: {
    color: '#FFFFFF',
  },
  eventsList: {
    gap: SPACING.sm,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DS.border.default,
    ...SHADOW.sm,
  },
  eventTypeIndicator: {
    width: 4,
  },
  eventCardContent: {
    flex: 1,
    padding: SPACING.md,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  eventCardType: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: DS.text.secondary,
    textTransform: 'uppercase',
  },
  eventCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: DS.text.primary,
    marginBottom: 2,
  },
  eventCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: DS.text.secondary,
    marginBottom: SPACING.xs,
  },
  eventCardDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: DS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.border.default,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: DS.text.primary,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: DS.text.secondary,
    textAlign: 'center' as const,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: DS.text.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: DS.radius.pill,
  },
  addEventText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 120,
  },
  crewSectionContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  luckLegendContainer: {
    backgroundColor: DS.bg.card,
    borderRadius: DS.radius.xl,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D4B0FF',
  },
  luckLegendHeader: {
    marginBottom: SPACING.sm,
  },
  luckLegendTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#7C3AED',
    marginBottom: 2,
  },
  luckLegendHint: {
    fontSize: 10,
    color: '#9060C0',
    fontStyle: 'italic' as const,
  },
  luckSwatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  luckSwatchItem: {
    alignItems: 'center',
    flex: 1,
  },
  luckSwatch: {
    width: '100%',
    height: 16,
    borderRadius: 4,
    marginBottom: 2,
  },
  luckSwatchLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: DS.text.primary,
  },
  luckSwatchEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  luckSwatchEndText: {
    fontSize: 9,
    color: DS.text.secondary,
    fontStyle: 'italic' as const,
  },
});
