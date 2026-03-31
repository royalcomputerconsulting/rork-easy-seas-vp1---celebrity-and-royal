import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  formatBirthdateForDisplay,
  getDailyLuckDigitForDate,
  getDailyLuckScoreForDate,
  getLuckColor,
  getLuckDigitColor,
  getLuckDigitLabel,
  parseBirthdate,
} from '@/lib/date';
import { Moon, Sparkles, Star, Sun, Waves } from 'lucide-react-native';

interface DailyLuckReportProps {
  birthdate: string;
  selectedDate: Date;
}

interface ChineseBranchProfile {
  name: string;
  traits: string;
  focus: string;
  edge: string;
}

interface HeavenlyStemProfile {
  element: string;
  tone: string;
}

interface ChineseProfile {
  animal: string;
  element: string;
  fullName: string;
  traits: string;
  focus: string;
  edge: string;
  tone: string;
}

interface WesternSignProfile {
  name: string;
  dates: string;
  element: string;
  ruler: string;
  drive: string;
  strength: string;
}

interface TarotCardProfile {
  name: string;
  number: string;
  theme: string;
  upright: string;
  shadow: string;
  guidance: string;
}

interface ReadingContext {
  birthdate: Date;
  selectedDate: Date;
  chineseProfile: ChineseProfile;
  westernSign: WesternSignProfile;
  tarotCard: TarotCardProfile;
  formattedDate: string;
  luckScore: number;
  luckDigit: number;
  lifePathNumber: number;
}

const CHINESE_BRANCHES: ChineseBranchProfile[] = [
  { name: 'Rat', traits: 'clever timing, adaptability, and the instinct to notice openings before everyone else', focus: 'resource management, quiet leverage, and swift decisions made at the right moment', edge: 'seeing value before it becomes obvious' },
  { name: 'Ox', traits: 'steadiness, endurance, and faith in the long game', focus: 'consistency, deliberate pacing, and staying grounded while others overreact', edge: 'building momentum through discipline instead of drama' },
  { name: 'Tiger', traits: 'courage, charisma, and the willingness to move when conviction becomes clear', focus: 'bold but informed action, leadership, and protecting your advantage', edge: 'knowing when decisive motion beats hesitation' },
  { name: 'Rabbit', traits: 'intuition, diplomacy, and an elegant awareness of emotional currents', focus: 'graceful negotiation, social intelligence, and preserving harmony without losing position', edge: 'reading tone and timing with uncommon sensitivity' },
  { name: 'Dragon', traits: 'presence, ambition, and a natural ability to energize a room', focus: 'high-impact choices, strong self-belief, and turning attention into momentum', edge: 'making confidence feel inevitable rather than forced' },
  { name: 'Snake', traits: 'discernment, subtle strategy, and deep intuition', focus: 'careful reading, private planning, and choosing precision over noise', edge: 'seeing beneath the surface before acting' },
  { name: 'Horse', traits: 'movement, independence, and an instinct for freedom', focus: 'clean momentum, authentic expression, and trusting the pace that feels alive', edge: 'knowing when motion itself creates opportunity' },
  { name: 'Goat', traits: 'creativity, sensitivity, and emotional refinement', focus: 'protecting your peace, choosing beauty over clutter, and making soft power count', edge: 'turning vulnerability into unmistakable taste and wisdom' },
  { name: 'Monkey', traits: 'inventiveness, wit, and a gift for improvisation', focus: 'pattern recognition, playful strategy, and finding unusual routes to the same win', edge: 'solving problems faster than the room can name them' },
  { name: 'Rooster', traits: 'order, discernment, and a sharp eye for detail', focus: 'refinement, exact judgment, and trusting the method that already works', edge: 'spotting the flaw, the opening, and the real standard at once' },
  { name: 'Dog', traits: 'integrity, loyalty, and strong inner standards', focus: 'clear boundaries, principled choices, and standing by what is actually true', edge: 'protecting what matters without needing to prove it loudly' },
  { name: 'Pig', traits: 'abundance, generosity, and steady faith in pleasure and goodness', focus: 'receiving well, choosing what nourishes you, and recognizing where life is trying to support you', edge: 'understanding that real abundance is both material and emotional' },
];

