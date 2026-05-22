import React, { ReactNode, useCallback, useRef } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Calendar,
  ChevronRight,
  Chrome,
  Crown,
  Database,
  Download,
  FileText,
  Gamepad2,
  HelpCircle,
  LifeBuoy,
  Lock,
  RefreshCcw,
  Settings,
  Ship,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';

interface UserManualModalProps {
  visible: boolean;
  onClose: () => void;
}

type ManualSectionId =
  | 'quick-start'
  | 'navigation'
  | 'data-sync'
  | 'offers'
  | 'cruises'
  | 'booked'
  | 'calendar'
  | 'casino'
  | 'slots'
  | 'agentx'
  | 'settings'
  | 'subscription'
  | 'admin'
  | 'privacy'
  | 'troubleshooting'
  | 'legal';

interface ManualSectionDefinition {
  id: ManualSectionId;
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

interface FieldItem {
  field: string;
  description: string;
}

interface ButtonItem {
  button: string;
  description: string;
}

interface FeatureItem {
  title: string;
  description: string;
}

const SECTIONS: ManualSectionDefinition[] = [
  { id: 'quick-start', title: 'Quick Start', icon: BookOpen },
  { id: 'navigation', title: 'Tabs & Navigation', icon: Ship },
  { id: 'data-sync', title: 'Sync, Import & Backup', icon: RefreshCcw },
  { id: 'offers', title: 'Offers Dashboard', icon: Tag },
  { id: 'cruises', title: 'Cruises Planning', icon: Ship },
  { id: 'booked', title: 'Booked Cruises', icon: Crown },
  { id: 'calendar', title: 'Calendar & Events', icon: Calendar },
  { id: 'casino', title: 'Casino Analytics', icon: TrendingUp },
  { id: 'slots', title: 'Slots & Machine Atlas', icon: Gamepad2 },
  { id: 'agentx', title: 'AgentX Assistant', icon: Bot },
  { id: 'settings', title: 'Settings Reference', icon: Settings },
  { id: 'subscription', title: 'Subscription & Access', icon: Lock },
  { id: 'admin', title: 'Admin Tools', icon: Database },
  { id: 'privacy', title: 'Data Privacy', icon: Lock },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: HelpCircle },
  { id: 'legal', title: 'Legal & Disclaimer', icon: AlertCircle },
];

