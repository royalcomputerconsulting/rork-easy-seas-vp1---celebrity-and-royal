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
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { CasinoSessionTracker } from '@/components/CasinoSessionTracker';
import { AddSessionModal } from '@/components/AddSessionModal';
import type { PlayingHours } from '@/state/UserProvider';
import { createDateFromString } from '@/lib/date';
import { determineCasinoHoursWithContext, determineSeaDay, type CasinoDayContext } from '@/lib/casinoAvailability';
import type { CalendarEvent, BookedCruise, ItineraryDay } from '@/types/models';
import { useCoreData } from '@/state/CoreDataProvider';
import { TimeZoneConverter } from '@/components/TimeZoneConverter';
import { SeaPassCard } from '@/components/SeaPassCard';
import { DailyLuckSection } from '@/components/DailyLuckSection';

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

interface DayScheduleBlockInput {
  id: string;
  title: string;
  subtitle?: string;
  location?: string;
  notes?: string;
  startMinutes: number;
  endMinutes: number;
  color: string;
  icon: TimelineEvent['icon'];
  type: TimelineEvent['type'] | 'travel' | 'personal' | 'cruise';
}

interface DayScheduleBlock extends DayScheduleBlockInput {
  overlapColumn: number;
  overlapColumns: number;
}

interface AllDayScheduleItem {
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  color: string;
  icon: TimelineEvent['icon'];
}

const MINUTES_PER_DAY = 24 * 60;
const HOUR_ROW_HEIGHT = 76;
const MIN_SCHEDULE_BLOCK_HEIGHT = 42;
const DAY_HOURS = Array.from({ length: 24 }, (_, index) => index);

function parseScheduleTimeToMinutes(value?: string): number | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  const upperValue = normalizedValue.toUpperCase();
  if (upperValue === 'MIDNIGHT') return 0;
  if (upperValue === 'NOON') return 12 * 60;
  const twelveHourMatch = upperValue.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/);
  if (twelveHourMatch) {
    const parsedHours = parseInt(twelveHourMatch[1], 10);
    const parsedMinutes = parseInt(twelveHourMatch[2] ?? '0', 10);
    if (parsedHours < 1 || parsedHours > 12 || parsedMinutes < 0 || parsedMinutes > 59) return null;
    const adjustedHours = parsedHours % 12 + (twelveHourMatch[3] === 'PM' ? 12 : 0);
    return adjustedHours * 60 + parsedMinutes;
  }
  const twentyFourHourMatch = upperValue.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (twentyFourHourMatch) {
    const parsedHours = parseInt(twentyFourHourMatch[1], 10);
    const parsedMinutes = parseInt(twentyFourHourMatch[2], 10);
    if (parsedHours === 24 && parsedMinutes === 0) return MINUTES_PER_DAY;
    if (parsedHours < 0 || parsedHours > 23 || parsedMinutes < 0 || parsedMinutes > 59) return null;
    return parsedHours * 60 + parsedMinutes;
  }
  return null;
}

function clampScheduleRange(startMinutes: number, endMinutes: number): { startMinutes: number; endMinutes: number } | null {
  const safeStart = Math.max(0, Math.min(MINUTES_PER_DAY, startMinutes));
  const safeEnd = Math.max(0, Math.min(MINUTES_PER_DAY, endMinutes));
  if (safeEnd <= safeStart) return null;
  return { startMinutes: safeStart, endMinutes: safeEnd };
}

function formatScheduleTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
  const normalizedMinutes = safeMinutes === MINUTES_PER_DAY ? 0 : safeMinutes;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(mins).padStart(2, '0')} ${meridiem}`;
}

function formatScheduleTimeRange(startMinutes: number, endMinutes: number): string {
  const endLabel = endMinutes >= MINUTES_PER_DAY ? '12:00 AM' : formatScheduleTime(endMinutes);
  return `${formatScheduleTime(startMinutes)} - ${endLabel}`;
}

function formatHourLabel(hour: number): string {
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const displayHours = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHours} ${meridiem}`;
}

