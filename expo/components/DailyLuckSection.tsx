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
  Briefcase,
  Heart,
  Brain,
  TrendingUp,
  Shield,
  Target,
  Hash,
  Flame,
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
import {
  getDetailedWesternReading,
  getDetailedChineseReading,
  getTarotDayArc,
  getFinalLuckCalculation,
} from '@/lib/dailyLuck/detailedReadings';

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

function SectionDivider({ color }: { color: string }) {
  return (
    <View style={[dividerStyles.line, { backgroundColor: `${color}30` }]} />
  );
}

const dividerStyles = StyleSheet.create({
  line: {
    height: 1,
    marginVertical: 10,
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

  const detailedWestern = useMemo(() => getDetailedWesternReading(westernSign, westernScore, selectedDate), [westernSign, westernScore, selectedDate]);
  const detailedChinese = useMemo(() => getDetailedChineseReading(chineseSign, chineseScore, selectedDate), [chineseSign, chineseScore, selectedDate]);
  const tarotDayArc = useMemo(() => getTarotDayArc(selectedDate), [selectedDate]);
  const finalCalc = useMemo(() => getFinalLuckCalculation(westernScore, chineseScore, tarotScore), [westernScore, chineseScore, tarotScore]);

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

      {/* ─── WESTERN ZODIAC ─── */}
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

          {westernExpanded ? (
            <View style={styles.detailedSection}>
              <View style={styles.detailedThemeRow}>
                <Target size={14} color="#7DD3FC" />
                <Text style={styles.detailedThemeLabel}>Core Theme:</Text>
                <Text style={styles.detailedThemeValue}>{detailedWestern.coreTheme}</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedWestern.coreDescription}</Text>

              <SectionDivider color="#7DD3FC" />

              <View style={styles.detailedSubHeader}>
                <Briefcase size={13} color="#7DD3FC" />
                <Text style={styles.detailedSubLabel}>Career / Money</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedWestern.career}</Text>
              <Text style={styles.detailedTranslation}>{detailedWestern.careerTranslation}</Text>

              <SectionDivider color="#7DD3FC" />

              <View style={styles.detailedSubHeader}>
                <Heart size={13} color="#7DD3FC" />
                <Text style={styles.detailedSubLabel}>Relationships</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedWestern.relationships}</Text>
              <Text style={styles.detailedTranslation}>{detailedWestern.relationshipsAdvice}</Text>

              <SectionDivider color="#7DD3FC" />

              <View style={styles.detailedSubHeader}>
                <Brain size={13} color="#7DD3FC" />
                <Text style={styles.detailedSubLabel}>Mental State</Text>
              </View>
              <View style={styles.bulletList}>
                {detailedWestern.mentalState.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.detailedTranslation}>{detailedWestern.mentalSummary}</Text>

              <SectionDivider color="#7DD3FC" />

              <View style={styles.detailedScoreRow}>
                <Text style={styles.detailedScoreLabel}>{toTitleCase(westernSign)} Luck Score:</Text>
                <Text style={[styles.detailedScoreValue, { color: '#7DD3FC' }]}>{westernScore} / 9</Text>
              </View>
              <Text style={styles.detailedScoreCaption}>
                {westernScore >= 7 ? 'Strong energy that rewards decisive, controlled action.' : westernScore >= 4 ? 'Moderate energy, requires control to be effective.' : 'Low energy day. Conserve and protect.'}
              </Text>

              {liveQuery.data?.breakdown?.westernDaily?.reason ? (
                <View style={styles.liveReadingBlock}>
                  <Text style={styles.liveReadingLabel}>Live reading</Text>
                  <Text style={styles.liveReadingBody}>{liveQuery.data.breakdown.westernDaily.reason}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <ScoreBar value={westernScore} color="#7DD3FC" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── CHINESE ZODIAC ─── */}
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

          {chineseExpanded ? (
            <View style={styles.detailedSection}>
              <View style={styles.detailedThemeRow}>
                <Target size={14} color="#F2C66D" />
                <Text style={styles.detailedThemeLabel}>Core Theme:</Text>
                <Text style={[styles.detailedThemeValue, { color: '#F2C66D' }]}>{detailedChinese.coreTheme}</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedChinese.coreDescription}</Text>
              <Text style={[styles.detailedTranslation, { color: '#FBBF24' }]}>{detailedChinese.dangerNote}</Text>

              <SectionDivider color="#F2C66D" />

              <View style={styles.detailedSubHeader}>
                <Briefcase size={13} color="#F2C66D" />
                <Text style={styles.detailedSubLabel}>Work / Structure</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedChinese.workStructure}</Text>
              <Text style={styles.detailedTranslation}>Translation: {detailedChinese.workTranslation}</Text>

              <SectionDivider color="#F2C66D" />

              <View style={styles.detailedSubHeader}>
                <TrendingUp size={13} color="#F2C66D" />
                <Text style={styles.detailedSubLabel}>Money</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedChinese.money}</Text>
              <Text style={styles.detailedTranslation}>{detailedChinese.moneyNote}</Text>

              <SectionDivider color="#F2C66D" />

              <View style={styles.detailedSubHeader}>
                <Heart size={13} color="#F2C66D" />
                <Text style={styles.detailedSubLabel}>Relationships</Text>
              </View>
              <Text style={styles.detailedBody}>{detailedChinese.relationships}</Text>

              <SectionDivider color="#F2C66D" />

              <View style={styles.detailedScoreRow}>
                <Text style={styles.detailedScoreLabel}>{toTitleCase(chineseSign)} Luck Score:</Text>
                <Text style={[styles.detailedScoreValue, { color: '#F2C66D' }]}>{chineseScore} / 9</Text>
              </View>
              <Text style={styles.detailedScoreCaption}>{detailedChinese.closingAdvice}</Text>

              {liveQuery.data?.breakdown?.chineseDaily?.reason ? (
                <View style={styles.liveReadingBlock}>
                  <Text style={styles.liveReadingLabel}>Live reading</Text>
                  <Text style={styles.liveReadingBody}>{liveQuery.data.breakdown.chineseDaily.reason}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <ScoreBar value={chineseScore} color="#F2C66D" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── TAROT READING ─── */}
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
            <View style={styles.detailedSection}>
              <Text style={[styles.detailedSectionTitle, { color: '#C4B5FD' }]}>Full Day Arc</Text>

              {[tarotDayArc.morning, tarotDayArc.midday, tarotDayArc.evening].map((phase, idx) => (
                <View key={idx}>
                  {idx > 0 && <SectionDivider color="#C4B5FD" />}
                  <View style={styles.tarotCardRow}>
                    <View style={styles.tarotCardNumberBadge}>
                      <Text style={styles.tarotCardNumber}>{idx + 1}</Text>
                    </View>
                    <View style={styles.tarotCardContent}>
                      <Text style={styles.tarotCardName}>{phase.card}</Text>
                      <Text style={styles.tarotCardPhase}>{phase.label}</Text>
                    </View>
                  </View>
                  <View style={styles.tarotCardDetail}>
                    <Text style={styles.tarotCardMeaning}>Meaning: {phase.meaning}</Text>
                    <Text style={styles.tarotCardImplication}>Implication: {phase.implication}</Text>
                  </View>
                </View>
              ))}

              <SectionDivider color="#C4B5FD" />

              <View style={styles.detailedScoreRow}>
                <Text style={styles.detailedScoreLabel}>Tarot Luck Score:</Text>
                <Text style={[styles.detailedScoreValue, { color: '#C4B5FD' }]}>{tarotScore} / 9</Text>
              </View>
              <Text style={styles.detailedScoreCaption}>
                {tarotScore >= 7 ? 'Not random luck — this is a controlled outcome day.' : tarotScore >= 4 ? 'Moderate tarot energy — outcomes depend on your choices.' : 'Tarot signals caution — let the cards guide restraint.'}
              </Text>

              <View style={styles.tarotModifierRow}>
                <Text style={styles.tarotModifierLabel}>Luck modifier</Text>
                <Text style={[
                  styles.tarotModifierValue,
                  { color: tarotCard.luckModifier >= 0 ? '#22C55E' : '#F87171' },
                ]}>
                  {tarotCard.luckModifier >= 0 ? '+' : ''}{tarotCard.luckModifier}
                </Text>
              </View>
            </View>
          ) : null}

          <ScoreBar value={tarotScore} color="#C4B5FD" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── FINAL LUCK CALCULATION ─── */}
      <LinearGradient
        colors={['rgba(6,12,28,0.98)', 'rgba(14,24,52,0.97)', 'rgba(20,32,68,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.finalCalcCard}
      >
        <View style={styles.finalCalcHeader}>
          <Flame size={15} color="#F7D469" />
          <Text style={styles.finalCalcTitle}>Final Luck Calculation</Text>
        </View>

        <View style={styles.finalCalcBreakdown}>
          <View style={styles.finalCalcRow}>
            <Text style={styles.finalCalcLabel}>{toTitleCase(westernSign)}:</Text>
            <Text style={[styles.finalCalcValue, { color: '#7DD3FC' }]}>{finalCalc.westernScore}</Text>
          </View>
          <View style={styles.finalCalcRow}>
            <Text style={styles.finalCalcLabel}>{toTitleCase(chineseSign)}:</Text>
            <Text style={[styles.finalCalcValue, { color: '#F2C66D' }]}>{finalCalc.chineseScore}</Text>
          </View>
          <View style={styles.finalCalcRow}>
            <Text style={styles.finalCalcLabel}>Tarot:</Text>
            <Text style={[styles.finalCalcValue, { color: '#C4B5FD' }]}>{finalCalc.tarotScore}</Text>
          </View>
        </View>

        <View style={styles.finalCalcTotalRow}>
          <Text style={styles.finalCalcTotalLabel}>Total:</Text>
          <Text style={styles.finalCalcTotalValue}>{finalCalc.total} / {finalCalc.maxTotal}</Text>
        </View>

        <SectionDivider color="#F7D469" />

        <View style={styles.luckNumberRow}>
          <View style={styles.luckNumberBadge}>
            <Hash size={14} color="#F7D469" />
            <Text style={styles.luckNumberValue}>{finalCalc.luckNumber}</Text>
          </View>
          <View style={styles.luckNumberCopy}>
            <Text style={styles.luckNumberTitle}>Luck Number for the Day</Text>
            <Text style={styles.luckNumberMeaning}>{finalCalc.luckNumberMeaning}</Text>
          </View>
        </View>

        <View style={styles.favorPunishContainer}>
          <View style={styles.favorColumn}>
            <Text style={styles.favorLabel}>It favors:</Text>
            {finalCalc.favors.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: '#22C55E' }]}>•</Text>
                <Text style={[styles.bulletText, { color: '#4ADE80' }]}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={styles.punishColumn}>
            <Text style={styles.punishLabel}>It punishes:</Text>
            {finalCalc.punishes.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: '#F87171' }]}>•</Text>
                <Text style={[styles.bulletText, { color: '#FCA5A5' }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <SectionDivider color="#F7D469" />

        <View style={styles.finalReadHeader}>
          <Shield size={14} color="#F7D469" />
          <Text style={styles.finalReadTitle}>Final Read</Text>
        </View>
        <Text style={styles.finalReadBody}>{finalCalc.finalRead}</Text>
      </LinearGradient>

      {/* ─── PLAY STRATEGY (live only) ─── */}
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
  detailedSection: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  detailedSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: SPACING.sm,
  },
  detailedThemeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailedThemeLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  detailedThemeValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: '#7DD3FC',
  },
  detailedBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 4,
  },
  detailedTranslation: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic' as const,
    marginTop: 4,
    marginBottom: 2,
  },
  detailedSubHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailedSubLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  bulletList: {
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 2,
  },
  bulletDot: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
  },
  bulletText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
  },
  detailedScoreRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailedScoreLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.7)',
  },
  detailedScoreValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
  },
  detailedScoreCaption: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic' as const,
  },
  liveReadingBlock: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  liveReadingLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  liveReadingBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.76)',
  },
  tarotCardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  tarotCardNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(196,181,253,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.3)',
  },
  tarotCardNumber: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
    color: '#C4B5FD',
  },
  tarotCardContent: {
    flex: 1,
  },
  tarotCardName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  tarotCardPhase: {
    fontSize: 11,
    color: 'rgba(196,181,253,0.7)',
    marginTop: 1,
  },
  tarotCardDetail: {
    marginLeft: 40,
    marginBottom: 4,
  },
  tarotCardMeaning: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  tarotCardImplication: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 18,
    color: 'rgba(196,181,253,0.85)',
    fontStyle: 'italic' as const,
  },
  finalCalcCard: {
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(247,212,105,0.18)',
  },
  finalCalcHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 7,
    marginBottom: SPACING.md,
  },
  finalCalcTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: '#F7D469',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  finalCalcBreakdown: {
    gap: 6,
    marginBottom: SPACING.sm,
  },
  finalCalcRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalCalcLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  finalCalcValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
  },
  finalCalcTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  finalCalcTotalLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  finalCalcTotalValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#F7D469',
  },
  luckNumberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  luckNumberBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(247,212,105,0.14)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(247,212,105,0.24)',
  },
  luckNumberValue: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: '800' as const,
    color: '#F7D469',
  },
  luckNumberCopy: {
    flex: 1,
  },
  luckNumberTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  luckNumberMeaning: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  favorPunishContainer: {
    flexDirection: 'row' as const,
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  favorColumn: {
    flex: 1,
  },
  punishColumn: {
    flex: 1,
  },
  favorLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#4ADE80',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  punishLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FCA5A5',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  finalReadHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  finalReadTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: '#F7D469',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  finalReadBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.84)',
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
