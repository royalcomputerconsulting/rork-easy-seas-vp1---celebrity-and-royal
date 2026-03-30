import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft,
  Ship,
  Plane,
  User,
  Calendar,
  Clock,
  MapPin,
  Anchor,
  Waves,
  Users,
  Dices,
  RefreshCcw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, DS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { CasinoSessionTracker } from '@/components/CasinoSessionTracker';
import { AddSessionModal } from '@/components/AddSessionModal';
import type { PlayingHours } from '@/state/UserProvider';
import { createDateFromString } from '@/lib/date';
import { calculatePersonalizedLuck, type HoroscopeLuckResult } from '@/lib/luckCalculator';
import {
  buildDailyIntelligenceReading,
  type BestMoveType,
  type DailyIntelligenceReading,
  type MomentumLevel,
} from '@/lib/dailyIntelligence';
import { determineCasinoHoursWithContext, determineSeaDay, getResolvedCruiseItinerary, type CasinoDayContext } from '@/lib/casinoAvailability';
import type { CalendarEvent, BookedCruise, ItineraryDay } from '@/types/models';
import { useCoreData } from '@/state/CoreDataProvider';
import { TimeZoneConverter } from '@/components/TimeZoneConverter';

const EVENT_COLORS = {
  cruise: '#3B82F6',
  travel: '#F59E0B', 
  personal: '#10B981',
  port: '#10B981',
  seaDay: '#0EA5E9',
  casino: '#F59E0B',
  opportune: '#10B981',
};

interface AgendaItem {
  id: string;
  type: 'cruise' | 'travel' | 'personal' | 'calendar';
  title: string;
  subtitle?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  color: string;
  data: CalendarEvent | BookedCruise | MergedCruiseData;
  dayStatus?: 'start' | 'middle' | 'end' | 'single';
}

interface MergedCruiseData {
  id: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  destination?: string;
  itineraryName?: string;
  departurePort?: string;
  nights: number;
  itinerary?: ItineraryDay[];
  ports?: string[];
  bookings: {
    reservationNumber?: string;
    cabinNumber?: string;
    cabinType?: string;
    guestNames?: string[];
    guests?: number;
  }[];
}

interface TimelineEvent {
  id: string;
  type: 'port' | 'sea' | 'departure' | 'arrival' | 'casino' | 'calendar' | 'opportune';
  title: string;
  subtitle?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  color: string;
  icon: 'port' | 'sea' | 'ship' | 'casino' | 'calendar' | 'opportune';
  notes?: string;
  isOpportune?: boolean;
}

function formatAgendaDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCruiseRangeEndDate(sailDate: string, returnDate: string | undefined, nights: number | undefined): string {
  if (returnDate && returnDate.trim().length > 0) {
    return returnDate;
  }

  const fallbackEndDate = createDateFromString(sailDate);
  fallbackEndDate.setHours(0, 0, 0, 0);
  fallbackEndDate.setDate(fallbackEndDate.getDate() + Math.max(1, nights ?? 0));
  const computedReturnDate = formatAgendaDateKey(fallbackEndDate);

  console.log('[DayAgenda] Derived fallback return date', {
    sailDate,
    returnDate,
    nights,
    computedReturnDate,
  });

  return computedReturnDate;
}

function getItineraryWindowText(itineraryDay: ItineraryDay | undefined | null): string | undefined {
  if (!itineraryDay || itineraryDay.isSeaDay) {
    return undefined;
  }

  if (itineraryDay.arrival && itineraryDay.departure) {
    return `${itineraryDay.arrival} - ${itineraryDay.departure}`;
  }

  if (itineraryDay.arrival) {
    return `From ${itineraryDay.arrival} • Overnight`;
  }

  if (itineraryDay.departure) {
    return `Until ${itineraryDay.departure}`;
  }

  return itineraryDay.notes || 'Port day';
}

interface ScoreDotsProps {
  score: number;
  activeColor: string;
  inactiveColor?: string;
  testID?: string;
}

const ScoreDots = React.memo(function ScoreDots({
  score,
  activeColor,
  inactiveColor = 'rgba(255,255,255,0.12)',
  testID,
}: ScoreDotsProps) {
  return (
    <View style={styles.intelligenceScoreMeter} testID={testID}>
      {Array.from({ length: 9 }).map((_, index) => (
        <View
          key={`score-dot-${index}`}
          style={[
            styles.intelligenceScoreDot,
            { backgroundColor: index < score ? activeColor : inactiveColor },
          ]}
        />
      ))}
    </View>
  );
});

function getMomentumLabel(momentumLevel: MomentumLevel): string {
  if (momentumLevel === 'explosive') {
    return 'Explosive';
  }

  if (momentumLevel === 'slow') {
    return 'Slow';
  }

  return 'Steady';
}

function getMomentumColor(momentumLevel: MomentumLevel): string {
  if (momentumLevel === 'explosive') {
    return '#A78BFA';
  }

  if (momentumLevel === 'slow') {
    return '#FCA5A5';
  }

  return '#93C5FD';
}

function getBestMoveColors(bestMoveType: BestMoveType): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  if (bestMoveType === 'Execute') {
    return {
      backgroundColor: 'rgba(16,185,129,0.14)',
      borderColor: 'rgba(16,185,129,0.38)',
      textColor: '#6EE7B7',
    };
  }

  if (bestMoveType === 'Wait') {
    return {
      backgroundColor: 'rgba(245,158,11,0.14)',
      borderColor: 'rgba(245,158,11,0.38)',
      textColor: '#FCD34D',
    };
  }

  if (bestMoveType === 'Exit') {
    return {
      backgroundColor: 'rgba(248,113,113,0.14)',
      borderColor: 'rgba(248,113,113,0.38)',
      textColor: '#FCA5A5',
    };
  }

  return {
    backgroundColor: 'rgba(96,165,250,0.14)',
    borderColor: 'rgba(96,165,250,0.38)',
    textColor: '#93C5FD',
  };
}

