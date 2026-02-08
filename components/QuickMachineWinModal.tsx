import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { X, DollarSign, TrendingUp, Calendar } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import type { Denomination } from '@/state/CasinoSessionProvider';

interface QuickMachineWinModalProps {
  visible: boolean;
  onClose: () => void;
  machine: {
    id: string;
    machineName: string;
  };
  onSubmit: (data: WinEntryData) => Promise<void>;
}

export interface WinEntryData {
  denomination: Denomination;
  winAmount: number;
  isJackpot: boolean;
  jackpotType?: 'mini' | 'minor' | 'major' | 'grand' | 'mega';
  sessionDuration?: number;
  pointsEarned?: number;
  notes?: string;
}

const COMMON_DENOMINATIONS: Denomination[] = [0.01, 0.05, 0.25, 1, 5];
const DENOMINATION_LABELS: Record<Denomination, string> = {
  0.01: '1¢',
  0.05: '5¢',
  0.25: '25¢',
  1: '$1',
  5: '$5',
  10: '$10',
  25: '$25',
  100: '$100',
};

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2500];
const JACKPOT_TYPES: { value: 'mini' | 'minor' | 'major' | 'grand' | 'mega'; label: string }[] = [
  { value: 'mini', label: 'Mini' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'grand', label: 'Grand' },
  { value: 'mega', label: 'Mega' },
];

export default function QuickMachineWinModal({ visible, onClose, machine, onSubmit }: QuickMachineWinModalProps) {
  const [selectedDenom, setSelectedDenom] = useState<Denomination>(0.01);
  const [winAmount, setWinAmount] = useState<string>('');
  const [isJackpot, setIsJackpot] = useState(false);
  const [jackpotType, setJackpotType] = useState<'mini' | 'minor' | 'major' | 'grand' | 'mega'>('major');
  const [sessionMinutes, setSessionMinutes] = useState<string>('30');
  const [pointsEarned, setPointsEarned] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      timeZone: 'UTC', 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const currentTime = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const handleQuickAmount = (amount: number) => {
    setWinAmount(amount.toString());
  };

  const handleSubmit = async () => {
    const amount = parseFloat(winAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      console.log('[QuickMachineWinModal] Invalid amount:', winAmount);
      if (Platform.OS === 'web') {
        alert('Please enter a valid win amount');
      }
      return;
    }

    console.log('[QuickMachineWinModal] Submitting win:', {
      denomination: selectedDenom,
      winAmount: amount,
      isJackpot,
      sessionDuration: parseInt(sessionMinutes) || 30,
    });

    setIsSubmitting(true);
    try {
      await onSubmit({
        denomination: selectedDenom,
        winAmount: amount,
        isJackpot,
        jackpotType: isJackpot ? jackpotType : undefined,
        sessionDuration: parseInt(sessionMinutes) || 30,
        pointsEarned: pointsEarned ? parseInt(pointsEarned) : undefined,
        notes: notes.trim() || undefined,
      });

      console.log('[QuickMachineWinModal] Win submitted successfully');
      
      setWinAmount('');
      setPointsEarned('');
      setNotes('');
      setIsJackpot(false);
      setSessionMinutes('30');
      onClose();
    } catch (error) {
      console.error('[QuickMachineWinModal] Error submitting win:', error);
      if (Platform.OS === 'web') {
        alert('Failed to save win. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = winAmount && parseFloat(winAmount) > 0 && !isSubmitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Quick Win Entry</Text>
              <Text style={styles.machineName}>{machine.machineName}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X color={COLORS.textMuted} size={24} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dateTimeCard}>
              <Calendar color={COLORS.navyDeep} size={18} strokeWidth={2} />
              <Text style={styles.dateTimeText}>
                {currentDate} at {currentTime}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Denomination</Text>
              <View style={styles.denomGrid}>
                {COMMON_DENOMINATIONS.map(denom => (
                  <TouchableOpacity
                    key={denom}
                    style={[
                      styles.denomButton,
                      selectedDenom === denom && styles.denomButtonSelected,
                    ]}
                    onPress={() => setSelectedDenom(denom)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.denomButtonText,
                        selectedDenom === denom && styles.denomButtonTextSelected,
                      ]}
                    >
                      {DENOMINATION_LABELS[denom]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Win Amount</Text>
              <View style={styles.amountInputContainer}>
                <DollarSign color={COLORS.money} size={24} strokeWidth={2.5} />
                <TextInput
                  style={styles.amountInput}
                  value={winAmount}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      return;
                    }
                    console.log('[QuickMachineWinModal] Amount changed:', cleaned);
                    setWinAmount(cleaned);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  returnKeyType="done"
                  autoFocus
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.quickAmountGrid}>
                {QUICK_AMOUNTS.map(amount => (
                  <TouchableOpacity
                    key={amount}
                    style={styles.quickAmountButton}
                    onPress={() => handleQuickAmount(amount)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickAmountText}>${amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.jackpotToggleRow}>
                <Text style={styles.sectionLabel}>Jackpot Win?</Text>
                <TouchableOpacity
                  style={[styles.toggle, isJackpot && styles.toggleActive]}
                  onPress={() => setIsJackpot(!isJackpot)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.toggleThumb, isJackpot && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>

              {isJackpot && (
                <View style={styles.jackpotTypeGrid}>
                  {JACKPOT_TYPES.map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.jackpotButton,
                        jackpotType === value && styles.jackpotButtonSelected,
                      ]}
                      onPress={() => setJackpotType(value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.jackpotButtonText,
                          jackpotType === value && styles.jackpotButtonTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Session Duration (minutes)</Text>
              <TextInput
                style={styles.durationInput}
                value={sessionMinutes}
                onChangeText={setSessionMinutes}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Points Earned (Optional)</Text>
              <TextInput
                style={styles.durationInput}
                value={pointsEarned}
                onChangeText={setPointsEarned}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any additional details..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.7}
            >
              <TrendingUp 
                color={COLORS.white} 
                size={20} 
                strokeWidth={2.5} 
              />
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Saving...' : 'Log Win'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  machineName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
  },
  dateTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.moneyBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.money,
    marginBottom: 24,
  },
  dateTimeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 12,
  },
  denomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  denomButton: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 14,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  denomButtonSelected: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  denomButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  denomButtonTextSelected: {
    color: COLORS.white,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgSecondary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.money,
    marginBottom: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    padding: 0,
  },
  quickAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  jackpotToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.bgSecondary,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: COLORS.money,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  jackpotTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  jackpotButton: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 10,
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  jackpotButtonSelected: {
    backgroundColor: '#F39C12',
    borderColor: '#F39C12',
  },
  jackpotButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  jackpotButtonTextSelected: {
    color: COLORS.white,
  },
  durationInput: {
    backgroundColor: COLORS.bgSecondary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  notesInput: {
    backgroundColor: COLORS.bgSecondary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    fontSize: 15,
    color: COLORS.navyDeep,
    minHeight: 90,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.money,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
});
