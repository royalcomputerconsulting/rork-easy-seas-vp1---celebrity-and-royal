import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Sparkles, Star, Sun } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { LuckInfo } from '@/constants/luckScores';

interface LuckReportSectionProps {
  selectedDate: Date;
  birthdate?: string;
  name?: string;
  dayLuck?: LuckInfo | null;
}

interface TarotCard {
  name: string;
  energy: string;
  gift: string;
  caution: string;
}

const CHINESE_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'] as const;

const TAROT_CARDS: TarotCard[] = [
  {
    name: 'The Star',
    energy: 'renewal, calm confidence, and clear guidance',
    gift: 'It favors trusting your own timing and following the quiet signal that already feels true.',
    caution: 'Do not dilute the moment by scattering your attention across too many options.',
  },
  {
    name: 'The Sun',
    energy: 'visibility, warmth, and easy momentum',
    gift: 'This card amplifies magnetic confidence, social ease, and fortunate timing around conversations.',
    caution: 'Let joy stay simple instead of trying to force a perfect outcome.',
  },
  {
    name: 'Wheel of Fortune',
    energy: 'turning points, chance meetings, and sudden openings',
    gift: 'It suggests the day works best when you stay flexible enough to catch an unexpected break.',
    caution: 'Avoid pressing too hard when the rhythm asks for patience.',
  },
  {
    name: 'The Empress',
    energy: 'abundance, pleasure, and receptive attraction',
    gift: 'It supports comfort, beauty, indulgence, and saying yes to what genuinely nourishes you.',
    caution: 'Do not confuse excess with flow.',
  },
  {
    name: 'The Magician',
    energy: 'focus, manifestation, and personal influence',
    gift: 'Your words and decisions carry extra force today, so clear intention can turn into quick results.',
    caution: 'Stay precise because mixed signals weaken the spell.',
  },
  {
    name: 'Strength',
    energy: 'steady courage, composure, and emotional control',
    gift: 'This is a strong card for poise under pressure and quietly winning the long game.',
    caution: 'Gentle discipline works better than force.',
  },
  {
    name: 'The High Priestess',
    energy: 'intuition, private knowing, and hidden information',
    gift: 'It asks you to trust subtle cues, body wisdom, and what you sense before you can explain it.',
    caution: 'You do not need to reveal every move too early.',
  },
  {
    name: 'The World',
    energy: 'completion, harmony, and elegant timing',
    gift: 'It favors tying things together, closing loops, and stepping into a fuller sense of readiness.',
    caution: 'Let endings land instead of reopening what is already complete.',
  },
];

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseBirthdate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getWesternZodiac(date: Date): string {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

function getChineseZodiac(year: number): string {
  const normalizedIndex = ((year - 1900) % 12 + 12) % 12;
  return CHINESE_ANIMALS[normalizedIndex] ?? 'Dragon';
}

function getTarotCard(selectedDate: Date, birthdate?: string): TarotCard {
  const source = `${getDateKey(selectedDate)}-${birthdate ?? 'unknown'}`;
  const seed = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TAROT_CARDS[seed % TAROT_CARDS.length] ?? TAROT_CARDS[0];
}

function getPrimaryName(name?: string): string {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return 'You';
  }

  return trimmedName.split(' ')[0] || 'You';
}

