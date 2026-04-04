import { getEarthRoosterLuck2026Digit } from '@/constants/earthRoosterLuck2026';

export function createDateFromString(dateString: string): Date {
  if (!dateString) {
    console.warn('[date] Empty date string provided');
    return new Date();
  }

  // Handle MM-DD-YYYY format (primary format)
  const dashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Handle US date format (M/D/YY or MM/DD/YYYY)
  const slashMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const [, month, day, yearStr] = slashMatch;
    const year = yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }

  // Handle ISO date format (YYYY-MM-DD) by parsing components to avoid timezone issues
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Handle "Mon DD, YYYY" format (e.g., "Mar 16, 2026", "Jan 7, 2026")
  const shortMonthNames: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  const monthNameMatch = dateString.match(/^(\w{3})\s+(\d{1,2}),?\s*(\d{4})/);
  if (monthNameMatch) {
    const monthIdx = shortMonthNames[monthNameMatch[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const day = parseInt(monthNameMatch[2], 10);
      const year = parseInt(monthNameMatch[3], 10);
      return new Date(year, monthIdx, day);
    }
  }

  // Handle full month names (e.g., "March 16, 2026")
  const fullMonthNames: Record<string, number> = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };
  const fullMonthMatch = dateString.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/i);
  if (fullMonthMatch) {
    const monthIdx = fullMonthNames[fullMonthMatch[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const day = parseInt(fullMonthMatch[2], 10);
      const year = parseInt(fullMonthMatch[3], 10);
      return new Date(year, monthIdx, day);
    }
  }

  // Handle YYYYMMDD format (8 digits, e.g., "20260316")
  const compactMatch = dateString.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    console.warn('[date] Invalid date string:', dateString);
    return new Date();
  }
  
  return date;
}

export function formatDateMDY(date: Date | string, separator: '-' | '/' = '/'): string {
  const d = typeof date === 'string' ? createDateFromString(date) : date;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${month}${separator}${day}${separator}${year}`;
}

export function formatDateMMDDYYYY(date: Date | string): string {
  const d = typeof date === 'string' ? createDateFromString(date) : date;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${month}/${day}/${year}`;
}

export function formatDate(date: Date | string, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
  const d = typeof date === 'string' ? createDateFromString(date) : date;
  
  switch (format) {
    case 'short':
      const shortMonth = String(d.getMonth() + 1);
      const shortDay = String(d.getDate());
      return `${shortMonth}/${shortDay}`;
    case 'medium':
      const mediumMonth = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      return `${mediumMonth} ${d.getDate()}, ${d.getFullYear()}`;
    case 'long':
      const longWeekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const longMonth = d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
      return `${longWeekday}, ${longMonth} ${d.getDate()}, ${d.getFullYear()}`;
    case 'full':
      return formatDateMMDDYYYY(d);
    default:
      return formatDateMMDDYYYY(d);
  }
}

export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  const start = typeof startDate === 'string' ? createDateFromString(startDate) : startDate;
  const end = typeof endDate === 'string' ? createDateFromString(endDate) : endDate;
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  
  if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }
  
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
  }
  
  return `${formatDate(start, 'medium')} - ${formatDate(end, 'medium')}`;
}

