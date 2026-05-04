import { findRetailValueByShipAndDate, getKnownRetailValue } from '@/constants/knownRetailValues';
import type { Cruise, CasinoOffer, BookedCruise, CasinoPayTable } from '@/types/models';

const CABIN_BASE_PRICES: Record<string, number> = {
  'Penthouse Suite': 8000,
  'Royal Suite': 6000,
  "Owner's Suite 2BR": 5000,
  'Grand Suite 2BR': 4500,
  "Owner's Suite": 4000,
  'Grand Suite': 3500,
  'Junior Suite': 2500,
  'Suite GTY': 2000,
  'Balcony': 1500,
  'Balcony GTY': 1200,
  'Oceanview': 1100,
  'Oceanview GTY': 900,
  'Interior': 800,
  'Interior GTY': 600,
};

function estimateCabinRetailValue(cabinType: string, nights: number): number {
  const typeKey = getCabinTypeKey(cabinType);
  const basePrice = CABIN_BASE_PRICES[typeKey] || 1000;
  const perNightRate = basePrice / 7;
  return Math.round(perNightRate * nights);
}

export const CABIN_PRICE_MULTIPLIERS: Record<string, number> = {
  'Interior GTY': 0.7,
  'Interior': 0.8,
  'Oceanview GTY': 0.9,
  'Oceanview': 1.0,
  'Balcony GTY': 1.15,
  'Balcony': 1.3,
  'Suite GTY': 1.6,
  'Junior Suite': 1.8,
  'Grand Suite': 2.2,
  "Owner's Suite": 2.8,
  'Grand Suite 2BR': 3.0,
  "Owner's Suite 2BR": 3.5,
  'Royal Suite': 4.0,
  'Penthouse Suite': 5.0,
};

export const DOLLARS_PER_POINT = 5;
export const GUEST_COUNT_DEFAULT = 2;
const DEFAULT_PORT_TAXES_PER_PERSON_FOR_7_NIGHTS = 162;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getFirstFiniteNumber(...values: Array<number | null | undefined>): number | undefined {
  return values.find((value): value is number => isFiniteNumber(value));
}

function getFirstPositiveNumber(...values: Array<number | null | undefined>): number | undefined {
  return values.find((value): value is number => isFiniteNumber(value) && value > 0);
}

function getGuestCount(entity: Cruise | BookedCruise | CasinoOffer): number {
  const guests = entity.guests;
  return isFiniteNumber(guests) && guests > 0 ? Math.max(1, Math.round(guests)) : GUEST_COUNT_DEFAULT;
}

function getMoneyFromPayload(entity: Cruise | BookedCruise, keys: string[]): number | undefined {
  const payload = (entity as BookedCruise).sourcePayload;
  if (!payload || typeof payload !== 'object') return undefined;

  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[$,]/g, '').trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return undefined;
}

function getKnownRetailValueForEntity(entity: Cruise | BookedCruise): number | undefined {
  const bookedEntity = entity as BookedCruise;
  const knownById = [entity.id, bookedEntity.bookingId, bookedEntity.reservationNumber]
    .map((id) => (id ? getKnownRetailValue(id) : null))
    .find((value): value is number => isFiniteNumber(value) && value > 0);

  if (knownById !== undefined) {
    return knownById;
  }

  if (entity.shipName && entity.sailDate) {
    const knownByShipDate = findRetailValueByShipAndDate(entity.shipName, entity.sailDate);
    if (isFiniteNumber(knownByShipDate) && knownByShipDate > 0) {
      return knownByShipDate;
    }
  }

  return undefined;
}

interface ResolvedCruiseRetailValue {
  totalRetailValue: number;
  perGuestRetailValue: number;
  source: 'known' | 'explicit' | 'payload' | 'pricing' | 'estimate';
}