function formatBirthday(date: Date | null): string {
  if (!date) {
    return 'Birthday not added yet';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getLuckHeadline(dayLuck?: LuckInfo | null): string {
  if (!dayLuck) {
    return 'Neutral current';
  }

  if (dayLuck.score >= 8) {
    return 'This is a green-light day.';
  }

  if (dayLuck.score >= 5) {
    return 'There is good usable luck in the air.';
  }

  if (dayLuck.score >= 3) {
    return 'The day is workable, but timing matters.';
  }

  return 'Move slowly and protect your energy today.';
}

function getLuckAction(dayLuck?: LuckInfo | null): string {
  if (!dayLuck) {
    return 'Keep plans flexible, say yes selectively, and let the day reveal its best opening instead of chasing it.';
  }

  if (dayLuck.score >= 8) {
    return 'Use the strongest windows for bold plans, social visibility, important asks, and any move that benefits from confidence plus timing.';
  }

  if (dayLuck.score >= 5) {
    return 'Lean into steady forward motion, comfortable conversations, and well-chosen moments rather than all-or-nothing plays.';
  }

  if (dayLuck.score >= 3) {
    return 'Stay observant, avoid overcommitting, and let practical choices beat emotional impulses.';
  }

  return 'Protect your bankroll, your time, and your mood. Today rewards restraint far more than force.';
}

export function LuckReportSection({ selectedDate, birthdate, name, dayLuck }: LuckReportSectionProps) {
  const report = useMemo(() => {
    const birthDateValue = parseBirthdate(birthdate);
    const primaryName = getPrimaryName(name);
    const birthAnimal = birthDateValue ? getChineseZodiac(birthDateValue.getUTCFullYear()) : 'Unknown';
    const currentAnimal = getChineseZodiac(selectedDate.getUTCFullYear());
    const zodiacSign = birthDateValue ? getWesternZodiac(birthDateValue) : 'your sign';
    const tarotCard = getTarotCard(selectedDate, birthdate);
    const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    console.log('[LuckReportSection] Building report', {
      date: getDateKey(selectedDate),
      hasBirthdate: Boolean(birthDateValue),
      zodiacSign,
      birthAnimal,
      currentAnimal,
      tarotCard: tarotCard.name,
      luckScore: dayLuck?.score ?? null,
    });

    const chineseReading = birthDateValue
      ? `${primaryName}, your birthday on ${formatBirthday(birthDateValue)} places you under the ${birthAnimal} in the Chinese zodiac, while today moves with ${currentAnimal} year energy. That combination says ${monthName} should be approached with a mix of instinct and timing: trust what immediately feels aligned, but only act once the atmosphere settles. The Chinese calendar reading for ${weekday} favors emotional intelligence, soft observation, and letting opportunities come toward you instead of forcing them.`
      : `${primaryName}, today carries ${currentAnimal} year energy through the Chinese calendar. Even without a birthday stored in your profile, this reading points toward strategic patience, social awareness, and staying responsive to subtle openings. The best results arrive when you remain calm first and decisive second.`;

    const westernReading = birthDateValue
      ? `Your western zodiac sign is ${zodiacSign}, and today’s horoscope reads like a spotlight on your natural rhythm. ${zodiacSign} energy is strongest when you stop second-guessing yourself and move with the kind of confidence that looks effortless from the outside. On ${weekday}, your best moments come from conversations, invitations, and decisions that feel both clean and self-respecting rather than rushed.`
      : `Your western zodiac reading is waiting on a saved birthday, but the day’s horoscope still points to a clear theme: move with discernment, protect your attention, and give your best energy to what actually feels promising. ${weekday} rewards self-trust more than over-analysis.`;

    const tarotReading = `Your tarot card for today is ${tarotCard.name}, a card of ${tarotCard.energy}. Interpreted personally for you, it says the day opens most cleanly when you honor what already feels intuitively right rather than chasing noise. ${tarotCard.gift} ${tarotCard.caution}`;

    const ratingReading = `${getLuckHeadline(dayLuck)} Your lucky day rating lands at ${dayLuck?.score ?? 5} out of 10, carrying a ${dayLuck?.label?.toLowerCase() ?? 'steady'} tone on the luck scale. ${getLuckAction(dayLuck)}`;

    return {
      birthdayLabel: formatBirthday(birthDateValue),
      birthAnimal,
      currentAnimal,
      zodiacSign,
      tarotCard,
      chineseReading,
      westernReading,
      tarotReading,
      ratingReading,
    };
  }, [birthdate, dayLuck, name, selectedDate]);

  const luckColor = dayLuck?.hex ?? COLORS.gold;
  const luckLabel = dayLuck?.label ?? 'Balanced';
  const luckScore = String(dayLuck?.score ?? 5);

  return (
    <View style={styles.container} testID="luck-report-section">
      <LinearGradient
        colors={['rgba(255,226,143,0.18)', 'rgba(0,172,193,0.12)', 'rgba(123,45,142,0.16)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Sparkles size={18} color="#FFE28F" />
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>4-Part Luck Report</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>Your personalized daily reading</Text>
        <Text style={styles.heroSubtitle}>
          Chinese calendar, western horoscope, tarot guidance, and a bold luck rating built for this exact agenda day.
        </Text>
      </LinearGradient>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Calendar size={14} color="#D7E7FF" />
          <Text style={styles.metaPillText}>{report.birthdayLabel}</Text>
        </View>
        <View style={styles.metaPill}>
          <Star size={14} color="#FFE28F" />
          <Text style={styles.metaPillText}>{report.zodiacSign}</Text>
        </View>
        <View style={styles.metaPill}>
          <Sun size={14} color="#9EFDF2" />
          <Text style={styles.metaPillText}>{report.birthAnimal}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIndex}>01</Text>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Chinese Calendar Reading</Text>
            <Text style={styles.sectionSubtitle}>{report.birthAnimal} birth sign • {report.currentAnimal} current cycle</Text>
          </View>
        </View>
        <Text style={styles.sectionBody}>{report.chineseReading}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIndex}>02</Text>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Western Zodiac & Horoscope</Text>
            <Text style={styles.sectionSubtitle}>{report.zodiacSign} forecast</Text>
          </View>
        </View>
        <Text style={styles.sectionBody}>{report.westernReading}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIndex}>03</Text>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Tarot Reading of the Day</Text>
            <Text style={styles.sectionSubtitle}>{report.tarotCard.name}</Text>
          </View>
        </View>
        <Text style={styles.sectionBody}>{report.tarotReading}</Text>
      </View>

      <View style={[styles.ratingCard, { borderColor: `${luckColor}55` }]}>
        <LinearGradient
          colors={[`${luckColor}24`, 'rgba(255,255,255,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ratingGradient}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionIndex, { color: luckColor }]}>04</Text>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>Lucky Day Rating</Text>
              <Text style={[styles.sectionSubtitle, { color: luckColor }]}>{luckLabel}</Text>
            </View>
          </View>
          <View style={styles.ratingCenter}>
            <Text style={[styles.ratingNumber, { color: luckColor }]} testID="luck-report-score">{luckScore}</Text>
            <Text style={[styles.ratingScaleText, { color: luckColor }]}>{luckLabel} energy today</Text>
          </View>
          <Text style={styles.sectionBody}>{report.ratingReading}</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  heroCard: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    ...SHADOW.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroChipText: {
    color: '#F5F8FF',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    color: 'rgba(232,240,255,0.82)',
    fontSize: TYPOGRAPHY.fontSizeMD,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaPillText: {
    color: '#E9F1FF',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: 'rgba(7,16,34,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sectionIndex: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 34,
    fontWeight: '900' as const,
    minWidth: 44,
  },
  sectionTitleWrap: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
  },
  sectionSubtitle: {
    color: 'rgba(219,230,249,0.66)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  sectionBody: {
    color: '#E9F1FF',
    fontSize: TYPOGRAPHY.fontSizeMD,
    lineHeight: 25,
  },
  ratingCard: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  ratingGradient: {
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  ratingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  ratingNumber: {
    fontSize: 92,
    lineHeight: 98,
    fontWeight: '900' as const,
    letterSpacing: -2,
  },
  ratingScaleText: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
