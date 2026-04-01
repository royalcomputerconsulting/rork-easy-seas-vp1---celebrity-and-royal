import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Stars, SunMoon, ScrollText } from 'lucide-react-native';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildLocalDailyLuckEntry } from '@/lib/dailyLuck';
import { formatBirthdateForDisplay } from '@/lib/date';
import type { DailyLuckEntry } from '@/types/daily-luck';

interface DailyLuckReportProps {
  birthdate: string;
  selectedDate: Date;
  entry?: DailyLuckEntry | null;
}

interface ReadingSectionProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  accentColor: string;
  testID: string;
}

function ReadingSection({ icon, title, body, accentColor, testID }: ReadingSectionProps) {
  return (
    <View style={styles.sectionCard} testID={testID}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconShell, { borderColor: `${accentColor}44`, backgroundColor: `${accentColor}18` }]}>
          {icon}
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export function DailyLuckReport({ birthdate, selectedDate, entry }: DailyLuckReportProps) {
  const fallbackEntry = useMemo(() => buildLocalDailyLuckEntry(birthdate, selectedDate), [birthdate, selectedDate]);
  const resolvedEntry = entry ?? fallbackEntry;
  const birthdateDisplay = useMemo(() => formatBirthdateForDisplay(birthdate), [birthdate]);
  const scoreBreakdown = resolvedEntry?.scoreBreakdown;

  const formattedDate = useMemo(() => (
    selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  ), [selectedDate]);

  if (!birthdateDisplay || !resolvedEntry) {
    return (
      <View style={styles.emptyCard}>
        <LinearGradient colors={['rgba(13, 28, 54, 0.96)', 'rgba(23, 51, 92, 0.94)']} style={styles.emptyGradient}>
          <View style={styles.emptyIconShell}>
            <Sparkles size={20} color="#D4B15A" />
          </View>
          <Text style={styles.emptyTitle}>Daily Luck Report</Text>
          <Text style={styles.emptyText}>
            Add your birthdate in Settings → Profile using MM/DD/YYYY to unlock your Chinese horoscope, Western zodiac and planetary reading, tarot pull, and Lucky Day #.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  const readingSourceLabel = resolvedEntry.source === 'ai' ? 'AI Lucky Day # Synthesis' : 'Lucky Day Summary';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D1C36', '#17335C', '#0C5061']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroIconShell}>
            <Sparkles size={22} color="#D4B15A" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.overline}>Daily Luck Report</Text>
            <Text style={styles.heroTitle}>{formattedDate}</Text>
            <Text style={styles.heroSubtitle}>Saved to your profile and reused across the calendar and day agenda.</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, styles.metricCardPrimary]}>
            <Text style={styles.metricLabel}>Lucky Day #</Text>
            <Text style={styles.metricValue}>{resolvedEntry.luckNumber}</Text>
            <Text style={styles.metricSubvalue}>{resolvedEntry.source === 'ai' ? 'Weighted from AI component scores' : 'Weighted from local component scores'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Chinese</Text>
            <Text style={styles.metricValueSmall}>{resolvedEntry.chineseSign}</Text>
            <Text style={styles.metricSubvalue}>{scoreBreakdown ? `${scoreBreakdown.chinese}/9 score` : 'Birth animal'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Western</Text>
            <Text style={styles.metricValueSmall}>{resolvedEntry.westernSign}</Text>
            <Text style={styles.metricSubvalue}>{scoreBreakdown ? `${scoreBreakdown.western}/9 score` : 'Zodiac sign'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tarot</Text>
            <Text style={styles.metricValueSmall}>{resolvedEntry.tarotCard}</Text>
            <Text style={styles.metricSubvalue}>{scoreBreakdown ? `${scoreBreakdown.tarot}/9 score` : 'Daily card'}</Text>
          </View>
        </View>

        {scoreBreakdown ? (
          <View style={styles.breakdownCard} testID="daily-luck-breakdown-card">
            <Text style={styles.breakdownLabel}>Why this number</Text>
            <Text style={styles.breakdownText}>
              Chinese {scoreBreakdown.chinese}/9 + Western {scoreBreakdown.western}/9 + Tarot {scoreBreakdown.tarot}/9 weighted together = Lucky Day #{resolvedEntry.luckNumber}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      <ReadingSection
        icon={<Stars size={16} color="#D4B15A" />}
        title="Chinese Horoscope"
        body={resolvedEntry.readings.chinese}
        accentColor="#D4B15A"
        testID="daily-luck-chinese-section"
      />

      <ReadingSection
        icon={<SunMoon size={16} color="#60A5FA" />}
        title="Western Zodiac + Planetary Alignments"
        body={resolvedEntry.readings.western}
        accentColor="#60A5FA"
        testID="daily-luck-western-section"
      />

      <ReadingSection
        icon={<ScrollText size={16} color="#A78BFA" />}
        title="Tarot Card Reading"
        body={resolvedEntry.readings.tarot}
        accentColor="#A78BFA"
        testID="daily-luck-tarot-section"
      />

      <View style={styles.sectionCard} testID="daily-luck-synthesis-section">
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconShell, styles.synthesisIconShell]}>
            <Sparkles size={16} color="#34D399" />
          </View>
          <Text style={styles.sectionTitle}>{readingSourceLabel}</Text>
        </View>
        <Text style={styles.sectionBody}>{resolvedEntry.readings.synthesis}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  heroCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 177, 90, 0.22)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  heroIconShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 177, 90, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 177, 90, 0.24)',
  },
  heroTextWrap: {
    flex: 1,
  },
  overline: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D4B15A',
    letterSpacing: 1.6,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    lineHeight: 28,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 84,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metricCardPrimary: {
    backgroundColor: 'rgba(212, 177, 90, 0.14)',
    borderColor: 'rgba(212, 177, 90, 0.32)',
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.1,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D4B15A',
  },
  metricValueSmall: {
    marginTop: 10,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  metricSubvalue: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.66)',
  },
  breakdownCard: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  breakdownLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D4B15A',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  breakdownText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 20,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  synthesisIconShell: {
    borderColor: 'rgba(52, 211, 153, 0.28)',
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
  },
  sectionTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0F172A',
  },
  sectionBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#334155',
    lineHeight: 23,
  },
  emptyCard: {
    marginTop: SPACING.md,
  },
  emptyGradient: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 177, 90, 0.18)',
  },
  emptyIconShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 177, 90, 0.14)',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.74)',
    lineHeight: 22,
  },
});
