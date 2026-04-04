import React, { useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Compass, ExternalLink, Heart, ShieldCheck, Sparkles, Stars, SunMoon } from 'lucide-react-native';
import { GlassSurface } from '@/components/premium/GlassSurface';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { DailyLuckAnalysisResponse, DailyLuckProviderKey, DailyLuckSourceBreakdown } from '@/types/daily-luck';

interface DailyLuckExpandedCardProps {
  analysis: DailyLuckAnalysisResponse;
}

const SOURCE_LABELS: Record<DailyLuckProviderKey, string> = {
  chineseDaily: 'Chinese Daily Horoscope',
  westernDaily: 'Daily Horoscope',
  skyToday: 'The Sky Today',
  loveDaily: 'Love Horoscope',
  yearlyChinese: 'Chinese Yearly Overview',
};

const SOURCE_KICKERS: Record<DailyLuckProviderKey, string> = {
  chineseDaily: 'Chinese sign reading',
  westernDaily: 'Western sign reading',
  skyToday: 'Collective astrology',
  loveDaily: 'Relationship energy',
  yearlyChinese: 'Long-range theme',
};

const SOURCE_ICONS: Record<DailyLuckProviderKey, React.ComponentType<{ size: number; color: string }>> = {
  chineseDaily: Stars,
  westernDaily: SunMoon,
  skyToday: Sparkles,
  loveDaily: Heart,
  yearlyChinese: Compass,
};

const SOURCE_COLORS: Record<DailyLuckProviderKey, string> = {
  chineseDaily: '#F2C66D',
  westernDaily: '#7DD3FC',
  skyToday: '#C4B5FD',
  loveDaily: '#FB7185',
  yearlyChinese: '#34D399',
};

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

const SIGN_LABELS: Record<DailyLuckProviderKey, string> = {
  chineseDaily: 'Chinese',
  westernDaily: 'Western',
  skyToday: 'Collective',
  loveDaily: 'Love',
  yearlyChinese: 'Yearly',
};

function formatReadableDate(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsedDate = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return parsedDate.toLocaleDateString('en-US', LONG_DATE_OPTIONS);
  }

  if (/^\d{4}$/.test(trimmedValue)) {
    return `Year of ${trimmedValue}`;
  }

  if (/^[A-Za-z]+\s+\d{1,2}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const parsedTimestamp = Date.parse(trimmedValue);
  if (!Number.isNaN(parsedTimestamp)) {
    return new Date(parsedTimestamp).toLocaleDateString('en-US', LONG_DATE_OPTIONS);
  }

  return trimmedValue;
}

function resolveSourceDateText(item: DailyLuckSourceBreakdown, requestedDate: string): string {
  const sourceDate = item.sourceDateText || item.visibleDateText || requestedDate;
  const formatted = formatReadableDate(sourceDate);
  if (!formatted) {
    return requestedDate;
  }

  if (/^[A-Za-z]+\s+\d{1,2}$/.test(formatted)) {
    return `${formatted}, ${requestedDate.slice(0, 4)}`;
  }

  return formatted;
}

function cleanSourceTitle(value: string | undefined): string {
  const rawValue = value?.trim() ?? '';
  if (!rawValue) {
    return '';
  }

  return rawValue
    .replace(/\s*-\s*Astrology\.com\s*$/i, '')
    .replace(/^Free\s+/i, '')
    .replace(/\s+Today$/i, '')
    .trim();
}