export function UserManualModal({ visible, onClose }: UserManualModalProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<Record<ManualSectionId, number>>({} as Record<ManualSectionId, number>);

  const scrollToSection = useCallback((sectionId: ManualSectionId) => {
    const yOffset = sectionRefs.current[sectionId];
    if (typeof yOffset === 'number' && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, yOffset - 56), animated: true });
    }
  }, []);

  const handleSectionLayout = useCallback((sectionId: ManualSectionId, y: number) => {
    sectionRefs.current[sectionId] = y;
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="user-manual-modal"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.kicker}>Easy Seas</Text>
            <Text style={styles.title}>User Manual</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} testID="user-manual-close-button" activeOpacity={0.75}>
            <X size={24} color={COLORS.navyDeep} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
          testID="user-manual-scroll-view"
        >
          <View style={styles.heroCard}>
            <Text style={styles.version}>Updated April 2026 | App Version 1.0.0</Text>
            <Text style={styles.heroTitle}>Everything Easy Seas does, in one guide.</Text>
            <Text style={styles.intro}>
              Easy Seas helps cruise and casino travelers keep offers, booked cruises, loyalty tiers, certificates, calendar events, casino sessions, slot machine notes, pricing, and backups organized in one mobile app.
            </Text>
          </View>

          <View style={styles.tocContainer}>
            <Text style={styles.tocTitle}>Table of Contents</Text>
            <Text style={styles.tocSubtitle}>Tap a section to jump directly to it.</Text>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <TouchableOpacity
                  key={section.id}
                  style={styles.tocItem}
                  onPress={() => scrollToSection(section.id)}
                  activeOpacity={0.75}
                  testID={`user-manual-toc-${section.id}`}
                >
                  <View style={styles.tocIconWrap}>
                    <Icon size={15} color={COLORS.navyDeep} />
                  </View>
                  <Text style={styles.tocText}>{section.title}</Text>
                  <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
                </TouchableOpacity>
              );
            })}
          </View>

          <SectionWithRef id="quick-start" title="Quick Start" onLayout={handleSectionLayout}>
            <ImportantBox title="Recommended first setup order">
              <NumberedList items={[
                'Sign in with your email so your app profile can be scoped to you.',
                'Open Settings and confirm your name, email, Crown & Anchor number, Crown & Anchor points, Club Royale points, and preferred casino playing hours.',
                'Use Settings → Quick Actions → Sync Club Royale for Royal Caribbean or Celebrity data when supported on your device.',
                'If embedded sync is unavailable, use Settings → Download Chrome Extension, scrape your cruise website on desktop Chrome, then import the downloaded CSV files.',
                'Review Offers, Cruises, Booked, Calendar, Casino, and Slots to confirm the imported data looks correct.',
                'Use Settings → Export All App Data after a successful setup so you always have a full backup.',
              ]} />
            </ImportantBox>

            <Subsection title="What new users should see">
              <Paragraph>
                A new user starts with no personal cruise data other than demo/sample data used to explain the app. After sign-in, data is scoped by the signed-in email/profile and should not show another person’s offers, bookings, sessions, or loyalty information.
              </Paragraph>
            </Subsection>

            <Subsection title="Core data you can manage">
              <FeatureList items={[
                { title: 'Casino offers', description: 'Offer codes, featured offers, certificates, trade-in value, free play, onboard credit, perks, expiry dates, and linked eligible sailings.' },
                { title: 'Cruise sailings', description: 'Available cruises from casino offers, pricing, itinerary data, taxes/fees, ship, ports, nights, cabin classes, and value metrics.' },
                { title: 'Booked cruises', description: 'Reservations, cabins, guests, booking IDs, cruise economics, completion status, loyalty points, and post-cruise outcomes.' },
                { title: 'Calendar events', description: 'Imported ICS/TripIt events plus generated cruise events such as embarkation, disembarkation, port days, and sea days.' },
                { title: 'Casino sessions', description: 'Coin-in, coin-out, machine, ship, denomination, duration, points, PPH, tax records, wins, and notes.' },
                { title: 'Machine atlas', description: 'Slot machine encyclopedia, favorites, AP notes, ship availability, personal sessions, playing hours, and exportable strategy documents.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="navigation" title="Tabs & Navigation" onLayout={handleSectionLayout}>
            <Subsection title="Bottom tabs">
              <FeatureList items={[
                { title: 'Offers', description: 'Main dashboard for active casino offers, featured offers, certificates, alerts, AgentX, and offer-card summaries.' },
                { title: 'Cruises', description: 'Available sailings, advanced filters, booked/conflict views, back-to-back cruise finder, and favorite stateroom planning.' },
                { title: 'Booked', description: 'Confirmed cruise portfolio, timeline/list/points views, economics summaries, marine alerts, and manual booked-cruise entry.' },
                { title: 'Calendar', description: 'Events, week/month/90-day views, generated cruise days, crew recognition, day agenda, and time zone tools.' },
                { title: 'Casino', description: 'Analytics, charts, session tracker, calculators, PPH goals, W2-G tracker, and performance intelligence.' },
                { title: 'Slots', description: 'Machine Atlas, favorites, ship/manufacturer filters, casino open hours, quick machine sessions, and exports.' },
                { title: 'Settings', description: 'Profile, sync, imports, exports, backups, subscription, help, support, and advanced data tools.' },
              ]} />
            </Subsection>

            <Subsection title="Additional screens">
              <ButtonList items={[
                { button: 'Offer Details', description: 'Opened from offer cards to review the full offer, eligible sailings, value breakdowns, and linked cruise data.' },
                { button: 'Day Agenda', description: 'Opened from Calendar to see cruise days, casino open/closed windows, port timing, and custom events.' },
                { button: 'Machine Detail', description: 'Opened from Slots to review AP notes, rules, personal sessions, and machine-specific statistics.' },
                { button: 'Pricing Summary', description: 'Opened from Settings to review cruise pricing and historical pricing data.' },
                { button: 'Sync Screens', description: 'Royal Caribbean/Celebrity and Carnival sync screens manage assisted data extraction flows.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="data-sync" title="Sync, Import & Backup" onLayout={handleSectionLayout}>
            <ImportantBox title="Sync preservation rule">
              <Paragraph>
                Importing, syncing, backing up, and restoring are designed to preserve existing user-scoped data unless you explicitly choose a destructive reset or restore action. Always export a backup before clearing data or testing a new import.
              </Paragraph>
            </ImportantBox>

            <Subsection title="Royal Caribbean and Celebrity sync">
              <Paragraph>
                Open Settings → Quick Actions → Sync Club Royale. Choose Royal Caribbean or Celebrity, sign in when prompted, run data extraction, review logs, then confirm the final sync into the app.
              </Paragraph>
              <ButtonList items={[
                { button: 'LOGIN', description: 'Opens the cruise website sign-in flow in the embedded browser on mobile.' },
                { button: 'SYNC NOW', description: 'Starts extraction for offers, booked cruises, loyalty data, and related pricing when available.' },
                { button: 'YES, SYNC NOW', description: 'Commits extracted data into Easy Seas after review and shows sync/progress feedback while saving.' },
                { button: 'Cancel Sync', description: 'Stops the current sync attempt without committing partially extracted data.' },
                { button: 'Export Log', description: 'Exports recent sync logs for troubleshooting.' },
              ]} />
            </Subsection>

            <Subsection title="Web-safe sync path">
              <Paragraph>
                React Native Web cannot embed every cruise website flow reliably. On web, use the browser-assisted path: download the Easy Seas Chrome extension, open the cruise website in desktop Chrome, sign in, run the extension overlay, then import the generated CSV files in Settings.
              </Paragraph>
            </Subsection>

            <Subsection title="Carnival sync">
              <Paragraph>
                Admin-enabled Carnival sync supports Carnival deals, bookings, VIFP loyalty, and Players Club data. On mobile, use the embedded browser login and SYNC NOW flow. On web, use the desktop extension workflow and import the downloaded CSV files.
              </Paragraph>
            </Subsection>

            <Subsection title="Chrome extension workflow">
              <NumberedList items={[
                'Open Settings → Data Management → Browser Extension.',
                'Tap Download Chrome Extension and save the ZIP files to a desktop computer.',
                'Extract the ZIP files.',
                'Open Chrome and go to chrome://extensions.',
                'Enable Developer mode.',
                'Choose Load unpacked and select the extracted extension folders.',
                'Open the cruise website, sign in, load all offers when needed, then run the extension scrape/export buttons.',
                'Import the downloaded Offers CSV and Booked Cruises CSV in Easy Seas Settings.',
              ]} />
            </Subsection>

            <Subsection title="Import options">
              <ButtonList items={[
                { button: 'Offers CSV', description: 'Imports casino offer manifests and eligible sailings, including offer codes, featured offers, certificates, OBC, free play, cabin values, taxes/fees, and sailings.' },
                { button: 'Booked Cruises CSV', description: 'Imports confirmed or upcoming cruises, reservation data, guests, cabins, sailing dates, and booking identifiers.' },
                { button: 'Calendar (.ics)', description: 'Imports events from TripIt, Google Calendar, Apple Calendar, Outlook, or another ICS export.' },
                { button: 'Restore from Backup', description: 'Restores a complete Easy Seas backup JSON containing app data, profile fields, loyalty data, certificates, sessions, events, machines, settings, and backups.' },
                { button: 'Import Machines (.json)', description: 'Admin tool for restoring machine atlas data.' },
                { button: 'Import Completed Cruises (.xlsx)', description: 'Admin tool for importing completed cruise economics/history spreadsheets.' },
              ]} />
            </Subsection>

            <Subsection title="Export and backup options">
              <ButtonList items={[
                { button: 'Offers CSV', description: 'Exports current offer/sailing data for spreadsheet review or backup.' },
                { button: 'Booked Cruises CSV', description: 'Exports booked cruise records.' },
                { button: 'Calendar (.ics)', description: 'Exports calendar events into a standard calendar file.' },
                { button: 'Export All App Data', description: 'Creates the safest full backup of cruises, offers, events, casino sessions, certificates, user profile, playing hours, loyalty points, settings, crew, machines, and related records.' },
                { button: 'Save All', description: 'Quick action for full app data export.' },
                { button: 'Load Backup', description: 'Quick action for full restore from backup.' },
                { button: 'Save as Mock Data', description: 'Developer/admin utility that saves the current local data as mock TypeScript data files.' },
              ]} />
            </Subsection>

            <Subsection title="Calendar feed publishing">
              <Paragraph>
                Settings can publish your booked cruises and events as a subscribable ICS feed. After publishing, you can copy the feed URL, subscribe from a calendar app, update the feed, or generate a new URL token.
              </Paragraph>
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="offers" title="Offers Dashboard" onLayout={handleSectionLayout}>
            <Paragraph>
              The Offers tab is the command center for active casino offers, featured offers, certificates, alerts, and AI-assisted analysis.
            </Paragraph>

            <Subsection title="Dashboard cards">
              <FeatureList items={[
                { title: 'Compact loyalty header', description: 'Shows Club Royale, Crown & Anchor, Celebrity Blue Chip, Captain’s Club, or related loyalty status when available, including progress toward the next tier.' },
                { title: 'Data overview', description: 'Shows counts for available cruises, booked cruises, offers, events, machines, and other imported data.' },
                { title: 'Casino certificates', description: 'Tracks onboard credit certificates, offer codes, expiration status, and certificate management actions.' },
                { title: 'AgentX Analysis', description: 'Generates cruise/casino insights from the current app data and can be manually refreshed.' },
                { title: 'Alerts', description: 'Highlights price drops, expiring certificates, tier opportunities, conflicts, and other detected issues.' },
                { title: 'Machine Strategy', description: 'Shows machine recommendations and strategy context based on the user profile and machine atlas.' },
              ]} />
            </Subsection>

            <Subsection title="Offer sections">
              <FieldList items={[
                { field: 'Featured offer', description: 'Highlights the primary/featured offer, such as a monthly jackpot or named certificate offer, when imported.' },
                { field: 'Offer cards', description: 'Group eligible sailings by offer code and show aggregate value, cabin value, taxes/fees, free play, OBC, and eligible cruise count.' },
                { field: 'Cruise cards', description: 'Show ship, itinerary, sail date, nights, cabin price, taxes, perks, offer code, and value metrics.' },
                { field: 'Blocked/used offers', description: 'Used, booked, expired, or in-progress linked offers are filtered from active counts when appropriate.' },
                { field: 'Certificate explorer', description: 'Helps match certificates and offers, including cases where no certificate PDF match is found.' },
              ]} />
            </Subsection>

            <Subsection title="Common offer actions">
              <ButtonList items={[
                { button: 'Pull to Refresh', description: 'Refreshes local calculations and synced data displayed on the Offers tab.' },
                { button: 'Import Data', description: 'Appears in empty states and routes you toward Settings import tools.' },
                { button: 'Offer Card', description: 'Opens detailed offer/sailing information.' },
                { button: 'Certificate Manager', description: 'Add, edit, delete, and review certificates.' },
                { button: 'Alerts Manager', description: 'Review, dismiss, snooze, or clear detected alerts.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="cruises" title="Cruises Planning" onLayout={handleSectionLayout}>
            <Paragraph>
              The Cruises tab focuses on available sailings and planning decisions before booking.
            </Paragraph>

            <Subsection title="Views and filters">
              <FieldList items={[
                { field: 'Available', description: 'Shows sailings that are currently available and not blocked by booking conflicts or used/expired offer status.' },
                { field: 'All', description: 'Shows all imported sailings regardless of availability filter.' },
                { field: 'Back 2 Back', description: 'Finds consecutive cruise sets with compatible dates and offer rules.' },
                { field: 'Booked', description: 'Shows booked-linked sailings and helps compare available vs already-booked trips.' },
                { field: 'Cabin type', description: 'Filters by Interior, Oceanview, Balcony, Suite, or All cabins.' },
                { field: 'No conflicts', description: 'Filters out sailings that overlap booked cruise dates.' },
                { field: 'Ship filter', description: 'Limits the list to selected ships.' },
                { field: 'Sort', description: 'Sort by sailing date, value, nights, or similar planning criteria.' },
              ]} />
            </Subsection>

            <Subsection title="Planning tools">
              <FeatureList items={[
                { title: 'Recommendation engine', description: 'Scores cruise opportunities using offers, booked dates, and value data.' },
                { title: 'Back-to-back finder', description: 'Builds possible cruise chains with compatible dates and offer separation rules.' },
                { title: 'Favorite staterooms', description: 'Stores preferred staterooms and planning notes.' },
                { title: 'Price/value calculations', description: 'Calculates cruise value, out-of-pocket costs, taxes/fees, cabin estimates, and comp value.' },
                { title: 'AgentX chat', description: 'Available as an assistant overlay for planning questions.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="booked" title="Booked Cruises" onLayout={handleSectionLayout}>
            <Paragraph>
              The Booked tab tracks confirmed cruises and historical cruise economics.
            </Paragraph>

            <Subsection title="Viewing booked cruises">
              <FieldList items={[
                { field: 'List view', description: 'Standard booked cruise list with ship, destination, dates, cabin, reservation data, and status.' },
                { field: 'Timeline view', description: 'Chronological portfolio view for upcoming, in-progress, completed, and cancelled cruises.' },
                { field: 'Points view', description: 'Focuses on loyalty points, casino points, and progression data.' },
                { field: 'Filters', description: 'All, Upcoming, Completed, Celebrity, search, hide completed, and sort controls.' },
                { field: 'Marine alerts', description: 'Shows relevant marine/cruise alerts for upcoming cruises where available.' },
              ]} />
            </Subsection>

            <Subsection title="Booked cruise details tracked">
              <FieldList items={[
                { field: 'Reservation', description: 'Reservation number, booking ID, guest count, names, cabin category, and cabin number.' },
                { field: 'Sailing', description: 'Ship, departure port, destination, itinerary name, sail date, return date, and nights.' },
                { field: 'Economics', description: 'Retail value, amount paid, taxes/fees, offer value, cruise value captured, casino result, and total economic value.' },
                { field: 'Status', description: 'Upcoming, in-progress, completed, or cancelled.' },
                { field: 'Loyalty', description: 'Crown & Anchor nights/points and Club Royale/casino points associated with cruises.' },
              ]} />
            </Subsection>

            <Subsection title="Manual booked cruise entry">
              <Paragraph>
                Use the plus/add action to manually create a booked cruise when an import file is not available. Manual records can be combined with imported data and included in exports/backups.
              </Paragraph>
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="calendar" title="Calendar & Events" onLayout={handleSectionLayout}>
            <Subsection title="Calendar views">
              <FeatureList items={[
                { title: 'Events', description: 'List-style event overview for imported and generated events.' },
                { title: 'Week', description: 'Seven-day view of cruise, travel, and personal events.' },
                { title: 'Month', description: 'Monthly calendar with event dots for cruise, travel, and personal events.' },
                { title: '90 Days', description: 'Rolling 90-day planning view for upcoming trips and cruise events.' },
              ]} />
            </Subsection>

            <Subsection title="Generated cruise events">
              <FieldList items={[
                { field: 'Embarkation', description: 'Cruise departure/start day.' },
                { field: 'Disembarkation', description: 'Cruise return/end day.' },
                { field: 'Sea day', description: 'Generated when itinerary data indicates a day at sea.' },
                { field: 'Port day', description: 'Generated when itinerary data contains a port visit.' },
                { field: 'Casino windows', description: 'Day Agenda estimates casino open/closed timing using port, sea-day, and sailing data.' },
              ]} />
            </Subsection>

            <Subsection title="Event tools">
              <ButtonList items={[
                { button: 'Today', description: 'Returns the calendar to the current date.' },
                { button: 'Previous/Next', description: 'Moves between months or date ranges.' },
                { button: 'Clear Events', description: 'Deletes calendar events after confirmation. Export or back up first.' },
                { button: 'Day Agenda', description: 'Opens a detailed day plan from selected calendar dates.' },
                { button: 'Crew Recognition', description: 'Track crew members, recognition entries, and related stats.' },
                { button: 'Time Zone Converter', description: 'Helps compare ship time, port time, and home time.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="casino" title="Casino Analytics" onLayout={handleSectionLayout}>
            <Paragraph>
              The Casino tab combines session tracking, tier analysis, financial calculations, and performance intelligence.
            </Paragraph>

            <Subsection title="Analytics tabs">
              <FeatureList items={[
                { title: 'Intelligence', description: 'Casino metrics, casino intelligence, gamification, alerts, PPH summaries, and completed-cruise ROI portfolio.' },
                { title: 'Charts', description: 'Tier progression, ROI projection, risk analysis, and what-if simulation context.' },
                { title: 'Session', description: 'Session logging, live/quick session tools, session summaries, machine/session breakdowns, and historical session generation.' },
                { title: 'Calcs', description: 'W2-G tax tracker, comp value calculator, and calculator modes for per-session or historical analysis.' },
              ]} />
            </Subsection>

            <Subsection title="Session fields">
              <FieldList items={[
                { field: 'Date', description: 'When the session happened.' },
                { field: 'Ship', description: 'Ship where play occurred.' },
                { field: 'Machine/Game', description: 'Slot machine or game type.' },
                { field: 'Denomination', description: 'Credit denomination or bet level.' },
                { field: 'Coin-In', description: 'Total amount wagered.' },
                { field: 'Coin-Out', description: 'Total returned from the machine/game.' },
                { field: 'Start/End', description: 'Used to calculate duration and points per hour.' },
                { field: 'Notes', description: 'Optional session notes.' },
              ]} />
            </Subsection>

            <Subsection title="Casino calculations">
              <FieldList items={[
                { field: 'Net result', description: 'Coin-out minus coin-in.' },
                { field: 'PPH', description: 'Points earned divided by session hours.' },
                { field: 'Tier progress', description: 'Progress toward Choice/Prime/Signature/Master or matching casino tier structures when available.' },
                { field: 'ROI', description: 'Compares cruise value captured, casino result, spending, and retail value.' },
                { field: 'W2-G', description: 'Tracks taxable jackpot records, estimated federal/state tax, and year-to-date totals.' },
                { field: 'Comp value', description: 'Estimates the comp value generated by casino play.' },
              ]} />
            </Subsection>

            <Subsection title="Gamification and alerts">
              <Paragraph>
                Easy Seas can award achievements, maintain streaks, track weekly goals, show celebration overlays, and display PPH alerts when your tracked play crosses configured thresholds.
              </Paragraph>
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="slots" title="Slots & Machine Atlas" onLayout={handleSectionLayout}>
            <Paragraph>
              The Slots tab is a slot machine atlas and session companion.
            </Paragraph>

            <Subsection title="Machine library features">
              <FieldList items={[
                { field: 'Search', description: 'Find machines by name.' },
                { field: 'Favorites', description: 'Save machines to a personal favorites list.' },
                { field: 'Manufacturer filter', description: 'Filter by slot manufacturer.' },
                { field: 'Ship filter', description: 'Show machines associated with selected ships.' },
                { field: 'A-Z rail', description: 'Jump quickly through large machine lists.' },
                { field: 'Machine detail', description: 'Shows AP analysis, mechanics, triggers, walk-away rules, denominations, ship notes, and personal sessions.' },
              ]} />
            </Subsection>

            <Subsection title="Casino timing tools">
              <FeatureList items={[
                { title: 'Playing hours', description: 'Configure preferred sessions and times used by planning and casino open-hours logic.' },
                { title: 'Casino open hours', description: 'Estimates casino availability for upcoming cruises using itinerary and sailing context.' },
                { title: 'Golden time slots', description: 'Highlights preferred playing windows that overlap estimated casino open hours.' },
              ]} />
            </Subsection>

            <Subsection title="Machine/session actions">
              <ButtonList items={[
                { button: 'Add Machine', description: 'Open the add-machine wizard or global machine library tools.' },
                { button: 'Quick Session', description: 'Quickly log a casino session from the Slots tab.' },
                { button: 'Add Session', description: 'Open the full session entry modal.' },
                { button: 'Edit Session', description: 'Modify a machine session.' },
                { button: 'Export Favorites', description: 'Export favorite machines to a Word document.' },
                { button: 'Export All Machines', description: 'Incrementally export a large machine atlas to Word format.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="agentx" title="AgentX Assistant" onLayout={handleSectionLayout}>
            <Paragraph>
              AgentX is the app’s AI cruise and casino advisor. It can answer planning questions, summarize data, provide decision support, and explain analytics using the data currently available in the app.
            </Paragraph>

            <Subsection title="Where AgentX appears">
              <FeatureList items={[
                { title: 'Offers', description: 'Analysis card and chat for offer, certificate, and recommendation questions.' },
                { title: 'Cruises', description: 'Planning assistant for available sailings, conflicts, and back-to-back cruise ideas.' },
                { title: 'Suggested prompts', description: 'Tap a suggested question or type your own request.' },
                { title: 'Manual input', description: 'Type a message and send it to the assistant.' },
                { title: 'Voice/manual toggle', description: 'Some assistant UI supports choosing voice-oriented or manual input modes depending on device support.' },
              ]} />
            </Subsection>

            <ImportantBox title="AI limitations">
              <Paragraph>
                AgentX is informational only. Verify all prices, offers, sailing availability, casino rules, taxes, and policies directly with the cruise line or a qualified professional before making decisions.
              </Paragraph>
            </ImportantBox>
          </SectionWithRef>

          <SectionWithRef id="settings" title="Settings Reference" onLayout={handleSectionLayout}>
            <Subsection title="Data overview">
              <FieldList items={[
                { field: 'Total Cruises', description: 'Total available sailings in the system.' },
                { field: 'Booked', description: 'Booked cruise count with upcoming/completed split.' },
                { field: 'Offers', description: 'Unique imported offer count.' },
                { field: 'Events', description: 'Imported and generated event count.' },
                { field: 'Machines', description: 'Machine atlas count.' },
                { field: 'Crew', description: 'Crew recognition count.' },
              ]} />
            </Subsection>

            <Subsection title="Quick Actions">
              <ButtonList items={[
                { button: 'Sync Club Royale', description: 'Opens Royal Caribbean/Celebrity sync.' },
                { button: 'Sync Carnival Cruises', description: 'Admin-enabled Carnival sync.' },
                { button: 'Pricing Summary & History', description: 'Opens pricing summaries and historical tracking.' },
                { button: 'Load Import Offers.CSV', description: 'Shortcut to import an Offers CSV file.' },
                { button: 'Save All', description: 'Shortcut to export all app data.' },
                { button: 'Load Backup', description: 'Shortcut to restore a full backup.' },
              ]} />
            </Subsection>

            <Subsection title="User Profile">
              <FieldList items={[
                { field: 'Name', description: 'Used for personalization.' },
                { field: 'Email', description: 'Used for signed-in identity and data scoping.' },
                { field: 'Crown & Anchor Number', description: 'Royal Caribbean loyalty number.' },
                { field: 'Club Royale Points', description: 'Casino loyalty points for tier progress.' },
                { field: 'Crown & Anchor Points', description: 'Cruise loyalty points/nights for level progress.' },
                { field: 'Playing Hours', description: 'Preferred casino play windows used by casino timing and planning tools.' },
              ]} />
            </Subsection>

            <Subsection title="Display Preferences">
              <ButtonList items={[
                { button: 'Show Taxes in List', description: 'Toggle whether list prices include taxes and fees.' },
                { button: 'Price Per Night', description: 'Toggle between total price and per-night display where supported.' },
                { button: 'Theme', description: 'Displays light, dark, or system theme setting.' },
              ]} />
            </Subsection>

            <Subsection title="Notifications">
              <ButtonList items={[
                { button: 'Price Drop Alerts', description: 'Enable/disable price drop alerts.' },
                { button: 'Daily Summary', description: 'Enable/disable daily summary notifications where available.' },
              ]} />
            </Subsection>

            <Subsection title="Support and resources">
              <ButtonList items={[
                { button: 'Help Center', description: 'Opens the short getting started guide.' },
                { button: 'User Manual', description: 'Opens this complete manual.' },
                { button: 'Other Books', description: 'Opens Scott Astin’s author page.' },
                { button: 'Smooth Sailing', description: 'Opens the Amazon listing for Smooth Sailing (In Rough Waters).' },
                { button: 'Rate App', description: 'Opens the App Store rating page.' },
                { button: 'Download Easy Seas QR/App Store', description: 'Shows app download resources.' },
              ]} />
            </Subsection>

            <Subsection title="Danger Zone">
              <ImportantBox title="Use carefully">
                <Paragraph>
                  Clear All Data and Reset All Data are destructive. Export All App Data first unless you intentionally want to remove local records and start over.
                </Paragraph>
              </ImportantBox>
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="subscription" title="Subscription & Access" onLayout={handleSectionLayout}>
            <Paragraph>
              Easy Seas includes subscription-gated access. The Settings subscription card shows the current status and provides purchase, restore, management, privacy, and terms links.
            </Paragraph>

            <ButtonList items={[
              { button: 'Monthly Subscription', description: 'Shows active monthly/annual-style status when access is unlocked.' },
              { button: '5-Day Grace Period', description: 'Shows remaining grace period days when applicable.' },
              { button: 'Subscription Expired', description: 'Shown when paid access is not active.' },
              { button: 'Purchase a Monthly Subscription', description: 'Opens the monthly paywall/purchase screen.' },
              { button: 'Restore Purchases', description: 'Restores prior purchases through the purchase provider.' },
              { button: 'Manage Subscriptions', description: 'Opens subscription management.' },
              { button: 'Privacy Policy', description: 'Opens the privacy policy.' },
              { button: 'Terms of Use (EULA)', description: 'Opens the terms/EULA.' },
            ]} />
          </SectionWithRef>

          <SectionWithRef id="admin" title="Admin Tools" onLayout={handleSectionLayout}>
            <Paragraph>
              Admin tools only appear for authorized admin users.
            </Paragraph>

            <Subsection title="Access management">
              <ButtonList items={[
                { button: 'Add Email', description: 'Adds an email address to the whitelist.' },
                { button: 'Remove Email', description: 'Removes a whitelisted user when allowed. The primary admin email cannot be removed.' },
                { button: 'Whitelist Count', description: 'Shows all whitelisted emails.' },
              ]} />
            </Subsection>

            <Subsection title="Admin data tools">
              <ButtonList items={[
                { button: 'Import Machines (.json)', description: 'Imports machine atlas data.' },
                { button: 'Export Machines (.json)', description: 'Exports machine atlas data.' },
                { button: 'SeaPass Web Generator', description: 'Opens the Royal Caribbean web SeaPass generator.' },
                { button: 'Download SeaPass Generator', description: 'Downloads SeaPass generator files.' },
                { button: 'Import Offers CSV', description: 'Admin shortcut for offers import.' },
                { button: 'Import Completed Cruises (.xlsx)', description: 'Imports completed cruise historical spreadsheet data.' },
                { button: 'Reset All Data', description: 'Admin destructive reset. Export first.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="privacy" title="Data Privacy" onLayout={handleSectionLayout}>
            <ImportantBox title="User-specific data">
              <Paragraph>
                Personal data should be scoped to the signed-in user/email or app profile. Users should not see another user’s cruises, offers, sessions, backups, certificates, loyalty points, or settings.
              </Paragraph>
            </ImportantBox>

            <Subsection title="What is stored">
              <BulletList items={[
                'Profile fields such as name, email, Crown & Anchor number, loyalty points, and playing hours.',
                'Imported cruise offers, booked cruises, calendar events, certificates, and machine data.',
                'Casino sessions, analytics records, goals, achievements, W2-G records, and notes.',
                'Settings, notification preferences, subscription status signals, and app backup data.',
              ]} />
            </Subsection>

            <Subsection title="Best practices">
              <NumberedList items={[
                'Use the correct email when signing in.',
                'Export backups before destructive actions.',
                'Do not import another person’s CSV or backup unless intentionally managing their data.',
                'Use Clear All Data only when starting over on the current device/profile.',
                'If data ever appears incorrect, stop syncing and export logs/backups before changing anything else.',
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="troubleshooting" title="Troubleshooting" onLayout={handleSectionLayout}>
            <Subsection title="Sync says network connection lost">
              <NumberedList items={[
                'Confirm the backend health endpoint is reachable if using backend-assisted sync.',
                'Use Export Log from the sync screen to capture the latest sync state.',
                'Retry on a stable connection and keep the app open while extraction/sync is running.',
                'On web, switch to the Chrome extension import workflow because embedded cruise-site browsing may not be supported.',
                'If extraction completed, wait for the progress indicator after confirming YES, SYNC NOW before leaving the screen.',
              ]} />
            </Subsection>

            <Subsection title="Imported offers do not all appear">
              <NumberedList items={[
                'Check Settings → Data Overview for total cruises and unique offers.',
                'Confirm the imported CSV includes all offer rows and all eligible sailings.',
                'Check whether offers are expired, used, booked, or linked to an in-progress cruise.',
                'Pull to refresh on Offers.',
                'Export a backup before re-importing or clearing data.',
              ]} />
            </Subsection>

            <Subsection title="Featured offer missing after sync">
              <NumberedList items={[
                'Confirm the featured offer exists in the source website or downloaded CSV.',
                'Check the offer code and offer name fields in the imported data.',
                'Run the sync again or import a fresh Offers CSV generated after pressing Show All Offers on the website.',
                'Review sync logs for extraction warnings before committing data.',
              ]} />
            </Subsection>

            <Subsection title="Calendar events missing">
              <NumberedList items={[
                'Confirm booked cruises have valid sail and return dates.',
                'Re-import the ICS file or republish/update the calendar feed.',
                'Switch Calendar views or tap Today to force a visible date range.',
                'Check Settings → Data Overview event count.',
              ]} />
            </Subsection>

            <Subsection title="Loyalty points or tiers look wrong">
              <NumberedList items={[
                'Open Settings → User Profile and confirm manually entered points.',
                'Save profile/points changes.',
                'Confirm sync imported loyalty values from the expected cruise brand.',
                'Check Casino analytics for current-year vs historical points differences.',
              ]} />
            </Subsection>

            <Subsection title="App runs slowly">
              <NumberedList items={[
                'Close open modals and restart the app.',
                'Export All App Data as a backup.',
                'Remove stale test/demo data if intentionally no longer needed.',
                'On web, clear browser cache if stale UI data remains visible.',
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef id="legal" title="Legal & Disclaimer" onLayout={handleSectionLayout}>
            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Informational use only: </Text>
              This application is provided for informational and entertainment purposes only. Users assume all responsibility and risk associated with the use of this software.
            </Paragraph>

            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Not gambling advice: </Text>
              Easy Seas does not provide gambling advice, financial advice, tax advice, legal advice, or guaranteed outcomes. Casino and cruise decisions should be verified independently.
            </Paragraph>

            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Problem gambling resources: </Text>
              If you or someone you know has a gambling problem, contact the National Council on Problem Gambling at 1-800-522-4700 or visit Gamblers Anonymous at www.gamblersanonymous.org.
            </Paragraph>

            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Accuracy: </Text>
              Prices, offers, itineraries, ship details, loyalty rules, casino rules, benefits, and policies can change. Always verify directly with the cruise line or official source.
            </Paragraph>

            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Trademark notice: </Text>
              Club Royale, Blue Chip Club, Royal Caribbean, Celebrity Cruises, Carnival, ship names, loyalty programs, and other trademarks are property of their respective owners. Easy Seas is not affiliated with, endorsed by, or sponsored by those cruise lines unless explicitly stated by the owner.
            </Paragraph>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Last Updated: April 2026</Text>
              <Text style={styles.footerText}>© Easy Seas Ventures LLC</Text>
            </View>
          </SectionWithRef>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface SectionWithRefProps {
  id: ManualSectionId;
  title: string;
  children: ReactNode;
  onLayout: (id: ManualSectionId, y: number) => void;
}

function SectionWithRef({ id, title, children, onLayout }: SectionWithRefProps) {
  return (
    <View
      style={styles.section}
      onLayout={(event) => onLayout(id, event.nativeEvent.layout.y)}
      testID={`user-manual-section-${id}`}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.paragraph, style]}>{children}</Text>;
}

function ImportantBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.importantBox}>
      <Text style={styles.importantTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ title, items }: { title?: string; items: string[] }) {
  return (
    <View style={styles.list}>
      {title ? <Text style={styles.listTitle}>{title}</Text> : null}
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listItem}>
          <Text style={styles.numberBullet}>{index + 1}.</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function FeatureList({ items }: { items: FeatureItem[] }) {
  return (
    <View style={styles.featureList}>
      {items.map((item, index) => (
        <View key={`${item.title}-${index}`} style={styles.featureItem}>
          <Text style={styles.featureTitle}>{item.title}</Text>
          <Text style={styles.featureDescription}>{item.description}</Text>
        </View>
      ))}
    </View>
  );
}

function FieldList({ items }: { items: FieldItem[] }) {
  return (
    <View style={styles.fieldList}>
      {items.map((item, index) => (
        <View key={`${item.field}-${index}`} style={styles.fieldItem}>
          <Text style={styles.fieldName}>{item.field}</Text>
          <Text style={styles.fieldDescription}>{item.description}</Text>
        </View>
      ))}
    </View>
  );
}

function ButtonList({ items }: { items: ButtonItem[] }) {
  return (
    <View style={styles.buttonList}>
      {items.map((item, index) => (
        <View key={`${item.button}-${index}`} style={styles.buttonItem}>
          <View style={styles.buttonBadge}>
            <Text style={styles.buttonName}>{item.button}</Text>
          </View>
          <Text style={styles.buttonDescription}>{item.description}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CLEAN_THEME.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? SPACING.lg : SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
    backgroundColor: CLEAN_THEME.background.secondary,
  },
  headerTitleGroup: {
    flex: 1,
  },
  kicker: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.goldDark,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginTop: 2,
  },
  closeButton: {
    padding: SPACING.xs,
    borderRadius: 18,
    backgroundColor: '#EEF4FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  heroCard: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  version: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#BFD9F2',
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.white,
    lineHeight: 30,
    marginBottom: SPACING.sm,
  },
  intro: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#E5F2FF',
    lineHeight: 22,
  },
  tocContainer: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  tocTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  tocSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.md,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
  },
  tocIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FD',
    marginRight: SPACING.sm,
  },
  tocText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyDeep,
  },
  subsection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  subsectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.sm,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  importantBox: {
    backgroundColor: '#FFF8E7',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.goldDark,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  importantTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8A5A00',
    marginBottom: SPACING.sm,
  },
  list: {
    marginBottom: SPACING.md,
  },
  listTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
    marginBottom: SPACING.xs,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  bullet: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    marginRight: SPACING.sm,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  numberBullet: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    marginRight: SPACING.sm,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    minWidth: 24,
  },
  listText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    lineHeight: 22,
  },
  featureList: {
    marginBottom: SPACING.md,
  },
  featureItem: {
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.navyDeep,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  featureDescription: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 20,
  },
  fieldList: {
    marginBottom: SPACING.md,
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  fieldItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
  },
  fieldName: {
    width: 118,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    paddingRight: SPACING.sm,
  },
  fieldDescription: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 18,
  },
  buttonList: {
    marginBottom: SPACING.md,
  },
  buttonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  buttonBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: SPACING.sm,
    minWidth: 88,
    maxWidth: 132,
  },
  buttonName: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    textAlign: 'center',
  },
  buttonDescription: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 18,
    marginTop: 2,
  },
  legal: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  legalBold: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.error,
  },
  footer: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: CLEAN_THEME.border.light,
    alignItems: 'center',
  },
  footerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.xs,
  },
});