const HEAVENLY_STEMS: HeavenlyStemProfile[] = [
  { element: 'Wood', tone: 'growth, expansion, and a desire to build something living and meaningful' },
  { element: 'Wood', tone: 'flexibility, imagination, and the power to adapt without losing direction' },
  { element: 'Fire', tone: 'visibility, courage, and a willingness to move with conviction' },
  { element: 'Fire', tone: 'charisma, passion, and the urge to act from the center of your truth' },
  { element: 'Earth', tone: 'practicality, patience, and a commitment to what is solid and enduring' },
  { element: 'Earth', tone: 'stability, responsibility, and an instinct for measured progress' },
  { element: 'Metal', tone: 'clarity, discipline, and the strength to cut away distraction' },
  { element: 'Metal', tone: 'refinement, precision, and exact judgment under pressure' },
  { element: 'Water', tone: 'intuition, depth, and a talent for moving with subtle currents' },
  { element: 'Water', tone: 'wisdom, receptivity, and the ability to let timing reveal itself' },
];

const WESTERN_SIGNS: WesternSignProfile[] = [
  { name: 'Capricorn', dates: 'Dec 22 - Jan 19', element: 'Earth', ruler: 'Saturn', drive: 'structure, strategy, and measurable progress', strength: 'patience and intelligent restraint' },
  { name: 'Aquarius', dates: 'Jan 20 - Feb 18', element: 'Air', ruler: 'Uranus', drive: 'originality, independence, and seeing beyond convention', strength: 'vision paired with emotional detachment' },
  { name: 'Pisces', dates: 'Feb 19 - Mar 20', element: 'Water', ruler: 'Neptune', drive: 'intuition, empathy, and symbolic understanding', strength: 'trusting what you feel before it can be explained' },
  { name: 'Aries', dates: 'Mar 21 - Apr 19', element: 'Fire', ruler: 'Mars', drive: 'momentum, directness, and decisive action', strength: 'courage guided by timing' },
  { name: 'Taurus', dates: 'Apr 20 - May 20', element: 'Earth', ruler: 'Venus', drive: 'stability, comfort, and preserving what has real value', strength: 'staying grounded while others rush' },
  { name: 'Gemini', dates: 'May 21 - Jun 20', element: 'Air', ruler: 'Mercury', drive: 'curiosity, communication, and rapid pattern recognition', strength: 'seeing multiple paths before anyone else' },
  { name: 'Cancer', dates: 'Jun 21 - Jul 22', element: 'Water', ruler: 'Moon', drive: 'protection, emotional intelligence, and instinctive care', strength: 'feeling the room before making the move' },
  { name: 'Leo', dates: 'Jul 23 - Aug 22', element: 'Fire', ruler: 'Sun', drive: 'creative self-expression, heart-led leadership, and visible confidence', strength: 'radiating certainty without overreaching' },
  { name: 'Virgo', dates: 'Aug 23 - Sep 22', element: 'Earth', ruler: 'Mercury', drive: 'analysis, refinement, and mastery through repetition', strength: 'precision under pressure' },
  { name: 'Libra', dates: 'Sep 23 - Oct 22', element: 'Air', ruler: 'Venus', drive: 'balance, proportion, and reading relational dynamics', strength: 'finding the elegant move instead of the loud one' },
  { name: 'Scorpio', dates: 'Oct 23 - Nov 21', element: 'Water', ruler: 'Pluto', drive: 'intensity, truth, and strategic transformation', strength: 'seeing what is hidden and acting only when it matters' },
  { name: 'Sagittarius', dates: 'Nov 22 - Dec 21', element: 'Fire', ruler: 'Jupiter', drive: 'expansion, faith, and movement toward possibility', strength: 'believing in the larger arc without losing the present detail' },
];

