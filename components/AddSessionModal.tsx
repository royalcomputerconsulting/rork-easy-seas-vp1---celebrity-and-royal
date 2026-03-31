import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Clock, Plus, Minus, Save, DollarSign, Award, Dices, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import type { MachineType, Denomination } from '@/state/CasinoSessionProvider';

interface GoldenTimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  label: string;
}

interface AddSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (session: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    notes?: string;
    buyIn?: number;
    cashOut?: number;
    winLoss?: number;
    machineType?: MachineType;
    denomination?: Denomination;
    pointsEarned?: number;
  }) => void;
  date: string;
  goldenTimeSlots: GoldenTimeSlot[];
}

const MACHINE_TYPES: { value: MachineType; label: string }[] = [
  { value: 'penny-slots', label: 'Penny Slots' },
  { value: 'nickel-slots', label: 'Nickel Slots' },
  { value: 'quarter-slots', label: 'Quarter Slots' },
  { value: 'dollar-slots', label: 'Dollar Slots' },
  { value: 'high-limit-slots', label: 'High Limit Slots' },
  { value: 'video-poker', label: 'Video Poker' },
  { value: 'blackjack', label: 'Blackjack' },
  { value: 'roulette', label: 'Roulette' },
  { value: 'craps', label: 'Craps' },
  { value: 'baccarat', label: 'Baccarat' },
  { value: 'poker', label: 'Poker' },
  { value: 'other', label: 'Other' },
];

const DENOMINATIONS: { value: Denomination; label: string }[] = [
  { value: 0.01, label: '1¢' },
  { value: 0.05, label: '5¢' },
  { value: 0.25, label: '25¢' },
  { value: 1, label: '$1' },
  { value: 5, label: '$5' },
  { value: 10, label: '$10' },
  { value: 25, label: '$25' },
  { value: 100, label: '$100' },
];

const TIME_PRESETS = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
];