/** Resolves the full-booking cabin retail value; known/imported totals are never multiplied as if per-person. */
export function resolveCruiseRetailValue(cruise: Cruise | BookedCruise, cabinType?: string): ResolvedCruiseRetailValue {
  const guestCount = getGuestCount(cruise);
  const knownRetailValue = getKnownRetailValueForEntity(cruise);
  const explicitRetailValue = getFirstPositiveNumber(
    (cruise as BookedCruise).retailValue,
    (cruise as BookedCruise).totalRetailCost,
    cruise.originalPrice,
    cruise.totalValue,
  );
  const payloadRetailValue = getMoneyFromPayload(cruise, [
    'totalCruiseFare',
    'totalRetailCost',
    'retailValue',
    'retailCabinValue',
    'grossRetailValue',
    'grossTotal',
  ]);
  const authoritativeRetailValue = getFirstPositiveNumber(knownRetailValue, explicitRetailValue, payloadRetailValue);

  if (authoritativeRetailValue !== undefined) {
    const source: ResolvedCruiseRetailValue['source'] = knownRetailValue !== undefined
      ? 'known'
      : explicitRetailValue !== undefined
        ? 'explicit'
        : 'payload';

    return {
      totalRetailValue: roundMoney(authoritativeRetailValue),
      perGuestRetailValue: roundMoney(authoritativeRetailValue / guestCount),
      source,
    };
  }

  const targetCabinType = cabinType || cruise.cabinType || 'Balcony';
  let cabinPrice = getCabinPriceFromEntity(cruise, targetCabinType) || cruise.price || 0;
  let source: ResolvedCruiseRetailValue['source'] = 'pricing';

  if (cabinPrice === 0 && cruise.nights > 0) {
    cabinPrice = estimateCabinRetailValue(targetCabinType, cruise.nights);
    source = 'estimate';
  }

  const totalRetailValue = roundMoney(cabinPrice * guestCount);
  return {
    totalRetailValue,
    perGuestRetailValue: guestCount > 0 ? roundMoney(totalRetailValue / guestCount) : totalRetailValue,
    source,
  };
}

function estimateTaxesFees(nights: number, guestCount: number): number {
  const normalizedNights = nights > 0 ? nights : 7;
  return roundMoney((DEFAULT_PORT_TAXES_PER_PERSON_FOR_7_NIGHTS / 7) * normalizedNights * guestCount);
}

function resolveCruiseTaxesFees(cruise: Cruise | BookedCruise, guestCount: number): { value: number; isEstimated: boolean } {
  const payloadTaxesFees = getMoneyFromPayload(cruise, [
    'taxesFeesPortExpenses',
    'portTaxesFees',
    'taxesFees',
    'taxesAndFees',
    'portCharges',
    'totalCharge',
  ]);
  const explicitTaxesFees = getFirstPositiveNumber(
    payloadTaxesFees,
    (cruise as BookedCruise).taxesFeesEstimate,
    cruise.taxes,
    (cruise as BookedCruise).pricePaid,
  );

  if (explicitTaxesFees !== undefined) {
    return { value: roundMoney(explicitTaxesFees), isEstimated: false };
  }

  return { value: estimateTaxesFees(cruise.nights || 0, guestCount), isEstimated: true };
}

function resolveCruisePaidValue(cruise: Cruise | BookedCruise, taxesFees: number): { value: number; isActual: boolean } {
  const explicitPaid = getFirstFiniteNumber(
    (cruise as BookedCruise).netEffectivePaid,
    (cruise as BookedCruise).pricePaid,
    (cruise as BookedCruise).amountPaid,
  );

  if (explicitPaid !== undefined) {
    return { value: roundMoney(Math.max(0, explicitPaid)), isActual: true };
  }

  return { value: roundMoney(Math.max(0, taxesFees)), isActual: false };
}

export interface CabinPricing {
  interior?: number;
  oceanview?: number;
  balcony?: number;
  suite?: number;
  juniorSuite?: number;
  grandSuite?: number;
}

export interface ValueBreakdown {
  cabinValue: number;
  cabinValueForTwo: number;
  taxesFees: number;
  freePlayValue: number;
  obcValue: number;
  tradeInValue: number;
  freeInternetValue: number;
  totalRetailValue: number;
  compValue: number;
  discountValue: number;
  amountPaid: number;
  netValue: number;
  casinoWinnings: number;
  totalValueReceived: number;
  trueOutOfPocket: number;
  totalProfit: number;
  valuePerDollar: number;
  isFullyComped: boolean;
  is2Person: boolean;
  coverageFraction: number;
  formula: string;
}

