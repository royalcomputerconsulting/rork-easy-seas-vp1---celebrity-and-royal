import type {
  EvidenceDescriptor,
  RecommendationConfidence,
  TripCostCategory,
  TripCostEntry,
  TripCostLedger,
  ValueEfficiencyMetrics,
} from '@/types/intelligence';

export const REQUIRED_TRIP_COST_CATEGORIES: TripCostCategory[] = [
  'cruise_fare', 'taxes_fees', 'airfare', 'hotel', 'transfers', 'parking',
  'gratuities', 'wifi', 'drinks', 'dining', 'excursions', 'upgrade',
  'insurance', 'gambling_budget',
];

const usableAmount = (entry: TripCostEntry): number => (
  typeof entry.amount === 'number' && Number.isFinite(entry.amount) && entry.amount >= 0 ? entry.amount : 0
);

function confidenceFor(entries: TripCostEntry[], missingCategories: TripCostCategory[]): RecommendationConfidence {
  if (entries.length === 0) return 'insufficient';
  const materialMissing = missingCategories.filter((category) => ['cruise_fare', 'taxes_fees', 'airfare', 'hotel', 'gambling_budget'].includes(category));
  if (materialMissing.length > 0) return 'low';
  const estimated = entries.filter((entry) => entry.evidenceStatus === 'estimated').length;
  return estimated === 0 ? 'high' : estimated <= Math.max(2, Math.floor(entries.length * 0.25)) ? 'medium' : 'low';
}

export function buildTripCostLedger(
  tripId: string,
  entries: TripCostEntry[],
  currency = 'USD',
): TripCostLedger {
  const tripEntries = entries.filter((entry) => entry.tripId === tripId && entry.currency === currency);
  const presentCategories = new Set(tripEntries.filter((entry) => entry.amount !== null).map((entry) => entry.category));
  const missingCategories = REQUIRED_TRIP_COST_CATEGORIES.filter((category) => !presentCategories.has(category));
  const verifiedAndImportedTotal = tripEntries
    .filter((entry) => ['verified', 'imported', 'user_entered'].includes(entry.evidenceStatus))
    .reduce((sum, entry) => sum + usableAmount(entry), 0);
  const estimatedTotal = tripEntries
    .filter((entry) => entry.evidenceStatus === 'estimated')
    .reduce((sum, entry) => sum + usableAmount(entry), 0);
  const gamblingBudget = tripEntries
    .filter((entry) => entry.category === 'gambling_budget')
    .reduce((sum, entry) => sum + usableAmount(entry), 0);
  const recordedEvidence: EvidenceDescriptor[] = tripEntries.map((entry) => ({
    field: entry.category,
    status: entry.evidenceStatus,
    source: entry.source,
    capturedAt: entry.updatedAt,
    explanation: entry.amount === null ? `${entry.label} has no amount.` : `${entry.label}: ${entry.currency} ${usableAmount(entry).toFixed(2)}.`,
    couldChangeRecommendation: entry.amount === null || entry.evidenceStatus === 'estimated',
  }));
  const missingEvidence: EvidenceDescriptor[] = missingCategories.map((category) => ({
    field: category,
    status: 'missing',
    explanation: `${category.replaceAll('_', ' ')} has not been entered.`,
    couldChangeRecommendation: true,
  }));
  const evidence = recordedEvidence.concat(missingEvidence);
  return {
    tripId,
    currency,
    entries: tripEntries,
    verifiedAndImportedTotal,
    estimatedTotal,
    expectedTotal: verifiedAndImportedTotal + estimatedTotal,
    gamblingBudget,
    missingCategories,
    evidence,
    confidence: confidenceFor(tripEntries, missingCategories),
  };
}

export function calculateValueEfficiency(input: {
  totalVacationValue: number;
  ledger: TripCostLedger;
  vacationDays: number;
  casinoHours?: number | null;
}): ValueEfficiencyMetrics {
  const totalVacationValue = Math.max(0, Number.isFinite(input.totalVacationValue) ? input.totalVacationValue : 0);
  const vacationDays = Math.max(1, Math.round(input.vacationDays || 1));
  const casinoHours = typeof input.casinoHours === 'number' && Number.isFinite(input.casinoHours) && input.casinoHours > 0 ? input.casinoHours : null;
  const netVacationValue = totalVacationValue - input.ledger.expectedTotal;
  return {
    totalVacationValue,
    totalTripCost: input.ledger.expectedTotal,
    netVacationValue,
    vacationDays,
    casinoHours,
    valuePerVacationDay: netVacationValue / vacationDays,
    valuePerCasinoHour: casinoHours ? netVacationValue / casinoHours : null,
    confidence: input.ledger.confidence,
  };
}
