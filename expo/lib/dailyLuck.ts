import {
  formatBirthdateForStorage,
  getDailyLuckDigitForDate,
  parseBirthdate,
} from '@/lib/date';
import { deriveChineseSignFromBirthDate, deriveWesternSignFromBirthDate } from '@/lib/dailyLuck/signs';
import { trpcClient } from '@/lib/trpc';
import type { DailyLuckAnalysisResponse, DailyLuckEntry, DailyLuckReadings, DailyLuckScoreBreakdown } from '@/types/daily-luck';

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
    chinese: `Chinese daily reading for ${chineseSign}: this is the saved calendar version of your luck data. It keeps your day usable across the app even when the live engine is not running.`,
    western: `Western daily reading for ${westernSign}: the local fallback keeps your calendar populated, but the live card on the day agenda will fetch current source text and confidence when available.`,
    tarot: `Sky, love, and yearly modifier: the local fallback stays conservative so the stored luck number remains stable inside the calendar experience.`,
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
  const luckNumber = clampScore(getDailyLuckDigitForDate(birthdate, normalizedDate) ?? 5);
  const scoreBreakdown = buildFallbackScoreBreakdown(luckNumber);

  console.log('[DailyLuck] Built fallback daily luck entry:', {
    dateKey,
    westernSign,
    chineseSign,
    luckNumber,
  });

  return {
    dateKey,
    birthdate: normalizedBirthdate,
    year: normalizedDate.getFullYear(),
    generatedAt: new Date().toISOString(),
    source: 'fallback',
    westernSign,
    chineseSign,
    tarotCard: 'Local fallback',
    luckNumber,
    luckScore: Math.round((luckNumber / 9) * 100),
    scoreBreakdown,
    readings: buildFallbackReadings(westernSign, chineseSign, luckNumber),
  };
}

export function buildDailyLuckEntryFromAnalysis(analysis: DailyLuckAnalysisResponse): DailyLuckEntry {
  const luckyNumber = clampScore(analysis.luckScore);
  const modifierAverage = Math.round((
    analysis.breakdown.skyToday.score +
    analysis.breakdown.loveDaily.score +
    analysis.breakdown.yearlyChinese.score
  ) / 3);

  return {
    dateKey: analysis.date,
    birthdate: analysis.profile.birthDate,
    year: Number(analysis.date.slice(0, 4)),
    generatedAt: new Date().toISOString(),
    source: 'live',
    westernSign: analysis.profile.westernSign,
    chineseSign: analysis.profile.chineseSign,
    tarotCard: 'Live synthesis',
    luckNumber: luckyNumber,
    luckScore: Math.round((analysis.luckScore / 9) * 100),
    scoreBreakdown: {
      chinese: analysis.breakdown.chineseDaily.score,
      western: analysis.breakdown.westernDaily.score,
      tarot: modifierAverage,
    },
    readings: {
      chinese: analysis.breakdown.chineseDaily.reason,
      western: analysis.breakdown.westernDaily.reason,
      tarot: `${analysis.breakdown.skyToday.reason} ${analysis.breakdown.loveDaily.reason} ${analysis.breakdown.yearlyChinese.reason}`.trim(),
      synthesis: analysis.summary,
    },
  };
}

export async function fetchLiveDailyLuckAnalysis(params: {
  date: string;
  birthDate: string;
  birthplace?: string;
  displayName?: string;
  westernSign?: string;
  chineseSign?: string;
  skyTodayUrl?: string;
}): Promise<DailyLuckAnalysisResponse | null> {
  try {
    const response = await trpcClient.dailyLuck.getLive.query({
      date: params.date,
      birthDate: params.birthDate,
      birthplace: params.birthplace,
      displayName: params.displayName,
      westernSign: params.westernSign,
      chineseSign: params.chineseSign,
      skyTodayUrl: params.skyTodayUrl,
    });

    console.log('[DailyLuck] Live daily luck analysis fetched:', {
      date: params.date,
      westernSign: response.profile.westernSign,
      chineseSign: response.profile.chineseSign,
      score: response.luckScore,
      confidence: response.confidence,
    });

    return response;
  } catch (error) {
    console.log('[DailyLuck] Live daily luck analysis failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export function hasTransparentDailyLuckEntry(entry: DailyLuckEntry | null | undefined): boolean {
  return !!entry?.scoreBreakdown &&
    typeof entry.scoreBreakdown.chinese === 'number' &&
    typeof entry.scoreBreakdown.western === 'number' &&
    typeof entry.scoreBreakdown.tarot === 'number';
}

export async function generateDailyLuckEntriesForYear(
  birthdateInput: string | Date | null | undefined,
  year: number,
): Promise<Record<string, DailyLuckEntry>> {
  const birthdate = parseBirthdate(birthdateInput);
  if (!birthdate) {
    return {};
  }

  const entriesByDate: Record<string, DailyLuckEntry> = {};

  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const entry = buildLocalDailyLuckEntry(birthdate, new Date(year, month, day, 12, 0, 0, 0));
      if (entry) {
        entriesByDate[entry.dateKey] = entry;
      }
    }
  }

  console.log('[DailyLuck] Generated fallback yearly entries:', {
    birthdate: formatBirthdateForStorage(birthdate),
    year,
    totalEntries: Object.keys(entriesByDate).length,
  });

  return entriesByDate;
}