const TAROT_CARDS: TarotCardProfile[] = [
  { name: 'The Fool', number: '0', theme: 'new beginnings and courageous openness', upright: 'fresh starts, trust in the unfolding path, and momentum that arrives when you stop overcontrolling the next step', shadow: 'carelessness, avoidable risk, and mistaking impulse for faith', guidance: 'let the next step stay simple and honest rather than forcing certainty you do not yet have' },
  { name: 'The Magician', number: 'I', theme: 'skill, willpower, and deliberate manifestation', upright: 'resourcefulness, command, and the ability to shape circumstances through focused effort', shadow: 'manipulation, scattered intention, and trying to control what should be aligned instead', guidance: 'use what is already in your hands with precision before chasing something new' },
  { name: 'The High Priestess', number: 'II', theme: 'intuition, mystery, and inner knowing', upright: 'stillness, perception, and trust in what you sense before anything external confirms it', shadow: 'second-guessing, confusion, and letting noise drown out the quiet signal', guidance: 'protect your inner signal long enough to hear what it is trying to tell you' },
  { name: 'The Empress', number: 'III', theme: 'abundance, beauty, and fertile growth', upright: 'receptivity, nourishment, and the confidence to invest in what is blossoming', shadow: 'overindulgence, stagnation, or giving away more energy than you can replenish', guidance: 'choose the option that actually feeds your life instead of only decorating it' },
  { name: 'The Emperor', number: 'IV', theme: 'structure, authority, and command', upright: 'discipline, boundaries, and leadership rooted in steadiness', shadow: 'rigidity, dominance, and confusing control with strength', guidance: 'lead clearly, but do not suffocate what needs room to breathe' },
  { name: 'The Hierophant', number: 'V', theme: 'tradition, teachings, and trusted systems', upright: 'wisdom, inheritance, and the value of proven methods', shadow: 'empty routine, blind conformity, or using rules to avoid genuine understanding', guidance: 'return to the method that has already earned your trust' },
  { name: 'The Lovers', number: 'VI', theme: 'alignment, values, and meaningful choice', upright: 'heart-led clarity, relational harmony, and decisions that honor what matters most', shadow: 'indecision, divided loyalties, or choosing chemistry over truth', guidance: 'make the decision that leaves your inner life more coherent, not more scattered' },
  { name: 'The Chariot', number: 'VII', theme: 'determination, movement, and directed force', upright: 'control of momentum, strategic action, and victory through disciplined focus', shadow: 'aggression, rushing, or burning energy in too many directions at once', guidance: 'steer your force instead of simply accelerating it' },
  { name: 'Strength', number: 'VIII', theme: 'gentle power, courage, and composure', upright: 'inner steadiness, emotional command, and bravery without theatrics', shadow: 'self-doubt, frustration, or trying to overpower what should be understood', guidance: 'stay soft enough to feel and strong enough not to fold' },
  { name: 'The Hermit', number: 'IX', theme: 'reflection, solitude, and distilled wisdom', upright: 'self-trust, inner guidance, and the value of stepping back to see clearly', shadow: 'withdrawal, isolation, or letting distance turn into avoidance', guidance: 'create enough space for truth to surface before you move again' },
  { name: 'Wheel of Fortune', number: 'X', theme: 'cycles, timing, and turning points', upright: 'favorable movement, synchronicity, and opportunity arriving through timing', shadow: 'instability, false urgency, or hoping luck will replace discernment', guidance: 'notice what is turning in your favor and meet it with readiness' },
  { name: 'Justice', number: 'XI', theme: 'truth, balance, and consequence', upright: 'clarity, accountability, and decisions rooted in what is fair and real', shadow: 'avoidance, imbalance, or trying to out-negotiate the truth', guidance: 'choose the clean move now and let results follow from that integrity' },
  { name: 'The Hanged Man', number: 'XII', theme: 'pause, perspective, and conscious surrender', upright: 'new insight, patience, and the wisdom that comes from not forcing the moment', shadow: 'stalling, passivity, or confusing delay with strategy', guidance: 'the shift you need may come from seeing differently, not pushing harder' },
  { name: 'Death', number: 'XIII', theme: 'release, transformation, and clean endings', upright: 'transition, renewal, and making room for the next chapter', shadow: 'clinging, fear of change, or trying to revive what has already completed its work', guidance: 'let what is finished finish with dignity' },
  { name: 'Temperance', number: 'XIV', theme: 'balance, calibration, and wise blending', upright: 'moderation, harmony, and measured progress', shadow: 'excess, impatience, or forcing incompatible energies together', guidance: 'mix action with patience until the right formula reveals itself' },
  { name: 'The Devil', number: 'XV', theme: 'attachment, temptation, and hidden chains', upright: 'honest confrontation with desire, fear, and patterns that keep repeating', shadow: 'compulsion, avoidance, or letting appetite set the terms', guidance: 'name the pattern clearly and it loses much of its power over you' },
  { name: 'The Tower', number: 'XVI', theme: 'revelation, disruption, and liberation through truth', upright: 'sudden clarity, structural change, and the collapse of what was never stable', shadow: 'denial, brittleness, or trying to preserve what truth has already outgrown', guidance: 'let revelation clear the ground rather than treating it as punishment' },
  { name: 'The Star', number: 'XVII', theme: 'hope, healing, and clear direction', upright: 'renewal, confidence in the future, and trust that meaning is reassembling itself', shadow: 'discouragement, spiritual fatigue, or forgetting what still remains possible', guidance: 'move as if renewal is already underway' },
  { name: 'The Moon', number: 'XVIII', theme: 'ambiguity, feeling, and the unseen', upright: 'intuition, symbolic insight, and the need to navigate with care', shadow: 'projection, fear, or mistaking uncertainty for danger', guidance: 'listen closely, but verify what the fog is exaggerating' },
  { name: 'The Sun', number: 'XIX', theme: 'clarity, vitality, and radiant confidence', upright: 'joy, illumination, and successful movement through openness and truth', shadow: 'ego, overexposure, or confusing attention with alignment', guidance: 'let confidence be warm and clear rather than loud' },
  { name: 'Judgment', number: 'XX', theme: 'awakening, reckoning, and the higher call', upright: 'self-recognition, renewal, and a chance to answer life more honestly', shadow: 'self-criticism, reluctance, or staying asleep to what you already know', guidance: 'respond to the truth that keeps returning instead of negotiating it away' },
  { name: 'The World', number: 'XXI', theme: 'completion, integration, and earned arrival', upright: 'fulfillment, synthesis, and the confidence that comes from a full cycle completed well', shadow: 'unfinished business, loose ends, or refusing to acknowledge how far you have come', guidance: 'honor the completion, then step into the next chapter from wholeness' },
];

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getChineseProfile(year: number): ChineseProfile {
  const branch = CHINESE_BRANCHES[mod(year - 4, 12)] ?? CHINESE_BRANCHES[0]!;
  const stem = HEAVENLY_STEMS[mod(year - 4, 10)] ?? HEAVENLY_STEMS[0]!;

  return {
    animal: branch.name,
    element: stem.element,
    fullName: `${stem.element} ${branch.name}`,
    traits: branch.traits,
    focus: branch.focus,
    edge: branch.edge,
    tone: stem.tone,
  };
}

