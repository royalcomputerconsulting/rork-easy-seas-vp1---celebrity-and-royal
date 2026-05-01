import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ClipboardList, Plus, Save, Trash2, X } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useMachineConditionLogs } from '@/state/MachineConditionLogProvider';
import type { MachineConditionLog, MachineLogDecision } from '@/types/models';

interface MachineConditionLogsPanelProps {
  defaultShipName?: string;
  defaultMachineName?: string;
}

type LogFormState = {
  shipName: string;
  casinoLocation: string;
  machineName: string;
  seatBankPosition: string;
  denomination: string;
  betLevel: string;
  majorAmount: string;
  grandAmount: string;
  visibleMachineState: string;
  bonusMeterCondition: string;
  timeObserved: string;
  decision: MachineLogDecision;
  notes: string;
};

type LogFilters = {
  shipName: string;
  machineName: string;
  date: string;
  decision: MachineLogDecision | 'all';
};

const DECISIONS: MachineLogDecision[] = ['played', 'passed', 'watched'];

function createDefaultForm(defaultShipName?: string, defaultMachineName?: string): LogFormState {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    shipName: defaultShipName ?? '',
    casinoLocation: '',
    machineName: defaultMachineName ?? '',
    seatBankPosition: '',
    denomination: '',
    betLevel: '',
    majorAmount: '',
    grandAmount: '',
    visibleMachineState: '',
    bonusMeterCondition: '',
    timeObserved: localNow,
    decision: 'watched',
    notes: '',
  };
}

function logToForm(log: MachineConditionLog): LogFormState {
  return {
    shipName: log.shipName,
    casinoLocation: log.casinoLocation,
    machineName: log.machineName,
    seatBankPosition: log.seatBankPosition,
    denomination: log.denomination,
    betLevel: log.betLevel,
    majorAmount: log.majorAmount?.toString() ?? '',
    grandAmount: log.grandAmount?.toString() ?? '',
    visibleMachineState: log.visibleMachineState,
    bonusMeterCondition: log.bonusMeterCondition,
    timeObserved: log.timeObserved.slice(0, 16),
    decision: log.decision,
    notes: log.notes ?? '',
  };
}

