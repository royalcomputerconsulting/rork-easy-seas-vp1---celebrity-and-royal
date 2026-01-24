import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface LandingPageProps {
  onContinue: () => void;
}

export function LandingPage({ onContinue }: LandingPageProps) {
  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          <Text style={styles.title}>EASY SEAS™</Text>
          
          <Text style={styles.subtitle}>
            The All-In-One Casino Cruise Management System
          </Text>

          <Text style={styles.tagline}>
            Your AI Casino Host &amp; Cruise Planner — Working 24/7 for You
          </Text>

          <Text style={styles.description}>
            EasySeas™ automatically imports your casino offers, cruises, itineraries, prices, and calendar events — then uses AI to tell you what to book, when to sail, and why.
          </Text>

          <View style={styles.linkContainer}>
            <Text style={styles.linkLabel}>🌐 Live Platform</Text>
            <Text style={styles.link}>https://easy-seas.com</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>🚀 NOT A TRACKER — A DECISION SYSTEM</Text>

          <Text style={styles.bodyText}>
            EasySeas is built for serious cruise-casino players who want clarity instead of chaos.
          </Text>

          <Text style={styles.bulletList}>
            ✔ Imports real Club Royale data{'\n'}
            ✔ Understands your personal schedule{'\n'}
            ✔ Evaluates offer value automatically{'\n'}
            ✔ Uses AI to rank the best cruises for your life
          </Text>

          <Text style={styles.highlight}>
            No spreadsheets.{'\n'}
            No manual work.{'\n'}
            No missed value.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>⚡ ONE-CLICK OFFER INGESTION</Text>

          <Text style={styles.bodyText}>
            EasySeas automatically imports:
          </Text>

          <Text style={styles.bulletList}>
            • All active casino offers{'\n'}
            • Every eligible sailing{'\n'}
            • Cabin pricing (Interior → Suite){'\n'}
            • Full itineraries &amp; ports{'\n'}
            • Offer codes &amp; expiration dates
          </Text>

          <Text style={styles.bodyText}>
            Multiple offers on the same cruise?{'\n'}
            Tracked separately. Always accurate.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>📅 CALENDAR-AWARE PLANNING</Text>

          <Text style={styles.bodyText}>
            EasySeas connects to:
          </Text>

          <Text style={styles.bulletList}>
            🗓 TripIt{'\n'}
            🗓 Google / Apple / Outlook{'\n'}
            🗓 ICS calendars
          </Text>

          <Text style={styles.bodyText}>
            Your life is mapped automatically — so cruises never overlap work, family, or recovery time.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>🤖 AI THAT ANSWERS REAL QUESTIONS</Text>

          <Text style={styles.bodyText}>
            Ask EasySeas:
          </Text>

          <Text style={styles.bulletList}>
            • Which offers fit my schedule next quarter?{'\n'}
            • Which cruises deliver the best ROI?{'\n'}
            • Which ships maximize sea days?
          </Text>

          <Text style={styles.bodyText}>
            Answers are based on your real data, not generic advice.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>✅ START PLANNING INTELLIGENTLY</Text>

          <Text style={styles.finalCTA}>
            🌐 https://easy-seas.com{'\n'}
            EasySeas™ — Because every cruise should be planned intelligently.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>YOUR DATA. YOUR SCHEDULE. SMARTER DECISIONS.</Text>

          <Text style={styles.bodyText}>
            EasySeas imports your real casino offers, pricing, itineraries, and calendar events — then turns them into ranked, actionable recommendations.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>BUILT FOR PLAYERS WHO THINK STRATEGICALLY</Text>

          <Text style={styles.highlight}>
            EasySeas doesn&apos;t give gambling advice.{'\n'}
            It gives clarity.{'\n\n'}
            You decide. EasySeas supports.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>LESS GUESSING. MORE CONTROL.</Text>

          <Text style={styles.bodyText}>
            Stop juggling tabs and spreadsheets.{'\n'}
            Start choosing from intelligent recommendations.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>ONE PLATFORM. TOTAL AWARENESS.</Text>

          <Text style={styles.bodyText}>
            Offers. Cruises. Calendars. Value.{'\n'}
            All working together — automatically.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.disclaimer}>
            EasySeas™ is an all-in-one casino cruise management system designed for frequent cruisers and casino loyalty members. The platform automatically imports casino offers, eligible sailings, cruise itineraries, cabin pricing, and expiration dates, then synchronizes this data with personal calendars such as TripIt, Google Calendar, Apple Calendar, and Outlook.
          </Text>

          <Text style={styles.disclaimer}>
            Using artificial intelligence, EasySeas analyzes schedule availability, offer timing, itinerary value, and pricing trends to generate personalized cruise recommendations. Unlike traditional trackers, EasySeas functions as a decision-support platform, helping users identify which cruises best align with their lifestyle, timing, and value objectives.
          </Text>

          <Text style={styles.disclaimer}>
            EasySeas is developed and operated by Royal Computer Consulting and is provided for informational and organizational purposes only. The platform is not affiliated with Royal Caribbean, Celebrity Cruises, or any casino loyalty program.
          </Text>

          <TouchableOpacity 
            style={styles.continueButton}
            onPress={onContinue}
          >
            <Text style={styles.continueButtonText}>Continue to App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001F54',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxl,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00A8E8',
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 32,
  },
  tagline: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 28,
    opacity: 0.95,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 24,
    opacity: 0.9,
  },
  linkContainer: {
    backgroundColor: 'rgba(0, 168, 232, 0.2)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 232, 0.4)',
  },
  linkLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: '#00A8E8',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  link: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00A8E8',
    marginBottom: SPACING.md,
    lineHeight: 28,
  },
  bodyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.white,
    marginBottom: SPACING.md,
    lineHeight: 24,
    opacity: 0.9,
  },
  bulletList: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.white,
    marginBottom: SPACING.md,
    lineHeight: 26,
    opacity: 0.9,
    paddingLeft: SPACING.sm,
  },
  highlight: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: '#00A8E8',
    marginBottom: SPACING.md,
    lineHeight: 24,
    textAlign: 'center',
  },
  pricingHighlight: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00A8E8',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  finalCTA: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 28,
  },
  disclaimer: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    marginBottom: SPACING.md,
    lineHeight: 20,
    opacity: 0.7,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#00A8E8',
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    letterSpacing: 0.5,
  },
});
