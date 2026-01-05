import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { Save, Dices, Plus, Trash2, Edit2, Clock, X } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTime12Hour } from '@/lib/format';
import type { PlayingHours, PlayingSession } from '@/state/UserProvider';
import { DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';

interface PlayingHoursCardProps {
  currentValues?: PlayingHours;
  onSave: (data: PlayingHours) => void;
  isSaving?: boolean;
}

export function PlayingHoursCard({
  currentValues,
  onSave,
  isSaving = false,
}: PlayingHoursCardProps) {
  const [formData, setFormData] = useState<PlayingHours>(currentValues || DEFAULT_PLAYING_HOURS);

  useEffect(() => {
    if (currentValues) {
      setFormData(currentValues);
    }
  }, [currentValues]);

  const handleToggleSession = (sessionId: string) => {
    setFormData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === sessionId ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  const handleToggleEnabled = (val: boolean) => {
    setFormData(prev => ({ ...prev, enabled: val }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  const enabledSessionsCount = formData.sessions.filter(s => s.enabled).length;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<PlayingSession | null>(null);
  const [modalSessionName, setModalSessionName] = useState('');
  const [modalStartTime, setModalStartTime] = useState('');
  const [modalEndTime, setModalEndTime] = useState('');

  const handleAddSession = () => {
    setEditingSession(null);
    setModalSessionName('');
    setModalStartTime('');
    setModalEndTime('');
    setIsModalVisible(true);
  };

  const handleEditSession = (session: PlayingSession) => {
    setEditingSession(session);
    setModalSessionName(session.name);
    setModalStartTime(session.startTime);
    setModalEndTime(session.endTime);
    setIsModalVisible(true);
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this playing session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({
              ...prev,
              sessions: prev.sessions.filter(s => s.id !== sessionId),
            }));
          },
        },
      ]
    );
  };

  const handleSaveModalSession = () => {
    if (!modalSessionName.trim()) {
      Alert.alert('Validation Error', 'Please enter a session name.');
      return;
    }
    if (!modalStartTime.trim()) {
      Alert.alert('Validation Error', 'Please enter a start time (e.g., "09:00").');
      return;
    }
    if (!modalEndTime.trim()) {
      Alert.alert('Validation Error', 'Please enter an end time (e.g., "12:00").');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(modalStartTime)) {
      Alert.alert('Validation Error', 'Start time must be in HH:mm format (e.g., "09:00").');
      return;
    }
    if (!timeRegex.test(modalEndTime)) {
      Alert.alert('Validation Error', 'End time must be in HH:mm format (e.g., "12:00").');
      return;
    }

    if (editingSession) {
      setFormData(prev => ({
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === editingSession.id
            ? {
                ...s,
                name: modalSessionName.trim(),
                startTime: modalStartTime.trim(),
                endTime: modalEndTime.trim(),
              }
            : s
        ),
      }));
    } else {
      const newSession: PlayingSession = {
        id: `session_${Date.now()}`,
        name: modalSessionName.trim(),
        startTime: modalStartTime.trim(),
        endTime: modalEndTime.trim(),
        enabled: true,
      };
      setFormData(prev => ({
        ...prev,
        sessions: [...prev.sessions, newSession],
      }));
    }

    setIsModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#059669', '#047857']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Dices size={20} color={COLORS.white} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>My Playing Hours</Text>
            <Text style={styles.headerSubtitle}>
              {formData.enabled ? `${enabledSessionsCount} session${enabledSessionsCount !== 1 ? 's' : ''} active` : 'Disabled'}
            </Text>
          </View>
        </View>
        <Switch
          value={formData.enabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.5)' }}
          thumbColor={formData.enabled ? '#10B981' : '#9CA3AF'}
        />
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>PREFERRED PLAYING SESSIONS</Text>
        <Text style={styles.sectionHint}>
          Select when you typically play. These times will be highlighted in GREEN on your daily agenda when the casino is open.
        </Text>

        <View style={styles.sessionsContainer}>
          {formData.sessions.map((session) => (
            <View
              key={session.id}
              style={[
                styles.sessionRow,
                session.enabled && formData.enabled && styles.sessionRowEnabled,
              ]}
            >
              <TouchableOpacity
                style={styles.sessionMainContent}
                onPress={() => handleToggleSession(session.id)}
                activeOpacity={0.7}
                disabled={!formData.enabled}
              >
                <View style={styles.sessionInfo}>
                  <View style={[
                    styles.sessionDot,
                    session.enabled && formData.enabled ? styles.sessionDotEnabled : styles.sessionDotDisabled,
                  ]} />
                  <View>
                    <Text style={[
                      styles.sessionName,
                      !formData.enabled && styles.sessionNameDisabled,
                    ]}>
                      {session.name}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {formatTime12Hour(session.startTime)} - {formatTime12Hour(session.endTime)}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.sessionToggle,
                  session.enabled && formData.enabled && styles.sessionToggleEnabled,
                ]}>
                  <Text style={[
                    styles.sessionToggleText,
                    session.enabled && formData.enabled && styles.sessionToggleTextEnabled,
                  ]}>
                    {session.enabled ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.sessionActions}>
                <TouchableOpacity
                  style={styles.sessionActionButton}
                  onPress={() => handleEditSession(session)}
                  activeOpacity={0.7}
                >
                  <Edit2 size={16} color="#047857" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sessionActionButton}
                  onPress={() => handleDeleteSession(session.id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addSessionButton}
            onPress={handleAddSession}
            activeOpacity={0.7}
          >
            <Plus size={18} color="#059669" />
            <Text style={styles.addSessionText}>Add Playing Session</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Opportune Playing Time</Text>
          </View>
          <Text style={styles.legendHint}>
            When your preferred sessions overlap with casino open hours, they will appear highlighted in green on your daily agenda.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Save size={18} color={COLORS.white} />
                <Text style={styles.saveButtonText}>Save Playing Hours</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
                  <Clock size={20} color="#059669" />
                  <Text style={styles.modalTitle}>
                    {editingSession ? 'Edit' : 'Add'} Playing Session
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

              <View style={styles.modalContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Session Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Morning Session"
                    placeholderTextColor="#9CA3AF"
                    value={modalSessionName}
                    onChangeText={setModalSessionName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Start Time (HH:mm)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., 09:00"
                    placeholderTextColor="#9CA3AF"
                    value={modalStartTime}
                    onChangeText={setModalStartTime}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.inputHint}>Use 24-hour format (00:00 to 23:59)</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>End Time (HH:mm)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., 12:00"
                    placeholderTextColor="#9CA3AF"
                    value={modalEndTime}
                    onChangeText={setModalEndTime}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.inputHint}>Use 24-hour format (00:00 to 23:59)</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSaveModalSession}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
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
    backgroundColor: '#ECFDF5',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    ...SHADOW.md,
    marginTop: SPACING.lg,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    padding: SPACING.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#047857',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#065F46',
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  sessionsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    overflow: 'hidden',
  },
  sessionRowEnabled: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  sessionMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionDotEnabled: {
    backgroundColor: '#10B981',
  },
  sessionDotDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sessionName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#065F46',
  },
  sessionNameDisabled: {
    color: '#9CA3AF',
  },
  sessionTime: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    marginTop: 2,
  },
  sessionToggle: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#E5E7EB',
  },
  sessionToggleEnabled: {
    backgroundColor: '#10B981',
  },
  sessionToggleText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#6B7280',
  },
  sessionToggleTextEnabled: {
    color: COLORS.white,
  },
  legendContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#065F46',
  },
  legendHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#047857',
    marginTop: SPACING.xs,
    lineHeight: 16,
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
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(16, 185, 129, 0.15)',
    paddingLeft: SPACING.xs,
  },
  sessionActionButton: {
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    gap: SPACING.sm,
  },
  addSessionText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#059669',
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
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#065F46',
  },
  modalCloseButton: {
    padding: SPACING.xs,
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
    color: '#065F46',
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