export function getDaysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? createDateFromString(startDate) : startDate;
  const end = typeof endDate === 'string' ? createDateFromString(endDate) : endDate;
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function getDaysUntil(date: Date | string): number {
  const targetDate = typeof date === 'string' ? createDateFromString(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function isDateInPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? createDateFromString(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(d);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
}

export function isDateInFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? createDateFromString(date) : date;
  return d > new Date();
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? createDateFromString(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getRelativeTimeString(date: Date | string): string {
  const d = typeof date === 'string' ? createDateFromString(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  if (diffDays > 7 && diffDays <= 30) return `In ${Math.round(diffDays / 7)} weeks`;
  if (diffDays < -7 && diffDays >= -30) return `${Math.round(Math.abs(diffDays) / 7)} weeks ago`;
  
  return formatDate(d, 'medium');
}

const TAROT_LUCK_VALUES: number[] = [
  85, 92, 78, 88, 82, 74, 90, 87, 80, 68, 93,
  75, 65, 72, 79, 62, 58, 91, 66, 98, 84, 96,
];

function buildBirthdate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day, 8, 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatBirthdateForStorage(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
}

export function formatBirthdateForDisplay(input: string | Date | null | undefined): string {
  const parsedDate = parseBirthdate(input);
  if (!parsedDate) {
    return typeof input === 'string' ? input.trim() : '';
  }

  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const year = String(parsedDate.getFullYear());
  return `${month}/${day}/${year}`;
}

export function parseBirthdate(input: string | Date | null | undefined): Date | null {
  if (!input) {
    return null;
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return null;
    }

    return buildBirthdate(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }

  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const normalizedDateOnly = trimmedInput.includes('T')
    ? trimmedInput.split('T')[0]
    : trimmedInput;
  const compactInput = normalizedDateOnly.replace(/\s+/g, '');

  const yearFirstMatch = compactInput.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirstMatch) {
    const year = Number(yearFirstMatch[1]);
    const month = Number(yearFirstMatch[2]);
    const day = Number(yearFirstMatch[3]);
    return buildBirthdate(year, month, day);
  }

  const monthFirstMatch = compactInput.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (monthFirstMatch) {
    const month = Number(monthFirstMatch[1]);
    const day = Number(monthFirstMatch[2]);
    const yearSuffix = Number(monthFirstMatch[3]);
    const currentYearSuffix = new Date().getFullYear() % 100;
    const year = monthFirstMatch[3].length === 2
      ? (yearSuffix > currentYearSuffix ? 1900 + yearSuffix : 2000 + yearSuffix)
      : yearSuffix;
    return buildBirthdate(year, month, day);
  }

  const numericParts = normalizedDateOnly.match(/\d+/g);
  if (numericParts && numericParts.length >= 3) {
    const [partOne, partTwo, partThree] = numericParts;

    if (partOne && partTwo && partThree) {
      if (partOne.length === 4) {
        return buildBirthdate(Number(partOne), Number(partTwo), Number(partThree));
      }

      const yearSuffix = Number(partThree);
      const currentYearSuffix = new Date().getFullYear() % 100;
      const year = partThree.length === 2
        ? (yearSuffix > currentYearSuffix ? 1900 + yearSuffix : 2000 + yearSuffix)
        : yearSuffix;

      return buildBirthdate(year, Number(partOne), Number(partTwo));
    }
  }

  const compactDigits = compactInput.replace(/\D/g, '');
  if (/^\d{8}$/.test(compactDigits)) {
    const leadingYear = Number(compactDigits.slice(0, 4));
    if (leadingYear >= 1900 && leadingYear <= 2100) {
      return buildBirthdate(
        leadingYear,
        Number(compactDigits.slice(4, 6)),
        Number(compactDigits.slice(6, 8)),
      );
    }

    return buildBirthdate(
      Number(compactDigits.slice(4, 8)),
      Number(compactDigits.slice(0, 2)),
      Number(compactDigits.slice(2, 4)),
    );
  }

  if (/^\d{6}$/.test(compactDigits)) {
    const month = Number(compactDigits.slice(0, 2));
    const day = Number(compactDigits.slice(2, 4));
    const yearSuffix = Number(compactDigits.slice(4, 6));
    const currentYearSuffix = new Date().getFullYear() % 100;
    const year = yearSuffix > currentYearSuffix ? 1900 + yearSuffix : 2000 + yearSuffix;
    return buildBirthdate(year, month, day);
  }

  const parsedDate = new Date(trimmedInput);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return buildBirthdate(parsedDate.getFullYear(), parsedDate.getMonth() + 1, parsedDate.getDate());
}

export function normalizeBirthdateInput(input: string | null | undefined): string | undefined {
  if (!input) {
    return undefined;
  }

  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return undefined;
  }

  const placeholderLikeInput =
    /^m{1,2}[/.-]d{1,2}[/.-]y{2,4}$/i.test(trimmedInput) ||
    /^y{4}[/.-]m{1,2}[/.-]d{1,2}$/i.test(trimmedInput);

  if (placeholderLikeInput) {
    console.warn('[date] Birthdate placeholder provided instead of a real date:', trimmedInput);
    return undefined;
  }

  const parsedDate = parseBirthdate(trimmedInput);
  if (!parsedDate) {
    console.warn('[date] Could not normalize birthdate input:', trimmedInput);
    return trimmedInput;
  }

  return formatBirthdateForStorage(parsedDate);
}

const MS_IN_DAY = 86400000;
const LUCK_SCORE_FLOOR = 8;
const LUCK_SCORE_CEILING = 96;
const YEARLY_LUCK_SCORE_CACHE = new Map<string, Map<string, number>>();

function normalizeLuckDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function getLuckDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysInYear(year: number): number {
  const start = new Date(year, 0, 1, 12, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 12, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / MS_IN_DAY);
}

function getDayOfYear(date: Date): number {
  const normalizedDate = normalizeLuckDate(date);
  const start = new Date(normalizedDate.getFullYear(), 0, 0, 12, 0, 0, 0);
  return Math.round((normalizedDate.getTime() - start.getTime()) / MS_IN_DAY);
}

function reduceToSingleDigit(value: number): number {
  let result = Math.abs(Math.trunc(value));

  while (result > 9) {
    result = String(result)
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
  }

  return Math.max(1, result);
}

function getApproxLunarPhase(date: Date): number {
  const normalizedDate = normalizeLuckDate(date);
  const referenceMoon = Date.UTC(2000, 0, 6, 18, 14, 0, 0);
  const daysSinceReference = (normalizedDate.getTime() - referenceMoon) / MS_IN_DAY;
  const synodicMonth = 29.530588853;
  const phase = daysSinceReference / synodicMonth;
  return ((phase % 1) + 1) % 1;
}

function getBirthdayAnchorForYear(year: number, birthdate: Date): Date {
  const daysInBirthMonth = new Date(year, birthdate.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(birthdate.getDate(), daysInBirthMonth);
  return new Date(year, birthdate.getMonth(), safeDay, 12, 0, 0, 0);
}

function getWrappedDayDistance(dayA: number, dayB: number, totalDays: number): number {
  const directDistance = Math.abs(dayA - dayB);
  return Math.min(directDistance, totalDays - directDistance);
}

function getTarotLuck(birthdate: Date, selectedDate: Date): number {
  const seed =
    birthdate.getFullYear() +
    birthdate.getMonth() * 13 +
    birthdate.getDate() * 7 +
    (selectedDate.getFullYear() * 3 +
      selectedDate.getMonth() * 17 +
      selectedDate.getDate() * 11);
  const index = ((seed % TAROT_LUCK_VALUES.length) + TAROT_LUCK_VALUES.length) % TAROT_LUCK_VALUES.length;
  return TAROT_LUCK_VALUES[index] ?? TAROT_LUCK_VALUES[0];
}

function calculateCalendarLuckSignal(birthdate: Date, selectedDate: Date): number {
  const normalizedDate = normalizeLuckDate(selectedDate);
  const year = normalizedDate.getFullYear();
  const monthIndex = normalizedDate.getMonth();
  const month = monthIndex + 1;
  const day = normalizedDate.getDate();
  const weekday = normalizedDate.getDay();
  const dayOfYear = getDayOfYear(normalizedDate);
  const daysInYear = getDaysInYear(year);
  const weekOfMonth = Math.ceil(day / 7);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const tarotLuck = getTarotLuck(birthdate, normalizedDate);

  const weekdayWeights = [-7, 1, 6, -4, 5, 2, -5];
  const monthWeights = [2, -4, 5, 1, -2, 4, -5, 3, -1, 0, 6, -3];
  const quarterWeights = [3, -2, 2, -1];
  const quarterIndex = Math.floor(monthIndex / 3);

  const calendarDigit = reduceToSingleDigit(
    year +
      month * 17 +
      day * 31 +
      birthdate.getFullYear() +
      (birthdate.getMonth() + 1) * 13 +
      birthdate.getDate() * 7,
  );

  const numerologySignal = (calendarDigit - 5) * 3.2;
  const yearlyWave = Math.sin(((dayOfYear + birthdate.getDate() * 5) / daysInYear) * Math.PI * 2) * 13;
  const halfYearWave = Math.cos(((dayOfYear * 2 + (birthdate.getMonth() + 1) * 11) / daysInYear) * Math.PI * 2) * 8;
  const intraMonthWave = Math.sin(((day + weekday + birthdate.getDay()) / daysInMonth) * Math.PI * 2) * 5;
  const lunarPhase = getApproxLunarPhase(normalizedDate);
  const lunarSignal = Math.cos(lunarPhase * Math.PI * 2) * 4 + Math.sin(lunarPhase * Math.PI * 4) * 3;

  const birthdayAnchor = getBirthdayAnchorForYear(year, birthdate);
  const birthdayDistance = getWrappedDayDistance(dayOfYear, getDayOfYear(birthdayAnchor), daysInYear);
  const birthdaySignal = Math.cos((birthdayDistance / daysInYear) * Math.PI * 2) * 6;
  const tarotSignal = (tarotLuck - 78) * 0.55;
  const calendarEdgeSignal = day === 1 || day === daysInMonth ? -2.5 : 0;
  const weekPatternSignal = weekOfMonth === 5 ? 2.25 : weekOfMonth === 1 ? -1.5 : 0;
  const weekendSignal = weekday === 0 || weekday === 6 ? 1.75 : 0;

  return (
    (weekdayWeights[weekday] ?? 0) +
    (monthWeights[monthIndex] ?? 0) +
    (quarterWeights[quarterIndex] ?? 0) +
    numerologySignal +
    yearlyWave +
    halfYearWave +
    intraMonthWave +
    lunarSignal +
    birthdaySignal +
    tarotSignal +
    calendarEdgeSignal +
    weekPatternSignal +
    weekendSignal
  );
}

function buildYearlyLuckScoreMap(birthdate: Date, year: number): Map<string, number> {
  const totalDays = getDaysInYear(year);
  const rawCalendarReadings: { date: Date; rawScore: number }[] = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = new Date(year, 0, dayIndex + 1, 12, 0, 0, 0);
    rawCalendarReadings.push({
      date,
      rawScore: calculateCalendarLuckSignal(birthdate, date),
    });
  }

  const sortedReadings = [...rawCalendarReadings].sort((a, b) => {
    if (a.rawScore === b.rawScore) {
      return a.date.getTime() - b.date.getTime();
    }

    return a.rawScore - b.rawScore;
  });

  const scoreMap = new Map<string, number>();
  const rankDenominator = Math.max(1, sortedReadings.length - 1);
  const minRawScore = sortedReadings[0]?.rawScore ?? 0;
  const maxRawScore = sortedReadings[sortedReadings.length - 1]?.rawScore ?? minRawScore;

  sortedReadings.forEach((reading, index) => {
    const percentile = rankDenominator === 0 ? 0.5 : index / rankDenominator;
    const normalizedRaw = maxRawScore === minRawScore
      ? 0.5
      : (reading.rawScore - minRawScore) / (maxRawScore - minRawScore);
    const blendedPosition = percentile * 0.82 + normalizedRaw * 0.18;
    const score = Math.round(
      LUCK_SCORE_FLOOR + blendedPosition * (LUCK_SCORE_CEILING - LUCK_SCORE_FLOOR),
    );

    scoreMap.set(getLuckDateKey(reading.date), score);
  });

  return scoreMap;
}

function getYearlyLuckScoreMap(birthdate: Date, year: number): Map<string, number> {
  const cacheKey = `${formatBirthdateForStorage(birthdate)}:${year}`;
  const cachedScores = YEARLY_LUCK_SCORE_CACHE.get(cacheKey);
  if (cachedScores) {
    return cachedScores;
  }

  const yearlyScores = buildYearlyLuckScoreMap(birthdate, year);
  YEARLY_LUCK_SCORE_CACHE.set(cacheKey, yearlyScores);
  return yearlyScores;
}

export function getDailyLuckScoreForDate(
  birthdateInput: string | Date | null | undefined,
  selectedDate: Date,
): number | null {
  const birthdate = parseBirthdate(birthdateInput);
  if (!birthdate || Number.isNaN(selectedDate.getTime())) {
    return null;
  }

  const normalizedDate = normalizeLuckDate(selectedDate);
  const earthRoosterDigit = getEarthRoosterLuck2026Digit(normalizedDate);
  if (earthRoosterDigit !== null) {
    console.log('[date] Using Earth Rooster 2026 luck calendar override:', {
      date: getLuckDateKey(normalizedDate),
      luckNumber: earthRoosterDigit,
    });
    return Math.round((earthRoosterDigit / 9) * 100);
  }

  const yearlyScores = getYearlyLuckScoreMap(birthdate, normalizedDate.getFullYear());
  return yearlyScores.get(getLuckDateKey(normalizedDate)) ?? null;
}

export function getDailyLuckDigitForDate(
  birthdateInput: string | Date | null | undefined,
  selectedDate: Date,
): number | null {
  if (Number.isNaN(selectedDate.getTime())) {
    return null;
  }

  const normalizedDate = normalizeLuckDate(selectedDate);
  const earthRoosterDigit = getEarthRoosterLuck2026Digit(normalizedDate);
  if (earthRoosterDigit !== null) {
    return earthRoosterDigit;
  }

  const overallScore = getDailyLuckScoreForDate(birthdateInput, normalizedDate);
  if (overallScore === null) {
    return null;
  }

  return Math.min(9, Math.max(1, Math.ceil(overallScore / (100 / 9))));
}

export function getLuckDigitColor(digit: number): string {
  if (digit <= 1) return '#DC2626';
  if (digit === 2) return '#F97316';
  if (digit === 3) return '#F59E0B';
  if (digit === 4) return '#EAB308';
  if (digit === 5) return '#22C55E';
  if (digit === 6) return '#14B8A6';
  if (digit === 7) return '#3B82F6';
  if (digit === 8) return '#4F46E5';
  return '#7C3AED';
}

export function getLuckDigitLabel(digit: number): string {
  if (digit <= 2) return 'LOW';
  if (digit <= 4) return 'RISING';
  if (digit <= 6) return 'BALANCED';
  if (digit <= 8) return 'STRONG';
  return 'PEAK';
}

export function getLuckColor(score: number): [string, string] {
  if (score >= 90) return ['#F59E0B', '#EF4444'];
  if (score >= 75) return ['#10B981', '#059669'];
  if (score >= 60) return ['#3B82F6', '#1D4ED8'];
  if (score >= 45) return ['#8B5CF6', '#6D28D9'];
  return ['#6B7280', '#4B5563'];
}

export function getLuckLabel(score: number): string {
  if (score >= 95) return 'EXCEPTIONAL LUCK';
  if (score >= 85) return 'HIGHLY AUSPICIOUS';
  if (score >= 75) return 'FAVORABLE';
  if (score >= 65) return 'PROMISING';
  if (score >= 50) return 'NEUTRAL';
  if (score >= 35) return 'CAUTION ADVISED';
  return 'CHALLENGING DAY';
}

export function getLuckStars(score: number): string {
  if (score >= 90) return '★★★★★';
  if (score >= 75) return '★★★★☆';
  if (score >= 60) return '★★★☆☆';
  if (score >= 40) return '★★☆☆☆';
  return '★☆☆☆☆';
}
