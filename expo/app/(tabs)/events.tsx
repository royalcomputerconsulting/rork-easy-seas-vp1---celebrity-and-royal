import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, ChevronRight, Ship, Plane, User, Users, Plus, AlertTriangle, Ban, Gift, Award, MapPin, Clock } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import type { CalendarEvent, BookedCruise, CasinoOffer } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { CrewRecognitionSection } from '@/components/crew-recognition/CrewRecognitionSection';
import { TimeZoneConverter } from '@/components/TimeZoneConverter';
import { getCalendarEventsWithGeneratedCruiseEvents, getNormalizedCruiseDateRange } from '@/lib/calendar/cruiseEvents';
import { getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useCertificates } from '@/state/CertificatesProvider';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { useUser } from '@/state/UserProvider';
import { filterRecordsByIntelligence } from '@/lib/intelligenceFilters';
import { deriveCruiseDayPlan } from '@/lib/cruisePlanningIntelligence';

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
  cruise: '#22C55E',
  travel: '#3B82F6', 
  personal: '#A855F7',
  sea: '#2563EB',
  port: '#16A34A',
  gap: '#DC2626',
  expiration: '#D97706',
  tier: '#7C3AED',
  land: '#94A3B8',
  passengerPersonal: '#EA580C',
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

export default function EventsScreen() {
  const router = useRouter();
  const { localData } = useAppState();
  const coreData = useCoreData();
  const { bookedCruises } = coreData;
  const { certificates } = useCertificates();
  const { users } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

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
    return filteredBookedCruises
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

  const calendarEvents = useMemo(() => {
    const mergedEvents = getCalendarEventsWithGeneratedCruiseEvents(
      normalizedBookedCruises,
      sourceCalendarEvents
    );
    console.log('[Events] Calendar events updated:', {
      mergedEvents: mergedEvents.length,
      bookedCruises: normalizedBookedCruises.length,
    });
    return mergedEvents;
  }, [normalizedBookedCruises, sourceCalendarEvents]);

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
    const bgColor = getDayBackgroundColor(day);
    
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
          hasEvents && day.isCurrentMonth && styles.dayNumberWithEvents,
        ]}>
          {day.dayNumber}
        </Text>
        {hasEvents && (
          <View style={styles.eventDotsContainer}>
            {renderEventDots(day.events)}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [renderEventDots, handleDayPress, getDayBackgroundColor]);

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
          subtitle: `${Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1} land day(s) before ${nextCruise.shipName}`,
          color: EVENT_COLORS.gap,
        });
      }
    });

    sourceCalendarEvents.forEach((event) => {
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
  }, [filteredCertificates, filteredOffers, formatDateOnly, normalizedBookedCruises, sourceCalendarEvents]);

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
            pathname: '/(tabs)/(overview)/cruise-details' as any,
            params: { id: cruise.id },
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
  }, [router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ResponsiveContainer>
            <View style={styles.heroHeader}>

            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>Easy Seas™</Text>
              <Text style={styles.heroSubtitle}>Manage your Nautical Lifestyle™</Text>
              <Image
                source={{ uri: IMAGES.signature }}
                style={styles.heroSignature}
                resizeMode="contain"
              />
            </View>
          </View>

          <IntelligenceFilterStrip contextLabel="Calendar" variant="bookedCruises" />

          <TouchableOpacity
            style={styles.passengerPermanentButton}
            onPress={() => router.push('/passenger-calendar' as any)}
            activeOpacity={0.84}
            testID="open-passenger-calendar-drilldown"
          >
            <View style={styles.passengerPermanentIcon}>
              <Users size={20} color="#A7F3D0" />
            </View>
            <View style={styles.passengerPermanentCopy}>
              <Text style={styles.passengerPermanentEyebrow}>Permanent passenger calendar</Text>
              <Text style={styles.passengerPermanentTitle}>Open full passenger drill-down</Text>
              <Text style={styles.passengerPermanentSubtitle}>Sea days, port days, gaps, expirations, shared/solo travel</Text>
            </View>
            <ChevronRight size={20} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.viewToggleContainer}>
            {(['events', 'week', 'month', '90days', 'passenger'] as ViewMode[]).map((mode) => (
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
                  {mode === 'events' ? 'Events' : mode === 'week' ? 'Week' : mode === 'month' ? 'Month' : mode === '90days' ? '90 Days' : 'Passenger'}
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
                <ChevronLeft size={24} color={COLORS.navyDeep} />
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
                <ChevronRight size={24} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>
          )}

          {(viewMode === 'month' || viewMode === 'week') && totalEventsThisMonth === 0 && featuredEvents.length > 0 && (
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

          {totalEventsThisMonth > 10 && viewMode === 'month' && (
            <View style={styles.alertBadge}>
              <AlertTriangle size={14} color={COLORS.white} />
              <Text style={styles.alertBadgeText}>{totalEventsThisMonth}</Text>
            </View>
          )}

          {viewMode === 'month' && (
            <View style={styles.calendarContainer}>
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
                {passengerDayItems.slice(0, 80).map((item) => {
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
            </View>
          )}

          <View style={styles.legendContainer}>
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
          </View>

          {viewMode === 'events' && (
            <View style={styles.eventsListSection}>
              <View style={styles.sectionHeader}>
                <CalendarDays size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>
                  {hasFutureEvents ? 'Upcoming Events' : featuredEvents.length > 0 ? 'Recent Cruise Events' : 'Upcoming Events'}
                </Text>
                <Text style={styles.eventCountBadge}>{featuredEvents.length}</Text>
              </View>
              
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

          {viewMode !== 'events' && featuredEvents.length > 0 && (
            <View style={styles.eventsListSection}>
              <View style={styles.sectionHeader}>
                <CalendarDays size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>{hasFutureEvents ? 'Next Up' : 'Cruise History'}</Text>
              </View>
              <View style={styles.eventsList}>
                {featuredEvents.slice(0, 3).map((item, index) => renderEventCard(item, index))}
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
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F1',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroHeader: {
    backgroundColor: COLORS.navyDeep,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    ...SHADOW.lg,
  },

  heroOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 1,
    textAlign: 'center' as const,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 6,
    letterSpacing: 0.3,
    textAlign: 'center' as const,
  },
  heroSignature: {
    width: 240,
    height: 100,
    marginTop: 14,
    opacity: 0.8,
  },
  passengerPermanentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 22,
    backgroundColor: COLORS.navyDeep,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.24)',
    ...SHADOW.md,
  },
  passengerPermanentIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 243, 208, 0.12)',
  },
  passengerPermanentCopy: {
    flex: 1,
  },
  passengerPermanentEyebrow: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#A7F3D0',
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  passengerPermanentTitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  passengerPermanentSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 16,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: COLORS.navyDeep,
  },
  viewToggleText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
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
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
    borderColor: '#F59E0B',
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
    color: '#F59E0B',
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
  passengerViewCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0,31,63,0.1)',
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
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
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
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderColor: '#E2E8F0',
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
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
