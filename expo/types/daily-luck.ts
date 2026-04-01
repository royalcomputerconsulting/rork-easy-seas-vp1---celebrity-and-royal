export type DailyLuckSource = 'ai' | 'fallback';

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
