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
import { Clock, Save, Edit2, Ship, Anchor, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react-native';
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
  onHoursUpdated?: () => void;
  onHoursDataLoaded?: (data: CasinoOpenHoursData | null) => void;
}

export function CasinoOpenHoursCard({ cruise, onHoursUpdated, onHoursDataLoaded }: CasinoOpenHoursCardProps) {
  const [hoursData, setHoursData] = useState<CasinoOpenHoursData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [editOpenTime, setEditOpenTime] = useState('');
  const [editCloseTime, setEditCloseTime] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const storageKey = useMemo(() => {
    if (!cruise?.id) return null;
    return `${ALL_STORAGE_KEYS.CASINO_OPEN_HOURS}_${cruise.id}`;
  }, [cruise?.id]);

  const casinoAvailability = useMemo(() => {
    if (!cruise) return null;
    try {
      return calculateCasinoAvailabilityForCruise(cruise);
    } catch (e) {
      console.error('[CasinoOpenHours] Error calculating availability:', e);
      return null;
    }
  }, [cruise]);

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
    if (!storageKey || !cruise) return;

    const loadSavedHours = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as CasinoOpenHoursData;
          if (parsed.cruiseId === cruise.id) {
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
            console.log('[CasinoOpenHours] Loaded saved hours for cruise:', cruise.id);
            return;
          }
        }

        const defaultDays = buildDefaultDays();
        const defaultData = {
          cruiseId: cruise.id,
          cruiseName: cruise.shipName || 'Cruise',
          days: defaultDays,
          updatedAt: new Date().toISOString(),
        };
        setHoursData(defaultData);
        onHoursDataLoaded?.(defaultData);
        console.log('[CasinoOpenHours] Initialized default hours for cruise:', cruise.id);
      } catch (e) {
        console.error('[CasinoOpenHours] Error loading hours:', e);
        const defaultDays = buildDefaultDays();
        const fallbackData = {
          cruiseId: cruise?.id || '',
          cruiseName: cruise?.shipName || 'Cruise',
          days: defaultDays,
          updatedAt: new Date().toISOString(),
        };
        setHoursData(fallbackData);
        onHoursDataLoaded?.(fallbackData);
      }
    };

    void loadSavedHours();
  }, [storageKey, cruise, buildDefaultDays, onHoursDataLoaded]);

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

  const hasAnyOverrides = useMemo(() => {
    return hoursData?.days.some(d => d.hasOverride) ?? false;
  }, [hoursData]);

  if (!cruise) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#7C3AED', '#9333EA']} style={styles.header}>
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
        <LinearGradient colors={['#7C3AED', '#9333EA']} style={styles.header}>
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
          <ActivityIndicator size="small" color="#7C3AED" />
        </View>
      </View>
    );
  }

  const overrideCount = hoursData.days.filter(d => d.hasOverride).length;

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsExpanded(!isExpanded)}>
        <LinearGradient colors={['#7C3AED', '#9333EA']} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Clock size={20} color={COLORS.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Casino Open Hours</Text>
              <Text style={styles.headerSubtitle}>
                {cruise.shipName} · {hoursData.days.length} days
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
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <Sparkles size={12} color="#7C3AED" />
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
                <View style={styles.dayLeft}>
                  <View style={[
                    styles.dayBadge,
                    day.isSeaDay ? styles.dayBadgeSea : styles.dayBadgePort,
                  ]}>
                    {day.isSeaDay ? (
                      <Ship size={12} color={COLORS.white} />
                    ) : (
                      <Anchor size={12} color={COLORS.white} />
                    )}
                  </View>
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayLabel}>Day {day.day}</Text>
                    <Text style={styles.dayPort} numberOfLines={1}>
                      {day.port}
                    </Text>
                  </View>
                </View>

                <View style={styles.dayRight}>
                  <View style={styles.hoursColumn}>
                    <Text style={styles.hoursLabel}>BEST GUESS</Text>
                    <Text style={[
                      styles.hoursValue,
                      !day.bestGuessOpen && styles.hoursValueClosed,
                    ]}>
                      {day.bestGuessOpen ? day.bestGuessHours : 'Closed'}
                    </Text>
                  </View>

                  <View style={[styles.hoursColumn, styles.actualColumn]}>
                    <Text style={styles.hoursLabelActual}>ACTUAL</Text>
                    {day.hasOverride ? (
                      <Text style={styles.hoursValueActual}>
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

                  <Edit2 size={14} color={day.hasOverride ? '#059669' : '#9CA3AF'} />
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
                colors={['#7C3AED', '#9333EA']}
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
                  <Clock size={20} color="#7C3AED" />
                  <Text style={styles.modalTitle}>
                    {editingDayIndex !== null
                      ? `Day ${hoursData.days[editingDayIndex]?.day} - ${hoursData.days[editingDayIndex]?.port}`
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
                  <Sparkles size={14} color="#7C3AED" />
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
                    colors={['#7C3AED', '#9333EA']}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F3FF',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    ...SHADOW.sm,
    marginTop: SPACING.md,
  },
  header: {
    padding: SPACING.sm,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.9)',
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
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  daysContainer: {
    gap: 6,
    marginBottom: SPACING.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
  },
  dayRowOverride: {
    backgroundColor: '#ECFDF5',
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  dayRowClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(220, 38, 38, 0.15)',
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 0.35,
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
  dayInfo: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#374151',
  },
  dayPort: {
    fontSize: 10,
    color: '#6B7280',
  },
  dayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 0.65,
    justifyContent: 'flex-end',
  },
  hoursColumn: {
    alignItems: 'flex-end',
  },
  actualColumn: {
    minWidth: 70,
  },
  hoursLabel: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  hoursLabelActual: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#059669',
    letterSpacing: 0.5,
  },
  hoursValue: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#374151',
  },
  hoursValueClosed: {
    color: '#DC2626',
  },
  hoursValueActual: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#059669',
  },
  hoursValuePlaceholder: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  saveButton: {
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
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
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
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
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#7C3AED',
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
    backgroundColor: '#F5F3FF',
    borderRadius: BORDER_RADIUS.sm,
  },
  modalBestGuessText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#7C3AED',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
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
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#7C3AED',
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
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
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
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
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
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
