import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Clock, Save, Edit2, Ship, Anchor, ChevronDown, ChevronUp, X, Sparkles, ArrowLeftRight } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTime12Hour } from '@/lib/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import type { BookedCruise } from '@/types/models';
import {
  type CasinoAvailability,
  calculateCasinoAvailabilityForCruise,
} from '@/lib/casinoAvailability';

export interface CasinoOpenHoursDay {
  day: number;
  date: string;
  port: string;
  isSeaDay: boolean;
  bestGuessHours: string;
  bestGuessOpen: boolean;
  actualOpenTime: string;
  actualCloseTime: string;
  hasOverride: boolean;
}

export interface CasinoOpenHoursData {
  cruiseId: string;
  cruiseName: string;
  days: CasinoOpenHoursDay[];
  updatedAt: string;
}

interface CasinoOpenHoursCardProps {
  cruise: BookedCruise | null;
  allUpcomingCruises?: BookedCruise[];
  onHoursUpdated?: () => void;
  onHoursDataLoaded?: (data: CasinoOpenHoursData | null) => void;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return dateStr;
  }
}

function shortenPort(port: string): string {
  if (!port) return '';
  return port
    .replace(', California', ', CA')
    .replace(', Texas', ', TX')
    .replace(', Florida', ', FL')
    .replace(', Mexico', ', MX')
    .replace(', Honduras', '')
    .replace(', British Columbia', ', BC')
    .replace(', Alaska', ', AK')
    .replace(', Washington', ', WA')
    .replace(', Hawaii', ', HI')
    .replace(' (NY Metro)', '')
    .replace(' (Ward Cove)', '')
    .replace(' (Oahu)', '');
}

function formatSailingLabel(cruise: BookedCruise): string {
  const sailParts = cruise.sailDate?.split('-') || [];
  const returnParts = (cruise.returnDate || cruise.sailDate)?.split('-') || [];
  const sMonth = parseInt(sailParts[1] || '0', 10);
  const sDay = parseInt(sailParts[2] || '0', 10);
  const rMonth = parseInt(returnParts[1] || '0', 10);
  const rDay = parseInt(returnParts[2] || '0', 10);
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (sMonth === rMonth) {
    return `${months[sMonth]} ${sDay}-${rDay}`;
  }
  return `${months[sMonth]} ${sDay} - ${months[rMonth]} ${rDay}`;
}