function parseMoney(value: string): number | undefined {
  const parsed = Number(value.replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export const MachineConditionLogsPanel = React.memo(function MachineConditionLogsPanel({ defaultShipName, defaultMachineName }: MachineConditionLogsPanelProps) {
  const { logs, addLog, updateLog, deleteLog, getFilteredLogs } = useMachineConditionLogs();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [form, setForm] = useState<LogFormState>(() => createDefaultForm(defaultShipName, defaultMachineName));
  const [filters, setFilters] = useState<LogFilters>({ shipName: '', machineName: '', date: '', decision: 'all' });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const filteredLogs = useMemo(() => {
    return getFilteredLogs({
      shipName: filters.shipName || undefined,
      machineName: filters.machineName || undefined,
      date: filters.date || undefined,
      decision: filters.decision,
    }).slice(0, 8);
  }, [filters, getFilteredLogs]);

  const updateForm = useCallback(<K extends keyof LogFormState>(key: K, value: LogFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setEditingLogId(null);
    setForm(createDefaultForm(defaultShipName, defaultMachineName));
  }, [defaultMachineName, defaultShipName]);

  const handleSave = useCallback(async () => {
    if (!form.shipName.trim() || !form.machineName.trim() || !form.visibleMachineState.trim()) {
      Alert.alert('Condition log needs details', 'Add at least ship, machine name, and visible machine state.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        shipName: form.shipName.trim(),
        casinoLocation: form.casinoLocation.trim() || 'Casino floor',
        machineName: form.machineName.trim(),
        seatBankPosition: form.seatBankPosition.trim() || 'Not recorded',
        denomination: form.denomination.trim() || 'Not recorded',
        betLevel: form.betLevel.trim() || 'Not recorded',
        majorAmount: parseMoney(form.majorAmount),
        grandAmount: parseMoney(form.grandAmount),
        visibleMachineState: form.visibleMachineState.trim(),
        bonusMeterCondition: form.bonusMeterCondition.trim() || 'Not recorded',
        timeObserved: form.timeObserved ? new Date(form.timeObserved).toISOString() : new Date().toISOString(),
        decision: form.decision,
        notes: form.notes.trim() || undefined,
      };

      if (editingLogId) {
        await updateLog(editingLogId, payload);
      } else {
        await addLog(payload);
      }
      resetForm();
      setIsExpanded(true);
    } catch (error) {
      console.error('[MachineConditionLogsPanel] Save failed:', error);
      Alert.alert('Save failed', 'The machine condition log could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [addLog, editingLogId, form, resetForm, updateLog]);

  const handleEdit = useCallback((log: MachineConditionLog) => {
    setEditingLogId(log.id);
    setForm(logToForm(log));
    setIsExpanded(true);
    console.log('[MachineConditionLogsPanel] Editing log:', log.id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete condition log?', 'This removes the observation from Machine Atlas.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteLog(id).catch((error) => console.error('[MachineConditionLogsPanel] Delete failed:', error));
        },
      },
    ]);
  }, [deleteLog]);

  return (
    <View style={styles.card} testID="machine-condition-logs-panel">
      <LinearGradient colors={['#0F2439', '#1E3A5F', '#0F766E']} style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <ClipboardList size={20} color="#A7F3D0" />
            <View>
              <Text style={styles.title}>Machine Condition Log</Text>
              <Text style={styles.subtitle}>{logs.length} observation{logs.length === 1 ? '' : 's'} saved</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={() => setIsExpanded((current) => !current)} testID="machine-condition-toggle">
            <Text style={styles.headerButtonText}>{isExpanded ? 'Hide' : 'Open'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {isExpanded ? (
        <View style={styles.body}>
          <View style={styles.filterGrid}>
            <TextInput style={styles.filterInput} value={filters.shipName} onChangeText={(value) => setFilters((current) => ({ ...current, shipName: value }))} placeholder="Filter ship" placeholderTextColor="#94A3B8" testID="machine-log-filter-ship" />
            <TextInput style={styles.filterInput} value={filters.machineName} onChangeText={(value) => setFilters((current) => ({ ...current, machineName: value }))} placeholder="Filter machine" placeholderTextColor="#94A3B8" testID="machine-log-filter-machine" />
            <TextInput style={styles.filterInput} value={filters.date} onChangeText={(value) => setFilters((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" testID="machine-log-filter-date" />
          </View>

          <View style={styles.decisionRow}>
            {(['all', ...DECISIONS] as const).map((decision) => (
              <TouchableOpacity key={decision} style={[styles.decisionChip, filters.decision === decision && styles.decisionChipActive]} onPress={() => setFilters((current) => ({ ...current, decision }))} testID={`machine-log-filter-${decision}`}>
                <Text style={[styles.decisionChipText, filters.decision === decision && styles.decisionChipTextActive]}>{decision}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>{editingLogId ? 'Edit observation' : 'New observation'}</Text>
              {editingLogId ? (
                <TouchableOpacity style={styles.clearEditButton} onPress={resetForm} testID="machine-log-cancel-edit">
                  <X size={14} color={COLORS.navyDeep} />
                  <Text style={styles.clearEditText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.inputGrid}>
              <TextInput style={styles.input} value={form.shipName} onChangeText={(value) => updateForm('shipName', value)} placeholder="Ship" placeholderTextColor="#94A3B8" testID="machine-log-ship" />
              <TextInput style={styles.input} value={form.casinoLocation} onChangeText={(value) => updateForm('casinoLocation', value)} placeholder="Casino location" placeholderTextColor="#94A3B8" testID="machine-log-location" />
              <TextInput style={styles.input} value={form.machineName} onChangeText={(value) => updateForm('machineName', value)} placeholder="Machine name" placeholderTextColor="#94A3B8" testID="machine-log-machine" />
              <TextInput style={styles.input} value={form.seatBankPosition} onChangeText={(value) => updateForm('seatBankPosition', value)} placeholder="Seat / bank position" placeholderTextColor="#94A3B8" />
              <TextInput style={styles.input} value={form.denomination} onChangeText={(value) => updateForm('denomination', value)} placeholder="Denomination" placeholderTextColor="#94A3B8" />
              <TextInput style={styles.input} value={form.betLevel} onChangeText={(value) => updateForm('betLevel', value)} placeholder="Bet level" placeholderTextColor="#94A3B8" />
              <TextInput style={styles.input} value={form.majorAmount} onChangeText={(value) => updateForm('majorAmount', value)} placeholder="Major amount" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" />
              <TextInput style={styles.input} value={form.grandAmount} onChangeText={(value) => updateForm('grandAmount', value)} placeholder="Grand amount" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" />
            </View>
            <TextInput style={styles.longInput} value={form.visibleMachineState} onChangeText={(value) => updateForm('visibleMachineState', value)} placeholder="Visible machine state" placeholderTextColor="#94A3B8" multiline testID="machine-log-visible-state" />
            <TextInput style={styles.longInput} value={form.bonusMeterCondition} onChangeText={(value) => updateForm('bonusMeterCondition', value)} placeholder="Bonus / meter / persistent condition" placeholderTextColor="#94A3B8" multiline />
            <TextInput style={styles.input} value={form.timeObserved} onChangeText={(value) => updateForm('timeObserved', value)} placeholder="Observed time" placeholderTextColor="#94A3B8" />
            <View style={styles.decisionRow}>
              {DECISIONS.map((decision) => (
                <TouchableOpacity key={decision} style={[styles.decisionChip, form.decision === decision && styles.decisionChipActive]} onPress={() => updateForm('decision', decision)} testID={`machine-log-decision-${decision}`}>
                  <Text style={[styles.decisionChipText, form.decision === decision && styles.decisionChipTextActive]}>{decision}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.longInput} value={form.notes} onChangeText={(value) => updateForm('notes', value)} placeholder="Notes" placeholderTextColor="#94A3B8" multiline />
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.disabledButton]} onPress={handleSave} disabled={isSaving} testID="machine-log-save">
              {editingLogId ? <Save size={16} color="#FFFFFF" /> : <Plus size={16} color="#FFFFFF" />}
              <Text style={styles.saveButtonText}>{editingLogId ? 'Save Log' : 'Create Log'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logsList}>
            {filteredLogs.map((log) => (
              <View key={log.id} style={styles.logItem} testID="machine-condition-log-row">
                <View style={styles.logCopy}>
                  <Text style={styles.logTitle}>{log.machineName}</Text>
                  <Text style={styles.logMeta}>{log.shipName} · {log.casinoLocation} · {log.decision}</Text>
                  <Text style={styles.logBody} numberOfLines={2}>{log.visibleMachineState}</Text>
                </View>
                <View style={styles.logActions}>
                  <TouchableOpacity style={styles.logActionButton} onPress={() => handleEdit(log)} testID="machine-log-edit"><Text style={styles.logActionText}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.logDeleteButton} onPress={() => handleDelete(log.id)} testID="machine-log-delete"><Trash2 size={14} color="#FFFFFF" /></TouchableOpacity>
                </View>
              </View>
            ))}
            {filteredLogs.length === 0 ? <Text style={styles.emptyText}>No condition logs match these filters.</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...SHADOW.md,
  },
  headerGradient: {
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  headerButton: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  headerButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  body: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterInput: {
    flexGrow: 1,
    minWidth: Platform.OS === 'web' ? 130 : 96,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
    fontSize: 12,
    color: COLORS.navyDeep,
  },
  decisionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  decisionChip: {
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  decisionChipActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  decisionChipText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
    textTransform: 'capitalize' as const,
  },
  decisionChipTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  clearEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearEditText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  input: {
    flexGrow: 1,
    minWidth: 132,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    color: COLORS.navyDeep,
  },
  longInput: {
    minHeight: 58,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    color: COLORS.navyDeep,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: '#0F766E',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  disabledButton: {
    opacity: 0.55,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  logsList: {
    gap: SPACING.sm,
  },
  logItem: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.sm,
  },
  logCopy: {
    flex: 1,
  },
  logTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  logMeta: {
    fontSize: 11,
    color: '#0F766E',
    marginTop: 2,
    textTransform: 'capitalize' as const,
  },
  logBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginTop: 4,
  },
  logActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  logActionButton: {
    backgroundColor: '#E0F2FE',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  logActionText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  logDeleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.sm,
    padding: 7,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    paddingVertical: SPACING.md,
  },
});
