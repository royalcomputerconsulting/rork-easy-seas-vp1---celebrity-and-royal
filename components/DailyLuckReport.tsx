import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { getDailyLuckScoreForDate, getLuckColor, getLuckLabel, getLuckStars, parseBirthdate } from '@/lib/date';
import { Star, Moon, Sun, Zap, Sparkles } from 'lucide-react-native';

interface DailyLuckReportProps {
  birthdate: string;
  selectedDate: Date;
}

const CHINESE_ANIMALS = [
  { name: 'Rat', emoji: '🐀', element: 'Water', traits: 'Clever, quick-witted, and resourceful. Your instincts are razor-sharp today.' },
  { name: 'Ox', emoji: '🐂', element: 'Earth', traits: 'Dependable, strong-willed, and determined. Steady progress favors you today.' },
  { name: 'Tiger', emoji: '🐅', element: 'Wood', traits: 'Brave, confident, and charismatic. Bold moves bring big rewards today.' },
  { name: 'Rabbit', emoji: '🐇', element: 'Wood', traits: 'Gentle, elegant, and alert. Social grace and diplomacy open doors today.' },
  { name: 'Dragon', emoji: '🐉', element: 'Earth', traits: 'Vital, strong, and good-fortuned. You radiate an irresistible energy today.' },
  { name: 'Snake', emoji: '🐍', element: 'Fire', traits: 'Wise, intuitive, and charming. Trust your deep intuition above all else today.' },
  { name: 'Horse', emoji: '🐎', element: 'Fire', traits: 'Animated, active, and energetic. Freedom and movement bring luck your way.' },
  { name: 'Goat', emoji: '🐐', element: 'Earth', traits: 'Gentle, sympathetic, and creative. Artistic endeavors flourish under today\'s stars.' },
  { name: 'Monkey', emoji: '🐒', element: 'Metal', traits: 'Sharp, smart, and curious. Your cleverness outshines any challenge today.' },
  { name: 'Rooster', emoji: '🐓', element: 'Metal', traits: 'Observant, hardworking, and courageous. Attention to detail brings mastery today.' },
  { name: 'Dog', emoji: '🐕', element: 'Earth', traits: 'Loyal, honest, and empathetic. Faithfulness and integrity attract good fortune today.' },
  { name: 'Pig', emoji: '🐖', element: 'Water', traits: 'Compassionate, generous, and diligent. Abundance flows to those who give freely today.' },
];

const WESTERN_SIGNS = [
  { name: 'Capricorn', symbol: '♑', dates: 'Dec 22 - Jan 19', element: 'Earth', ruler: 'Saturn', traits: 'Ambitious and disciplined. Saturn rewards your patience and strategic thinking today.' },
  { name: 'Aquarius', symbol: '♒', dates: 'Jan 20 - Feb 18', element: 'Air', ruler: 'Uranus', traits: 'Innovative and humanitarian. Unexpected breakthroughs and brilliant ideas arrive today.' },
  { name: 'Pisces', symbol: '♓', dates: 'Feb 19 - Mar 20', element: 'Water', ruler: 'Neptune', traits: 'Compassionate and intuitive. Your psychic sensitivity is heightened — trust those feelings.' },
  { name: 'Aries', symbol: '♈', dates: 'Mar 21 - Apr 19', element: 'Fire', ruler: 'Mars', traits: 'Bold and courageous. Mars fills you with unstoppable drive — take decisive action today.' },
  { name: 'Taurus', symbol: '♉', dates: 'Apr 20 - May 20', element: 'Earth', ruler: 'Venus', traits: 'Stable and sensual. Venus brings beauty and prosperity — indulge your finest tastes today.' },
  { name: 'Gemini', symbol: '♊', dates: 'May 21 - Jun 20', element: 'Air', ruler: 'Mercury', traits: 'Witty and versatile. Mercury sharpens your tongue and mind — communicate brilliantly today.' },
  { name: 'Cancer', symbol: '♋', dates: 'Jun 21 - Jul 22', element: 'Water', ruler: 'Moon', traits: 'Nurturing and empathetic. The Moon heightens your emotional intelligence and intuition today.' },
  { name: 'Leo', symbol: '♌', dates: 'Jul 23 - Aug 22', element: 'Fire', ruler: 'Sun', traits: 'Regal and creative. The Sun crowns you with charisma — all eyes are drawn to you today.' },
  { name: 'Virgo', symbol: '♍', dates: 'Aug 23 - Sep 22', element: 'Earth', ruler: 'Mercury', traits: 'Analytical and diligent. Precision and careful analysis lead you to remarkable solutions today.' },
  { name: 'Libra', symbol: '♎', dates: 'Sep 23 - Oct 22', element: 'Air', ruler: 'Venus', traits: 'Balanced and charming. Venus blesses your relationships — harmony and beauty prevail today.' },
  { name: 'Scorpio', symbol: '♏', dates: 'Oct 23 - Nov 21', element: 'Water', ruler: 'Pluto', traits: 'Intense and transformative. Pluto reveals hidden truths — embrace powerful change today.' },
  { name: 'Sagittarius', symbol: '♐', dates: 'Nov 22 - Dec 21', element: 'Fire', ruler: 'Jupiter', traits: 'Adventurous and philosophical. Jupiter expands your horizons — embrace fortune and adventure.' },
];

