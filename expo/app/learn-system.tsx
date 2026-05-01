import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Calculator, ClipboardCheck, Gamepad2, Gift, GraduationCap, HeartHandshake, Ship, Sparkles, X } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW } from '@/constants/theme';

interface LearningTopic {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  accent: string;
  icon: typeof BookOpen;
}

const TOPICS: LearningTopic[] = [
  {
    id: 'app-tutorials',
    title: 'EasySeas app tutorials',
    subtitle: 'Where to begin inside the app',
    icon: Sparkles,
    accent: '#0F766E',
    bullets: [
      'Start in Offers to review scoring, urgency, and decoded offer explanations.',
      'Use Cruises to compare sailing dates, sea-day density, and replacement suggestions.',
      'Use Calendar Passenger View to understand your year at sea, land gaps, and expirations.',
    ],
  },
  {
    id: 'casino-basics',
    title: 'Cruise casino basics',
    subtitle: 'How cruise casino value is usually evaluated',
    icon: Ship,
    accent: '#2563EB',
    bullets: [
      'Casino value is not only the cabin price; taxes, fees, upgrade costs, FreePlay, and OBC matter.',
      'Sea days usually create more casino-open time than port-heavy itineraries.',
      'Treat every automated score as a planning signal, then confirm official cruise-line terms.',
    ],
  },
  {
    id: 'loyalty-basics',
    title: 'Loyalty basics',
    subtitle: 'How tier progress fits your planning',
    icon: GraduationCap,
    accent: '#7C3AED',
    bullets: [
      'Track both cruise-line loyalty and casino program points because they answer different questions.',
      'Use AgentX Loyalty Strategist mode for progress summaries and milestone planning.',
      'Avoid chasing status without understanding your actual out-of-pocket cost and risk tolerance.',
    ],
  },
  {
    id: 'offer-math',
    title: 'Offer math and comp value',
    subtitle: 'Understand what the casino is really covering',
    icon: Calculator,
    accent: '#D97706',
    bullets: [
      'Casino Pays For estimates cabin value, FreePlay, OBC, and trade-in value.',
      'You Pay estimates taxes, fees, and upgrades when the data exists.',
      'A high headline cabin value is weaker if it forces poor dates, high upgrades, or low casino-open time.',
    ],
  },
  {
    id: 'certificates',
    title: 'Certificate basics',
    subtitle: 'Use certificates carefully',
    icon: ClipboardCheck,
    accent: '#0891B2',
    bullets: [
      'Certificates can be useful, but stacking is never assumed automatically.',
      'Check owner, program, expiration, cabin entitlement, and offer code alignment.',
      'Use Certificate Advisor mode when comparing certificate fit against current offers.',
    ],
  },
  {
    id: 'terms',
    title: 'Reading offer terms',
    subtitle: 'What to verify before booking',
    icon: Gift,
    accent: '#059669',
    bullets: [
      'Confirm eligible guest rules, blackout dates, exact taxes/fees, upgrade pricing, and expiration meaning.',
      'Archived or review-needed offers should be verified before you treat them as bookable.',
      'If imported data is uncertain, keep it for review rather than deleting it automatically.',
    ],
  },
  {
    id: 'machine-logging',
    title: 'Machine condition logging basics',
    subtitle: 'Observation without creating a session system',
    icon: Gamepad2,
    accent: '#0F766E',
    bullets: [
      'Record ship, location, machine name, denomination, bet level, meter values, and visible state.',
      'Use decisions like Played, Passed, or Watched so AP Scout mode can interpret your observations.',
      'Condition logs are separate from casino play sessions and should describe what you saw at that moment.',
    ],
  },
  {
    id: 'programs',
    title: 'Royal/Celebrity program basics',
    subtitle: 'Household and brand-aware planning',
    icon: HeartHandshake,
    accent: '#1E3A8A',
    bullets: [
      'Royal/Club Royale and Celebrity/Blue Chip can be tracked separately while still supporting household views.',
      'Owner profiles help prevent offers, bookings, and points from being mixed between travelers.',
      'Use filters and AgentX mode context when reviewing household vs individual data.',
    ],
  },
];

