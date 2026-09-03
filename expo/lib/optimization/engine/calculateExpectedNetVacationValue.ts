import { round } from '../models/statistics';

export interface ExpectedNetVacationValueInput {
  realizedCertificateValue: number;
  futureOfferValue?: number;
  tierValue?: number;
  ancillaryValue?: number;
  cruiseSavings?: number;
  expectedGamblingLoss: number;
  incrementalTravelCost?: number;
  incrementalCruiseCost?: number;
  expectedUnredeemedValueLoss?: number;
  riskPenalty?: number;
}

export interface ExpectedNetVacationValueBreakdown extends Required<ExpectedNetVacationValueInput> {
  totalExpectedValue: number;
  totalExpectedCost: number;
  expectedNetVacationValue: number;
}

const nonnegative = (value: number | undefined) => Math.max(0, Number.isFinite(value) ? value ?? 0 : 0);

export function calculateExpectedNetVacationValue(input: ExpectedNetVacationValueInput): ExpectedNetVacationValueBreakdown {
  const breakdown = {
    realizedCertificateValue: nonnegative(input.realizedCertificateValue),
    futureOfferValue: nonnegative(input.futureOfferValue),
    tierValue: nonnegative(input.tierValue),
    ancillaryValue: nonnegative(input.ancillaryValue),
    cruiseSavings: nonnegative(input.cruiseSavings),
    expectedGamblingLoss: nonnegative(input.expectedGamblingLoss),
    incrementalTravelCost: nonnegative(input.incrementalTravelCost),
    incrementalCruiseCost: nonnegative(input.incrementalCruiseCost),
    expectedUnredeemedValueLoss: nonnegative(input.expectedUnredeemedValueLoss),
    riskPenalty: nonnegative(input.riskPenalty),
  };
  const totalExpectedValue = breakdown.realizedCertificateValue + breakdown.futureOfferValue + breakdown.tierValue + breakdown.ancillaryValue + breakdown.cruiseSavings;
  const totalExpectedCost = breakdown.expectedGamblingLoss + breakdown.incrementalTravelCost + breakdown.incrementalCruiseCost + breakdown.expectedUnredeemedValueLoss + breakdown.riskPenalty;
  return { ...breakdown, totalExpectedValue: round(totalExpectedValue, 2), totalExpectedCost: round(totalExpectedCost, 2), expectedNetVacationValue: round(totalExpectedValue - totalExpectedCost, 2) };
}
