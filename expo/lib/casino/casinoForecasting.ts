import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';
import {
  CERTIFICATE_LEVEL_STRENGTH,
  calculateCasinoStrengthRating,
  extractCertificateLevel,
  type CasinoStrengthClassification,
  type CasinoStrengthRating,
} from '@/lib/casino/casinoStrengthRating';
import { INSTANT_CERTIFICATE_POINTS, type CertificateBank } from '@/lib/certificates/instantCertificateUrls';
import { buildCompletedCruiseCasinoValueRecords } from '@/lib/cruise/completedCruiseHistory';

export type CertificatePredictionConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type CasinoStrengthMovementDirection = 'up' | 'stable' | 'down' | 'unknown';

export type PredictedMonthlyCertificate = {
  bank: CertificateBank;
  predictedLevelCode: string;
  predictedOfferCodeExample: string;
  predictedClassification: CasinoStrengthClassification;
  confidence: CertificatePredictionConfidence;
  reason: string;
  warnings: string[];
};

export type InstantCertificatePrediction = {
  currentPoints: number;
  earnedLevelCode: string | null;
  nextLevelCode: string | null;
  pointsNeeded: number;
  estimatedSlotCoinInNeeded: number;
  estimatedRoyalVideoPokerCoinInNeeded: number;
  likelyClassification: CasinoStrengthClassification;
  recommendation: 'hold' | 'light-chase' | 'worth-chasing' | 'do-not-chase' | 'unknown';
  reasons: string[];
  warnings: string[];
};

export type AnnualCruiseValueForecast = {
  officialTier: CasinoStrengthRating['officialTier'];
  expectedAnnualBenefit: 'interior' | 'balcony' | 'grand-suite' | 'unknown';
  estimatedValue: number;
  confidence: CertificatePredictionConfidence;
  reason: string;
  warnings: string[];
};

export type ClassificationMovementForecast = {
  currentClassification: CasinoStrengthClassification;
  nextUpClassification: CasinoStrengthClassification | null;
  pointsNeededForNextSignal: number | null;
  estimatedSlotCoinInNeeded: number | null;
  estimatedRoyalVideoPokerCoinInNeeded: number | null;
  direction: CasinoStrengthMovementDirection;
  explanation: string;
  warnings: string[];
};

export type FutureCasinoPlayExpectedValue = {
  expectedCertificateValue: number;
  expectedFreePlay: number;
  expectedTradeIn: number;
  expectedAnnualCruiseValue: number;
  expectedOfferImprovementValue: number;
  estimatedCoinInNeeded: number;
  estimatedRoyalVideoPokerCoinInNeeded: number;
  estimatedExpectedLoss: number | null;
  netExpectedValue: number | null;
  confidence: CertificatePredictionConfidence;
  assumptions: string[];
  warnings: string[];
};

export type CasinoPlayerComparison = {
  baseline: CasinoStrengthRating;
  comparison?: CasinoStrengthRating;
  result: 'baseline-stronger' | 'comparison-stronger' | 'similar' | 'not-enough-data';
  scoreDifference: number;
  summary: string;
  warnings: string[];
};

export type CasinoStrengthForecast = {
  rating: CasinoStrengthRating;
  predictedNextMonthCertificates: PredictedMonthlyCertificate[];
  instantCertificatePrediction: InstantCertificatePrediction;
  annualCruiseValueForecast: AnnualCruiseValueForecast;
  movementForecast: ClassificationMovementForecast;
  futurePlayExpectedValue: FutureCasinoPlayExpectedValue;
  playerComparison?: CasinoPlayerComparison;
  questionsAnswered: string[];
  warnings: string[];
};

