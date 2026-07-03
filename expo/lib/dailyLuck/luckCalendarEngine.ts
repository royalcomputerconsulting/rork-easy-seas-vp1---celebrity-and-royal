export type LuckBand = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Indigo / Golden' | 'Violet';

export type DailyLuckProfile = {
  id: string;
  name?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  westernSunSign?: string;
  moonSign?: string;
  risingSign?: string;
  chineseZodiac?: string;
  chineseElement?: string;
  partnerProfile?: {
    name?: string;
    sunSign?: string;
    birthDate?: string;
    birthPlace?: string;
    anniversary?: string;
  };
  casinoPreferences?: {
    dailyStopLoss?: number;
    leaveWhenAhead?: boolean;
    sessionStyle?: string;
  };
};

export type DailyLuckContext = {
  tripName?: string;
  ship?: string;
  locationType?: 'cruise' | 'land' | 'home' | 'unknown';
  seaDay?: boolean;
  portDay?: boolean;
  casinoOpenExpected?: boolean;
  travelDay?: boolean;
  fatigueRisk?: 'low' | 'medium' | 'high' | 'unknown';
};

export type DailyLuckSourceRecord = {
  sourceType: string;
  sourceName: string;
  url?: string;
  retrievedAt?: string;
};

export type FullDailyLuckRecord = {
  date: string;
  weekday: string;
  profileId: string;
  luckyScore1To9: number;
  luckyScore100: number;
  luckBand: LuckBand;
  luckyColor: string;
  luckyNumber: number;
  bestLuckyWindow: string;
  secondLuckyWindow?: string;
  westernScore: number;
  chineseScore: number;
  tarotScore: number;
  lunarScore: number;
  contextScore: number;
  westernSummary: string;
  chineseSummary: string;
  tarotCard: string;
  tarotSummary: string;
  moonSign?: string;
  lunarPhase?: string;
  majorTransits: string[];
  retrogrades: string[];
  focusArea: string;
  bestMove: string;
  warning: string;
  casinoGuidance?: string;
  travelGuidance?: string;
  relationshipGuidance?: string;
  dailyReading: string;
  sources: DailyLuckSourceRecord[];
  disclaimer: string;
  createdAt: string;
  updatedAt: string;
};

const CHINESE_NEW_YEAR_BOUNDARIES: Array<{ start: string; end: string; animal: string; element: string }> = [
  { start: '2026-01-01', end: '2026-02-16', animal: 'Snake', element: 'Wood' },
  { start: '2026-02-17', end: '2027-02-05', animal: 'Horse', element: 'Fire' },
  { start: '2027-02-06', end: '2028-01-25', animal: 'Goat', element: 'Fire' },
];

const TAROT = ['The Chariot', 'Temperance', 'The Star', 'The Sun', 'Justice', 'The Hermit', 'Wheel of Fortune', 'Strength', 'The Emperor', 'The High Priestess'];
const MOONS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const COLORS = ['Gold', 'Blue', 'Green', 'Purple', 'Silver', 'Red', 'Turquoise', 'Indigo', 'White'];

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function score1to9(seed: string, base = 5): number {
  return clamp(Math.round(base + ((hash(seed) % 7) - 3) * 0.7), 1, 9);
}

function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function getChineseYearContext(date: string): { animal: string; element: string; label: string } {
  const found = CHINESE_NEW_YEAR_BOUNDARIES.find((entry) => date >= entry.start && date <= entry.end);
  if (found) return { animal: found.animal, element: found.element, label: `${found.element} ${found.animal}` };
  return { animal: 'unknown', element: 'unknown', label: 'Unknown Chinese year context' };
}

function band(score100: number): LuckBand {
  if (score100 < 20) return 'Red';
  if (score100 < 35) return 'Orange';
  if (score100 < 50) return 'Yellow';
  if (score100 < 65) return 'Green';
  if (score100 < 80) return 'Blue';
  if (score100 < 90) return 'Indigo / Golden';
  return 'Violet';
}

