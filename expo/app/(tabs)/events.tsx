import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, ChevronRight, Ship, Plane, User, Users, Plus, AlertTriangle, Ban, Gift, Award, MapPin, Clock, Sparkles } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import type { CalendarEvent, BookedCruise, CasinoOffer } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { TimeZoneConverter } from '@/components/TimeZoneConverter';
import { getCalendarEligibleCruises, getCalendarEventsWithGeneratedCruiseEvents, getDisplayCalendarEvents, getNormalizedCruiseDateRange } from '@/lib/calendar/cruiseEvents';
import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCertificates } from '@/state/CertificatesProvider';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useExperience } from '@/state/ExperienceProvider';
import { useUser } from '@/state/UserProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { deriveCruiseDayPlan } from '@/lib/cruisePlanningIntelligence';
import { getTarotCardForDate } from '@/lib/dailyLuck/tarot';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { SegmentedControl } from '@/components/ui/EasySeasPrimitives';
import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails';
import { formatCount } from '@/lib/format';

type ViewMode = 'events' | 'week' | 'month' | '90days' | 'passenger';
type PassengerDayKind = 'sea' | 'port' | 'land' | 'gap' | 'expiration' | 'tier' | 'personal';

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
}

const EVENT_COLORS = {
  cruise: '#0E7FA7',
  travel: '#3E84D9',
  personal: '#E6B63D',
  sea: '#123D73',
  port: '#4EC0A5',
  gap: '#58585B',
  expiration: '#D87924',
  tier: '#273D9A',
  land: '#BFC4CC',
  passengerPersonal: '#55742C',
};

interface PassengerDayItem {
  id: string;
  date: string;
  kind: PassengerDayKind;
  title: string;
  subtitle: string;
  color: string;
  cruiseId?: string;
  sharedType?: 'Shared' | 'Solo';
}

const PASSENGER_TIMELINE_PAGE_SIZE = 20;

