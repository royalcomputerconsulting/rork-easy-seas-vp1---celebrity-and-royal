export interface HoroscopeLuckResult {
  chineseScore: number;
  chineseAnimal: string;
  chineseDescription: string;
  westernScore: number;
  westernSign: string;
  westernDescription: string;
  combinedScore: number;
  combinedColor: string;
  combinedHex: string;
  combinedLabel: string;
}

const CHINESE_ANIMALS = [
  'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
  'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig',
] as const;

type ChineseAnimal = typeof CHINESE_ANIMALS[number];

const CHINESE_YEAR_ANIMAL: Record<number, ChineseAnimal> = {
  2026: 'Horse',
  2025: 'Snake',
  2024: 'Dragon',
  2023: 'Rabbit',
  2022: 'Tiger',
  2021: 'Ox',
  2020: 'Rat',
  2019: 'Pig',
  2018: 'Dog',
  2017: 'Rooster',
  2016: 'Monkey',
  2015: 'Goat',
};

function getChineseAnimal(year: number): ChineseAnimal {
  const knownYear = CHINESE_YEAR_ANIMAL[year];
  if (knownYear) return knownYear;
  const baseYear = 1924;
  const idx = ((year - baseYear) % 12 + 12) % 12;
  return CHINESE_ANIMALS[idx];
}

const CHINESE_COMPATIBILITY: Record<ChineseAnimal, Record<ChineseAnimal, number>> = {
  Rat:     { Rat: 6, Ox: 8, Tiger: 4, Rabbit: 5, Dragon: 9, Snake: 6, Horse: 2, Goat: 5, Monkey: 8, Rooster: 4, Dog: 5, Pig: 7 },
  Ox:      { Rat: 8, Ox: 6, Tiger: 3, Rabbit: 6, Dragon: 5, Snake: 9, Horse: 3, Goat: 2, Monkey: 6, Rooster: 9, Dog: 7, Pig: 5 },
  Tiger:   { Rat: 4, Ox: 3, Tiger: 6, Rabbit: 7, Dragon: 6, Snake: 3, Horse: 8, Goat: 7, Monkey: 2, Rooster: 4, Dog: 9, Pig: 8 },
  Rabbit:  { Rat: 5, Ox: 6, Tiger: 7, Rabbit: 6, Dragon: 5, Snake: 7, Horse: 6, Goat: 9, Monkey: 5, Rooster: 2, Dog: 8, Pig: 8 },
  Dragon:  { Rat: 9, Ox: 5, Tiger: 6, Rabbit: 5, Dragon: 6, Snake: 8, Horse: 5, Goat: 6, Monkey: 9, Rooster: 7, Dog: 2, Pig: 6 },
  Snake:   { Rat: 6, Ox: 9, Tiger: 3, Rabbit: 7, Dragon: 8, Snake: 6, Horse: 2, Goat: 6, Monkey: 4, Rooster: 9, Dog: 5, Pig: 2 },
  Horse:   { Rat: 2, Ox: 3, Tiger: 8, Rabbit: 6, Dragon: 5, Snake: 2, Horse: 6, Goat: 8, Monkey: 4, Rooster: 5, Dog: 8, Pig: 7 },
  Goat:    { Rat: 5, Ox: 2, Tiger: 7, Rabbit: 9, Dragon: 6, Snake: 6, Horse: 8, Goat: 6, Monkey: 6, Rooster: 4, Dog: 6, Pig: 9 },
  Monkey:  { Rat: 8, Ox: 6, Tiger: 2, Rabbit: 5, Dragon: 9, Snake: 4, Horse: 4, Goat: 6, Monkey: 6, Rooster: 5, Dog: 4, Pig: 6 },
  Rooster: { Rat: 4, Ox: 9, Tiger: 4, Rabbit: 2, Dragon: 7, Snake: 9, Horse: 5, Goat: 4, Monkey: 5, Rooster: 6, Dog: 4, Pig: 5 },
  Dog:     { Rat: 5, Ox: 7, Tiger: 9, Rabbit: 8, Dragon: 2, Snake: 5, Horse: 8, Goat: 6, Monkey: 4, Rooster: 4, Dog: 6, Pig: 7 },
  Pig:     { Rat: 7, Ox: 5, Tiger: 8, Rabbit: 8, Dragon: 6, Snake: 2, Horse: 7, Goat: 9, Monkey: 6, Rooster: 5, Dog: 7, Pig: 6 },
};