export function getCabinTypeKey(cabinType: string): string {
  const normalized = cabinType.toLowerCase().trim();
  
  if (normalized.includes('interior') && normalized.includes('gty')) return 'Interior GTY';
  if (normalized.includes('interior')) return 'Interior';
  if (normalized.includes('ocean') && normalized.includes('gty')) return 'Oceanview GTY';
  if (normalized.includes('ocean')) return 'Oceanview';
  if (normalized.includes('balcony') && normalized.includes('gty')) return 'Balcony GTY';
  if (normalized.includes('balcony')) return 'Balcony';
  if (normalized.includes('penthouse')) return 'Penthouse Suite';
  if (normalized.includes('royal') && normalized.includes('suite')) return 'Royal Suite';
  if (normalized.includes('owner') && normalized.includes('2br')) return "Owner's Suite 2BR";
  if (normalized.includes('grand') && normalized.includes('2br')) return 'Grand Suite 2BR';
  if (normalized.includes('owner')) return "Owner's Suite";
  if (normalized.includes('grand')) return 'Grand Suite';
  if (normalized.includes('junior') || normalized.includes('jr')) return 'Junior Suite';
  if (normalized.includes('suite') && normalized.includes('gty')) return 'Suite GTY';
  if (normalized.includes('suite')) return 'Junior Suite';
  
  return 'Balcony';
}

export function getCabinPriceFromEntity(
  entity: Cruise | CasinoOffer | BookedCruise,
  cabinType?: string
): number | undefined {
  const entityWithCabin = entity as Cruise | BookedCruise;
  const entityWithRoom = entity as CasinoOffer;
  const targetType = cabinType || entityWithCabin.cabinType || entityWithRoom.roomType || 'Balcony';
  const typeKey = getCabinTypeKey(targetType);
  
  if (typeKey.includes('Interior')) {
    return entity.interiorPrice;
  }
  if (typeKey.includes('Oceanview')) {
    return entity.oceanviewPrice;
  }
  if (typeKey.includes('Balcony')) {
    return entity.balconyPrice;
  }
  if (typeKey.includes('Junior')) {
    return entity.juniorSuitePrice || entity.suitePrice;
  }
  if (typeKey.includes('Grand')) {
    return entity.grandSuitePrice || entity.suitePrice;
  }
  if (typeKey.includes('Suite')) {
    return entity.suitePrice;
  }
  
  return entity.balconyPrice || entity.oceanviewPrice || entity.interiorPrice || (entity as Cruise).price;
}

export function estimateCabinPrice(
  baseCabinPrice: number,
  fromType: string,
  toType: string
): number {
  const fromMultiplier = CABIN_PRICE_MULTIPLIERS[getCabinTypeKey(fromType)] || 1.0;
  const toMultiplier = CABIN_PRICE_MULTIPLIERS[getCabinTypeKey(toType)] || 1.0;
  
  if (fromMultiplier === 0) return baseCabinPrice;
  
  return Math.round((baseCabinPrice / fromMultiplier) * toMultiplier);
}

export function calculateCasinoPayTable(
  cabinPrice: number,
  cabinType: string,
  taxesFees: number = 0,
  freePlay: number = 0,
  obc: number = 0,
  guestCount: number = GUEST_COUNT_DEFAULT
): CasinoPayTable {
  const retailCabinPrice = cabinPrice * guestCount;
  const cabinValue = retailCabinPrice;
  const totalValue = cabinValue + taxesFees + freePlay + obc;
  const discountValue = retailCabinPrice;
  
  console.log('[ValueCalculator] CasinoPayTable calculated:', {
    cabinPrice,
    cabinType,
    taxesFees,
    freePlay,
    obc,
    guestCount,
    retailCabinPrice,
    totalValue,
  });

  return {
    freePlay,
    OBC: obc,
    cabinValue,
    cabinType,
    taxesFees,
    retailCabinPrice,
    discountValue,
    totalValue,
  };
}