const LEVEL_ORDER_LOW_TO_HIGH = ['10', '09', '08', '07', '06', '05', '04', '03A', '03', '02A', '02', '01', 'VIP2'];
const BANKS: CertificateBank[] = ['A', 'C', 'D'];
const MONTH_CODE_REGEX = /^(\d{2})(\d{2})$/;

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeMonthCode(today?: string): string {
  const parsed = today ? new Date(`${today}T00:00:00`) : new Date();
  const valid = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  const next = new Date(valid.getFullYear(), valid.getMonth() + 1, 1);
  return `${String(next.getFullYear()).slice(-2)}${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  const upper = String(level).toUpperCase().trim();
  return Object.prototype.hasOwnProperty.call(INSTANT_CERTIFICATE_POINTS, upper) ? upper : null;
}

function levelPoints(level: string | null | undefined): number {
  const normalized = normalizeLevel(level);
  return normalized ? INSTANT_CERTIFICATE_POINTS[normalized as keyof typeof INSTANT_CERTIFICATE_POINTS] ?? 0 : 0;
}

function classificationForLevel(level: string | null | undefined): CasinoStrengthClassification {
  const normalized = normalizeLevel(level);
  return normalized ? CERTIFICATE_LEVEL_STRENGTH[normalized]?.classification ?? 'unknown' : 'unknown';
}

function scoreToNearestCertificateLevel(score: number): string {
  const entries = Object.entries(CERTIFICATE_LEVEL_STRENGTH)
    .filter(([level]) => Object.prototype.hasOwnProperty.call(INSTANT_CERTIFICATE_POINTS, level))
    .sort((a, b) => Math.abs(b[1].score - score) - Math.abs(a[1].score - score));
  const direct = Object.entries(CERTIFICATE_LEVEL_STRENGTH)
    .filter(([level]) => Object.prototype.hasOwnProperty.call(INSTANT_CERTIFICATE_POINTS, level))
    .sort((a, b) => Math.abs(a[1].score - score) - Math.abs(b[1].score - score));
  return direct[0]?.[0] ?? entries[entries.length - 1]?.[0] ?? '10';
}

function bestLevelFromHistory(certificates: any[] = [], records: any[] = []): string | null {
  const levels = [
    ...certificates.map((cert) => extractCertificateLevel(cert?.offerCode ?? cert?.code ?? cert?.certificateCode ?? cert?.levelCode)),
    ...records.map((record) => extractCertificateLevel(record?.certificateCodeEarned ?? record?.certificateLevelEarned ?? record?.offerCodeUsed)),
  ].map(normalizeLevel).filter((level): level is string => Boolean(level));
  if (!levels.length) return null;
  return levels.sort((a, b) => levelPoints(b) - levelPoints(a))[0] ?? null;
}

function recentLevelFromHistory(certificates: any[] = [], records: any[] = []): string | null {
  const rows = [
    ...certificates.map((cert) => ({ level: extractCertificateLevel(cert?.offerCode ?? cert?.code ?? cert?.certificateCode ?? cert?.levelCode), date: String(cert?.receivedDate ?? cert?.received ?? cert?.monthCode ?? cert?.offerCode ?? '') })),
    ...records.map((record) => ({ level: extractCertificateLevel(record?.certificateCodeEarned ?? record?.certificateLevelEarned ?? record?.offerCodeUsed), date: String(record?.sailingDate ?? record?.createdAt ?? '') })),
  ].filter((row) => normalizeLevel(row.level));
  if (!rows.length) return null;
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return normalizeLevel(rows[rows.length - 1]?.level) ?? null;
}

function confidenceFromData(recordCount: number, certificateCount: number, offerCount: number): CertificatePredictionConfidence {
  const signal = recordCount + certificateCount + Math.min(offerCount, 6);
  if (signal >= 8) return 'high';
  if (signal >= 3) return 'medium';
  if (signal >= 1) return 'low';
  return 'unknown';
}

function nextHigherLevel(currentLevel: string | null): string | null {
  if (!currentLevel) return '10';
  const index = LEVEL_ORDER_LOW_TO_HIGH.indexOf(currentLevel);
  if (index < 0 || index >= LEVEL_ORDER_LOW_TO_HIGH.length - 1) return null;
  return LEVEL_ORDER_LOW_TO_HIGH[index + 1] ?? null;
}

function nextClassification(current: CasinoStrengthClassification): CasinoStrengthClassification | null {
  const order: CasinoStrengthClassification[] = ['choice', 'lower-prime', 'mid-prime', 'strong-prime', 'weak-signature', 'mid-signature', 'strong-signature', 'masters'];
  const index = order.indexOf(current);
  if (index < 0 || index >= order.length - 1) return null;
  return order[index + 1] ?? null;
}

function classificationThresholdLevel(classification: CasinoStrengthClassification): string | null {
  switch (classification) {
    case 'lower-prime': return '09';
    case 'mid-prime': return '08';
    case 'strong-prime': return '07';
    case 'weak-signature': return '06';
    case 'mid-signature': return '05';
    case 'strong-signature': return '04';
    case 'masters': return '02';
    case 'choice': return '10';
    default: return null;
  }
}

function estimateDollarValueForLevel(level: string | null, bank: CertificateBank = 'C'): number {
  const points = levelPoints(level);
  if (!points) return 0;
  const bankMultiplier = bank === 'C' ? 1.25 : bank === 'D' ? 1.35 : 0.9;
  const cabinMultiplier = points >= 6500 ? 1.7 : points >= 3000 ? 1.35 : points >= 1500 ? 1.05 : 0.75;
  return Math.round(points * bankMultiplier * cabinMultiplier * 0.85);
}

export function predictNextMonthCertificates(input: {
  rating: CasinoStrengthRating;
  certificates?: any[];
  completedRecords?: any[];
  offers?: any[];
  today?: string;
}): PredictedMonthlyCertificate[] {
  const monthCode = normalizeMonthCode(input.today);
  const records = input.completedRecords ?? [];
  const bestLevel = bestLevelFromHistory(input.certificates, records);
  const recentLevel = recentLevelFromHistory(input.certificates, records);
  const baseScore = input.rating.certificateSignalScore > 0
    ? input.rating.certificateSignalScore * 0.65 + input.rating.strengthScore * 0.35
    : input.rating.strengthScore;
  const predictedLevel = normalizeLevel(recentLevel) ?? normalizeLevel(bestLevel) ?? scoreToNearestCertificateLevel(baseScore);
  const confidence = confidenceFromData(records.length, input.certificates?.length ?? 0, input.offers?.length ?? 0);
  const warnings = ['Prediction is an EasySeas estimate; Royal Caribbean can change monthly certificate inventory and targeting.'];
  if (confidence === 'unknown') warnings.push('Not enough certificate or completed-cruise history to make a high-confidence prediction.');
  return BANKS.map((bank) => ({
    bank,
    predictedLevelCode: predictedLevel,
    predictedOfferCodeExample: `${monthCode}${bank}${predictedLevel}`,
    predictedClassification: classificationForLevel(predictedLevel),
    confidence,
    reason: recentLevel
      ? `Recent certificate level ${recentLevel} and current Casino Strength ${input.rating.internalClassification.replace(/-/g, ' ')} support this estimate.`
      : `Casino Strength score ${input.rating.strengthScore}/100 maps closest to certificate level ${predictedLevel}.`,
    warnings,
  }));
}

export function predictInstantCertificate(input: {
  currentPoints: number;
  rating?: CasinoStrengthRating;
}): InstantCertificatePrediction {
  const currentPoints = Math.max(0, Math.round(num(input.currentPoints)));
  const eligibleLevels = Object.entries(INSTANT_CERTIFICATE_POINTS)
    .filter(([, points]) => currentPoints >= points)
    .sort((a, b) => b[1] - a[1]);
  const earnedLevelCode = eligibleLevels[0]?.[0] ?? null;
  const nextLevelCode = nextHigherLevel(earnedLevelCode);
  const pointsNeeded = nextLevelCode ? Math.max(0, levelPoints(nextLevelCode) - currentPoints) : 0;
  const estimatedSlotCoinInNeeded = estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0;
  const estimatedRoyalVideoPokerCoinInNeeded = estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'video-poker' }).coinIn ?? 0;
  const recommendation = !nextLevelCode
    ? 'hold'
    : pointsNeeded <= 250
      ? 'light-chase'
      : pointsNeeded <= 1200 && input.rating?.strengthScore && input.rating.strengthScore >= 55
        ? 'worth-chasing'
        : pointsNeeded <= 2000
          ? 'light-chase'
          : 'do-not-chase';
  const reasons = [
    earnedLevelCode ? `Current points qualify for level ${earnedLevelCode}.` : 'Current points do not yet qualify for the entry certificate level.',
    nextLevelCode ? `${pointsNeeded.toLocaleString()} point(s) are needed for level ${nextLevelCode}.` : 'No higher instant certificate level exists in the default ladder.',
  ];
  const warnings = [
    'Estimated coin-in is not expected loss.',
    'FreePlay coin-in does not earn points by default unless verified onboard data says otherwise.',
    'Table-game points are not a fixed coin-in formula.',
  ];
  return {
    currentPoints,
    earnedLevelCode,
    nextLevelCode,
    pointsNeeded,
    estimatedSlotCoinInNeeded,
    estimatedRoyalVideoPokerCoinInNeeded,
    likelyClassification: classificationForLevel(earnedLevelCode ?? nextLevelCode),
    recommendation,
    reasons,
    warnings,
  };
}

export function forecastAnnualCruiseValue(input: {
  rating: CasinoStrengthRating;
  userProfile?: any;
  offers?: any[];
}): AnnualCruiseValueForecast {
  const tier = input.rating.officialTier;
  const expectedAnnualBenefit = tier === 'masters' ? 'grand-suite' : tier === 'signature' ? 'balcony' : tier === 'prime' ? 'interior' : 'unknown';
  const estimatedValue = expectedAnnualBenefit === 'grand-suite' ? 6500 : expectedAnnualBenefit === 'balcony' ? 2800 : expectedAnnualBenefit === 'interior' ? 1400 : 0;
  const confidence = tier === 'unknown' ? 'unknown' : input.rating.strengthScore >= 55 ? 'medium' : 'low';
  return {
    officialTier: tier,
    expectedAnnualBenefit,
    estimatedValue,
    confidence,
    reason: expectedAnnualBenefit === 'unknown'
      ? 'No official tier annual cruise signal is available yet.'
      : `${tier} tier generally maps to a ${expectedAnnualBenefit.replace('-', ' ')} annual cruise value bucket in EasySeas accounting.`,
    warnings: ['Annual cruise value is an EasySeas estimate until the actual annual benefit and selected sailing are confirmed.'],
  };
}

export function forecastClassificationMovement(input: {
  rating: CasinoStrengthRating;
  currentPoints: number;
}): ClassificationMovementForecast {
  const nextClass = nextClassification(input.rating.internalClassification);
  const thresholdLevel = nextClass ? classificationThresholdLevel(nextClass) : null;
  const thresholdPoints = levelPoints(thresholdLevel);
  const pointsNeeded = thresholdPoints ? Math.max(0, thresholdPoints - Math.max(0, Math.round(num(input.currentPoints)))) : null;
  const estimatedSlotCoinInNeeded = pointsNeeded === null ? null : estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0;
  const estimatedRoyalVideoPokerCoinInNeeded = pointsNeeded === null ? null : estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'video-poker' }).coinIn ?? 0;
  return {
    currentClassification: input.rating.internalClassification,
    nextUpClassification: nextClass,
    pointsNeededForNextSignal: pointsNeeded,
    estimatedSlotCoinInNeeded,
    estimatedRoyalVideoPokerCoinInNeeded,
    direction: input.rating.trend === 'rising' ? 'up' : input.rating.trend === 'declining' ? 'down' : input.rating.trend === 'stable' ? 'stable' : 'unknown',
    explanation: nextClass
      ? `To move signal from ${input.rating.internalClassification.replace(/-/g, ' ')} toward ${nextClass.replace(/-/g, ' ')}, EasySeas looks for roughly level ${thresholdLevel} strength or equivalent recurring offer history.`
      : 'You are already at the top EasySeas internal casino strength bucket or there is not enough data to forecast movement.',
    warnings: ['Movement forecasts are internal EasySeas estimates based on certificate/points signals, not official Royal Caribbean thresholds.'],
  };
}

export function calculateFutureCasinoPlayExpectedValue(input: {
  rating: CasinoStrengthRating;
  instantPrediction: InstantCertificatePrediction;
  annualForecast: AnnualCruiseValueForecast;
  offers?: any[];
  completedRecords?: any[];
  assumedRtp?: number;
}): FutureCasinoPlayExpectedValue {
  const offers = input.offers ?? [];
  const records = input.completedRecords ?? [];
  const avgFreePlay = [...offers.map((offer) => num(offer?.freePlay ?? offer?.freeplayAmount)), ...records.map((record) => num(record?.freeplayValue))].filter((value) => value > 0);
  const avgTrade = [...offers.map((offer) => num(offer?.tradeInValue)), ...records.map((record) => num(record?.tradeInValue))].filter((value) => value > 0);
  const expectedFreePlay = avgFreePlay.length ? Math.round(avgFreePlay.reduce((sum, value) => sum + value, 0) / avgFreePlay.length) : Math.round(input.rating.freeplaySignalScore * 8);
  const expectedTradeIn = avgTrade.length ? Math.round(avgTrade.reduce((sum, value) => sum + value, 0) / avgTrade.length) : Math.round(input.rating.tradeInSignalScore * 7);
  const expectedCertificateValue = estimateDollarValueForLevel(input.instantPrediction.nextLevelCode ?? input.instantPrediction.earnedLevelCode, 'C');
  const expectedAnnualCruiseValue = input.annualForecast.estimatedValue;
  const expectedOfferImprovementValue = Math.round(Math.max(0, input.rating.offerValueSignalScore - 45) * 35);
  const estimatedCoinInNeeded = input.instantPrediction.estimatedSlotCoinInNeeded;
  const estimatedRoyalVideoPokerCoinInNeeded = input.instantPrediction.estimatedRoyalVideoPokerCoinInNeeded;
  const assumedRtp = typeof input.assumedRtp === 'number' ? clamp(input.assumedRtp, 0, 1) : null;
  const estimatedExpectedLoss = assumedRtp === null ? null : Math.round(estimatedCoinInNeeded * (1 - assumedRtp));
  const grossExpectedValue = expectedCertificateValue + expectedFreePlay + expectedTradeIn + expectedAnnualCruiseValue + expectedOfferImprovementValue;
  const netExpectedValue = estimatedExpectedLoss === null ? null : grossExpectedValue - estimatedExpectedLoss;
  return {
    expectedCertificateValue,
    expectedFreePlay,
    expectedTradeIn,
    expectedAnnualCruiseValue,
    expectedOfferImprovementValue,
    estimatedCoinInNeeded,
    estimatedRoyalVideoPokerCoinInNeeded,
    estimatedExpectedLoss,
    netExpectedValue,
    confidence: confidenceFromData(records.length, 0, offers.length),
    assumptions: [
      'Certificate value is estimated from the default certificate point ladder and current strength signal.',
      'FreePlay and trade-in estimates use saved offer/completed-cruise history when available.',
      'Annual cruise value uses official tier bucket until an actual selected sailing confirms value.',
    ],
    warnings: [
      'Future casino-play EV is directional planning guidance, not a guarantee.',
      'Estimated coin-in is not expected loss.',
      'Never chase losses or exceed the preset bankroll cap to improve a forecast.',
    ],
  };
}

export function compareCasinoPlayers(input: {
  baseline: CasinoStrengthRating;
  comparison?: CasinoStrengthRating;
}): CasinoPlayerComparison {
  if (!input.comparison) {
    return {
      baseline: input.baseline,
      result: 'not-enough-data',
      scoreDifference: 0,
      summary: 'Only one player profile is available, so player comparison is not active yet.',
      warnings: ['Add another profile with casino history to compare players.'],
    };
  }
  const scoreDifference = input.baseline.strengthScore - input.comparison.strengthScore;
  const result = Math.abs(scoreDifference) < 5 ? 'similar' : scoreDifference > 0 ? 'baseline-stronger' : 'comparison-stronger';
  return {
    baseline: input.baseline,
    comparison: input.comparison,
    result,
    scoreDifference,
    summary: result === 'similar'
      ? 'The two player profiles have similar EasySeas Casino Strength scores.'
      : result === 'baseline-stronger'
        ? 'The baseline player has a stronger EasySeas Casino Strength signal.'
        : 'The comparison player has a stronger EasySeas Casino Strength signal.',
    warnings: ['Casino Strength comparison is an EasySeas internal estimate, not an official cruise line player comparison.'],
  };
}

export function buildCasinoStrengthForecast(input: {
  userProfile?: any;
  bookedCruises?: any[];
  completedCruises?: any[];
  sessions?: any[];
  certificates?: any[];
  offers?: any[];
  currentYearPoints?: number;
  today?: string;
  comparisonRating?: CasinoStrengthRating;
}): CasinoStrengthForecast {
  const completedRecords = buildCompletedCruiseCasinoValueRecords({
    completedCruises: input.completedCruises,
    bookedCruises: input.bookedCruises,
    sessions: input.sessions,
    includePastBooked: true,
    today: input.today,
  });
  const rating = calculateCasinoStrengthRating({
    userProfile: input.userProfile,
    bookedCruises: input.bookedCruises,
    completedCruises: input.completedCruises,
    sessions: input.sessions,
    certificates: input.certificates,
    offers: input.offers,
    currentYearPoints: input.currentYearPoints,
    today: input.today,
  });
  const currentPoints = Math.max(num(input.currentYearPoints ?? input.userProfile?.clubRoyalePoints), completedRecords.reduce((sum, record) => sum + num(record.pointsEarned), 0));
  const instantCertificatePrediction = predictInstantCertificate({ currentPoints, rating });
  const annualCruiseValueForecast = forecastAnnualCruiseValue({ rating, userProfile: input.userProfile, offers: input.offers });
  const movementForecast = forecastClassificationMovement({ rating, currentPoints });
  const predictedNextMonthCertificates = predictNextMonthCertificates({
    rating,
    certificates: input.certificates,
    completedRecords,
    offers: input.offers,
    today: input.today,
  });
  const futurePlayExpectedValue = calculateFutureCasinoPlayExpectedValue({
    rating,
    instantPrediction: instantCertificatePrediction,
    annualForecast: annualCruiseValueForecast,
    offers: input.offers,
    completedRecords,
  });
  const playerComparison = compareCasinoPlayers({ baseline: rating, comparison: input.comparisonRating });
  const warnings = [
    ...rating.warnings,
    ...instantCertificatePrediction.warnings,
    ...annualCruiseValueForecast.warnings,
    ...movementForecast.warnings,
    ...futurePlayExpectedValue.warnings,
  ].filter((warning, index, arr) => arr.indexOf(warning) === index);

  return {
    rating,
    predictedNextMonthCertificates,
    instantCertificatePrediction,
    annualCruiseValueForecast,
    movementForecast,
    futurePlayExpectedValue,
    playerComparison,
    questionsAnswered: [
      'estimate next month certificate before release',
      'predict instant certificates',
      'estimate annual cruise value',
      'compare players when a second profile exists',
      'forecast Strong Prime to Weak Signature to Strong Signature movement',
      'estimate directional value of future casino play',
    ],
    warnings,
  };
}