const CHINESE_DAILY_PATTERNS: Record<ChineseAnimal, number[]> = {
  Rat:     [7,8,6,9,5,7,8,6,9,7,8,5,7,9,6,8,7,5,9,8,6,7,8,9,6,5,8,7,9,6,8],
  Ox:      [6,9,7,5,8,9,7,6,5,8,7,9,6,8,7,5,9,8,6,7,5,8,9,7,6,8,5,7,9,8,6],
  Tiger:   [8,5,9,7,6,8,5,9,7,6,8,7,5,6,9,7,8,6,5,9,7,8,6,5,9,7,6,8,5,9,7],
  Rabbit:  [9,7,5,8,9,6,7,8,5,9,6,7,8,5,9,6,7,5,8,9,6,5,7,8,9,6,7,5,8,6,9],
  Dragon:  [7,8,9,6,7,8,9,5,6,7,8,9,6,7,8,5,6,9,8,7,6,9,8,7,6,5,9,8,7,6,9],
  Snake:   [5,6,8,9,7,5,6,8,9,7,5,8,6,9,7,5,8,6,9,7,5,6,8,7,9,5,6,8,9,7,5],
  Horse:   [8,7,9,6,8,7,9,5,8,7,9,6,8,7,5,9,8,6,7,9,5,8,7,6,9,8,5,7,9,6,8],
  Goat:    [6,8,7,9,5,6,8,7,9,5,6,9,7,8,5,6,9,7,8,5,6,8,9,7,5,6,8,7,9,5,6],
  Monkey:  [9,5,7,8,6,9,5,7,8,6,9,7,5,8,6,9,7,5,8,6,9,5,7,8,6,9,5,8,7,6,9],
  Rooster: [5,9,6,7,8,5,9,6,7,8,5,7,9,6,8,5,7,9,6,8,5,9,7,6,8,5,9,6,7,8,5],
  Dog:     [7,6,8,5,9,7,6,8,5,9,7,8,6,5,9,7,8,6,5,9,7,6,8,9,5,7,6,8,5,9,7],
  Pig:     [8,9,5,6,7,8,9,5,6,7,8,6,9,5,7,8,6,9,5,7,8,9,6,5,7,8,9,5,6,7,8],
};

function getChineseScore(birthAnimal: ChineseAnimal, targetDate: Date): number {
  const year = targetDate.getFullYear();
  const currentYearAnimal = getChineseAnimal(year);
  const baseScore = CHINESE_COMPATIBILITY[birthAnimal][currentYearAnimal];

  const dayOfMonth = targetDate.getDate() - 1;
  const patterns = CHINESE_DAILY_PATTERNS[birthAnimal];
  const patternVal = patterns[dayOfMonth % patterns.length];

  const combined = Math.round((baseScore * 0.5) + (patternVal * 0.5));
  return Math.max(1, Math.min(9, combined));
}

const WESTERN_SIGNS = [
  'Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini',
  'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius',
] as const;

type WesternSign = typeof WESTERN_SIGNS[number];

function getWesternSign(month: number, day: number): WesternSign {
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  return 'Sagittarius';
}

const WESTERN_DAILY_PATTERNS: Record<WesternSign, number[]> = {
  Aries:       [8,6,9,5,7,8,6,9,7,5,8,6,9,7,5,8,9,6,7,5,8,6,9,7,8,5,6,9,7,8,6],
  Taurus:      [6,9,5,8,7,6,9,5,8,7,6,8,9,5,7,6,8,9,5,7,6,9,8,5,7,6,9,5,8,7,6],
  Gemini:      [9,5,7,8,6,9,5,7,8,6,9,7,5,8,6,9,7,5,8,6,9,5,7,8,6,9,7,5,8,6,9],
  Cancer:      [5,8,6,9,7,5,8,6,9,7,5,6,8,9,7,5,6,8,9,7,5,8,6,9,7,5,8,6,9,7,5],
  Leo:         [7,9,8,6,5,7,9,8,6,5,7,8,9,6,5,7,8,9,6,5,7,9,8,6,5,7,9,8,6,5,7],
  Virgo:       [6,7,9,5,8,6,7,9,5,8,6,9,7,5,8,6,9,7,5,8,6,7,9,8,5,6,7,9,5,8,6],
  Libra:       [8,5,6,9,7,8,5,6,9,7,8,6,5,9,7,8,6,5,9,7,8,5,6,7,9,8,5,6,9,7,8],
  Scorpio:     [9,7,5,6,8,9,7,5,6,8,9,5,7,6,8,9,5,7,6,8,9,7,5,6,8,9,7,5,6,8,9],
  Sagittarius: [7,8,9,5,6,7,8,9,5,6,7,9,8,5,6,7,9,8,5,6,7,8,9,5,6,7,8,9,5,6,7],
  Capricorn:   [5,6,7,8,9,5,6,7,8,9,5,7,6,8,9,5,7,6,8,9,5,6,7,9,8,5,6,7,8,9,5],
  Aquarius:    [8,9,6,7,5,8,9,6,7,5,8,7,9,6,5,8,7,9,6,5,8,9,6,5,7,8,9,6,7,5,8],
  Pisces:      [6,5,8,9,7,6,5,8,9,7,6,8,5,9,7,6,8,5,9,7,6,5,8,7,9,6,5,8,9,7,6],
};