export function calculateOfferValue(
  offer: CasinoOffer,
  _amountPaid: number = 0
): ValueBreakdown {
  const cabinType = offer.roomType || 'Balcony';
  const cabinPrice = getCabinPriceFromEntity(offer, cabinType) || 0;
  const guestCount = getGuestCount(offer);
  
  const cabinValue = cabinPrice;
  const cabinValueForTwo = cabinPrice * guestCount;
  const taxesFees = offer.taxesFees || offer.portCharges || 0;
  const freePlayValue = offer.freePlay || offer.freeplayAmount || 0;
  const obcValue = offer.OBC || offer.obcAmount || 0;
  const tradeInValue = offer.tradeInValue || 0;
  const freeInternetValue = (offer.nights || 7) * 30;
  
  const trueOutOfPocket = taxesFees;
  
  const totalRetailValue = cabinValueForTwo;
  const totalValueReceived = cabinValueForTwo + freePlayValue + obcValue + tradeInValue + freeInternetValue;
  
  const casinoWinnings = 0;
  const totalProfit = totalValueReceived - trueOutOfPocket;
  
  const valuePerDollar = trueOutOfPocket > 0 
    ? totalValueReceived / trueOutOfPocket 
    : (totalValueReceived > 0 ? Infinity : 0);
  
  const compValue = totalValueReceived;
  const discountValue = totalRetailValue;
  const netValue = totalProfit;
  
  const isFullyComped = true;
  const is2Person = offer.classification === '2person' || 
                    offer.offerType === '2person' ||
                    (offer.guestsInfo?.toLowerCase().includes('2 person') || false);
  
  const coverageFraction = 1;
  
  const formula = `Value Per $1 = (Retail ${cabinValueForTwo} + FreePlay ${freePlayValue} + OBC ${obcValue}) / Taxes ${trueOutOfPocket}`;

  console.log('[ValueCalculator] Offer value calculated:', {
    offerId: offer.id,
    offerCode: offer.offerCode,
    cabinType,
    cabinValueForTwo,
    totalValueReceived,
    trueOutOfPocket,
    totalProfit,
    valuePerDollar: valuePerDollar === Infinity ? 'Infinite' : valuePerDollar.toFixed(2),
    isFullyComped,
    is2Person,
  });

  return {
    cabinValue,
    cabinValueForTwo,
    taxesFees,
    freePlayValue,
    obcValue,
    tradeInValue,
    freeInternetValue,
    totalRetailValue,
    compValue,
    discountValue,
    amountPaid: trueOutOfPocket,
    netValue,
    casinoWinnings,
    totalValueReceived,
    trueOutOfPocket,
    totalProfit,
    valuePerDollar,
    isFullyComped,
    is2Person,
    coverageFraction,
    formula,
  };
}

export function calculateCruiseValue(
  cruise: Cruise | BookedCruise,
  amountPaid?: number,
  casinoWinnings?: number
): ValueBreakdown {
  const bookedCruise = cruise as BookedCruise;
  const cabinType = cruise.cabinType || 'Balcony';
  const guestCount = getGuestCount(cruise);
  const retailInfo = resolveCruiseRetailValue(cruise, cabinType);
  const taxesFeesInfo = resolveCruiseTaxesFees(cruise, guestCount);
  const paidInfo = resolveCruisePaidValue(cruise, taxesFeesInfo.value);
  
  const cabinValueForTwo = retailInfo.totalRetailValue;
  const trueOutOfPocket = roundMoney(amountPaid ?? paidInfo.value);
  const explicitCasinoDiscount = getFirstPositiveNumber(bookedCruise.totalCasinoDiscount);
  const casinoDiscount = roundMoney(explicitCasinoDiscount ?? Math.max(0, cabinValueForTwo - trueOutOfPocket));
  const hasReceiptData = retailInfo.source !== 'estimate' || paidInfo.isActual;
  const cabinValue = retailInfo.perGuestRetailValue;
  const taxesFees = taxesFeesInfo.value;
  
  const freePlayValue = cruise.freePlay || 0;
  const obcValue = cruise.freeOBC || 0;
  const tradeInValue = cruise.tradeInValue || 0;
  const freeInternetValue = cruise.freeWifi ? (cruise.nights || 7) * 30 : 0;
  
  const winnings = casinoWinnings ?? bookedCruise.winnings ?? 0;
  
  const clubRoyalePointsValue = (bookedCruise.earnedPoints || bookedCruise.casinoPoints || 0) * 0.01;
  
  const totalRetailValue = cabinValueForTwo;
  
  const totalValueReceived = cabinValueForTwo + freePlayValue + obcValue + tradeInValue + freeInternetValue + clubRoyalePointsValue;
  
  const totalProfit = totalValueReceived + winnings - trueOutOfPocket;
  
  const valuePerDollar = trueOutOfPocket > 0 
    ? (totalValueReceived + winnings) / trueOutOfPocket 
    : (totalValueReceived + winnings > 0 ? Infinity : 0);
  
  const compValue = totalValueReceived;
  const discountValue = casinoDiscount;
  const netValue = totalProfit;
  
  const isFullyComped = cabinValueForTwo > 0 ? trueOutOfPocket <= cabinValueForTwo * 0.1 || casinoDiscount >= cabinValueForTwo * 0.9 : false;
  const is2Person = guestCount >= 2;
  
  const coverageFraction = cabinValueForTwo > 0 ? Math.min(1, casinoDiscount / cabinValueForTwo) : 0;
  
  const formula = `Value Per $1 = (Retail ${cabinValueForTwo.toFixed(0)} + FreePlay ${freePlayValue} + OBC ${obcValue} + CR Points ${clubRoyalePointsValue.toFixed(0)} + Winnings ${winnings.toFixed(0)}) / Paid ${trueOutOfPocket.toFixed(2)}`;

  console.log('[ValueCalculator] Cruise value calculated:', {
    cruiseId: cruise.id,
    shipName: cruise.shipName,
    hasReceiptData,
    retailSource: retailInfo.source,
    taxesFees,
    taxesFeesEstimated: taxesFeesInfo.isEstimated,
    paidIsActual: paidInfo.isActual,
    cabinValueForTwo,
    casinoDiscount,
    clubRoyalePointsValue,
    totalValueReceived,
    casinoWinnings: winnings,
    trueOutOfPocket,
    totalProfit,
    valuePerDollar: valuePerDollar === Infinity ? 'Infinite' : valuePerDollar.toFixed(2),
    isFullyComped,
  });

  return {
    cabinValue,
    cabinValueForTwo,
    taxesFees,
    freePlayValue,
    obcValue,
    tradeInValue,
    freeInternetValue,
    totalRetailValue,
    compValue,
    discountValue,
    amountPaid: trueOutOfPocket,
    netValue,
    casinoWinnings: winnings,
    totalValueReceived,
    trueOutOfPocket,
    totalProfit,
    valuePerDollar,
    isFullyComped,
    is2Person,
    coverageFraction,
    formula,
  };
}