function getWesternSign(month: number, day: number): WesternSignProfile {
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return WESTERN_SIGNS[0]!;
  if (month === 1 || (month === 2 && day <= 18)) return WESTERN_SIGNS[1]!;
  if (month === 2 || (month === 3 && day <= 20)) return WESTERN_SIGNS[2]!;
  if (month === 3 || (month === 4 && day <= 19)) return WESTERN_SIGNS[3]!;
  if (month === 4 || (month === 5 && day <= 20)) return WESTERN_SIGNS[4]!;
  if (month === 5 || (month === 6 && day <= 20)) return WESTERN_SIGNS[5]!;
  if (month === 6 || (month === 7 && day <= 22)) return WESTERN_SIGNS[6]!;
  if (month === 7 || (month === 8 && day <= 22)) return WESTERN_SIGNS[7]!;
  if (month === 8 || (month === 9 && day <= 22)) return WESTERN_SIGNS[8]!;
  if (month === 9 || (month === 10 && day <= 22)) return WESTERN_SIGNS[9]!;
  if (month === 10 || (month === 11 && day <= 21)) return WESTERN_SIGNS[10]!;
  return WESTERN_SIGNS[11]!;
}

function getTarotCard(birthdate: Date, selectedDate: Date): TarotCardProfile {
  const seed =
    birthdate.getFullYear() +
    birthdate.getMonth() * 13 +
    birthdate.getDate() * 7 +
    (selectedDate.getFullYear() * 3 + selectedDate.getMonth() * 17 + selectedDate.getDate() * 11);
  const index = mod(seed, TAROT_CARDS.length);
  return TAROT_CARDS[index] ?? TAROT_CARDS[0]!;
}

function reduceNumber(value: number): number {
  let current = value;

  while (current > 9 && current !== 11 && current !== 22 && current !== 33) {
    current = String(current)
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
  }

  if (current === 11 || current === 22 || current === 33) {
    return current;
  }

  return Math.max(1, current);
}

function getLifePathNumber(date: Date): number {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return reduceNumber(month + day + year);
}

function pickFrom<T>(options: readonly T[], seed: number): T {
  return options[mod(seed, options.length)] ?? options[0]!;
}

