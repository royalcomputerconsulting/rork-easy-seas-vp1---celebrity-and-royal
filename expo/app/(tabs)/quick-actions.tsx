import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, BookOpen, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Database, DatabaseBackup, Download, Edit3, FileDown, FileSearch, FileUp, Gamepad2, Mail, PlusSquare, RefreshCcw, Shield, Ship, UserPlus } from 'lucide-react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { TYPOGRAPHY } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';
import { useAuth } from '@/state/AuthProvider';

const TASKS = [
  { key: 'receipt', title: 'Load receipt for a cruise', subtitle: 'Choose the saved voyage, then review and attach its Royal receipt PDF.', icon: FileUp, route: '/cruise-financial-entry?mode=receipt' },
  { key: 'totals', title: 'Enter cruise totals', subtitle: 'Choose any upcoming, current, or completed saved voyage and enter its exact totals.', icon: Edit3, route: '/cruise-financial-entry' },
  { key: 'cruises', title: 'Browse cruises', subtitle: 'Search available sailings and attached offers.', icon: Ship, route: '/scheduling' },
  { key: 'booking', title: 'Add or import a booking', subtitle: 'Open the always-visible connection and booked-cruise import tools.', icon: FileSearch, route: '/settings' },
  { key: 'import', title: 'Import or restore data', subtitle: 'Open connections, sync, import, and backup tools.', icon: DatabaseBackup, route: '/settings' },
  { key: 'calendar', title: 'Open calendar', subtitle: 'Review agendas, voyage events, and planning.', icon: CalendarDays, route: '/events' },
  { key: 'crew', title: 'Add or recognize crew', subtitle: 'Open the crew registry and recognition history.', icon: UserPlus, route: '/crew-recognition' },
  { key: 'session', title: 'Record a casino session', subtitle: 'Open Slots play sessions and machine notes.', icon: Gamepad2, route: '/machines' },
  { key: 'machine', title: 'Add a machine', subtitle: 'Add a slot machine, ship location, condition, and notes.', icon: PlusSquare, route: '/add-machine-wizard' },
  { key: 'certificate', title: 'Download or inspect certificates', subtitle: 'Open the current certificate library, downloads, and eligible sailings.', icon: FileSearch, route: '/certificate-codes' },
  { key: 'agent', title: 'Ask Agent SEA', subtitle: 'Ask questions across cruises, offers, loyalty, casino, and crew.', icon: Bot, route: '/ask-my-data' },
] as const;

const ADMIN_TASKS = [
  { key: 'gmail-sync', title: 'Sync Gmail', subtitle: 'Review owner Gmail bookings, cancellations, certificates, and receipts before applying.', icon: Mail, route: '/gmail-import' },
  { key: 'seapass', title: 'SeaPass Web Generator', subtitle: 'Create and export the private Royal Caribbean SeaPass artwork.', icon: Ship, route: '/seapass-generator' },
  { key: 'bookdrop', title: 'Launch BookDrop', subtitle: 'Open the private offline book-sharing workspace.', icon: BookOpen, route: '/bookdrop' },
  { key: 'whitelist', title: 'Manage user access', subtitle: 'Add or remove Free Use of App email access.', icon: Shield, route: '/settings?group=Admin&tool=access' },
  { key: 'machine-import', title: 'Import machine library', subtitle: 'Load the private machine atlas from JSON.', icon: Database, route: '/settings?group=Admin&tool=machine-import' },
  { key: 'machine-export', title: 'Export machine library', subtitle: 'Save the complete private machine atlas as JSON.', icon: FileDown, route: '/settings?group=Admin&tool=machine-export' },
  { key: 'session-log', title: 'Export current session log', subtitle: 'Create the signed-in user diagnostic JSON.', icon: FileDown, route: '/settings?group=Admin&tool=session-log' },
  { key: 'seapass-download', title: 'Download SeaPass source', subtitle: 'Export the standalone SeaPass generator package.', icon: Download, route: '/settings?group=Admin&tool=seapass-download' },
  { key: 'app-log', title: 'Export overall app log', subtitle: 'Create the complete administrator diagnostic report.', icon: FileDown, route: '/settings?group=Admin&tool=app-log' },
  { key: 'reset', title: 'Reset all app data', subtitle: 'Open the protected destructive reset workflow.', icon: RefreshCcw, route: '/settings?group=Admin&tool=reset' },
] as const;

