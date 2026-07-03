import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';
import { INSTANT_CERTIFICATE_POINTS, type CertificateBank } from './instantCertificateUrls';

export type InstantCertificateSailing = {
  offerCode: string;
  shipName: string;
  departurePort: string;
  sailDate: string;
  itinerary: string;
  nights: number | null;
  stateroomType: string;
  stateroomCategory: 'interior' | 'oceanview' | 'balcony' | 'junior-suite' | 'suite' | 'unknown';
  isGuarantee: boolean;
  offerType: string;
  guestCoverage: 'cruise-fare-for-1' | 'cruise-fare-for-2' | 'unknown';
  nextCruiseBonusFreeplay: number | null;
  nextCruiseObc: number | null;
  taxesFeeText?: string;
  rawText: string;
};

export type InstantCertificateLevel = {
  code: string;
  bank: CertificateBank;
  levelCode: string;
  pointsRequired: number;
  detailPdfUrl: string;
  detailStatus: 'not-fetched' | 'fetched' | 'unavailable' | 'error';
  sailings: InstantCertificateSailing[];
};

export type InstantCertificateLevelSummary = {
  offerCode: string;
  pointsRequired: number;
  estimatedSlotCoinIn: number;
  estimatedRoyalVideoPokerCoinIn: number;
  sailingCount: number;
  bestStateroomCategory: string;
  commonStateroomCategory: string;
  hasCruiseFareFor2: boolean;
  hasCruiseFareFor1: boolean;
  freeplayValues: number[];
  obcValues: number[];
  minNights: number | null;
  maxNights: number | null;
  ships: string[];
  departurePorts: string[];
  earliestSailDate: string | null;
  latestSailDate: string | null;
  warnings: string[];
};

const CABIN_SCORE: Record<string, number> = { unknown: 0, interior: 1, oceanview: 2, balcony: 3, 'junior-suite': 4, suite: 5 };

function unique<T>(items: T[]): T[] {
  return [...new Set(items.filter((item) => item !== null && item !== undefined && String(item).trim() !== ''))];
}

function mostCommon(items: string[]): string {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'unknown';
}

export function summarizeInstantCertificateLevel(level: InstantCertificateLevel): InstantCertificateLevelSummary {
  const sailings = Array.isArray(level.sailings) ? level.sailings : [];
  const nights = sailings.map((sailing) => sailing.nights).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const dates = sailings.map((sailing) => sailing.sailDate).filter(Boolean).sort();
  const freeplayValues = unique(sailings.map((sailing) => sailing.nextCruiseBonusFreeplay).filter((value): value is number => typeof value === 'number'));
  const obcValues = unique(sailings.map((sailing) => sailing.nextCruiseObc).filter((value): value is number => typeof value === 'number'));
  const categories = sailings.map((sailing) => sailing.stateroomCategory || 'unknown');
  const bestStateroomCategory = [...categories].sort((a, b) => (CABIN_SCORE[b] ?? 0) - (CABIN_SCORE[a] ?? 0))[0] ?? 'unknown';
  const slotCoinIn = estimateCoinInForPoints({ targetPoints: level.pointsRequired, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0;
  const vpCoinIn = estimateCoinInForPoints({ targetPoints: level.pointsRequired, brand: 'royal', gameCategory: 'video-poker' }).coinIn ?? 0;
  const warnings: string[] = [];
  if (level.bank === 'A' && nights.some((night) => night >= 7)) warnings.push('A-bank certificate contains 7-night-or-longer sailings; row preserved and flagged.');
  if (level.bank === 'C' && nights.some((night) => night > 0 && night < 7)) warnings.push('C-bank certificate contains under-7-night sailings; row preserved and flagged.');
  if (level.detailStatus === 'unavailable') warnings.push('Detail PDF unavailable. Preserve cached data if available.');
  if (level.detailStatus === 'error') warnings.push('Detail PDF parse/fetch error. Preserve cached data if available.');

  return {
    offerCode: level.code,
    pointsRequired: level.pointsRequired,
    estimatedSlotCoinIn: slotCoinIn,
    estimatedRoyalVideoPokerCoinIn: vpCoinIn,
    sailingCount: sailings.length,
    bestStateroomCategory,
    commonStateroomCategory: mostCommon(categories),
    hasCruiseFareFor2: sailings.some((sailing) => sailing.guestCoverage === 'cruise-fare-for-2'),
    hasCruiseFareFor1: sailings.some((sailing) => sailing.guestCoverage === 'cruise-fare-for-1'),
    freeplayValues,
    obcValues,
    minNights: nights.length ? Math.min(...nights) : null,
    maxNights: nights.length ? Math.max(...nights) : null,
    ships: unique(sailings.map((sailing) => sailing.shipName)).sort(),
    departurePorts: unique(sailings.map((sailing) => sailing.departurePort)).sort(),
    earliestSailDate: dates[0] ?? null,
    latestSailDate: dates[dates.length - 1] ?? null,
    warnings,
  };
}

export function buildDefaultInstantCertificateLevels(monthCode: string, bank: CertificateBank): InstantCertificateLevel[] {
  return (Object.keys(INSTANT_CERTIFICATE_POINTS) as Array<keyof typeof INSTANT_CERTIFICATE_POINTS>).map((levelCode) => ({
    code: `${monthCode}${bank}${levelCode}`,
    bank,
    levelCode,
    pointsRequired: INSTANT_CERTIFICATE_POINTS[levelCode],
    detailPdfUrl: `https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/${monthCode}${bank}${levelCode}.pdf`,
    detailStatus: 'not-fetched',
    sailings: [],
  }));
}
