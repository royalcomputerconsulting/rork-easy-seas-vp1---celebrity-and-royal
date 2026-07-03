import { buildBookedCruiseOfferAttributions, type BookedCruiseOfferAttribution } from '@/lib/offers/offerAttribution';
import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';

export type CertificateEarningChain = {
  bookedCruiseId: string;
  bookedCruiseName: string;
  offerCode: string;
  certificateLevel?: string;
  pointsRequired: number;
  likelyEarningCruiseId?: string;
  likelyEarningCruiseName?: string;
  pointsEarnedOnEarningCruise?: number;
  casinoResultOnEarningCruise?: number;
  estimatedCoinInToEarn?: number;
  acquisitionCashCost: number | null;
  acquisitionCoinInVolume: number | null;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
};

function getDateMs(value?: string | null): number {
  const text = String(value || '').slice(0, 10);
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

function getCruisePoints(cruise: any): number {
  return Math.max(0, Number(cruise?.pointsEarned ?? cruise?.casinoPointsEarned ?? cruise?.clubRoyalePointsEarned ?? cruise?.casinoPoints ?? cruise?.points ?? 0));
}

function getCruiseWinLoss(cruise: any): number {
  return Number(cruise?.winLoss ?? cruise?.casinoWinLoss ?? cruise?.netWinLoss ?? cruise?.cashResult ?? 0);
}

function cruiseName(cruise: any): string {
  return `${cruise?.shipName || cruise?.ship || 'Unknown ship'} ${String(cruise?.sailDate || cruise?.startDate || '').slice(0, 10)}`.trim();
}

export function buildCertificateEarningChains(input: {
  bookedCruises?: any[];
  completedCruises?: any[];
  attributions?: BookedCruiseOfferAttribution[];
}): CertificateEarningChain[] {
  const bookedCruises = input.bookedCruises || [];
  const completedCruises = input.completedCruises || bookedCruises;
  const attributions = input.attributions || buildBookedCruiseOfferAttributions(bookedCruises);
  const completedCandidates = completedCruises
    .filter((cruise) => getCruisePoints(cruise) > 0)
    .map((cruise) => ({ cruise, points: getCruisePoints(cruise), dateMs: getDateMs(cruise?.sailDate || cruise?.startDate || cruise?.returnDate), winLoss: getCruiseWinLoss(cruise) }))
    .sort((a, b) => b.dateMs - a.dateMs);

  return attributions
    .filter((a) => a.isInstantCertificate && a.offerCode)
    .map((a) => {
      const bookedDateMs = getDateMs(a.sailDate);
      const candidate = completedCandidates.find((row) => row.points >= a.pointsRequired && (!bookedDateMs || row.dateMs <= bookedDateMs))
        || completedCandidates.find((row) => row.points >= a.pointsRequired)
        || completedCandidates[0];
      const warnings: string[] = [];
      if (!candidate) warnings.push('No completed cruise with point data could be linked to this instant certificate.');
      if (candidate && candidate.points < a.pointsRequired) warnings.push('Best available earning cruise has fewer points than this certificate threshold; link is low confidence.');
      const casinoResult = candidate ? candidate.winLoss : 0;
      const acquisitionCashCost = candidate ? Math.max(0, -casinoResult) : null;
      const estimatedCoinIn = a.pointsRequired > 0
        ? estimateCoinInForPoints({ targetPoints: a.pointsRequired, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0
        : 0;
      return {
        bookedCruiseId: a.cruiseId,
        bookedCruiseName: `${a.shipName} ${a.sailDate}`.trim(),
        offerCode: a.offerCode || '',
        certificateLevel: a.certificateLevel,
        pointsRequired: a.pointsRequired,
        likelyEarningCruiseId: candidate?.cruise?.id,
        likelyEarningCruiseName: candidate ? cruiseName(candidate.cruise) : undefined,
        pointsEarnedOnEarningCruise: candidate?.points,
        casinoResultOnEarningCruise: candidate?.winLoss,
        estimatedCoinInToEarn: estimatedCoinIn,
        acquisitionCashCost,
        acquisitionCoinInVolume: estimatedCoinIn,
        confidence: candidate && candidate.points >= a.pointsRequired ? (a.confidence === 'high' ? 'high' : 'medium') : 'low',
        warnings,
      };
    });
}