export default function EventsScreen() {
  const router = useRouter();
  const { colors: experienceColors, isDark } = useExperience();
  const { localData } = useAppState();
  const coreData = useCoreData();
  const { bookedCruises } = coreData;
  const { certificates } = useCertificates();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [tarotMonthMode, setTarotMonthMode] = useState(false);
  const [passengerTimelinePage, setPassengerTimelinePage] = useState(0);

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const filteredBookedCruises = useMemo(() => {
    return filterRecordsByIntelligence(bookedCruises, intelligenceFilterSnapshot, users);
  }, [bookedCruises, intelligenceFilterSnapshot, users]);

  const filteredCertificates = useMemo(() => {
    return filterRecordsByIntelligence(certificates, intelligenceFilterSnapshot, users);
  }, [certificates, intelligenceFilterSnapshot, users]);

  const filteredOffers = useMemo(() => {
    return filterRecordsByIntelligence((localData.offers || []) as CasinoOffer[], intelligenceFilterSnapshot, users);
  }, [intelligenceFilterSnapshot, localData.offers, users]);

  const normalizedBookedCruises = useMemo((): BookedCruise[] => {
    return getCalendarEligibleCruises(filteredBookedCruises)
      .map((cruise) => {
        const cruiseDateRange = getNormalizedCruiseDateRange(cruise);
        if (!cruiseDateRange) return null;
        return {
          ...cruise,
          sailDate: cruiseDateRange.sailDate,
          returnDate: cruiseDateRange.returnDate,
        };
      })
      .filter((cruise): cruise is BookedCruise => cruise !== null);
  }, [filteredBookedCruises]);

  const sourceCalendarEvents = useMemo(() => {
    const mergedEvents = [...((localData.calendar || []) as CalendarEvent[]), ...((localData.tripit || []) as CalendarEvent[])];
    return filterRecordsByIntelligence(mergedEvents, intelligenceFilterSnapshot, users);
  }, [intelligenceFilterSnapshot, localData.calendar, localData.tripit, users]);

  const planningDeadlineEvents = useMemo((): CalendarEvent[] => {
    const rows: CalendarEvent[] = [];
    filteredOffers.forEach((offer) => {
      const expiry = offer.expiryDate || offer.expires || offer.offerExpiryDate;
      if (!expiry) return;
      const date = expiry.split('T')[0];
      rows.push({
        id: `generated-offer-deadline-${offer.id}`,
        title: 'Offer expires',
        description: offer.offerCode || offer.offerName || offer.title || 'Casino offer',
        startDate: date,
        endDate: date,
        start: date,
        end: date,
        type: 'other',
        sourceType: 'import',
        allDay: true,
        source: 'import',
        color: EVENT_COLORS.expiration,
        ownerProfileId: offer.ownerProfileId,
        sourceEmail: offer.sourceEmail,
      });
    });
    filteredCertificates.forEach((certificate) => {
      if (!certificate.expiryDate) return;
      const date = certificate.expiryDate.split('T')[0];
      rows.push({
        id: `generated-certificate-deadline-${certificate.id}`,
        title: 'Certificate expires',
        description: certificate.label || certificate.type,
        startDate: date,
        endDate: date,
        start: date,
        end: date,
        type: 'other',
        sourceType: 'import',
        allDay: true,
        source: 'import',
        color: EVENT_COLORS.expiration,
      });
    });
    return Array.from(new Map(rows.map((row) => [row.id, row])).values());
  }, [filteredCertificates, filteredOffers]);

  const calendarEvents = useMemo(() => {
    const mergedEvents = getCalendarEventsWithGeneratedCruiseEvents(
      normalizedBookedCruises,
      [...sourceCalendarEvents, ...planningDeadlineEvents]
    );
    console.log('[Events] Calendar events updated:', {
      mergedEvents: mergedEvents.length,
      bookedCruises: normalizedBookedCruises.length,
    });
    return mergedEvents;
  }, [normalizedBookedCruises, planningDeadlineEvents, sourceCalendarEvents]);

  const crewOwnerLabel = useMemo(() => {
    const selectedProfile = users.find((user) => user.id === selectedProfileId || user.email === selectedProfileId);
    return selectedProfile?.name
      ? `Saved separately for ${selectedProfile.name}`
      : 'Saved separately for the active user profile';
  }, [selectedProfileId, users]);

  const visibleSourceCalendarEvents = useMemo(
    () => getDisplayCalendarEvents(normalizedBookedCruises, sourceCalendarEvents),
    [normalizedBookedCruises, sourceCalendarEvents],
  );

  useEffect(() => {
    console.log('[Events] Data changed - calendar:', calendarEvents.length, 'cruises:', normalizedBookedCruises.length);
    setRefreshKey((prev) => prev + 1);
  }, [calendarEvents.length, normalizedBookedCruises.length]);

  const _eventCounts = useMemo(() => {
    let cruise = 0;
    let travel = 0;
    let personal = 0;

    calendarEvents.forEach(event => {
      if (event.type === 'cruise' || (event as any).sourceType === 'cruise') {
        cruise++;
      } else if (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') {
        travel++;
      } else {
        personal++;
      }
    });

    return { cruise, travel, personal };
  }, [calendarEvents]);

  const totalEventsThisMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    let count = 0;

    calendarEvents.forEach(event => {
      const eventStart = event.startDate || event.start || '';
      if (eventStart) {
        const eventDate = new Date(eventStart);
        if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
          count++;
        }
      }
    });

    return count;
  }, [calendarEvents, currentDate]);

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    calendarEvents.forEach(event => {
      const eventStart = event.startDate || event.start || '';
      const eventEnd = event.endDate || event.end || eventStart;

      if (!eventStart) return;

      const startDate = eventStart.split('T')[0];
      const endDate = eventEnd ? eventEnd.split('T')[0] : startDate;

      if (!startDate || !endDate) return;

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

    return { cruise, travel, personal };
  }, [calendarEvents]);

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
      });
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isToday = date.getTime() === today.getTime();
      
      currentWeek.push({
        date,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(date),
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
        });
        nextMonthDay++;
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  }, [currentDate, getEventsForDate, refreshKey]);

  const weekDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(date),
      });
    }
    return days;
  }, [getEventsForDate]);

  const next90Days = useMemo(() => {
    const today = new Date();
    const days: DayData[] = [];
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const isToday = i === 0;
      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(date),
      });
    }
    return days;
  }, [getEventsForDate]);

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
            void coreData.setCalendarEvents([]);
            setRefreshKey(prev => prev + 1);
          },
        },
      ]
    );
  }, [coreData]);

  const formatMonthYear = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, []);

  const renderEventDots = useCallback((events: { cruise: number; travel: number; personal: number }) => {
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

  const getDayBackgroundColor = useCallback((day: DayData) => {
    const hasEvents = day.events.cruise > 0 || day.events.travel > 0 || day.events.personal > 0;
    if (!hasEvents) return 'transparent';
    
    if (day.events.cruise > 0 && day.events.travel > 0) {
      return 'rgba(34, 197, 94, 0.25)';
    }
    if (day.events.cruise > 0) {
      return 'rgba(34, 197, 94, 0.2)';
    }
    if (day.events.travel > 0) {
      return 'rgba(59, 130, 246, 0.2)';
    }
    if (day.events.personal > 0) {
      return 'rgba(168, 85, 247, 0.15)';
    }
    return 'transparent';
  }, []);

  const renderDayCell = useCallback((day: DayData) => {
    const hasEvents = day.events.cruise > 0 || day.events.travel > 0 || day.events.personal > 0;
    const tarotCard = tarotMonthMode ? getTarotCardForDate(day.date) : null;
    const bgColor = tarotMonthMode
      ? tarotCard && tarotCard.luckModifier > 0 ? 'rgba(124, 58, 237, 0.14)'
        : tarotCard && tarotCard.luckModifier < 0 ? 'rgba(153, 27, 27, 0.10)'
        : 'rgba(71, 85, 105, 0.08)'
      : getDayBackgroundColor(day);
    
    return (
      <TouchableOpacity
        key={day.date.toISOString()}
        style={[
          styles.dayCell,
          { backgroundColor: bgColor },
          day.isToday && styles.todayCell,
          !day.isCurrentMonth && styles.otherMonthCell,
        ]}
        activeOpacity={0.7}
        onPress={() => handleDayPress(day)}
      >
        <Text style={[
          styles.dayNumber,
          day.isToday && styles.todayNumber,
          !day.isCurrentMonth && styles.otherMonthNumber,
          !tarotMonthMode && hasEvents && day.isCurrentMonth && styles.dayNumberWithEvents,
        ]}>
          {day.dayNumber}
        </Text>
        {tarotMonthMode && tarotCard ? (
          <View style={styles.tarotDayContent}>
            <Sparkles size={10} color={tarotCard.luckModifier < 0 ? '#822A25' : '#273D9A'} />
            <Text
              style={[styles.tarotDayName, !day.isCurrentMonth && styles.otherMonthNumber]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {tarotCard.name}
            </Text>
          </View>
        ) : hasEvents && (
          <View style={styles.eventDotsContainer}>
            {renderEventDots(day.events)}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [renderEventDots, handleDayPress, getDayBackgroundColor, tarotMonthMode]);

  const allEventItems = useMemo(() => {
    const allEvents: { event: CalendarEvent | BookedCruise; type: 'calendar' | 'cruise'; date: Date }[] = [];

    calendarEvents.forEach((event) => {
      const startValue = event.startDate || event.start || '';
      if (!startValue) {
        return;
      }

      allEvents.push({
        event,
        type: 'calendar',
        date: createDateFromString(startValue),
      });
    });

    normalizedBookedCruises.forEach((cruise) => {
      const cruiseDateRange = getNormalizedCruiseDateRange(cruise);
      if (!cruiseDateRange) {
        return;
      }

      allEvents.push({
        event: cruise,
        type: 'cruise',
        date: createDateFromString(cruiseDateRange.sailDate),
      });
    });

    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarEvents, normalizedBookedCruises]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allEventItems.filter((item) => item.date >= today).slice(0, 5);
  }, [allEventItems]);

  const recentEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...allEventItems]
      .filter((item) => item.date < today)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
  }, [allEventItems]);

  const featuredEvents = upcomingEvents.length > 0 ? upcomingEvents : recentEvents;
  const hasFutureEvents = upcomingEvents.length > 0;

  const formatDateOnly = useCallback((date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }, []);

  const passengerDayItems = useMemo((): PassengerDayItem[] => {
    const items = new Map<string, PassengerDayItem>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31);

    const addItem = (item: PassengerDayItem) => {
      const existing = items.get(item.id);
      if (!existing) {
        items.set(item.id, item);
      }
    };

    normalizedBookedCruises.forEach((cruise) => {
      const sailDate = createDateFromString(cruise.sailDate);
      const dayPlan = deriveCruiseDayPlan(cruise);
      const sharedType: 'Shared' | 'Solo' = (cruise.guestNames?.length ?? cruise.guests ?? 1) > 1 ? 'Shared' : 'Solo';
      dayPlan.forEach((plan) => {
        const dayDate = new Date(sailDate);
        dayDate.setDate(sailDate.getDate() + plan.day - 1);
        const date = formatDateOnly(dayDate);
        const isSea = plan.isSeaDay;
        addItem({
          id: `passenger-${cruise.id}-${plan.day}`,
          date,
          kind: isSea ? 'sea' : 'port',
          title: isSea ? 'Day at Sea' : plan.isEmbarkation ? 'Embarkation Day' : plan.isDisembarkation ? 'Disembarkation Day' : 'Port Day',
          subtitle: `${cruise.shipName} • ${plan.port || cruise.departurePort || 'Cruise'} • ${sharedType}`,
          color: isSea ? EVENT_COLORS.sea : EVENT_COLORS.port,
          cruiseId: cruise.id,
          sharedType,
        });
      });
    });

    const sortedCruises = [...normalizedBookedCruises].sort((left, right) => createDateFromString(left.sailDate).getTime() - createDateFromString(right.sailDate).getTime());
    sortedCruises.forEach((cruise, index) => {
      const nextCruise = sortedCruises[index + 1];
      if (!nextCruise) return;
      const returnDate = createDateFromString(cruise.returnDate || cruise.sailDate);
      const nextSailDate = createDateFromString(nextCruise.sailDate);
      const gapStart = new Date(returnDate);
      gapStart.setDate(returnDate.getDate() + 1);
      const gapEnd = new Date(nextSailDate);
      gapEnd.setDate(nextSailDate.getDate() - 1);
      if (gapStart <= gapEnd) {
        addItem({
          id: `gap-${cruise.id}-${nextCruise.id}`,
          date: formatDateOnly(gapStart),
          kind: 'gap',
          title: 'Travel Gap',
          subtitle: `${formatCount(Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1, 'land day')} before ${nextCruise.shipName}`,
          color: EVENT_COLORS.gap,
        });
      }
    });

    visibleSourceCalendarEvents.forEach((event) => {
      const date = (event.startDate || event.start || '').split('T')[0];
      if (!date) return;
      addItem({
        id: `personal-${event.id}`,
        date,
        kind: 'personal',
        title: event.title,
        subtitle: event.location || event.type,
        color: EVENT_COLORS.passengerPersonal,
      });
    });

    filteredOffers.forEach((offer) => {
      const expiry = offer.expiryDate || offer.expires || offer.offerExpiryDate;
      if (!expiry) return;
      const date = expiry.split('T')[0];
      addItem({
        id: `offer-expiration-${offer.id}`,
        date,
        kind: 'expiration',
        title: 'Offer Expiration',
        subtitle: offer.offerCode || offer.offerName || offer.title || 'Casino offer',
        color: EVENT_COLORS.expiration,
      });
    });

    filteredCertificates.forEach((certificate) => {
      if (!certificate.expiryDate) return;
      addItem({
        id: `certificate-expiration-${certificate.id}`,
        date: certificate.expiryDate.split('T')[0],
        kind: 'expiration',
        title: 'Certificate Expiration',
        subtitle: certificate.label || certificate.type,
        color: EVENT_COLORS.expiration,
      });
    });

    normalizedBookedCruises.forEach((cruise) => {
      const points = getBookedCruiseCasinoPoints(cruise);
      if (points <= 0) return;
      addItem({
        id: `tier-milestone-${cruise.id}`,
        date: cruise.returnDate || cruise.sailDate,
        kind: 'tier',
        title: 'Tier Milestone',
        subtitle: `${points.toLocaleString()} casino points from ${cruise.shipName}`,
        color: EVENT_COLORS.tier,
        cruiseId: cruise.id,
      });
    });

    for (let cursor = new Date(yearStart); cursor <= yearEnd; cursor.setDate(cursor.getDate() + 1)) {
      const date = formatDateOnly(cursor);
      const hasLifeAtSeaItem = Array.from(items.values()).some((item) => item.date === date && (item.kind === 'sea' || item.kind === 'port'));
      if (!hasLifeAtSeaItem && cursor >= today) {
        addItem({
          id: `land-${date}`,
          date,
          kind: 'land',
          title: 'Land Day',
          subtitle: 'No sailing loaded for this date',
          color: EVENT_COLORS.land,
        });
      }
    }

    const sortedItems = Array.from(items.values()).sort((left, right) => left.date.localeCompare(right.date));
    console.log('[Events] Permanent Passenger View items built:', {
      items: sortedItems.length,
      sea: sortedItems.filter((item) => item.kind === 'sea').length,
      port: sortedItems.filter((item) => item.kind === 'port').length,
      expirations: sortedItems.filter((item) => item.kind === 'expiration').length,
    });
    return sortedItems;
  }, [filteredCertificates, filteredOffers, formatDateOnly, normalizedBookedCruises, visibleSourceCalendarEvents]);

  const passengerTimelinePageCount = Math.max(1, Math.ceil(passengerDayItems.length / PASSENGER_TIMELINE_PAGE_SIZE));
  const visiblePassengerDayItems = useMemo(() => {
    const safePage = Math.min(passengerTimelinePage, passengerTimelinePageCount - 1);
    const start = safePage * PASSENGER_TIMELINE_PAGE_SIZE;
    return passengerDayItems.slice(start, start + PASSENGER_TIMELINE_PAGE_SIZE);
  }, [passengerDayItems, passengerTimelinePage, passengerTimelinePageCount]);

  useEffect(() => {
    setPassengerTimelinePage((current) => Math.min(current, passengerTimelinePageCount - 1));
  }, [passengerTimelinePageCount]);

  const passengerSummary = useMemo(() => {
    return {
      sea: passengerDayItems.filter((item) => item.kind === 'sea').length,
      port: passengerDayItems.filter((item) => item.kind === 'port').length,
      land: passengerDayItems.filter((item) => item.kind === 'land').length,
      expirations: passengerDayItems.filter((item) => item.kind === 'expiration').length,
      shared: passengerDayItems.filter((item) => item.sharedType === 'Shared').length,
      solo: passengerDayItems.filter((item) => item.sharedType === 'Solo').length,
    };
  }, [passengerDayItems]);

  const handleJumpToEventMonth = useCallback((date: Date) => {
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }, []);

  const renderEventCard = useCallback((item: { event: CalendarEvent | BookedCruise; type: 'calendar' | 'cruise'; date: Date }, index: number) => {
    if (item.type === 'cruise') {
      const cruise = item.event as BookedCruise;
      return (
        <TouchableOpacity 
          key={`cruise-${cruise.id}-${index}`}
          style={styles.eventCard}
          activeOpacity={0.85}
          onPress={() => router.push({
            pathname: '/cruise-details' as any,
            params: buildCruiseDetailsParams(cruise, { source: 'calendar' }),
          })}
        >
          <View style={[styles.eventTypeIndicator, { backgroundColor: EVENT_COLORS.cruise }]} />
          <View style={styles.eventCardContent}>
            <View style={styles.eventCardHeader}>
              <Ship size={16} color={EVENT_COLORS.cruise} />
              <Text style={styles.eventCardType}>Cruise</Text>
            </View>
            <Text style={styles.eventCardTitle}>{cruise.shipName}</Text>
            <Text style={styles.eventCardSubtitle}>{cruise.destination}</Text>
            <Text style={styles.eventCardDate}>
              {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            </Text>
          </View>
        </TouchableOpacity>
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
        onPress={() => router.push({ pathname: '/day-agenda' as any, params: { date: formatDateOnly(item.date) } })}
        accessibilityRole="button"
        accessibilityLabel={`Open ${event.title} on ${formatDateOnly(item.date)}`}
      >
        <View style={[styles.eventTypeIndicator, { backgroundColor: eventColor }]} />
        <View style={styles.eventCardContent}>
          <View style={styles.eventCardHeader}>
            <EventIcon size={16} color={eventColor} />
            <Text style={styles.eventCardType}>{event.type}</Text>
          </View>
          <Text style={styles.eventCardTitle}>{event.title}</Text>
          {event.location ? (
            <Text style={styles.eventCardSubtitle}>{event.location}</Text>
          ) : null}
          <Text style={styles.eventCardDate}>
            {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [formatDateOnly, router]);

  return (
    <View style={[styles.container, { backgroundColor: experienceColors.background }]}> 
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ResponsiveContainer>
            <TabIdentityBand tab="calendar" dense detail={viewMode === 'month' ? 'Monthly planning view' : viewMode === 'events' ? 'Agenda and event view' : `${viewMode} planning view`} />

          {!tarotMonthMode ? <IntelligenceFilterStrip
              contextLabel="Calendar"
              variant="bookedCruises"
              compact
              showTitle={false}
              showProgram={false}
            /> : null}

          <ThemedSectionHeader
            tab="calendar"
            emoji={tarotMonthMode ? '🔮' : viewMode === 'events' ? '📋' : viewMode === 'month' ? '🗓️' : '📅'}
            title={tarotMonthMode ? 'Daily tarot calendar' : 'Plan your days'}
            subtitle="Switch between agenda, week, month, 90-day, and passenger views."
            tone={tarotMonthMode ? 'casino' : 'default'}
            compact
            testID="calendar-view-controls-section"
          />

          <View style={styles.viewToggleContainer} testID="calendar-view-mode-control">
            <SegmentedControl
              options={[
                { value: 'events', label: 'Agenda' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: '90days', label: '90 Days' },
                { value: 'passenger', label: 'Passenger' },
              ]}
              value={viewMode}
              testID="calendar-view"
              onChange={(mode) => { setTarotMonthMode(false); setViewMode(mode as ViewMode); }}
              accessibilityLabel="Choose calendar view"
            />
          </View>

          {(viewMode === 'month' || viewMode === 'week') && (
            <View style={styles.monthNavigation}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigateMonth('prev')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Previous calendar period"
                testID="calendar-period-previous"
              >
                <ChevronLeft size={24} color={COLORS.navyDeep} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.monthYearContainer}
                onPress={goToToday}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go to today"
                testID="calendar-go-to-today"
              >
                <Text style={styles.monthYearText}>{formatMonthYear(currentDate)}</Text>
                <Text style={styles.eventCountText}>{tarotMonthMode ? 'Daily tarot cards • Tap to go to today' : `${totalEventsThisMonth} events • Tap to go to today`}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearEventsButton}
                onPress={handleClearEvents}
                activeOpacity={0.7}
                testID="clear-events-button"
              >
                <Ban size={18} color="#A52B34" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tarotMonthButton, tarotMonthMode && styles.tarotMonthButtonActive]}
                onPress={() => {
                  setTarotMonthMode((active) => !active);
                  setViewMode('month');
                }}
                activeOpacity={0.7}
                accessibilityLabel={tarotMonthMode ? 'Show calendar events' : 'Show monthly tarot cards'}
                accessibilityState={{ selected: tarotMonthMode }}
                testID="tarot-month-toggle"
              >
                <Sparkles size={17} color={tarotMonthMode ? COLORS.white : '#273D9A'} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigateMonth('next')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Next calendar period"
                testID="calendar-period-next"
              >
                <ChevronRight size={24} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>
          )}

          {!tarotMonthMode && (viewMode === 'month' || viewMode === 'week') && totalEventsThisMonth === 0 && featuredEvents.length > 0 && (
            <TouchableOpacity
              style={styles.jumpBanner}
              onPress={() => handleJumpToEventMonth(featuredEvents[0].date)}
              activeOpacity={0.82}
              testID="jump-to-events-month-button"
            >
              <View style={styles.jumpBannerTextGroup}>
                <Text style={styles.jumpBannerTitle}>No events in {formatMonthYear(currentDate)}</Text>
                <Text style={styles.jumpBannerText}>
                  {hasFutureEvents
                    ? `Jump to ${formatMonthYear(featuredEvents[0].date)} to see your next cruise.`
                    : `Jump to ${formatMonthYear(featuredEvents[0].date)} to review your cruise history.`}
                </Text>
              </View>
              <ChevronRight size={20} color={COLORS.navyDeep} />
            </TouchableOpacity>
          )}

          {!tarotMonthMode && totalEventsThisMonth > 10 && viewMode === 'month' && (
            <View style={styles.alertBadge}>
              <AlertTriangle size={14} color={COLORS.white} />
              <Text style={styles.alertBadgeText}>{totalEventsThisMonth}</Text>
            </View>
          )}

          {viewMode === 'month' && (
            <View style={styles.calendarContainer} testID={tarotMonthMode ? 'calendar-tarot-month-grid' : 'calendar-month-grid'}>
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
            <View style={styles.calendarContainer} testID="calendar-week-grid">
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
            <View style={styles.ninetyDaysContainer} testID="calendar-90-day-grid">
              <View style={styles.ninetyDaysGrid}>
                {next90Days.map((day, index) => {
                  const hasEvents = day.events.cruise > 0 || day.events.travel > 0 || day.events.personal > 0;
                  const eventColor = day.events.cruise > 0 ? EVENT_COLORS.cruise
                    : day.events.travel > 0 ? EVENT_COLORS.travel
                    : day.events.personal > 0 ? EVENT_COLORS.personal
                    : 'transparent';
                  
                  return (
                    <TouchableOpacity
                      key={`90day-${index}`}
                      style={[
                        styles.ninetyDayCell,
                        day.isToday && styles.todayNinetyCell,
                        hasEvents && { backgroundColor: `${eventColor}40` },
                      ]}
                      onPress={() => handleDayPress(day)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open agenda for ${formatDateOnly(day.date)}`}
                      testID={`calendar-90-day-${formatDateOnly(day.date)}`}
                    >
                      {hasEvents && (
                        <View style={[styles.ninetyDayDot, { backgroundColor: eventColor }]} />
                      )}
                    </TouchableOpacity>
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

          {viewMode === 'passenger' && (
            <View style={styles.passengerViewCard} testID="permanent-passenger-calendar-view">
              <View style={styles.passengerHeaderRow}>
                <View style={styles.passengerHeaderCopy}>
                  <Text style={styles.passengerTitle}>Permanent Passenger View</Text>
                  <Text style={styles.passengerSubtitle}>Life-at-sea timeline for this year</Text>
                </View>
                <TouchableOpacity
                  style={styles.passengerDrillButton}
                  onPress={() => router.push('/passenger-calendar' as any)}
                  activeOpacity={0.78}
                  testID="passenger-view-open-full-drilldown"
                >
                  <Text style={styles.passengerDrillButtonText}>Drill-down</Text>
                  <ChevronRight size={14} color={COLORS.white} />
                </TouchableOpacity>
                <View style={styles.passengerCountBadge}>
                  <Text style={styles.passengerCountText}>{passengerDayItems.length}</Text>
                </View>
              </View>
              <View style={styles.passengerStatsGrid}>
                <View style={styles.passengerStat}><Text style={styles.passengerStatValue}>{passengerSummary.sea}</Text><Text style={styles.passengerStatLabel}>At sea</Text></View>
                <View style={styles.passengerStat}><Text style={styles.passengerStatValue}>{passengerSummary.port}</Text><Text style={styles.passengerStatLabel}>Port</Text></View>
                <View style={styles.passengerStat}><Text style={styles.passengerStatValue}>{passengerSummary.land}</Text><Text style={styles.passengerStatLabel}>Land</Text></View>
                <View style={styles.passengerStat}><Text style={styles.passengerStatValue}>{passengerSummary.expirations}</Text><Text style={styles.passengerStatLabel}>Expiry</Text></View>
              </View>
              <View style={styles.passengerList}>
                {visiblePassengerDayItems.map((item) => {
                  const ItemIcon = item.kind === 'sea' ? Ship : item.kind === 'port' ? MapPin : item.kind === 'expiration' ? Gift : item.kind === 'tier' ? Award : item.kind === 'gap' ? Plane : item.kind === 'personal' ? User : Clock;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.passengerItem}
                      activeOpacity={0.75}
                      onPress={() => item.cruiseId ? router.push({ pathname: '/(tabs)/(overview)/cruise-details' as any, params: { id: item.cruiseId } }) : undefined}
                    >
                      <View style={[styles.passengerItemRail, { backgroundColor: item.color }]} />
                      <View style={[styles.passengerIconBadge, { backgroundColor: `${item.color}22` }]}>
                        <ItemIcon size={15} color={item.color} />
                      </View>
                      <View style={styles.passengerItemCopy}>
                        <Text style={styles.passengerItemTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.passengerItemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      <Text style={styles.passengerItemDate}>{item.date.slice(5)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {passengerTimelinePageCount > 1 ? (
                <View style={styles.passengerPagination} testID="calendar-passenger-pagination">
                  <TouchableOpacity
                    style={[styles.passengerPageButton, passengerTimelinePage === 0 && styles.passengerPageButtonDisabled]}
                    disabled={passengerTimelinePage === 0}
                    onPress={() => setPassengerTimelinePage((page) => Math.max(0, page - 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Previous passenger timeline page"
                  >
                    <ChevronLeft size={16} color={passengerTimelinePage === 0 ? '#8E8A89' : '#0F2247'} />
                    <Text style={styles.passengerPageButtonText}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={styles.passengerPageLabel}>Page {passengerTimelinePage + 1} of {passengerTimelinePageCount} · 20 at a time</Text>
                  <TouchableOpacity
                    style={[styles.passengerPageButton, passengerTimelinePage >= passengerTimelinePageCount - 1 && styles.passengerPageButtonDisabled]}
                    disabled={passengerTimelinePage >= passengerTimelinePageCount - 1}
                    onPress={() => setPassengerTimelinePage((page) => Math.min(passengerTimelinePageCount - 1, page + 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Next passenger timeline page"
                  >
                    <Text style={styles.passengerPageButtonText}>Next</Text>
                    <ChevronRight size={16} color={passengerTimelinePage >= passengerTimelinePageCount - 1 ? '#8E8A89' : '#0F2247'} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {!tarotMonthMode && <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.cruise }]} />
              <Text style={styles.legendText}>Easy Seas</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.travel }]} />
              <Text style={styles.legendText}>Travel</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.personal }]} />
              <Text style={styles.legendText}>Personal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.sea }]} />
              <Text style={styles.legendText}>Sea</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: EVENT_COLORS.expiration }]} />
              <Text style={styles.legendText}>Expiry</Text>
            </View>
          </View>}

          {!tarotMonthMode ? <TouchableOpacity
            style={styles.passengerPermanentButton}
            onPress={() => router.push('/passenger-calendar' as any)}
            activeOpacity={0.84}
            testID="open-passenger-calendar-drilldown"
          >
            <View style={styles.passengerPermanentIcon}>
              <Users size={16} color="#0E7FA7" />
            </View>
            <View style={styles.passengerPermanentCopy}>
              <Text style={styles.passengerPermanentTitle}>Voyage timeline</Text>
              <Text style={styles.passengerPermanentSubtitle}>Sea days, port days, land gaps, expirations, and annual planning.</Text>
            </View>
            <ChevronRight size={18} color="#0E7FA7" />
          </TouchableOpacity> : null}

          {!tarotMonthMode ? <TouchableOpacity
            style={styles.crewNavigationButton}
            onPress={() => router.push('/crew-recognition' as any)}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="Open Crew Recognition"
            testID="calendar-open-crew-recognition"
          >
            <View style={styles.crewNavigationIcon}><Users size={17} color="#167C80" /></View>
            <View style={styles.crewNavigationCopy}>
              <Text style={styles.crewNavigationTitle}>Crew recognition</Text>
              <Text style={styles.crewNavigationSubtitle}>Names, ships, recognition history, surveys, and imports · {crewOwnerLabel}</Text>
            </View>
            <ChevronRight size={18} color="#167C80" />
          </TouchableOpacity> : null}

          {viewMode === 'events' && (
            <View style={styles.eventsListSection}>
              <ThemedSectionHeader
                tab="calendar"
                emoji="⏰"
                title={hasFutureEvents ? 'Upcoming events' : featuredEvents.length > 0 ? 'Recent cruise events' : 'Upcoming events'}
                subtitle={`${featuredEvents.length} event${featuredEvents.length === 1 ? '' : 's'} in this view`}
                tone="info"
                compact
                testID="calendar-upcoming-events-section"
              />
              
              {featuredEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <CalendarDays size={48} color={COLORS.navyDeep} />
                  </View>
                  <Text style={styles.emptyTitle}>No Events Found</Text>
                  <Text style={styles.emptyText}>
                    {normalizedBookedCruises.length > 0
                      ? 'Your cruises are loaded, but none have usable dates yet.'
                      : 'Import calendar events or book a cruise to see them here'}
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
                  {featuredEvents.map((item, index) => renderEventCard(item, index))}
                </View>
              )}
            </View>
          )}

          {!tarotMonthMode && viewMode !== 'events' && featuredEvents.length > 0 && (
            <View style={styles.eventsListSection}>
              <ThemedSectionHeader
                tab="calendar"
                emoji={hasFutureEvents ? '🧭' : '📖'}
                title={hasFutureEvents ? 'Next up' : 'Cruise history'}
                subtitle="A quick look at the most relevant voyage events."
                compact
              />
              <View style={styles.eventsList}>
                {featuredEvents.slice(0, 3).map((item, index) => renderEventCard(item, index))}
              </View>
            </View>
          )}

          {!tarotMonthMode ? (
            <>
              <View style={styles.crewSectionContainer}>
                <ThemedSectionHeader tab="calendar" emoji="🌐" title="Time zones" subtitle="Keep ship time and home time aligned." tone="info" compact />
                <TimeZoneConverter embedded />
              </View>
            </>
          ) : null}
          
            <View style={styles.bottomSpacer} />
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F2EA',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  heroHeader: {
    backgroundColor: '#FFFDF9',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: 6,
    marginTop: SPACING.xs,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 66,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },

  heroOverlay: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  heroTitle: {
    fontSize: 19,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: '#0F2247',
    letterSpacing: 0.4,
    textAlign: 'left' as const,
  },
  heroSubtitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#58585B',
    marginTop: 2,
    letterSpacing: 0.1,
    textAlign: 'left' as const,
  },
  heroSignature: {
    width: 86,
    height: 34,
    marginTop: 0,
    opacity: 1,
  },
  passengerPermanentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 0,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D2C8',
    ...SHADOW.sm,
  },
  passengerPermanentIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F2',
  },
  passengerPermanentCopy: {
    flex: 1,
  },
  passengerPermanentEyebrow: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#0E7FA7',
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  passengerPermanentTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900' as const,
    color: '#0F2247',
  },
  passengerPermanentSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#60727F',
    lineHeight: 16,
  },
  crewNavigationButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 0,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B8DAD9',
    backgroundColor: '#FFFFFF',
    ...SHADOW.sm,
  },
  crewNavigationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2F4F2' },
  crewNavigationCopy: { flex: 1 },
  crewNavigationTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: '#17324D' },
  crewNavigationSubtitle: { marginTop: 2, fontSize: 11, lineHeight: 15, color: '#60727F' },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D8D2C8',
  },
  viewToggleButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: '#167C80',
  },
  viewToggleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  viewToggleTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B9C9C8',
  },
  clearEventsButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginLeft: 6,
  },
  tarotMonthButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(109, 40, 217, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(109, 40, 217, 0.30)',
    marginLeft: 6,
  },
  tarotMonthButtonActive: {
    backgroundColor: '#273D9A',
    borderColor: '#1C2F7A',
  },
  jumpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    ...SHADOW.sm,
  },
  jumpBannerTextGroup: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  jumpBannerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  jumpBannerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.72,
  },
  monthYearContainer: {
    alignItems: 'center',
    flex: 1,
  },
  monthYearText: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.navyDeep,
  },
  eventCountText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.7,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginHorizontal: 0,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.1)',
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    margin: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#E6B63D',
    backgroundColor: 'transparent',
  },
  otherMonthCell: {
    opacity: 0.35,
  },
  dayNumber: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  todayNumber: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#E6B63D',
  },
  otherMonthNumber: {
    color: COLORS.navyDeep,
    opacity: 0.4,
  },
  dayNumberWithEvents: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  eventDotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    gap: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tarotDayContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
    paddingBottom: 2,
  },
  tarotDayName: {
    marginTop: 1,
    color: '#273D9A',
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  passengerViewCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  passengerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  passengerHeaderCopy: {
    flex: 1,
  },
  passengerDrillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  passengerDrillButtonText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  passengerTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 21,
    fontWeight: '600',
    color: COLORS.navyDeep,
  },
  passengerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.68,
    marginTop: 2,
  },
  passengerCountBadge: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  passengerCountText: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  passengerStatsGrid: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  passengerStat: {
    flex: 1,
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  passengerStatValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  passengerStatLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.66,
    marginTop: 2,
  },
  passengerList: {
    gap: SPACING.xs,
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    overflow: 'hidden',
  },
  passengerItemRail: {
    width: 5,
    alignSelf: 'stretch',
  },
  passengerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  passengerItemCopy: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  passengerItemTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  passengerItemSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.68,
    marginTop: 2,
  },
  passengerItemDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    paddingRight: SPACING.sm,
  },
  passengerPagination: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  passengerPageButton: {
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  passengerPageButtonDisabled: {
    opacity: 0.48,
  },
  passengerPageButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0F2247',
  },
  passengerPageLabel: {
    flex: 1,
    minWidth: 120,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
    color: '#58585B',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    gap: SPACING.md,
    flexWrap: 'wrap',
    ...SHADOW.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  ninetyDaysContainer: {
    backgroundColor: '#FFFDF9',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  ninetyDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  ninetyDayCell: {
    width: '6.1%',
    aspectRatio: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 31, 63, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNinetyCell: {
    borderWidth: 1,
    borderColor: '#E6B63D',
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
    color: COLORS.navyDeep,
    opacity: 0.7,
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
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    flex: 1,
  },
  eventCountBadge: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  eventsList: {
    gap: SPACING.sm,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
    color: COLORS.navyDeep,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  eventCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  eventCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginBottom: SPACING.xs,
  },
  eventCardDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
  },
  addEventText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  bottomSpacer: {
    height: 120,
  },
  crewSectionContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
});
