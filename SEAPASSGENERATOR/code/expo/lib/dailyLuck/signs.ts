import { parseBirthdate } from '@/lib/date';

const WESTERN_SIGN_RANGES = [
  { sign: 'capricorn', start: [12, 22], end: [1, 19] },
  { sign: 'aquarius', start: [1, 20], end: [2, 18] },
  { sign: 'pisces', start: [2, 19], end: [3, 20] },
  { sign: 'aries', start: [3, 21], end: [4, 19] },
  { sign: 'taurus', start: [4, 20], end: [5, 20] },
  { sign: 'gemini', start: [5, 21], end: [6, 20] },
  { sign: 'cancer', start: [6, 21], end: [7, 22] },
  { sign: 'leo', start: [7, 23], end: [8, 22] },
  { sign: 'virgo', start: [8, 23], end: [9, 22] },
  { sign: 'libra', start: [9, 23], end: [10, 22] },
  { sign: 'scorpio', start: [10, 23], end: [11, 21] },
  { sign: 'sagittarius', start: [11, 22], end: [12, 21] },
] as const;

const CHINESE_SIGNS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'] as const;

function isDateInRange(month: number, day: number, startMonth: number, startDay: number, endMonth: number, endDay: number): boolean {
  if (startMonth > endMonth) {
    return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay) || month > startMonth || month < endMonth;
  }

  if (month < startMonth || month > endMonth) {
    return false;
  }

  if (month === startMonth && day < startDay) {
    return false;
  }

  if (month === endMonth && day > endDay) {
    return false;
  }

  return true;
}

export function normalizeSignSlug(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function deriveWesternSignFromBirthDate(input: string | Date | null | undefined): string | null {
  const birthdate = parseBirthdate(input);
  if (!birthdate) {
    return null;
  }

  const month = birthdate.getMonth() + 1;
  const day = birthdate.getDate();

  for (const range of WESTERN_SIGN_RANGES) {
    if (isDateInRange(month, day, range.start[0], range.start[1], range.end[0], range.end[1])) {
      return range.sign;
    }
  }

  return 'capricorn';
}

export function deriveChineseSignFromBirthDate(input: string | Date | null | undefined): string | null {
  const birthdate = parseBirthdate(input);
  if (!birthdate) {
    return null;
  }

  const index = ((birthdate.getFullYear() - 4) % CHINESE_SIGNS.length + CHINESE_SIGNS.length) % CHINESE_SIGNS.length;
  return CHINESE_SIGNS[index] ?? 'rat';
}
