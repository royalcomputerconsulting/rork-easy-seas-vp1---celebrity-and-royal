import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import {
  formatBirthdateForDisplay,
  formatBirthdateForStorage,
  getDailyLuckDigitForDate,
  parseBirthdate,
} from '@/lib/date';
import type { DailyLuckEntry, DailyLuckReadings, DailyLuckScoreBreakdown } from '@/types/daily-luck';

interface WesternSignProfile {
  name: string;
  element: string;
  ruler: string;
  gift: string;
}

interface TarotCardProfile {
  name: string;
  number: string;
  upright: string;
  shadow: string;
  guidance: string;
}

const CHINESE_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'] as const;
const PLANETARY_RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;
const MOON_PHASES = [
  'new moon',
  'waxing crescent',
  'first quarter',
  'waxing gibbous',
  'full moon',
  'waning gibbous',
  'last quarter',
  'waning crescent',
] as const;

const WESTERN_SIGNS: WesternSignProfile[] = [
  { name: 'Capricorn', element: 'Earth', ruler: 'Saturn', gift: 'structure, strategy, and long-view discipline' },
  { name: 'Aquarius', element: 'Air', ruler: 'Uranus', gift: 'original thinking and smart detachment' },
  { name: 'Pisces', element: 'Water', ruler: 'Neptune', gift: 'intuition, empathy, and symbolic awareness' },
  { name: 'Aries', element: 'Fire', ruler: 'Mars', gift: 'decisive action and fresh momentum' },
  { name: 'Taurus', element: 'Earth', ruler: 'Venus', gift: 'steadiness, comfort, and value sensitivity' },
  { name: 'Gemini', element: 'Air', ruler: 'Mercury', gift: 'curiosity, wit, and fast pattern recognition' },
  { name: 'Cancer', element: 'Water', ruler: 'Moon', gift: 'protective instinct and emotional intelligence' },
  { name: 'Leo', element: 'Fire', ruler: 'Sun', gift: 'confidence, warmth, and visible self-expression' },
  { name: 'Virgo', element: 'Earth', ruler: 'Mercury', gift: 'analysis, refinement, and practical mastery' },
  { name: 'Libra', element: 'Air', ruler: 'Venus', gift: 'balance, proportion, and relational timing' },
  { name: 'Scorpio', element: 'Water', ruler: 'Pluto', gift: 'focus, depth, and strategic transformation' },
  { name: 'Sagittarius', element: 'Fire', ruler: 'Jupiter', gift: 'faith, expansion, and adventurous perspective' },
];

