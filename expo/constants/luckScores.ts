export type LuckColor = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Indigo' | 'Violet';

export interface LuckInfo {
  color: LuckColor;
  label: string;
  score: number;
  hex: string;
}

export const LUCK_SCALE: Record<LuckColor, LuckInfo> = {
  Red: { color: 'Red', label: 'Rough', score: 1, hex: '#DC2626' },
  Orange: { color: 'Orange', label: 'Challenging', score: 2, hex: '#EA580C' },
  Yellow: { color: 'Yellow', label: 'Mixed', score: 3, hex: '#CA8A04' },
  Green: { color: 'Green', label: 'Good', score: 4, hex: '#16A34A' },
  Blue: { color: 'Blue', label: 'Favorable', score: 5, hex: '#2563EB' },
  Indigo: { color: 'Indigo', label: 'Very Lucky', score: 6, hex: '#4F46E5' },
  Violet: { color: 'Violet', label: 'Extremely Lucky', score: 7, hex: '#7C3AED' },
};

export const LUCK_DATA_2026: Record<string, LuckColor> = {
  '2026-01-01': 'Green', '2026-01-02': 'Green', '2026-01-03': 'Indigo', '2026-01-04': 'Violet',
  '2026-01-05': 'Orange', '2026-01-06': 'Violet', '2026-01-07': 'Violet', '2026-01-08': 'Yellow',
  '2026-01-09': 'Yellow', '2026-01-10': 'Yellow', '2026-01-11': 'Green', '2026-01-12': 'Blue',
  '2026-01-13': 'Indigo', '2026-01-14': 'Indigo', '2026-01-15': 'Violet', '2026-01-16': 'Violet',
  '2026-01-17': 'Indigo', '2026-01-18': 'Orange', '2026-01-19': 'Blue', '2026-01-20': 'Indigo',
  '2026-01-21': 'Indigo', '2026-01-22': 'Violet', '2026-01-23': 'Violet', '2026-01-24': 'Indigo',
  '2026-01-25': 'Orange', '2026-01-26': 'Indigo', '2026-01-27': 'Yellow', '2026-01-28': 'Yellow',
  '2026-01-29': 'Indigo', '2026-01-30': 'Indigo', '2026-01-31': 'Violet',
  '2026-02-01': 'Yellow', '2026-02-02': 'Indigo', '2026-02-03': 'Indigo', '2026-02-04': 'Violet',
  '2026-02-05': 'Green', '2026-02-06': 'Green', '2026-02-07': 'Indigo', '2026-02-08': 'Green',
  '2026-02-09': 'Yellow', '2026-02-10': 'Red', '2026-02-11': 'Violet', '2026-02-12': 'Violet',
  '2026-02-13': 'Violet', '2026-02-14': 'Indigo', '2026-02-15': 'Blue', '2026-02-16': 'Yellow',
  '2026-02-17': 'Red', '2026-02-18': 'Violet', '2026-02-19': 'Violet', '2026-02-20': 'Violet',
  '2026-02-21': 'Indigo', '2026-02-22': 'Blue', '2026-02-23': 'Violet', '2026-02-24': 'Red',
  '2026-02-25': 'Yellow', '2026-02-26': 'Orange', '2026-02-27': 'Orange', '2026-02-28': 'Blue',
  '2026-03-01': 'Yellow', '2026-03-02': 'Orange', '2026-03-03': 'Blue', '2026-03-04': 'Violet',
  '2026-03-05': 'Green', '2026-03-06': 'Green', '2026-03-07': 'Red', '2026-03-08': 'Violet',
  '2026-03-09': 'Orange', '2026-03-10': 'Red', '2026-03-11': 'Orange', '2026-03-12': 'Yellow',
  '2026-03-13': 'Yellow', '2026-03-14': 'Yellow', '2026-03-15': 'Blue', '2026-03-16': 'Indigo',
  '2026-03-17': 'Yellow', '2026-03-18': 'Red', '2026-03-19': 'Indigo', '2026-03-20': 'Indigo',
  '2026-03-21': 'Blue', '2026-03-22': 'Red', '2026-03-23': 'Blue', '2026-03-24': 'Indigo',
  '2026-03-25': 'Orange', '2026-03-26': 'Blue', '2026-03-27': 'Blue', '2026-03-28': 'Green',
  '2026-03-29': 'Indigo', '2026-03-30': 'Red', '2026-03-31': 'Indigo',
  '2026-04-01': 'Blue', '2026-04-02': 'Green', '2026-04-03': 'Green', '2026-04-04': 'Green',
  '2026-04-05': 'Blue', '2026-04-06': 'Orange', '2026-04-07': 'Green', '2026-04-08': 'Orange',
  '2026-04-09': 'Blue', '2026-04-10': 'Blue', '2026-04-11': 'Orange', '2026-04-12': 'Red',
  '2026-04-13': 'Violet', '2026-04-14': 'Yellow', '2026-04-15': 'Yellow', '2026-04-16': 'Green',
  '2026-04-17': 'Green', '2026-04-18': 'Indigo', '2026-04-19': 'Red', '2026-04-20': 'Violet',
  '2026-04-21': 'Yellow', '2026-04-22': 'Yellow', '2026-04-23': 'Green', '2026-04-24': 'Green',
  '2026-04-25': 'Indigo', '2026-04-26': 'Red', '2026-04-27': 'Orange', '2026-04-28': 'Blue',
  '2026-04-29': 'Green', '2026-04-30': 'Red',
  '2026-05-01': 'Yellow', '2026-05-02': 'Orange', '2026-05-03': 'Blue', '2026-05-04': 'Green',
  '2026-05-05': 'Red', '2026-05-06': 'Violet', '2026-05-07': 'Yellow', '2026-05-08': 'Indigo',
  '2026-05-09': 'Orange', '2026-05-10': 'Red', '2026-05-11': 'Yellow', '2026-05-12': 'Yellow',
  '2026-05-13': 'Blue', '2026-05-14': 'Green', '2026-05-15': 'Green', '2026-05-16': 'Indigo',
  '2026-05-17': 'Yellow', '2026-05-18': 'Yellow', '2026-05-19': 'Yellow', '2026-05-20': 'Blue',
  '2026-05-21': 'Green', '2026-05-22': 'Green', '2026-05-23': 'Indigo', '2026-05-24': 'Yellow',
  '2026-05-25': 'Indigo', '2026-05-26': 'Blue', '2026-05-27': 'Red', '2026-05-28': 'Red',
  '2026-05-29': 'Red', '2026-05-30': 'Blue', '2026-05-31': 'Indigo',
  '2026-06-01': 'Green', '2026-06-02': 'Green', '2026-06-03': 'Blue', '2026-06-04': 'Indigo',
  '2026-06-05': 'Indigo', '2026-06-06': 'Orange', '2026-06-07': 'Green', '2026-06-08': 'Blue',
  '2026-06-09': 'Orange', '2026-06-10': 'Orange', '2026-06-11': 'Violet', '2026-06-12': 'Violet',
  '2026-06-13': 'Violet', '2026-06-14': 'Yellow', '2026-06-15': 'Green', '2026-06-16': 'Indigo',
  '2026-06-17': 'Red', '2026-06-18': 'Yellow', '2026-06-19': 'Yellow', '2026-06-20': 'Orange',
  '2026-06-21': 'Blue', '2026-06-22': 'Green', '2026-06-23': 'Indigo', '2026-06-24': 'Red',
  '2026-06-25': 'Yellow', '2026-06-26': 'Yellow', '2026-06-27': 'Orange', '2026-06-28': 'Blue',
  '2026-06-29': 'Red', '2026-06-30': 'Violet',
  '2026-07-01': 'Blue', '2026-07-02': 'Indigo', '2026-07-03': 'Violet', '2026-07-04': 'Green',
  '2026-07-05': 'Red', '2026-07-06': 'Indigo', '2026-07-07': 'Orange', '2026-07-08': 'Red',
  '2026-07-09': 'Orange', '2026-07-10': 'Orange', '2026-07-11': 'Yellow', '2026-07-12': 'Yellow',
  '2026-07-13': 'Green', '2026-07-14': 'Indigo', '2026-07-15': 'Yellow', '2026-07-16': 'Red',
  '2026-07-17': 'Red', '2026-07-18': 'Indigo', '2026-07-19': 'Blue', '2026-07-20': 'Green',
  '2026-07-21': 'Indigo', '2026-07-22': 'Yellow', '2026-07-23': 'Red', '2026-07-24': 'Red',
  '2026-07-25': 'Indigo', '2026-07-26': 'Blue', '2026-07-27': 'Red', '2026-07-28': 'Blue',
  '2026-07-29': 'Indigo', '2026-07-30': 'Orange', '2026-07-31': 'Orange',
  '2026-08-01': 'Yellow', '2026-08-02': 'Green', '2026-08-03': 'Indigo', '2026-08-04': 'Orange',
  '2026-08-05': 'Green', '2026-08-06': 'Orange', '2026-08-07': 'Orange', '2026-08-08': 'Blue',
  '2026-08-09': 'Orange', '2026-08-10': 'Violet', '2026-08-11': 'Violet', '2026-08-12': 'Yellow',
  '2026-08-13': 'Yellow', '2026-08-14': 'Yellow', '2026-08-15': 'Green', '2026-08-16': 'Indigo',
  '2026-08-17': 'Yellow', '2026-08-18': 'Orange', '2026-08-19': 'Blue', '2026-08-20': 'Green',
  '2026-08-21': 'Green', '2026-08-22': 'Red', '2026-08-23': 'Violet', '2026-08-24': 'Yellow',
  '2026-08-25': 'Yellow', '2026-08-26': 'Yellow', '2026-08-27': 'Green', '2026-08-28': 'Green',
  '2026-08-29': 'Red', '2026-08-30': 'Orange', '2026-08-31': 'Violet',
  '2026-09-01': 'Green', '2026-09-02': 'Red', '2026-09-03': 'Indigo', '2026-09-04': 'Violet',
  '2026-09-05': 'Indigo', '2026-09-06': 'Orange', '2026-09-07': 'Orange', '2026-09-08': 'Yellow',
  '2026-09-09': 'Yellow', '2026-09-10': 'Blue', '2026-09-11': 'Blue', '2026-09-12': 'Green',
  '2026-09-13': 'Indigo', '2026-09-14': 'Red', '2026-09-15': 'Indigo', '2026-09-16': 'Blue',
  '2026-09-17': 'Red', '2026-09-18': 'Red', '2026-09-19': 'Red', '2026-09-20': 'Blue',
  '2026-09-21': 'Red', '2026-09-22': 'Indigo', '2026-09-23': 'Blue', '2026-09-24': 'Red',
  '2026-09-25': 'Red', '2026-09-26': 'Red', '2026-09-27': 'Blue', '2026-09-28': 'Orange',
  '2026-09-29': 'Blue', '2026-09-30': 'Green',
  '2026-10-01': 'Blue', '2026-10-02': 'Blue', '2026-10-03': 'Indigo', '2026-10-04': 'Orange',
  '2026-10-05': 'Orange', '2026-10-06': 'Blue', '2026-10-07': 'Orange', '2026-10-08': 'Red',
  '2026-10-09': 'Red', '2026-10-10': 'Violet', '2026-10-11': 'Violet', '2026-10-12': 'Yellow',
  '2026-10-13': 'Green', '2026-10-14': 'Indigo', '2026-10-15': 'Red', '2026-10-16': 'Red',
  '2026-10-17': 'Yellow', '2026-10-18': 'Orange', '2026-10-19': 'Yellow', '2026-10-20': 'Green',
  '2026-10-21': 'Indigo', '2026-10-22': 'Red', '2026-10-23': 'Red', '2026-10-24': 'Yellow',
  '2026-10-25': 'Orange', '2026-10-26': 'Green', '2026-10-27': 'Red', '2026-10-28': 'Violet',
  '2026-10-29': 'Indigo', '2026-10-30': 'Indigo', '2026-10-31': 'Yellow',
  '2026-11-01': 'Yellow', '2026-11-02': 'Violet', '2026-11-03': 'Indigo', '2026-11-04': 'Orange',
  '2026-11-05': 'Red', '2026-11-06': 'Red', '2026-11-07': 'Orange', '2026-11-08': 'Yellow',
  '2026-11-09': 'Blue', '2026-11-10': 'Green', '2026-11-11': 'Indigo', '2026-11-12': 'Yellow',
  '2026-11-13': 'Yellow', '2026-11-14': 'Red', '2026-11-15': 'Indigo', '2026-11-16': 'Red',
  '2026-11-17': 'Red', '2026-11-18': 'Blue', '2026-11-19': 'Indigo', '2026-11-20': 'Indigo',
  '2026-11-21': 'Orange', '2026-11-22': 'Blue', '2026-11-23': 'Indigo', '2026-11-24': 'Orange',
  '2026-11-25': 'Red', '2026-11-26': 'Indigo', '2026-11-27': 'Indigo', '2026-11-28': 'Blue',
  '2026-11-29': 'Green', '2026-11-30': 'Blue',
  '2026-12-01': 'Indigo', '2026-12-02': 'Orange', '2026-12-03': 'Green', '2026-12-04': 'Green',
  '2026-12-05': 'Orange', '2026-12-06': 'Blue', '2026-12-07': 'Red', '2026-12-08': 'Violet',
  '2026-12-09': 'Violet', '2026-12-10': 'Yellow', '2026-12-11': 'Yellow', '2026-12-12': 'Yellow',
  '2026-12-13': 'Green', '2026-12-14': 'Red', '2026-12-15': 'Yellow', '2026-12-16': 'Orange',
  '2026-12-17': 'Blue', '2026-12-18': 'Blue', '2026-12-19': 'Green', '2026-12-20': 'Red',
  '2026-12-21': 'Red', '2026-12-22': 'Yellow', '2026-12-23': 'Orange', '2026-12-24': 'Blue',
  '2026-12-25': 'Blue', '2026-12-26': 'Green', '2026-12-27': 'Red', '2026-12-28': 'Indigo',
  '2026-12-29': 'Yellow', '2026-12-30': 'Yellow', '2026-12-31': 'Yellow',
};

const LUCK_DATE_KEYS = Object.keys(LUCK_DATA_2026).sort();

function getFallbackLuckColor(date: Date): LuckColor | null {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sameMonthDayKey = `2026-${month}-${day}`;
  const sameMonthDayColor = LUCK_DATA_2026[sameMonthDayKey];
  if (sameMonthDayColor) return sameMonthDayColor;
  if (LUCK_DATE_KEYS.length === 0) return null;
  const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
  const currentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = Math.floor((currentDay - startOfYear) / 86400000);
  const normalizedIndex = ((dayOfYear % LUCK_DATE_KEYS.length) + LUCK_DATE_KEYS.length) % LUCK_DATE_KEYS.length;
  const fallbackKey = LUCK_DATE_KEYS[normalizedIndex];
  return LUCK_DATA_2026[fallbackKey] ?? null;
}

export function getLuckForDate(dateStr: string): LuckInfo | null {
  const exactColor = LUCK_DATA_2026[dateStr];
  if (exactColor) return LUCK_SCALE[exactColor];
  const parsedDate = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  const fallbackColor = getFallbackLuckColor(parsedDate);
  if (!fallbackColor) return null;
  return LUCK_SCALE[fallbackColor];
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
