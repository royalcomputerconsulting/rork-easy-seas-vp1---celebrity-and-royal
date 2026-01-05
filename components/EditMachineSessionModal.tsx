import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Save, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import type { CasinoSession, Denomination } from '@/state/CasinoSessionProvider';

interface EditMachineSessionModalProps {
  visible: boolean;
  session: CasinoSession | null;
  onClose: () => void;
  onSave: (sessionId: string, updates: Partial<CasinoSession>) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}

const DENOMINATIONS: Denomination[] = [0.01, 0.05, 0.25, 1, 5, 10, 25, 100];

export function EditMachineSessionModal({
  visible,
  session,
  onClose,
  onSave,
  onDelete,
}: EditMachineSessionModalProps) {
  const [winLoss, setWinLoss] = useState('');
  const [denomination, setDenomination] = useState<Denomination>(0.01);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session) {
      setWinLoss(session.winLoss?.toString() || '0');
      setDenomination(session.denomination || 0.01);
      setDurationMinutes(session.durationMinutes.toString());
      setNotes(session.notes || '');
    }
  }, [session]);

  const handleSave = async () => {
    if (!session) return;

    setIsSaving(true);
    try {
      const updates: Partial<CasinoSession> = {
        winLoss: parseFloat(winLoss) || 0,
        denomination,
        durationMinutes: parseInt(durationMinutes) || 0,
        notes: notes.trim(),
      };

      await onSave(session.id, updates);
      onClose();
    } catch (error) {
      console.error('[EditMachineSessionModal] Failed to save:', error);
      Alert.alert('Error', 'Failed to save session changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!session) return;

    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(session.id);
              onClose();
            } catch (error) {
              console.error('[EditMachineSessionModal] Failed to delete:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  if (!session) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Edit Session</Text>
            <Text style={styles.headerSubtitle}>{formatDate(session.date)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={COLORS.navyDeep} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.machineTitle}>{session.machineName || 'Unknown Machine'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Win/Loss Amount ($)</Text>
            <TextInput
              style={styles.input}
              value={winLoss}
              onChangeText={setWinLoss}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.hint}>
              Enter positive for wins, negative for losses
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Denomination</Text>
            <View style={styles.denominationGrid}>
              {DENOMINATIONS.map((denom) => (
                <TouchableOpacity
                  key={denom}
                  style={[
                    styles.denomChip,
                    denomination === denom && styles.denomChipActive,
                  ]}
                  onPress={() => setDenomination(denom)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.denomChipText,
                      denomination === denom && styles.denomChipTextActive,
                    ]}
                  >
                    ${denom.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholder="Add notes about this session..."
              placeholderTextColor={COLORS.textMuted}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={COLORS.error} />
            <Text style={styles.deleteButtonText}>Delete Session</Text>
          </TouchableOpacity>
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
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Save size={18} color={COLORS.white} />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  machineTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.navyDeep,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  denominationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  denomChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  denomChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  denomChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  denomChipTextActive: {
    color: COLORS.white,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.error,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navyDeep,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.white,
  },
});
