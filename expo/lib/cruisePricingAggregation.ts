import type { BookedCruise } from '@/types/models';
import type { CruisePricing } from '@/lib/cruisePricingSync';

type PricingConfidence = CruisePricing['confidence'];

const CONFIDENCE_RANK: Record<NonNullable<PricingConfidence>, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function normalizePrice(value?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

function pickLowestPrice(values: Array<number | undefined>): number | undefined {
  const validValues = values.filter((value): value is number => value !== undefined);

  if (validValues.length === 0) {
    return undefined;
  }

  return Math.min(...validValues);
}

function pickLatestTimestamp(values: string[]): string {
  const parsedValues = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (parsedValues.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...parsedValues)).toISOString();
}

function pickBestConfidence(values: PricingConfidence[]): PricingConfidence | undefined {
  const validValues = values.filter((value): value is NonNullable<PricingConfidence> => value !== undefined);

  if (validValues.length === 0) {
    return undefined;
  }

  return validValues.reduce<NonNullable<PricingConfidence>>((best, current) => {
    return CONFIDENCE_RANK[current] > CONFIDENCE_RANK[best] ? current : best;
  }, validValues[0]);
}

export interface AggregatedCruisePricing {
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  portTaxesFees?: number;
  confidence?: PricingConfidence;
  syncedAt: string;
  sources: CruisePricing['source'][];
  hasPricingData: boolean;
  update: Partial<BookedCruise>;
}

export function aggregateCruisePricing(pricingRecords: CruisePricing[]): AggregatedCruisePricing {
  const interiorPrice = pickLowestPrice(pricingRecords.map((record) => normalizePrice(record.interiorPrice)));
  const oceanviewPrice = pickLowestPrice(pricingRecords.map((record) => normalizePrice(record.oceanviewPrice)));
  const balconyPrice = pickLowestPrice(pricingRecords.map((record) => normalizePrice(record.balconyPrice)));
  const suitePrice = pickLowestPrice(pricingRecords.map((record) => normalizePrice(record.suitePrice)));
  const portTaxesFees = pickLowestPrice(pricingRecords.map((record) => normalizePrice(record.portTaxesFees)));
  const confidence = pickBestConfidence(pricingRecords.map((record) => record.confidence));
  const syncedAt = pickLatestTimestamp(pricingRecords.map((record) => record.lastUpdated));
  const sources = [...new Set(pricingRecords.map((record) => record.source))];
  const hasPricingData = [interiorPrice, oceanviewPrice, balconyPrice, suitePrice, portTaxesFees].some((value) => value !== undefined);

  const update: Partial<BookedCruise> = {
    updatedAt: syncedAt,
  };

  if (interiorPrice !== undefined) {
    update.interiorPrice = interiorPrice;
  }

  if (oceanviewPrice !== undefined) {
    update.oceanviewPrice = oceanviewPrice;
  }

  if (balconyPrice !== undefined) {
    update.balconyPrice = balconyPrice;
  }

  if (suitePrice !== undefined) {
    update.suitePrice = suitePrice;
  }

  if (portTaxesFees !== undefined) {
    update.taxes = portTaxesFees;
  }

  return {
    interiorPrice,
    oceanviewPrice,
    balconyPrice,
    suitePrice,
    portTaxesFees,
    confidence,
    syncedAt,
    sources,
    hasPricingData,
    update,
  };
}