export default function DayAgendaScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { localData } = useAppState();
  const { currentUser } = useUser();
  const coreData = useCoreData();
  const { bookedCruises } = coreData;

  const playingHours: PlayingHours = currentUser?.playingHours || DEFAULT_PLAYING_HOURS;
  const { getSessionsForDate, getDailySummary, addSession, removeSession } = useCasinoSessions();
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedDate = useMemo(() => {
    if (!date) return new Date();
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [date]);

  const formattedDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  const calendarEvents = useMemo(() => {
    return [...(localData.calendar || []), ...(localData.tripit || [])];
  }, [localData.calendar, localData.tripit]);

  const isDateInRange = useCallback((targetDate: Date, startStr: string, endStr: string): boolean => {
    const start = createDateFromString(startStr);
    const end = createDateFromString(endStr);
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return targetDateOnly >= start && targetDateOnly <= end;
  }, []);

  const getDayStatus = useCallback((targetDate: Date, startStr: string, endStr: string): 'start' | 'middle' | 'end' | 'single' => {
    const start = createDateFromString(startStr);
    const end = createDateFromString(endStr);
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    targetDateOnly.setHours(0, 0, 0, 0);
    
    const startTime = start.getTime();
    const endTime = end.getTime();
    const targetTime = targetDateOnly.getTime();
    
    if (startTime === endTime) return 'single';
    if (targetTime === startTime) return 'start';
    if (targetTime === endTime) return 'end';
    return 'middle';
  }, []);

  const mergedCruiseBookings = useMemo((): MergedCruiseData[] => {
    const cruiseMap = new Map<string, MergedCruiseData>();

    bookedCruises.forEach((cruise: BookedCruise) => {
      if (!cruise.sailDate) {
        return;
      }

      const computedReturnDate = getCruiseRangeEndDate(cruise.sailDate, cruise.returnDate, cruise.nights);

      if (!isDateInRange(selectedDate, cruise.sailDate, computedReturnDate)) {
        return;
      }

      const key = `${cruise.shipName}-${cruise.sailDate}-${computedReturnDate}`;

      console.log('[DayAgenda] Matching cruise for selected date', {
        selectedDate: formatAgendaDateKey(selectedDate),
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        computedReturnDate,
        cruiseId: cruise.id,
      });

      if (cruiseMap.has(key)) {
        const existing = cruiseMap.get(key)!;
        existing.bookings.push({
          reservationNumber: cruise.reservationNumber,
          cabinNumber: cruise.cabinNumber,
          cabinType: cruise.cabinType,
          guestNames: cruise.guestNames,
          guests: cruise.guests,
        });
      } else {
        cruiseMap.set(key, {
          id: cruise.id,
          shipName: cruise.shipName || 'Unknown Ship',
          sailDate: cruise.sailDate,
          returnDate: computedReturnDate,
          destination: cruise.destination,
          itineraryName: cruise.itineraryName,
          departurePort: cruise.departurePort,
          nights: cruise.nights || 0,
          itinerary: getResolvedCruiseItinerary(cruise),
          ports: cruise.ports,
          bookings: [{
            reservationNumber: cruise.reservationNumber,
            cabinNumber: cruise.cabinNumber,
            cabinType: cruise.cabinType,
            guestNames: cruise.guestNames,
            guests: cruise.guests,
          }],
        });
      }
    });

    return Array.from(cruiseMap.values());
  }, [bookedCruises, selectedDate, isDateInRange]);

  const getDayOfCruise = useCallback((cruise: MergedCruiseData): number => {
    const start = createDateFromString(cruise.sailDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(selectedDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }, [selectedDate]);

  const getItineraryForDay = useCallback((cruise: MergedCruiseData, dayNum: number): ItineraryDay | undefined => {
    return cruise.itinerary?.find((day) => day.day === dayNum);
  }, []);

  const getCasinoContext = useCallback((cruise: MergedCruiseData, dayNum: number): CasinoDayContext => {
    const totalDays = cruise.nights + 1;
    const itinerary = cruise.itinerary || [];
    const currentDay = itinerary.find(d => d.day === dayNum);
    const nextDay = itinerary.find(d => d.day === dayNum + 1);
    const prevDay = itinerary.find(d => d.day === dayNum - 1);
    
    const isSeaDay = currentDay?.isSeaDay || (currentDay ? determineSeaDay(currentDay.port) : false);
    const nextDayIsSeaDay = nextDay ? (nextDay.isSeaDay || determineSeaDay(nextDay.port)) : undefined;
    const nextDayIsPortDay = nextDay ? !(nextDay.isSeaDay || determineSeaDay(nextDay.port)) : undefined;
    const previousDayIsSeaDay = prevDay ? (prevDay.isSeaDay || determineSeaDay(prevDay.port)) : undefined;
    
    return {
      dayNumber: dayNum,
      totalDays,
      isSeaDay,
      isDepartureDay: dayNum === 1,
      isDisembarkDay: dayNum === totalDays,
      previousDayIsSeaDay,
      nextDayIsSeaDay,
      nextDayIsPortDay,
      sailAwayTime: currentDay?.departure,
      port: currentDay?.port || 'Unknown',
    };
  }, []);

  const mergedCruiseBookingIds = useMemo(() => {
    return new Set<string>(mergedCruiseBookings.map((cruise) => cruise.id));
  }, [mergedCruiseBookings]);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    
    mergedCruiseBookings.forEach(cruise => {
      const dayNum = getDayOfCruise(cruise);
      const itineraryDay = getItineraryForDay(cruise, dayNum);
      const totalDays = cruise.nights + 1;
      const casinoContext = getCasinoContext(cruise, dayNum);
      const casinoInfo = determineCasinoHoursWithContext(casinoContext);
      
      if (itineraryDay) {
        if (itineraryDay.isSeaDay) {
          events.push({
            id: `sea-${cruise.id}`,
            type: 'sea',
            title: 'At Sea',
            subtitle: cruise.shipName,
            isAllDay: true,
            color: '#FFFFFF',
            icon: 'sea',
          });
          
          if (casinoInfo.open) {
            events.push({
              id: `casino-morning-${cruise.id}`,
              type: 'casino',
              title: 'Casino - Early Bird Session',
              subtitle: 'Morning gambling window',
              startTime: '05:00',
              endTime: '07:30',
              color: '#FFFFFF',
              icon: 'casino',
            });
            
            const closeTimeDisplay = casinoInfo.closeTime || '24 hrs (slots)';
            events.push({
              id: `casino-day-${cruise.id}`,
              type: 'casino',
              title: 'Casino - Main Hours',
              subtitle: casinoInfo.reason,
              startTime: '10:00',
              endTime: casinoInfo.closeTime || undefined,
              color: '#FFFFFF',
              icon: 'casino',
              notes: `Until ${closeTimeDisplay}`,
            });
          }
        } else {
          const portWindowText = getItineraryWindowText(itineraryDay);

          if (itineraryDay.arrival || itineraryDay.departure) {
            events.push({
              id: `port-window-${cruise.id}`,
              type: 'port',
              title: `In Port: ${itineraryDay.port}`,
              subtitle: portWindowText || 'Port window',
              startTime: itineraryDay.arrival || '00:00',
              endTime: itineraryDay.departure || (itineraryDay.arrival ? '23:59' : undefined),
              color: '#FFFFFF',
              icon: 'port',
              notes: itineraryDay.notes,
            });
          }

          if (itineraryDay.arrival) {
            events.push({
              id: `arrival-${cruise.id}`,
              type: 'arrival',
              title: `Arrive: ${itineraryDay.port}`,
              startTime: itineraryDay.arrival,
              color: '#FFFFFF',
              icon: 'port',
              notes: itineraryDay.notes,
            });
          }
          
          if (itineraryDay.arrival && itineraryDay.departure) {
            events.push({
              id: `docked-${cruise.id}`,
              type: 'port',
              title: `Docked: ${itineraryDay.port}`,
              subtitle: 'Ship docked at port',
              startTime: itineraryDay.arrival,
              endTime: itineraryDay.departure,
              color: '#FFFFFF',
              icon: 'port',
            });
          } else if (!itineraryDay.arrival && itineraryDay.departure) {
            events.push({
              id: `embark-${cruise.id}`,
              type: 'departure',
              title: `Embarkation: ${itineraryDay.port}`,
              subtitle: 'Ship departs',
              startTime: itineraryDay.departure,
              color: EVENT_COLORS.cruise,
              icon: 'ship',
            });
          } else if (itineraryDay.arrival && !itineraryDay.departure) {
            events.push({
              id: `debark-${cruise.id}`,
              type: 'arrival',
              title: `Disembarkation: ${itineraryDay.port}`,
              subtitle: 'Cruise ends',
              startTime: itineraryDay.arrival,
              color: EVENT_COLORS.cruise,
              icon: 'ship',
            });
          }
          
          if (itineraryDay.departure) {
            events.push({
              id: `depart-${cruise.id}`,
              type: 'departure',
              title: `Depart: ${itineraryDay.port}`,
              startTime: itineraryDay.departure,
              color: EVENT_COLORS.cruise,
              icon: 'ship',
            });
          }
          
          if (casinoInfo.open && casinoInfo.openTime) {
            const closeTimeDisplay = casinoInfo.closeTime || '24 hrs (slots)';
            events.push({
              id: `casino-port-${cruise.id}`,
              type: 'casino',
              title: 'Casino Opens',
              subtitle: casinoInfo.reason,
              startTime: casinoInfo.openTime,
              endTime: casinoInfo.closeTime || undefined,
              color: '#FFFFFF',
              icon: 'casino',
              notes: `Opens ~1.5 hrs after sail away, until ${closeTimeDisplay}`,
            });
          } else if (!casinoInfo.open) {
            events.push({
              id: `casino-closed-${cruise.id}`,
              type: 'casino',
              title: 'Casino Closed',
              subtitle: casinoInfo.reason,
              isAllDay: true,
              color: '#6B7280',
              icon: 'casino',
            });
          }
        }
      } else {
        if (dayNum === 1) {
          events.push({
            id: `embark-${cruise.id}`,
            type: 'departure',
            title: `Embarkation Day`,
            subtitle: cruise.departurePort || 'Departure Port',
            color: EVENT_COLORS.cruise,
            icon: 'ship',
          });
          
          if (casinoInfo.open && casinoInfo.openTime) {
            const closeTimeDisplay = casinoInfo.closeTime || '24 hrs (slots)';
            events.push({
              id: `casino-depart-${cruise.id}`,
              type: 'casino',
              title: 'Casino Opens After Sail Away',
              subtitle: casinoInfo.reason,
              startTime: casinoInfo.openTime,
              endTime: casinoInfo.closeTime || undefined,
              color: '#FFFFFF',
              icon: 'casino',
              notes: `Opens ~1.5 hrs after sail away, until ${closeTimeDisplay}`,
            });
          }
        } else if (dayNum === totalDays) {
          events.push({
            id: `debark-${cruise.id}`,
            type: 'arrival',
            title: `Disembarkation Day`,
            subtitle: cruise.departurePort || 'Return Port',
            color: EVENT_COLORS.cruise,
            icon: 'ship',
          });
          
          events.push({
            id: `casino-debark-${cruise.id}`,
            type: 'casino',
            title: 'Casino Closed',
            subtitle: 'Disembarkation day',
            isAllDay: true,
            color: '#6B7280',
            icon: 'casino',
          });
        }
      }
    });
    
    calendarEvents.forEach(event => {
      if (event.sourceType === 'cruise' && event.cruiseId && mergedCruiseBookingIds.has(event.cruiseId)) {
        return;
      }

      const eventStart = event.startDate || event.start || '';
      const rawEventEnd = event.endDate || event.end;
      const eventEnd = event.type === 'cruise'
        ? getCruiseRangeEndDate(eventStart, rawEventEnd, undefined)
        : (rawEventEnd || eventStart);
      
      if (eventStart) {
        const startDateStr = eventStart.split('T')[0];
        const endDateStr = eventEnd.split('T')[0];
        
        if (dateStr >= startDateStr && dateStr <= endDateStr) {
          events.push({
            id: `cal-${event.id}`,
            type: 'calendar',
            title: event.title,
            subtitle: event.location || event.description,
            startTime: eventStart.includes('T') ? eventStart.split('T')[1]?.substring(0, 5) : undefined,
            endTime: eventEnd.includes('T') ? eventEnd.split('T')[1]?.substring(0, 5) : undefined,
            isAllDay: event.allDay || !eventStart.includes('T'),
            color: event.type === 'travel' || event.type === 'flight' ? EVENT_COLORS.travel : EVENT_COLORS.personal,
            icon: 'calendar',
          });
        }
      }
    });
    
    events.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      return 0;
    });
    
    return events;
  }, [selectedDate, mergedCruiseBookings, mergedCruiseBookingIds, calendarEvents, getDayOfCruise, getItineraryForDay, getCasinoContext]);

  const agendaItems = useMemo((): AgendaItem[] => {
    const items: AgendaItem[] = [];
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    calendarEvents.forEach(event => {
      if (event.sourceType === 'cruise' && event.cruiseId && mergedCruiseBookingIds.has(event.cruiseId)) {
        return;
      }

      const eventStart = event.startDate || event.start || '';
      const rawEventEnd = event.endDate || event.end;
      const eventEnd = event.type === 'cruise'
        ? getCruiseRangeEndDate(eventStart, rawEventEnd, undefined)
        : (rawEventEnd || eventStart);
      
      if (eventStart) {
        const startDateStr = eventStart.split('T')[0];
        const endDateStr = eventEnd.split('T')[0];
        
        if (dateStr >= startDateStr && dateStr <= endDateStr) {
          const eventType = event.type === 'cruise' ? 'cruise' 
            : (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') ? 'travel' 
            : 'personal';
          
          const eventColor = event.type === 'cruise' ? EVENT_COLORS.cruise 
            : (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') ? EVENT_COLORS.travel 
            : EVENT_COLORS.personal;

          items.push({
            id: `event-${event.id}`,
            type: eventType,
            title: event.title,
            subtitle: event.description,
            location: event.location,
            startTime: eventStart.includes('T') ? eventStart.split('T')[1]?.substring(0, 5) : undefined,
            endTime: eventEnd.includes('T') ? eventEnd.split('T')[1]?.substring(0, 5) : undefined,
            isAllDay: event.allDay || !eventStart.includes('T'),
            color: eventColor,
            data: event,
            dayStatus: getDayStatus(selectedDate, eventStart, eventEnd),
          });
        }
      }
    });

    mergedCruiseBookings.forEach((cruise) => {
      const dayNum = getDayOfCruise(cruise);
      const itineraryDay = getItineraryForDay(cruise, dayNum);
      const itineraryWindow = getItineraryWindowText(itineraryDay);

      items.push({
        id: `cruise-${cruise.id}`,
        type: 'cruise',
        title: cruise.shipName,
        subtitle: itineraryDay
          ? itineraryDay.isSeaDay
            ? `At Sea • ${cruise.destination || cruise.itineraryName || 'Cruise day'}`
            : `${itineraryDay.port}${itineraryWindow ? ` • ${itineraryWindow}` : ''}`
          : cruise.destination || cruise.itineraryName,
        location: itineraryDay && !itineraryDay.isSeaDay ? itineraryDay.port : cruise.departurePort,
        isAllDay: true,
        color: EVENT_COLORS.cruise,
        data: cruise,
        dayStatus: getDayStatus(selectedDate, cruise.sailDate, cruise.returnDate),
      });
    });

    items.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      return 0;
    });

    return items;
  }, [selectedDate, calendarEvents, mergedCruiseBookingIds, mergedCruiseBookings, getDayOfCruise, getDayStatus, getItineraryForDay]);

  const handleItemPress = useCallback((item: AgendaItem) => {
    if (item.type === 'cruise' && 'sailDate' in item.data) {
      const cruiseData = item.data as MergedCruiseData;
      router.push({
        pathname: '/(tabs)/(overview)/cruise-details' as any,
        params: { id: cruiseData.id },
      });
    }
  }, [router]);

  const renderDayStatusBadge = useCallback((status: 'start' | 'middle' | 'end' | 'single') => {
    const labels: Record<string, string> = {
      start: 'Day 1',
      middle: 'Ongoing',
      end: 'Last Day',
      single: 'Today Only',
    };
    
    return (
      <View style={styles.dayStatusBadge}>
        <Text style={styles.dayStatusText}>{labels[status]}</Text>
      </View>
    );
  }, []);

  const getIcon = useCallback((type: string) => {
    switch (type) {
      case 'cruise':
        return Ship;
      case 'travel':
        return Plane;
      default:
        return User;
    }
  }, []);

  const getTimelineIcon = useCallback((iconType: string) => {
    switch (iconType) {
      case 'port':
        return Anchor;
      case 'sea':
        return Waves;
      case 'ship':
        return Ship;
      case 'casino':
        return Dices;
      case 'calendar':
        return Calendar;
      case 'opportune':
        return Dices;
      default:
        return Calendar;
    }
  }, []);

  const timeToMinutes = useCallback((time: string): number => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  }, []);

  const minutesToTime = useCallback((minutes: number): string => {
    const normalizedMinutes = minutes >= 0 ? minutes % (24 * 60) : (24 * 60 + minutes) % (24 * 60);
    const hours = Math.floor(normalizedMinutes / 60);
    const mins = normalizedMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }, []);

  const calculateOverlap = useCallback((start1: string, end1: string, start2: string, end2: string): { start: string; end: string } | null => {
    const s1 = timeToMinutes(start1);
    let e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    let e2 = timeToMinutes(end2);
    
    if (e1 <= s1) e1 += 24 * 60;
    if (e2 <= s2) e2 += 24 * 60;
    
    const overlapStart = Math.max(s1, s2);
    const overlapEnd = Math.min(e1, e2);
    
    if (overlapStart >= overlapEnd) return null;
    
    return {
      start: minutesToTime(overlapStart),
      end: minutesToTime(overlapEnd),
    };
  }, [timeToMinutes, minutesToTime]);

  const opportunePlayingTimes = useMemo((): TimelineEvent[] => {
    if (!playingHours.enabled) return [];
    
    const opportuneTimes: TimelineEvent[] = [];
    const enabledSessions = playingHours.sessions.filter(s => s.enabled);
    
    const casinoEvents = timelineEvents.filter(e => e.type === 'casino' && e.startTime && e.color !== '#6B7280');
    
    casinoEvents.forEach(casinoEvent => {
      if (!casinoEvent.startTime) return;
      
      const casinoStart = casinoEvent.startTime;
      const casinoEnd = casinoEvent.endTime || '23:59';
      
      enabledSessions.forEach(session => {
        const overlap = calculateOverlap(casinoStart, casinoEnd, session.startTime, session.endTime);
        
        if (overlap) {
          const existingOpportune = opportuneTimes.find(
            t => t.startTime === overlap.start && t.endTime === overlap.end
          );
          
          if (!existingOpportune) {
            opportuneTimes.push({
              id: `opportune-${session.id}-${casinoEvent.id}`,
              type: 'opportune',
              title: `Opportune: ${session.name}`,
              subtitle: 'Casino open + your preferred time',
              startTime: overlap.start,
              endTime: overlap.end,
              color: EVENT_COLORS.opportune,
              icon: 'opportune',
              isOpportune: true,
            });
          }
        }
      });
    });
    
    return opportuneTimes.sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      return 0;
    });
  }, [playingHours, timelineEvents, calculateOverlap]);

  const dateStr = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);

  const horoscopeLuck = useMemo((): HoroscopeLuckResult | null => {
    if (!currentUser?.birthdate) return null;
    return calculatePersonalizedLuck(currentUser.birthdate, dateStr);
  }, [currentUser?.birthdate, dateStr]);

  const dailyIntelligence = useMemo((): DailyIntelligenceReading | null => {
    if (!horoscopeLuck || !currentUser?.birthdate) {
      return null;
    }

    return buildDailyIntelligenceReading(currentUser.birthdate, selectedDate, horoscopeLuck);
  }, [currentUser?.birthdate, horoscopeLuck, selectedDate]);

  const bestMoveColors = useMemo(() => {
    return getBestMoveColors(dailyIntelligence?.alignment.bestMoveType ?? 'Explore');
  }, [dailyIntelligence?.alignment.bestMoveType]);

  const westernMomentumColor = useMemo(() => {
    return getMomentumColor(dailyIntelligence?.western.momentumLevel ?? 'steady');
  }, [dailyIntelligence?.western.momentumLevel]);

  const westernMomentumLabel = useMemo(() => {
    return getMomentumLabel(dailyIntelligence?.western.momentumLevel ?? 'steady');
  }, [dailyIntelligence?.western.momentumLevel]);

  const goldenTimeSlots = useMemo(() => {
    return opportunePlayingTimes.map(t => ({
      id: t.id,
      startTime: t.startTime || '00:00',
      endTime: t.endTime || '23:59',
      durationMinutes: (() => {
        if (!t.startTime || !t.endTime) return 0;
        const start = timeToMinutes(t.startTime);
        let end = timeToMinutes(t.endTime);
        if (end <= start) end += 24 * 60;
        return end - start;
      })(),
      label: t.title.replace('Opportune: ', ''),
    }));
  }, [opportunePlayingTimes, timeToMinutes]);

  const casinoSessions = useMemo(() => {
    return getSessionsForDate(dateStr);
  }, [getSessionsForDate, dateStr]);

  const totalGoldenMinutes = useMemo(() => {
    return goldenTimeSlots.reduce((total, slot) => total + slot.durationMinutes, 0);
  }, [goldenTimeSlots]);

  const dailySummary = useMemo(() => {
    return getDailySummary(dateStr, totalGoldenMinutes);
  }, [getDailySummary, dateStr, totalGoldenMinutes]);

  const handleAddSession = useCallback(() => {
    setShowAddSessionModal(true);
  }, []);

  const handleSaveSession = useCallback(async (sessionData: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    notes?: string;
  }) => {
    await addSession({
      date: dateStr,
      ...sessionData,
    });
    setShowAddSessionModal(false);
  }, [addSession, dateStr]);

  const handleRemoveSession = useCallback(async (sessionId: string) => {
    await removeSession(sessionId);
  }, [removeSession]);

  const handleSyncEvents = useCallback(async () => {
    console.log('[DayAgenda] Syncing calendar events from booked cruises...');
    setIsSyncing(true);
    
    try {
      const existingEvents = coreData.calendarEvents.filter(e => e.sourceType !== 'cruise');
      
      const cruiseEvents: CalendarEvent[] = bookedCruises
        .filter((cruise) => Boolean(cruise.sailDate))
        .map((cruise) => {
          const computedReturnDate = getCruiseRangeEndDate(cruise.sailDate, cruise.returnDate, cruise.nights);

          return {
            id: `cruise-event-${cruise.id}`,
            title: `${cruise.shipName} - ${cruise.destination || cruise.itineraryName || 'Cruise'}`,
            startDate: cruise.sailDate,
            endDate: computedReturnDate,
            start: cruise.sailDate,
            end: computedReturnDate,
            type: 'cruise' as const,
            sourceType: 'cruise' as const,
            location: cruise.departurePort,
            description: `${cruise.nights} night cruise${cruise.reservationNumber ? ` - Res# ${cruise.reservationNumber}` : ''}${cruise.cabinNumber ? ` - Cabin ${cruise.cabinNumber}` : ''}`,
            cruiseId: cruise.id,
            allDay: true,
            source: 'import' as const,
          };
        });
      
      const allEvents = [...existingEvents, ...cruiseEvents];
      coreData.setCalendarEvents(allEvents);
      
      console.log(`[DayAgenda] Synced ${cruiseEvents.length} cruise events`);
    } catch (error) {
      console.error('[DayAgenda] Error syncing events:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [bookedCruises, coreData]);

  const renderTimelineEvent = useCallback((event: TimelineEvent) => {
    const IconComponent = getTimelineIcon(event.icon);
    const isOpportune = event.isOpportune || event.type === 'opportune';
    
    return (
      <View key={event.id} style={[
        styles.timelineEvent,
        isOpportune && styles.timelineEventOpportune,
      ]}>
        <View style={styles.timelineTime}>
          {event.startTime ? (
            <Text style={[
              styles.timelineTimeText,
              isOpportune && styles.timelineTimeTextOpportune,
            ]}>{event.startTime}</Text>
          ) : event.isAllDay ? (
            <Text style={styles.timelineAllDay}>All Day</Text>
          ) : null}
          {event.endTime && (
            <Text style={[
              styles.timelineEndTime,
              isOpportune && styles.timelineEndTimeOpportune,
            ]}>{event.endTime}</Text>
          )}
        </View>
        <View style={styles.timelineDot}>
          <View style={[
            styles.timelineDotInner, 
            { backgroundColor: event.color },
            isOpportune && styles.timelineDotInnerOpportune,
          ]} />
        </View>
        <View style={styles.timelineContent}>
          <View style={[
            styles.timelineIconBadge, 
            { backgroundColor: `${event.color}20` },
            isOpportune && styles.timelineIconBadgeOpportune,
          ]}>
            <IconComponent size={14} color={isOpportune ? '#FFFFFF' : event.color} />
          </View>
          <View style={styles.timelineTextContainer}>
            <Text style={[
              styles.timelineTitle,
              isOpportune && styles.timelineTitleOpportune,
            ]}>{event.title}</Text>
            {event.subtitle && (
              <Text style={[
                styles.timelineSubtitle,
                isOpportune && styles.timelineSubtitleOpportune,
              ]} numberOfLines={1}>{event.subtitle}</Text>
            )}
            {event.notes && (
              <Text style={styles.timelineNotes}>{event.notes}</Text>
            )}
          </View>
        </View>
      </View>
    );
  }, [getTimelineIcon]);

  const renderAgendaItem = useCallback((item: AgendaItem) => {
    const IconComponent = getIcon(item.type);
    const isCruise = item.type === 'cruise' && 'bookings' in item.data;
    const cruiseData = isCruise ? (item.data as MergedCruiseData) : null;
    const dayNum = cruiseData ? getDayOfCruise(cruiseData) : 0;
    const itineraryDay = cruiseData ? getItineraryForDay(cruiseData, dayNum) : null;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.agendaItem}
        activeOpacity={isCruise ? 0.7 : 1}
        onPress={() => handleItemPress(item)}
      >
        <View style={[styles.itemIndicator, { backgroundColor: item.color }]} />
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <View style={styles.itemTitleRow}>
              <View style={[styles.itemIconContainer, { backgroundColor: `${item.color}20` }]}>
                <IconComponent size={18} color={item.color} />
              </View>
              <View style={styles.itemTitleContainer}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                {item.dayStatus && renderDayStatusBadge(item.dayStatus)}
              </View>
            </View>
            
            {item.isAllDay ? (
              <View style={styles.allDayBadge}>
                <Text style={styles.allDayText}>Day {dayNum}</Text>
              </View>
            ) : item.startTime && (
              <View style={styles.timeContainer}>
                <Clock size={12} color="#FFFFFF" />
                <Text style={styles.timeText}>
                  {item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}
                </Text>
              </View>
            )}
          </View>

          {item.subtitle && (
            <Text style={styles.itemSubtitle} numberOfLines={2}>{item.subtitle}</Text>
          )}

          {item.location && (
            <View style={styles.locationContainer}>
              <MapPin size={12} color="#FFFFFF" />
              <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}

          {isCruise && cruiseData && (
            <>
              {itineraryDay && (
                <View style={styles.portStatusBadge}>
                  {itineraryDay.isSeaDay ? (
                    <View style={styles.seaDayBadge}>
                      <Waves size={14} color={EVENT_COLORS.seaDay} />
                      <Text style={styles.seaDayText}>At Sea</Text>
                      {itineraryDay.casinoOpen && (
                        <View style={styles.casinoOpenBadge}>
                          <Text style={styles.casinoOpenText}>Casino Open</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.portDayBadge}>
                      <Anchor size={14} color={EVENT_COLORS.port} />
                      <Text style={styles.portDayText}>{itineraryDay.port}</Text>
                      {getItineraryWindowText(itineraryDay) && (
                        <Text style={styles.portTimes}>
                          {getItineraryWindowText(itineraryDay)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
              
              <View style={styles.cruiseDetails}>
                <View style={styles.cruiseDetailItem}>
                  <Anchor size={12} color="#FFFFFF" />
                  <Text style={styles.cruiseDetailText}>
                    {cruiseData.nights} nights
                  </Text>
                </View>
                <View style={styles.cruiseDetailItem}>
                  <Users size={12} color="#FFFFFF" />
                  <Text style={styles.cruiseDetailText}>
                    {cruiseData.bookings.length} cabin{cruiseData.bookings.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              
              {cruiseData.bookings.length > 0 && (
                <View style={styles.bookingsContainer}>
                  {cruiseData.bookings.map((booking, index) => (
                    <View key={`booking-${index}`} style={styles.bookingRow}>
                      {booking.reservationNumber && (
                        <View style={styles.bookingBadge}>
                          <Text style={styles.bookingLabel}>Res#</Text>
                          <Text style={styles.bookingValue}>{booking.reservationNumber}</Text>
                        </View>
                      )}
                      {booking.cabinNumber && (
                        <View style={styles.bookingBadge}>
                          <Text style={styles.bookingLabel}>Cabin</Text>
                          <Text style={styles.bookingValue}>{booking.cabinNumber}</Text>
                        </View>
                      )}
                      {booking.guestNames && booking.guestNames.length > 0 && (
                        <Text style={styles.guestNames} numberOfLines={1}>
                          {booking.guestNames.join(', ')}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleItemPress, getIcon, renderDayStatusBadge, getDayOfCruise, getItineraryForDay]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      <LinearGradient
        colors={[COLORS.navyDeep, COLORS.navyMedium, COLORS.navyLight]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Calendar size={20} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Day Agenda</Text>
          </View>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncEvents}
            activeOpacity={0.7}
            disabled={isSyncing}
          >
            <RefreshCcw size={20} color={isSyncing ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <Text style={styles.eventCount}>
            {agendaItems.length} {agendaItems.length === 1 ? 'event' : 'events'}
          </Text>
          {horoscopeLuck && (
            <View style={styles.luckRow}>
              <View style={[styles.luckCard, { borderColor: horoscopeLuck.combinedHex + '80' }]}>
                <View style={[styles.luckScoreBadge, { backgroundColor: horoscopeLuck.combinedHex }]}>
                  <Text style={styles.luckScoreNum}>{String(horoscopeLuck.combinedScore)}</Text>
                </View>
                <View style={styles.luckCardText}>
                  <Text style={styles.luckCardTitle}>Today&apos;s Luck</Text>
                  <Text style={[styles.luckCardLabel, { color: horoscopeLuck.combinedHex }]}>{horoscopeLuck.combinedLabel}</Text>
                </View>
              </View>
              <View style={styles.luckSignsRow}>
                <View style={styles.luckSignChip}>
                  <Text style={styles.luckSignEmoji}>🐉</Text>
                  <View>
                    <Text style={styles.luckSignName}>{horoscopeLuck.chineseAnimal}</Text>
                    <View style={styles.luckSignScoreRow}>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.luckDot,
                            { backgroundColor: i < horoscopeLuck.chineseScore ? '#F59E0B' : 'rgba(255,255,255,0.15)' },
                          ]}
                        />
                      ))}
                      <Text style={styles.luckDotNum}>{horoscopeLuck.chineseScore}/9</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.luckSignChip}>
                  <Text style={styles.luckSignEmoji}>⭐</Text>
                  <View>
                    <Text style={styles.luckSignName}>{horoscopeLuck.westernSign}</Text>
                    <View style={styles.luckSignScoreRow}>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.luckDot,
                            { backgroundColor: i < horoscopeLuck.westernScore ? '#818CF8' : 'rgba(255,255,255,0.15)' },
                          ]}
                        />
                      ))}
                      <Text style={styles.luckDotNum}>{horoscopeLuck.westernScore}/9</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {agendaItems.length === 0 && timelineEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Calendar size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.emptyTitle}>No Events</Text>
              <Text style={styles.emptyText}>
                No events scheduled for this day
              </Text>
            </View>
          ) : (
            <>
              {agendaItems.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Cruises & Events</Text>
                  <View style={styles.agendaList}>
                    {agendaItems.map(renderAgendaItem)}
                  </View>
                </View>
              )}
              
              {(opportunePlayingTimes.length > 0 || mergedCruiseBookings.length > 0) && (
                <View style={styles.sectionContainer}>
                  <CasinoSessionTracker
                    date={dateStr}
                    goldenTimeSlots={goldenTimeSlots}
                    sessions={casinoSessions}
                    summary={dailySummary}
                    onAddSession={handleAddSession}
                    onRemoveSession={handleRemoveSession}
                  />
                </View>
              )}
              
              {opportunePlayingTimes.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitleOpportune}>Opportune Playing Times</Text>
                  <View style={styles.opportuneContainer}>
                    {opportunePlayingTimes.map(renderTimelineEvent)}
                  </View>
                </View>
              )}
              
              {timelineEvents.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Day Timeline</Text>
                  <View style={styles.timelineContainer}>
                    {timelineEvents.map(renderTimelineEvent)}
                  </View>
                </View>
              )}
            </>
          )}
          
          <View style={styles.sectionContainer}>
            <TimeZoneConverter />
          </View>

          <View style={styles.sectionContainer} testID="day-agenda-horoscope-section">
            <Text style={styles.intelligenceSectionEyebrow}>Premium Intelligence Briefing</Text>
            <Text style={styles.intelligenceSectionTitle}>Daily Intelligence Reading</Text>
            {horoscopeLuck && dailyIntelligence ? (
              <View style={styles.intelligenceCardsColumn}>
                <LinearGradient
                  colors={['rgba(245,158,11,0.20)', 'rgba(23,37,84,0.94)', 'rgba(6,10,18,0.98)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.intelligenceCard, { borderColor: 'rgba(245,158,11,0.34)' }]}
                  testID="day-agenda-chinese-horoscope-card"
                >
                  <View style={styles.intelligenceCardHeader}>
                    <View style={styles.intelligenceTitleLockup}>
                      <Text style={styles.intelligenceCardTitle}>{dailyIntelligence.chinese.title}</Text>
                      <Text style={styles.intelligenceCardSubtitle}>{dailyIntelligence.chinese.sign}</Text>
                    </View>
                    <View style={styles.intelligenceScoreStack}>
                      <Text style={styles.intelligenceScoreLabel}>Energy Score</Text>
                      <Text style={styles.intelligenceScoreValue}>{dailyIntelligence.chinese.scoreText}</Text>
                    </View>
                  </View>
                  <ScoreDots
                    score={dailyIntelligence.chinese.score}
                    activeColor="#F59E0B"
                    testID="day-agenda-chinese-score-meter"
                  />
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Personality Alignment</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.chinese.personalityAlignment}</Text>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Tactical Guidance</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.chinese.tacticalGuidance}</Text>
                  </View>
                  <View style={styles.intelligenceMiniColumn}>
                    <View style={styles.intelligenceMiniCard}>
                      <Text style={styles.intelligenceMiniLabel}>Strength Zone</Text>
                      <Text style={styles.intelligenceMiniValue}>{dailyIntelligence.chinese.strengthZone}</Text>
                    </View>
                    <View style={styles.intelligenceMiniCard}>
                      <Text style={styles.intelligenceMiniLabel}>Weakness Zone</Text>
                      <Text style={styles.intelligenceMiniValue}>{dailyIntelligence.chinese.weaknessZone}</Text>
                    </View>
                  </View>
                  <View style={styles.intelligenceSummaryCard}>
                    <Text style={styles.intelligenceSummaryLabel}>Summary</Text>
                    <Text style={styles.intelligenceSummaryText}>{dailyIntelligence.chinese.summary}</Text>
                  </View>
                </LinearGradient>

                <LinearGradient
                  colors={['rgba(99,102,241,0.22)', 'rgba(30,41,59,0.95)', 'rgba(7,12,24,0.98)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.intelligenceCard, { borderColor: 'rgba(129,140,248,0.34)' }]}
                  testID="day-agenda-western-horoscope-card"
                >
                  <View style={styles.intelligenceCardHeader}>
                    <View style={styles.intelligenceTitleLockup}>
                      <Text style={styles.intelligenceCardTitle}>{dailyIntelligence.western.title}</Text>
                      <Text style={styles.intelligenceCardSubtitle}>{dailyIntelligence.western.sign}</Text>
                    </View>
                    <View style={styles.intelligenceScoreStack}>
                      <Text style={styles.intelligenceScoreLabel}>Energy Score</Text>
                      <Text style={styles.intelligenceScoreValue}>{dailyIntelligence.western.scoreText}</Text>
                    </View>
                  </View>
                  <ScoreDots
                    score={dailyIntelligence.western.score}
                    activeColor="#818CF8"
                    testID="day-agenda-western-score-meter"
                  />
                  <View style={styles.intelligenceTagRow}>
                    <View
                      style={[
                        styles.intelligenceTagPill,
                        {
                          backgroundColor: `${westernMomentumColor}22`,
                          borderColor: `${westernMomentumColor}55`,
                        },
                      ]}
                    >
                      <Text style={[styles.intelligenceTagText, { color: westernMomentumColor }]}>Momentum {westernMomentumLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Emotional + Behavioral State</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.western.emotionalState}</Text>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Decision-Making Guidance</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.western.decisionGuidance}</Text>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Communication Style Advice</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.western.communicationAdvice}</Text>
                  </View>
                  <View style={styles.intelligenceSummaryCard}>
                    <Text style={styles.intelligenceSummaryLabel}>Summary</Text>
                    <Text style={styles.intelligenceSummaryText}>{dailyIntelligence.western.summary}</Text>
                  </View>
                </LinearGradient>

                <LinearGradient
                  colors={['rgba(124,58,237,0.24)', 'rgba(37,99,235,0.18)', 'rgba(7,12,24,0.98)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.intelligenceCard, { borderColor: `${horoscopeLuck.combinedHex}55` }]}
                  testID="day-agenda-alignment-card"
                >
                  <Text style={styles.intelligenceCardTitle}>{dailyIntelligence.alignment.title}</Text>
                  <View style={styles.alignmentScoreHero}>
                    <Text style={styles.alignmentScoreNumber}>{String(dailyIntelligence.alignment.score)}</Text>
                    <Text style={[styles.alignmentScoreDescriptor, { color: horoscopeLuck.combinedHex }]}>
                      {dailyIntelligence.alignment.label}
                    </Text>
                  </View>
                  <Text style={styles.alignmentReasonText}>{dailyIntelligence.alignment.whyRated}</Text>
                  <View style={styles.intelligenceMiniColumn}>
                    <View style={styles.intelligenceMiniCard}>
                      <Text style={styles.intelligenceMiniLabel}>Numerology Meaning</Text>
                      <Text style={styles.intelligenceMiniValue}>Day {dailyIntelligence.alignment.numerologyDay}</Text>
                      <Text style={styles.intelligenceMiniText}>{dailyIntelligence.alignment.numerologyMeaning}</Text>
                    </View>
                    <View style={styles.intelligenceMiniCard}>
                      <Text style={styles.intelligenceMiniLabel}>Tarot Interpretation</Text>
                      <Text style={styles.intelligenceMiniValue}>{dailyIntelligence.alignment.tarotCard}</Text>
                      <Text style={styles.intelligenceMiniText}>{dailyIntelligence.alignment.tarotInterpretation}</Text>
                    </View>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Combined System Synthesis</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.alignment.combinedSystemSynthesis}</Text>
                  </View>
                  <View style={styles.intelligenceStatGrid}>
                    <View style={styles.intelligenceStatChip}>
                      <Text style={styles.intelligenceStatLabel}>Power Window</Text>
                      <Text style={styles.intelligenceStatValue}>{dailyIntelligence.alignment.powerWindow}</Text>
                    </View>
                    <View style={styles.intelligenceStatChip}>
                      <Text style={styles.intelligenceStatLabel}>Lucky Color</Text>
                      <Text style={styles.intelligenceStatValue}>{dailyIntelligence.alignment.luckyColor}</Text>
                    </View>
                    <View
                      style={[
                        styles.intelligenceStatChip,
                        {
                          backgroundColor: bestMoveColors.backgroundColor,
                          borderColor: bestMoveColors.borderColor,
                        },
                      ]}
                    >
                      <Text style={styles.intelligenceStatLabel}>Best Move Type</Text>
                      <Text style={[styles.intelligenceStatValue, { color: bestMoveColors.textColor }]}>
                        {dailyIntelligence.alignment.bestMoveType}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.intelligenceDangerCard}>
                    <ShieldAlert size={16} color="#FCA5A5" />
                    <View style={styles.intelligenceDangerTextWrap}>
                      <Text style={styles.intelligenceDangerLabel}>Danger Zone</Text>
                      <Text style={styles.intelligenceDangerText}>{dailyIntelligence.alignment.dangerZone}</Text>
                    </View>
                  </View>
                </LinearGradient>

                <LinearGradient
                  colors={['rgba(20,184,166,0.18)', 'rgba(217,119,6,0.14)', 'rgba(7,12,24,0.98)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.intelligenceCard, { borderColor: 'rgba(94,234,212,0.28)' }]}
                  testID="day-agenda-ai-synthesis-card"
                >
                  <View style={styles.intelligenceCardHeader}>
                    <View style={styles.intelligenceTitleLockup}>
                      <Text style={styles.intelligenceCardTitle}>{dailyIntelligence.synthesis.title}</Text>
                    </View>
                    <View style={styles.intelligenceScoreStack}>
                      <Text style={styles.intelligenceScoreLabel}>Overall Stance</Text>
                      <Text style={styles.intelligenceScoreValue}>{dailyIntelligence.alignment.bestMoveType}</Text>
                    </View>
                  </View>
                  <View style={styles.intelligenceStatGrid}>
                    <View style={styles.intelligenceStatChip}>
                      <Text style={styles.intelligenceStatLabel}>Risk Tolerance</Text>
                      <Text style={styles.intelligenceStatValue}>{dailyIntelligence.synthesis.riskTolerance}</Text>
                    </View>
                    <View style={styles.intelligenceStatChip}>
                      <Text style={styles.intelligenceStatLabel}>Focus Strategy</Text>
                      <Text style={styles.intelligenceStatValue}>{dailyIntelligence.synthesis.focusStrategy}</Text>
                    </View>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Financial Behavior Guidance</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.synthesis.financialBehavior}</Text>
                  </View>
                  <View style={styles.intelligenceInfoBlock}>
                    <Text style={styles.intelligenceInfoLabel}>Decision-Making Style</Text>
                    <Text style={styles.intelligenceBodyText}>{dailyIntelligence.synthesis.decisionMakingStyle}</Text>
                  </View>
                  <View style={styles.intelligenceActionList}>
                    {dailyIntelligence.synthesis.actionSteps.map((step, index) => (
                      <View key={`daily-intelligence-step-${index}`} style={styles.intelligenceActionRow}>
                        <View style={styles.intelligenceActionBullet}>
                          <Text style={styles.intelligenceActionBulletText}>{String(index + 1)}</Text>
                        </View>
                        <Text style={styles.intelligenceActionText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.intelligenceSummaryCard}>
                    <Text style={styles.intelligenceSummaryLabel}>Bottom Line</Text>
                    <Text style={styles.intelligenceSummaryText}>{dailyIntelligence.synthesis.summary}</Text>
                  </View>
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.horoscopeEmptyCard} testID="day-agenda-horoscope-empty">
                <View style={styles.horoscopeEmptyIconWrap}>
                  <Sparkles size={18} color="#FBBF24" />
                </View>
                <View style={styles.horoscopeEmptyTextWrap}>
                  <Text style={styles.horoscopeEmptyTitle}>Add your birthdate for a personalized reading</Text>
                  <Text style={styles.horoscopeEmptyText}>
                    Open Settings and add your birthdate to unlock a full Chinese zodiac, Western zodiac, numerology, tarot, and AI synthesis briefing for each day.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      
      <AddSessionModal
        visible={showAddSessionModal}
        onClose={() => setShowAddSessionModal(false)}
        onSave={handleSaveSession}
        date={dateStr}
        goldenTimeSlots={goldenTimeSlots}
      />
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateText: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  eventCount: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  agendaList: {
    gap: SPACING.md,
  },
  agendaItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  itemIndicator: {
    width: 5,
  },
  itemContent: {
    flex: 1,
    padding: SPACING.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    flex: 1,
  },
  dayStatusBadge: {
    backgroundColor: 'rgba(212, 165, 116, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  dayStatusText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  allDayBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  allDayText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
  },
  itemSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
    lineHeight: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
  },
  portStatusBadge: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  seaDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  seaDayText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  casinoOpenBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: 'auto',
  },
  casinoOpenText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  portDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    flexWrap: 'wrap',
  },
  portDayText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
    flex: 1,
  },
  portTimes: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
  },
  cruiseDetails: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  cruiseDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cruiseDetailLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
  },
  cruiseDetailText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  bookingsContainer: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  bookingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
  },
  bookingValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  guestNames: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    flex: 1,
  },
  timelineContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  timelineEvent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  timelineTime: {
    width: 50,
    alignItems: 'flex-end',
    paddingRight: SPACING.sm,
  },
  timelineTimeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  timelineAllDay: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
  },
  timelineEndTime: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    marginTop: 2,
  },
  timelineDot: {
    width: 20,
    alignItems: 'center',
    paddingTop: 2,
  },
  timelineDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  timelineIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineTextContainer: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
  timelineSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    fontStyle: 'italic' as const,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sectionTitleOpportune: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  opportuneContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  timelineEventOpportune: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    marginVertical: 2,
    paddingHorizontal: SPACING.xs,
  },
  timelineTimeTextOpportune: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  timelineEndTimeOpportune: {
    color: '#FFFFFF',
  },
  timelineDotInnerOpportune: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  timelineIconBadgeOpportune: {
    backgroundColor: '#10B981',
  },
  timelineTitleOpportune: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  timelineSubtitleOpportune: {
    color: '#FFFFFF',
  },
  luckRow: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  luckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  luckScoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  luckScoreNum: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  luckCardText: {
    flex: 1,
  },
  luckCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  luckCardLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  luckSignsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  luckSignChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  luckSignEmoji: {
    fontSize: 22,
  },
  luckSignName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  luckSignScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  luckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  luckDotNum: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '700' as const,
    marginLeft: 3,
  },
  intelligenceSectionEyebrow: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.58)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginBottom: 6,
    fontFamily: DS.font.system,
  },
  intelligenceSectionTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: SPACING.md,
    fontWeight: '800' as const,
  },
  intelligenceCardsColumn: {
    gap: SPACING.md,
  },
  intelligenceCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  intelligenceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  intelligenceTitleLockup: {
    flex: 1,
  },
  intelligenceCardTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800' as const,
  },
  intelligenceCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 4,
    fontFamily: DS.font.system,
  },
  intelligenceScoreStack: {
    alignItems: 'flex-end',
    minWidth: 78,
  },
  intelligenceScoreLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.58)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    fontFamily: DS.font.system,
  },
  intelligenceScoreValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginTop: 2,
    fontFamily: DS.font.system,
  },
  intelligenceScoreMeter: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: SPACING.md,
  },
  intelligenceScoreDot: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  intelligenceTagRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  intelligenceTagPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  intelligenceTagText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontFamily: DS.font.system,
  },
  intelligenceInfoBlock: {
    marginBottom: SPACING.md,
  },
  intelligenceInfoLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    fontFamily: DS.font.system,
  },
  intelligenceBodyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    lineHeight: 22,
    fontFamily: DS.font.system,
  },
  intelligenceMiniColumn: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  intelligenceMiniCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  intelligenceMiniLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 4,
    fontFamily: DS.font.system,
  },
  intelligenceMiniValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: DS.font.system,
  },
  intelligenceMiniText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 20,
    fontFamily: DS.font.system,
  },
  intelligenceSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  intelligenceSummaryLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    fontFamily: DS.font.system,
  },
  intelligenceSummaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    lineHeight: 22,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontFamily: DS.font.system,
  },
  alignmentScoreHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  alignmentScoreNumber: {
    fontSize: 56,
    color: '#FFFFFF',
    fontWeight: '900' as const,
    lineHeight: 60,
    fontFamily: DS.font.system,
  },
  alignmentScoreDescriptor: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginTop: 6,
    fontFamily: DS.font.system,
  },
  alignmentReasonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    lineHeight: 22,
    textAlign: 'center' as const,
    marginBottom: SPACING.md,
    fontFamily: DS.font.system,
  },
  intelligenceStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  intelligenceStatChip: {
    flexGrow: 1,
    flexBasis: '48%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  intelligenceStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 4,
    fontFamily: DS.font.system,
  },
  intelligenceStatValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    lineHeight: 20,
    fontFamily: DS.font.system,
  },
  intelligenceDangerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.20)',
  },
  intelligenceDangerTextWrap: {
    flex: 1,
  },
  intelligenceDangerLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FCA5A5',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 4,
    fontFamily: DS.font.system,
  },
  intelligenceDangerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FEE2E2',
    lineHeight: 20,
    fontFamily: DS.font.system,
  },
  intelligenceActionList: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  intelligenceActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  intelligenceActionBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  intelligenceActionBulletText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    fontFamily: DS.font.system,
  },
  intelligenceActionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    lineHeight: 21,
    fontFamily: DS.font.system,
  },
  horoscopeEmptyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  horoscopeEmptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251,191,36,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horoscopeEmptyTextWrap: {
    flex: 1,
  },
  horoscopeEmptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: DS.font.system,
  },
  horoscopeEmptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
    fontFamily: DS.font.system,
  },
});
