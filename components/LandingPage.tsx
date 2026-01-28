import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
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
          <Image 
            source={require('@/assets/images/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>EASY SEAS™</Text>
          
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimer}>
              EasySeas™ is an all-in-one casino cruise management system designed for frequent cruisers and casino loyalty members. The platform automatically imports casino offers, eligible sailings, cruise itineraries, cabin pricing, and expiration dates, then synchronizes this data with personal calendars such as TripIt, Google Calendar, Apple Calendar, and Outlook.
            </Text>

            <Text style={styles.disclaimer}>
              Using artificial intelligence, EasySeas analyzes schedule availability, offer timing, itinerary value, and pricing trends to generate personalized cruise recommendations. Unlike traditional trackers, EasySeas functions as a decision-support platform, helping users identify which cruises best align with their lifestyle, timing, and value objectives.
            </Text>

            <Text style={styles.disclaimer}>
              EasySeas is developed and operated by Royal Computer Consulting and is provided for informational and organizational purposes only. The platform is not affiliated with Royal Caribbean, Celebrity Cruises, or any casino loyalty program.
            </Text>
          </View>

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
    backgroundColor: '#0A1628',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxl,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 48,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
    letterSpacing: 3,
  },
  heroCard: {
    backgroundColor: 'rgba(0, 168, 232, 0.1)',
    borderRadius: 20,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 232, 0.3)',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00D4FF',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: SPACING.lg,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.95,
  },
  featureGrid: {
    marginBottom: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  featureIcon: {
    fontSize: 18,
    color: '#4ECCA3',
    marginRight: SPACING.sm,
    width: 24,
  },
  featureText: {
    fontSize: 15,
    color: COLORS.white,
    flex: 1,
    lineHeight: 22,
  },
  highlightBox: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: '#00D4FF',
  },
  highlightText: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: '#00D4FF',
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionCard: {
    backgroundColor: 'rgba(15, 30, 60, 0.6)',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionIcon: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00D4FF',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  sectionBody: {
    fontSize: 15,
    color: COLORS.white,
    marginBottom: SPACING.md,
    lineHeight: 22,
    opacity: 0.9,
  },
  bulletContainer: {
    marginBottom: SPACING.md,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 24,
    opacity: 0.85,
    paddingLeft: SPACING.sm,
  },
  infoBox: {
    backgroundColor: 'rgba(78, 204, 163, 0.1)',
    borderRadius: 10,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#4ECCA3',
  },
  infoText: {
    fontSize: 14,
    color: COLORS.white,
    marginBottom: 4,
    opacity: 0.9,
  },
  infoTextBold: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: '#4ECCA3',
  },
  calendarGrid: {
    marginBottom: SPACING.md,
  },
  calendarBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  calendarText: {
    fontSize: 14,
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
  },
  questionBox: {
    backgroundColor: 'rgba(138, 43, 226, 0.1)',
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#8A2BE2',
  },
  question: {
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 24,
    opacity: 0.9,
    fontStyle: 'italic' as const,
  },
  ctaCard: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 20,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00D4FF',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  linkContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.white,
    textAlign: 'center',
  },
  ctaTagline: {
    fontSize: 14,
    color: COLORS.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  valueCard: {
    backgroundColor: 'rgba(15, 30, 60, 0.4)',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  valueTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#00D4FF',
    marginBottom: SPACING.md,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  valueBody: {
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 22,
    opacity: 0.9,
    textAlign: 'center',
  },
  valueBodyBold: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: '#4ECCA3',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  clarityBox: {
    alignItems: 'center',
  },
  clarityText: {
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 6,
    opacity: 0.95,
  },
  dividerSmall: {
    width: 40,
    height: 2,
    backgroundColor: '#00D4FF',
    marginVertical: SPACING.sm,
  },
  clarityEmphasis: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#4ECCA3',
  },
  finalCard: {
    backgroundColor: 'rgba(78, 204, 163, 0.15)',
    borderRadius: 20,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 2,
    borderColor: '#4ECCA3',
    alignItems: 'center',
  },
  finalTitle: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#4ECCA3',
    marginBottom: SPACING.lg,
    textAlign: 'center',
    letterSpacing: 1,
  },
  finalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  finalItem: {
    fontSize: 17,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: COLORS.white,
    marginHorizontal: SPACING.xs,
  },
  finalDot: {
    fontSize: 17,
    color: '#4ECCA3',
    marginHorizontal: SPACING.xs,
  },
  finalTagline: {
    fontSize: 15,
    color: COLORS.white,
    textAlign: 'center',
    opacity: 0.9,
    fontStyle: 'italic' as const,
  },
  disclaimerCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.white,
    marginBottom: SPACING.md,
    lineHeight: 18,
    opacity: 0.6,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#00D4FF',
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.md,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  continueButtonText: {
    color: '#0A1628',
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    letterSpacing: 1,
  },
});
