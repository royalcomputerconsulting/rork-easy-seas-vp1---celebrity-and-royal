import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
  Calculator,
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartHandshake,
  Ship,
  Sparkles,
  X,
  Users,
  SlidersHorizontal,
  Download,
  Upload,
  Calendar,
  Bot,
  Coins,
  MapPin,
  Bell,
  Star,
  Anchor,
  DollarSign,
  Target,
  Link2,
  Database,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW } from '@/constants/theme';

interface LearningTopic {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  accent: string;
  icon: typeof BookOpen;
}

const BOOK_LINKS = {
  authorPage: 'https://www.amazon.com/stores/Scott-Astin/author/B0GCQ1S8MH',
  smoothSailing: 'https://www.amazon.com/Smooth-Sailing-Rough-Waters-Consistently/dp/B0G4NMSM31/ref=sr_1_1?crid=BWS5ZWAQCC46&dib=eyJ2IjoiMSJ9.pTShQ0uJgtzeHg_EAFai2a6YTAan0h_35hcv7ZH0QKfGjHj071QN20LucGBJIEps.F_tIgnCOSc3EqGF6wUtOWK_hXH-5Ti3Miy6KYQ_JaLY&dib_tag=se&keywords=smooth+sailing+in+rough+waters&qid=1766758613&s=books&sprefix=smooth+sailing+in+rough+water%2Cstripbooks%2C189&sr=1-1',
} as const;

