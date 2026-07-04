import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList, ChevronLeft, CheckCircle, Circle, Clock3, EyeOff, Trash2, Plus, X } from 'lucide-react-native';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoBenefits, type ChecklistPriority } from '@/state/CasinoBenefitsProvider';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles } from '@/constants/darkRoyalTheme';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { useAppState } from '@/state/AppStateProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { buildDataHealthSummary } from '@/lib/easySeasAdvisor';
import { useAuth } from '@/state/AuthProvider';

interface DisplayTask {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  isCustom: boolean;
  priority?: ChecklistPriority;
}

/**
 * Stage 9.4 - Persistent, actionable Today's Checklist manager. Auto-generated
 * tasks (from real data gaps) plus user-created custom tasks. Every task
 * supports Mark Complete, Snooze, Hide, and (for custom tasks) Edit/Delete.
 */
export default function ChecklistScreen() {
  const router = useRouter();
  const { cruiseEconomicsSummary, bookedCruises } = useCasinoEconomicsData();
  const { clubRoyaleTier, clubRoyaleCurrentYearPoints } = useLoyalty();
  const { localData } = useAppState();
  const { casinoOffers } = useCoreData();
  const { isAdmin } = useAuth();
  const dataHealthSummary = useMemo(
    () => buildDataHealthSummary(localData.cruises ?? [], bookedCruises, casinoOffers ?? []),
    [localData.cruises, bookedCruises, casinoOffers],
  );
  const dataHealthIssueCount = dataHealthSummary.duplicateAvailableRows + dataHealthSummary.duplicateOfferCodes + dataHealthSummary.possiblyMisclassifiedUpcoming;
  const {
    checklistOverrides,
    customTasks,
    setChecklistDone,
    snoozeChecklistTask,
    hideChecklistTask,
    addCustomTask,
    deleteCustomTask,
  } = useCasinoBenefits();
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && width >= LARGE_SCREEN_BREAKPOINT;

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newPriority, setNewPriority] = useState<ChecklistPriority>('medium');

  const autoTasks = useMemo((): DisplayTask[] => {
    const missingResultsCount = cruiseEconomicsSummary.rows.filter((row) => row.calculationConfidence !== 'actual').length;
    const upcomingCount = bookedCruises.filter((c) => {
      const sail = c.sailDate ? new Date(c.sailDate) : null;
      return sail && sail.getTime() >= Date.now();
    }).length;
    const base: DisplayTask[] = [
      {
        id: 'log-results',
        label: missingResultsCount > 0 ? `Log actual win/loss + points for ${missingResultsCount} cruise(s)` : 'All completed cruises have logged results',
        detail: 'Tap any row in the value ledger or a portfolio card to enter real numbers instead of estimates.',
        done: missingResultsCount === 0,
        isCustom: false,
      },
      {
        id: 'upcoming',
        label: upcomingCount > 0 ? `${upcomingCount} upcoming cruise(s) on the books` : 'No upcoming cruises booked',
        detail: 'Review upcoming sailings and confirm casino offer codes are attached.',
        done: upcomingCount === 0,
        isCustom: false,
      },
      // Data Health moved to Settings > Admin Functions (admin-only), so it's no longer a Casino checklist task.
    ];
    return base
      .map((task) => {
        const override = checklistOverrides[task.id];
        return { ...task, done: override?.done ?? task.done };
      })
      .filter((task) => {
        const override = checklistOverrides[task.id];
        if (override?.hidden) return false;
        if (override?.snoozedUntil && new Date(override.snoozedUntil).getTime() > Date.now()) return false;
        return true;
      });
  }, [cruiseEconomicsSummary.rows, bookedCruises, checklistOverrides]);

  const customDisplayTasks = useMemo((): DisplayTask[] => {
    return customTasks
      .filter((t) => {
        const override = checklistOverrides[t.id];
        if (override?.hidden) return false;
        if (override?.snoozedUntil && new Date(override.snoozedUntil).getTime() > Date.now()) return false;
        return true;
      })
      .map((t) => ({ id: t.id, label: t.label, detail: t.detail, done: checklistOverrides[t.id]?.done ?? t.done, isCustom: true, priority: t.priority }));
  }, [customTasks, checklistOverrides]);

  const allTasks = useMemo(() => [...autoTasks, ...customDisplayTasks], [autoTasks, customDisplayTasks]);

  const handleAddTask = useCallback(() => {
    if (!newLabel.trim()) return;
    addCustomTask({ label: newLabel.trim(), detail: newDetail.trim(), priority: newPriority });
    setNewLabel('');
    setNewDetail('');
    setNewPriority('medium');
    setShowAddForm(false);
  }, [newLabel, newDetail, newPriority, addCustomTask]);

  const signaturePct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / CLUB_ROYALE_TIERS.Signature.threshold) * 100));

  const body = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={dashStyles.screenTitle}>Casino Checklist</Text>
        <Text style={dashStyles.screenSubtitle}>Auto-generated action items plus anything you add yourself</Text>
      </View>

      <TouchableOpacity style={styles.addButton} activeOpacity={0.85} onPress={() => setShowAddForm(true)} testID="checklist-add-task">
        <Plus size={16} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Add Task</Text>
      </TouchableOpacity>

      <View style={{ gap: 10 }}>
        {allTasks.map((task) => (
          <View key={task.id} style={[dashStyles.card, styles.taskCard]}>
            <TouchableOpacity
              style={styles.taskMainRow}
              activeOpacity={0.75}
              onPress={() => setChecklistDone(task.id, !task.done)}
              testID={`checklist-toggle-${task.id}`}
            >
              {task.done ? <CheckCircle size={20} color={COLORS.green} /> : <Circle size={20} color={COLORS.orange} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskLabel, task.done && styles.taskLabelDone]}>{task.label}</Text>
                <Text style={styles.taskDetail} numberOfLines={2}>{task.detail}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.taskActionsRow}>
              <TouchableOpacity style={styles.taskActionButton} activeOpacity={0.75} onPress={() => snoozeChecklistTask(task.id, 3)} testID={`checklist-snooze-${task.id}`}>
                <Clock3 size={13} color={COLORS.textSecondary} />
                <Text style={styles.taskActionText}>Snooze 3d</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.taskActionButton} activeOpacity={0.75} onPress={() => hideChecklistTask(task.id, true)} testID={`checklist-hide-${task.id}`}>
                <EyeOff size={13} color={COLORS.textSecondary} />
                <Text style={styles.taskActionText}>Hide</Text>
              </TouchableOpacity>
              {task.isCustom && (
                <TouchableOpacity style={styles.taskActionButton} activeOpacity={0.75} onPress={() => deleteCustomTask(task.id)} testID={`checklist-delete-${task.id}`}>
                  <Trash2 size={13} color={COLORS.red} />
                  <Text style={[styles.taskActionText, { color: COLORS.red }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {allTasks.length === 0 && (
          <View style={[dashStyles.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <ClipboardList size={22} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontSize: 13 }}>Nothing on your checklist right now.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!showSidebar && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.75} onPress={() => router.back()} testID="checklist-back-button">
            <ChevronLeft size={20} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Casino</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.contentRow}>
        {showSidebar && (
          <CasinoSidebar
            activeTab="action"
            onTabChange={(tab) => router.replace({ pathname: '/(tabs)/analytics' as any, params: { tab } })}
            onOverviewPress={() => router.push('/(tabs)/(overview)' as any)}
            onSettingsPress={() => router.push('/(tabs)/settings' as any)}
            clubRoyaleTier={clubRoyaleTier}
            clubRoyalePoints={clubRoyaleCurrentYearPoints}
            tierProgressPct={signaturePct}
            tierProgressLabel="Signature progress"
            onStatusPress={() => router.push('/casino/loyalty-data' as any)}
          />
        )}
        <View style={{ flex: 1 }}>{body}</View>
      </View>

      <Modal visible={showAddForm} transparent animationType="fade" onRequestClose={() => setShowAddForm(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowAddForm(false)}>
          <TouchableOpacity style={styles.pickerSheet} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setShowAddForm(false)}><X size={18} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Task title"
              placeholderTextColor={COLORS.textMuted}
              testID="checklist-new-label"
            />
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={newDetail}
              onChangeText={setNewDetail}
              placeholder="Details (optional)"
              placeholderTextColor={COLORS.textMuted}
              multiline
              testID="checklist-new-detail"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityChip, newPriority === p && styles.priorityChipActive]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text style={[styles.priorityChipText, newPriority === p && styles.priorityChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.addButton, !newLabel.trim() && { opacity: 0.5 }]} disabled={!newLabel.trim()} onPress={handleAddTask} testID="checklist-save-new-task">
              <Text style={styles.addButtonText}>Save Task</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  contentRow: { flex: 1, flexDirection: 'row' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  backButtonText: { fontSize: 15, fontWeight: '600' as const, color: COLORS.textPrimary },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.royalBlue, borderRadius: 12, paddingVertical: 12 },
  addButtonText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  taskCard: { gap: 8 },
  taskMainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskLabel: { fontSize: 13.5, fontWeight: '700' as const, color: COLORS.textPrimary },
  taskLabelDone: { textDecorationLine: 'line-through' as const, color: COLORS.textMuted },
  taskDetail: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 3 },
  taskActionsRow: { flexDirection: 'row', gap: 14, paddingLeft: 30 },
  taskActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskActionText: { fontSize: 11.5, fontWeight: '600' as const, color: COLORS.textSecondary },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(2,8,25,0.65)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { fontSize: 15, fontWeight: '700' as const, color: COLORS.textPrimary },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 13.5, color: COLORS.textPrimary, marginBottom: 10 },
  priorityChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  priorityChipActive: { backgroundColor: COLORS.royalBlue, borderColor: COLORS.royalBlue },
  priorityChipText: { fontSize: 12, fontWeight: '600' as const, color: COLORS.textSecondary, textTransform: 'capitalize' as const },
  priorityChipTextActive: { color: '#FFFFFF' },
});