const TAROT_CARDS = [
  { name: 'The Fool', number: '0', meaning: 'New beginnings, spontaneity, and a leap of faith.', advice: 'Embrace the unknown today. A fresh start beckons — dare to take the first step without fear.', emoji: '🃏', luck: 85 },
  { name: 'The Magician', number: 'I', meaning: 'Willpower, skill, and the power to manifest.', advice: 'All the tools you need are in your hands. Channel your focus and transform intention into reality today.', emoji: '🪄', luck: 92 },
  { name: 'The High Priestess', number: 'II', meaning: 'Intuition, mystery, and inner knowing.', advice: 'Be still and listen deeply. The answers you seek live within — trust your gut above all external noise.', emoji: '🌙', luck: 78 },
  { name: 'The Empress', number: 'III', meaning: 'Abundance, fertility, and nurturing energy.', advice: 'Luxury and beauty surround you. Invest in pleasures, creativity, and connections that enrich your life.', emoji: '🌸', luck: 88 },
  { name: 'The Emperor', number: 'IV', meaning: 'Authority, structure, and leadership.', advice: 'Stand firm in your power. Take control of your domain and make decisive, confident choices today.', emoji: '👑', luck: 82 },
  { name: 'The Hierophant', number: 'V', meaning: 'Tradition, wisdom, and spiritual guidance.', advice: 'Seek wisdom from trusted mentors. Today calls for conventional paths and proven strategies.', emoji: '📿', luck: 74 },
  { name: 'The Lovers', number: 'VI', meaning: 'Love, harmony, and important choices.', advice: 'A crossroads lies before you. Choose from the heart — alignment with your values brings perfect outcomes.', emoji: '❤️', luck: 90 },
  { name: 'The Chariot', number: 'VII', meaning: 'Determination, victory, and forward momentum.', advice: 'Channel your will and charge forward. Victory is within reach — keep a firm grip on the reins today.', emoji: '⚡', luck: 87 },
  { name: 'Strength', number: 'VIII', meaning: 'Courage, patience, and inner strength.', advice: 'Gentle power moves mountains. Lead with compassion and confidence — you are stronger than you know.', emoji: '🦁', luck: 80 },
  { name: 'The Hermit', number: 'IX', meaning: 'Reflection, wisdom, and solitude.', advice: 'Withdraw from noise and find your truth within. Deep insights arrive in the stillness today.', emoji: '🔦', luck: 68 },
  { name: 'The Wheel', number: 'X', meaning: 'Cycles, luck, and turning points.', advice: 'Fortune spins in your favor. Embrace the cycle — what goes around brings spectacular returns today.', emoji: '🎡', luck: 93 },
  { name: 'Justice', number: 'XI', meaning: 'Fairness, truth, and cause and effect.', advice: 'Balance the scales with integrity. What you put out returns multiplied — let honesty be your guide.', emoji: '⚖️', luck: 75 },
  { name: 'The Hanged Man', number: 'XII', meaning: 'Pause, new perspectives, and surrender.', advice: 'Let go and see from a new angle. A voluntary pause reveals a breakthrough hidden in plain sight.', emoji: '🙃', luck: 65 },
  { name: 'Death', number: 'XIII', meaning: 'Transformation, endings, and new beginnings.', advice: 'Something old must end for something magnificent to begin. Embrace this powerful transformation today.', emoji: '🦋', luck: 72 },
  { name: 'Temperance', number: 'XIV', meaning: 'Balance, moderation, and patience.', advice: 'Blend opposing forces with grace. Patience and moderation are your superpowers — flow like water today.', emoji: '🌊', luck: 79 },
  { name: 'The Devil', number: 'XV', meaning: 'Bondage, illusion, and shadow self.', advice: 'Recognize what chains you and break free. Your power is far greater than the illusions that limit you.', emoji: '🔗', luck: 62 },
  { name: 'The Tower', number: 'XVI', meaning: 'Sudden change, chaos, and revelation.', advice: 'A sudden shift clears the way for truth. What crumbles was not meant to stand — embrace the liberation.', emoji: '⚡', luck: 58 },
  { name: 'The Star', number: 'XVII', meaning: 'Hope, inspiration, and renewed faith.', advice: 'Healing light pours over you. Your hopes are not in vain — the stars themselves conspire in your favor today.', emoji: '⭐', luck: 91 },
  { name: 'The Moon', number: 'XVIII', meaning: 'Illusion, fear, and the subconscious.', advice: 'Navigate the mystical waters carefully. Not all is as it appears — trust your intuition through the fog.', emoji: '🌕', luck: 66 },
  { name: 'The Sun', number: 'XIX', meaning: 'Joy, success, and vitality.', advice: 'Radiant success shines upon you. Celebrate your gifts — today is made for joy, clarity, and triumphant energy.', emoji: '☀️', luck: 98 },
  { name: 'Judgment', number: 'XX', meaning: 'Awakening, redemption, and rebirth.', advice: 'A profound awakening calls you forward. Answer the call of your highest purpose — a new chapter dawns.', emoji: '📯', luck: 84 },
  { name: 'The World', number: 'XXI', meaning: 'Completion, integration, and achievement.', advice: 'You have arrived at a glorious completion. Celebrate how far you\'ve come — the world truly is yours today.', emoji: '🌍', luck: 96 },
];