const TOPIC_GROUPS: { groupTitle: string; groupAccent: string; topics: LearningTopic[] }[] = [
  {
    groupTitle: 'Getting Started',
    groupAccent: '#0F766E',
    topics: [
      {
        id: 'app-tutorials',
        title: 'EasySeas app overview',
        subtitle: 'Where to begin and what each tab does',
        icon: Sparkles,
        accent: '#0F766E',
        bullets: [
          'Offers tab: Import and review casino offers, expiration urgency, decoded value, and scoring.',
          'Cruises tab: Browse available sailings by All Ships, Available, All, or Back-2-Back. Filter by ship, cabin type, and date.',
          'Booked tab: Track your upcoming and completed voyages, Crown & Anchor points, and casino stats.',
          'Calendar tab: Month, week, 90-day, and Passenger views of all your cruises, events, and expirations.',
          'Machines tab: Log slot machine observations, manage your slot atlas, and browse machines by ship.',
          'Settings tab: Manage user profiles, data sync, import/export, and app preferences.',
        ],
      },
      {
        id: 'casino-basics',
        title: 'Cruise casino basics',
        subtitle: 'How cruise casino value is usually evaluated',
        icon: Ship,
        accent: '#2563EB',
        bullets: [
          'Casino value is not only the cabin price; taxes, fees, upgrade costs, FreePlay, and OBC all matter.',
          'Sea days generally create more casino-open time than port-heavy itineraries.',
          'Treat every automated score as a planning signal, then confirm official cruise-line terms.',
          'Royal Caribbean, Celebrity, and Silversea each have separate loyalty programs — track them individually.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Profiles & Filtering',
    groupAccent: '#7C3AED',
    topics: [
      {
        id: 'dual-user',
        title: 'Primary & Secondary user profiles',
        subtitle: 'Manage two travelers under one account',
        icon: Users,
        accent: '#7C3AED',
        bullets: [
          'EasySeas supports two user profiles (Primary and Secondary) under a single signed-in account.',
          'Toggle between Primary and Secondary user in Settings → User Profiles.',
          'Each profile has its own Royal Caribbean, Celebrity, and Silversea loyalty numbers and tier levels.',
          'Club Royale and Blue Chip tiers are tracked separately per profile.',
          'When syncing Club Royale, the app asks which user you are syncing (primary or secondary).',
          'The secondary user\'s data belongs to the primary account holder and is backed up together.',
        ],
      },
      {
        id: 'filtering',
        title: 'Intelligence Filtering',
        subtitle: 'Scope data by profile, brand, and program',
        icon: SlidersHorizontal,
        accent: '#0891B2',
        bullets: [
          'Every major tab (Offers, Cruises, Booked, Calendar) has a Filtering section at the top.',
          'Filter by Profile/Account: All, User (primary), or Second User.',
          'Filter by Brand: All, Royal Caribbean, Celebrity, or Silversea.',
          'Filter by Program: All, Club Royale, Blue Chip, or Venetian Society.',
          'Active filters scope all cruises, offers, certificates, and events shown on that page.',
          'Tap "Clear" to reset all filters and see the combined household view.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Offers & Value',
    groupAccent: '#D97706',
    topics: [
      {
        id: 'offer-math',
        title: 'Offer math and comp value',
        subtitle: 'Understand what the casino is really covering',
        icon: Calculator,
        accent: '#D97706',
        bullets: [
          'Casino Pays For estimates cabin value, FreePlay, OBC, and trade-in value for each offer.',
          'You Pay estimates taxes, port charges, fees, and upgrades when the data exists.',
          'A high headline cabin value is weaker if it forces poor dates, high upgrades, or low casino-open time.',
          'The Intelligence Score (0–100) combines urgency, value, expiration, and profile fit.',
          'Decode Offer breaks down exactly how the casino\'s contribution is calculated.',
        ],
      },
      {
        id: 'command-center',
        title: 'Expiration Command Center',
        subtitle: 'Track offer urgency and deadlines',
        icon: Bell,
        accent: '#DC2626',
        bullets: [
          'The Command Center on the Offers tab groups offers by expiration urgency (0–7, 8–14, 15–30 days).',
          'Urgent offers (expiring within 14 days) are highlighted and counted separately.',
          'Actions for each offer: View, Decode, Compare (via AgentX), Archive, or Mark Skipped.',
          'Archived and skipped offers are removed from the active view but remain in your data.',
          'Open the full Command Center screen for the complete urgency-sorted list.',
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
          'An "available" cruise on an offer means it matched your offer code — always confirm with the cruise line.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Cruises & Planning',
    groupAccent: '#1E3A8A',
    topics: [
      {
        id: 'cruises-tabs',
        title: 'Cruises page tabs',
        subtitle: 'Available, All, Back 2 Back, and Booked',
        icon: Anchor,
        accent: '#1E3A8A',
        bullets: [
          'Available: Shows upcoming cruises with no date conflicts against your booked sailings.',
          'All: Shows every imported cruise regardless of conflict or booking status.',
          'Back 2 Back: Automatically finds cruise pairs or chains that fit your calendar with minimal gaps.',
          'Booked: Shows only your booked sailings filtered by the active intelligence profile.',
          'Use the All Ships filter to narrow results to one or more specific ships.',
        ],
      },
      {
        id: 'b2b',
        title: 'Back-to-Back cruise sets',
        subtitle: 'How B2B detection and planning works',
        icon: Link2,
        accent: '#0891B2',
        bullets: [
          'EasySeas automatically finds cruise pairs where the turnaround gap is 0–2 days.',
          'Each B2B set shows total nights, date range, port of departure, and all available offer codes.',
          'Pick ONE offer per sailing — each cruise in the chain can use a different offer code.',
          'B2B sets maximize casino-open time and reduce per-day travel overhead costs.',
          'B2B suggestions update automatically when your offer or booked data changes.',
        ],
      },
      {
        id: 'booked-details',
        title: 'Booked cruise details',
        subtitle: 'What you can track per sailing',
        icon: Star,
        accent: '#7C3AED',
        bullets: [
          'Each booked cruise tracks: ship, dates, nights, cabin type, itinerary, ports, and offer code.',
          'Enter winnings, earned points, amount paid, FreePlay, and OBC for completed sailings.',
          'The detail screen shows casino availability by day, sea-day density, and replacement suggestions.',
          'Pinnacle (Royal Caribbean sailings after 7/24/26) and Zenith (Celebrity sailings after 7/24/26) badges are shown on booked cards.',
          'Press the back arrow from a booked cruise detail to return to the Booked tab (not the Offers tab).',
        ],
      },
      {
        id: 'replacement',
        title: 'Replacement cruise finder',
        subtitle: 'Swap a booking with a smarter option',
        icon: Target,
        accent: '#D97706',
        bullets: [
          'Open any cruise detail and scroll to the Replacement Suggestions section.',
          'Choose a replacement goal: Best Value, Lower Cost, Sea Days, Back-to-Back Fit, Expiring Offer, New Ports, Known Ship, or Tier Push.',
          'Candidates are ranked by score against your chosen goal and current booked sailings.',
          'Replacement estimates include out-of-pocket cost, casino availability, and offer alignment.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Loyalty & Points',
    groupAccent: '#B45309',
    topics: [
      {
        id: 'loyalty-basics',
        title: 'Loyalty basics',
        subtitle: 'How tier progress fits your planning',
        icon: GraduationCap,
        accent: '#B45309',
        bullets: [
          'Track both cruise-line loyalty (Crown & Anchor, Captains Club, Venetian Society) and casino program points (Club Royale, Blue Chip) — they answer different questions.',
          'Use AgentX Loyalty Strategist mode for progress summaries and milestone planning.',
          'Avoid chasing status without understanding your actual out-of-pocket cost and risk tolerance.',
          'Crown & Anchor Points Timeline on the Booked tab shows your tier trajectory.',
        ],
      },
      {
        id: 'sync',
        title: 'Club Royale & Celebrity sync',
        subtitle: 'Syncing loyalty and offer data',
        icon: Database,
        accent: '#0F766E',
        bullets: [
          'Go to Settings → Royal Caribbean Sync to import offers, bookings, and loyalty data.',
          'Go to Settings → Celebrity Sync to sync Celebrity cruises and Blue Chip data.',
          'When syncing Club Royale, the app prompts you to select which user (primary or secondary) you are syncing.',
          'If the secondary user is unassigned, the sync defaults to the primary user.',
          'After sync, filtered views update automatically to reflect the new data.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Certificates & Casino',
    groupAccent: '#0891B2',
    topics: [
      {
        id: 'certificates',
        title: 'Certificate management',
        subtitle: 'Use certificates carefully',
        icon: ClipboardCheck,
        accent: '#0891B2',
        bullets: [
          'Certificates include FPP, Next Cruise, OBC, and FreePlay types.',
          'Stacking certificates is never assumed automatically — verify casino/cruise line rules.',
          'Check owner, program, expiration, cabin entitlement, and offer code alignment.',
          'Use AgentX Certificate Advisor mode when comparing certificate fit against current offers.',
          'Expired certificates are tracked separately from available ones.',
        ],
      },
      {
        id: 'casino-sessions',
        title: 'Casino sessions & bankroll',
        subtitle: 'Track your play, coin-in, and results',
        icon: Coins,
        accent: '#D97706',
        bullets: [
          'Log casino sessions from the Machines tab to track coin-in, win/loss, and points earned per session.',
          'Bankroll management lets you set limits and receive alerts when approaching thresholds.',
          'Casino stats on the Booked tab show total coin-in, net cash result, and averages across all sailings.',
          'W-2G records and comp items can be tracked in the casino section of Settings.',
          'Session data is scoped to the active profile filter.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Calendar & Schedule',
    groupAccent: '#059669',
    topics: [
      {
        id: 'calendar',
        title: 'Calendar views',
        subtitle: 'Month, week, 90 days, and passenger',
        icon: Calendar,
        accent: '#059669',
        bullets: [
          'Month view: See all cruises and events at a glance, with color-coded dots for cruise, travel, and personal events.',
          'Week view: Detailed week layout for the current 7-day window.',
          '90 Days view: Chronological list of upcoming events, expirations, and milestones.',
          'Passenger view: Every day of the year labeled as Sea Day, Port Day, Land Day, Gap, Offer Expiration, or Tier Milestone.',
          'Open the full Passenger Calendar drill-down for a detailed sea/port/gap analysis.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Machines & Ships',
    groupAccent: '#7C3AED',
    topics: [
      {
        id: 'machine-logging',
        title: 'Machine condition logging',
        subtitle: 'Observation without creating a session system',
        icon: Gamepad2,
        accent: '#7C3AED',
        bullets: [
          'Record ship, location, machine name, denomination, bet level, meter values, and visible state.',
          'Use decisions like Played, Passed, or Watched so AP Scout mode can interpret your observations.',
          'Condition logs are separate from casino play sessions and describe what you saw at a specific moment.',
          'Logs are tagged to the ship and sync with the machine encyclopedia.',
        ],
      },
      {
        id: 'ship-machines',
        title: 'Ship Machine Explorer',
        subtitle: 'Browse which slots are on which ships',
        icon: Ship,
        accent: '#0891B2',
        bullets: [
          'Available on the Offers tab (scroll to bottom) and on individual cruise detail pages.',
          'Filter by one or multiple ships to see all machines aboard those specific vessels.',
          'Data is sourced from the ship-to-slots mapping file containing all 28 Royal Caribbean fleet ships.',
          'Machine lists are searchable and scrollable within the explorer panel.',
          'When viewing a specific cruise detail, the Machines Aboard section lists only machines for that ship.',
        ],
      },
      {
        id: 'deck-plan',
        title: 'Deck plan & machine locations',
        subtitle: 'Map machine positions on the ship',
        icon: MapPin,
        accent: '#059669',
        bullets: [
          'The Deck Plan screen lets you pin machine locations on ship deck diagrams.',
          'Locations are saved per ship and available for review during future sailings.',
          'Use deck plan data alongside machine condition logs for a complete pre-sailing picture.',
        ],
      },
    ],
  },
  {
    groupTitle: 'AgentX & Intelligence',
    groupAccent: '#DC2626',
    topics: [
      {
        id: 'agentx',
        title: 'AgentX AI assistant',
        subtitle: 'AI-powered planning and analysis',
        icon: Bot,
        accent: '#DC2626',
        bullets: [
          'AgentX has multiple modes: Casino Host, Travel Agent, Loyalty Strategist, AP Scout, and Certificate Advisor.',
          'Ask My Data provides natural-language search across your offers, cruises, certificates, and calendar records.',
          'Ask AgentX to compare offers, plan B2B sequences, estimate tier progress, or evaluate machine observations.',
          'AgentX responses are advisory only — always verify against official cruise-line terms.',
          'Open Ask My Data from the Offers tab or via the dashboard card.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Data & Backup',
    groupAccent: '#0F766E',
    topics: [
      {
        id: 'import-export',
        title: 'Import / Export / Save All / Load All',
        subtitle: 'Backing up and restoring your complete data',
        icon: Download,
        accent: '#0F766E',
        bullets: [
          'Save All and Export both capture a full snapshot of your data including offers, cruises, certificates, sessions, and machine data.',
          'Both Primary AND Secondary user profiles (loyalty tiers, program levels, playing hours) are included in every backup.',
          'Load All and Import restore all data for the signed-in account and both user profiles.',
          'Imported data is merged with existing records — duplicates are automatically deduplicated.',
          'Backups are scoped to your signed-in email so they restore correctly when you sign back in.',
          'Always export before performing a Royal Caribbean or Celebrity sync to preserve your previous state.',
        ],
      },
      {
        id: 'data-settings',
        title: 'Settings & data management',
        subtitle: 'Where to manage users, preferences, and storage',
        icon: Database,
        accent: '#1E3A8A',
        bullets: [
          'Settings → User Profiles: Edit both Primary and Secondary traveler profiles, loyalty numbers, and tier levels.',
          'Settings → Royal Caribbean Sync and Celebrity Sync: Import offers, bookings, and loyalty data.',
          'Settings → Import / Export: Full data backup and restore for both users.',
          'Settings → Alerts: Configure price-drop, expiration, and milestone notifications.',
          'Settings → Currency and Display: Adjust formatting preferences for prices and points.',
        ],
      },
    ],
  },
  {
    groupTitle: 'Programs & Terms',
    groupAccent: '#1E3A8A',
    topics: [
      {
        id: 'programs',
        title: 'Royal/Celebrity program basics',
        subtitle: 'Household and brand-aware planning',
        icon: HeartHandshake,
        accent: '#1E3A8A',
        bullets: [
          'Royal Caribbean: Crown & Anchor Society (tier loyalty) + Club Royale (casino program).',
          'Celebrity Cruises: Captain\'s Club (tier loyalty) + Blue Chip Club (casino program).',
          'Silversea: Venetian Society (tier loyalty).',
          'Owner profiles prevent offers, bookings, and points from being mixed between travelers.',
          'Use the Intelligence Filters to scope each tab to a specific brand or program.',
          'Pinnacle status (Royal Caribbean) and Zenith status (Celebrity) are the highest tiers — tracked and badged in EasySeas.',
        ],
      },
    ],
  },
];

function TopicGroupSection({ group }: { group: typeof TOPIC_GROUPS[0] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={groupStyles.container}>
      <TouchableOpacity
        style={[groupStyles.groupHeader, { borderLeftColor: group.groupAccent }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.75}
      >
        <Text style={groupStyles.groupTitle}>{group.groupTitle}</Text>
        <View style={[groupStyles.countBadge, { backgroundColor: `${group.groupAccent}18` }]}>
          <Text style={[groupStyles.countText, { color: group.groupAccent }]}>{group.topics.length}</Text>
        </View>
        {expanded
          ? <ChevronDown size={16} color={group.groupAccent} />
          : <ChevronRight size={16} color={group.groupAccent} />}
      </TouchableOpacity>
      {expanded && (
        <View style={groupStyles.topicsContainer}>
          {group.topics.map((topic) => {
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
        </View>
      )}
    </View>
  );
}

export default function LearnSystemScreen() {
  const router = useRouter();
  const totalTopicCount = useMemo(() => TOPIC_GROUPS.reduce((sum, g) => sum + g.topics.length, 0), []);

  const handleOpenBookLink = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unable to Open Link', 'This device cannot open the selected book link right now.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('[LearnSystem] Failed to open book link:', error);
      Alert.alert('Unable to Open Link', 'Please try again from Settings or your browser.');
    }
  }, []);

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
              <Text style={styles.headerSubtitle}>User manual • {totalTopicCount} topics across {TOPIC_GROUPS.length} sections</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} testID="learn-system-close">
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard} testID="learn-system-hero">
            <Text style={styles.heroEyebrow}>EasySeas Complete Guide</Text>
            <Text style={styles.heroTitle}>Everything you need to know about planning, tracking, and maximizing your casino cruise experience.</Text>
            <Text style={styles.heroBody}>This manual covers all EasySeas features: dual user profiles, intelligence filtering, offers, cruises, calendar, machines, data backup, AgentX, and loyalty programs. Tap any section header to expand or collapse it.</Text>
          </View>

          {/* Quick navigation chips */}
          <View style={styles.quickNavRow}>
            {TOPIC_GROUPS.map((group) => (
              <View key={group.groupTitle} style={[styles.quickNavChip, { borderColor: group.groupAccent }]}>
                <Text style={[styles.quickNavText, { color: group.groupAccent }]}>{group.groupTitle}</Text>
              </View>
            ))}
          </View>

          {TOPIC_GROUPS.map((group) => (
            <TopicGroupSection key={group.groupTitle} group={group} />
          ))}

          <View style={styles.bookCompanionCard} testID="learn-system-books">
            <View style={styles.bookCompanionHeader}>
              <View style={styles.bookCompanionIcon}>
                <BookOpen size={22} color="#A7F3D0" />
              </View>
              <View style={styles.bookCopy}>
                <Text style={styles.bookEyebrow}>Book + App Companion</Text>
                <Text style={styles.bookTitle}>Scott Astin learning shelf</Text>
                <Text style={styles.bookBody}>Open the book links here while using EasySeas as the companion workspace for offers, casino value, calendar planning, and responsible decision checks.</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.bookLinkButton}
              onPress={() => handleOpenBookLink(BOOK_LINKS.smoothSailing)}
              activeOpacity={0.82}
              testID="learn-system-open-smooth-sailing"
            >
              <View style={styles.bookLinkCopy}>
                <Text style={styles.bookLinkTitle}>Smooth Sailing (In Rough Waters)</Text>
                <Text style={styles.bookLinkSubtitle}>Open the Amazon book page</Text>
              </View>
              <ExternalLink size={17} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBookLinkButton}
              onPress={() => handleOpenBookLink(BOOK_LINKS.authorPage)}
              activeOpacity={0.82}
              testID="learn-system-open-author-page"
            >
              <Text style={styles.secondaryBookLinkText}>Check out Scott Astin's other books</Text>
              <ChevronRight size={16} color="#A7F3D0" />
            </TouchableOpacity>
          </View>

          <View style={styles.disclaimerCard} testID="learn-system-disclaimer">
            <Text style={styles.disclaimerTitle}>Responsible-use and legal note</Text>
            <Text style={styles.disclaimerText}>EasySeas provides planning tools and educational guidance only. Cruise-line casino offers, certificate rules, loyalty program terms, gaming outcomes, taxes, and fees can change. Verify official terms before booking or making financial decisions. All scores, tier estimates, and casino-availability windows are automated signals, not guarantees.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const groupStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  groupTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '900' as const,
  },
  topicsContainer: {
    gap: SPACING.sm,
    paddingLeft: 4,
  },
});

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
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
    lineHeight: 26,
    marginBottom: SPACING.sm,
  },
  heroBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickNavChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  quickNavText: {
    fontSize: 10,
    fontWeight: '800' as const,
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
  bookCompanionCard: {
    backgroundColor: 'rgba(15, 36, 57, 0.94)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.24)',
    gap: SPACING.sm,
    ...SHADOW.lg,
  },
  bookCompanionHeader: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  bookCompanionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 243, 208, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.24)',
  },
  bookCopy: {
    flex: 1,
  },
  bookEyebrow: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#A7F3D0',
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
    marginBottom: 3,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: COLORS.white,
    marginBottom: 4,
  },
  bookBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.76)',
    lineHeight: 19,
  },
  bookLinkButton: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: '#0F766E',
  },
  bookLinkCopy: {
    flex: 1,
  },
  bookLinkTitle: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: COLORS.white,
  },
  bookLinkSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.72)',
  },
  secondaryBookLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.18)',
  },
  secondaryBookLinkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900' as const,
    color: '#A7F3D0',
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