function getReadingSeed(birthdate: Date, selectedDate: Date): number {
  return (
    birthdate.getFullYear() +
    birthdate.getMonth() * 31 +
    birthdate.getDate() * 17 +
    selectedDate.getFullYear() * 7 +
    selectedDate.getMonth() * 13 +
    selectedDate.getDate() * 19
  );
}

function buildOpeningParagraph(context: ReadingContext): string {
  const seed = getReadingSeed(context.birthdate, context.selectedDate);
  const opener = pickFrom([
    'Today’s energy is centered on precision, discipline, and mastery.',
    'Today unfolds with a watchful, strategic rhythm that rewards timing over speed.',
    'Today carries a deliberate, exacting current that favors observation before action.',
    'Today is less about spectacle and more about sharpness, structure, and clean execution.',
  ], seed);

  const pace = context.luckScore >= 78
    ? 'This is a day that can reward action, but only after you have read the pattern correctly.'
    : context.luckScore >= 58
      ? 'This is a workable day, but it favors patience, calibration, and noticing what others miss.'
      : 'This is not a day that rewards rushing. Slow the pace, tighten the focus, and let clarity arrive before you move.';

  return `${opener} ${pace} For you, that message lands with extra force because your ${context.westernSign.name} temperament already leans toward ${context.westernSign.drive}, while your ${context.chineseProfile.fullName} imprint favors ${context.chineseProfile.edge}. Your luck is strongest when instinct and discipline work together rather than competing for control.`;
}

function buildTarotParagraph(context: ReadingContext): string {
  const orientation = context.luckScore >= 50 ? 'upright' : 'shadow';
  const orientationLine = orientation === 'upright'
    ? `In its upright form, this card speaks to ${context.tarotCard.upright}.`
    : `In its shadow expression, this card warns against ${context.tarotCard.shadow}.`;

  return `Your tarot card for today is ${context.tarotCard.name}, the archetype of ${context.tarotCard.theme}. ${orientationLine} If this card were reversed, it would point toward ${context.tarotCard.shadow}. In today’s field, its clearest message is simple: ${context.tarotCard.guidance}. The advantage available now does not come from forcing the moment. It comes from reading it accurately and responding with skill.`;
}

function buildWesternParagraph(context: ReadingContext): string {
  const seed = getReadingSeed(context.birthdate, context.selectedDate) + 11;
  const skyRhythm = pickFrom([
    'grounded and thoughtful',
    'measured but mentally sharp',
    'emotionally observant and strategically paced',
    'steady, intelligent, and slightly restrained in a useful way',
  ], seed);

  const motionAdvice = context.luckScore >= 76
    ? 'see first, then move with conviction'
    : context.luckScore >= 56
      ? 'pause long enough to identify the real opening'
      : 'slow down enough to separate signal from noise';

  return `Astrologically, today carries a ${skyRhythm} rhythm. The Moon increases perception, ${context.westernSign.ruler} sharpens the area of life ruled by your ${context.westernSign.name} nature, and the overall pattern asks you to ${motionAdvice}. For a ${context.westernSign.name}, that can feel unusual because your sign naturally trusts ${context.westernSign.strength}. But today’s sky teaches that timing matters more than urgency. What looks slower at first may actually be the cleanest route to momentum.`;
}

function buildChineseParagraph(context: ReadingContext): string {
  return `From the perspective of Chinese astrology, your ${context.chineseProfile.fullName} nature is especially well-supported today. The ${context.chineseProfile.animal} is associated with ${context.chineseProfile.traits}. The ${context.chineseProfile.element} element adds ${context.chineseProfile.tone}. Together, that combination favors ${context.chineseProfile.focus}. In plain terms, today aligns with one of your deepest strengths: ${context.chineseProfile.edge}. Your luck improves when you trust discernment more than excitement.`;
}

function buildLessonParagraph(context: ReadingContext): string {
  const seed = getReadingSeed(context.birthdate, context.selectedDate) + 23;
  const lesson = pickFrom([
    'The deeper lesson of today is advantage through refinement.',
    'The real lesson of today is not force, but intelligent positioning.',
    'Today’s quieter wisdom is that mastery often looks calm before it looks dramatic.',
    'The hidden gift of today is clarity earned through restraint.',
  ], seed);

  const scoreLine = context.luckScore >= 80
    ? 'This is one of those days when preparation and timing can create a very visible payoff.'
    : context.luckScore >= 60
      ? 'This is a day for protecting energy, sharpening instinct, and letting confidence come from accuracy.'
      : 'This is a day for preserving energy, studying the board, and refusing to act out of pressure alone.';

  return `${lesson} Your life-path vibration ${context.lifePathNumber} interacting with today’s luck number ${context.luckDigit} suggests that the best results come from doing a few things with excellence instead of many things with urgency. ${scoreLine} Not every powerful day begins with a bold move. Some powerful days begin with recognizing what is worth your attention and what is not.`;
}

