export type DailyLuckSource = 'ai' | 'fallback' | 'live';

export type DailyLuckProviderKey = 'chineseDaily' | 'westernDaily' | 'skyToday' | 'loveDaily' | 'yearlyChinese';

export type DailyLuckToneClass = 'positive' | 'neutral' | 'cautionary' | 'restrictive';

export type DailyLuckActionStyle = 'act now' | 'measured action' | 'wait-observe';

export type DailyLuckDomain = 'money' | 'social' | 'emotional' | 'career' | 'relationships' | 'home' | 'intuition';

export interface DailyLuckScoreBreakdown {
  chinese: number;
  western: number;
  tarot: number;
}

export interface DailyLuckReadings {
  chinese: string;
  western: string;
  tarot: string;
  synthesis: string;
}

export interface DailyLuckEntry {
  dateKey: string;
  birthdate: string;
  year: number;
  generatedAt: string;
  source: DailyLuckSource;
  westernSign: string;
  chineseSign: string;
  tarotCard: string;
  luckNumber: number;
  luckScore: number;
  scoreBreakdown?: DailyLuckScoreBreakdown;
  readings: DailyLuckReadings;
}

export interface DailyLuckRequestProfile {
  displayName?: string;
  westernSign: string;
  chineseSign: string;
  birthDate: string;
  birthplace: string;
}

export interface DailyLuckInput {
  date: string;
  westernSign?: string;
  chineseSign?: string;
  birthDate: string;
  birthplace?: string;
  displayName?: string;
  skyTodayUrl?: string;
}

export interface DailyLuckClassification {
  tone: DailyLuckToneClass;
  actionStyle: DailyLuckActionStyle;
  affectedDomains: DailyLuckDomain[];
  signal: -2 | -1 | 0 | 1 | 2;
  positiveHits: number;
  cautionaryHits: number;
  restrictiveHits: number;
}

export interface DailyLuckFetchedSource {
  providerKey: DailyLuckProviderKey;
  label: string;
  weight: number;
  sourceUrl: string;
  sourceDateText: string;
  detectedDateIso?: string;
  isStale: boolean;
  title: string;
  mainText: string;
  excerpt: string;
  visibleDateText: string;
  author?: string;
  publishedTime?: string;
  articleType?: string;
  confidencePenalty: number;
  classification: DailyLuckClassification;
  reason: string;
  displayTone: string;
  status: 'ok' | 'error';
  errorMessage?: string;
}

export interface DailyLuckSourceBreakdown {
  score: number;
  tone: string;
  reason: string;
  sourceUrl: string;
  sourceDateText: string;
  visibleDateText?: string;
  detectedDateIso?: string;
  isStale: boolean;
  title?: string;
  author?: string;
  publishedTime?: string;
  excerpt?: string;
  mainText?: string;
  classification?: DailyLuckClassification;
  status?: 'ok' | 'error';
  errorMessage?: string;
}

export interface DailyLuckPlayStyle {
  strategy: string;
  avoid: string[];
  favor: string[];
}

export interface DailyLuckUiCard {
  score: number;
  label: string;
  oneLiner: string;
}

export interface DailyLuckAnalysisResponse {
  date: string;
  profile: DailyLuckRequestProfile;
  luckScore: number;
  luckLevel: string;
  confidence: number;
  summary: string;
  breakdown: Record<DailyLuckProviderKey, DailyLuckSourceBreakdown>;
  playStyle: DailyLuckPlayStyle;
  uiCard: DailyLuckUiCard;
  sourceOrder: DailyLuckProviderKey[];
  plainEnglish: string;
}