const WESTERN_MONTHLY_MODIFIER: Record<WesternSign, number[]> = {
  Aries:       [5, 6, 9, 8, 7, 6, 5, 6, 7, 8, 7, 6],
  Taurus:      [6, 7, 7, 9, 8, 7, 5, 5, 6, 7, 8, 7],
  Gemini:      [7, 7, 6, 7, 9, 8, 6, 5, 5, 6, 7, 8],
  Cancer:      [8, 7, 7, 6, 7, 9, 8, 6, 5, 5, 6, 7],
  Leo:         [7, 8, 7, 7, 6, 7, 9, 8, 6, 5, 5, 6],
  Virgo:       [6, 7, 8, 7, 7, 6, 7, 9, 8, 6, 5, 5],
  Libra:       [5, 6, 7, 8, 7, 7, 6, 7, 9, 8, 6, 5],
  Scorpio:     [5, 5, 6, 7, 8, 7, 7, 6, 7, 9, 8, 6],
  Sagittarius: [6, 5, 5, 6, 7, 8, 7, 7, 6, 7, 9, 8],
  Capricorn:   [9, 5, 5, 5, 6, 7, 8, 7, 7, 6, 7, 9],
  Aquarius:    [8, 9, 5, 5, 5, 6, 7, 8, 7, 7, 6, 7],
  Pisces:      [7, 8, 9, 5, 5, 5, 6, 7, 8, 7, 7, 6],
};

function getWesternScore(sign: WesternSign, targetDate: Date): number {
  const dayOfMonth = targetDate.getDate() - 1;
  const month = targetDate.getMonth();

  const patterns = WESTERN_DAILY_PATTERNS[sign];
  const dayScore = patterns[dayOfMonth % patterns.length];

  const monthModifiers = WESTERN_MONTHLY_MODIFIER[sign];
  const monthMod = monthModifiers[month];

  const combined = Math.round((dayScore * 0.6) + (monthMod * 0.4));
  return Math.max(1, Math.min(9, combined));
}

const LUCK_SCALE_9: Array<{ min: number; max: number; label: string; color: string; hex: string }> = [
  { min: 1, max: 1, label: 'Rough', color: 'Red', hex: '#DC2626' },
  { min: 2, max: 2, label: 'Challenging', color: 'Orange', hex: '#EA580C' },
  { min: 3, max: 3, label: 'Difficult', color: 'Amber', hex: '#B45309' },
  { min: 4, max: 4, label: 'Mixed', color: 'Yellow', hex: '#CA8A04' },
  { min: 5, max: 5, label: 'Neutral', color: 'Lime', hex: '#4D7C0F' },
  { min: 6, max: 6, label: 'Good', color: 'Green', hex: '#16A34A' },
  { min: 7, max: 7, label: 'Favorable', color: 'Blue', hex: '#2563EB' },
  { min: 8, max: 8, label: 'Very Lucky', color: 'Indigo', hex: '#4F46E5' },
  { min: 9, max: 9, label: 'Extremely Lucky', color: 'Violet', hex: '#7C3AED' },
];

function getLuckDisplay(score: number) {
  const entry = LUCK_SCALE_9.find(e => score >= e.min && score <= e.max);
  return entry ?? LUCK_SCALE_9[4];
}

export function parseBirthdate(birthdate: string): { month: number; day: number; year: number } | null {
  if (!birthdate) return null;
  const trimmed = birthdate.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return {
      month: parseInt(usMatch[1], 10),
      day: parseInt(usMatch[2], 10),
      year: parseInt(usMatch[3], 10),
    };
  }

  return null;
}

export function calculatePersonalizedLuck(birthdate: string, targetDateStr: string): HoroscopeLuckResult | null {
  const parsed = parseBirthdate(birthdate);
  if (!parsed) return null;

  const { month, day, year } = parsed;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;

  const targetDate = new Date(`${targetDateStr}T12:00:00`);
  if (isNaN(targetDate.getTime())) return null;

  const birthAnimal = getChineseAnimal(year);
  const chineseScore = getChineseScore(birthAnimal, targetDate);

  const westernSign = getWesternSign(month, day);
  const westernScore = getWesternScore(westernSign, targetDate);

  const combinedScore = Math.round((chineseScore + westernScore) / 2);
  const display = getLuckDisplay(combinedScore);

  const chineseDisplay = getLuckDisplay(chineseScore);
  const westernDisplay = getLuckDisplay(westernScore);

  return {
    chineseScore,
    chineseAnimal: birthAnimal,
    chineseDescription: `${birthAnimal} – ${chineseDisplay.label}`,
    westernScore,
    westernSign,
    westernDescription: `${westernSign} – ${westernDisplay.label}`,
    combinedScore,
    combinedColor: display.color,
    combinedHex: display.hex,
    combinedLabel: display.label,
  };
}

export function getPersonalizedLuckForDate(
  birthdate: string | undefined,
  dateStr: string,
): { score: number; hex: string; label: string; color: string } | null {
  if (!birthdate) return null;
  const result = calculatePersonalizedLuck(birthdate, dateStr);
  if (!result) return null;
  return {
    score: result.combinedScore,
    hex: result.combinedHex,
    label: result.combinedLabel,
    color: result.combinedColor,
  };
}
