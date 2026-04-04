import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Moon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
  Eye,
  Sun,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { getTrpcClient } from '@/lib/trpc';
import {
  deriveWesternSignFromDate,
  deriveChineseSignFromYear,
  getWesternSignGlyph,
  getChineseSignGlyph,
  getWesternSignDescription,
  getChineseSignDescription,
  toTitleCase,
} from '@/lib/dailyLuck/signs';
import { getTarotCardForDate } from '@/lib/dailyLuck/tarot';
import { getEarthRoosterLuck2026Entry } from '@/constants/earthRoosterLuck2026';

interface DailyLuckSectionProps {
  selectedDate: Date;
}

const LUCK_SCORE_BAR_COLOR: Record<string, string> = {
  High: '#22C55E',
  Good: '#60A5FA',
  Mixed: '#FBBF24',
  Low: '#F87171',
};

function getLuckLevelFromScore(score: number): string {
  if (score >= 8) return 'High';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Mixed';
  return 'Low';
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round((value / 9) * 100);
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});

export function DailyLuckSection({ selectedDate }: DailyLuckSectionProps) {
  const [chineseExpanded, setChineseExpanded] = useState(false);
  const [westernExpanded, setWesternExpanded] = useState(false);
  const [tarotExpanded, setTarotExpanded] = useState(false);

  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const westernSign = useMemo(() => deriveWesternSignFromDate(selectedDate), [selectedDate]);
  const chineseSign = useMemo(() => deriveChineseSignFromYear(selectedDate.getFullYear()), [selectedDate]);
  const tarotCard = useMemo(() => getTarotCardForDate(selectedDate), [selectedDate]);
  const earthRoosterEntry = useMemo(() => getEarthRoosterLuck2026Entry(selectedDate), [selectedDate]);

  const stableBirthDate = useMemo(() => {
    const hash = (selectedDate.getFullYear() * 10000 + (selectedDate.getMonth() + 1) * 100 + selectedDate.getDate()) >>> 0;
    const baseYear = 1950 + (hash % 40);
    const baseMonth = String((hash % 12) + 1).padStart(2, '0');
    const baseDay = String((hash % 28) + 1).padStart(2, '0');
    return `${baseYear}-${baseMonth}-${baseDay}`;
  }, [selectedDate]);

  const liveQuery = useQuery({
    queryKey: ['daily-luck-live', dateKey, westernSign, chineseSign],
    queryFn: async () => {
      const client = getTrpcClient();
      return client.dailyLuck.getLive.query({
        date: dateKey,
        birthDate: stableBirthDate,
        westernSign,
        chineseSign,
      });
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });

  const luckScore = useMemo(() => {
    if (liveQuery.data) return liveQuery.data.luckScore;
    if (earthRoosterEntry) return earthRoosterEntry.luckNumber;
    const seed = (selectedDate.getFullYear() * 100 + selectedDate.getMonth()) * 100 + selectedDate.getDate();
    return Math.max(1, Math.min(9, ((seed * 7 + 3) % 9) + 1));
  }, [liveQuery.data, earthRoosterEntry, selectedDate]);

  const luckLevel = useMemo(() => getLuckLevelFromScore(luckScore), [luckScore]);
  const barColor = LUCK_SCORE_BAR_COLOR[luckLevel] ?? '#60A5FA';

  const chineseScore = useMemo(() => liveQuery.data?.breakdown?.chineseDaily?.score ?? Math.max(1, Math.min(9, luckScore + (tarotCard.luckModifier > 0 ? 1 : 0))), [liveQuery.data, luckScore, tarotCard]);
  const westernScore = useMemo(() => liveQuery.data?.breakdown?.westernDaily?.score ?? luckScore, [liveQuery.data, luckScore]);
  const tarotScore = useMemo(() => Math.max(1, Math.min(9, luckScore + tarotCard.luckModifier)), [luckScore, tarotCard]);

  const synthesis = useMemo(() => {
    if (liveQuery.data?.summary) return liveQuery.data.summary;
    if (earthRoosterEntry) {
      return `2026 Earth Rooster day: ${earthRoosterEntry.color.charAt(0).toUpperCase()}${earthRoosterEntry.color.slice(1)} ${earthRoosterEntry.tone} energy. ${tarotCard.name} amplifies your session with ${tarotCard.casinoReading.split('.')[0]?.toLowerCase() ?? 'its unique energy'}.`;
    }
    return `${luckLevel} day energy. ${tarotCard.name} advises: ${tarotCard.casinoReading.split('.')[0]?.toLowerCase() ?? 'trust your instincts'}.`;
  }, [liveQuery.data, earthRoosterEntry, luckLevel, tarotCard]);

  const handleToggleChinese = useCallback(() => setChineseExpanded(v => !v), []);
  const handleToggleWestern = useCallback(() => setWesternExpanded(v => !v), []);
  const handleToggleTarot = useCallback(() => setTarotExpanded(v => !v), []);

  const westernGlyph = getWesternSignGlyph(westernSign);
  const chineseGlyph = getChineseSignGlyph(chineseSign);
  const westernDesc = getWesternSignDescription(westernSign);
  const chineseDesc = getChineseSignDescription(chineseSign);

  const formattedDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  return (
    <View style={styles.container} testID="daily-luck-section">
      <LinearGradient
        colors={['rgba(6,12,28,0.98)', 'rgba(10,24,54,0.97)', 'rgba(18,28,66,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Sparkles size={13} color="#F7D469" />
            <Text style={styles.heroBadgeText}>Daily Luck Engine</Text>
          </View>
          {liveQuery.isLoading && (
            <View style={styles.liveLoadingBadge}>
              <Zap size={11} color="#60A5FA" />
              <Text style={styles.liveLoadingText}>Live fetch…</Text>
            </View>
          )}
        </View>

        <View style={styles.heroScoreRow}>
          <View style={styles.heroScoreBlock}>
            <Text style={styles.heroScoreValue}>{luckScore}</Text>
            <Text style={styles.heroScoreCaption}>/9</Text>
          </View>
          <View style={styles.heroScoreCopy}>
            <Text style={styles.heroLevelLabel}>{luckLevel} Day</Text>
            <Text style={styles.heroDate}>{formattedDate}</Text>
            <Text style={styles.heroSynthesis} numberOfLines={3}>{synthesis}</Text>
          </View>
        </View>

        <View style={styles.heroBarRow}>
          <ScoreBar value={luckScore} color={barColor} />
        </View>

        {earthRoosterEntry ? (
          <View style={styles.earthRoosterPill}>
            <Text style={styles.earthRoosterText}>
              2026 Earth Rooster · {earthRoosterEntry.color.charAt(0).toUpperCase()}{earthRoosterEntry.color.slice(1)} ({earthRoosterEntry.tone})
            </Text>
          </View>
        ) : null}

        <View style={styles.heroTagRow}>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>Western</Text>
            <Text style={styles.heroTagValue}>{westernGlyph} {toTitleCase(westernSign)}</Text>
          </View>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>Chinese</Text>
            <Text style={styles.heroTagValue}>{chineseGlyph} {toTitleCase(chineseSign)}</Text>
          </View>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagLabel}>Tarot</Text>
            <Text style={styles.heroTagValue} numberOfLines={1}>{tarotCard.name}</Text>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity
        style={styles.zodiacCard}
        onPress={handleToggleChinese}
        activeOpacity={0.82}
        testID="daily-luck-chinese-toggle"
      >
        <LinearGradient
          colors={['rgba(242,198,109,0.14)', 'rgba(242,198,109,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.zodiacGradient}
        >
          <View style={styles.zodiacHeader}>
            <View style={styles.zodiacIconWrap}>
              <Text style={styles.zodiacGlyph}>{chineseGlyph}</Text>
            </View>
            <View style={styles.zodiacHeaderCopy}>
              <Text style={styles.zodiacKicker}>Chinese Zodiac · Year of the {toTitleCase(chineseSign)}</Text>
              <Text style={styles.zodiacTitle}>Chinese Daily Reading</Text>
            </View>
            <View style={styles.zodiacRightGroup}>
              <View style={[styles.zodiacScorePill, { backgroundColor: `${barColor}22` }]}>
                <Text style={[styles.zodiacScoreText, { color: barColor }]}>{chineseScore}/9</Text>
              </View>
              {chineseExpanded
                ? <ChevronUp size={16} color="rgba(255,255,255,0.6)" />
                : <ChevronDown size={16} color="rgba(255,255,255,0.6)" />}
            </View>
          </View>

          <Text style={styles.zodiacPreview} numberOfLines={chineseExpanded ? undefined : 2}>
            {chineseDesc}
          </Text>

          {chineseExpanded && liveQuery.data?.breakdown?.chineseDaily?.reason ? (
            <View style={styles.zodiacExpandedBlock}>
              <Text style={styles.zodiacExpandedLabel}>Live reading</Text>
              <Text style={styles.zodiacExpandedBody}>{liveQuery.data.breakdown.chineseDaily.reason}</Text>
            </View>
          ) : null}

          <ScoreBar value={chineseScore} color="#F2C66D" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.zodiacCard}
        onPress={handleToggleWestern}
        activeOpacity={0.82}
        testID="daily-luck-western-toggle"
      >
        <LinearGradient
          colors={['rgba(125,211,252,0.14)', 'rgba(125,211,252,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.zodiacGradient}
        >
          <View style={styles.zodiacHeader}>
            <View style={styles.zodiacIconWrap}>
              <Text style={styles.zodiacGlyph}>{westernGlyph}</Text>
            </View>
            <View style={styles.zodiacHeaderCopy}>
              <Text style={styles.zodiacKicker}>Western Astrology · {toTitleCase(westernSign)}</Text>
              <Text style={styles.zodiacTitle}>Western Daily Reading</Text>
            </View>
            <View style={styles.zodiacRightGroup}>
              <View style={[styles.zodiacScorePill, { backgroundColor: 'rgba(125,211,252,0.16)' }]}>
                <Text style={[styles.zodiacScoreText, { color: '#7DD3FC' }]}>{westernScore}/9</Text>
              </View>
              {westernExpanded
                ? <ChevronUp size={16} color="rgba(255,255,255,0.6)" />
                : <ChevronDown size={16} color="rgba(255,255,255,0.6)" />}
            </View>
          </View>

          <Text style={styles.zodiacPreview} numberOfLines={westernExpanded ? undefined : 2}>
            {westernDesc}
          </Text>

          {westernExpanded && liveQuery.data?.breakdown?.westernDaily?.reason ? (
            <View style={styles.zodiacExpandedBlock}>
              <Text style={styles.zodiacExpandedLabel}>Live reading</Text>
              <Text style={styles.zodiacExpandedBody}>{liveQuery.data.breakdown.westernDaily.reason}</Text>
            </View>
          ) : null}

          <ScoreBar value={westernScore} color="#7DD3FC" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.zodiacCard}
        onPress={handleToggleTarot}
        activeOpacity={0.82}
        testID="daily-luck-tarot-toggle"
      >
        <LinearGradient
          colors={['rgba(196,181,253,0.14)', 'rgba(196,181,253,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.zodiacGradient}
        >
          <View style={styles.zodiacHeader}>
            <View style={[styles.zodiacIconWrap, styles.tarotIconWrap]}>
              <Eye size={18} color="#C4B5FD" />
            </View>
            <View style={styles.zodiacHeaderCopy}>
              <Text style={styles.zodiacKicker}>Tarot · {tarotCard.arcana === 'major' ? 'Major Arcana' : `${toTitleCase(tarotCard.suit ?? '')} Suit`}</Text>
              <Text style={styles.zodiacTitle}>{tarotCard.name}</Text>
            </View>
            <View style={styles.zodiacRightGroup}>
              <View style={[styles.zodiacScorePill, { backgroundColor: 'rgba(196,181,253,0.16)' }]}>
                <Text style={[styles.zodiacScoreText, { color: '#C4B5FD' }]}>{tarotScore}/9</Text>
              </View>
              {tarotExpanded
                ? <ChevronUp size={16} color="rgba(255,255,255,0.6)" />
                : <ChevronDown size={16} color="rgba(255,255,255,0.6)" />}
            </View>
          </View>

          <View style={styles.tarotMeaningRow}>
            <Moon size={13} color="rgba(196,181,253,0.7)" />
            <Text style={styles.tarotMeaning}>{tarotCard.uprightMeaning}</Text>
          </View>

          <Text style={styles.zodiacPreview} numberOfLines={tarotExpanded ? undefined : 2}>
            {tarotCard.casinoReading}
          </Text>

          {tarotExpanded ? (
            <View style={styles.tarotModifierRow}>
              <Text style={styles.tarotModifierLabel}>Luck modifier</Text>
              <Text style={[
                styles.tarotModifierValue,
                { color: tarotCard.luckModifier >= 0 ? '#22C55E' : '#F87171' },
              ]}>
                {tarotCard.luckModifier >= 0 ? '+' : ''}{tarotCard.luckModifier}
              </Text>
            </View>
          ) : null}

          <ScoreBar value={tarotScore} color="#C4B5FD" />
        </LinearGradient>
      </TouchableOpacity>

      {liveQuery.data ? (
        <LinearGradient
          colors={['rgba(8,20,46,0.98)', 'rgba(14,30,62,0.96)']}
          style={styles.strategyCard}
        >
          <View style={styles.strategyHeader}>
            <Sun size={14} color="#F7D469" />
            <Text style={styles.strategyTitle}>Play Strategy</Text>
            <View style={styles.confidencePill}>
              <Text style={styles.confidenceText}>{Math.round(liveQuery.data.confidence)}% confidence</Text>
            </View>
          </View>
          <Text style={styles.strategyMain}>{liveQuery.data.playStyle.strategy}</Text>
          <Text style={styles.strategyPlain}>{liveQuery.data.plainEnglish}</Text>

          {liveQuery.data.playStyle.favor.length > 0 && (
            <View style={styles.strategyFavorRow}>
              <Text style={styles.strategyFavorLabel}>Favor</Text>
              <View style={styles.strategyPillRow}>
                {liveQuery.data.playStyle.favor.map((item, i) => (
                  <View key={i} style={styles.strategyFavorPill}>
                    <Text style={styles.strategyFavorPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  heroCard: {
    borderRadius: 26,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  heroBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(247,212,105,0.14)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(247,212,105,0.22)',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#F7D469',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.9,
  },
  liveLoadingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  liveLoadingText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  heroScoreRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  heroScoreBlock: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end',
    gap: 3,
  },
  heroScoreValue: {
    fontSize: 54,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 58,
    letterSpacing: -2,
  },
  heroScoreCaption: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: 'rgba(255,255,255,0.56)',
    marginBottom: 6,
  },
  heroScoreCopy: {
    flex: 1,
    paddingTop: 4,
  },
  heroLevelLabel: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  heroDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.64)',
    marginTop: 3,
    marginBottom: 8,
  },
  heroSynthesis: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  heroBarRow: {
    marginTop: SPACING.md,
  },
  earthRoosterPill: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  earthRoosterText: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  heroTagRow: {
    flexDirection: 'row' as const,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  heroTag: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroTagLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.52)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  heroTagValue: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  zodiacCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  zodiacGradient: {
    padding: SPACING.md,
  },
  zodiacHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  zodiacIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tarotIconWrap: {
    backgroundColor: 'rgba(196,181,253,0.12)',
    borderColor: 'rgba(196,181,253,0.2)',
  },
  zodiacGlyph: {
    fontSize: 20,
  },
  zodiacHeaderCopy: {
    flex: 1,
  },
  zodiacKicker: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.52)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  zodiacTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  zodiacRightGroup: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  zodiacScorePill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  zodiacScoreText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
  },
  zodiacPreview: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: SPACING.sm,
  },
  zodiacExpandedBlock: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  zodiacExpandedLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  zodiacExpandedBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.76)',
  },
  tarotMeaningRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  tarotMeaning: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontStyle: 'italic' as const,
    color: 'rgba(196,181,253,0.84)',
  },
  tarotModifierRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  tarotModifierLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.56)',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  tarotModifierValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
  },
  strategyCard: {
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(247,212,105,0.16)',
  },
  strategyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 7,
    marginBottom: SPACING.sm,
  },
  strategyTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  confidencePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  confidenceText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  strategyMain: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D7E9FF',
    marginBottom: 6,
  },
  strategyPlain: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.76)',
  },
  strategyFavorRow: {
    marginTop: SPACING.sm,
  },
  strategyFavorLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  strategyPillRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  strategyFavorPill: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  strategyFavorPillText: {
    fontSize: 11,
    color: '#4ADE80',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
});
