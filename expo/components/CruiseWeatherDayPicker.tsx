import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, MapPin, Waves } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildCruiseDayPlan, isWithinForecastWindow } from '@/lib/cruiseDayPipeline';
import { createDateFromString, createUtcDateFromCalendarDate, toLocalCalendarDateOnly } from '@/lib/date';
import type { SailingWeatherCruiseInput } from '@/state/SailingWeatherProvider';

interface CruiseWeatherDayPickerProps {
  cruise: SailingWeatherCruiseInput;
  selectedDate: Date;
  onSelectDate: (dateKey: string) => void;
  testID?: string;
}

function dayLocationLabel(port: string, isSeaDay: boolean): string {
  if (port.trim()) return port.trim();
  if (isSeaDay) return 'At Sea';
  return 'Location pending';
}

export function CruiseWeatherDayPicker({ cruise, selectedDate, onSelectDate, testID }: CruiseWeatherDayPickerProps) {
  const plan = useMemo(() => buildCruiseDayPlan(cruise), [cruise]);
  const selectedDateKey = toLocalCalendarDateOnly(selectedDate);

  if (!plan || plan.days.length === 0) return null;

  return (
    <View style={styles.container} testID={testID ?? `weather-day-picker-${cruise.id}`}>
      <View style={styles.headingRow}>
        <CalendarDays size={15} color="#0E7490" />
        <View style={styles.headingCopy}>
          <Text style={styles.heading}>Choose a voyage day</Text>
          <Text style={styles.subheading}>Tap any day to open its complete weather, wind, wave, and swell forecast.</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
        {plan.days.map((day) => {
          const dayDate = createDateFromString(day.date);
          const isSelected = selectedDateKey === day.date;
          const forecastPublished = isWithinForecastWindow(createUtcDateFromCalendarDate(day.date));
          return (
            <TouchableOpacity
              key={`${cruise.id}-${day.date}`}
              style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
              onPress={() => onSelectDate(day.date)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Open marine forecast for day ${day.day}, ${day.date}, ${dayLocationLabel(day.port, day.isSeaDay)}`}
              testID={`weather-day-${cruise.id}-${day.date}`}
            >
              <Text style={[styles.dayNumber, isSelected && styles.selectedText]}>DAY {day.day}</Text>
              <Text style={[styles.dayDate, isSelected && styles.selectedText]}>
                {dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <View style={styles.locationRow}>
                {day.isSeaDay ? <Waves size={12} color={isSelected ? '#FFFFFF' : '#0E7490'} /> : <MapPin size={12} color={isSelected ? '#FFFFFF' : '#0E7490'} />}
                <Text style={[styles.location, isSelected && styles.selectedLocation]} numberOfLines={2}>
                  {dayLocationLabel(day.port, day.isSeaDay)}
                </Text>
              </View>
              <Text style={[styles.availability, isSelected && styles.selectedAvailability]}>
                {forecastPublished ? 'Live forecast window' : 'Opens when provider publishes'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(14,116,144,0.18)',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: SPACING.md },
  headingCopy: { flex: 1, gap: 2 },
  heading: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: TYPOGRAPHY.fontWeightBold },
  subheading: { color: '#475569', fontSize: TYPOGRAPHY.fontSizeXS, lineHeight: 17 },
  daysRow: { gap: 9, paddingHorizontal: SPACING.md, paddingVertical: 2 },
  dayButton: {
    width: 142,
    minHeight: 132,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(14,116,144,0.24)',
    backgroundColor: '#F0FDFA',
    padding: SPACING.sm,
    gap: 5,
  },
  dayButtonSelected: { backgroundColor: '#0E7490', borderColor: '#164E63' },
  dayNumber: { color: '#0E7490', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  dayDate: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, minHeight: 34 },
  location: { flex: 1, color: '#334155', fontSize: TYPOGRAPHY.fontSizeXS, lineHeight: 16, fontWeight: '700' },
  availability: { color: '#64748B', fontSize: 9, lineHeight: 13, marginTop: 'auto' },
  selectedText: { color: '#FFFFFF' },
  selectedLocation: { color: '#E0F2FE' },
  selectedAvailability: { color: '#BAE6FD' },
});
