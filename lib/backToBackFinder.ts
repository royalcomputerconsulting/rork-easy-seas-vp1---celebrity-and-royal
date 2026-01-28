import type { Cruise } from '@/types/models';
import { createDateFromString, isDateInPast } from '@/lib/date';

export interface BackToBackSet {
  id: string;
  cruises: Cruise[];
  totalNights: number;
  departurePort: string;
  offerCodes: string[];
  offerNames: string[];
  startDate: string;
  endDate: string;
  gapDays: number[];
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
  
  // If either port is missing, be permissive
  if (!p1 || !p2) return true;
  
  if (p1 === p2) return true;
  if (p1.includes('miami') && p2.includes('miami')) return true;
  if (p1.includes('fortlauderdale') && p2.includes('fortlauderdale')) return true;
  if (p1.includes('ft.lauderdale') && p2.includes('ft.lauderdale')) return true;
  if ((p1.includes('fortlauderdale') || p1.includes('ft.lauderdale')) && 
      (p2.includes('fortlauderdale') || p2.includes('ft.lauderdale'))) return true;
  if (p1.includes('portcanaveral') && p2.includes('portcanaveral')) return true;
  if (p1.includes('canaveral') && p2.includes('canaveral')) return true;
  if (p1.includes('galveston') && p2.includes('galveston')) return true;
  if (p1.includes('seattle') && p2.includes('seattle')) return true;
  if (p1.includes('losangeles') && p2.includes('losangeles')) return true;
  if (p1.includes('sanjuan') && p2.includes('sanjuan')) return true;
  if (p1.includes('tampa') && p2.includes('tampa')) return true;
  if (p1.includes('neworleans') && p2.includes('neworleans')) return true;
  if (p1.includes('bayonne') && p2.includes('bayonne')) return true;
  if (p1.includes('baltimore') && p2.includes('baltimore')) return true;
  if (p1.includes('orlando') && p2.includes('orlando')) return true;
  if (p1.includes('cozumel') && p2.includes('cozumel')) return true;
  if (p1.includes('nassau') && p2.includes('nassau')) return true;
  if (p1.includes('barcelona') && p2.includes('barcelona')) return true;
  if (p1.includes('rome') && p2.includes('rome')) return true;
  if (p1.includes('civitavecchia') && p2.includes('civitavecchia')) return true;
  if (p1.includes('southampton') && p2.includes('southampton')) return true;
  if (p1.includes('singapore') && p2.includes('singapore')) return true;
  if (p1.includes('sydney') && p2.includes('sydney')) return true;
  
  return false;
}