export function calculateROIFromValue(
  retailValue: number,
  winnings: number,
  outOfPocketSpend: number
): { roi: number; roiPercentage: number } {
  if (outOfPocketSpend <= 0) {
    return { roi: 0, roiPercentage: 0 };
  }
  
  const totalReturn = retailValue + winnings;
  const roi = totalReturn - outOfPocketSpend;
  const roiPercentage = (roi / outOfPocketSpend) * 100;
  
  console.log('[ValueCalculator] ROI calculated:', {
    retailValue,
    winnings,
    outOfPocketSpend,
    totalReturn,
    roi,
    roiPercentage: `${roiPercentage.toFixed(1)}%`,
  });

  return { roi, roiPercentage };
}

export function calculateCostPerPoint(
  coinIn: number,
  pointsEarned: number
): number {
  if (pointsEarned <= 0) return 0;
  return coinIn / pointsEarned;
}

export function calculatePointsFromCoinIn(coinIn: number): number {
  return Math.floor(coinIn / DOLLARS_PER_POINT);
}

export function calculateCoinInFromPoints(points: number): number {
  return points * DOLLARS_PER_POINT;
}

export function calculatePortfolioValue(
  cruises: BookedCruise[]
): {
  totalRetailValue: number;
  totalAmountPaid: number;
  totalCompValue: number;
  totalSavings: number;
  totalPoints: number;
  totalCoinIn: number;
  totalWinnings: number;
  totalTaxesFees: number;
  totalProfit: number;
  avgValuePerDollar: number;
  avgROI: number;
  breakdowns: { cruiseId: string; breakdown: ValueBreakdown }[];
} {
  const breakdowns: { cruiseId: string; breakdown: ValueBreakdown }[] = [];
  
  let totalRetailValue = 0;
  let totalTaxesFees = 0;
  let totalCompValue = 0;
  let totalPoints = 0;
  let totalWinnings = 0;
  let totalValueReceived = 0;
  
  cruises.forEach(cruise => {
    const breakdown = calculateCruiseValue(cruise);
    breakdowns.push({ cruiseId: cruise.id, breakdown });
    
    totalRetailValue += breakdown.totalRetailValue;
    totalTaxesFees += breakdown.amountPaid;
    console.log('[ValueCalculator] Adding resolved paid/taxes amount:', {
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      amountPaid: breakdown.amountPaid,
      taxesFees: breakdown.taxesFees,
      retailValue: breakdown.totalRetailValue,
    });
    
    totalCompValue += breakdown.compValue;
    totalValueReceived += breakdown.totalValueReceived;
    totalWinnings += breakdown.casinoWinnings;
    
    const points = cruise.earnedPoints || cruise.casinoPoints || 0;
    totalPoints += points;
  });
  
  const totalAmountPaid = totalTaxesFees;
  
  const totalProfit = totalValueReceived + totalWinnings - totalTaxesFees;
  const totalSavings = totalRetailValue;
  
  const totalCoinIn = calculateCoinInFromPoints(totalPoints);
  
  const avgValuePerDollar = totalTaxesFees > 0 
    ? (totalValueReceived + totalWinnings) / totalTaxesFees 
    : (totalValueReceived + totalWinnings > 0 ? Infinity : 0);
  
  const avgROI = totalTaxesFees > 0 
    ? (totalProfit / totalTaxesFees) * 100 
    : (totalProfit > 0 ? 1000 : 0);

  console.log('[ValueCalculator] Portfolio value calculated:', {
    cruiseCount: cruises.length,
    totalRetailValue,
    totalTaxesFees,
    totalValueReceived,
    totalWinnings,
    totalProfit,
    avgValuePerDollar: avgValuePerDollar === Infinity ? 'Infinite' : avgValuePerDollar.toFixed(2),
    avgROI: `${avgROI.toFixed(1)}%`,
  });

  return {
    totalRetailValue,
    totalAmountPaid,
    totalCompValue,
    totalSavings,
    totalPoints,
    totalCoinIn,
    totalWinnings,
    totalTaxesFees,
    totalProfit,
    avgValuePerDollar,
    avgROI,
    breakdowns,
  };
}