export function CasinoOpenHoursCard({ cruise, allUpcomingCruises, onHoursUpdated, onHoursDataLoaded }: CasinoOpenHoursCardProps) {
  const [selectedCruise, setSelectedCruise] = useState<BookedCruise | null>(cruise);
  const [hoursData, setHoursData] = useState<CasinoOpenHoursData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [editOpenTime, setEditOpenTime] = useState('');
  const [editCloseTime, setEditCloseTime] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showCruisePicker, setShowCruisePicker] = useState(false);

  useEffect(() => {
    if (cruise && !selectedCruise) {
      setSelectedCruise(cruise);
    }
  }, [cruise, selectedCruise]);

  const activeCruise = selectedCruise || cruise;

  const storageKey = useMemo(() => {
    if (!activeCruise?.id) return null;
    return `${ALL_STORAGE_KEYS.CASINO_OPEN_HOURS}_${activeCruise.id}`;
  }, [activeCruise?.id]);

  const casinoAvailability = useMemo(() => {
    if (!activeCruise) return null;
    try {
      return calculateCasinoAvailabilityForCruise(activeCruise);
    } catch (e) {
      console.error('[CasinoOpenHours] Error calculating availability:', e);
      return null;
    }
  }, [activeCruise]);

  const buildDefaultDays = useCallback((): CasinoOpenHoursDay[] => {
    if (!casinoAvailability?.dailyAvailability) return [];

    return casinoAvailability.dailyAvailability.map((avail: CasinoAvailability) => ({
      day: avail.day,
      date: avail.date,
      port: avail.port,
      isSeaDay: avail.isSeaDay,
      bestGuessHours: avail.casinoOpenHours,
      bestGuessOpen: avail.casinoOpen,
      actualOpenTime: '',
      actualCloseTime: '',
      hasOverride: false,
    }));
  }, [casinoAvailability]);

  useEffect(() => {
    if (!storageKey || !activeCruise) return;

    const loadSavedHours = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as CasinoOpenHoursData;
          if (parsed.cruiseId === activeCruise.id) {
            const defaultDays = buildDefaultDays();
            const mergedDays = defaultDays.map((defaultDay) => {
              const savedDay = parsed.days.find(d => d.day === defaultDay.day);
              if (savedDay?.hasOverride) {
                return {
                  ...defaultDay,
                  actualOpenTime: savedDay.actualOpenTime,
                  actualCloseTime: savedDay.actualCloseTime,
                  hasOverride: true,
                };
              }
              return defaultDay;
            });
            const loaded = { ...parsed, days: mergedDays };
            setHoursData(loaded);
            onHoursDataLoaded?.(loaded);
            console.log('[CasinoOpenHours] Loaded saved hours for cruise:', activeCruise.id);
            return;
          }
        }

        const defaultDays = buildDefaultDays();
        const defaultData = {
          cruiseId: activeCruise.id,
          cruiseName: activeCruise.shipName || 'Cruise',
          days: defaultDays,
          updatedAt: new Date().toISOString(),
        };
        setHoursData(defaultData);
        onHoursDataLoaded?.(defaultData);
        console.log('[CasinoOpenHours] Initialized default hours for cruise:', activeCruise.id);
      } catch (e) {
        console.error('[CasinoOpenHours] Error loading hours:', e);
        const defaultDays = buildDefaultDays();
        const fallbackData = {
          cruiseId: activeCruise?.id || '',
          cruiseName: activeCruise?.shipName || 'Cruise',
          days: defaultDays,
          updatedAt: new Date().toISOString(),
        };
        setHoursData(fallbackData);
        onHoursDataLoaded?.(fallbackData);
      }
    };

    void loadSavedHours();
  }, [storageKey, activeCruise, buildDefaultDays, onHoursDataLoaded]);

  const handleSave = useCallback(async () => {
    if (!hoursData || !storageKey) return;

    try {
      setIsSaving(true);
      const toSave = { ...hoursData, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(storageKey, JSON.stringify(toSave));
      setHoursData(toSave);
      onHoursDataLoaded?.(toSave);
      console.log('[CasinoOpenHours] Saved hours for cruise:', hoursData.cruiseId);
      Alert.alert('Casino Hours Saved', 'Your actual casino open hours have been updated.');
      void onHoursUpdated?.();
    } catch (e) {
      console.error('[CasinoOpenHours] Save error:', e);
      Alert.alert('Save Error', 'Failed to save casino hours. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [hoursData, storageKey, onHoursUpdated, onHoursDataLoaded]);

  const handleEditDay = useCallback((dayIndex: number) => {
    if (!hoursData) return;
    const day = hoursData.days[dayIndex];
    setEditingDayIndex(dayIndex);
    setEditOpenTime(day.hasOverride ? day.actualOpenTime : '');
    setEditCloseTime(day.hasOverride ? day.actualCloseTime : '');
    setIsModalVisible(true);
  }, [hoursData]);

  const handleSaveEdit = useCallback(() => {
    if (editingDayIndex === null || !hoursData) return;

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (editOpenTime.trim() && !timeRegex.test(editOpenTime.trim())) {
      Alert.alert('Invalid Time', 'Open time must be in HH:mm format (e.g., "10:00").');
      return;
    }
    if (editCloseTime.trim() && !timeRegex.test(editCloseTime.trim())) {
      Alert.alert('Invalid Time', 'Close time must be in HH:mm format (e.g., "02:00").');
      return;
    }

    const hasValues = editOpenTime.trim() || editCloseTime.trim();

    setHoursData(prev => {
      if (!prev) return prev;
      const updatedDays = [...prev.days];
      updatedDays[editingDayIndex] = {
        ...updatedDays[editingDayIndex],
        actualOpenTime: editOpenTime.trim(),
        actualCloseTime: editCloseTime.trim(),
        hasOverride: Boolean(hasValues),
      };
      return { ...prev, days: updatedDays };
    });

    setIsModalVisible(false);
    setEditingDayIndex(null);
  }, [editingDayIndex, editOpenTime, editCloseTime, hoursData]);

  const handleClearOverride = useCallback(() => {
    if (editingDayIndex === null || !hoursData) return;

    setHoursData(prev => {
      if (!prev) return prev;
      const updatedDays = [...prev.days];
      updatedDays[editingDayIndex] = {
        ...updatedDays[editingDayIndex],
        actualOpenTime: '',
        actualCloseTime: '',
        hasOverride: false,
      };
      return { ...prev, days: updatedDays };
    });

    setIsModalVisible(false);
    setEditingDayIndex(null);
  }, [editingDayIndex, hoursData]);

  const handleSelectCruise = useCallback((c: BookedCruise) => {
    setSelectedCruise(c);
    setShowCruisePicker(false);
    setHoursData(null);
    console.log('[CasinoOpenHours] Switched to cruise:', c.id, c.shipName, c.sailDate);
  }, []);

  const hasAnyOverrides = useMemo(() => {
    return hoursData?.days.some(d => d.hasOverride) ?? false;
  }, [hoursData]);

  const availableCruises = useMemo(() => {
    if (!allUpcomingCruises || allUpcomingCruises.length === 0) {
      return activeCruise ? [activeCruise] : [];
    }
    return allUpcomingCruises;
  }, [allUpcomingCruises, activeCruise]);

  if (!activeCruise) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1E3A5F', '#2E5077']} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Clock size={20} color={COLORS.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Casino Open Hours</Text>
              <Text style={styles.headerSubtitle}>No upcoming cruise selected</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyText}>Book a cruise to see casino hours</Text>
        </View>
      </View>
    );
  }

  if (!hoursData) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1E3A5F', '#2E5077']} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Clock size={20} color={COLORS.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Casino Open Hours</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color="#1E3A5F" />
        </View>
      </View>
    );
  }

  const overrideCount = hoursData.days.filter(d => d.hasOverride).length;

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsExpanded(!isExpanded)}>
        <LinearGradient colors={['#1E3A5F', '#2E5077']} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Clock size={20} color={COLORS.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Casino Open Hours</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeCruise.shipName} · {formatSailingLabel(activeCruise)}
                {overrideCount > 0 ? ` · ${overrideCount} edited` : ''}
              </Text>
            </View>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color={COLORS.white} />
          ) : (
            <ChevronDown size={20} color={COLORS.white} />
          )}
        </LinearGradient>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {availableCruises.length > 1 && (
            <TouchableOpacity
              style={styles.switchSailingsButton}
              onPress={() => setShowCruisePicker(true)}
              activeOpacity={0.7}
              testID="casino-hours-switch-sailing"
            >
              <ArrowLeftRight size={14} color="#1E3A5F" />
              <Text style={styles.switchSailingsText}>Switch Sailing</Text>
              <Text style={styles.switchSailingsCount}>
                {availableCruises.length} sailings
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <Sparkles size={12} color="#1E3A5F" />
              <Text style={styles.legendText}>Best Guess</Text>
            </View>
            <View style={styles.legendItem}>
              <Edit2 size={12} color="#059669" />
              <Text style={styles.legendText}>Actual (tap to edit)</Text>
            </View>
          </View>

          <View style={styles.daysContainer}>
            {hoursData.days.map((day, index) => (
              <TouchableOpacity
                key={`day-${day.day}`}
                style={[
                  styles.dayRow,
                  day.hasOverride && styles.dayRowOverride,
                  !day.bestGuessOpen && !day.hasOverride && styles.dayRowClosed,
                ]}
                onPress={() => handleEditDay(index)}
                activeOpacity={0.7}
                testID={`casino-hours-day-${day.day}`}
              >
                <View style={styles.dayTopRow}>
                  <View style={styles.dayDateSection}>
                    <View style={[
                      styles.dayBadge,
                      day.isSeaDay ? styles.dayBadgeSea : styles.dayBadgePort,
                    ]}>
                      {day.isSeaDay ? (
                        <Ship size={11} color={COLORS.white} />
                      ) : (
                        <Anchor size={11} color={COLORS.white} />
                      )}
                    </View>
                    <View style={styles.dayDateInfo}>
                      <Text style={styles.dayDateText} numberOfLines={1}>
                        {formatShortDate(day.date)}
                      </Text>
                      <Text style={styles.dayPortText} numberOfLines={1}>
                        {day.isSeaDay ? 'At Sea' : shortenPort(day.port)}
                      </Text>
                    </View>
                  </View>
                  <Edit2 size={13} color={day.hasOverride ? '#059669' : '#9CA3AF'} />
                </View>

                <View style={styles.dayHoursRow}>
                  <View style={styles.hoursBlock}>
                    <Text style={styles.hoursLabel}>BEST GUESS</Text>
                    <Text style={[
                      styles.hoursValue,
                      !day.bestGuessOpen && styles.hoursValueClosed,
                    ]} numberOfLines={1}>
                      {day.bestGuessOpen ? day.bestGuessHours : 'Closed'}
                    </Text>
                  </View>

                  <View style={styles.hoursDivider} />

                  <View style={styles.hoursBlock}>
                    <Text style={styles.hoursLabelActual}>ACTUAL</Text>
                    {day.hasOverride ? (
                      <Text style={styles.hoursValueActual} numberOfLines={1}>
                        {day.actualOpenTime && day.actualCloseTime
                          ? `${formatTime12Hour(day.actualOpenTime)} - ${formatTime12Hour(day.actualCloseTime)}`
                          : day.actualOpenTime
                            ? `Opens ${formatTime12Hour(day.actualOpenTime)}`
                            : day.actualCloseTime
                              ? `Closes ${formatTime12Hour(day.actualCloseTime)}`
                              : 'Set'}
                      </Text>
                    ) : (
                      <Text style={styles.hoursValuePlaceholder}>Tap to set</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {hasAnyOverrides && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#1E3A5F', '#2E5077']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Save size={18} color={COLORS.white} />
                    <Text style={styles.saveButtonText}>Save Casino Hours</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Clock size={20} color="#1E3A5F" />
                  <Text style={styles.modalTitle}>
                    {editingDayIndex !== null
                      ? `${formatShortDate(hoursData.days[editingDayIndex]?.date || '')} — ${hoursData.days[editingDayIndex]?.port}`
                      : 'Edit Hours'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {editingDayIndex !== null && (
                <View style={styles.modalBestGuess}>
                  <Sparkles size={14} color="#1E3A5F" />
                  <Text style={styles.modalBestGuessText}>
                    Best Guess: {hoursData.days[editingDayIndex]?.bestGuessOpen
                      ? hoursData.days[editingDayIndex]?.bestGuessHours
                      : 'Closed'}
                  </Text>
                </View>
              )}

              <View style={styles.modalContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Casino Opens (HH:mm)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., 10:00"
                    placeholderTextColor="#9CA3AF"
                    value={editOpenTime}
                    onChangeText={setEditOpenTime}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.inputHint}>24-hour format (e.g., 10:00 for 10 AM, 22:00 for 10 PM)</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Casino Closes (HH:mm)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., 02:00"
                    placeholderTextColor="#9CA3AF"
                    value={editCloseTime}
                    onChangeText={setEditCloseTime}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.inputHint}>24-hour format (e.g., 02:00 for 2 AM next day)</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                {editingDayIndex !== null && hoursData.days[editingDayIndex]?.hasOverride && (
                  <TouchableOpacity
                    style={styles.modalClearButton}
                    onPress={handleClearOverride}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalClearText}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveEdit}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#1E3A5F', '#2E5077']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSaveButtonGradient}
                  >
                    <Save size={16} color={COLORS.white} />
                    <Text style={styles.modalSaveText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCruisePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCruisePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Switch Sailing</Text>
              <TouchableOpacity
                onPress={() => setShowCruisePicker(false)}
                activeOpacity={0.7}
                style={styles.pickerCloseBtn}
              >
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {availableCruises.map((c) => {
                const isSelected = c.id === activeCruise?.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => handleSelectCruise(c)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerItemLeft}>
                      <Ship size={16} color={isSelected ? '#1E3A5F' : '#6B7280'} />
                      <View style={styles.pickerItemInfo}>
                        <Text style={[styles.pickerItemShip, isSelected && styles.pickerItemShipSelected]}>
                          {c.shipName}
                        </Text>
                        <Text style={styles.pickerItemDates}>
                          {formatSailingLabel(c)} · {c.nights}N · {c.itineraryName || c.destination}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.pickerSelectedBadge}>
                        <Text style={styles.pickerSelectedBadgeText}>Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F4F8',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.15)',
    ...SHADOW.sm,
    marginTop: SPACING.md,
  },
  header: {
    padding: SPACING.sm,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  emptyContent: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
  },
  loadingContent: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  content: {
    padding: SPACING.sm,
    paddingTop: SPACING.md,
  },
  switchSailingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 58, 95, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.12)',
  },
  switchSailingsText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1E3A5F',
    flex: 1,
  },
  switchSailingsCount: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  legendRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  daysContainer: {
    gap: 8,
    marginBottom: SPACING.sm,
  },
  dayRow: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.1)',
  },
  dayRowOverride: {
    backgroundColor: '#ECFDF5',
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  dayRowClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(220, 38, 38, 0.12)',
  },
  dayTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayDateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dayBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBadgeSea: {
    backgroundColor: '#3B82F6',
  },
  dayBadgePort: {
    backgroundColor: '#F59E0B',
  },
  dayDateInfo: {
    flex: 1,
  },
  dayDateText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1E3A5F',
  },
  dayPortText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 1,
  },
  dayHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  hoursBlock: {
    flex: 1,
  },
  hoursDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 10,
  },
  hoursLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#1E3A5F',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hoursLabelActual: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#059669',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hoursValue: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#374151',
  },
  hoursValueClosed: {
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  hoursValueActual: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#059669',
  },
  hoursValuePlaceholder: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  saveButton: {
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1E3A5F',
    flex: 1,
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  modalBestGuess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: '#EFF6FF',
    borderRadius: BORDER_RADIUS.sm,
  },
  modalBestGuessText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E3A5F',
    fontWeight: '500' as const,
  },
  modalContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: '#1E3A5F',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#111827',
  },
  inputHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: 0,
  },
  modalClearButton: {
    backgroundColor: '#FEF2F2',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  modalClearText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  modalSaveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  modalSaveText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.white,
  },
  pickerContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1E3A5F',
  },
  pickerCloseBtn: {
    padding: 4,
  },
  pickerList: {
    padding: SPACING.sm,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E3A5F',
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemShip: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  pickerItemShipSelected: {
    color: '#1E3A5F',
    fontWeight: '700' as const,
  },
  pickerItemDates: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pickerSelectedBadge: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pickerSelectedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
});