function cleanSourceBody(value: string | undefined): string {
  const rawValue = value?.trim() ?? '';
  if (!rawValue) {
    return '';
  }

  return rawValue
    .replace(/\bS M T W T F S\b/gi, ' ')
    .replace(/\byesterday\s+today\s+tomorrow\b/gi, ' ')
    .replace(/Read More About Today's Astrology and Upcoming Aspects by the Hour\.?/gi, ' ')
    .replace(/JOIN ASTROLOGY\+/gi, ' ')
    .replace(/If you['’]re ready for love, we['’]re ready for you\.[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSourceBody(item: DailyLuckSourceBreakdown): string {
  const cleanedMainText = cleanSourceBody(item.mainText);
  if (cleanedMainText) {
    return cleanedMainText;
  }

  const cleanedExcerpt = cleanSourceBody(item.excerpt);
  if (cleanedExcerpt) {
    return cleanedExcerpt;
  }

  return item.reason;
}

function toTitleCase(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export const DailyLuckExpandedCard = React.memo(function DailyLuckExpandedCard({ analysis }: DailyLuckExpandedCardProps) {
  const handleOpenUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('[DailyLuckExpandedCard] Failed to open source URL:', error);
    }
  }, []);

  const requestedDateText = useMemo(() => formatReadableDate(analysis.date) ?? analysis.date, [analysis.date]);
  const westernSignText = useMemo(() => toTitleCase(analysis.profile.westernSign), [analysis.profile.westernSign]);
  const chineseSignText = useMemo(() => toTitleCase(analysis.profile.chineseSign), [analysis.profile.chineseSign]);

  return (
    <View style={styles.container} testID="daily-luck-expanded-card">
      <LinearGradient
        colors={['rgba(6, 23, 42, 0.98)', 'rgba(11, 44, 70, 0.96)', 'rgba(28, 33, 67, 0.96)']}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <View style={styles.heroBadge}>
              <Sparkles size={15} color="#F7D469" />
              <Text style={styles.heroBadgeText}>Daily Luck</Text>
            </View>
            <Text style={styles.heroDate}>{requestedDateText}</Text>
            <Text style={styles.heroLabel}>{analysis.uiCard.label}</Text>
            <Text style={styles.heroSummary}>{analysis.summary}</Text>
          </View>
          <View style={styles.heroScoreShell} testID="daily-luck-expanded-score">
            <Text style={styles.heroScore}>{analysis.luckScore.toFixed(1)}</Text>
            <Text style={styles.heroScoreCaption}>/ 9</Text>
            <View style={styles.heroConfidenceRow}>
              <ShieldCheck size={12} color="#D7F4E4" />
              <Text style={styles.heroConfidenceText}>{Math.round(analysis.confidence * 100)}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroTagRow}>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>Western</Text>
            <Text style={styles.heroTagValue}>{westernSignText}</Text>
          </View>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>Chinese</Text>
            <Text style={styles.heroTagValue}>{chineseSignText}</Text>
          </View>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>Style</Text>
            <Text style={styles.heroTagValue}>{analysis.playStyle.strategy}</Text>
          </View>
        </View>
      </LinearGradient>

      <GlassSurface style={styles.overviewCard} contentStyle={styles.overviewCardContent}>
        <Text style={styles.overviewTitle}>Source-backed readings</Text>
        <Text style={styles.overviewBody}>
          The cards below pull the daily Chinese horoscope, daily horoscope, sky report, yearly Chinese overview, and love reading into one agenda section.
        </Text>
      </GlassSurface>

      {analysis.sourceOrder.map((key) => {
        const item = analysis.breakdown[key];
        const Icon = SOURCE_ICONS[key];
        const sourceColor = item.isStale ? '#F59E0B' : SOURCE_COLORS[key];
        const sourceDateText = resolveSourceDateText(item, analysis.date);
        const sourceTitle = cleanSourceTitle(item.title);
        const sourceBody = getSourceBody(item);
        const sourceMeta = [item.author ? `By ${item.author}` : '', item.publishedTime ? item.publishedTime : '']
          .filter(Boolean)
          .join(' • ');

        return (
          <GlassSurface key={key} style={styles.sourceCard} contentStyle={styles.sourceCardContent}>
            <View style={styles.sourceHeader}>
              <View style={styles.sourceHeaderLeft}>
                <View style={[styles.sourceIconWrap, { backgroundColor: `${sourceColor}18`, borderColor: `${sourceColor}28` }]}>
                  <Icon size={17} color={sourceColor} />
                </View>
                <View style={styles.sourceHeaderCopy}>
                  <Text style={styles.sourceKicker}>{SOURCE_KICKERS[key]}</Text>
                  <Text style={styles.sourceLabel}>{SOURCE_LABELS[key]}</Text>
                </View>
              </View>
              <View style={styles.sourceHeaderRight}>
                <View style={styles.sourceDatePill}>
                  <Text style={styles.sourceDateText}>{sourceDateText}</Text>
                </View>
                <View style={styles.sourceScorePill}>
                  <Text style={styles.sourceScoreText}>{item.score}/9</Text>
                </View>
              </View>
            </View>

            <View style={styles.sourceSignalRow}>
              <View style={[styles.signalPill, { backgroundColor: `${sourceColor}12`, borderColor: `${sourceColor}24` }]}>
                <Text style={[styles.signalPillText, { color: sourceColor }]}>{SIGN_LABELS[key]}</Text>
              </View>
              <View style={[styles.signalPill, item.isStale ? styles.signalPillWarning : styles.signalPillFresh]}>
                {item.isStale ? <AlertTriangle size={12} color="#F59E0B" /> : <ShieldCheck size={12} color="#22C55E" />}
                <Text style={[styles.signalPillText, { color: item.isStale ? '#F59E0B' : '#22C55E' }]}>
                  {item.isStale ? 'Date mismatch' : 'Date aligned'}
                </Text>
              </View>
            </View>

            {sourceTitle ? <Text style={styles.sourceTitle}>{sourceTitle}</Text> : null}
            <Text style={styles.sourceBody} testID={`daily-luck-source-body-${key}`}>{sourceBody}</Text>

            <View style={styles.impactCard}>
              <Text style={styles.impactLabel}>Why it moved your luck score</Text>
              <Text style={styles.sourceReason}>{item.reason}</Text>
            </View>

            {sourceMeta ? <Text style={styles.sourceMetaText}>{sourceMeta}</Text> : null}
            {item.errorMessage ? <Text style={styles.sourceError}>{item.errorMessage}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.sourceLinkButton, pressed && styles.sourceLinkButtonPressed]}
              onPress={() => handleOpenUrl(item.sourceUrl)}
              testID={`daily-luck-source-link-${key}`}
            >
              <ExternalLink size={14} color={COLORS.navyDark} />
              <Text style={styles.sourceLinkText}>Open source</Text>
            </Pressable>
          </GlassSurface>
        );
      })}

      <GlassSurface style={styles.readoutCard} contentStyle={styles.readoutContent}>
        <Text style={styles.readoutTitle}>What to do with this</Text>
        <Text style={styles.readoutStrategy}>{analysis.playStyle.strategy}</Text>
        <Text style={styles.readoutText}>{analysis.plainEnglish}</Text>
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  heroCard: {
    borderRadius: 28,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...SHADOW.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  heroCopy: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.78)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  heroDate: {
    marginTop: 14,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: 'rgba(255,255,255,0.72)',
  },
  heroLabel: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  heroSummary: {
    marginTop: 10,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.84)',
  },
  heroScoreShell: {
    width: 104,
    borderRadius: 24,
    paddingVertical: SPACING.md,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroScore: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  heroScoreCaption: {
    marginTop: -4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.68)',
  },
  heroConfidenceRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroConfidenceText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D7F4E4',
  },
  heroTagRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  heroTag: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroTagLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  heroTagValue: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  overviewCard: {
    borderRadius: 22,
  },
  overviewCardContent: {
    padding: SPACING.lg,
  },
  overviewTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  overviewBody: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: '#314861',
  },
  sourceCard: {
    borderRadius: 24,
  },
  sourceCardContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sourceHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sourceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sourceHeaderCopy: {
    flex: 1,
  },
  sourceKicker: {
    fontSize: 11,
    color: COLORS.navyMedium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sourceLabel: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  sourceHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  sourceDatePill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 36, 57, 0.06)',
  },
  sourceDateText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDark,
  },
  sourceScorePill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 36, 57, 0.08)',
  },
  sourceScoreText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  sourceSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  signalPillFresh: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.16)',
  },
  signalPillWarning: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.16)',
  },
  signalPillText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sourceTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  sourceBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: '#203247',
  },
  impactCard: {
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: 'rgba(15, 36, 57, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(15, 36, 57, 0.08)',
  },
  impactLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyMedium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  sourceReason: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: '#314861',
  },
  sourceMetaText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
  },
  sourceError: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.error,
  },
  sourceLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(15,36,57,0.08)',
  },
  sourceLinkButtonPressed: {
    opacity: 0.82,
  },
  sourceLinkText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  readoutCard: {
    borderRadius: 24,
  },
  readoutContent: {
    padding: SPACING.lg,
  },
  readoutTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  readoutStrategy: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 21,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#203247',
  },
  readoutText: {
    marginTop: 10,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: '#314861',
  },
});
