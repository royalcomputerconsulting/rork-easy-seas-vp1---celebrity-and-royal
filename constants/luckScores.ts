export type LuckColor = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Indigo' | 'Violet';

export interface LuckInfo {
  color: LuckColor;
  score: number;
  label: string;
  hex: string;
}

export const LUCK_SCALE: Record<LuckColor, LuckInfo> = {
  Red: {
    color: 'Red',
    score: 1,
    label: 'Caution',
    hex: '#EF4444',
  },
  Orange: {
    color: 'Orange',
    score: 2,
    label: 'Watchful',
    hex: '#F97316',
  },
  Yellow: {
    color: 'Yellow',
    score: 3,
    label: 'Balanced',
    hex: '#EAB308',
  },
  Green: {
    color: 'Green',
    score: 5,
    label: 'Open',
    hex: '#22C55E',
  },
  Blue: {
    color: 'Blue',
    score: 6,
    label: 'Strong',
    hex: '#3B82F6',
  },
  Indigo: {
    color: 'Indigo',
    score: 8,
    label: 'Fortunate',
    hex: '#6366F1',
  },
  Violet: {
    color: 'Violet',
    score: 9,
    label: 'Peak',
    hex: '#A855F7',
  },
};

const LUCK_SEQUENCE: readonly LuckColor[] = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'];
const SCOTT_EMAILS = new Set<string>([
  'scott.merlis1@gmail.com',
  'scott.merlis4@gmail.com',
  'scott.a.merlis1@gmail.com',
]);

export function formatDateKey(value: Date | string): string {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isScottUser(isAdmin: boolean, authenticatedEmail?: string | null): boolean {
  if (isAdmin) {
    return true;
  }
  const normalizedEmail = authenticatedEmail?.trim().toLowerCase() ?? '';
  return SCOTT_EMAILS.has(normalizedEmail);
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function getLuckForDatePersonalized(dateKey: string, useScottData: boolean): LuckInfo {
  const normalizedDateKey = formatDateKey(dateKey);
  const date = new Date(`${normalizedDateKey}T00:00:00`);
  const dayOfYear = getDayOfYear(date);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const personalizationOffset = useScottData ? 4 : 1;
  const sequenceIndex = Math.abs((date.getFullYear() * 13) + (month * 7) + (day * 3) + dayOfYear + personalizationOffset) % LUCK_SEQUENCE.length;
  return LUCK_SCALE[LUCK_SEQUENCE[sequenceIndex]];
}
