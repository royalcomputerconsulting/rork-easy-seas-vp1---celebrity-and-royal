import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, CalendarDays, ChevronRight, DatabaseBackup, Gamepad2, Ship, UserPlus } from 'lucide-react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { TYPOGRAPHY } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

const TASKS = [
  { key: 'cruises', title: 'Browse cruises', subtitle: 'Search available sailings and attached offers.', icon: Ship, route: '/scheduling' },
  { key: 'import', title: 'Import or restore data', subtitle: 'Open connections, sync, import, and backup tools.', icon: DatabaseBackup, route: '/settings' },
  { key: 'calendar', title: 'Open calendar', subtitle: 'Review agendas, voyage events, and planning.', icon: CalendarDays, route: '/events' },
  { key: 'crew', title: 'Add or recognize crew', subtitle: 'Open the crew registry and recognition history.', icon: UserPlus, route: '/crew-recognition' },
  { key: 'session', title: 'Record a casino session', subtitle: 'Open Slots play sessions and machine notes.', icon: Gamepad2, route: '/machines' },
  { key: 'agent', title: 'Ask Agent SEA', subtitle: 'Ask questions across cruises, offers, loyalty, casino, and crew.', icon: Bot, route: '/ask-my-data' },
] as const;

export default function QuickActionsScreen() {
  const router = useRouter();
  const { colors } = useExperience();

  return (
    <LinearGradient colors={[...colors.pageGradient] as [string, string, ...string[]]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <View style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
              <ThemedSectionHeader
                tab="offers"
                emoji="＋"
                title="Common tasks"
                subtitle="Choose an action. Every tool remains available in its full workspace."
                compact
                testID="quick-actions-menu-heading"
              />
              <View style={styles.rows}>
                {TASKS.map((task, index) => {
                  const Icon = task.icon;
                  return (
                    <TouchableOpacity
                      key={task.key}
                      style={[styles.row, { borderBottomColor: colors.border }, index === TASKS.length - 1 && styles.lastRow]}
                      onPress={() => router.push(task.route as any)}
                      activeOpacity={0.76}
                      accessibilityRole="button"
                      accessibilityLabel={task.title}
                      testID={`quick-action-${task.key}`}
                    >
                      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}><Icon size={20} color={colors.accentSecondary} /></View>
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
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 120 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  rows: { paddingHorizontal: 16 },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  lastRow: { borderBottomWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18, lineHeight: 22, fontWeight: '600' },
  subtitle: { marginTop: 2, fontSize: 13, lineHeight: 18 },
});