function buildClosingParagraph(context: ReadingContext): string {
  const seed = getReadingSeed(context.birthdate, context.selectedDate) + 31;
  const closingQuestion = pickFrom([
    'What becomes clearer if you slow down long enough to really notice it?',
    'Where is the real edge today: in chasing harder, or in reading the room more accurately?',
    'What strengthens immediately once you stop forcing what is not yet ready?',
    'What pattern is revealing itself now that was invisible at first glance?',
  ], seed);

  return `So the question for today is not “How hard can I push?” but “${closingQuestion}” That is where your luck lives today. Not in randomness, but in awareness. Not in chasing, but in recognition. ${context.formattedDate} sharpens your edge and asks you to trust the part of yourself that already knows how to move well.`;
}

export function DailyLuckReport({ birthdate, selectedDate }: DailyLuckReportProps) {
  const birthdateObj = useMemo(() => parseBirthdate(birthdate), [birthdate]);

  const formattedDate = useMemo(() => (
    selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  ), [selectedDate]);

  const birthdateDisplay = useMemo(() => formatBirthdateForDisplay(birthdateObj), [birthdateObj]);

  const chineseProfile = useMemo(() => {
    if (!birthdateObj) {
      return null;
    }

    return getChineseProfile(birthdateObj.getFullYear());
  }, [birthdateObj]);

  const westernSign = useMemo(() => {
    if (!birthdateObj) {
      return null;
    }

    return getWesternSign(birthdateObj.getMonth() + 1, birthdateObj.getDate());
  }, [birthdateObj]);

  const tarotCard = useMemo(() => {
    if (!birthdateObj) {
      return null;
    }

    return getTarotCard(birthdateObj, selectedDate);
  }, [birthdateObj, selectedDate]);

  const luckScore = useMemo(() => {
    if (!birthdateObj) {
      return 0;
    }

    return getDailyLuckScoreForDate(birthdateObj, selectedDate) ?? 0;
  }, [birthdateObj, selectedDate]);

  const luckDigit = useMemo(() => {
    if (!birthdateObj) {
      return 0;
    }

    return getDailyLuckDigitForDate(birthdateObj, selectedDate) ?? 0;
  }, [birthdateObj, selectedDate]);

  const luckColors = useMemo(() => getLuckColor(luckScore), [luckScore]);
  const luckBadgeColor = useMemo(() => getLuckDigitColor(Math.max(1, luckDigit || 1)), [luckDigit]);
  const luckLabel = useMemo(() => getLuckDigitLabel(Math.max(1, luckDigit || 1)), [luckDigit]);

  const reading = useMemo(() => {
    if (!birthdateObj || !chineseProfile || !westernSign || !tarotCard || luckDigit === 0) {
      return null;
    }

    const context: ReadingContext = {
      birthdate: birthdateObj,
      selectedDate,
      chineseProfile,
      westernSign,
      tarotCard,
      formattedDate,
      luckScore,
      luckDigit,
      lifePathNumber: getLifePathNumber(birthdateObj),
    };

    console.log('[DailyLuckReport] Built lucky day reading:', {
      formattedDate,
      birthdate: birthdateDisplay,
      tarotCard: tarotCard.name,
      westernSign: westernSign.name,
      chineseProfile: chineseProfile.fullName,
      luckScore,
      luckDigit,
    });

    return {
      opening: buildOpeningParagraph(context),
      tarot: buildTarotParagraph(context),
      western: buildWesternParagraph(context),
      chinese: buildChineseParagraph(context),
      lesson: buildLessonParagraph(context),
      closing: buildClosingParagraph(context),
    };
  }, [birthdateDisplay, birthdateObj, chineseProfile, formattedDate, luckDigit, luckScore, selectedDate, tarotCard, westernSign]);

  if (!birthdateObj || !reading || !chineseProfile || !westernSign || !tarotCard || luckDigit === 0) {
    return (
      <View style={styles.noBirthdateContainer}>
        <LinearGradient
          colors={['rgba(14, 23, 45, 0.96)', 'rgba(28, 53, 94, 0.94)']}
          style={styles.noBirthdateCard}
        >
          <View style={styles.noBirthdateIconShell}>
            <Sparkles size={20} color="#D4B15A" />
          </View>
          <Text style={styles.noBirthdateTitle}>Daily Luck Report</Text>
          <Text style={styles.noBirthdateText}>
            Add your birthdate in Settings → Profile using MM/DD/YYYY format to unlock your full daily tarot reading, Western zodiac forecast, and Chinese horoscope.
          </Text>
        </LinearGradient>
      </View>
    );
  }

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
            <Text style={styles.heroTitle}>Your Lucky Day Reading — {formattedDate}</Text>
            <Text style={styles.heroSubtitle}>Generated from your 8:00 AM birth imprint on {birthdateDisplay}.</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { borderColor: `${luckBadgeColor}55` }]}>
            <Text style={styles.metricLabel}>Luck #</Text>
            <Text style={[styles.metricValue, { color: luckBadgeColor }]}>{luckDigit}</Text>
            <Text style={styles.metricSubvalue}>{luckLabel}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tarot</Text>
            <Text style={styles.metricValueSmall}>{tarotCard.name}</Text>
            <Text style={styles.metricSubvalue}>Card {tarotCard.number}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Zodiac</Text>
            <Text style={styles.metricValueSmall}>{westernSign.name}</Text>
            <Text style={styles.metricSubvalue}>{westernSign.element} sign</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Chinese</Text>
            <Text style={styles.metricValueSmall}>{chineseProfile.fullName}</Text>
            <Text style={styles.metricSubvalue}>{chineseProfile.animal}</Text>
          </View>
        </View>

        <LinearGradient
          colors={luckColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scoreBanner}
        >
          <Text style={styles.scoreBannerLabel}>Overall luck score</Text>
          <Text style={styles.scoreBannerValue}>{luckScore}/100</Text>
        </LinearGradient>
      </LinearGradient>

      <View style={styles.articleCard}>
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Sparkles size={16} color="#D4B15A" />
            <Text style={styles.sectionHeading}>Opening Energy</Text>
          </View>
          <Text style={styles.paragraph}>{reading.opening}</Text>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Star size={16} color="#A8C7FF" />
            <Text style={styles.sectionHeading}>Tarot Reading</Text>
          </View>
          <Text style={styles.paragraph}>{reading.tarot}</Text>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Sun size={16} color="#F5B450" />
            <Text style={styles.sectionHeading}>Western Zodiac Forecast</Text>
          </View>
          <Text style={styles.paragraph}>{reading.western}</Text>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Moon size={16} color="#8EC5FF" />
            <Text style={styles.sectionHeading}>Chinese Horoscope</Text>
          </View>
          <Text style={styles.paragraph}>{reading.chinese}</Text>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <Waves size={16} color="#5ED7C4" />
            <Text style={styles.sectionHeading}>Deeper Lesson</Text>
          </View>
          <Text style={styles.paragraph}>{reading.lesson}</Text>
        </View>

        <LinearGradient
          colors={['rgba(212, 177, 90, 0.12)', 'rgba(94, 215, 196, 0.08)']}
          style={styles.closingCard}
        >
          <Text style={styles.closingTitle}>Closing Reflection</Text>
          <Text style={styles.closingText}>{reading.closing}</Text>
        </LinearGradient>
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
    marginBottom: SPACING.md,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 84,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.58)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  metricValueSmall: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    lineHeight: 22,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  metricSubvalue: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 16,
  },
  scoreBanner: {
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreBannerLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    opacity: 0.92,
  },
  scoreBannerValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  articleCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    backgroundColor: 'rgba(10, 20, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: SPACING.lg,
  },
  sectionBlock: {
    gap: SPACING.sm,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionHeading: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.84)',
  },
  closingCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 177, 90, 0.18)',
  },
  closingTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#D4B15A',
    marginBottom: SPACING.xs,
  },
  closingText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.88)',
  },
  noBirthdateContainer: {
    marginTop: SPACING.md,
  },
  noBirthdateCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 177, 90, 0.18)',
  },
  noBirthdateIconShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 177, 90, 0.14)',
    marginBottom: SPACING.md,
  },
  noBirthdateTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  noBirthdateText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.76)',
    textAlign: 'center' as const,
  },
});
