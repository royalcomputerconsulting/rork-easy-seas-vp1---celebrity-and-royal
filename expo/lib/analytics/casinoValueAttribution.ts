import { buildBookedCruiseOfferAttributions, type BookedCruiseOfferAttribution } from '@/lib/offers/offerAttribution';
import { buildCertificateEarningChains, type CertificateEarningChain } from '@/lib/casino/certificateEarningChain';
import { buildTrueMakeoutResults, type TrueMakeoutResult } from '@/lib/value/trueMakeout';

export type CasinoValueAttributionSummary = {
  bookedCruiseAttributions: BookedCruiseOfferAttribution[];
  certificateEarningChains: CertificateEarningChain[];
  trueMakeoutResults: TrueMakeoutResult[];
  totals: {
    retailValueReceived: number;
    casinoCompValue: number;
    annualCruiseValue: number;
    freeplayValue: number;
    tradeInValue: number;
    obcValue: number;
    taxesAndFeesPaid: number;
    farePaid: number;
    onboardSpend: number;
    casinoWinLoss: number;
    certificateValueCreated: number;
    futureValueCreated: number;
    netMakeout: number;
    estimatedCoinIn: number;
    pointsEarned: number;
  };
  warnings: string[];
};

function sum(rows: TrueMakeoutResult[], field: keyof TrueMakeoutResult): number {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

export function buildCasinoValueAttributionSummary(input: { bookedCruises?: any[]; completedCruises?: any[]; sessions?: any[] }): CasinoValueAttributionSummary {
  const bookedCruises = input.bookedCruises || [];
  const completedCruises = input.completedCruises || bookedCruises;
  const bookedCruiseAttributions = buildBookedCruiseOfferAttributions(bookedCruises);
  const certificateEarningChains = buildCertificateEarningChains({ bookedCruises, completedCruises, attributions: bookedCruiseAttributions });
  const trueMakeoutResults = buildTrueMakeoutResults(bookedCruises, bookedCruiseAttributions);
  const warnings = [
    ...bookedCruiseAttributions.flatMap((row) => row.warnings.map((warning) => `${row.shipName}: ${warning}`)),
    ...certificateEarningChains.flatMap((row) => row.warnings.map((warning) => `${row.bookedCruiseName}: ${warning}`)),
    ...trueMakeoutResults.flatMap((row) => row.warnings.map((warning) => `${row.shipName}: ${warning}`)),
  ];
  return {
    bookedCruiseAttributions,
    certificateEarningChains,
    trueMakeoutResults,
    totals: {
      retailValueReceived: sum(trueMakeoutResults, 'retailValueReceived'),
      casinoCompValue: sum(trueMakeoutResults, 'casinoCompValue'),
      annualCruiseValue: sum(trueMakeoutResults, 'annualCruiseValue'),
      freeplayValue: sum(trueMakeoutResults, 'freeplayValue'),
      tradeInValue: sum(trueMakeoutResults, 'tradeInValue'),
      obcValue: sum(trueMakeoutResults, 'obcValue'),
      taxesAndFeesPaid: sum(trueMakeoutResults, 'taxesAndFeesPaid'),
      farePaid: sum(trueMakeoutResults, 'farePaid'),
      onboardSpend: sum(trueMakeoutResults, 'onboardSpend'),
      casinoWinLoss: sum(trueMakeoutResults, 'casinoWinLoss'),
      certificateValueCreated: sum(trueMakeoutResults, 'certificateValueCreated'),
      futureValueCreated: sum(trueMakeoutResults, 'futureValueCreated'),
      netMakeout: sum(trueMakeoutResults, 'netMakeout'),
      estimatedCoinIn: sum(trueMakeoutResults, 'estimatedCoinIn'),
      pointsEarned: sum(trueMakeoutResults, 'pointsEarned'),
    },
    warnings,
  };
}
