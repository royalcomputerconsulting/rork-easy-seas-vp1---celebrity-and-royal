import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, User, Anchor } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { DEPARTMENTS } from '@/types/crew-recognition';
import type { Sailing } from '@/types/crew-recognition';
import type { BookedCruise } from '@/types/models';

interface AddCrewMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fullName: string;
    department: string;
    roleTitle?: string;
    notes?: string;
    sailingId?: string;
  }) => Promise<void>;
  sailings: Sailing[];
  bookedCruises?: BookedCruise[];
}

function findCurrentAboardSailing(sailings: Sailing[], bookedCruises: BookedCruise[]): Sailing | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const sailing of sailings) {
    const start = new Date(sailing.sailStartDate + 'T00:00:00');
    const end = new Date(sailing.sailEndDate + 'T23:59:59');
    if (today >= start && today <= end) {
      return sailing;
    }
  }

  for (const cruise of bookedCruises) {
    if (!cruise.sailDate || !cruise.returnDate) continue;
    const start = new Date(cruise.sailDate + 'T00:00:00');
    const end = new Date(cruise.returnDate + 'T23:59:59');
    if (today >= start && today <= end) {
      const matchingSailing = sailings.find(
        s => s.shipName === cruise.shipName && s.sailStartDate === cruise.sailDate
      );
      if (matchingSailing) return matchingSailing;
    }
  }

  return null;
}

export function AddCrewMemberModal({ visible, onClose, onSubmit, sailings, bookedCruises = [] }: AddCrewMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [sailingId, setSailingId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);
  const [showSailingPicker, setShowSailingPicker] = useState(false);
  const [autoLinked, setAutoLinked] = useState(false);

  const currentAboardSailing = useMemo(
    () => findCurrentAboardSailing(sailings, bookedCruises),
    [sailings, bookedCruises]
  );

  useEffect(() => {
    if (visible && currentAboardSailing && sailingId === '') {
      console.log('[AddCrewMember] Auto-linking to current sailing:', currentAboardSailing.shipName, currentAboardSailing.sailStartDate);
      setSailingId(currentAboardSailing.id);
      setAutoLinked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentAboardSailing]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter a full name');
      return;
    }

    if (!department) {
      Alert.alert('Error', 'Please select a department');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        department,
        roleTitle: roleTitle.trim() || undefined,
        notes: notes.trim() || undefined,
        sailingId: sailingId || undefined,
      });

      setFullName('');
      setDepartment('');
      setRoleTitle('');
      setNotes('');
      setSailingId('');
      setAutoLinked(false);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add crew member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSailing = sailings.find(s => s.id === sailingId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <User size={24} color={COLORS.primary} />
            <Text style={styles.title}>Add Crew Member</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Department *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowDepartmentPicker(!showDepartmentPicker)}
              >
                <Text style={department ? styles.pickerText : styles.pickerPlaceholder}>
                  {department || 'Select department'}
                </Text>
              </TouchableOpacity>
              {showDepartmentPicker && (
                <View style={styles.pickerOptions}>
                  {DEPARTMENTS.map(dept => (
                    <TouchableOpacity
                      key={dept}
                      style={styles.pickerOption}
                      onPress={() => {
                        setDepartment(dept);
                        setShowDepartmentPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{dept}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Role Title</Text>
              <TextInput
                style={styles.input}
                value={roleTitle}
                onChangeText={setRoleTitle}
                placeholder="e.g., Casino dealer"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes"
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Link to Sailing (Optional)</Text>
              {autoLinked && selectedSailing && (
                <View style={styles.autoLinkedBadge}>
                  <Anchor size={12} color="#0369A1" />
                  <Text style={styles.autoLinkedText}>Auto-linked — currently aboard this sailing</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.picker, autoLinked && selectedSailing && styles.pickerAutoLinked]}
                onPress={() => { setShowSailingPicker(!showSailingPicker); setAutoLinked(false); }}
              >
                <Text style={sailingId ? styles.pickerText : styles.pickerPlaceholder}>
                  {selectedSailing
                    ? `${selectedSailing.shipName} - ${selectedSailing.sailStartDate}`
                    : 'Select sailing'}
                </Text>
              </TouchableOpacity>
              {showSailingPicker && (
                <ScrollView style={styles.pickerOptions} nestedScrollEnabled>
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      setSailingId('');
                      setShowSailingPicker(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>None</Text>
                  </TouchableOpacity>
                  {sailings.map(sailing => (
                    <TouchableOpacity
                      key={sailing.id}
                      style={styles.pickerOption}
                      onPress={() => {
                        setSailingId(sailing.id);
                        setShowSailingPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>
                        {sailing.shipName} - {sailing.sailStartDate}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Add Crew Member</Text>
              )}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
  },
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
  },
  pickerPlaceholder: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textTertiary,
  },
  pickerOptions: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 200,
    backgroundColor: '#fff',
  },
  pickerOption: {
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  submitButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: '#fff',
  },
  autoLinkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  autoLinkedText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#0369A1',
  },
  pickerAutoLinked: {
    borderColor: '#0369A1',
    backgroundColor: 'rgba(3, 105, 161, 0.04)',
  },
});
