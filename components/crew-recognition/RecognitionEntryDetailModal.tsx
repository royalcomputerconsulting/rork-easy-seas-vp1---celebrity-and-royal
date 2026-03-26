import React, { useState, useEffect } from 'react';
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
import { X, Edit, Trash2 } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { DEPARTMENTS } from '@/types/crew-recognition';
import type { RecognitionEntryWithCrew, Sailing } from '@/types/crew-recognition';

interface RecognitionEntryDetailModalProps {
  visible: boolean;
  entry: RecognitionEntryWithCrew | null;
  sailings: Sailing[];
  onClose: () => void;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function RecognitionEntryDetailModal({
  visible,
  entry,
  sailings,
  onClose,
  onUpdate,
  onDelete,
}: RecognitionEntryDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [department, setDepartment] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sailingId, setSailingId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);
  const [showSailingPicker, setShowSailingPicker] = useState(false);

  useEffect(() => {
    if (entry) {
      setDepartment(entry.department);
      setRoleTitle(entry.roleTitle || '');
      setSourceText(entry.sourceText || '');
      setSailingId(entry.sailingId);
    }
  }, [entry]);

  if (!entry) {
    return null;
  }

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate(entry.id, {
        department,
        roleTitle: roleTitle.trim() || undefined,
        sourceText: sourceText.trim() || undefined,
        sailingId: sailingId !== entry.sailingId ? sailingId : undefined,
      });
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this recognition entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(entry.id);
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const selectedSailing = sailings.find(s => s.id === sailingId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Recognition Entry</Text>
            <View style={styles.headerActions}>
              {!isEditing && (
                <>
                  <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.iconButton}>
                    <Edit size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
                    <Trash2 size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                <X size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Crew Member</Text>
              <Text style={styles.valueText}>{entry.fullName}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Department</Text>
              {isEditing ? (
                <>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowDepartmentPicker(!showDepartmentPicker)}
                  >
                    <Text style={styles.pickerText}>{department}</Text>
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
                </>
              ) : (
                <Text style={styles.valueText}>{entry.department}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Role Title</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={roleTitle}
                  onChangeText={setRoleTitle}
                  placeholder="Enter role title"
                  placeholderTextColor={COLORS.textTertiary}
                />
              ) : (
                <Text style={styles.valueText}>{entry.roleTitle || 'N/A'}</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sailing</Text>
              {isEditing ? (
                <>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowSailingPicker(!showSailingPicker)}
                  >
                    <Text style={styles.pickerText}>
                      {selectedSailing
                        ? `${selectedSailing.shipName} - ${selectedSailing.sailStartDate}`
                        : 'Select sailing'}
                    </Text>
                  </TouchableOpacity>
                  {showSailingPicker && (
                    <ScrollView style={styles.pickerOptions} nestedScrollEnabled>
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
                </>
              ) : (
                <Text style={styles.valueText}>
                  {entry.shipName} ({entry.sailStartDate} - {entry.sailEndDate})
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Source Text</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={sourceText}
                  onChangeText={setSourceText}
                  placeholder="Original recognition phrase"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              ) : (
                <Text style={styles.valueText}>{entry.sourceText || 'N/A'}</Text>
              )}
            </View>

            {entry.crewNotes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Crew Notes</Text>
                <Text style={styles.valueText}>{entry.crewNotes}</Text>
              </View>
            )}
          </ScrollView>

          {isEditing && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  setDepartment(entry.department);
                  setRoleTitle(entry.roleTitle || '');
                  setSourceText(entry.sourceText || '');
                  setSailingId(entry.sailingId);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    padding: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  valueText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
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
});
