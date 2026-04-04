import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { buildLocalDailyLuckEntry, getDailyLuckDateKey } from '@/lib/dailyLuck';
import type { DailyLuckEntry } from '@/types/daily-luck';

interface DailyLuckReportProps {
  birthdate: string;
  selectedDate: Date;
  entry?: DailyLuckEntry | null;
}

export function DailyLuckReport({ birthdate, selectedDate, entry }: DailyLuckReportProps) {
  const fallbackEntry = useMemo(() => entry ?? buildLocalDailyLuckEntry(birthdate, selectedDate), [birthdate, entry, selectedDate]);

  if (!birthdate.trim()) {
    return (
      <View style={styles.emptyCard} testID="daily-luck-empty-card">
        <LinearGradient colors={['#0D1C36', '#17335C', '#0C5061']} style={styles.emptyGradient}>
          <View style={styles.emptyIconShell}>
            <Sparkles size={20} color="#D4B15A" />
          </View>
          <Text style={styles.emptyTitle}>Daily Luck</Text>
          <Text style={styles.emptyText}>Add your birthdate in Settings → Profile to unlock the live Daily Luck Engine and source-backed score.</Text>
        </LinearGradient>
      </View>
    );
  }

  if (fallbackEntry) {
    return (
      <View style={styles.container} testID="daily-luck-fallback-card">
        <LinearGradient colors={['rgba(13,28,54,0.96)', 'rgba(23,51,92,0.94)', 'rgba(13,93,100,0.88)']} style={styles.fallbackHero}>
          <View style={styles.fallbackBadge}>
            <Sparkles size={14} color="#F8D56B" />
            <Text style={styles.fallbackBadgeText}>Daily Luck</Text>
          </View>
          <Text style={styles.fallbackScore}>{fallbackEntry.luckNumber} / 9</Text>
          <Text style={styles.fallbackTitle}>{fallbackEntry.readings.synthesis}</Text>
          <Text style={styles.fallbackBody}>Your daily luck score based on your birthdate, zodiac signs, and the 2026 Earth Rooster calendar.</Text>
        </LinearGradient>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  emptyCard: {
    marginTop: SPACING.md,
  },
  emptyGradient: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,177,90,0.18)',
  },
  emptyIconShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,177,90,0.14)',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.76)',
  },
  fallbackHero: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...SHADOW.lg,
  },
  fallbackBadge: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fallbackBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  fallbackScore: {
    marginTop: SPACING.md,
    fontSize: 34,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  fallbackTitle: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeMD,
    lineHeight: 22,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D7E9FF',
  },
  fallbackBody: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
  },
});