const TAROT_CARDS: TarotCardProfile[] = [
  { name: 'The Fool', number: '0', upright: 'fresh starts and brave openness', shadow: 'reckless leaps and impatience', guidance: 'keep the day playful, but do not confuse speed with guidance' },
  { name: 'The Magician', number: 'I', upright: 'resourcefulness and control of your tools', shadow: 'scattered intent and overpromising', guidance: 'use what is already in your hands before reaching farther out' },
  { name: 'The High Priestess', number: 'II', upright: 'quiet intuition and inner clarity', shadow: 'mixed signals and second-guessing', guidance: 'trust the subtle signal, then verify it calmly' },
  { name: 'The Empress', number: 'III', upright: 'abundance, comfort, and fertile momentum', shadow: 'overindulgence and complacency', guidance: 'choose what genuinely nourishes your life today' },
  { name: 'The Emperor', number: 'IV', upright: 'structure and firm leadership', shadow: 'rigidity and unnecessary control', guidance: 'build order without choking spontaneity' },
  { name: 'The Hierophant', number: 'V', upright: 'tradition and trusted systems', shadow: 'empty routine and stale rules', guidance: 'lean on what has already proven itself' },
  { name: 'The Lovers', number: 'VI', upright: 'alignment and meaningful choice', shadow: 'mixed motives and divided energy', guidance: 'pick the path that keeps your inner life coherent' },
  { name: 'The Chariot', number: 'VII', upright: 'drive, control, and focused movement', shadow: 'rushing and emotional oversteering', guidance: 'point your effort carefully before you accelerate' },
  { name: 'Strength', number: 'VIII', upright: 'composure, courage, and quiet power', shadow: 'self-doubt and forcefulness', guidance: 'stay warm, steady, and harder to shake' },
  { name: 'The Hermit', number: 'IX', upright: 'reflection and distilled wisdom', shadow: 'withdrawal and over-isolation', guidance: 'step back long enough to hear the truth clearly' },
  { name: 'Wheel of Fortune', number: 'X', upright: 'timing, movement, and turning tides', shadow: 'volatility and false urgency', guidance: 'meet the opening, but do not chase the spin' },
  { name: 'Justice', number: 'XI', upright: 'clarity and clean consequences', shadow: 'avoidance and imbalance', guidance: 'make the honest move first and let the rest follow' },
  { name: 'The Hanged Man', number: 'XII', upright: 'patience and perspective', shadow: 'stalling and passivity', guidance: 'a better angle may matter more than extra force' },
  { name: 'Death', number: 'XIII', upright: 'release and transformation', shadow: 'clinging and fear of endings', guidance: 'let the finished thing stay finished' },
  { name: 'Temperance', number: 'XIV', upright: 'balance and wise blending', shadow: 'excess and impatience', guidance: 'mix action with restraint until the right rhythm appears' },
  { name: 'The Devil', number: 'XV', upright: 'honest confrontation with desire', shadow: 'compulsion and self-sabotage', guidance: 'name the pattern clearly so it loses power' },
  { name: 'The Tower', number: 'XVI', upright: 'revelation and liberation', shadow: 'denial and brittle control', guidance: 'let truth rearrange what no longer fits' },
  { name: 'The Star', number: 'XVII', upright: 'healing and renewed faith', shadow: 'fatigue and loss of trust', guidance: 'move like renewal is already underway' },
  { name: 'The Moon', number: 'XVIII', upright: 'intuition and symbolic depth', shadow: 'fog, projection, and uncertainty', guidance: 'feel deeply, but verify what the fog is exaggerating' },
  { name: 'The Sun', number: 'XIX', upright: 'clarity, vitality, and success', shadow: 'ego and overexposure', guidance: 'let confidence be bright, not loud' },
  { name: 'Judgment', number: 'XX', upright: 'awakening and self-recognition', shadow: 'hesitation and self-criticism', guidance: 'answer the truth that keeps returning to you' },
  { name: 'The World', number: 'XXI', upright: 'completion and earned arrival', shadow: 'unfinished business and loose ends', guidance: 'honor what is complete, then step forward whole' },
];

const CHINESE_COMPATIBILITY_OFFSETS = [1, 2, 1, 0, -1, -2, -2] as const;
const PLANETARY_DAY_OFFSETS: Record<(typeof PLANETARY_RULERS)[number], number> = {
  Sun: 1,
  Moon: 0,
  Mars: -1,
  Mercury: 0,
  Jupiter: 1,
  Venus: 1,
  Saturn: -2,
};
const MOON_PHASE_OFFSETS: Record<(typeof MOON_PHASES)[number], number> = {
  'new moon': -1,
  'waxing crescent': 0,
  'first quarter': 1,
  'waxing gibbous': 1,
  'full moon': 2,
  'waning gibbous': 0,
  'last quarter': -1,
  'waning crescent': -2,
};
const ELEMENTALLY_FAVORED_PLANETS: Record<string, readonly (typeof PLANETARY_RULERS)[number][]> = {
  Fire: ['Sun', 'Mars', 'Jupiter'],
  Earth: ['Mercury', 'Venus', 'Saturn'],
  Air: ['Mercury', 'Venus', 'Saturn'],
  Water: ['Moon', 'Venus', 'Jupiter'],
};
const TAROT_TONE_OFFSETS: Record<string, number> = {
  'The Fool': 0,
  'The Magician': 1,
  'The High Priestess': 0,
  'The Empress': 2,
  'The Emperor': 1,
  'The Hierophant': 0,
  'The Lovers': 1,
  'The Chariot': 1,
  Strength: 2,
  'The Hermit': -1,
  'Wheel of Fortune': 2,
  Justice: 0,
  'The Hanged Man': -1,
  Death: -2,
  Temperance: 1,
  'The Devil': -2,
  'The Tower': -3,
  'The Star': 2,
  'The Moon': -1,
  'The Sun': 3,
  Judgment: 1,
  'The World': 2,
};

