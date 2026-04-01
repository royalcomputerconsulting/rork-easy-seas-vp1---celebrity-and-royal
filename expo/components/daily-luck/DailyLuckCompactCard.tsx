import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ShieldCheck } from 'lucide-react-native';
import type { DailyLuckAnalysisResponse } from '@/types/daily-luck';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface DailyLuckCompactCardProps {
  analysis: DailyLuckAnalysisResponse;
}

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

function formatReadableDate(value: string): string {
  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsedDate = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return parsedDate.toLocaleDateString('en-US', LONG_DATE_OPTIONS);
  }

  return trimmedValue;
}

export const DailyLuckCompactCard = React.memo(function DailyLuckCompactCard({ analysis }: DailyLuckCompactCardProps) {
  const requestedDateText = useMemo(() => formatReadableDate(analysis.date), [analysis.date]);

  return (
    <LinearGradient
      colors={['rgba(10, 28, 49, 0.96)', 'rgba(15, 53, 78, 0.94)', 'rgba(28, 42, 74, 0.92)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <View style={styles.badgeRow}>
            <View style={styles.iconBubble}>
              <Sparkles size={16} color="#F8D56B" />
            </View>
            <Text style={styles.eyebrow}>Daily Luck</Text>
          </View>
          <Text style={styles.dateText}>{requestedDateText}</Text>
          <Text style={styles.label}>{analysis.uiCard.label}</Text>
          <Text style={styles.oneLiner}>{analysis.uiCard.oneLiner}</Text>
        </View>

        <View style={styles.scoreShell} testID="daily-luck-compact-score">
          <Text style={styles.scoreValue}>{analysis.luckScore.toFixed(1)}</Text>
          <Text style={styles.scoreCaption}>/ 9</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.confidencePill}>
          <ShieldCheck size={13} color="#D7F4E4" />
          <Text style={styles.confidenceText}>{Math.round(analysis.confidence * 100)}% confidence</Text>
        </View>
        <Text style={styles.signText}>{analysis.profile.westernSign} • {analysis.profile.chineseSign}</Text>
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...SHADOW.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerCopy: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 10,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,213,107,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(248,213,107,0.22)',
  },
  eyebrow: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.74)',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  dateText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: 'rgba(255,255,255,0.68)',
  },
  label: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  oneLiner: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.8)',
  },
  scoreShell: {
    minWidth: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  scoreValue: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  scoreCaption: {
    marginTop: -2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.7)',
  },
  footerRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(17, 94, 89, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(215,244,228,0.18)',
  },
  confidenceText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D7F4E4',
  },
  signText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textTransform: 'capitalize' as const,
  },
});
