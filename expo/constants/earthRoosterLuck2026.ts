const EARTH_ROOSTER_LUCK_2026_DIGITS = '55892994445788998278899828448894889558541999874199987914227427955192124447841887178277581875557252772194455819445581275142751948214475584447558487111785578825722999458144275814427197895182122445841187584118717822458252272994445842755194445512951898224477581871117187111727577822721199458114245811425198844982112475844181178827821887578255271994445142775114277518444';

const EARTH_ROOSTER_START = new Date(2026, 0, 1, 12, 0, 0, 0);
const MS_IN_DAY = 86400000;

const DIGIT_TO_COLOR: Record<number, string> = {
  1: 'red',
  2: 'orange',
  4: 'yellow',
  5: 'green',
  7: 'blue',
  8: 'indigo',
  9: 'violet',
};

const DIGIT_TO_TONE: Record<number, string> = {
  1: 'rough',
  2: 'challenging',
  4: 'mixed',
  5: 'good',
  7: 'favorable',
  8: 'very lucky',
  9: 'extremely lucky',
};

function normalizeEarthRoosterDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function getEarthRoosterDayIndex(date: Date): number {
  const normalizedDate = normalizeEarthRoosterDate(date);
  return Math.round((normalizedDate.getTime() - EARTH_ROOSTER_START.getTime()) / MS_IN_DAY);
}

export interface EarthRoosterLuck2026Entry {
  dateKey: string;
  luckNumber: number;
  color: string;
  tone: string;
  description: string;
}

export function getEarthRoosterLuck2026Entry(date: Date): EarthRoosterLuck2026Entry | null {
  const normalizedDate = normalizeEarthRoosterDate(date);
  if (normalizedDate.getFullYear() !== 2026) {
    return null;
  }

  const dayIndex = getEarthRoosterDayIndex(normalizedDate);
  if (dayIndex < 0 || dayIndex >= EARTH_ROOSTER_LUCK_2026_DIGITS.length) {
    return null;
  }

  const digit = Number(EARTH_ROOSTER_LUCK_2026_DIGITS[dayIndex]);
  const color = DIGIT_TO_COLOR[digit];
  const tone = DIGIT_TO_TONE[digit];

  if (!color || !tone) {
    return null;
  }

  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const day = String(normalizedDate.getDate()).padStart(2, '0');
  const dateKey = `${normalizedDate.getFullYear()}-${month}-${day}`;

  return {
    dateKey,
    luckNumber: digit,
    color,
    tone,
    description: `2026 Earth Rooster luck color for ${dateKey}: ${color.charAt(0).toUpperCase()}${color.slice(1)} (${tone}) on the ROYGBIV scale.`,
  };
}

export function getEarthRoosterLuck2026Digit(date: Date): number | null {
  return getEarthRoosterLuck2026Entry(date)?.luckNumber ?? null;
}
