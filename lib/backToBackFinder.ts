import type { Cruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';

export interface BackToBackSet {
  id: string;
  cruises: Cruise[];
  totalNights: number;
  departurePort: string;
  offerCodes: string[];
  offerNames: string[];
  startDate: string;
  endDate: string;
}

export interface BackToBackCruiseDisplay extends Cruise {
  isPartOfB2B: boolean;
  b2bSetId: string;
  b2bPosition: number;
  b2bTotalInSet: number;
  b2bPartnerCruises: Cruise[];
}

function normalizePort(port: string | undefined): string {
  if (!port) return '';
  return port.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '')
    .replace(/florida/gi, 'fl')
    .replace(/texas/gi, 'tx')
    .replace(/puerto rico/gi, 'pr');
}

function areSamePort(port1: string | undefined, port2: string | undefined): boolean {
  const p1 = normalizePort(port1);
  const p2 = normalizePort(port2);
  if (!p1 || !p2) return false;
  
  if (p1 === p2) return true;
  if (p1.includes('miami') && p2.includes('miami')) return true;
  if (p1.includes('fortlauderdale') && p2.includes('fortlauderdale')) return true;
  if (p1.includes('portcanaveral') && p2.includes('portcanaveral')) return true;
  if (p1.includes('galveston') && p2.includes('galveston')) return true;
  if (p1.includes('seattle') && p2.includes('seattle')) return true;
  if (p1.includes('losangeles') && p2.includes('losangeles')) return true;
  if (p1.includes('sanjuan') && p2.includes('sanjuan')) return true;
  if (p1.includes('tampa') && p2.includes('tampa')) return true;
  if (p1.includes('neworleans') && p2.includes('neworleans')) return true;
  if (p1.includes('bayonne') && p2.includes('bayonne')) return true;
  if (p1.includes('baltimore') && p2.includes('baltimore')) return true;
  
  return false;
}

function getDaysDifference(date1: string, date2: string): number {
  const d1 = createDateFromString(date1);
  const d2 = createDateFromString(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function isConsecutive(cruise1: Cruise, cruise2: Cruise): boolean {
  const daysDiff = getDaysDifference(cruise1.returnDate, cruise2.sailDate);
  return daysDiff >= 0 && daysDiff <= 1;
}

function hasDifferentOfferCodes(cruise1: Cruise, cruise2: Cruise): boolean {
  const code1 = cruise1.offerCode?.trim().toUpperCase() || '';
  const code2 = cruise2.offerCode?.trim().toUpperCase() || '';
  
  if (!code1 || !code2) return true;
  
  return code1 !== code2;
}

export function findBackToBackSets(
  cruises: Cruise[],
  bookedDates: Set<string>,
  options: {
    maxGapDays?: number;
    requireDifferentOffers?: boolean;
    excludeConflicts?: boolean;
  } = {}
): BackToBackSet[] {
  const {
    maxGapDays = 1,
    requireDifferentOffers = true,
    excludeConflicts = true,
  } = options;

  console.log('[B2B Finder] Starting search with', cruises.length, 'cruises');

  const validCruises = cruises.filter(cruise => {
    if (!cruise.sailDate || !cruise.returnDate) return false;
    if (!cruise.departurePort) return false;
    
    if (excludeConflicts) {
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate);
      let currentDate = new Date(sailDate);
      while (currentDate <= returnDate) {
        if (bookedDates.has(currentDate.toISOString().split('T')[0])) {
          return false;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return true;
  });

  console.log('[B2B Finder] Valid cruises after filtering:', validCruises.length);

  const sortedCruises = [...validCruises].sort((a, b) => 
    createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime()
  );

  const b2bSets: BackToBackSet[] = [];
  const usedCruiseIds = new Set<string>();

  for (let i = 0; i < sortedCruises.length; i++) {
    const firstCruise = sortedCruises[i];
    
    if (usedCruiseIds.has(firstCruise.id)) continue;

    const potentialPartners = sortedCruises.filter((candidate, j) => {
      if (j <= i) return false;
      if (usedCruiseIds.has(candidate.id)) return false;
      
      const daysDiff = getDaysDifference(firstCruise.returnDate, candidate.sailDate);
      if (daysDiff < 0 || daysDiff > maxGapDays) return false;
      
      if (!areSamePort(firstCruise.departurePort, candidate.departurePort)) return false;
      
      if (requireDifferentOffers && !hasDifferentOfferCodes(firstCruise, candidate)) return false;
      
      return true;
    });

    if (potentialPartners.length > 0) {
      for (const partner of potentialPartners) {
        if (usedCruiseIds.has(partner.id)) continue;
        
        const setCruises = [firstCruise, partner];
        const setId = `b2b_${firstCruise.id}_${partner.id}`;
        
        const totalNights = setCruises.reduce((sum, c) => sum + (c.nights || 0), 0);
        const offerCodes = setCruises
          .map(c => c.offerCode)
          .filter((code): code is string => !!code);
        const offerNames = setCruises
          .map(c => c.offerName)
          .filter((name): name is string => !!name);

        b2bSets.push({
          id: setId,
          cruises: setCruises,
          totalNights,
          departurePort: firstCruise.departurePort || 'Unknown',
          offerCodes,
          offerNames,
          startDate: firstCruise.sailDate,
          endDate: partner.returnDate,
        });

        usedCruiseIds.add(firstCruise.id);
        usedCruiseIds.add(partner.id);
        break;
      }
    }
  }

  console.log('[B2B Finder] Found', b2bSets.length, 'back-to-back sets');

  return b2bSets.sort((a, b) => 
    createDateFromString(a.startDate).getTime() - createDateFromString(b.startDate).getTime()
  );
}

export function convertSetsToDisplayCruises(sets: BackToBackSet[]): BackToBackCruiseDisplay[] {
  const displayCruises: BackToBackCruiseDisplay[] = [];

  for (const set of sets) {
    set.cruises.forEach((cruise, index) => {
      displayCruises.push({
        ...cruise,
        isPartOfB2B: true,
        b2bSetId: set.id,
        b2bPosition: index + 1,
        b2bTotalInSet: set.cruises.length,
        b2bPartnerCruises: set.cruises.filter(c => c.id !== cruise.id),
      });
    });
  }

  return displayCruises;
}

export function formatB2BSetSummary(set: BackToBackSet): string {
  const ships = [...new Set(set.cruises.map(c => c.shipName))].join(' → ');
  const dates = `${set.startDate} to ${set.endDate}`;
  return `${ships} | ${set.totalNights} nights | ${dates}`;
}
