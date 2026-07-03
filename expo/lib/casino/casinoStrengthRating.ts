import { buildCompletedCruiseCasinoValueRecords, type CompletedCruiseCasinoValueRecord } from '@/lib/cruise/completedCruiseHistory';

export type CasinoStrengthClassification =
  | 'masters'
  | 'strong-signature'
  | 'mid-signature'
  | 'weak-signature'
  | 'strong-prime'
  | 'mid-prime'
  | 'lower-prime'
  | 'choice'
  | 'unknown';

export type CasinoStrengthRating = {
  officialTier: 'choice' | 'prime' | 'signature' | 'masters' | 'unknown';
  internalClassification: CasinoStrengthClassification;
  strengthScore: number;
  certificateSignalScore: number;
  pointsSignalScore: number;
  offerValueSignalScore: number;
  consistencySignalScore: number;
  freeplaySignalScore: number;
  tradeInSignalScore: number;
  cabinSignalScore: number;
  trend: 'rising' | 'stable' | 'declining' | 'unknown';
  explanation: string[];
  warnings: string[];
};

export const CERTIFICATE_LEVEL_STRENGTH: Record<string, { score: number; label: string; classification: CasinoStrengthClassification }> = {
  VIP2: { score: 100, label: 'Ultra high roller', classification: 'masters' },
  '01': { score: 96, label: 'Ultra high roller', classification: 'masters' },
  '02': { score: 92, label: 'Very high roller', classification: 'masters' },
  '02A': { score: 88, label: 'Very high roller / elite Signature', classification: 'strong-signature' },
  '03': { score: 84, label: 'High roller', classification: 'strong-signature' },
  '03A': { score: 78, label: 'Upper Signature', classification: 'strong-signature' },
  '04': { score: 72, label: 'Strong Signature-level player', classification: 'strong-signature' },
  '05': { score: 65, label: 'Mid Signature player', classification: 'mid-signature' },
  '06': { score: 58, label: 'Weak Signature / Strong Prime transition', classification: 'weak-signature' },
  '07': { score: 50, label: 'Strong Prime', classification: 'strong-prime' },
  '08': { score: 42, label: 'Mid Prime', classification: 'mid-prime' },
  '09': { score: 34, label: 'Lower Prime', classification: 'lower-prime' },
  '10': { score: 25, label: 'Entry Prime / upper Choice', classification: 'choice' },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function lower(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

function officialTier(value: unknown): CasinoStrengthRating['officialTier'] {
  const tier = lower(value);
  if (tier.includes('masters')) return 'masters';
  if (tier.includes('signature')) return 'signature';
  if (tier.includes('prime')) return 'prime';
  if (tier.includes('choice')) return 'choice';
  return 'unknown';
}

export function extractCertificateLevel(value: unknown): string | null {
  const text = String(value ?? '').toUpperCase().trim();
  if (!text) return null;
  if (text.includes('VIP2')) return 'VIP2';
  const match = text.match(/(?:\d{4})?[ACD]?(02A|03A|01|02|03|04|05|06|07|08|09|10)$/);
  return match?.[1] ?? null;
}

function classificationFromScore(score: number, tier: CasinoStrengthRating['officialTier']): CasinoStrengthClassification {
  if (tier === 'masters' || score >= 90) return 'masters';
  if (score >= 72) return 'strong-signature';
  if (score >= 62) return 'mid-signature';
  if (score >= 55) return 'weak-signature';
  if (score >= 48) return 'strong-prime';
  if (score >= 38) return 'mid-prime';
  if (score >= 28) return 'lower-prime';
  if (score >= 1) return 'choice';
  return 'unknown';
}

function scoreFromPoints(totalPoints: number, avgPointsPerCruise: number, currentYearPoints = 0): number {
  const annualSignal = Math.max(totalPoints, currentYearPoints);
  const annualScore = annualSignal >= 40000 ? 100 : annualSignal >= 25000 ? 82 : annualSignal >= 15000 ? 68 : annualSignal >= 5000 ? 48 : annualSignal >= 2500 ? 35 : annualSignal >= 800 ? 24 : 0;
  const avgScore = avgPointsPerCruise >= 6500 ? 90 : avgPointsPerCruise >= 4000 ? 78 : avgPointsPerCruise >= 2000 ? 62 : avgPointsPerCruise >= 1200 ? 50 : avgPointsPerCruise >= 800 ? 42 : avgPointsPerCruise >= 400 ? 28 : 0;
  return clampScore((annualScore * 0.6) + (avgScore * 0.4));
}

function bestCertificateScore(records: CompletedCruiseCasinoValueRecord[], certificates: any[]): { score: number; levels: string[] } {
  const levels = [
    ...records.map((record) => extractCertificateLevel(record.certificateCodeEarned ?? record.certificateLevelEarned)),
    ...certificates.map((cert) => extractCertificateLevel(cert?.offerCode ?? cert?.code ?? cert?.certificateCode ?? cert?.levelCode)),
  ].filter((level): level is string => Boolean(level));
  if (!levels.length) return { score: 0, levels };
  const score = Math.max(...levels.map((level) => CERTIFICATE_LEVEL_STRENGTH[level]?.score ?? 0));
  return { score, levels };
}

function trendFromLevels(levels: string[]): CasinoStrengthRating['trend'] {
  if (levels.length < 3) return 'unknown';
  const scores = levels.map((level) => CERTIFICATE_LEVEL_STRENGTH[level]?.score ?? 0).filter((score) => score > 0);
  if (scores.length < 3) return 'unknown';
  const recent = scores.slice(-3).reduce((sum, value) => sum + value, 0) / 3;
  const older = scores.slice(0, Math.max(1, scores.length - 3)).reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length - 3);
  if (recent >= older + 8) return 'rising';
  if (recent <= older - 8) return 'declining';
  return 'stable';
}

function cabinScore(records: CompletedCruiseCasinoValueRecord[], offers: any[]): number {
  const cabinText = [...records.map((r) => r.cabinCategory), ...offers.map((o) => o?.roomType ?? o?.cabinType ?? o?.category)].join(' ').toLowerCase();
  if (cabinText.includes('grand') || cabinText.includes('suite')) return 85;
  if (cabinText.includes('junior')) return 75;
  if (cabinText.includes('balcony')) return 62;
  if (cabinText.includes('ocean')) return 45;
  if (cabinText.includes('interior')) return 30;
  return 0;
}

export function calculateCasinoStrengthRating(input: {
  userProfile?: any;
  completedCruises?: any[];
  bookedCruises?: any[];
  sessions?: any[];
  certificates?: any[];
  offers?: any[];
  currentYearPoints?: number;
  today?: string;
}): CasinoStrengthRating {
  const records = buildCompletedCruiseCasinoValueRecords({
    completedCruises: input.completedCruises,
    bookedCruises: input.bookedCruises,
    sessions: input.sessions,
    includePastBooked: true,
    today: input.today,
  });
  const certificates = Array.isArray(input.certificates) ? input.certificates : [];
  const offers = Array.isArray(input.offers) ? input.offers : [];
  const tier = officialTier(input.userProfile?.clubRoyaleTier ?? input.userProfile?.casinoTier ?? input.userProfile?.royalCasinoTier);
  const totalPoints = records.reduce((sum, record) => sum + num(record.pointsEarned), 0);
  const avgPointsPerCruise = records.length ? totalPoints / records.length : 0;
  const certificateSignal = bestCertificateScore(records, certificates);
  const pointsSignalScore = scoreFromPoints(totalPoints, avgPointsPerCruise, num(input.currentYearPoints ?? input.userProfile?.clubRoyalePoints));
  const freeplayTotal = records.reduce((sum, record) => sum + num(record.freeplayValue), 0) + offers.reduce((sum, offer) => sum + num(offer?.freePlay ?? offer?.freeplayAmount), 0);
  const tradeTotal = records.reduce((sum, record) => sum + num(record.tradeInValue), 0) + offers.reduce((sum, offer) => sum + num(offer?.tradeInValue), 0);
  const offerValueTotal = records.reduce((sum, record) => sum + num(record.casinoCompValue, num(record.totalValueReceived)), 0) + offers.reduce((sum, offer) => sum + num(offer?.offerValue ?? offer?.value ?? offer?.totalValue), 0);
  const freeplaySignalScore = clampScore(Math.min(100, freeplayTotal / 25));
  const tradeInSignalScore = clampScore(Math.min(100, tradeTotal / 25));
  const offerValueSignalScore = clampScore(Math.min(100, offerValueTotal / 200));
  const cabinSignalScore = cabinScore(records, offers);
  const monthsWithData = new Set([...records.map((r) => String(r.sailingDate).slice(0, 7)), ...certificates.map((c) => String(c?.received ?? c?.monthCode ?? c?.offerCode).slice(0, 7))].filter(Boolean)).size;
  const consistencySignalScore = clampScore(Math.min(100, records.length * 8 + monthsWithData * 7));

  const strengthScore = clampScore(
    certificateSignal.score * 0.30
    + pointsSignalScore * 0.20
    + ((pointsSignalScore + consistencySignalScore) / 2) * 0.15
    + ((freeplaySignalScore + tradeInSignalScore) / 2) * 0.15
    + cabinSignalScore * 0.10
    + consistencySignalScore * 0.10
  );
  const internalClassification = classificationFromScore(strengthScore, tier);
  const trend = trendFromLevels(certificateSignal.levels);
  const explanation = [
    `Official tier signal: ${tier}.`,
    certificateSignal.levels.length ? `Best certificate signal found: ${certificateSignal.levels[certificateSignal.levels.length - 1]} (${certificateSignal.score}/100 signal).` : 'No certificate level history found yet.',
    records.length ? `${records.length} completed cruise casino/value records are included, including individual and extrapolated sessions when present.` : 'No completed cruise casino history found yet.',
    `Average completed-cruise points: ${Math.round(avgPointsPerCruise).toLocaleString()}.`,
  ];
  const warnings = [
    'Casino Strength Rating is an EasySeas internal estimate, not an official Royal Caribbean Club Royale classification.',
    ...records.flatMap((record) => record.warnings).slice(0, 6),
  ];

  return {
    officialTier: tier,
    internalClassification,
    strengthScore,
    certificateSignalScore: clampScore(certificateSignal.score),
    pointsSignalScore,
    offerValueSignalScore,
    consistencySignalScore,
    freeplaySignalScore,
    tradeInSignalScore,
    cabinSignalScore,
    trend,
    explanation,
    warnings,
  };
}