function formatDurationLabel(totalMinutes: number): string {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function layoutDayScheduleCluster(cluster: DayScheduleBlockInput[]): DayScheduleBlock[] {
  const sortedCluster = [...cluster].sort((l, r) => l.startMinutes - r.startMinutes || r.endMinutes - l.endMinutes);
  const columnEndTimes: number[] = [];
  const positionedBlocks = sortedCluster.map((block) => {
    let columnIndex = columnEndTimes.findIndex((endTime) => endTime <= block.startMinutes);
    if (columnIndex === -1) {
      columnIndex = columnEndTimes.length;
      columnEndTimes.push(block.endMinutes);
    } else {
      columnEndTimes[columnIndex] = block.endMinutes;
    }
    return { ...block, overlapColumn: columnIndex, overlapColumns: 1 };
  });
  const totalColumns = Math.max(1, columnEndTimes.length);
  return positionedBlocks.map((block) => ({ ...block, overlapColumns: totalColumns }));
}

function layoutDayScheduleBlocks(blocks: DayScheduleBlockInput[]): DayScheduleBlock[] {
  const sortedBlocks = [...blocks].sort((l, r) => l.startMinutes - r.startMinutes || r.endMinutes - l.endMinutes);
  const laidOutBlocks: DayScheduleBlock[] = [];
  let currentCluster: DayScheduleBlockInput[] = [];
  let clusterEndMinutes = -1;
  sortedBlocks.forEach((block) => {
    if (currentCluster.length === 0) {
      currentCluster = [block];
      clusterEndMinutes = block.endMinutes;
      return;
    }
    if (block.startMinutes < clusterEndMinutes) {
      currentCluster.push(block);
      clusterEndMinutes = Math.max(clusterEndMinutes, block.endMinutes);
      return;
    }
    laidOutBlocks.push(...layoutDayScheduleCluster(currentCluster));
    currentCluster = [block];
    clusterEndMinutes = block.endMinutes;
  });
  if (currentCluster.length > 0) laidOutBlocks.push(...layoutDayScheduleCluster(currentCluster));
  return laidOutBlocks;
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
      if (!cruise.sailDate || !cruise.returnDate) return;
      if (!isDateInRange(selectedDate, cruise.sailDate, cruise.returnDate)) return;
      
      const key = `${cruise.shipName}-${cruise.sailDate}`;
      
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
          returnDate: cruise.returnDate,
          destination: cruise.destination,
          itineraryName: cruise.itineraryName,
          departurePort: cruise.departurePort,
          nights: cruise.nights || 0,
          itinerary: cruise.itinerary,
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
    if (!cruise.itinerary) return undefined;
    return cruise.itinerary.find(d => d.day === dayNum);
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
      const eventStart = event.startDate || event.start || '';
      const eventEnd = event.endDate || event.end || eventStart;
      
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
  }, [selectedDate, mergedCruiseBookings, calendarEvents, getDayOfCruise, getItineraryForDay, getCasinoContext]);

  const agendaItems = useMemo((): AgendaItem[] => {
    const items: AgendaItem[] = [];
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    calendarEvents.forEach(event => {
      const eventStart = event.startDate || event.start || '';
      const eventEnd = event.endDate || event.end || eventStart;
      
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
      items.push({
        id: `cruise-${cruise.id}`,
        type: 'cruise',
        title: cruise.shipName,
        subtitle: cruise.destination || cruise.itineraryName,
        location: cruise.departurePort,
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
  }, [selectedDate, calendarEvents, mergedCruiseBookings, getDayStatus]);

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

  const selectedDayWindow = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }, [selectedDate]);

  const dayScheduleData = useMemo(() => {
    const scheduleBlocks: DayScheduleBlockInput[] = [];
    const allDayItems: AllDayScheduleItem[] = [];
    const allDayItemIds = new Set<string>();
    const selectedDayStartMs = selectedDayWindow.start.getTime();
    const selectedDayEndMs = selectedDayWindow.end.getTime();

    const addAllDayItem = (item: AllDayScheduleItem) => {
      if (allDayItemIds.has(item.id)) return;
      allDayItemIds.add(item.id);
      allDayItems.push(item);
    };

    const addScheduleBlock = (block: DayScheduleBlockInput) => {
      const clampedRange = clampScheduleRange(block.startMinutes, block.endMinutes);
      if (!clampedRange) return;
      scheduleBlocks.push({ ...block, ...clampedRange });
    };

    mergedCruiseBookings.forEach((cruise) => {
      const dayNum = getDayOfCruise(cruise);
      const totalDays = cruise.nights + 1;
      const itineraryDay = getItineraryForDay(cruise, dayNum);
      const casinoContext = getCasinoContext(cruise, dayNum);
      const casinoInfo = determineCasinoHoursWithContext(casinoContext);
      const arrivalMinutes = parseScheduleTimeToMinutes(itineraryDay?.arrival);
      const departureMinutes = parseScheduleTimeToMinutes(itineraryDay?.departure);

      if (itineraryDay?.isSeaDay) {
        addAllDayItem({
          id: `sea-day-${cruise.id}-${dayNum}`,
          title: 'Sea Day',
          subtitle: cruise.shipName,
          detail: `Day ${dayNum} of ${totalDays}`,
          color: EVENT_COLORS.seaDay,
          icon: 'sea',
        });
      } else if (itineraryDay?.port) {
        addAllDayItem({
          id: `port-call-${cruise.id}-${dayNum}`,
          title: itineraryDay.port,
          subtitle: cruise.shipName,
          detail: `Day ${dayNum} of ${totalDays}`,
          color: EVENT_COLORS.port,
          icon: 'port',
        });
      } else if (dayNum === 1) {
        addAllDayItem({
          id: `embarkation-chip-${cruise.id}`,
          title: 'Embarkation Day',
          subtitle: cruise.shipName,
          detail: cruise.departurePort,
          color: EVENT_COLORS.cruise,
          icon: 'ship',
        });
      } else if (dayNum === totalDays) {
        addAllDayItem({
          id: `disembarkation-chip-${cruise.id}`,
          title: 'Disembarkation Day',
          subtitle: cruise.shipName,
          detail: cruise.departurePort,
          color: EVENT_COLORS.cruise,
          icon: 'ship',
        });
      }

      if (itineraryDay && !itineraryDay.isSeaDay) {
        if (arrivalMinutes !== null && departureMinutes !== null) {
          addScheduleBlock({
            id: `port-window-${cruise.id}-${dayNum}`,
            title: `In Port • ${itineraryDay.port}`,
            subtitle: cruise.shipName,
            location: itineraryDay.port,
            notes: itineraryDay.notes,
            startMinutes: arrivalMinutes,
            endMinutes: departureMinutes > arrivalMinutes ? departureMinutes : MINUTES_PER_DAY,
            color: EVENT_COLORS.port,
            icon: 'port',
            type: 'port',
          });
        } else if (departureMinutes !== null) {
          addScheduleBlock({
            id: `port-window-${cruise.id}-${dayNum}`,
            title: `In Port • ${itineraryDay.port}`,
            subtitle: `${cruise.shipName} embarkation window`,
            location: itineraryDay.port,
            startMinutes: 0,
            endMinutes: departureMinutes,
            color: EVENT_COLORS.port,
            icon: 'port',
            type: 'port',
          });
        } else if (arrivalMinutes !== null) {
          addScheduleBlock({
            id: `port-window-${cruise.id}-${dayNum}`,
            title: `In Port • ${itineraryDay.port}`,
            subtitle: `${cruise.shipName} disembarkation window`,
            location: itineraryDay.port,
            startMinutes: arrivalMinutes,
            endMinutes: MINUTES_PER_DAY,
            color: EVENT_COLORS.port,
            icon: 'port',
            type: 'port',
          });
        }
      }

      if (casinoInfo.open) {
        if (casinoContext.isDepartureDay) {
          const openMinutes = parseScheduleTimeToMinutes(casinoInfo.openTime);
          if (openMinutes !== null) {
            addScheduleBlock({
              id: `casino-departure-${cruise.id}-${dayNum}`,
              title: 'Casino Opens After Sail Away',
              subtitle: cruise.shipName,
              notes: casinoInfo.reason,
              startMinutes: openMinutes,
              endMinutes: MINUTES_PER_DAY,
              color: EVENT_COLORS.casino,
              icon: 'casino',
              type: 'casino',
            });
          }
        } else if (casinoContext.isSeaDay) {
          const openMinutes = parseScheduleTimeToMinutes(casinoInfo.openTime) ?? 0;
          addScheduleBlock({
            id: `casino-sea-day-${cruise.id}-${dayNum}`,
            title: 'Casino Open',
            subtitle: cruise.shipName,
            notes: casinoInfo.reason,
            startMinutes: openMinutes,
            endMinutes: MINUTES_PER_DAY,
            color: EVENT_COLORS.casino,
            icon: 'casino',
            type: 'casino',
          });
        } else if (!casinoContext.isDisembarkDay) {
          addScheduleBlock({
            id: `casino-carryover-${cruise.id}-${dayNum}`,
            title: 'Casino Open',
            subtitle: `${cruise.shipName} overnight carryover`,
            notes: 'Open from midnight until the ship is back in port waters.',
            startMinutes: 0,
            endMinutes: 5 * 60,
            color: EVENT_COLORS.casino,
            icon: 'casino',
            type: 'casino',
          });
          const reopenMinutes = parseScheduleTimeToMinutes(casinoInfo.openTime);
          if (reopenMinutes !== null) {
            addScheduleBlock({
              id: `casino-reopen-${cruise.id}-${dayNum}`,
              title: 'Casino Reopens',
              subtitle: itineraryDay?.port ? `${itineraryDay.port} sail away` : cruise.shipName,
              notes: casinoInfo.reason,
              startMinutes: reopenMinutes,
              endMinutes: MINUTES_PER_DAY,
              color: EVENT_COLORS.casino,
              icon: 'casino',
              type: 'casino',
            });
          }
        }
      } else {
        addAllDayItem({
          id: `casino-closed-${cruise.id}-${dayNum}`,
          title: 'Casino Closed',
          subtitle: casinoInfo.reason,
          detail: cruise.shipName,
          color: '#6B7280',
          icon: 'casino',
        });
      }
    });

    calendarEvents.forEach((event) => {
      const eventStartValue = event.startDate || event.start || '';
      const eventEndValue = event.endDate || event.end || eventStartValue;
      if (!eventStartValue) return;

      const isTravelEvent = event.type === 'travel' || event.type === 'flight' || event.type === 'hotel';
      const eventColor = event.type === 'cruise' ? EVENT_COLORS.cruise : isTravelEvent ? EVENT_COLORS.travel : EVENT_COLORS.personal;
      const secondaryText = event.location ?? event.description;

      if (event.allDay || !eventStartValue.includes('T')) {
        const startDateStr = eventStartValue.split('T')[0];
        const endDateStr = eventEndValue.split('T')[0];
        const currentDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        if (currentDateStr >= startDateStr && currentDateStr <= endDateStr) {
          addAllDayItem({
            id: `all-day-event-${event.id}`,
            title: event.title,
            subtitle: secondaryText,
            detail: event.type,
            color: eventColor,
            icon: 'calendar',
          });
        }
        return;
      }

      const eventStartDate = new Date(eventStartValue);
      if (Number.isNaN(eventStartDate.getTime())) return;

      const parsedEndDate = eventEndValue ? new Date(eventEndValue) : new Date(eventStartDate.getTime() + 30 * 60 * 1000);
      const eventEndDate = Number.isNaN(parsedEndDate.getTime()) || parsedEndDate.getTime() <= eventStartDate.getTime()
        ? new Date(eventStartDate.getTime() + 30 * 60 * 1000)
        : parsedEndDate;

      const overlapStartMs = Math.max(selectedDayStartMs, eventStartDate.getTime());
      const overlapEndMs = Math.min(selectedDayEndMs, eventEndDate.getTime());
      if (overlapEndMs <= overlapStartMs) return;

      const overlapStartMinutes = Math.max(0, Math.round((overlapStartMs - selectedDayStartMs) / 60000));
      const overlapEndMinutes = Math.min(MINUTES_PER_DAY, Math.round((overlapEndMs - selectedDayStartMs) / 60000));
      const safeEndMinutes = overlapEndMinutes <= overlapStartMinutes
        ? Math.min(MINUTES_PER_DAY, overlapStartMinutes + 30)
        : overlapEndMinutes;

      addScheduleBlock({
        id: `timed-event-${event.id}`,
        title: event.title,
        subtitle: secondaryText,
        location: event.location,
        notes: event.description,
        startMinutes: overlapStartMinutes,
        endMinutes: safeEndMinutes,
        color: eventColor,
        icon: 'calendar',
        type: isTravelEvent ? 'travel' : event.type === 'cruise' ? 'cruise' : 'personal',
      });
    });

    const timedBlocks = layoutDayScheduleBlocks(scheduleBlocks);
    const portMinutes = timedBlocks.filter((b) => b.type === 'port').reduce((t, b) => t + (b.endMinutes - b.startMinutes), 0);
    const casinoMinutes = timedBlocks.filter((b) => b.type === 'casino').reduce((t, b) => t + (b.endMinutes - b.startMinutes), 0);

    return { timedBlocks, allDayItems, portMinutes, casinoMinutes };
  }, [calendarEvents, getCasinoContext, getDayOfCruise, getItineraryForDay, mergedCruiseBookings, selectedDate, selectedDayWindow.end, selectedDayWindow.start]);

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
      
      const cruiseEvents: CalendarEvent[] = bookedCruises.map(cruise => ({
        id: `cruise-event-${cruise.id}`,
        title: `${cruise.shipName} - ${cruise.destination || cruise.itineraryName || 'Cruise'}`,
        startDate: cruise.sailDate,
        endDate: cruise.returnDate,
        start: cruise.sailDate,
        end: cruise.returnDate,
        type: 'cruise' as const,
        sourceType: 'cruise' as const,
        location: cruise.departurePort,
        description: `${cruise.nights} night cruise${cruise.reservationNumber ? ` - Res# ${cruise.reservationNumber}` : ''}${cruise.cabinNumber ? ` - Cabin ${cruise.cabinNumber}` : ''}`,
        cruiseId: cruise.id,
        allDay: true,
        source: 'import' as const,
      }));
      
      const allEvents = [...existingEvents, ...cruiseEvents];
      coreData.setCalendarEvents(allEvents);
      
      console.log(`[DayAgenda] Synced ${cruiseEvents.length} cruise events`);
    } catch (error) {
      console.error('[DayAgenda] Error syncing events:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [bookedCruises, coreData]);

  const renderAllDayScheduleItem = useCallback((item: AllDayScheduleItem) => {
    const IconComponent = getTimelineIcon(item.icon);
    return (
      <View
        key={item.id}
        style={[
          styles.allDayItem,
          { borderColor: `${item.color}55`, backgroundColor: `${item.color}18` },
        ]}
      >
        <View style={[styles.allDayIconBadge, { backgroundColor: `${item.color}24` }]}>
          <IconComponent size={14} color={item.color} />
        </View>
        <View style={styles.allDayTextContainer}>
          <Text style={styles.allDayItemTitle} numberOfLines={1}>{item.title}</Text>
          {item.subtitle ? <Text style={styles.allDayItemSubtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
        </View>
        {item.detail ? <Text style={styles.allDayItemDetail} numberOfLines={1}>{item.detail}</Text> : null}
      </View>
    );
  }, [getTimelineIcon]);

  const renderDayScheduleBlock = useCallback((block: DayScheduleBlock) => {
    const IconComponent = getTimelineIcon(block.icon);
    const top = (block.startMinutes / 60) * HOUR_ROW_HEIGHT;
    const rawHeight = ((block.endMinutes - block.startMinutes) / 60) * HOUR_ROW_HEIGHT;
    const blockHeight = Math.max(rawHeight, MIN_SCHEDULE_BLOCK_HEIGHT);
    const widthPercent = 100 / block.overlapColumns;
    const adjustedWidthPercent = Math.max(widthPercent - (block.overlapColumns > 1 ? 1.8 : 0), 24);
    const leftPercent = block.overlapColumn * widthPercent;
    const isCompact = blockHeight < 82;
    return (
      <View
        key={block.id}
        style={[
          styles.dayScheduleBlock,
          {
            top,
            height: blockHeight,
            left: `${leftPercent}%`,
            width: `${adjustedWidthPercent}%`,
            borderColor: `${block.color}66`,
            backgroundColor: `${block.color}20`,
          },
        ]}
      >
        <View style={styles.dayScheduleBlockHeader}>
          <View style={[styles.dayScheduleBlockIconBadge, { backgroundColor: `${block.color}28` }]}>
            <IconComponent size={13} color={block.color} />
          </View>
          <Text style={styles.dayScheduleBlockTime} numberOfLines={1}>
            {formatScheduleTimeRange(block.startMinutes, block.endMinutes)}
          </Text>
        </View>
        <Text style={styles.dayScheduleBlockTitle} numberOfLines={isCompact ? 1 : 2}>{block.title}</Text>
        {!isCompact && block.subtitle ? <Text style={styles.dayScheduleBlockSubtitle} numberOfLines={2}>{block.subtitle}</Text> : null}
        {!isCompact && block.location ? <Text style={styles.dayScheduleBlockLocation} numberOfLines={1}>{block.location}</Text> : null}
      </View>
    );
  }, [getTimelineIcon]);

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
                      {itineraryDay.arrival && itineraryDay.departure && (
                        <Text style={styles.portTimes}>
                          {itineraryDay.arrival} - {itineraryDay.departure}
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
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>24-Hour Agenda</Text>
            <View style={styles.dayScheduleCard}>
              <View style={styles.dayScheduleSummaryHeader}>
                <View style={styles.dayScheduleSummaryCopy}>
                  <Text style={styles.dayScheduleSummaryTitle}>Full day schedule</Text>
                  <Text style={styles.dayScheduleSummarySubtitle}>
                    Port windows, casino availability, and timed events for this day.
                  </Text>
                </View>
                <View style={styles.dayScheduleMetricsRow}>
                  <View style={styles.dayScheduleMetricChip}>
                    <Text style={styles.dayScheduleMetricValue}>{formatDurationLabel(dayScheduleData.portMinutes)}</Text>
                    <Text style={styles.dayScheduleMetricLabel}>In port</Text>
                  </View>
                  <View style={styles.dayScheduleMetricChip}>
                    <Text style={styles.dayScheduleMetricValue}>{formatDurationLabel(dayScheduleData.casinoMinutes)}</Text>
                    <Text style={styles.dayScheduleMetricLabel}>Casino open</Text>
                  </View>
                </View>
              </View>

              {dayScheduleData.allDayItems.length > 0 ? (
                <View style={styles.allDaySection}>
                  <Text style={styles.allDaySectionLabel}>All-day</Text>
                  <View style={styles.allDayItemsList}>
                    {dayScheduleData.allDayItems.map(renderAllDayScheduleItem)}
                  </View>
                </View>
              ) : null}

              <View style={styles.dayScheduleBody}>
                <View style={styles.dayScheduleHoursColumn}>
                  {DAY_HOURS.map((hour) => (
                    <View key={`schedule-hour-${hour}`} style={styles.dayScheduleHourLabelRow}>
                      <Text style={styles.dayScheduleHourLabel}>{formatHourLabel(hour)}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.dayScheduleGrid}>
                  {DAY_HOURS.map((hour) => (
                    <View
                      key={`schedule-divider-${hour}`}
                      style={[styles.dayScheduleHourDivider, { top: hour * HOUR_ROW_HEIGHT }]}
                    />
                  ))}
                  <View style={[styles.dayScheduleHourDivider, styles.dayScheduleBottomDivider]} />
                  <View style={styles.dayScheduleBlocksLayer}>
                    {dayScheduleData.timedBlocks.map(renderDayScheduleBlock)}
                  </View>
                  {dayScheduleData.timedBlocks.length === 0 ? (
                    <View style={styles.dayScheduleEmptyState}>
                      <Text style={styles.dayScheduleEmptyTitle}>No timed items</Text>
                      <Text style={styles.dayScheduleEmptySubtitle}>
                        Port windows, casino hours, and timed events will appear here.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Daily Luck</Text>
            <DailyLuckSection selectedDate={selectedDate} />
          </View>

          {agendaItems.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Cruises & Events</Text>
              <View style={styles.agendaList}>
                {agendaItems.map(renderAgendaItem)}
              </View>
            </View>
          )}

          {mergedCruiseBookings.length > 0 && (
            <View style={styles.sectionContainer}>
              {mergedCruiseBookings.map((cruise) => {
                const source = bookedCruises.find(b => b.id === cruise.id)?.cruiseSource;
                return (
                  <SeaPassCard
                    key={`seapass-${cruise.id}`}
                    shipName={cruise.shipName}
                    sailDate={cruise.sailDate}
                    returnDate={cruise.returnDate}
                    nights={cruise.nights}
                    dayNumber={getDayOfCruise(cruise)}
                    departurePort={cruise.departurePort}
                    bookings={cruise.bookings}
                    brand={source}
                  />
                );
              })}
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
          
          <View style={styles.sectionContainer}>
            <TimeZoneConverter />
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
  dayScheduleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  dayScheduleSummaryHeader: {
    padding: SPACING.lg,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayScheduleSummaryCopy: {
    gap: 4,
  },
  dayScheduleSummaryTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  dayScheduleSummarySubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.78)',
    lineHeight: 20,
  },
  dayScheduleMetricsRow: {
    flexDirection: 'row' as const,
    gap: SPACING.sm,
  },
  dayScheduleMetricChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayScheduleMetricValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  dayScheduleMetricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.68)',
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  allDaySection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.sm,
  },
  allDaySectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255, 255, 255, 0.72)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  allDayItemsList: {
    gap: SPACING.sm,
  },
  allDayItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  allDayIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  allDayTextContainer: {
    flex: 1,
    gap: 2,
  },
  allDayItemTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  allDayItemSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.76)',
  },
  allDayItemDetail: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  dayScheduleBody: {
    flexDirection: 'row' as const,
    minHeight: HOUR_ROW_HEIGHT * 24,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  dayScheduleHoursColumn: {
    width: 54,
  },
  dayScheduleHourLabelRow: {
    height: HOUR_ROW_HEIGHT,
    alignItems: 'flex-end' as const,
    paddingTop: 2,
  },
  dayScheduleHourLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: 'rgba(255, 255, 255, 0.62)',
    textTransform: 'uppercase' as const,
  },
  dayScheduleGrid: {
    flex: 1,
    minHeight: HOUR_ROW_HEIGHT * 24,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: 'rgba(8, 15, 28, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  dayScheduleHourDivider: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayScheduleBottomDivider: {
    top: HOUR_ROW_HEIGHT * 24,
  },
  dayScheduleBlocksLayer: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: SPACING.sm,
    right: SPACING.sm,
  },
  dayScheduleBlock: {
    position: 'absolute' as const,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    overflow: 'hidden' as const,
  },
  dayScheduleBlockHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 6,
  },
  dayScheduleBlockIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  dayScheduleBlockTime: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  dayScheduleBlockTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  dayScheduleBlockSubtitle: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.84)',
    lineHeight: 16,
  },
  dayScheduleBlockLocation: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.68)',
  },
  dayScheduleEmptyState: {
    position: 'absolute' as const,
    left: SPACING.lg,
    right: SPACING.lg,
    top: SPACING.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: SPACING.lg,
    gap: 4,
  },
  dayScheduleEmptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  dayScheduleEmptySubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.72)',
    lineHeight: 20,
  },
});