function getChineseAnimal(birthYear: number) {
  const index = ((birthYear - 1900) % 12 + 12) % 12;
  return CHINESE_ANIMALS[index];
}

function getWesternSign(month: number, day: number) {
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return WESTERN_SIGNS[0];
  if (month === 1 || (month === 2 && day <= 18)) return WESTERN_SIGNS[1];
  if (month === 2 || (month === 3 && day <= 20)) return WESTERN_SIGNS[2];
  if (month === 3 || (month === 4 && day <= 19)) return WESTERN_SIGNS[3];
  if (month === 4 || (month === 5 && day <= 20)) return WESTERN_SIGNS[4];
  if (month === 5 || (month === 6 && day <= 20)) return WESTERN_SIGNS[5];
  if (month === 6 || (month === 7 && day <= 22)) return WESTERN_SIGNS[6];
  if (month === 7 || (month === 8 && day <= 22)) return WESTERN_SIGNS[7];
  if (month === 8 || (month === 9 && day <= 22)) return WESTERN_SIGNS[8];
  if (month === 9 || (month === 10 && day <= 22)) return WESTERN_SIGNS[9];
  if (month === 10 || (month === 11 && day <= 21)) return WESTERN_SIGNS[10];
  return WESTERN_SIGNS[11];
}

function getTarotCard(birthdate: Date, selectedDate: Date) {
  const seed = (birthdate.getFullYear() + birthdate.getMonth() * 13 + birthdate.getDate() * 7) +
    (selectedDate.getFullYear() * 3 + selectedDate.getMonth() * 17 + selectedDate.getDate() * 11);
  const index = ((seed % 22) + 22) % 22;
  return TAROT_CARDS[index];
}


