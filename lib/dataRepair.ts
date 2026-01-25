import { 
  normalizeCruiseData, 
  normalizeDate,
} from './dataNormalizers';
import { 
  validateCruise, 
  validateBookedCruise, 
  validateOffer,
  ValidationIssue,
} from './dataValidators';
import { createDateFromString } from './date';
import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';

export interface RepairAction {
  field: string;
  originalValue: unknown;
  repairedValue: unknown;
  repairType: 'normalize' | 'calculate' | 'default' | 'remove';
  description: string;
}

export interface RepairResult<T> {
  original: T;
  repaired: T;
  actions: RepairAction[];
  remainingIssues: ValidationIssue[];
  fullyRepaired: boolean;
}

export interface BatchRepairResult<T> {
  items: RepairResult<T>[];
  totalActions: number;
  fullyRepairedCount: number;
  partiallyRepairedCount: number;
  unrepairedCount: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function repairCruise(cruise: Cruise): RepairResult<Cruise> {
  const actions: RepairAction[] = [];
  const repaired = { ...cruise };

  if (!repaired.id) {
    const newId = generateId();
    actions.push({
      field: 'id',
      originalValue: repaired.id,
      repairedValue: newId,
      repairType: 'default',
      description: 'Generated missing ID',
    });
    repaired.id = newId;
  }

  const { normalized, report } = normalizeCruiseData(repaired);
  Object.assign(repaired, normalized);
  
  if (report.normalizedFields > 0) {
    report.issues.forEach(issue => {
      if (!issue.issue.includes('Empty')) {
        actions.push({
          field: issue.field,
          originalValue: cruise[issue.field as keyof Cruise],
          repairedValue: repaired[issue.field as keyof Cruise],
          repairType: 'normalize',
          description: `Normalized ${issue.field}`,
        });
      }
    });
  }

  if (repaired.sailDate && repaired.nights && !repaired.returnDate) {
    const sailDate = createDateFromString(repaired.sailDate);
    const returnDate = new Date(sailDate);
    returnDate.setDate(returnDate.getDate() + repaired.nights);
    const returnDateStr = returnDate.toISOString().split('T')[0];
    
    actions.push({
      field: 'returnDate',
      originalValue: repaired.returnDate,
      repairedValue: returnDateStr,
      repairType: 'calculate',
      description: 'Calculated return date from sail date and nights',
    });
    repaired.returnDate = returnDateStr;
  }

  if (repaired.sailDate && repaired.returnDate && !repaired.nights) {
    const sailDate = createDateFromString(repaired.sailDate);
    const returnDate = createDateFromString(repaired.returnDate);
    const nights = Math.round((returnDate.getTime() - sailDate.getTime()) / (1000 * 60 * 60 * 24));
    
    actions.push({
      field: 'nights',
      originalValue: repaired.nights,
      repairedValue: nights,
      repairType: 'calculate',
      description: 'Calculated nights from date range',
    });
    repaired.nights = nights;
  }

  if (repaired.sailDate && repaired.returnDate && repaired.nights) {
    const sailDate = createDateFromString(repaired.sailDate);
    const returnDate = createDateFromString(repaired.returnDate);
    const calculatedNights = Math.round((returnDate.getTime() - sailDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (Math.abs(calculatedNights - repaired.nights) > 1) {
      actions.push({
        field: 'nights',
        originalValue: repaired.nights,
        repairedValue: calculatedNights,
        repairType: 'calculate',
        description: `Fixed nights mismatch (was ${repaired.nights}, calculated ${calculatedNights})`,
      });
      repaired.nights = calculatedNights;
    }
  }

  if (repaired.price && repaired.nights && !repaired.pricePerNight) {
    const pricePerNight = Math.round((repaired.price / repaired.nights) * 100) / 100;
    actions.push({
      field: 'pricePerNight',
      originalValue: repaired.pricePerNight,
      repairedValue: pricePerNight,
      repairType: 'calculate',
      description: 'Calculated price per night',
    });
    repaired.pricePerNight = pricePerNight;
  }

  const validation = validateCruise(repaired);
  
  return {
    original: cruise,
    repaired,
    actions,
    remainingIssues: validation.issues,
    fullyRepaired: validation.isValid,
  };
}

export function repairBookedCruise(cruise: BookedCruise): RepairResult<BookedCruise> {
  const baseRepair = repairCruise(cruise as Cruise);
  const actions = [...baseRepair.actions];
  const repaired = { ...baseRepair.repaired } as BookedCruise;

  if (!repaired.bookingId && repaired.id) {
    actions.push({
      field: 'bookingId',
      originalValue: repaired.bookingId,
      repairedValue: repaired.id,
      repairType: 'default',
      description: 'Used cruise ID as booking ID',
    });
    repaired.bookingId = repaired.id;
  }

  if (repaired.totalPrice !== undefined && repaired.totalPrice < 0) {
    actions.push({
      field: 'totalPrice',
      originalValue: repaired.totalPrice,
      repairedValue: Math.abs(repaired.totalPrice),
      repairType: 'normalize',
      description: 'Fixed negative total price',
    });
    repaired.totalPrice = Math.abs(repaired.totalPrice);
  }

  if (repaired.earnedPoints !== undefined && repaired.earnedPoints < 0) {
    actions.push({
      field: 'earnedPoints',
      originalValue: repaired.earnedPoints,
      repairedValue: 0,
      repairType: 'normalize',
      description: 'Fixed negative earned points',
    });
    repaired.earnedPoints = 0;
  }

  if (repaired.sailDate) {
    const sailDate = createDateFromString(repaired.sailDate);
    const now = new Date();
    
    if (sailDate < now && repaired.completionState === 'upcoming') {
      actions.push({
        field: 'completionState',
        originalValue: repaired.completionState,
        repairedValue: 'completed',
        repairType: 'calculate',
        description: 'Updated completion state for past cruise',
      });
      repaired.completionState = 'completed';
    }
    
    if (sailDate < now && repaired.status === 'available') {
      actions.push({
        field: 'status',
        originalValue: repaired.status,
        repairedValue: 'completed',
        repairType: 'calculate',
        description: 'Updated status for past cruise',
      });
      repaired.status = 'completed';
    }
  }

  const validation = validateBookedCruise(repaired);
  
  return {
    original: cruise,
    repaired,
    actions,
    remainingIssues: validation.issues,
    fullyRepaired: validation.isValid,
  };
}

export function repairOffer(offer: CasinoOffer): RepairResult<CasinoOffer> {
  const actions: RepairAction[] = [];
  const repaired = { ...offer };

  if (!repaired.id && !repaired.offerCode) {
    const newId = generateId();
    actions.push({
      field: 'id',
      originalValue: repaired.id,
      repairedValue: newId,
      repairType: 'default',
      description: 'Generated missing ID',
    });
    repaired.id = newId;
  } else if (!repaired.id && repaired.offerCode) {
    actions.push({
      field: 'id',
      originalValue: repaired.id,
      repairedValue: repaired.offerCode,
      repairType: 'default',
      description: 'Used offer code as ID',
    });
    repaired.id = repaired.offerCode;
  }

  if (repaired.expiryDate) {
    const normalizedDate = normalizeDate(repaired.expiryDate);
    if (normalizedDate.wasNormalized) {
      actions.push({
        field: 'expiryDate',
        originalValue: repaired.expiryDate,
        repairedValue: normalizedDate.value,
        repairType: 'normalize',
        description: 'Normalized expiry date format',
      });
      repaired.expiryDate = normalizedDate.value;
    }
  }

  if (repaired.value !== undefined && repaired.value < 0) {
    actions.push({
      field: 'value',
      originalValue: repaired.value,
      repairedValue: Math.abs(repaired.value),
      repairType: 'normalize',
      description: 'Fixed negative value',
    });
    repaired.value = Math.abs(repaired.value);
  }

  const validation = validateOffer(repaired);
  
  return {
    original: offer,
    repaired,
    actions,
    remainingIssues: validation.issues,
    fullyRepaired: validation.isValid,
  };
}

export function batchRepairCruises(cruises: Cruise[]): BatchRepairResult<Cruise> {
  const results = cruises.map(repairCruise);
  
  return {
    items: results,
    totalActions: results.reduce((sum, r) => sum + r.actions.length, 0),
    fullyRepairedCount: results.filter(r => r.fullyRepaired).length,
    partiallyRepairedCount: results.filter(r => r.actions.length > 0 && !r.fullyRepaired).length,
    unrepairedCount: results.filter(r => r.actions.length === 0 && !r.fullyRepaired).length,
  };
}

export function batchRepairBookedCruises(cruises: BookedCruise[]): BatchRepairResult<BookedCruise> {
  const results = cruises.map(repairBookedCruise);
  
  return {
    items: results,
    totalActions: results.reduce((sum, r) => sum + r.actions.length, 0),
    fullyRepairedCount: results.filter(r => r.fullyRepaired).length,
    partiallyRepairedCount: results.filter(r => r.actions.length > 0 && !r.fullyRepaired).length,
    unrepairedCount: results.filter(r => r.actions.length === 0 && !r.fullyRepaired).length,
  };
}

export function batchRepairOffers(offers: CasinoOffer[]): BatchRepairResult<CasinoOffer> {
  const results = offers.map(repairOffer);
  
  return {
    items: results,
    totalActions: results.reduce((sum, r) => sum + r.actions.length, 0),
    fullyRepairedCount: results.filter(r => r.fullyRepaired).length,
    partiallyRepairedCount: results.filter(r => r.actions.length > 0 && !r.fullyRepaired).length,
    unrepairedCount: results.filter(r => r.actions.length === 0 && !r.fullyRepaired).length,
  };
}

export interface DataRepairSummary {
  cruises: BatchRepairResult<Cruise>;
  bookedCruises: BatchRepairResult<BookedCruise>;
  offers: BatchRepairResult<CasinoOffer>;
  totalRecords: number;
  totalActions: number;
  successRate: number;
}

export function repairAllData(
  cruises: Cruise[],
  bookedCruises: BookedCruise[],
  offers: CasinoOffer[]
): DataRepairSummary {
  const cruiseResults = batchRepairCruises(cruises);
  const bookedResults = batchRepairBookedCruises(bookedCruises);
  const offerResults = batchRepairOffers(offers);

  const totalRecords = cruises.length + bookedCruises.length + offers.length;
  const totalActions = cruiseResults.totalActions + bookedResults.totalActions + offerResults.totalActions;
  const fullyRepaired = cruiseResults.fullyRepairedCount + bookedResults.fullyRepairedCount + offerResults.fullyRepairedCount;
  const successRate = totalRecords > 0 ? (fullyRepaired / totalRecords) * 100 : 100;

  return {
    cruises: cruiseResults,
    bookedCruises: bookedResults,
    offers: offerResults,
    totalRecords,
    totalActions,
    successRate: Math.round(successRate),
  };
}

export function getRepairedData(summary: DataRepairSummary): {
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  offers: CasinoOffer[];
} {
  return {
    cruises: summary.cruises.items.map(r => r.repaired),
    bookedCruises: summary.bookedCruises.items.map(r => r.repaired),
    offers: summary.offers.items.map(r => r.repaired),
  };
}
