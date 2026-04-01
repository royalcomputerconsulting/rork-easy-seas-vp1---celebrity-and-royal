import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Compass, ExternalLink, Heart, ShieldCheck, Sparkles, Stars, SunMoon } from 'lucide-react-native';
import { GlassSurface } from '@/components/premium/GlassSurface';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { DailyLuckAnalysisResponse, DailyLuckProviderKey } from '@/types/daily-luck';

interface DailyLuckExpandedCardProps {
  analysis: DailyLuckAnalysisResponse;
}

const SOURCE_LABELS: Record<DailyLuckProviderKey, string> = {
  chineseDaily: 'Chinese Daily',
  westernDaily: 'Western Daily',
  skyToday: 'Sky Today',
  loveDaily: 'Love Daily',
  yearlyChinese: 'Chinese Yearly Overview',
};

const SOURCE_ICONS: Record<DailyLuckProviderKey, React.ComponentType<{ size: number; color: string }>> = {
  chineseDaily: Stars,
  westernDaily: SunMoon,
  skyToday: Sparkles,
  loveDaily: Heart,
  yearlyChinese: Compass,
};

export const DailyLuckExpandedCard = React.memo(function DailyLuckExpandedCard({ analysis }: DailyLuckExpandedCardProps) {
  const handleOpenUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('[DailyLuckExpandedCard] Failed to open source URL:', error);
    }
  }, []);

  return (
    <View style={styles.container} testID="daily-luck-expanded-card">
      <LinearGradient
        colors={['rgba(7, 23, 43, 0.98)', 'rgba(10, 49, 76, 0.95)', 'rgba(23, 30, 60, 0.96)']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <View style={styles.heroBadge}>
              <Sparkles size={15} color="#F7D469" />
              <Text style={styles.heroBadgeText}>Live Daily Luck Engine</Text>
            </View>
            <Text style={styles.heroScore}>{analysis.luckScore.toFixed(1)} / 9</Text>
            <Text style={styles.heroLabel}>{analysis.luckLevel}</Text>
            <Text style={styles.heroSummary}>{analysis.summary}</Text>
          </View>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricLabel}>Confidence</Text>
              <View style={styles.confidenceRow}>
                <ShieldCheck size={14} color="#D7F4E4" />
                <Text style={styles.heroMetricValue}>{Math.round(analysis.confidence * 100)}%</Text>
              </View>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricLabel}>Requested Date</Text>
              <Text style={styles.heroMetricValue}>{analysis.date}</Text>
            </View>
          </View>
        </View>

        <GlassSurface style={styles.playStyleShell} contentStyle={styles.playStyleContent}>
          <Text style={styles.playStyleTitle}>{analysis.playStyle.strategy}</Text>
          <Text style={styles.playStyleBody}>Favor {analysis.playStyle.favor.join(', ')}. Avoid {analysis.playStyle.avoid.join(', ')}.</Text>
        </GlassSurface>
      </LinearGradient>

      {analysis.sourceOrder.map((key) => {
        const item = analysis.breakdown[key];
        const Icon = SOURCE_ICONS[key];
        const staleColor = item.isStale ? '#F59E0B' : '#22C55E';

        return (
          <GlassSurface key={key} style={styles.sourceCard} contentStyle={styles.sourceCardContent}>
            <View style={styles.sourceHeader}>
              <View style={styles.sourceHeaderLeft}>
                <View style={[styles.sourceIconWrap, { backgroundColor: `${staleColor}18` }]}>
                  <Icon size={16} color={staleColor} />
                </View>
                <View style={styles.sourceHeaderCopy}>
                  <Text style={styles.sourceLabel}>{SOURCE_LABELS[key]}</Text>
                  <Text style={styles.sourceTone}>{item.tone}</Text>
                </View>
              </View>
              <View style={styles.sourceScorePill}>
                <Text style={styles.sourceScoreText}>{item.score}/9</Text>
              </View>
            </View>

            <Text style={styles.sourceReason}>{item.reason}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Requested</Text>
                <Text style={styles.metaValue}>{analysis.date}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>Detected</Text>
                <Text style={styles.metaValue}>{item.sourceDateText || item.visibleDateText || 'Not detected'}</Text>
              </View>
              <View style={[styles.metaPill, item.isStale ? styles.metaPillWarning : styles.metaPillSuccess]}>
                {item.isStale ? <AlertTriangle size={12} color="#F59E0B" /> : <ShieldCheck size={12} color="#22C55E" />}
                <Text style={[styles.metaValue, { color: staleColor }]}>{item.isStale ? 'Stale source' : 'Date matched or evergreen'}</Text>
              </View>
            </View>

            {item.title ? <Text style={styles.sourceTitle}>{item.title}</Text> : null}
            {item.mainText ? <Text style={styles.sourceBody} numberOfLines={6}>{item.mainText}</Text> : null}
            {item.author || item.publishedTime ? (
              <Text style={styles.sourceMetaText}>
                {item.author ? `By ${item.author}` : 'Author unavailable'}{item.publishedTime ? ` • ${item.publishedTime}` : ''}
              </Text>
            ) : null}
            {item.errorMessage ? <Text style={styles.sourceError}>{item.errorMessage}</Text> : null}

            <Pressable style={styles.sourceLinkButton} onPress={() => handleOpenUrl(item.sourceUrl)} testID={`daily-luck-source-link-${key}`}>
              <ExternalLink size={14} color={COLORS.navyDark} />
              <Text style={styles.sourceLinkText} numberOfLines={1}>{item.sourceUrl}</Text>
            </Pressable>
          </GlassSurface>
        );
      })}

      <GlassSurface style={styles.readoutCard} contentStyle={styles.readoutContent}>
        <Text style={styles.readoutTitle}>Plain-English Readout</Text>
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
    color: 'rgba(255,255,255,0.76)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  heroScore: {
    marginTop: 14,
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -1.2,
  },
  heroLabel: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '700' as const,
    color: '#D7E9FF',
  },
  heroSummary: {
    marginTop: 10,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.82)',
  },
  heroMetrics: {
    width: 138,
    gap: SPACING.sm,
  },
  heroMetricCard: {
    borderRadius: 18,
    padding: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroMetricLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  heroMetricValue: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  playStyleShell: {
    marginTop: SPACING.md,
    borderRadius: 22,
  },
  playStyleContent: {
    padding: SPACING.md,
  },
  playStyleTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#F8FBFF',
  },
  playStyleBody: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(248,251,255,0.82)',
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
    alignItems: 'center',
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceHeaderCopy: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  sourceTone: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyMedium,
    textTransform: 'capitalize' as const,
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
  sourceReason: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: '#203247',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 36, 57, 0.06)',
  },
  metaPillWarning: {
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  metaPillSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyMedium,
  },
  metaValue: {
    fontSize: 11,
    color: COLORS.navyDark,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  sourceTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDark,
  },
  sourceMetaText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
  },
  sourceBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 21,
    color: '#314861',
  },
  sourceError: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.error,
  },
  sourceLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(15,36,57,0.08)',
  },
  sourceLinkText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
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
    marginBottom: 10,
  },
  readoutText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: '#203247',
  },
});
