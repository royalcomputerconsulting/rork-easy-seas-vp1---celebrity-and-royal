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

const WESTERN_SIGN_GLYPHS: Record<string, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

const CHINESE_SIGN_GLYPHS: Record<string, string> = {
  rat: '🐀', ox: '🐂', tiger: '🐅', rabbit: '🐇',
  dragon: '🐉', snake: '🐍', horse: '🐎', goat: '🐐',
  monkey: '🐒', rooster: '🐓', dog: '🐕', pig: '🐖',
};

const WESTERN_SIGN_DESCRIPTIONS: Record<string, string> = {
  aries: 'Bold and action-oriented. Mars-ruled fire energy favors decisive moves and new beginnings today.',
  taurus: 'Steady and grounded. Venus-ruled earth energy rewards patience and deliberate choices.',
  gemini: 'Adaptable and communicative. Mercury-ruled air energy supports quick thinking and flexibility.',
  cancer: 'Intuitive and protective. Moon-ruled water energy heightens emotional awareness and instinct.',
  leo: 'Confident and expressive. Sun-ruled fire energy amplifies leadership and bold self-expression.',
  virgo: 'Detail-oriented and analytical. Mercury-ruled earth energy rewards precision and careful planning.',
  libra: 'Balanced and diplomatic. Venus-ruled air energy favors cooperation and harmonious timing.',
  scorpio: 'Intense and perceptive. Pluto-ruled water energy deepens focus and strategic intuition.',
  sagittarius: 'Optimistic and expansive. Jupiter-ruled fire energy broadens perspective and rewards risk.',
  capricorn: 'Disciplined and goal-driven. Saturn-ruled earth energy rewards structure and long-term thinking.',
  aquarius: 'Innovative and independent. Uranus-ruled air energy favors original thinking and unconventional moves.',
  pisces: 'Imaginative and empathetic. Neptune-ruled water energy heightens intuition and creative perception.',
};

const CHINESE_SIGN_DESCRIPTIONS: Record<string, string> = {
  rat: 'Resourceful and quick-witted. Rat energy today favors clever solutions and opportunistic timing.',
  ox: 'Diligent and dependable. Ox energy rewards hard work and methodical progress today.',
  tiger: 'Courageous and magnetic. Tiger energy today calls for bold action and confident leadership.',
  rabbit: 'Gentle and perceptive. Rabbit energy favors cautious optimism and diplomatic navigation.',
  dragon: 'Powerful and auspicious. Dragon energy amplifies fortune and creative ambition today.',
  snake: 'Wise and intuitive. Snake energy rewards careful observation and strategic patience.',
  horse: 'Energetic and adventurous. Horse energy drives enthusiasm and dynamic forward momentum.',
  goat: 'Artistic and compassionate. Goat energy favors creativity and harmonious cooperation.',
  monkey: 'Clever and inventive. Monkey energy rewards wit, adaptability, and quick problem-solving.',
  rooster: 'Observant and industrious. Rooster energy calls for punctuality and meticulous attention.',
  dog: 'Loyal and honest. Dog energy reinforces integrity and rewards trust-based decisions.',
  pig: 'Generous and sincere. Pig energy brings social goodwill and honest abundance today.',
};

function isDateInRange(month: number, day: number, startMonth: number, startDay: number, endMonth: number, endDay: number): boolean {
  if (startMonth > endMonth) {
    return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay) || month > startMonth || month < endMonth;
  }
  if (month < startMonth || month > endMonth) return false;
  if (month === startMonth && day < startDay) return false;
  if (month === endMonth && day > endDay) return false;
  return true;
}

export function deriveWesternSignFromDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  for (const range of WESTERN_SIGN_RANGES) {
    if (isDateInRange(month, day, range.start[0], range.start[1], range.end[0], range.end[1])) {
      return range.sign;
    }
  }
  return 'capricorn';
}

export function deriveChineseSignFromYear(year: number): string {
  const index = ((year - 4) % CHINESE_SIGNS.length + CHINESE_SIGNS.length) % CHINESE_SIGNS.length;
  return CHINESE_SIGNS[index] ?? 'rat';
}

export function getWesternSignGlyph(sign: string): string {
  return WESTERN_SIGN_GLYPHS[sign] ?? '✦';
}

export function getChineseSignGlyph(sign: string): string {
  return CHINESE_SIGN_GLYPHS[sign] ?? '✦';
}

export function getWesternSignDescription(sign: string): string {
  return WESTERN_SIGN_DESCRIPTIONS[sign] ?? 'The celestial energies are in motion today. Stay present and trust your instincts.';
}

export function getChineseSignDescription(sign: string): string {
  return CHINESE_SIGN_DESCRIPTIONS[sign] ?? 'The Chinese cosmic energy flows today. Align with the natural rhythm for best outcomes.';
}

export function toTitleCase(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