export function DailyLuckReport({ birthdate, selectedDate }: DailyLuckReportProps) {
  const birthdateObj = useMemo(() => parseBirthdate(birthdate), [birthdate]);

  const chineseAnimal = useMemo(() => {
    if (!birthdateObj) return null;
    return getChineseAnimal(birthdateObj.getFullYear());
  }, [birthdateObj]);

  const westernSign = useMemo(() => {
    if (!birthdateObj) return null;
    return getWesternSign(birthdateObj.getMonth() + 1, birthdateObj.getDate());
  }, [birthdateObj]);

  const tarotCard = useMemo(() => {
    if (!birthdateObj) return null;
    return getTarotCard(birthdateObj, selectedDate);
  }, [birthdateObj, selectedDate]);

  const luckScore = useMemo(() => {
    if (!birthdateObj || !chineseAnimal || !tarotCard) return 0;
    return getDailyLuckScoreForDate(birthdateObj, selectedDate) ?? 0;
  }, [birthdateObj, chineseAnimal, tarotCard, selectedDate]);

  const luckColors = useMemo(() => getLuckColor(luckScore), [luckScore]);
  const luckLabel = useMemo(() => getLuckLabel(luckScore), [luckScore]);
  const luckStars = useMemo(() => getLuckStars(luckScore), [luckScore]);

  const formattedDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [selectedDate]);

  if (!birthdateObj) {
    return (
      <View style={styles.noBirthdateContainer}>
        <LinearGradient
          colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
          style={styles.noBirthdateCard}
        >
          <Text style={styles.noBirthdateEmoji}>🔮</Text>
          <Text style={styles.noBirthdateTitle}>Daily Luck Report</Text>
          <Text style={styles.noBirthdateText}>
            Add your birthdate in Settings → Profile to unlock your personalized Daily Luck Report featuring your Chinese horoscope, Western zodiac, and daily tarot reading.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.2)', 'rgba(59, 130, 246, 0.1)', 'rgba(16, 185, 129, 0.05)']}
        style={styles.headerGradient}
      >
        <View style={styles.titleRow}>
          <Sparkles size={18} color="#C084FC" />
          <Text style={styles.sectionLabel}>DAILY LUCK REPORT</Text>
          <Sparkles size={18} color="#C084FC" />
        </View>
        <Text style={styles.dateLabel}>{formattedDate}</Text>

        <LinearGradient
          colors={luckColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.overallScoreCard}
        >
          <Text style={styles.overallScoreTitle}>OVERALL LUCK SCORE</Text>
          <Text style={styles.overallScoreNumber}>{luckScore}</Text>
          <Text style={styles.overallScoreLabel}>{luckLabel}</Text>
          <Text style={styles.overallScoreStars}>{luckStars}</Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${luckScore}%` }]} />
          </View>
        </LinearGradient>
      </LinearGradient>

      <View style={styles.sectionsContainer}>
        {chineseAnimal && (
          <View style={styles.section}>
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>🏮</Text>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionTitle}>CHINESE HOROSCOPE</Text>
                  <Text style={styles.sectionBirthYear}>
                    Born {birthdateObj.getFullYear()} • Year of the {chineseAnimal.name}
                  </Text>
                </View>
              </View>

              <View style={styles.animalRow}>
                <Text style={styles.animalEmoji}>{chineseAnimal.emoji}</Text>
                <View style={styles.animalInfo}>
                  <Text style={styles.animalName}>The {chineseAnimal.name}</Text>
                  <View style={styles.elementBadge}>
                    <Text style={styles.elementText}>{chineseAnimal.element} Element</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.readingText}>{chineseAnimal.traits}</Text>

              <View style={styles.dailyReadingBox}>
                <Moon size={14} color="#F59E0B" />
                <Text style={styles.dailyReadingTitle}>Today&apos;s Chinese Astrology Reading</Text>
              </View>
              <Text style={styles.dailyReadingContent}>
                The {chineseAnimal.name} navigates today with innate wisdom drawn from the {chineseAnimal.element} element. 
                The celestial chi flowing on {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })} aligns with your animal sign in a powerful way. 
                The interaction between your lunar birth energy and today&apos;s cosmic alignment creates a field of {luckScore >= 70 ? 'exceptional opportunity and positive chi' : luckScore >= 50 ? 'balanced energy where caution and opportunity meet' : 'reflective energy suited for inward focus and strategic patience'}. 
                Honor the wisdom of your sign by {luckScore >= 70 ? 'acting decisively and boldly — fortune rewards the brave today' : luckScore >= 50 ? 'balancing bold moves with careful observation' : 'conserving your energy and planning your next strategic move'}. 
                Lucky colors: {chineseAnimal.element === 'Fire' ? 'Red, Orange, Gold' : chineseAnimal.element === 'Water' ? 'Blue, Black, Turquoise' : chineseAnimal.element === 'Wood' ? 'Green, Teal, Emerald' : chineseAnimal.element === 'Metal' ? 'White, Silver, Gold' : 'Yellow, Brown, Ochre'}. 
                Avoid: rushing decisions before noon. Best hours: {luckScore >= 70 ? '9am–11am and 2pm–5pm' : '10am–12pm and 7pm–9pm'}.
              </Text>
            </LinearGradient>
          </View>
        )}

        {westernSign && (
          <View style={styles.section}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.15)', 'rgba(99, 102, 241, 0.05)']}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>⭐</Text>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionTitle}>WESTERN ZODIAC</Text>
                  <Text style={styles.sectionBirthYear}>{westernSign.dates}</Text>
                </View>
              </View>

              <View style={styles.zodiacRow}>
                <Text style={styles.zodiacSymbol}>{westernSign.symbol}</Text>
                <View style={styles.zodiacInfo}>
                  <Text style={styles.zodiacName}>{westernSign.name}</Text>
                  <View style={styles.zodiacBadgeRow}>
                    <View style={[styles.elementBadge, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                      <Text style={[styles.elementText, { color: '#818CF8' }]}>{westernSign.element}</Text>
                    </View>
                    <View style={[styles.elementBadge, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                      <Text style={[styles.elementText, { color: '#F472B6' }]}>Ruled by {westernSign.ruler}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.readingText}>{westernSign.traits}</Text>

              <View style={styles.dailyReadingBox}>
                <Sun size={14} color="#60A5FA" />
                <Text style={styles.dailyReadingTitle}>Today&apos;s Horoscope Reading</Text>
              </View>
              <Text style={styles.dailyReadingContent}>
                {westernSign.name}, the planetary energies on {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })} create a {luckScore >= 75 ? 'highly charged, luminous field' : luckScore >= 55 ? 'complex but navigable landscape' : 'contemplative atmosphere'} uniquely tuned to your {westernSign.element} nature. 
                {westernSign.ruler} is {luckScore >= 70 ? 'in a powerful position today, amplifying your natural gifts and bestowing extraordinary favor on bold initiatives' : luckScore >= 50 ? 'moving through a transitional phase, encouraging you to balance initiative with receptivity' : 'calling you inward, urging reflection and strategic recalibration before your next major move'}. 
                Your ruling planet&apos;s influence today specifically impacts your {luckScore % 3 === 0 ? 'financial decisions and material pursuits' : luckScore % 3 === 1 ? 'relationships and social connections' : 'creative projects and personal expression'}. 
                The cosmic advice for {westernSign.name} today: {luckScore >= 80 ? 'Seize the moment with both hands — the stars have aligned a rare window of fortune that demands bold action' : luckScore >= 60 ? 'Move with intention and confidence, staying attuned to the subtle signals around you' : 'Conserve your celestial energy, observe carefully, and wait for the right moment to act'}. 
                Power numbers: {((birthdateObj?.getDate() || 0) + selectedDate.getDate()) % 9 + 1} and {((birthdateObj?.getMonth() || 0) + selectedDate.getMonth()) % 7 + 3}.
              </Text>
            </LinearGradient>
          </View>
        )}

        {tarotCard && (
          <View style={styles.section}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(109, 40, 217, 0.05)']}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>🔮</Text>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionTitle}>TAROT READING</Text>
                  <Text style={styles.sectionBirthYear}>Major Arcana • Card of the Day</Text>
                </View>
              </View>

              <View style={styles.tarotCardContainer}>
                <LinearGradient
                  colors={['#1E1B4B', '#312E81', '#1E1B4B']}
                  style={styles.tarotCard}
                >
                  <Text style={styles.tarotEmoji}>{tarotCard.emoji}</Text>
                  <Text style={styles.tarotNumber}>{tarotCard.number}</Text>
                  <Text style={styles.tarotCardName}>{tarotCard.name}</Text>
                  <View style={styles.tarotLuckBadge}>
                    <Star size={10} color="#FCD34D" fill="#FCD34D" />
                    <Text style={styles.tarotLuckText}>Luck Energy: {tarotCard.luck}</Text>
                  </View>
                </LinearGradient>
                <View style={styles.tarotMeaningContainer}>
                  <Text style={styles.tarotMeaningLabel}>Card Meaning</Text>
                  <Text style={styles.tarotMeaning}>{tarotCard.meaning}</Text>
                </View>
              </View>

              <View style={styles.dailyReadingBox}>
                <Zap size={14} color="#A78BFA" />
                <Text style={styles.dailyReadingTitle}>Your Personal Tarot Interpretation</Text>
              </View>
              <Text style={styles.dailyReadingContent}>
                {tarotCard.advice}
              </Text>
              <Text style={[styles.dailyReadingContent, { marginTop: SPACING.sm }]}>
                For you personally — born under the {chineseAnimal?.name} and {westernSign?.name} — {tarotCard.name} arrives today as a profound messenger. 
                The intersection of your birth numerology (life path {((birthdateObj?.getDate() || 0) + (birthdateObj?.getMonth() || 0) + 1 + birthdateObj?.getFullYear() || 0) % 9 + 1}) and the current lunar cycle amplifies this card&apos;s message {luckScore >= 75 ? 'tenfold' : 'in a focused, intentional way'}. 
                {luckScore >= 80 ? `${tarotCard.name} appearing today is a supremely auspicious sign — the universe is actively conspiring to bring you exactly what you need. Open your hands and heart to receive.` : luckScore >= 60 ? `${tarotCard.name} brings a measured but genuine message of guidance today. Act with awareness and you will find the path clear before you.` : `${tarotCard.name} arrives today as a teacher, not an obstacle. Its energy invites you to pause, reflect, and emerge wiser and more prepared for the triumphs ahead.`}
                Lucky hours to act on this card&apos;s energy: {tarotCard.luck >= 85 ? '9am, 1pm, and 8pm' : tarotCard.luck >= 70 ? '10am, 3pm, and 9pm' : '11am and 7pm'}.
              </Text>
            </LinearGradient>
          </View>
        )}

        <View style={styles.section}>
          <LinearGradient
            colors={luckColors.map(c => c + '25') as [string, string]}
            style={styles.sectionCard}
          >
            <View style={styles.finalSummaryHeader}>
              <Sparkles size={16} color={luckColors[0]} />
              <Text style={styles.finalSummaryTitle}>YOUR LUCKY DAY RATING SUMMARY</Text>
              <Sparkles size={16} color={luckColors[0]} />
            </View>
            <Text style={styles.finalSummaryScore}>{luckScore}/100</Text>
            <Text style={styles.finalSummaryLabel}>{luckLabel}</Text>
            <Text style={styles.finalSummaryStars}>{luckStars}</Text>
            <Text style={styles.finalSummaryText}>
              Your {westernSign?.name} energy combined with the {chineseAnimal?.name}&apos;s wisdom, channeled through the {tarotCard?.name} card, creates a {luckScore >= 80 ? 'magnificent constellation of forces working powerfully in your favor today.' : luckScore >= 60 ? 'balanced interplay of cosmic forces offering genuine opportunity when approached with intention.' : 'powerful invitation to turn inward, conserve your energy, and prepare for the abundant days ahead.'}
              {'\n\n'}
              {luckScore >= 90 ? '🌟 THIS IS A POWER DAY — Trust your instincts completely. Make that important call, start that project, place that bet. The cosmos has stacked the deck in your favor.' : luckScore >= 75 ? '✨ A STRONG DAY — Favorable winds are blowing. Lean into opportunities with confidence and strategic intent.' : luckScore >= 60 ? '💫 A STEADY DAY — Navigate with care and intention. Fortune favors the prepared mind today.' : luckScore >= 45 ? '🌙 A REFLECTIVE DAY — Use this time wisely. Observation and planning today builds the foundation for tomorrow\'s triumphs.' : '🌊 A RESTORATIVE DAY — Rest, recalibrate, and trust that the wheel always turns. Your luckiest days are in the pipeline.'}
            </Text>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
  },
  headerGradient: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#C084FC',
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  dateLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  overallScoreCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  overallScoreTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  overallScoreNumber: {
    fontSize: 56,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    lineHeight: 64,
  },
  overallScoreLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 1,
    marginTop: SPACING.xs,
  },
  overallScoreStars: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: '#FCD34D',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  scoreBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 4,
  },
  sectionsContainer: {
    gap: SPACING.md,
  },
  section: {},
  sectionCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionIcon: {
    fontSize: 28,
  },
  sectionTitleGroup: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  sectionBirthYear: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  animalEmoji: {
    fontSize: 40,
  },
  animalInfo: {
    flex: 1,
  },
  animalName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  elementBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
    alignSelf: 'flex-start',
  },
  elementText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#F59E0B',
  },
  readingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: SPACING.md,
    fontStyle: 'italic' as const,
  },
  dailyReadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  dailyReadingTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: 'rgba(255,255,255,0.9)',
  },
  dailyReadingContent: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  zodiacRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  zodiacSymbol: {
    fontSize: 44,
    color: '#818CF8',
  },
  zodiacInfo: {
    flex: 1,
  },
  zodiacName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  zodiacBadgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap' as const,
  },
  tarotCardContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'flex-start',
  },
  tarotCard: {
    width: 100,
    minHeight: 140,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.5)',
  },
  tarotEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  tarotNumber: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  tarotCardName: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#E9D5FF',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  tarotLuckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  tarotLuckText: {
    fontSize: 8,
    color: '#FCD34D',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  tarotMeaningContainer: {
    flex: 1,
  },
  tarotMeaningLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#A78BFA',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase' as const,
  },
  tarotMeaning: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  finalSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  finalSummaryTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  finalSummaryScore: {
    fontSize: 36,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  finalSummaryLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  finalSummaryStars: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#FCD34D',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  finalSummaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    textAlign: 'center',
  },
  noBirthdateContainer: {
    marginTop: SPACING.md,
  },
  noBirthdateCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  noBirthdateEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  noBirthdateTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#C084FC',
    marginBottom: SPACING.sm,
  },
  noBirthdateText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    textAlign: 'center',
  },
});
