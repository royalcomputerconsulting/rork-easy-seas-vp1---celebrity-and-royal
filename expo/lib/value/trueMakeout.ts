import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';
import { buildBookedCruiseOfferAttribution, type BookedCruiseOfferAttribution } from '@/lib/offers/offerAttribution';

export type TrueMakeoutResult = {
  cruiseId: string;
  shipName: string;
  sailDate: string;
  offerCode: string | null;
  offerType: string;
  retailValueReceived: number;
  casinoCompValue: number;
  annualCruiseValue: number;
  freeplayValue: number;
  tradeInValue: number;
  obcValue: number;
  fccApplied: number;
  nextCruiseValue: number;
  taxesAndFeesPaid: number;
  farePaid: number;
  onboardSpend: number;
  casinoWinLoss: number;
  pointsEarned: number;
  estimatedCoinIn: number;
  pointsRequiredForCertificate: number;
  certificateValueCreated: number;
  futureValueCreated: number;
  grossValueReceived: number;
  actualCashCost: number;
  netMakeout: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
};

function n(...values: any[]): number {
  for (const value of values) {
    const num = Number(String(value ?? '').replace(/[$,]/g, ''));
    if (Number.isFinite(num) && num !== 0) return num;
  }
  return 0;
}

function getPoints(cruise: any): number {
  return n(cruise?.pointsEarned, cruise?.casinoPointsEarned, cruise?.clubRoyalePointsEarned, cruise?.casinoPoints, cruise?.points);
}

export function buildTrueMakeoutResult(cruise: any, attribution?: BookedCruiseOfferAttribution): TrueMakeoutResult {
  const a = attribution || buildBookedCruiseOfferAttribution(cruise);
  const retailValueReceived = n(cruise?.retailCruiseValue, cruise?.retailValue, cruise?.cabinsRetailValue, cruise?.value, cruise?.totalRetailValue);
  const casinoCompValue = n(cruise?.casinoCompValue, cruise?.compValue, cruise?.cruiseValueCaptured, cruise?.offerValue);
  const annualCruiseValue = n(cruise?.annualCruiseValue, cruise?.annualCruiseBenefitValue);
  const freeplayValue = n(cruise?.freeplayValue, cruise?.freePlayValue, cruise?.promoFreeplay, cruise?.freeplay);
  const tradeInValue = n(cruise?.tradeInValue, cruise?.tradeValue);
  const obcValue = n(cruise?.obcValue, cruise?.onboardCredit, cruise?.onboardCreditValue);
  const fccApplied = n(cruise?.fccApplied, cruise?.futureCruiseCreditApplied);
  const nextCruiseValue = n(cruise?.nextCruiseValue, cruise?.nextCruiseApplied, cruise?.nextCruiseCertificateValue);
  const taxesAndFeesPaid = n(cruise?.taxesAndFees, cruise?.taxesFees, cruise?.taxesPaid, cruise?.portFees);
  const farePaid = n(cruise?.farePaid, cruise?.amountPaid, cruise?.paid, cruise?.cashPaid);
  const onboardSpend = n(cruise?.onboardSpend, cruise?.voomCost, cruise?.diningCost, cruise?.spaCost);
  const casinoWinLoss = n(cruise?.casinoWinLoss, cruise?.winLoss, cruise?.netWinLoss, cruise?.cashResult);
  const pointsEarned = getPoints(cruise);
  const estimatedCoinIn = n(cruise?.estimatedCoinIn, cruise?.coinIn) || (pointsEarned > 0 ? estimateCoinInForPoints({ targetPoints: pointsEarned, brand: 'royal', gameCategory: 'reel-slot' }).coinIn : 0);
  const certificateValueCreated = n(cruise?.certificateValueCreated, cruise?.instantCertificateValue, cruise?.futureOfferValueCreated);
  const futureValueCreated = certificateValueCreated + n(cruise?.futureValueCreated);
  const baseRetailValue = Math.max(retailValueReceived, casinoCompValue, annualCruiseValue);
  const grossValueReceived = baseRetailValue + freeplayValue + tradeInValue + obcValue + futureValueCreated + nextCruiseValue;
  const casinoLossCost = casinoWinLoss < 0 ? Math.abs(casinoWinLoss) : 0;
  const actualCashCost = farePaid + taxesAndFeesPaid + onboardSpend + casinoLossCost;
  const casinoWinGain = casinoWinLoss > 0 ? casinoWinLoss : 0;
  const netMakeout = grossValueReceived + casinoWinGain - actualCashCost;
  const warnings = [...a.warnings];
  if (!retailValueReceived && !casinoCompValue && !annualCruiseValue) warnings.push('Retail/comp cruise value missing; make-out may be understated.');
  if (!pointsEarned) warnings.push('Casino points missing for this cruise.');
  return {
    cruiseId: a.cruiseId,
    shipName: a.shipName,
    sailDate: a.sailDate,
    offerCode: a.offerCode,
    offerType: a.offerType,
    retailValueReceived: baseRetailValue,
    casinoCompValue,
    annualCruiseValue,
    freeplayValue,
    tradeInValue,
    obcValue,
    fccApplied,
    nextCruiseValue,
    taxesAndFeesPaid,
    farePaid,
    onboardSpend,
    casinoWinLoss,
    pointsEarned,
    estimatedCoinIn,
    pointsRequiredForCertificate: a.pointsRequired,
    certificateValueCreated,
    futureValueCreated,
    grossValueReceived,
    actualCashCost,
    netMakeout,
    confidence: a.confidence,
    warnings,
  };
}

export function buildTrueMakeoutResults(cruises: any[] = [], attributions?: BookedCruiseOfferAttribution[]): TrueMakeoutResult[] {
  const map = new Map((attributions || []).map((a) => [a.cruiseId, a]));
  return cruises.map((cruise) => buildTrueMakeoutResult(cruise, map.get(String(cruise?.id))));
}