export const DAILY_LUCK_GENERAL_DISCLAIMER = 'This reading is a symbolic planning guide for reflection and entertainment. It does not guarantee money, casino results, health outcomes, travel outcomes, relationship outcomes, or safety. Make financial, medical, legal, and travel decisions using real-world information and personal judgment.';
export const DAILY_LUCK_CASINO_DISCLAIMER = 'Casino guidance is for timing and discipline only. Never gamble more than you can afford to lose, never chase losses, and stop when your preset limit is reached.';

export function buildFullDailyLuckRecord(input: {
  date: string;
  profile: DailyLuckProfile;
  context?: DailyLuckContext;
  sources?: DailyLuckSourceRecord[];
  mode?: 'general' | 'casino';
}): FullDailyLuckRecord {
  const date = input.date;
  const profile = input.profile;
  const seed = `${date}|${profile.birthDate ?? ''}|${profile.westernSunSign ?? ''}|${profile.chineseZodiac ?? ''}|${input.mode ?? 'general'}`;
  const westernScore = score1to9(`${seed}|western`, profile.westernSunSign?.toLowerCase() === 'aries' ? 6 : 5);
  const chineseYear = getChineseYearContext(date);
  const chineseBase = profile.chineseZodiac?.toLowerCase() === 'rooster' && chineseYear.animal === 'Horse' ? 6 : 5;
  const chineseScore = score1to9(`${seed}|chinese`, chineseBase);
  const tarotScore = score1to9(`${seed}|tarot`);
  const lunarScore = score1to9(`${seed}|lunar`);
  let contextScore = score1to9(`${seed}|context`);
  if (input.context?.seaDay && input.context?.casinoOpenExpected) contextScore = clamp(contextScore + 1, 1, 9);
  if (input.context?.portDay && input.context?.casinoOpenExpected === false) contextScore = clamp(contextScore - 1, 1, 9);
  if (input.context?.fatigueRisk === 'high') contextScore = clamp(contextScore - 2, 1, 9);

  const weights = input.mode === 'casino'
    ? { western: 0.2, chinese: 0.3, tarot: 0.15, lunar: 0.15, context: 0.2 }
    : { western: 0.25, chinese: 0.25, tarot: 0.2, lunar: 0.15, context: 0.15 };
  const weighted = westernScore * weights.western + chineseScore * weights.chinese + tarotScore * weights.tarot + lunarScore * weights.lunar + contextScore * weights.context;
  const luckyScore1To9 = clamp(Math.round(weighted), 1, 9);
  const luckyScore100 = clamp(Math.round((weighted / 9) * 100), 0, 100);
  const luckBand = band(luckyScore100);
  const tarotCard = TAROT[hash(`${seed}|card`) % TAROT.length];
  const moonSign = MOONS[hash(`${seed}|moon`) % MOONS.length];
  const luckyColor = COLORS[hash(`${seed}|color`) % COLORS.length];
  const luckyNumber = (hash(`${seed}|number`) % 9) + 1;
  const casinoGuidance = input.context?.locationType === 'cruise' || input.mode === 'casino'
    ? `${luckyScore1To9 >= 7 ? 'Symbolically favorable for short, focused play' : luckyScore1To9 <= 4 ? 'Better for observation or rest than aggressive play' : 'Mixed casino timing; use small, disciplined sessions'} with strict stop-loss discipline. ${DAILY_LUCK_CASINO_DISCLAIMER}`
    : undefined;
  const travelGuidance = input.context?.travelDay || input.context?.locationType === 'cruise'
    ? `Travel/cruise context is ${contextScore >= 6 ? 'supportive when plans are organized' : 'best handled with buffers, patience, and backup timing'}.`
    : undefined;
  const relationshipGuidance = profile.partnerProfile
    ? `For ${profile.partnerProfile.name ?? 'your partner'}, directness works best when softened with patience and emotional room.`
    : undefined;
  const bestMove = luckyScore1To9 >= 7 ? 'Make one clear move, then pause and observe the result.' : luckyScore1To9 <= 4 ? 'Protect energy, reduce risk, and clean up loose ends.' : 'Proceed carefully with one measured action at a time.';
  const warning = luckyScore1To9 >= 7 ? 'Do not chase momentum past your preset limits.' : luckyScore1To9 <= 4 ? 'Avoid forcing outcomes or treating symbolic signs as guarantees.' : 'Do not confuse mixed signals with a green light for bigger risk.';

  const dailyReading = `Today is a ${luckBand} day with a ${luckyScore1To9}/9 luck score. Your ${profile.westernSunSign ?? 'western'} side is supported by ${moonSign} Moon energy, while your ${profile.chineseElement ?? ''} ${profile.chineseZodiac ?? 'Chinese zodiac'} luck works best through timing and preparation. ${tarotCard} says momentum is useful only when directed with discipline. Best move: ${bestMove} Warning: ${warning}`;

  return {
    date,
    weekday: weekday(date),
    profileId: profile.id,
    luckyScore1To9,
    luckyScore100,
    luckBand,
    luckyColor,
    luckyNumber,
    bestLuckyWindow: luckyScore1To9 >= 7 ? 'Late morning to early afternoon' : 'Midday, after a reset',
    secondLuckyWindow: luckyScore1To9 >= 6 ? 'Early evening' : undefined,
    westernScore,
    chineseScore,
    tarotScore,
    lunarScore,
    contextScore,
    westernSummary: `${profile.westernSunSign ?? 'Western'} energy favors ${westernScore >= 6 ? 'measured action' : 'patience and observation'}.`,
    chineseSummary: `${profile.chineseElement ?? ''} ${profile.chineseZodiac ?? 'Chinese zodiac'} guidance is shaped by ${chineseYear.label}; preparation beats impulse.`,
    tarotCard,
    tarotSummary: `${tarotCard} is interpreted symbolically as a practical timing cue, not a prediction of certainty.`,
    moonSign,
    lunarPhase: 'Calculated/External source required for production precision',
    majorTransits: [],
    retrogrades: [],
    focusArea: input.mode === 'casino' ? 'Casino discipline, travel timing, and emotional control' : 'Planning, timing, and balanced action',
    bestMove,
    warning,
    casinoGuidance,
    travelGuidance,
    relationshipGuidance,
    dailyReading,
    sources: input.sources ?? [],
    disclaimer: `${DAILY_LUCK_GENERAL_DISCLAIMER}${casinoGuidance ? ` ${DAILY_LUCK_CASINO_DISCLAIMER}` : ''}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function exportDailyLuckRecordToCsvRow(record: FullDailyLuckRecord): string {
  const columns = [
    record.date, record.weekday, record.luckyScore1To9, record.luckyScore100, record.luckBand, record.luckyColor, record.luckyNumber,
    record.bestLuckyWindow, record.westernScore, record.chineseScore, record.tarotScore, record.lunarScore, record.contextScore,
    record.westernSummary, record.chineseSummary, record.tarotCard, record.tarotSummary, record.moonSign ?? '', record.lunarPhase ?? '',
    record.majorTransits.join('; '), record.retrogrades.join('; '), record.focusArea, record.bestMove, record.warning,
    record.casinoGuidance ?? '', record.travelGuidance ?? '', record.relationshipGuidance ?? '', record.dailyReading,
    JSON.stringify(record.sources),
  ];
  return columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
}

export function exportDailyLuckRecordToIcs(record: FullDailyLuckRecord): string {
  const date = record.date.replace(/-/g, '');
  const description = [
    `Daily Reading: ${record.dailyReading}`,
    `Best Move: ${record.bestMove}`,
    `Warning: ${record.warning}`,
    record.casinoGuidance ? `Casino Guidance: ${record.casinoGuidance}` : '',
    `Sources: ${record.sources.map((source) => source.url).filter(Boolean).join(', ') || 'No live source URLs attached.'}`,
    `Disclaimer: ${record.disclaimer}`,
  ].filter(Boolean).join('\\n');
  return [`BEGIN:VEVENT`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:Luck ${record.luckyScore1To9}/9 — ${record.luckBand} Day`, `DESCRIPTION:${description.replace(/\n/g, '\\n')}`, `END:VEVENT`].join('\n');
}