function getDaysDifference(date1: string, date2: string): number {
  const d1 = createDateFromString(date1);
  const d2 = createDateFromString(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function isConsecutive(cruise1: Cruise, cruise2: Cruise, maxGap: number = 2): boolean {
  const daysDiff = getDaysDifference(cruise1.returnDate, cruise2.sailDate);
  return daysDiff >= 0 && daysDiff <= maxGap;
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
    minChainLength?: number;
  } = {}
): BackToBackSet[] {
  const {
    maxGapDays = 2,
    requireDifferentOffers = false,
    excludeConflicts = true,
    minChainLength = 2,
  } = options;

  console.log('[B2B Finder] Starting search with', cruises.length, 'cruises');
  console.log('[B2B Finder] Options:', { maxGapDays, requireDifferentOffers, excludeConflicts, minChainLength });

  // Filter to future cruises with valid dates
  const validCruises = cruises.filter(cruise => {
    if (!cruise.sailDate || !cruise.returnDate) {
      console.log('[B2B Finder] Skipping cruise without dates:', cruise.id);
      return false;
    }
    
    // Skip past cruises
    if (isDateInPast(cruise.sailDate)) {
      return false;
    }
    
    // Check for conflicts with booked dates
    if (excludeConflicts && bookedDates.size > 0) {
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

  console.log('[B2B Finder] Valid future cruises after filtering:', validCruises.length);
  console.log('[B2B Finder] Booked dates count:', bookedDates.size);
  
  if (validCruises.length === 0) {
    console.log('[B2B Finder] No valid cruises to search');
    return [];
  }

  // Log sample cruise data for debugging
  const sample = validCruises.slice(0, 5);
  console.log('[B2B Finder] Sample cruise data:', sample.map(c => ({
    id: c.id,
    ship: c.shipName,
    sailDate: c.sailDate,
    returnDate: c.returnDate,
    nights: c.nights,
    departurePort: c.departurePort,
    offerCode: c.offerCode,
  })));

  // Sort by sail date
  const sortedCruises = [...validCruises].sort((a, b) => 
    createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime()
  );

  // Build adjacency list - which cruises can follow which
  const adjacencyMap = new Map<string, { cruise: Cruise; gapDays: number }[]>();
  
  for (const cruise of sortedCruises) {
    const followers: { cruise: Cruise; gapDays: number }[] = [];
    
    for (const candidate of sortedCruises) {
      if (cruise.id === candidate.id) continue;
      
      const daysDiff = getDaysDifference(cruise.returnDate, candidate.sailDate);
      
      // Must be consecutive (0-2 day gap by default)
      if (daysDiff < 0 || daysDiff > maxGapDays) continue;
      
      // Must be same departure port (be permissive - if no port, allow it)
      const samePort = areSamePort(cruise.departurePort, candidate.departurePort);
      if (!samePort) continue;
      
      // Check for different offers if required
      if (requireDifferentOffers && !hasDifferentOfferCodes(cruise, candidate)) continue;
      
      followers.push({ cruise: candidate, gapDays: daysDiff });
    }
    
    if (followers.length > 0) {
      adjacencyMap.set(cruise.id, followers);
    }
  }

  console.log('[B2B Finder] Cruises with potential followers:', adjacencyMap.size);

  // Find all chains using DFS
  const allChains: { cruises: Cruise[]; gapDays: number[] }[] = [];
  const visitedInCurrentPath = new Set<string>();

  function findChains(currentCruise: Cruise, currentChain: Cruise[], currentGaps: number[]) {
    currentChain.push(currentCruise);
    visitedInCurrentPath.add(currentCruise.id);
    
    const followers = adjacencyMap.get(currentCruise.id) || [];
    let extended = false;
    
    for (const { cruise: nextCruise, gapDays } of followers) {
      if (visitedInCurrentPath.has(nextCruise.id)) continue;
      
      // Check the chain doesn't conflict with booked dates including the new cruise
      if (excludeConflicts && bookedDates.size > 0) {
        const chainDates = new Set<string>();
        for (const c of currentChain) {
          const sailDate = createDateFromString(c.sailDate);
          const returnDate = createDateFromString(c.returnDate);
          let d = new Date(sailDate);
          while (d <= returnDate) {
            chainDates.add(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 1);
          }
        }
        
        // Check if next cruise overlaps with chain dates
        const nextSail = createDateFromString(nextCruise.sailDate);
        const nextReturn = createDateFromString(nextCruise.returnDate);
        let nd = new Date(nextSail);
        let hasOverlap = false;
        while (nd <= nextReturn) {
          if (chainDates.has(nd.toISOString().split('T')[0])) {
            hasOverlap = true;
            break;
          }
          nd.setDate(nd.getDate() + 1);
        }
        if (hasOverlap) continue;
      }
      
      extended = true;
      findChains(nextCruise, [...currentChain], [...currentGaps, gapDays]);
    }
    
    // If we couldn't extend and chain is long enough, save it
    if (!extended && currentChain.length >= minChainLength) {
      allChains.push({ cruises: [...currentChain], gapDays: [...currentGaps] });
    }
    
    visitedInCurrentPath.delete(currentCruise.id);
  }

  // Start DFS from each cruise
  for (const cruise of sortedCruises) {
    findChains(cruise, [], []);
  }

  console.log('[B2B Finder] Found', allChains.length, 'total chains before deduplication');

  // Remove duplicate/subset chains - keep longest chains
  const uniqueChains = allChains.filter((chain, index) => {
    const chainIds = new Set(chain.cruises.map(c => c.id));
    
    // Check if any other chain is a superset of this one
    for (let i = 0; i < allChains.length; i++) {
      if (i === index) continue;
      const otherIds = allChains[i].cruises.map(c => c.id);
      
      // If other chain is longer and contains all our cruises, skip this chain
      if (otherIds.length > chain.cruises.length) {
        const isSubset = chain.cruises.every(c => otherIds.includes(c.id));
        if (isSubset) return false;
      }
    }
    return true;
  });

  console.log('[B2B Finder] Unique chains after deduplication:', uniqueChains.length);

  // Convert chains to BackToBackSet format
  const b2bSets: BackToBackSet[] = uniqueChains.map((chain, index) => {
    const setCruises = chain.cruises;
    const setId = `b2b_${setCruises.map(c => c.id).join('_')}`;
    
    const totalNights = setCruises.reduce((sum, c) => sum + (c.nights || 0), 0);
    const offerCodes = [...new Set(setCruises
      .map(c => c.offerCode)
      .filter((code): code is string => !!code))];
    const offerNames = [...new Set(setCruises
      .map(c => c.offerName)
      .filter((name): name is string => !!name))];

    const firstCruise = setCruises[0];
    const lastCruise = setCruises[setCruises.length - 1];

    console.log(`[B2B Finder] Set ${index + 1}: ${setCruises.length} cruises, ${totalNights} nights, ${firstCruise.sailDate} to ${lastCruise.returnDate}`);
    setCruises.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.shipName} ${c.sailDate}-${c.returnDate} (${c.nights}N) ${c.departurePort || 'Unknown port'} - ${c.offerCode || 'No offer'}`);
    });

    return {
      id: setId,
      cruises: setCruises,
      totalNights,
      departurePort: firstCruise.departurePort || 'Unknown',
      offerCodes,
      offerNames,
      startDate: firstCruise.sailDate,
      endDate: lastCruise.returnDate,
      gapDays: chain.gapDays,
    };
  });

  console.log('[B2B Finder] Final result:', b2bSets.length, 'back-to-back sets');

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