export function AddSessionModal({
  visible,
  onClose,
  onSave,
  date,
  goldenTimeSlots,
}: AddSessionModalProps) {
  const [selectedSlot, setSelectedSlot] = useState<GoldenTimeSlot | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startHour, setStartHour] = useState(5);
  const [startMinute, setStartMinute] = useState(0);
  const [notes, setNotes] = useState('');
  
  const [buyIn, setBuyIn] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [machineType, setMachineType] = useState<MachineType | null>(null);
  const [denomination, setDenomination] = useState<Denomination | null>(null);
  const [pointsEarned, setPointsEarned] = useState('');
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [showBankrollSection, setShowBankrollSection] = useState(true);

  const formatTime = (hour: number, minute: number): string => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const calculateEndTime = useCallback((startH: number, startM: number, duration: number): string => {
    let totalMinutes = startH * 60 + startM + duration;
    if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return formatTime(endH, endM);
  }, []);

  const handleSelectSlot = useCallback((slot: GoldenTimeSlot) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedSlot(slot);
    setCustomMode(false);
    const [h, m] = slot.startTime.split(':').map(Number);
    setStartHour(h);
    setStartMinute(m);
    setDurationMinutes(Math.min(slot.durationMinutes, 120));
  }, []);

  const handleSelectPreset = useCallback((minutes: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setDurationMinutes(minutes);
  }, []);

  const handleIncrementDuration = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setDurationMinutes(prev => Math.min(prev + 15, 480));
  }, []);

  const handleDecrementDuration = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setDurationMinutes(prev => Math.max(prev - 15, 15));
  }, []);

  const handleIncrementHour = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setStartHour(prev => (prev + 1) % 24);
  }, []);

  const handleDecrementHour = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setStartHour(prev => (prev - 1 + 24) % 24);
  }, []);

  const handleIncrementMinute = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setStartMinute(prev => (prev + 15) % 60);
  }, []);

  const handleDecrementMinute = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setStartMinute(prev => (prev - 15 + 60) % 60);
  }, []);

  const calculatedWinLoss = React.useMemo(() => {
    const buyInNum = parseFloat(buyIn) || 0;
    const cashOutNum = parseFloat(cashOut) || 0;
    if (buyInNum === 0 && cashOutNum === 0) return null;
    return cashOutNum - buyInNum;
  }, [buyIn, cashOut]);

  const handleSave = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    const startTime = formatTime(startHour, startMinute);
    const endTime = calculateEndTime(startHour, startMinute, durationMinutes);
    
    const buyInNum = parseFloat(buyIn) || undefined;
    const cashOutNum = parseFloat(cashOut) || undefined;
    const pointsNum = parseInt(pointsEarned) || undefined;
    const winLossNum = buyInNum !== undefined && cashOutNum !== undefined 
      ? cashOutNum - buyInNum 
      : undefined;
    
    onSave({
      startTime,
      endTime,
      durationMinutes,
      notes: notes.trim() || undefined,
      buyIn: buyInNum,
      cashOut: cashOutNum,
      winLoss: winLossNum,
      machineType: machineType || undefined,
      denomination: denomination || undefined,
      pointsEarned: pointsNum,
    });
    
    setSelectedSlot(null);
    setCustomMode(false);
    setDurationMinutes(60);
    setStartHour(5);
    setStartMinute(0);
    setNotes('');
    setBuyIn('');
    setCashOut('');
    setMachineType(null);
    setDenomination(null);
    setPointsEarned('');
  }, [startHour, startMinute, durationMinutes, notes, buyIn, cashOut, machineType, denomination, pointsEarned, onSave, calculateEndTime]);

  const handleClose = useCallback(() => {
    setSelectedSlot(null);
    setCustomMode(false);
    setDurationMinutes(60);
    setStartHour(5);
    setStartMinute(0);
    setNotes('');
    setBuyIn('');
    setCashOut('');
    setMachineType(null);
    setDenomination(null);
    setPointsEarned('');
    onClose();
  }, [onClose]);

  const formatMinutes = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log Session</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {goldenTimeSlots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Select Golden Time</Text>
              <View style={styles.slotsGrid}>
                {goldenTimeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotButton,
                      selectedSlot?.id === slot.id && styles.slotButtonSelected,
                    ]}
                    onPress={() => handleSelectSlot(slot)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.slotLabel,
                      selectedSlot?.id === slot.id && styles.slotLabelSelected,
                    ]}>
                      {slot.label}
                    </Text>
                    <Text style={[
                      styles.slotTime,
                      selectedSlot?.id === slot.id && styles.slotTimeSelected,
                    ]}>
                      {slot.startTime} - {slot.endTime}
                    </Text>
                    <Text style={[
                      styles.slotDuration,
                      selectedSlot?.id === slot.id && styles.slotDurationSelected,
                    ]}>
                      {formatMinutes(slot.durationMinutes)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.customButton,
                  customMode && styles.customButtonSelected,
                ]}
                onPress={() => {
                  setCustomMode(true);
                  setSelectedSlot(null);
                }}
                activeOpacity={0.7}
              >
                <Clock size={18} color={customMode ? COLORS.white : '#059669'} />
                <Text style={[
                  styles.customButtonText,
                  customMode && styles.customButtonTextSelected,
                ]}>
                  Custom Time
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {(selectedSlot || customMode || goldenTimeSlots.length === 0) && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Start Time</Text>
                <View style={styles.timePickerRow}>
                  <View style={styles.timePickerUnit}>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={handleIncrementHour}
                      activeOpacity={0.7}
                    >
                      <Plus size={18} color="#059669" />
                    </TouchableOpacity>
                    <View style={styles.timeDisplay}>
                      <Text style={styles.timeValue}>
                        {String(startHour).padStart(2, '0')}
                      </Text>
                      <Text style={styles.timeLabel}>Hour</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={handleDecrementHour}
                      activeOpacity={0.7}
                    >
                      <Minus size={18} color="#059669" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.timeSeparator}>:</Text>

                  <View style={styles.timePickerUnit}>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={handleIncrementMinute}
                      activeOpacity={0.7}
                    >
                      <Plus size={18} color="#059669" />
                    </TouchableOpacity>
                    <View style={styles.timeDisplay}>
                      <Text style={styles.timeValue}>
                        {String(startMinute).padStart(2, '0')}
                      </Text>
                      <Text style={styles.timeLabel}>Min</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={handleDecrementMinute}
                      activeOpacity={0.7}
                    >
                      <Minus size={18} color="#059669" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Duration</Text>
                <View style={styles.presetGrid}>
                  {TIME_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.minutes}
                      style={[
                        styles.presetButton,
                        durationMinutes === preset.minutes && styles.presetButtonSelected,
                      ]}
                      onPress={() => handleSelectPreset(preset.minutes)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.presetText,
                        durationMinutes === preset.minutes && styles.presetTextSelected,
                      ]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.durationAdjuster}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={handleDecrementDuration}
                    activeOpacity={0.7}
                  >
                    <Minus size={20} color="#059669" />
                  </TouchableOpacity>
                  <View style={styles.durationDisplay}>
                    <Text style={styles.durationValue}>{formatMinutes(durationMinutes)}</Text>
                    <Text style={styles.durationLabel}>Playing Time</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={handleIncrementDuration}
                    activeOpacity={0.7}
                  >
                    <Plus size={20} color="#059669" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>End Time</Text>
                <View style={styles.endTimeDisplay}>
                  <Clock size={18} color="#6B7280" />
                  <Text style={styles.endTimeText}>
                    {calculateEndTime(startHour, startMinute, durationMinutes)}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="e.g., Morning slots session, good run..."
                  placeholderTextColor="#9CA3AF"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.bankrollToggle}
            onPress={() => setShowBankrollSection(!showBankrollSection)}
            activeOpacity={0.7}
          >
            <View style={styles.bankrollToggleContent}>
              <DollarSign size={18} color="#059669" />
              <Text style={styles.bankrollToggleText}>Bankroll Tracking</Text>
            </View>
            <ChevronDown 
              size={18} 
              color="#059669" 
              style={{ transform: [{ rotate: showBankrollSection ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {showBankrollSection && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Game Type</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowMachineDropdown(!showMachineDropdown)}
                  activeOpacity={0.7}
                >
                  <Dices size={18} color="#6B7280" />
                  <Text style={[styles.dropdownButtonText, machineType && styles.dropdownButtonTextSelected]}>
                    {machineType ? MACHINE_TYPES.find(m => m.value === machineType)?.label : 'Select game type...'}
                  </Text>
                  <ChevronDown size={18} color="#6B7280" />
                </TouchableOpacity>
                
                {showMachineDropdown && (
                  <View style={styles.dropdownList}>
                    {MACHINE_TYPES.map((mt) => (
                      <TouchableOpacity
                        key={mt.value}
                        style={[
                          styles.dropdownItem,
                          machineType === mt.value && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setMachineType(mt.value);
                          setShowMachineDropdown(false);
                          if (Platform.OS !== 'web') {
                            Haptics.selectionAsync();
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          machineType === mt.value && styles.dropdownItemTextSelected,
                        ]}>
                          {mt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Denomination</Text>
                <View style={styles.denomGrid}>
                  {DENOMINATIONS.map((d) => (
                    <TouchableOpacity
                      key={d.value}
                      style={[
                        styles.denomButton,
                        denomination === d.value && styles.denomButtonSelected,
                      ]}
                      onPress={() => {
                        setDenomination(d.value);
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.denomText,
                        denomination === d.value && styles.denomTextSelected,
                      ]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bankroll</Text>
                <View style={styles.bankrollRow}>
                  <View style={styles.bankrollInput}>
                    <Text style={styles.bankrollLabel}>Buy-In</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.currencyValue}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={buyIn}
                        onChangeText={setBuyIn}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  
                  <View style={styles.bankrollInput}>
                    <Text style={styles.bankrollLabel}>Cash-Out</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.currencyValue}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={cashOut}
                        onChangeText={setCashOut}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
                
                {calculatedWinLoss !== null && (
                  <View style={[
                    styles.winLossResult,
                    { backgroundColor: calculatedWinLoss >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
                  ]}>
                    <Text style={styles.winLossLabel}>Session Result</Text>
                    <Text style={[
                      styles.winLossValue,
                      { color: calculatedWinLoss >= 0 ? '#059669' : '#DC2626' }
                    ]}>
                      {calculatedWinLoss >= 0 ? '+' : ''}{calculatedWinLoss.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Points Earned (Optional)</Text>
                <View style={styles.pointsInputContainer}>
                  <Award size={18} color="#8B5CF6" />
                  <TextInput
                    style={styles.pointsInput}
                    placeholder="e.g., 150"
                    placeholderTextColor="#9CA3AF"
                    value={pointsEarned}
                    onChangeText={setPointsEarned}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.pointsUnit}>pts</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              <Save size={20} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Log Session</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#374151',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotsGrid: {
    gap: SPACING.sm,
  },
  slotButton: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    ...SHADOW.sm,
  },
  slotButtonSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  slotLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1F2937',
    marginBottom: 2,
  },
  slotLabelSelected: {
    color: '#065F46',
  },
  slotTime: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
  },
  slotTimeSelected: {
    color: '#047857',
  },
  slotDuration: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#9CA3AF',
    marginTop: 4,
  },
  slotDurationSelected: {
    color: '#059669',
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  customButtonSelected: {
    backgroundColor: '#059669',
    borderStyle: 'solid',
  },
  customButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#059669',
  },
  customButtonTextSelected: {
    color: COLORS.white,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  timePickerUnit: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  timeDisplay: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#065F46',
  },
  timeLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginTop: 2,
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#065F46',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  presetButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetButtonSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  presetText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  presetTextSelected: {
    color: COLORS.white,
  },
  durationAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  durationDisplay: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  durationValue: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#065F46',
  },
  durationLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginTop: 2,
  },
  endTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  endTimeText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1F2937',
  },
  notesInput: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
    ...SHADOW.sm,
  },
  bankrollToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  bankrollToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bankrollToggleText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#059669',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#9CA3AF',
  },
  dropdownButtonTextSelected: {
    color: '#1F2937',
  },
  dropdownList: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
    ...SHADOW.md,
    maxHeight: 200,
  },
  dropdownItem: {
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: '#ECFDF5',
  },
  dropdownItemText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1F2937',
  },
  dropdownItemTextSelected: {
    color: '#059669',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  denomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  denomButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 50,
    alignItems: 'center',
  },
  denomButtonSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  denomText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  denomTextSelected: {
    color: COLORS.white,
  },
  bankrollRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bankrollInput: {
    flex: 1,
  },
  bankrollLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.sm,
  },
  currencySymbol: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#10B981',
    marginRight: 4,
  },
  currencyValue: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1F2937',
    paddingVertical: SPACING.sm,
  },
  winLossResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  winLossLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  winLossValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  pointsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  pointsInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#1F2937',
    paddingVertical: SPACING.md,
  },
  pointsUnit: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#8B5CF6',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