export default function LearnSystemScreen() {
  const router = useRouter();
  const topicCount = useMemo(() => TOPICS.length, []);
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#0F2439', '#1E3A5F', '#0F766E']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIcon}>
              <BookOpen size={22} color="#A7F3D0" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Learn the System</Text>
              <Text style={styles.headerSubtitle}>Book + app companion • {topicCount} lessons</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} testID="learn-system-close">
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard} testID="learn-system-hero">
            <Text style={styles.heroEyebrow}>EasySeas Guide</Text>
            <Text style={styles.heroTitle}>Learn how to read offers, track casino value, and use the app without guessing.</Text>
            <Text style={styles.heroBody}>This section is informational. It helps you understand imported data, cruise casino math, certificates, machine observations, and responsible-use reminders before you make decisions.</Text>
          </View>

          {TOPICS.map((topic) => {
            const TopicIcon = topic.icon;
            return (
              <View key={topic.id} style={styles.topicCard} testID={`learn-system-topic-${topic.id}`}>
                <View style={styles.topicHeader}>
                  <View style={[styles.topicIcon, { backgroundColor: `${topic.accent}18` }]}>
                    <TopicIcon size={18} color={topic.accent} />
                  </View>
                  <View style={styles.topicHeaderCopy}>
                    <Text style={styles.topicTitle}>{topic.title}</Text>
                    <Text style={styles.topicSubtitle}>{topic.subtitle}</Text>
                  </View>
                </View>
                <View style={styles.topicBullets}>
                  {topic.bullets.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <View style={[styles.bulletDot, { backgroundColor: topic.accent }]} />
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          <View style={styles.bookCard} testID="learn-system-books">
            <BookOpen size={20} color="#D97706" />
            <View style={styles.bookCopy}>
              <Text style={styles.bookTitle}>Books by Scott Astin</Text>
              <Text style={styles.bookBody}>Use the Settings links for Scott Astin’s books and companion material. The app keeps learning content separate from official cruise-line terms.</Text>
            </View>
          </View>

          <View style={styles.disclaimerCard} testID="learn-system-disclaimer">
            <Text style={styles.disclaimerTitle}>Responsible-use and legal note</Text>
            <Text style={styles.disclaimerText}>EasySeas provides planning tools and educational guidance only. Cruise-line casino offers, certificate rules, loyalty program terms, gaming outcomes, taxes, and fees can change. Verify official terms before booking or making financial decisions.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(167, 243, 208, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.24)',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
    gap: SPACING.md,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.lg,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#0F766E',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    lineHeight: 28,
    marginBottom: SPACING.sm,
  },
  heroBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
  },
  topicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    ...SHADOW.sm,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  topicIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicHeaderCopy: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  topicSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  topicBullets: {
    gap: SPACING.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  coverageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...SHADOW.sm,
  },
  coverageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  coverageHeaderCopy: {
    flex: 1,
  },
  coverageTitle: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  coverageSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  coverageList: {
    gap: SPACING.sm,
  },
  coverageItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  coverageItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  coverageItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    lineHeight: 18,
  },
  coverageStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  coverageStatusRepresented: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  coverageStatusPartial: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  coverageStatusText: {
    fontSize: 10,
    fontWeight: '900' as const,
  },
  coverageStatusTextRepresented: {
    color: '#166534',
  },
  coverageStatusTextPartial: {
    color: '#92400E',
  },
  coverageRepresentedText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  deficiencyList: {
    marginTop: 8,
    gap: 5,
  },
  deficiencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  deficiencyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginTop: 7,
  },
  deficiencyText: {
    flex: 1,
    fontSize: 12,
    color: '#7C2D12',
    lineHeight: 17,
  },
  noDeficiencyText: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#166534',
  },
  bookCard: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bookCopy: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  bookBody: {
    fontSize: 13,
    color: '#713F12',
    lineHeight: 19,
  },
  disclaimerCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },
});