export function rankOffersByValue(
  offers: CasinoOffer[],
  sortBy: 'totalValue' | 'netValue' | 'coverage' | 'freePlay' = 'totalValue'
): { offer: CasinoOffer; breakdown: ValueBreakdown; rank: number }[] {
  const withBreakdowns = offers.map(offer => ({
    offer,
    breakdown: calculateOfferValue(offer),
  }));
  
  const sorted = withBreakdowns.sort((a, b) => {
    switch (sortBy) {
      case 'netValue':
        return b.breakdown.netValue - a.breakdown.netValue;
      case 'coverage':
        return b.breakdown.coverageFraction - a.breakdown.coverageFraction;
      case 'freePlay':
        return b.breakdown.freePlayValue - a.breakdown.freePlayValue;
      case 'totalValue':
      default:
        return b.breakdown.totalRetailValue - a.breakdown.totalRetailValue;
    }
  });
  
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export function compareOffers(
  offerA: CasinoOffer,
  offerB: CasinoOffer
): {
  winner: 'A' | 'B' | 'tie';
  breakdownA: ValueBreakdown;
  breakdownB: ValueBreakdown;
  valueDifference: number;
  recommendation: string;
} {
  const breakdownA = calculateOfferValue(offerA);
  const breakdownB = calculateOfferValue(offerB);
  
  const valueDifference = breakdownA.netValue - breakdownB.netValue;
  
  let winner: 'A' | 'B' | 'tie';
  if (Math.abs(valueDifference) < 50) {
    winner = 'tie';
  } else if (valueDifference > 0) {
    winner = 'A';
  } else {
    winner = 'B';
  }
  
  let recommendation = '';
  if (winner === 'A') {
    recommendation = `Offer ${offerA.offerCode || 'A'} provides $${Math.abs(valueDifference).toFixed(0)} more value`;
  } else if (winner === 'B') {
    recommendation = `Offer ${offerB.offerCode || 'B'} provides $${Math.abs(valueDifference).toFixed(0)} more value`;
  } else {
    recommendation = 'Both offers provide similar value - choose based on cabin preference or dates';
  }
  
  if (breakdownA.isFullyComped && !breakdownB.isFullyComped) {
    recommendation += `. Note: ${offerA.offerCode || 'A'} is fully comped`;
  } else if (breakdownB.isFullyComped && !breakdownA.isFullyComped) {
    recommendation += `. Note: ${offerB.offerCode || 'B'} is fully comped`;
  }

  console.log('[ValueCalculator] Offers compared:', {
    offerA: offerA.offerCode,
    offerB: offerB.offerCode,
    winner,
    valueDifference,
    recommendation,
  });

  return {
    winner,
    breakdownA,
    breakdownB,
    valueDifference,
    recommendation,
  };
}

export interface OfferAggregateValue {
  totalCabinValue: number;
  totalTaxesFees: number;
  totalFreePlay: number;
  totalOBC: number;
  tradeInValue: number;
  aggregateTotalValue: number;
  cruiseCount: number;
  cruisesWithDetailedPricing: number;
  perks: string[];
  cruiseBreakdowns: {
    cruiseId: string;
    shipName: string;
    sailDate: string;
    nights: number;
    cabinValueForTwo: number;
    taxesFees: number;
    cruiseRetailValue: number;
  }[];
}

export function calculateOfferAggregateValue(
  offer: Cruise | CasinoOffer,
  allCruises: Cruise[],
  offerRoomType?: string
): OfferAggregateValue {
  const offerCode = (offer as Cruise).offerCode || (offer as CasinoOffer).offerCode;
  const roomType = offerRoomType || (offer as Cruise).cabinType || (offer as CasinoOffer).roomType || 'Balcony';
  
  const matchingCruises = allCruises.filter(c => c.offerCode === offerCode);
  
  if (matchingCruises.length === 0) {
    const singleCruise = offer as Cruise;
    const cabinPrice = getCabinPriceFromEntity(singleCruise, roomType) || singleCruise.price || 0;
    const cabinValueForTwo = cabinPrice * GUEST_COUNT_DEFAULT;
    const taxesFees = singleCruise.taxes || 0;
    const freePlay = singleCruise.freePlay || 0;
    const obc = singleCruise.freeOBC || 0;
    const tradeIn = singleCruise.tradeInValue || 0;
    
    const hasDetailedPricing = !!(singleCruise.interiorPrice || singleCruise.oceanviewPrice || singleCruise.balconyPrice || singleCruise.suitePrice || singleCruise.juniorSuitePrice || singleCruise.grandSuitePrice);
    
    return {
      totalCabinValue: cabinValueForTwo,
      totalTaxesFees: taxesFees,
      totalFreePlay: freePlay,
      totalOBC: obc,
      tradeInValue: tradeIn,
      aggregateTotalValue: cabinValueForTwo + taxesFees + freePlay + obc,
      cruiseCount: 1,
      cruisesWithDetailedPricing: hasDetailedPricing ? 1 : 0,
      perks: singleCruise.perks || [],
      cruiseBreakdowns: [{
        cruiseId: singleCruise.id,
        shipName: singleCruise.shipName,
        sailDate: singleCruise.sailDate,
        nights: singleCruise.nights || 0,
        cabinValueForTwo,
        taxesFees,
        cruiseRetailValue: cabinValueForTwo + taxesFees,
      }],
    };
  }
  
  let totalCabinValue = 0;
  let totalTaxesFees = 0;
  let cruisesWithDetailedPricing = 0;
  const cruiseBreakdowns: OfferAggregateValue['cruiseBreakdowns'] = [];
  const allPerks = new Set<string>();
  
  matchingCruises.forEach(cruise => {
    const cabinPrice = getCabinPriceFromEntity(cruise, roomType) || cruise.price || 0;
    const cabinValueForTwo = cabinPrice * GUEST_COUNT_DEFAULT;
    const taxesFees = cruise.taxes || 0;
    
    const hasDetailedPricing = !!(cruise.interiorPrice || cruise.oceanviewPrice || cruise.balconyPrice || cruise.suitePrice || cruise.juniorSuitePrice || cruise.grandSuitePrice);
    if (hasDetailedPricing) {
      cruisesWithDetailedPricing++;
    }
    
    totalCabinValue += cabinValueForTwo;
    totalTaxesFees += taxesFees;
    
    cruiseBreakdowns.push({
      cruiseId: cruise.id,
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
      nights: cruise.nights || 0,
      cabinValueForTwo,
      taxesFees,
      cruiseRetailValue: cabinValueForTwo + taxesFees,
    });
    
    if (cruise.perks) {
      cruise.perks.forEach(p => allPerks.add(p));
    }
    if (cruise.freeGratuities) allPerks.add('Gratuities');
    if (cruise.freeDrinkPackage) allPerks.add('Drink Package');
    if (cruise.freeWifi) allPerks.add('WiFi');
    if (cruise.freeSpecialtyDining) allPerks.add('Specialty Dining');
  });
  
  const firstCruise = matchingCruises[0];
  const totalFreePlay = firstCruise.freePlay || 0;
  const totalOBC = firstCruise.freeOBC || 0;
  const tradeInValue = firstCruise.tradeInValue || 0;
  
  const aggregateTotalValue = totalCabinValue + totalTaxesFees + totalFreePlay + totalOBC;
  
  console.log('[ValueCalculator] Offer aggregate value calculated:', {
    offerCode,
    roomType,
    cruiseCount: matchingCruises.length,
    totalCabinValue,
    totalTaxesFees,
    totalFreePlay,
    totalOBC,
    aggregateTotalValue,
  });
  
  return {
    totalCabinValue,
    totalTaxesFees,
    totalFreePlay,
    totalOBC,
    tradeInValue,
    aggregateTotalValue,
    cruiseCount: matchingCruises.length,
    cruisesWithDetailedPricing,
    perks: Array.from(allPerks),
    cruiseBreakdowns,
  };
}

export interface EstimatedCabinPrices {
  interior: number;
  oceanview: number;
  balcony: number;
  suite: number;
  source: 'actual' | 'estimated' | 'mixed';
}

export function getEstimatedCabinPrices(
  entity: Cruise | CasinoOffer | BookedCruise,
  nights?: number
): EstimatedCabinPrices {
  const cruiseNights = nights || (entity as Cruise).nights || 7;
  
  const actualInterior = entity.interiorPrice;
  const actualOceanview = entity.oceanviewPrice;
  const actualBalcony = entity.balconyPrice;
  const actualSuite = entity.suitePrice;
  
  const hasAny = (actualInterior && actualInterior > 0) ||
                 (actualOceanview && actualOceanview > 0) ||
                 (actualBalcony && actualBalcony > 0) ||
                 (actualSuite && actualSuite > 0);
  
  if (hasAny) {
    const knownPrice = actualBalcony || actualOceanview || actualInterior || actualSuite || 0;
    const knownType = actualBalcony ? 'Balcony' 
      : actualOceanview ? 'Oceanview' 
      : actualInterior ? 'Interior' 
      : 'Suite';
    
    return {
      interior: (actualInterior && actualInterior > 0) ? actualInterior : estimateCabinPrice(knownPrice, knownType, 'Interior'),
      oceanview: (actualOceanview && actualOceanview > 0) ? actualOceanview : estimateCabinPrice(knownPrice, knownType, 'Oceanview'),
      balcony: (actualBalcony && actualBalcony > 0) ? actualBalcony : estimateCabinPrice(knownPrice, knownType, 'Balcony'),
      suite: (actualSuite && actualSuite > 0) ? actualSuite : estimateCabinPrice(knownPrice, knownType, 'Junior Suite'),
      source: 'mixed',
    };
  }
  
  return {
    interior: estimateCabinRetailValue('Interior', cruiseNights),
    oceanview: estimateCabinRetailValue('Oceanview', cruiseNights),
    balcony: estimateCabinRetailValue('Balcony', cruiseNights),
    suite: estimateCabinRetailValue('Junior Suite', cruiseNights),
    source: 'estimated',
  };
}

export function formatValueAsText(breakdown: ValueBreakdown): string {
  const lines = [
    `Cabin Retail Value: ${breakdown.totalRetailValue.toLocaleString()}`,
    `Taxes & Fees: $${breakdown.taxesFees.toLocaleString()}`,
  ];
  
  if (breakdown.freePlayValue > 0) {
    lines.push(`FreePlay: $${breakdown.freePlayValue.toLocaleString()}`);
  }
  if (breakdown.obcValue > 0) {
    lines.push(`OBC: $${breakdown.obcValue.toLocaleString()}`);
  }
  if (breakdown.tradeInValue > 0) {
    lines.push(`Trade-In: $${breakdown.tradeInValue.toLocaleString()}`);
  }
  
  lines.push(`─────────────────`);
  lines.push(`Total Retail Value: $${breakdown.totalRetailValue.toLocaleString()}`);
  lines.push(`Amount Paid: $${breakdown.amountPaid.toLocaleString()}`);
  lines.push(`Net Value: $${breakdown.netValue.toLocaleString()}`);
  lines.push(`Coverage: ${(breakdown.coverageFraction * 100).toFixed(0)}%`);
  
  if (breakdown.isFullyComped) {
    lines.push(`✓ FULLY COMPED`);
  }
  if (breakdown.is2Person) {
    lines.push(`✓ 2-Person Offer`);
  }
  
  return lines.join('\n');
}
