import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, ChevronRight, Ship, Plane, User, Plus, AlertTriangle } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import type { CalendarEvent, BookedCruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { CrewRecognitionSection } from '@/components/crew-recognition/CrewRecognitionSection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ViewMode = 'events' | 'week' | 'month' | '90days';

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
};

export default function EventsScreen() {
  const router = useRouter();
  const { localData } = useAppState();
  const { bookedCruises } = useCruiseStore();
  const { clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const coreData = useCoreData();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  const calendarEvents = useMemo(() => {
    const events = [...(localData.calendar || []), ...(localData.tripit || [])];
    console.log('[Events] Calendar events updated:', events.length);
    return events;
  }, [localData.calendar, localData.tripit]);

  useEffect(() => {
    console.log('[Events] Data changed - calendar:', calendarEvents.length, 'cruises:', bookedCruises.length);
    setRefreshKey(prev => prev + 1);
  }, [calendarEvents.length, bookedCruises.length]);

  const eventCounts = useMemo(() => {
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
      const eventStart = event.startDate || event.start || '';
      if (eventStart) {
        const eventDate = new Date(eventStart);
        if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
          count++;
        }
      }
    });

    bookedCruises.forEach((bc: BookedCruise) => {
      if (bc.sailDate) {
        const sailDate = new Date(bc.sailDate);
        if (sailDate.getFullYear() === year && sailDate.getMonth() === month) {
          count++;
        }
      }
    });

    return count;
  }, [calendarEvents, bookedCruises, currentDate]);

  const isDateInRange = useCallback((date: Date, startStr: string, endStr: string): boolean => {
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
    const dateStr = date.toISOString().split('T')[0];
    const countedCruiseIds = new Set<string>();

    calendarEvents.forEach(event => {
      const eventStart = event.startDate || event.start || '';
      const eventEnd = event.endDate || event.end || eventStart;
      
      if (eventStart) {
        const startDate = eventStart.split('T')[0];
        const endDate = eventEnd.split('T')[0];
        
        if (dateStr >= startDate && dateStr <= endDate) {
          if (event.type === 'cruise' || (event as any).sourceType === 'cruise') {
            cruise++;
            if ((event as any).cruiseId) countedCruiseIds.add((event as any).cruiseId);
          } else if (event.type === 'travel' || event.type === 'flight' || event.type === 'hotel') {
            travel++;
          } else {
            personal++;
          }
        }
      }
    });

    bookedCruises.forEach((bc: BookedCruise) => {
      if (bc.sailDate && bc.returnDate && !countedCruiseIds.has(bc.id)) {
        if (isDateInRange(date, bc.sailDate, bc.returnDate)) {
          cruise++;
        }
      }
    });

    return { cruise, travel, personal };
  }, [calendarEvents, bookedCruises, isDateInRange]);

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
  }, [getEventsForDate, refreshKey]);

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
  }, [getEventsForDate, refreshKey]);

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
      if (cruise.sailDate) {
        const sailDate = createDateFromString(cruise.sailDate);
        if (sailDate >= today) {
          allEvents.push({ event: cruise, type: 'cruise', date: sailDate });
        }
      }
    });
    
    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [calendarEvents, bookedCruises]);

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
          {event.location && (
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
                style={styles.navButton}
                onPress={() => navigateMonth('next')}
                activeOpacity={0.7}
              >
                <ChevronRight size={24} color={COLORS.navyDeep} />
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
          </View>

          {viewMode === 'events' && (
            <View style={styles.eventsListSection}>
              <View style={styles.sectionHeader}>
                <CalendarDays size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                <Text style={styles.eventCountBadge}>{upcomingEvents.length}</Text>
              </View>
              
              {upcomingEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <CalendarDays size={48} color={COLORS.navyDeep} />
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
                  {upcomingEvents.map((item, index) => renderEventCard(item, index))}
                </View>
              )}
            </View>
          )}

          {viewMode !== 'events' && upcomingEvents.length > 0 && (
            <View style={styles.eventsListSection}>
              <View style={styles.sectionHeader}>
                <CalendarDays size={20} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Next Up</Text>
              </View>
              <View style={styles.eventsList}>
                {upcomingEvents.slice(0, 3).map((item, index) => renderEventCard(item, index))}
              </View>
            </View>
          )}

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
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
    ...SHADOW.lg,
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
    fontSize: TYPOGRAPHY.fontSizeHeader,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: SPACING.sm,
  },
  tierBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    gap: SPACING.lg,
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
    width: Math.floor((SCREEN_WIDTH - SPACING.md * 4 - 28) / 15),
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
