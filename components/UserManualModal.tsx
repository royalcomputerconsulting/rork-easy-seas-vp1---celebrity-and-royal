import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { X, ChevronRight, Download, Chrome, FileText, Calendar, User } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';

interface UserManualModalProps {
  visible: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: 'quick-start', title: 'Quick Start Guide', icon: User },
  { id: 'chrome-extensions', title: 'Chrome Extensions Setup', icon: Chrome },
  { id: 'data-import', title: 'Data Import Methods', icon: Download },
  { id: 'dashboard', title: 'Dashboard Overview', icon: FileText },
  { id: 'analytics', title: 'Analytics & Intelligence', icon: FileText },
  { id: 'machines', title: 'Machine Atlas', icon: FileText },
  { id: 'cruises', title: 'My Cruises', icon: FileText },
  { id: 'events', title: 'Events & Calendar', icon: Calendar },
  { id: 'scheduling', title: 'Scheduling', icon: FileText },
  { id: 'settings', title: 'Settings Page (Complete)', icon: FileText },
  { id: 'loyalty', title: 'Loyalty Programs', icon: FileText },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: FileText },
  { id: 'legal', title: 'Legal & Disclaimer', icon: FileText },
];

export function UserManualModal({ visible, onClose }: UserManualModalProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});

  const scrollToSection = useCallback((sectionId: string) => {
    const yOffset = sectionRefs.current[sectionId];
    if (yOffset !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: yOffset - 60, animated: true });
    }
  }, []);

  const handleSectionLayout = useCallback((sectionId: string, y: number) => {
    sectionRefs.current[sectionId] = y;
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>User Manual</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={COLORS.navyDeep} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.version}>Version 1.0.0 | Build 2025.11</Text>
          
          <Text style={styles.intro}>
            Easy Seas is the premier comprehensive cruise analytics and casino loyalty management platform designed exclusively for Royal Caribbean and Celebrity Cruises enthusiasts. This revolutionary mobile application transforms how cruise passengers track, analyze, and maximize their casino loyalty benefits, onboard credits, and cruise investments.
          </Text>

          <Text style={styles.intro}>
            Built on cutting-edge React Native technology with enterprise-grade analytics, Easy Seas delivers unprecedented insights into your cruise portfolio, enabling data-driven decisions that can save thousands of dollars per year while maximizing loyalty tier advancement and return on investment.
          </Text>

          <View style={styles.tocContainer}>
            <Text style={styles.tocTitle}>Table of Contents</Text>
            <Text style={styles.tocSubtitle}>Tap any section to jump directly to it</Text>
            {SECTIONS.map((section) => (
              <TouchableOpacity
                key={section.id}
                style={styles.tocItem}
                onPress={() => scrollToSection(section.id)}
              >
                <section.icon size={16} color={COLORS.navyDeep} />
                <Text style={styles.tocText}>{section.title}</Text>
                <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
              </TouchableOpacity>
            ))}
          </View>

          <SectionWithRef 
            id="quick-start" 
            title="Quick Start Guide" 
            onLayout={handleSectionLayout}
          >
            <ImportantBox title="What You Need to Get Started">
              <Paragraph>
                After installing and logging in, you only need to enter these 4 pieces of information to get started:
              </Paragraph>
              <NumberedList items={[
                'Your Name - Used for personalization and display',
                'Your Email Address - Used for identification and notifications',
                'Crown & Anchor Loyalty Points - Your cruise loyalty program points (found on Royal Caribbean website)',
                'Club Royale Points - Your casino loyalty program points (found on Club Royale or Blue Chip Club website)',
              ]} />
              <Paragraph>
                Everything else can be imported automatically using the Chrome extensions or by uploading CSV/ICS files.
              </Paragraph>
            </ImportantBox>

            <Subsection title="First Launch">
              <Paragraph>
                When you first open EasySeas, you will see a welcome splash screen. The app requires authentication to ensure your data is secure.
              </Paragraph>
              <BulletList title="Initial Setup Steps:" items={[
                'Sign in with your email (sync requires an active subscription or a whitelisted email)',
                'Complete your user profile in Settings with your name and loyalty points',
                'Import your cruise data using Chrome extensions or CSV files (see Chrome Extensions Setup)',
              ]} />
            </Subsection>

            <Subsection title="Navigation">
              <Paragraph>
                EasySeas uses a tab-based navigation system with 6 main sections:
              </Paragraph>
              <FeatureList items={[
                { title: 'Overview', description: 'Dashboard with offers, certificates, AI assistant, and quick stats' },
                { title: 'Analytics', description: 'Casino sessions, metrics, PPH tracking, and ROI analysis' },
                { title: 'Machines', description: 'Slot machine library with 1000+ machines, favorites, and strategy guides' },
                { title: 'My Cruises', description: 'Booked cruises timeline with financial tracking' },
                { title: 'Events', description: 'Calendar integration with cruise dates and reminders' },
                { title: 'Scheduling', description: 'Cruise scheduling and planning tools' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="chrome-extensions" 
            title="Chrome Extensions Setup" 
            onLayout={handleSectionLayout}
          >
            <ImportantBox title="What is a Chrome Extension?">
              <Paragraph>
                A Chrome extension is a small browser add-on that adds extra buttons and features to websites. This app requires installing TWO Chrome extensions to automatically collect your cruise and casino data. Both extensions are downloaded together when you click &quot;Download Chrome Extension&quot; in Settings.
              </Paragraph>
            </ImportantBox>

            <Subsection title="Extension #1: Grid Builder (Show All Offers)">
              <Paragraph style={styles.highlightParagraph}>
                File: EasySeas_Grid_Builder_Extension_v2.0.zip
              </Paragraph>
              <Paragraph>
                This extension creates the &quot;Show All Offers&quot; button on the Club Royale/Blue Chip Club website. When clicked, this button displays a grid view of ALL your available casino cruise offers at once, instead of having to scroll through them one by one.
              </Paragraph>
              <BulletList title="How to use:" items={[
                'Install this extension first (see Installation Instructions below)',
                'Go to the Club Royale or Blue Chip Club website',
                'Log in to your account',
                'Navigate to your Offers page',
                'Click the &quot;Show All Offers&quot; button that appears',
                'Wait for all offers to load in a grid view',
              ]} />
            </Subsection>

            <Subsection title="Extension #2: Scraper (Scrape Website)">
              <Paragraph style={styles.highlightParagraph}>
                File: EasySeas_Scraper_Extension_v5.6.3.zip
              </Paragraph>
              <Paragraph>
                This extension creates the &quot;Scrape Website&quot; button. This powerful button extracts data from the grid created by Extension #1. It works on different pages depending on where you are on the website:
              </Paragraph>
              
              <FeatureList items={[
                { 
                  title: 'On the Offers Page', 
                  description: 'Scrapes all your casino offers including: cruise details, pricing for all cabin categories, itinerary data, port schedules, included perks, and certificate values. Creates: Offers.csv' 
                },
                { 
                  title: 'On the Courtesy Holds Page', 
                  description: 'Downloads all cruises you have on courtesy hold including: ship names, sailing dates, cabin categories, hold expiration dates. Creates: Offers.csv with courtesy holds' 
                },
                { 
                  title: 'On the Upcoming Cruises Page', 
                  description: 'Downloads all your booked/confirmed cruises including: reservation numbers, booking IDs, guest information, cabin details. Creates: Upcoming / Booked.csv' 
                },
              ]} />
            </Subsection>

            <Subsection title="Installation Instructions">
              <Paragraph style={styles.highlightParagraph}>
                IMPORTANT: You must install BOTH extensions for full functionality!
              </Paragraph>
              <NumberedList items={[
                'Go to Settings → Data Management → Browser Extension section',
                'Click "Download Chrome Extension" - TWO ZIP files will download',
                'Save both ZIP files to your computer (e.g., Desktop or Downloads folder)',
                'Extract/unzip BOTH files to create two separate folders',
                'Open Google Chrome browser',
                'Type chrome://extensions in the address bar and press Enter',
                'Enable "Developer mode" using the toggle switch in the top right corner',
                'Click the "Load unpacked" button',
                'Select the Grid Builder extension folder first (EasySeas_Grid_Builder_Extension)',
                'Click "Load unpacked" again',
                'Select the Scraper extension folder (EasySeas_Scraper_Extension)',
                'Both extension icons will appear in your Chrome toolbar',
              ]} />
            </Subsection>

            <Subsection title="Using the Scrape Website Button">
              <NumberedList items={[
                'Sign in to your Club Royale or Blue Chip Club account',
                'Navigate to the page you want to scrape (Offers, Courtesy Holds, or Upcoming Cruises)',
                'If on Offers page, first click "Show All Offers" to load all offers',
                'Click the "Scrape Website" button added by the extension',
                'Wait 20-30 minutes for scraping to complete (progress shown on screen)',
                'The CSV file will download automatically when complete',
                'Note the number of rows shown - this tells you how many items were scraped',
              ]} />
            </Subsection>

            <Subsection title="Generated CSV Files">
              <Paragraph>
                The Chrome extensions generate these CSV files that can be imported directly into EasySeas:
              </Paragraph>
              <FeatureList items={[
                { title: 'Offers.csv', description: 'Contains all your casino cruise offers with pricing, itineraries, and perks' },
                { title: 'Offers.csv (with booked cruises)', description: 'Same as above but includes cruises you have already booked' },
                { title: 'Offers.csv (with courtesy holds)', description: 'Same as above but includes cruises on courtesy hold' },
                { title: 'Upcoming / Booked.csv', description: 'Your confirmed cruise reservations with booking details' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="data-import" 
            title="Data Import Methods" 
            onLayout={handleSectionLayout}
          >
            <Subsection title="Importing CSV Files">
              <NumberedList items={[
                'Open EasySeas app',
                'Go to Settings tab',
                'Scroll to Data Management section',
                'Under Import, tap "Offers CSV" or "Booked Cruises CSV"',
                'Select the CSV file downloaded from the Chrome extension',
                'Wait for the import confirmation message',
                'Your data will appear in the Overview and My Cruises tabs',
              ]} />
            </Subsection>

            <Subsection title="Calendar Import Options">
              <Paragraph>
                You can enable calendar features using any of these three methods:
              </Paragraph>
              <FeatureList items={[
                { 
                  title: 'Paste a Calendar URL', 
                  description: 'Go to Settings → Import → Calendar URL. Paste a webcal:// or https:// link from Google Calendar, Outlook, or any calendar service. The app will sync events automatically.' 
                },
                { 
                  title: 'Paste a TripIt Browser Link', 
                  description: 'If you use TripIt for travel planning, copy your TripIt calendar link and paste it in the Calendar URL field. All your trips will sync to Events.' 
                },
                { 
                  title: 'Upload an ICS Calendar File', 
                  description: 'Export a .ics file from any calendar application (Apple Calendar, Google Calendar, Outlook). Go to Settings → Import → Calendar (.ics) and select the file.' 
                },
              ]} />
            </Subsection>

            <Subsection title="Full Backup Restore">
              <Paragraph>
                To restore all your data from a previous backup:
              </Paragraph>
              <NumberedList items={[
                'Go to Settings → Data Management → Import',
                'Tap "Restore from Backup"',
                'Select your backup .json file',
                'All data will be restored including: cruises, offers, sessions, certificates, machines, and settings',
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="dashboard" 
            title="Dashboard Overview" 
            onLayout={handleSectionLayout}
          >
            <Paragraph>
              The Overview tab is your command center for cruise offers and casino certificates.
            </Paragraph>

            <Subsection title="Data Overview Card">
              <Paragraph>
                Located at the top of the dashboard, this card shows quick stats at a glance:
              </Paragraph>
              <FieldList items={[
                { field: 'Cruises', description: 'Total number of cruise offers available to you' },
                { field: 'Booked', description: 'Number of cruises you have booked/confirmed' },
                { field: 'Offers', description: 'Number of casino offers with certificates or OBC' },
                { field: 'Events', description: 'Total calendar events imported' },
                { field: 'Machines', description: 'Number of slot machines in your personal atlas' },
              ]} />
            </Subsection>

            <Subsection title="Compact Dashboard Header">
              <Paragraph>
                Shows your loyalty status with visual progress indicators:
              </Paragraph>
              <FieldList items={[
                { field: 'Club Royale Tier', description: 'Your current casino tier (Gold, Prime, Signature, Master) with colored badge' },
                { field: 'Club Royale Points', description: 'Current points and progress bar to next tier' },
                { field: 'Crown & Anchor Level', description: 'Your cruise loyalty level with colored badge' },
                { field: 'Crown & Anchor Points', description: 'Current points and progress bar to next level' },
                { field: 'Days to Next Tier', description: 'Estimated days until tier advancement based on your play rate' },
              ]} />
            </Subsection>

            <Subsection title="Casino Certificates Card">
              <Paragraph>
                Manage your onboard credit certificates:
              </Paragraph>
              <FieldList items={[
                { field: 'Certificate Amount', description: 'Dollar value of the OBC certificate' },
                { field: 'Offer Code', description: 'Unique code to reference the certificate' },
                { field: 'Ship', description: 'Which ship the certificate is valid for' },
                { field: 'Sailing Date', description: 'The cruise date the certificate applies to' },
                { field: 'Expiration Date', description: 'When the certificate expires (cannot be used after)' },
                { field: 'Days Until Expiration', description: 'Countdown showing urgency (yellow = 30 days, red = expired)' },
              ]} />
              <ButtonList items={[
                { button: '+ Add Certificate', description: 'Opens modal to manually add a new certificate' },
                { button: 'Edit (pencil icon)', description: 'Modify an existing certificate' },
                { button: 'Delete (trash icon)', description: 'Remove a certificate from the list' },
              ]} />
            </Subsection>

            <Subsection title="AgentX AI Assistant">
              <Paragraph>
                AI-powered cruise and casino advisor card:
              </Paragraph>
              <FieldList items={[
                { field: 'Chat Input', description: 'Type your question or request here' },
                { field: 'Response Area', description: 'AI responses appear here with cruise recommendations' },
                { field: 'Suggested Questions', description: 'Pre-written questions you can tap to ask' },
              ]} />
              <ButtonList items={[
                { button: 'Send', description: 'Submit your question to the AI' },
                { button: 'Clear', description: 'Clear the conversation history' },
                { button: 'Suggested Question Chips', description: 'Tap to auto-fill common questions' },
              ]} />
            </Subsection>

            <Subsection title="Cruise Offers List">
              <Paragraph>
                Browse and filter your available casino cruise offers:
              </Paragraph>
              <FieldList items={[
                { field: 'Ship Name', description: 'The cruise ship for this offer' },
                { field: 'Sailing Date', description: 'Departure date of the cruise' },
                { field: 'Nights', description: 'Duration of the cruise' },
                { field: 'Itinerary', description: 'Ports of call and destinations' },
                { field: 'Price', description: 'Starting price or price per night depending on settings' },
                { field: 'OBC Amount', description: 'Onboard credit included with this offer' },
                { field: 'Perks', description: 'Included benefits (drinks, wifi, dining, etc.)' },
              ]} />
              <ButtonList items={[
                { button: 'Filter Tabs', description: 'Filter by ship, date range, or value' },
                { button: 'Sort', description: 'Sort by date, price, value, or ship' },
                { button: 'Offer Card', description: 'Tap to view full offer details' },
                { button: 'Heart Icon', description: 'Save offer to favorites' },
              ]} />
            </Subsection>

            <Subsection title="Machine Strategy Card">
              <Paragraph>
                Shows recommended slot machines based on your profile:
              </Paragraph>
              <FieldList items={[
                { field: 'Recommended Machines', description: 'Top picks based on your playing style and preferences' },
                { field: 'AP Rating', description: 'Advantage play rating for each machine' },
                { field: 'Ship Availability', description: 'Which ships have this machine' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="analytics" 
            title="Analytics & Intelligence" 
            onLayout={handleSectionLayout}
          >
            <Paragraph>
              The Analytics tab provides comprehensive casino performance tracking with multiple sub-tabs.
            </Paragraph>

            <Subsection title="Intelligence Sub-Tab">
              <Text style={styles.subHeader}>Casino Metrics Card</Text>
              <Paragraph>
                Displays your overall casino performance statistics:
              </Paragraph>
              <FieldList items={[
                { field: 'Total Sessions', description: 'Number of casino sessions you have logged' },
                { field: 'Total Coin-In', description: 'Sum of all money wagered across all sessions (total play)' },
                { field: 'Total Coin-Out', description: 'Sum of all money returned from machines' },
                { field: 'Net Win/Loss', description: 'Calculation: Coin-Out minus Coin-In. Green = profit, Red = loss' },
                { field: 'Win Rate', description: 'Percentage: (Winning Sessions / Total Sessions) × 100' },
                { field: 'Points Earned', description: 'Total Club Royale points earned from play' },
                { field: 'Average Bet', description: 'Calculation: Total Coin-In / Total Spins' },
                { field: 'Average Session', description: 'Calculation: Total Coin-In / Number of Sessions' },
              ]} />

              <Text style={styles.subHeader}>Casino Intelligence Card</Text>
              <Paragraph>
                Advanced analytics and insights about your play:
              </Paragraph>
              <FieldList items={[
                { field: 'Performance Trend', description: 'Arrow showing if your results are improving or declining over time' },
                { field: 'Best Machine', description: 'The machine with your highest win rate' },
                { field: 'Worst Machine', description: 'The machine with your lowest win rate' },
                { field: 'Best Ship', description: 'Ship where you have the best overall results' },
                { field: 'Peak Hours', description: 'Time of day when you perform best' },
                { field: 'Avg Duration', description: 'Average length of your casino sessions' },
                { field: 'Session Frequency', description: 'How often you play (sessions per cruise day)' },
              ]} />

              <Text style={styles.subHeader}>Gamification Card</Text>
              <Paragraph>
                Achievement tracking and progression system:
              </Paragraph>
              <FieldList items={[
                { field: 'Current Level', description: 'Your gamification level based on activity' },
                { field: 'XP Points', description: 'Experience points earned from logging sessions and achievements' },
                { field: 'XP to Next Level', description: 'Points needed to reach the next level' },
                { field: 'Achievements', description: 'Badges earned for milestones (e.g., "First Jackpot", "100 Sessions")' },
                { field: 'Streak', description: 'Consecutive days with logged activity' },
                { field: 'Challenges', description: 'Active challenges you can complete for bonus XP' },
              ]} />
              <ButtonList items={[
                { button: 'View All Achievements', description: 'Opens full achievement list with progress' },
                { button: 'Claim Reward', description: 'Collect rewards for completed challenges' },
              ]} />

              <Text style={styles.subHeader}>Points Per Hour (PPH) Card</Text>
              <Paragraph>
                Calculates and tracks your points earning rate:
              </Paragraph>
              <FieldList items={[
                { field: 'Current PPH', description: 'Calculation: (Total Points Earned / Total Hours Played)' },
                { field: 'Target PPH', description: 'Your goal PPH rate (editable)' },
                { field: 'PPH Trend', description: 'Graph showing PPH over time' },
                { field: 'Best PPH Session', description: 'Your highest PPH in a single session' },
                { field: 'Average PPH', description: 'Your average PPH across all sessions' },
                { field: '7-Day PPH', description: 'Rolling average over the last 7 days' },
                { field: '30-Day PPH', description: 'Rolling average over the last 30 days' },
              ]} />
              <ButtonList items={[
                { button: 'Set Goal', description: 'Set your target PPH goal' },
                { button: 'View History', description: 'See detailed PPH history chart' },
              ]} />

              <Text style={styles.subHeader}>PPH Calculation Formula</Text>
              <Paragraph style={styles.formula}>
                PPH = (Coin-In × Point Rate) / Session Duration in Hours
              </Paragraph>
              <Paragraph>
                Where Point Rate varies by tier: Gold = 1 point per $10, Prime = 1 point per $8, etc.
              </Paragraph>
            </Subsection>

            <Subsection title="Charts Sub-Tab">
              <Text style={styles.subHeader}>Tier Progression Chart</Text>
              <FieldList items={[
                { field: 'Current Tier', description: 'Your current Club Royale tier displayed' },
                { field: 'Points Progress Bar', description: 'Visual bar showing progress to next tier' },
                { field: 'Points Needed', description: 'Exact points required to reach next tier' },
                { field: 'Projected Date', description: 'Estimated date to reach next tier based on current earning rate' },
                { field: 'Historical Line', description: 'Graph line showing your point accumulation over time' },
              ]} />

              <Text style={styles.subHeader}>ROI Projection Chart</Text>
              <FieldList items={[
                { field: 'Total Value Received', description: 'Sum of all comps, OBC, and perks received' },
                { field: 'Total Losses', description: 'Net gambling losses' },
                { field: 'ROI Percentage', description: 'Calculation: ((Value Received - Losses) / Losses) × 100' },
                { field: 'Projected Annual ROI', description: 'Estimated yearly ROI based on current trends' },
                { field: 'Break-Even Point', description: 'Play amount needed to offset losses with comps' },
              ]} />

              <Text style={styles.subHeader}>Risk Analysis Chart</Text>
              <FieldList items={[
                { field: 'Risk Level', description: 'Low/Medium/High based on your play patterns' },
                { field: 'Volatility Score', description: 'How much your results vary session to session' },
                { field: 'Max Drawdown', description: 'Largest losing streak amount' },
                { field: 'Bankroll Health', description: 'Assessment of your bankroll vs play level' },
              ]} />
            </Subsection>

            <Subsection title="Session Tracking Sub-Tab">
              <Text style={styles.subHeader}>Add Session Modal</Text>
              <Paragraph>
                Full session entry form with all fields:
              </Paragraph>
              <FieldList items={[
                { field: 'Date', description: 'When the session occurred (defaults to today)' },
                { field: 'Ship', description: 'Select which ship you played on' },
                { field: 'Machine Type', description: 'Select the slot machine or game type' },
                { field: 'Denomination', description: 'Coin value (1¢, 5¢, 25¢, $1, $5, etc.)' },
                { field: 'Coin-In', description: 'Total amount wagered during session' },
                { field: 'Coin-Out', description: 'Total amount returned from machine' },
                { field: 'Start Time', description: 'When you started playing' },
                { field: 'End Time', description: 'When you stopped playing' },
                { field: 'Notes', description: 'Optional notes about the session' },
              ]} />
              <ButtonList items={[
                { button: 'Save Session', description: 'Save the session and calculate stats' },
                { button: 'Cancel', description: 'Discard and close modal' },
              ]} />

              <Text style={styles.subHeader}>Quick Win Modal</Text>
              <Paragraph>
                Fast entry for wins/jackpots:
              </Paragraph>
              <FieldList items={[
                { field: 'Amount Won', description: 'The jackpot or win amount' },
                { field: 'Machine', description: 'Which machine paid out' },
                { field: 'W2-G Required', description: 'Toggle if win requires tax form ($1,200+)' },
              ]} />

              <Text style={styles.subHeader}>Sessions List</Text>
              <Paragraph>
                Chronological list of all logged sessions:
              </Paragraph>
              <FieldList items={[
                { field: 'Session Card', description: 'Shows date, machine, coin-in, result' },
                { field: 'Win/Loss Badge', description: 'Green for win, red for loss' },
                { field: 'Duration', description: 'How long the session lasted' },
              ]} />
              <ButtonList items={[
                { button: 'Edit Session', description: 'Modify session details' },
                { button: 'Delete Session', description: 'Remove session from history' },
                { button: 'Filter', description: 'Filter by ship, date, or machine' },
              ]} />
            </Subsection>

            <Subsection title="Calculators Sub-Tab">
              <Text style={styles.subHeader}>W2-G Tax Tracker</Text>
              <Paragraph>
                Track taxable gambling winnings:
              </Paragraph>
              <FieldList items={[
                { field: 'Jackpot Amount', description: 'Enter win amount ($1,200+ requires W2-G)' },
                { field: 'Date Won', description: 'Date of the jackpot' },
                { field: 'Machine/Game', description: 'What you were playing' },
                { field: 'Federal Tax (24%)', description: 'Calculated: Amount × 0.24' },
                { field: 'State Tax', description: 'Varies by state, enter your rate' },
                { field: 'Net After Tax', description: 'Calculation: Amount - Federal Tax - State Tax' },
                { field: 'YTD Total', description: 'Year-to-date total of all W2-G wins' },
                { field: 'YTD Tax Owed', description: 'Total tax liability for the year' },
              ]} />

              <Text style={styles.subHeader}>Comp Value Calculator</Text>
              <Paragraph>
                Calculate expected comp value from your play:
              </Paragraph>
              <FieldList items={[
                { field: 'Coin-In Amount', description: 'Enter how much you plan to play' },
                { field: 'Tier Level', description: 'Your current Club Royale tier' },
                { field: 'Earn Rate', description: 'Points per dollar based on tier' },
                { field: 'Points Earned', description: 'Calculation: Coin-In × Earn Rate' },
                { field: 'Comp Value', description: 'Estimated dollar value of comps' },
                { field: 'RFB Estimate', description: 'Room, Food, Beverage value estimate' },
              ]} />

              <Text style={styles.subHeader}>What-If Simulator</Text>
              <Paragraph>
                Model different playing scenarios:
              </Paragraph>
              <FieldList items={[
                { field: 'Scenario Name', description: 'Name your simulation scenario' },
                { field: 'Hours Per Day', description: 'How many hours you plan to play daily' },
                { field: 'Average Bet', description: 'Your typical bet size' },
                { field: 'Spins Per Hour', description: 'Estimated spins (default: 600)' },
                { field: 'Days Playing', description: 'Number of casino days' },
                { field: 'Projected Coin-In', description: 'Calculation: Hours × Spins × Bet × Days' },
                { field: 'Projected Points', description: 'Expected points to earn' },
                { field: 'Tier Progress', description: 'How close this gets you to next tier' },
              ]} />
              <ButtonList items={[
                { button: 'Run Simulation', description: 'Calculate projected results' },
                { button: 'Save Scenario', description: 'Save for later comparison' },
                { button: 'Compare Scenarios', description: 'Side-by-side scenario comparison' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="machines" 
            title="Machine Atlas" 
            onLayout={handleSectionLayout}
          >
            <Paragraph>
              Your comprehensive slot machine encyclopedia with 1000+ machines.
            </Paragraph>

            <Subsection title="Machine Library">
              <FieldList items={[
                { field: 'Search Bar', description: 'Type to search machines by name' },
                { field: 'Manufacturer Filter', description: 'Filter by Aristocrat, IGT, Konami, Light & Wonder, etc.' },
                { field: 'Ship Filter', description: 'Show only machines on specific ships' },
                { field: 'A-Z Sidebar', description: 'Touch and drag to quickly jump to letter' },
                { field: 'Favorites Toggle', description: 'Show only your favorited machines' },
              ]} />
              <ButtonList items={[
                { button: 'Heart Icon', description: 'Add/remove machine from favorites' },
                { button: 'Machine Card', description: 'Tap to view full details' },
                { button: 'Export Favorites', description: 'Export favorites to Word document' },
              ]} />
            </Subsection>

            <Subsection title="Machine Detail Screen">
              <Paragraph>
                Each machine has a detailed information page:
              </Paragraph>
              <FieldList items={[
                { field: 'Game Name', description: 'Official name of the slot machine' },
                { field: 'Manufacturer', description: 'Company that made the game' },
                { field: 'Denominations', description: 'Available coin values (1¢, 5¢, 25¢, etc.)' },
                { field: 'AP Rating', description: 'Advantage Play rating (1-5 stars)' },
                { field: 'Core Mechanics', description: 'How the game works and features' },
                { field: 'AP Triggers', description: 'What conditions create an advantage situation' },
                { field: 'Walk-Away Rules', description: 'When to stop playing (key for AP)' },
                { field: 'Jackpot Reset Values', description: 'Starting values for progressive jackpots' },
                { field: 'Ship Availability', description: 'List of ships that have this machine' },
                { field: 'Your Sessions', description: 'Your play history on this machine' },
                { field: 'Personal Notes', description: 'Your own notes about the machine' },
              ]} />
              <ButtonList items={[
                { button: 'Add Session', description: 'Log a session on this machine' },
                { button: 'Add to Favorites', description: 'Save to your favorites list' },
                { button: 'Edit Notes', description: 'Add personal notes' },
                { button: 'Share', description: 'Share machine info' },
              ]} />
            </Subsection>

            <Subsection title="Export Options">
              <ButtonList items={[
                { button: 'Export Favorites to Word', description: 'Creates .docx file with all favorites and strategy notes' },
                { button: 'Export All Machines', description: 'Full export (processes incrementally for large datasets)' },
                { button: 'Export JSON', description: 'Backup format for reimporting' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="cruises" 
            title="My Cruises" 
            onLayout={handleSectionLayout}
          >
            <Paragraph>
              Track your booked cruises and view cruise history.
            </Paragraph>

            <Subsection title="Timeline View">
              <FieldList items={[
                { field: 'Status Badge', description: 'Upcoming (blue), In-Progress (green), Completed (gray), Cancelled (red)' },
                { field: 'Ship Image', description: 'Photo of the cruise ship' },
                { field: 'Ship Name', description: 'Name of the vessel' },
                { field: 'Sailing Dates', description: 'Departure and return dates' },
                { field: 'Nights', description: 'Duration of the cruise' },
                { field: 'Countdown', description: 'Days until departure (for upcoming cruises)' },
              ]} />
            </Subsection>

            <Subsection title="Cruise Detail Screen">
              <FieldList items={[
                { field: 'Reservation Number', description: 'Your booking reference number' },
                { field: 'Booking ID', description: 'Internal booking identifier' },
                { field: 'Cabin Category', description: 'Room type (Interior, Ocean View, Balcony, Suite)' },
                { field: 'Cabin Number', description: 'Your assigned cabin' },
                { field: 'Guest Count', description: 'Number of guests on booking' },
                { field: 'Guest Names', description: 'Names of all guests' },
              ]} />
            </Subsection>

            <Subsection title="Financial Tracking">
              <Text style={styles.subHeader}>Price Breakdown</Text>
              <FieldList items={[
                { field: 'Price Paid', description: 'What you actually paid for the cruise' },
                { field: 'Retail Value', description: 'Full price without casino discount' },
                { field: 'Discount Amount', description: 'Calculation: Retail - Paid' },
                { field: 'Discount %', description: 'Calculation: (Discount / Retail) × 100' },
              ]} />

              <Text style={styles.subHeader}>Comp Value Calculation</Text>
              <FieldList items={[
                { field: 'OBC Value', description: 'Total onboard credit included' },
                { field: 'Perks Value', description: 'Estimated value of drink package, wifi, etc.' },
                { field: 'Certificate Value', description: 'Casino certificates applied' },
                { field: 'Total Comp Value', description: 'Sum of all comps and discounts' },
                { field: 'ROI %', description: 'Calculation: (Comp Value / Price Paid) × 100' },
              ]} />

              <Text style={styles.subHeader}>Post-Cruise Tracking</Text>
              <FieldList items={[
                { field: 'Actual Onboard Spend', description: 'Enter total folio amount' },
                { field: 'Casino Winnings', description: 'Enter net casino result' },
                { field: 'Net Profit/Loss', description: 'Calculation: Winnings - Spend + Comp Value' },
                { field: 'Folio Reference', description: 'Store folio number for records' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="events" 
            title="Events & Calendar" 
            onLayout={handleSectionLayout}
          >
            <Paragraph>
              Integrate your personal calendar with cruise planning.
            </Paragraph>

            <Subsection title="Calendar Features">
              <FieldList items={[
                { field: 'Month View', description: 'See full month with cruise dates highlighted' },
                { field: 'Day View', description: 'Detailed schedule for selected day' },
                { field: 'Event Count Badge', description: 'Number of events per day' },
                { field: 'Cruise Days', description: 'Sailing days shown with ship icon' },
                { field: 'Port Days', description: 'Days in port marked differently' },
              ]} />
            </Subsection>

            <Subsection title="Event Types">
              <FieldList items={[
                { field: 'Embarkation', description: 'Cruise departure day' },
                { field: 'Disembarkation', description: 'Cruise return day' },
                { field: 'Port Day', description: 'Day the ship is docked' },
                { field: 'Sea Day', description: 'Day at sea (casino open longer)' },
                { field: 'Final Payment', description: 'Payment deadline reminder' },
                { field: 'Certificate Expiration', description: 'When certificates expire' },
                { field: 'Custom Event', description: 'Events you add manually' },
              ]} />
            </Subsection>

            <ButtonList items={[
              { button: 'Add Event', description: 'Create a new calendar event' },
              { button: 'Import Calendar', description: 'Import .ics file or URL' },
              { button: 'Export Calendar', description: 'Export events to .ics file' },
            ]} />
          </SectionWithRef>

          <SectionWithRef 
            id="scheduling" 
            title="Scheduling" 
            onLayout={handleSectionLayout}
          >
            <Paragraph>
              Plan and optimize your cruise schedule.
            </Paragraph>

            <Subsection title="Filters">
              <FieldList items={[
                { field: 'Ship Filter', description: 'Select specific ships or ship classes' },
                { field: 'Port Filter', description: 'Filter by departure port' },
                { field: 'Region Filter', description: 'Caribbean, Alaska, Europe, etc.' },
                { field: 'Date Range', description: 'Select start and end dates' },
                { field: 'Nights', description: 'Filter by cruise length' },
                { field: 'Price Range', description: 'Set minimum and maximum price' },
              ]} />
            </Subsection>

            <Subsection title="Optimization Features">
              <FieldList items={[
                { field: 'Best Value Sort', description: 'Ranks cruises by comp value vs price' },
                { field: 'Casino Days', description: 'Shows number of casino-open days per cruise' },
                { field: 'Back-to-Back Finder', description: 'Identifies consecutive cruise opportunities' },
                { field: 'Price History', description: 'Shows if current price is high or low' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="settings" 
            title="Settings Page (Complete Guide)" 
            onLayout={handleSectionLayout}
          >
            <ImportantBox title="Settings Overview">
              <Paragraph>
                The Settings page is the control center for all app configuration, data management, and user preferences. Every button and field is documented below.
              </Paragraph>
            </ImportantBox>

            <Subsection title="User Profile Section">
              <Text style={styles.subHeader}>Profile Card</Text>
              <FieldList items={[
                { field: 'Name Input', description: 'Enter your full name. Used for display throughout the app.' },
                { field: 'Email Input', description: 'Your email address. Sync features may require an active subscription or a whitelisted email.' },
                { field: 'Crown & Anchor Number', description: 'Your Royal Caribbean loyalty number (found on your SeaPass card or account)' },
              ]} />
              <ButtonList items={[
                { button: 'Save Profile', description: 'Saves all profile changes to local storage' },
                { button: 'Edit (pencil icon)', description: 'Enter edit mode to modify fields' },
              ]} />

              <Text style={styles.subHeader}>Loyalty Points Card</Text>
              <FieldList items={[
                { field: 'Club Royale Points Input', description: 'Enter your current Club Royale (casino) points. Find this on the Club Royale or Blue Chip Club website under your account.' },
                { field: 'Crown & Anchor Points Input', description: 'Enter your current cruise loyalty points. Find this on the Royal Caribbean website under Crown & Anchor Society.' },
                { field: 'Current Tier Display', description: 'Shows your calculated tier based on points entered' },
                { field: 'Points to Next Tier', description: 'Automatically calculated points needed for advancement' },
              ]} />
              <ButtonList items={[
                { button: 'Save Points', description: 'Saves loyalty points to storage and updates all tier displays' },
              ]} />

              <Text style={styles.subHeader}>Playing Hours Card</Text>
              <Paragraph>
                Configure your preferred casino playing times. This affects casino availability calculations.
              </Paragraph>
              <FieldList items={[
                { field: 'Morning Toggle', description: '6 AM - 12 PM playing preference' },
                { field: 'Afternoon Toggle', description: '12 PM - 6 PM playing preference' },
                { field: 'Evening Toggle', description: '6 PM - 12 AM playing preference' },
                { field: 'Late Night Toggle', description: '12 AM - 6 AM playing preference' },
                { field: 'Port Days Toggle', description: 'Whether you play when ship is in port' },
                { field: 'Sea Days Toggle', description: 'Whether you play on sea days' },
              ]} />
            </Subsection>

            <Subsection title="Display Preferences Section">
              <FieldList items={[
                { field: 'Show Taxes Toggle', description: 'When ON, cruise prices include taxes and fees. When OFF, shows base price only.' },
                { field: 'Price Display', description: 'Choose "Per Night" to see nightly rate or "Total" to see full cruise price' },
                { field: 'Theme Selector', description: 'Choose Light, Dark, or System (follows device setting)' },
              ]} />
            </Subsection>

            <Subsection title="Notifications Section">
              <FieldList items={[
                { field: 'Price Drop Alerts', description: 'Get notified when cruise prices decrease' },
                { field: 'Daily Summary', description: 'Receive daily digest of offers and status' },
                { field: 'Tier Milestone Alerts', description: 'Notification when approaching tier advancement' },
                { field: 'Certificate Expiration', description: 'Warning before certificates expire' },
              ]} />
            </Subsection>

            <Subsection title="Data Management Section">
              <ImportantBox title="Import Options">
                <Paragraph>
                  These buttons import data INTO the app:
                </Paragraph>
              </ImportantBox>
              <ButtonList items={[
                { button: 'Offers CSV', description: 'Import casino cruise offers from the Chrome extension. Select the Offers.csv file downloaded from Club Royale website.' },
                { button: 'Booked Cruises CSV', description: 'Import your booked/confirmed cruises. Select the Upcoming.csv or Booked.csv file from Chrome extension.' },
                { button: 'Calendar (.ics)', description: 'Import calendar events from any .ics file exported from your calendar app.' },
                { button: 'Calendar URL', description: 'Paste a webcal:// or https:// calendar link (Google Calendar, TripIt, etc.)' },
                { button: 'Machines (.json)', description: 'Import slot machine data from a JSON backup file.' },
                { button: 'Restore from Backup', description: 'FULL RESTORE: Import complete app backup including all data, settings, and preferences.' },
              ]} />

              <ImportantBox title="Export Options">
                <Paragraph>
                  These buttons export data FROM the app:
                </Paragraph>
              </ImportantBox>
              <ButtonList items={[
                { button: 'Offers CSV', description: 'Export your current offers to CSV file for backup or sharing.' },
                { button: 'Booked Cruises CSV', description: 'Export your booked cruises list to CSV file.' },
                { button: 'Calendar (.ics)', description: 'Export all events to .ics file that can be imported into any calendar app.' },
                { button: 'Machines (.json)', description: 'Export your machine atlas with notes and favorites.' },
                { button: 'Export All App Data', description: 'FULL BACKUP: Creates complete backup file with ALL data. Use this regularly!' },
              ]} />

              <ImportantBox title="Quick Actions">
                <Paragraph>
                  Convenient shortcuts for common operations:
                </Paragraph>
              </ImportantBox>
              <ButtonList items={[
                { button: 'Save All', description: 'Quick one-tap export of all data to backup file.' },
                { button: 'Load Backup', description: 'Quick one-tap restore from backup file.' },
                { button: 'Import CSV', description: 'Generic CSV import with auto-detection.' },
              ]} />

              <ImportantBox title="Danger Zone">
                <Paragraph style={styles.dangerText}>
                  CAUTION: These actions cannot be undone!
                </Paragraph>
              </ImportantBox>
              <ButtonList items={[
                { button: 'Reset All Data (red)', description: 'PERMANENTLY DELETES all app data. Export backup first! Use only to start fresh.' },
                { button: 'Clear Sessions', description: 'Deletes all casino session history.' },
                { button: 'Clear Certificates', description: 'Removes all stored certificates.' },
              ]} />
            </Subsection>

            <Subsection title="Browser Extension Section">
              <ButtonList items={[
                { button: 'Download Chrome Extension', description: 'Downloads the ZIP file containing the Scrape Website extension. See Chrome Extension Setup section for installation instructions.' },
                { button: 'CR LINK', description: 'Opens or downloads the Show All Offers extension from the Chrome Web Store or direct link.' },
                { button: 'Download Booking CSV Template', description: 'Downloads a blank CSV template showing the exact format required for manual booking imports.' },
              ]} />
            </Subsection>

            <Subsection title="Support Section">
              <ButtonList items={[
                { button: 'Help Center', description: 'Opens getting started guide and FAQ.' },
                { button: 'User Manual', description: 'Opens this comprehensive user manual.' },
                { button: 'Privacy Policy', description: 'View the app privacy policy.' },
                { button: 'Contact Support', description: 'Get help from Royal Computer Consulting.' },
              ]} />
            </Subsection>

            <Subsection title="Admin Section (Admin Only)">
              <Paragraph>
                These features only appear for admin users:
              </Paragraph>
              <ButtonList items={[
                { button: 'Add Email to Whitelist', description: 'Enter an email address to grant app access to a new user.' },
                { button: 'Remove from Whitelist', description: 'Revoke access for a user (cannot remove admin email).' },
                { button: 'View Whitelist', description: 'See all authorized email addresses.' },
              ]} />
            </Subsection>

            <Subsection title="Data Recovery Section">
              <ButtonList items={[
                { button: 'Restore Mock Data', description: 'Resets completed cruises to demo data. Useful for testing or if data becomes corrupted.' },
              ]} />
            </Subsection>

            <Subsection title="About Section">
              <FieldList items={[
                { field: 'App Version', description: 'Current version number (e.g., 1.0.0)' },
                { field: 'Build Number', description: 'Build identifier (e.g., 2025.11)' },
              ]} />
              <ButtonList items={[
                { button: 'View Changelog', description: 'See what changed in recent updates.' },
                { button: 'Legal Disclaimer', description: 'View full legal disclaimer and liability notice.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="loyalty" 
            title="Loyalty Programs" 
            onLayout={handleSectionLayout}
          >
            <Subsection title="Club Royale (Casino Loyalty)">
              <Paragraph>
                Casino tier progression system:
              </Paragraph>
              <FieldList items={[
                { field: 'Gold', description: '0 - 2,499 points. Entry level with basic benefits.' },
                { field: 'Prime', description: '2,500 - 9,999 points. Enhanced comp offers, priority check-in, exclusive events.' },
                { field: 'Signature', description: '10,000 - 34,999 points. Premium accommodations, higher comp values, personalized service.' },
                { field: 'Master', description: '35,000+ points. Complimentary cruises, suite upgrades, maximum benefits.' },
              ]} />
              <Text style={styles.subHeader}>Points Earning</Text>
              <Paragraph>
                Points are earned based on coin-in (total wagers). The earn rate varies by tier and is approximately 1 point per $5-$10 of coin-in.
              </Paragraph>
            </Subsection>

            <Subsection title="Crown & Anchor Society (Cruise Loyalty)">
              <Paragraph>
                Cruise night progression system:
              </Paragraph>
              <FieldList items={[
                { field: 'Gold', description: '1-29 nights. Entry level.' },
                { field: 'Platinum', description: '30-54 nights. Priority check-in, behind-the-scenes tours.' },
                { field: 'Emerald', description: '55-79 nights. Balcony discount, complimentary pressing.' },
                { field: 'Diamond', description: '80-174 nights. Premium seating, specialty dining discount.' },
                { field: 'Diamond Plus', description: '175-699 nights. Enhanced suite benefits, exclusive events.' },
                { field: 'Pinnacle Club', description: '700+ nights. Highest status with all premium benefits.' },
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="troubleshooting" 
            title="Troubleshooting" 
            onLayout={handleSectionLayout}
          >
            <Subsection title="Data Not Showing After Import">
              <NumberedList items={[
                'Check that the import success message appeared',
                'Switch to another tab and back to refresh the view',
                'Force close the app completely and reopen',
                'Go to Settings → Data Overview to verify counts',
                'Try exporting and re-importing using Restore from Backup',
              ]} />
            </Subsection>

            <Subsection title="Chrome Extension Buttons Not Appearing">
              <NumberedList items={[
                'Refresh the Royal Caribbean/Club Royale page',
                'Verify the extension is enabled in chrome://extensions',
                'Make sure you are on the correct page (Offers, Holds, or Upcoming)',
                'Temporarily disable other extensions that might conflict',
                'Try using Chrome Incognito mode',
              ]} />
            </Subsection>

            <Subsection title="Points/Tier Not Updating">
              <NumberedList items={[
                'Manually update points in Settings → User Profile → Loyalty Points',
                'Tap Save to confirm changes',
                'Verify your casino sessions have coin-in amounts entered',
                'Switch tabs to refresh calculations',
              ]} />
            </Subsection>

            <Subsection title="App Running Slowly">
              <NumberedList items={[
                'Clear expired offers using Data Management',
                'Archive old completed cruises',
                'Close any open modals',
                'Restart the app',
                'If on web, clear browser cache',
              ]} />
            </Subsection>

            <Subsection title="Cannot Log In">
              <NumberedList items={[
                'Verify your email is on the whitelist (or activate a subscription)',
                'Check your internet connection',
                'Try a different browser if using web version',
                'Clear browser cookies and cache',
                'Request whitelist verification from admin (or activate a subscription)',
              ]} />
            </Subsection>
          </SectionWithRef>

          <SectionWithRef 
            id="legal" 
            title="Legal & Disclaimer" 
            onLayout={handleSectionLayout}
          >
            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Liability Disclaimer:</Text> This application is provided for informational and entertainment purposes only. The creator of this application, Royal Computer Consulting, Scott Merlis, and any associated parties expressly disclaim all liability for any actions, decisions, or consequences resulting from the use of this application. Users assume all responsibility and risk associated with the use of this software.
            </Paragraph>
            
            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Not Gambling Advice:</Text> This application is not intended to be, nor should it be construed as, a gambling manual, guide, or instructional material. It does not provide gambling advice, strategies, or recommendations.
            </Paragraph>
            
            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Problem Gambling Resources:</Text> If you or someone you know has a gambling problem, please seek help immediately: National Council on Problem Gambling: 1-800-522-4700, Gamblers Anonymous: www.gamblersanonymous.org
            </Paragraph>

            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>AS IS Software:</Text> This application is provided &quot;AS IS&quot; without warranty of any kind. You use this application entirely at your own risk and discretion. No representations, warranties, or guarantees are made regarding the accuracy, reliability, completeness, or timeliness of any information provided.
            </Paragraph>

            <Paragraph style={styles.legal}>
              <Text style={styles.legalBold}>Trademark Notice:</Text> All trademarks, service marks, trade names, trade dress, product names, ship names, and logos appearing in this application, including but not limited to &quot;Club Royale,&quot; &quot;Blue Chip Club,&quot; &quot;Royal Caribbean,&quot; &quot;Celebrity Cruises,&quot; and all associated cruise ship names, are the property of their respective owners. The creator and operator of this application, Royal Computer Consulting and Scott Merlis, have no affiliation, association, authorization, endorsement, or sponsorship with or by Royal Caribbean International, Celebrity Cruises, or any of their parent companies, subsidiaries, or affiliates.
            </Paragraph>
          </SectionWithRef>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Last Updated: January 2026</Text>
            <Text style={styles.footerText}>App Version: 1.0.0 | Build: 2025.11</Text>
            <Text style={styles.copyright}>© 2025 Royal Computer Consulting, LLC. All rights reserved.</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface SectionWithRefProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onLayout: (id: string, y: number) => void;
}

function SectionWithRef({ id, title, children, onLayout }: SectionWithRefProps) {
  return (
    <View 
      style={styles.section}
      onLayout={(event) => onLayout(id, event.nativeEvent.layout.y)}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.paragraph, style]}>{children}</Text>;
}

function ImportantBox({ title, children }: { title: string; children: React.ReactNode }) {
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
      {title && <Text style={styles.listTitle}>{title}</Text>}
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
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
        <View key={index} style={styles.listItem}>
          <Text style={styles.numberBullet}>{index + 1}.</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

interface Feature {
  title: string;
  description: string;
}

function FeatureList({ items }: { items: Feature[] }) {
  return (
    <View style={styles.featureList}>
      {items.map((item, index) => (
        <View key={index} style={styles.featureItem}>
          <Text style={styles.featureTitle}>{item.title}</Text>
          <Text style={styles.featureDescription}>{item.description}</Text>
        </View>
      ))}
    </View>
  );
}

interface FieldItem {
  field: string;
  description: string;
}

function FieldList({ items }: { items: FieldItem[] }) {
  return (
    <View style={styles.fieldList}>
      {items.map((item, index) => (
        <View key={index} style={styles.fieldItem}>
          <Text style={styles.fieldName}>{item.field}</Text>
          <Text style={styles.fieldDescription}>{item.description}</Text>
        </View>
      ))}
    </View>
  );
}

interface ButtonItem {
  button: string;
  description: string;
}

function ButtonList({ items }: { items: ButtonItem[] }) {
  return (
    <View style={styles.buttonList}>
      {items.map((item, index) => (
        <View key={index} style={styles.buttonItem}>
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
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
    backgroundColor: CLEAN_THEME.background.secondary,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  version: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  intro: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  tocContainer: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: 12,
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
  tocText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    marginLeft: SPACING.sm,
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
  subHeader: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  highlightParagraph: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    backgroundColor: '#E8F4FD',
    padding: SPACING.sm,
    borderRadius: 6,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  formula: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#F5F5F5',
    padding: SPACING.sm,
    borderRadius: 6,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  importantBox: {
    backgroundColor: '#FFF8E7',
    borderLeftWidth: 4,
    borderLeftColor: '#F5A623',
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  importantTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#B7791F',
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
    paddingLeft: SPACING.sm,
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
    borderRadius: 8,
    padding: SPACING.sm,
  },
  fieldItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
  },
  fieldName: {
    width: 120,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
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
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: SPACING.sm,
    minWidth: 80,
  },
  buttonName: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
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
  dangerText: {
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  footer: {
    marginTop: SPACING.xl,
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
  copyright: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: SPACING.sm,
  },
});