const monthlyLuckSchema = z.object({
  days: z.array(
    z.object({
      dateKey: z.string(),
      chineseScore: z.number().int().min(1).max(9),
      westernScore: z.number().int().min(1).max(9),
      tarotScore: z.number().int().min(1).max(9),
      synthesis: z.string().min(12).max(240),
    })
  ),
});

function normalizeDate(date: Date): Date {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(12, 0, 0, 0);
  return normalizedDate;
}

export function getDailyLuckDateKey(date: Date): string {
  const normalizedDate = normalizeDate(date);
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const day = String(normalizedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampLuckNumber(value: number): number {
  return Math.max(1, Math.min(9, Math.round(value)));
}

function createScoreBreakdown(chinese: number, western: number, tarot: number): DailyLuckScoreBreakdown {
  return {
    chinese: clampLuckNumber(chinese),
    western: clampLuckNumber(western),
    tarot: clampLuckNumber(tarot),
  };
}

function getWeightedLuckValue(breakdown: DailyLuckScoreBreakdown): number {
  return breakdown.chinese * 0.3 + breakdown.western * 0.35 + breakdown.tarot * 0.35;
}

function getLuckNumberFromBreakdown(breakdown: DailyLuckScoreBreakdown): number {
  return clampLuckNumber(getWeightedLuckValue(breakdown));
}

function getReadingLabel(key: keyof DailyLuckScoreBreakdown): string {
  if (key === 'chinese') return 'Chinese';
  if (key === 'western') return 'Western';
  return 'Tarot';
}

function getHighestReadingKey(breakdown: DailyLuckScoreBreakdown): keyof DailyLuckScoreBreakdown {
  const entries = Object.entries(breakdown) as [keyof DailyLuckScoreBreakdown, number][];
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'western';
}

function getLowestReadingKey(breakdown: DailyLuckScoreBreakdown): keyof DailyLuckScoreBreakdown {
  const entries = Object.entries(breakdown) as [keyof DailyLuckScoreBreakdown, number][];
  return entries.sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'western';
}

function buildLocalSynthesisReason(breakdown: DailyLuckScoreBreakdown): string {
  const weightedLuckValue = getWeightedLuckValue(breakdown);
  const scores = [breakdown.chinese, breakdown.western, breakdown.tarot];
  const spread = Math.max(...scores) - Math.min(...scores);
  const strongest = getReadingLabel(getHighestReadingKey(breakdown));
  const weakest = getReadingLabel(getLowestReadingKey(breakdown));

  if (weightedLuckValue >= 7.5) {
    return `${strongest} carries the day and the other readings stay supportive, so this reads as a genuinely high-luck day.`;
  }

  if (weightedLuckValue >= 6.5) {
    return `${strongest} is the strongest green light, but the day still rewards pacing more than overreaching.`;
  }

  if (weightedLuckValue >= 4.5 && spread <= 2) {
    return 'The three systems stay close together, so the day reads balanced rather than extreme.';
  }

  if (weightedLuckValue >= 4.5) {
    return `${strongest} helps, but ${weakest} keeps the day from reading like a peak-luck day.`;
  }

  if (weightedLuckValue >= 3) {
    return `${weakest} weighs on the day enough that caution matters more than momentum.`;
  }

  return 'All three systems lean cautious, so this should be treated as a low-luck day.';
}

function buildTransparentSynthesis(
  breakdown: DailyLuckScoreBreakdown,
  providedSynthesis?: string,
): string {
  const luckNumber = getLuckNumberFromBreakdown(breakdown);
  const normalizedSynthesis = typeof providedSynthesis === 'string' ? providedSynthesis.trim() : '';
  const explanation = normalizedSynthesis.length > 0 ? normalizedSynthesis : buildLocalSynthesisReason(breakdown);
  return `Lucky Day # ${luckNumber}: Chinese ${breakdown.chinese}/9, Western ${breakdown.western}/9, Tarot ${breakdown.tarot}/9. ${explanation}`;
}

export function hasTransparentDailyLuckEntry(entry: DailyLuckEntry | null | undefined): boolean {
  return !!entry?.scoreBreakdown &&
    typeof entry.scoreBreakdown.chinese === 'number' &&
    typeof entry.scoreBreakdown.western === 'number' &&
    typeof entry.scoreBreakdown.tarot === 'number';
}

function getChineseAnimal(year: number): string {
  return CHINESE_ANIMALS[((year - 4) % 12 + 12) % 12] ?? CHINESE_ANIMALS[0];
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

function getMoonPhase(date: Date): string {
  const normalizedDate = normalizeDate(date);
  const referenceMoon = Date.UTC(2000, 0, 6, 18, 14, 0, 0);
  const daysSinceReference = (normalizedDate.getTime() - referenceMoon) / 86400000;
  const synodicMonth = 29.530588853;
  const phaseIndex = Math.floor((((daysSinceReference / synodicMonth) % 1) + 1) % 1 * MOON_PHASES.length);
  return MOON_PHASES[phaseIndex] ?? MOON_PHASES[0];
}

function getTarotCard(birthdate: Date, selectedDate: Date): TarotCardProfile {
  const normalizedDate = normalizeDate(selectedDate);
  const seed =
    birthdate.getFullYear() * 3 +
    (birthdate.getMonth() + 1) * 13 +
    birthdate.getDate() * 17 +
    normalizedDate.getFullYear() * 7 +
    (normalizedDate.getMonth() + 1) * 19 +
    normalizedDate.getDate() * 23;
  const index = ((seed % TAROT_CARDS.length) + TAROT_CARDS.length) % TAROT_CARDS.length;
  return TAROT_CARDS[index] ?? TAROT_CARDS[0]!;
}

function getFallbackLuckNumber(birthdate: Date, selectedDate: Date): number {
  return getDailyLuckDigitForDate(birthdate, selectedDate) ?? 5;
}

function getChineseScore(birthAnimal: string, currentAnimal: string, weekdayPlanet: (typeof PLANETARY_RULERS)[number]): number {
  const birthIndex = CHINESE_ANIMALS.indexOf(birthAnimal as (typeof CHINESE_ANIMALS)[number]);
  const currentIndex = CHINESE_ANIMALS.indexOf(currentAnimal as (typeof CHINESE_ANIMALS)[number]);
  const directDistance = Math.abs(birthIndex - currentIndex);
  const wrappedDistance = Math.min(directDistance, CHINESE_ANIMALS.length - directDistance);
  const compatibilityOffset = CHINESE_COMPATIBILITY_OFFSETS[wrappedDistance] ?? 0;
  const planetaryOffset = PLANETARY_DAY_OFFSETS[weekdayPlanet] ?? 0;
  return clampLuckNumber(5 + compatibilityOffset + planetaryOffset);
}

function getWesternScore(sign: WesternSignProfile, moonPhase: string, weekdayPlanet: (typeof PLANETARY_RULERS)[number]): number {
  const favoredPlanets = ELEMENTALLY_FAVORED_PLANETS[sign.element] ?? [];
  const phaseOffset = MOON_PHASE_OFFSETS[moonPhase as (typeof MOON_PHASES)[number]] ?? 0;
  const rulerOffset = sign.ruler === weekdayPlanet ? 1 : 0;
  const elementalOffset = favoredPlanets.includes(weekdayPlanet) ? 1 : 0;
  return clampLuckNumber(5 + phaseOffset + rulerOffset + elementalOffset);
}

function getTarotScore(card: TarotCardProfile, fallbackLuckNumber: number): number {
  const toneOffset = TAROT_TONE_OFFSETS[card.name] ?? 0;
  const fallbackOffset = fallbackLuckNumber >= 7 ? 1 : fallbackLuckNumber <= 3 ? -1 : 0;
  return clampLuckNumber(5 + toneOffset + fallbackOffset);
}

function buildChineseReading(birthdate: Date, selectedDate: Date): { chineseSign: string; score: number; text: string } {
  const birthAnimal = getChineseAnimal(birthdate.getFullYear());
  const dayAnimal = getChineseAnimal(selectedDate.getFullYear());
  const weekdayPlanet = PLANETARY_RULERS[selectedDate.getDay()] ?? PLANETARY_RULERS[0];
  const score = getChineseScore(birthAnimal, dayAnimal, weekdayPlanet);

  return {
    chineseSign: birthAnimal,
    score,
    text: `Chinese horoscope: your ${birthAnimal} nature meets a ${dayAnimal} year current under ${weekdayPlanet}'s daily influence. This favors measured instincts, social awareness, and acting only after the pattern is clear. Luck rises when you stay observant, avoid overcommitting early, and trust the opening that feels earned instead of flashy.`,
  };
}

function buildWesternReading(birthdate: Date, selectedDate: Date): { westernSign: string; score: number; text: string } {
  const sign = getWesternSign(birthdate.getMonth() + 1, birthdate.getDate());
  const weekdayPlanet = PLANETARY_RULERS[selectedDate.getDay()] ?? PLANETARY_RULERS[0];
  const moonPhase = getMoonPhase(selectedDate);
  const score = getWesternScore(sign, moonPhase, weekdayPlanet);

  return {
    westernSign: sign.name,
    score,
    text: `Western zodiac and planetary alignment: as a ${sign.name}, you naturally move through life with ${sign.gift}. Today the ${moonPhase} Moon sharpens emotional timing while ${weekdayPlanet} colors the day with extra emphasis on focus, communication, and pacing. The sky supports deliberate choices, clean boundaries, and quiet confidence far more than impulsive risk-taking.`,
  };
}

function buildTarotReading(
  birthdate: Date,
  selectedDate: Date,
  fallbackLuckNumber: number,
): { tarotCard: string; score: number; text: string } {
  const card = getTarotCard(birthdate, selectedDate);
  const leaning = fallbackLuckNumber >= 6 ? card.upright : card.shadow;
  const score = getTarotScore(card, fallbackLuckNumber);

  return {
    tarotCard: card.name,
    score,
    text: `Tarot reading: ${card.name} (${card.number}) is your card for the day. Its strongest message centers on ${leaning}. The guidance here is direct: ${card.guidance}. If you respond with patience and clear intent, the card suggests stronger outcomes than if you push from stress or urgency.`,
  };
}

export function buildLocalDailyLuckEntry(
  birthdateInput: string | Date | null | undefined,
  selectedDate: Date,
): DailyLuckEntry | null {
  const birthdate = parseBirthdate(birthdateInput);
  if (!birthdate) {
    return null;
  }

  const normalizedBirthdate = formatBirthdateForStorage(birthdate);
  const normalizedDate = normalizeDate(selectedDate);
  const dateKey = getDailyLuckDateKey(normalizedDate);
  const fallbackLuckNumber = getFallbackLuckNumber(birthdate, normalizedDate);
  const chinese = buildChineseReading(birthdate, normalizedDate);
  const western = buildWesternReading(birthdate, normalizedDate);
  const tarot = buildTarotReading(birthdate, normalizedDate, fallbackLuckNumber);
  const scoreBreakdown = createScoreBreakdown(chinese.score, western.score, tarot.score);
  const luckNumber = getLuckNumberFromBreakdown(scoreBreakdown);

  const readings: DailyLuckReadings = {
    chinese: chinese.text,
    western: western.text,
    tarot: tarot.text,
    synthesis: buildTransparentSynthesis(scoreBreakdown),
  };

  console.log('[DailyLuck] Built local daily luck entry:', {
    dateKey,
    birthdate: normalizedBirthdate,
    scoreBreakdown,
    luckNumber,
  });

  return {
    dateKey,
    birthdate: normalizedBirthdate,
    year: normalizedDate.getFullYear(),
    generatedAt: new Date().toISOString(),
    source: 'fallback',
    westernSign: western.westernSign,
    chineseSign: chinese.chineseSign,
    tarotCard: tarot.tarotCard,
    luckNumber,
    luckScore: Math.round((luckNumber / 9) * 100),
    scoreBreakdown,
    readings,
  };
}

async function generateMonthlyLuckyNumbersWithAI(
  birthdate: Date,
  monthEntries: DailyLuckEntry[],
): Promise<Record<string, { scoreBreakdown: DailyLuckScoreBreakdown; synthesis: string }>> {
  if (monthEntries.length === 0) {
    return {};
  }

  const monthLabel = monthEntries[0]?.dateKey.slice(0, 7) ?? 'unknown-month';
  const birthdateLabel = formatBirthdateForDisplay(birthdate);

  try {
    const result = await generateObject({
      messages: [
        {
          role: 'user',
          content: `You are rating day-by-day luck from 1 to 9.

Birthdate: ${birthdateLabel}
Month: ${monthLabel}

For each day below, read the Chinese horoscope, Western zodiac/planetary reading, and tarot reading together.
Score each system separately from 1 to 9, then write one concise synthesis sentence.
The final Lucky Day # will be calculated from your three component scores, so your scores must stay internally consistent.

Scale:
- 1 to 3 = warning, obstruction, low momentum, or clear caution
- 4 to 6 = mixed, balanced, moderate, or usable with restraint
- 7 to 9 = aligned, unusually supportive, high momentum, or strong timing

Rules:
- Use the full range naturally. Do not make most days high luck.
- Let 4, 5, and 6 be the most common values.
- If the text stresses pacing, restraint, boundaries, or caution, do not score that system above 6.
- Use 7 to 9 only when the specific reading is clearly favorable, expansive, or unusually supportive.
- Return one concise synthesis sentence per day explaining the blend.
- Keep every synthesis under 240 characters.

Days:
${monthEntries.map((entry) => `Date: ${entry.dateKey}\nChinese: ${entry.readings.chinese}\nWestern: ${entry.readings.western}\nTarot: ${entry.readings.tarot}`).join('\n\n')}`,
        },
      ],
      schema: monthlyLuckSchema,
    });

    const monthlyMap: Record<string, { scoreBreakdown: DailyLuckScoreBreakdown; synthesis: string }> = {};
    result.days.forEach((day) => {
      monthlyMap[day.dateKey] = {
        scoreBreakdown: createScoreBreakdown(day.chineseScore, day.westernScore, day.tarotScore),
        synthesis: day.synthesis,
      };
    });

    console.log('[DailyLuck] AI monthly synthesis complete:', {
      monthLabel,
      days: Object.keys(monthlyMap).length,
    });

    return monthlyMap;
  } catch (error) {
    console.error('[DailyLuck] AI monthly synthesis failed:', {
      monthLabel,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

export async function generateDailyLuckEntriesForYear(
  birthdateInput: string | Date | null | undefined,
  year: number,
): Promise<Record<string, DailyLuckEntry>> {
  const birthdate = parseBirthdate(birthdateInput);
  if (!birthdate) {
    return {};
  }

  const monthlyBuckets = new Map<number, DailyLuckEntry[]>();
  const entriesByDate: Record<string, DailyLuckEntry> = {};

  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const entry = buildLocalDailyLuckEntry(birthdate, new Date(year, month, day, 12, 0, 0, 0));
      if (!entry) {
        continue;
      }

      entriesByDate[entry.dateKey] = entry;
      const existingMonthEntries = monthlyBuckets.get(month) ?? [];
      existingMonthEntries.push(entry);
      monthlyBuckets.set(month, existingMonthEntries);
    }
  }

  for (let month = 0; month < 12; month += 1) {
    const monthEntries = monthlyBuckets.get(month) ?? [];
    const aiResults = await generateMonthlyLuckyNumbersWithAI(birthdate, monthEntries);

    monthEntries.forEach((entry) => {
      const aiEntry = aiResults[entry.dateKey];
      if (!aiEntry) {
        return;
      }

      const luckNumber = getLuckNumberFromBreakdown(aiEntry.scoreBreakdown);
      entriesByDate[entry.dateKey] = {
        ...entry,
        generatedAt: new Date().toISOString(),
        source: 'ai',
        luckNumber,
        luckScore: Math.round((luckNumber / 9) * 100),
        scoreBreakdown: aiEntry.scoreBreakdown,
        readings: {
          ...entry.readings,
          synthesis: buildTransparentSynthesis(aiEntry.scoreBreakdown, aiEntry.synthesis),
        },
      };
    });
  }

  console.log('[DailyLuck] Generated yearly entries:', {
    birthdate: formatBirthdateForDisplay(birthdate),
    year,
    totalEntries: Object.keys(entriesByDate).length,
    aiEntries: Object.values(entriesByDate).filter((entry) => entry.source === 'ai').length,
  });

  return entriesByDate;
}
