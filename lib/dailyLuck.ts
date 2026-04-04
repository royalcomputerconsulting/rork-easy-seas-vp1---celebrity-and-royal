import {
  formatBirthdateForStorage,
  getDailyLuckDigitForDate,
  parseBirthdate,
} from '@/lib/date';
import { getEarthRoosterLuck2026Entry } from '@/constants/earthRoosterLuck2026';
import { deriveChineseSignFromBirthDate, deriveWesternSignFromBirthDate } from '@/lib/dailyLuck/signs';
import type { DailyLuckEntry, DailyLuckReadings, DailyLuckScoreBreakdown } from '@/types/daily-luck';

function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

export function getDailyLuckDateKey(date: Date): string {
  const normalized = normalizeDate(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(9, Math.round(value)));
}

function buildFallbackScoreBreakdown(luckNumber: number): DailyLuckScoreBreakdown {
  return {
    chinese: clampScore(luckNumber - 1),
    western: clampScore(luckNumber),
    tarot: clampScore(luckNumber + (luckNumber >= 6 ? 1 : 0)),
  };
}

function buildFallbackReadings(westernSign: string, chineseSign: string, luckNumber: number): DailyLuckReadings {
  const scoreLabel = luckNumber >= 7
    ? 'The day leans supportive, but it still pays to move deliberately.'
    : luckNumber >= 5
    ? 'The day looks balanced, so your timing matters more than force.'
    : 'The day leans cautious, so patience and clean choices matter most.';

  return {
    chinese: `Chinese daily reading for ${chineseSign}: this is the saved calendar version of your luck data.`,
    western: `Western daily reading for ${westernSign}: the local fallback keeps your calendar populated.`,
    tarot: `Sky, love, and yearly modifier: the local fallback stays conservative so the stored luck number remains stable.`,
    synthesis: `Lucky Day # ${luckNumber}: ${scoreLabel}`,
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
  const westernSign = deriveWesternSignFromBirthDate(birthdate) ?? 'aries';
  const chineseSign = deriveChineseSignFromBirthDate(birthdate) ?? 'rooster';
  const earthRoosterEntry = getEarthRoosterLuck2026Entry(normalizedDate);
  const luckNumber = clampScore(earthRoosterEntry?.luckNumber ?? getDailyLuckDigitForDate(birthdate, normalizedDate) ?? 5);
  const scoreBreakdown = buildFallbackScoreBreakdown(luckNumber);

  console.log('[DailyLuck] Built fallback daily luck entry:', { dateKey, westernSign, chineseSign, luckNumber });

  return {
    dateKey,
    birthdate: normalizedBirthdate,
    year: normalizedDate.getFullYear(),
    generatedAt: new Date().toISOString(),
    source: 'fallback',
    westernSign,
    chineseSign,
    tarotCard: earthRoosterEntry ? 'Earth Rooster 2026' : 'Local fallback',
    luckNumber,
    luckScore: Math.round((luckNumber / 9) * 100),
    scoreBreakdown,
    readings: earthRoosterEntry
      ? {
          ...buildFallbackReadings(westernSign, chineseSign, luckNumber),
          tarot: earthRoosterEntry.description,
          synthesis: `Lucky Day # ${luckNumber}: ${earthRoosterEntry.color.charAt(0).toUpperCase()}${earthRoosterEntry.color.slice(1)} ${earthRoosterEntry.tone} Earth Rooster day.`,
        }
      : buildFallbackReadings(westernSign, chineseSign, luckNumber),
  };
}

export function hasTransparentDailyLuckEntry(entry: DailyLuckEntry | null | undefined): boolean {
  return !!entry?.scoreBreakdown &&
    typeof entry.scoreBreakdown.chinese === 'number' &&
    typeof entry.scoreBreakdown.western === 'number' &&
    typeof entry.scoreBreakdown.tarot === 'number';
}