export default function QuickActionsScreen() {
  const router = useRouter();
  const { colors } = useExperience();
  const { isAdmin } = useAuth();
  const [isAdminActionsExpanded, setIsAdminActionsExpanded] = React.useState(false);

  return (
    <LinearGradient colors={[...colors.pageGradient] as [string, string, ...string[]]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <ResponsiveContainer>
            <View style={styles.pageHeader} testID="quick-actions-compact-header">
              <Text style={[styles.pageEyebrow, { color: colors.accentSecondary }]}>＋</Text>
              <View style={styles.pageHeaderCopy}>
                <Text style={[styles.pageTitle, { color: colors.text }]}>Quick Actions</Text>
                <Text style={[styles.pageSubtitle, { color: colors.muted }]}>Start the most common Easy Seas tasks.</Text>
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}> 
              <ThemedSectionHeader
                tab="offers"
                emoji="＋"
                title="Common tasks"
                subtitle="Receipts and cruise totals first."
                compact
                testID="quick-actions-menu-heading"
              />
              <View style={styles.rows}>
                {TASKS.map((task, index) => {
                  const Icon = task.icon;
                  return (
                    <TouchableOpacity
                      key={task.key}
                      style={[styles.row, index < 2 && styles.priorityRow, { borderBottomColor: colors.border }, index === TASKS.length - 1 && styles.lastRow]}
                      onPress={() => router.push(task.route as any)}
                      activeOpacity={0.76}
                      accessibilityRole="button"
                      accessibilityLabel={task.title}
                      testID={`quick-action-${task.key}`}
                    >
                      <View style={[styles.icon, index < 2 && styles.priorityIcon, { backgroundColor: colors.surfaceMuted }]}><Icon size={20} color={colors.accentSecondary} /></View>
                      <View style={styles.copy}>
                        <Text style={[styles.title, { color: colors.text }]}>{task.title}</Text>
                        <Text style={[styles.subtitle, { color: colors.muted }]}>{task.subtitle}</Text>
                      </View>
                      <ChevronRight size={19} color={colors.accentSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {isAdmin ? <View style={[styles.card, styles.adminCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]} testID="quick-actions-admin-section">
              <TouchableOpacity onPress={() => setIsAdminActionsExpanded((expanded) => !expanded)} activeOpacity={0.78} accessibilityRole="button" accessibilityState={{ expanded: isAdminActionsExpanded }} accessibilityLabel={`${isAdminActionsExpanded ? 'Collapse' : 'Expand'} admin-only actions`} testID="quick-actions-admin-toggle">
                <ThemedSectionHeader
                  tab="settings"
                  emoji="🛡️"
                  title="Admin use only"
                  subtitle="Private tools stay collapsed until needed."
                  compact
                  action={isAdminActionsExpanded ? <ChevronUp size={18} color={colors.accentSecondary} /> : <ChevronDown size={18} color={colors.accentSecondary} />}
                  testID="quick-actions-admin-heading"
                />
              </TouchableOpacity>
              {isAdminActionsExpanded ? <View style={styles.rows} testID="quick-actions-admin-rows">
                {ADMIN_TASKS.map((task, index) => {
                  const Icon = task.icon;
                  return <TouchableOpacity key={task.key} style={[styles.row, { borderBottomColor: colors.border }, index === ADMIN_TASKS.length - 1 && styles.lastRow]} onPress={() => router.push(task.route as any)} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel={task.title} testID={`quick-action-admin-${task.key}`}>
                    <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}><Icon size={20} color={colors.accentSecondary} /></View>
                    <View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{task.title}</Text><Text style={[styles.subtitle, { color: colors.muted }]}>{task.subtitle}</Text></View>
                    <ChevronRight size={19} color={colors.accentSecondary} />
                  </TouchableOpacity>;
                })}
              </View> : null}
            </View> : null}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 28 },
  pageHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 10 },
  pageEyebrow: { width: 42, height: 42, borderRadius: 21, textAlign: 'center', lineHeight: 42, fontSize: 25, fontWeight: '800' },
  pageHeaderCopy: { flex: 1, minWidth: 0 },
  pageTitle: { fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 27, lineHeight: 33, fontWeight: '600' },
  pageSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  adminCard: { marginTop: 14 },
  rows: { paddingHorizontal: 16 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  priorityRow: { minHeight: 70 },
  lastRow: { borderBottomWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  priorityIcon: { width: 44, height: 44, borderRadius: 14 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 17, lineHeight: 21, fontWeight: '600' },
  subtitle: { marginTop: 1, fontSize: 12, lineHeight: 16 },
});
