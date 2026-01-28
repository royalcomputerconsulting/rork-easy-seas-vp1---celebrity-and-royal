import type { Cruise } from '@/types/models';
import { createDateFromString, isDateInPast } from '@/lib/date';

export interface SailingSlot {
  key: string;
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  departurePort: string;
  offers: CruiseOffer[];
}

export interface CruiseOffer {
  cruiseId: string;
  offerCode: string;
  offerName: string;
  cabinType: string;
  guests: number;
  guestsInfo: string;
  price?: number;
  freePlay?: number;
  cruise: Cruise;
}

export interface BackToBackSet {
  id: string;
  cruises: Cruise[];
  slots: SailingSlot[];
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

function normalizeShipName(name: string | undefined): string {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/of the seas/gi, '')
    .replace(/of the/gi, '')
    .trim();
}

function groupCruisesIntoSlots(cruises: Cruise[]): SailingSlot[] {
  const slotMap = new Map<string, SailingSlot>();
  
  for (const cruise of cruises) {
    if (!cruise.shipName || !cruise.sailDate) continue;
    
    const normalizedShip = normalizeShipName(cruise.shipName);
    const key = `${normalizedShip}_${cruise.sailDate}`;
    
    const offer: CruiseOffer = {
      cruiseId: cruise.id,
      offerCode: cruise.offerCode || '',
      offerName: cruise.offerName || '',
      cabinType: cruise.cabinType || '',
      guests: cruise.guests || 1,
      guestsInfo: cruise.guestsInfo || `${cruise.guests || 1} Guest${(cruise.guests || 1) > 1 ? 's' : ''}`,
      price: cruise.price,
      freePlay: cruise.freePlay,
      cruise,
    };
    
    if (slotMap.has(key)) {
      const existing = slotMap.get(key)!;
      const isDuplicate = existing.offers.some(o => 
        o.offerCode === offer.offerCode && 
        o.cabinType === offer.cabinType && 
        o.guests === offer.guests
      );
      if (!isDuplicate) {
        existing.offers.push(offer);
      }
    } else {
      slotMap.set(key, {
        key,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        returnDate: cruise.returnDate,
        nights: cruise.nights || 0,
        departurePort: cruise.departurePort || '',
        offers: [offer],
      });
    }
  }
  
  return Array.from(slotMap.values());
}

function slotConflictsWithBookedDates(slot: SailingSlot, bookedDates: Set<string>): boolean {
  if (bookedDates.size === 0) return false;
  
  const sailDate = createDateFromString(slot.sailDate);
  const returnDate = createDateFromString(slot.returnDate);
  let currentDate = new Date(sailDate);
  
  while (currentDate <= returnDate) {
    if (bookedDates.has(currentDate.toISOString().split('T')[0])) {
      return true;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return false;
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
    maxGapDays = 1,
    excludeConflicts = true,
    minChainLength = 2,
  } = options;

  console.log('[B2B Finder] Starting search with', cruises.length, 'cruise records');
  console.log('[B2B Finder] Options:', { maxGapDays, excludeConflicts, minChainLength });
  console.log('[B2B Finder] Booked dates count:', bookedDates.size);

  const validCruises = cruises.filter(cruise => {
    if (!cruise.sailDate || !cruise.returnDate) return false;
    if (isDateInPast(cruise.sailDate)) return false;
    return true;
  });

  console.log('[B2B Finder] Valid future cruises:', validCruises.length);

  const allSlots = groupCruisesIntoSlots(validCruises);
  console.log('[B2B Finder] Unique sailing slots (ship+date combinations):', allSlots.length);

  const availableSlots = excludeConflicts 
    ? allSlots.filter(slot => !slotConflictsWithBookedDates(slot, bookedDates))
    : allSlots;

  console.log('[B2B Finder] Available slots after conflict check:', availableSlots.length);

  if (availableSlots.length < 2) {
    console.log('[B2B Finder] Not enough slots to form back-to-back sets');
    return [];
  }

  const sortedSlots = [...availableSlots].sort((a, b) => 
    createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime()
  );

  console.log('[B2B Finder] Sample slots:', sortedSlots.slice(0, 10).map(s => ({
    ship: s.shipName,
    sailDate: s.sailDate,
    returnDate: s.returnDate,
    nights: s.nights,
    port: s.departurePort,
    offerCount: s.offers.length,
    offerCodes: s.offers.map(o => o.offerCode).filter(Boolean).join(', '),
  })));

  const adjacencyMap = new Map<string, { slot: SailingSlot; gapDays: number }[]>();
  
  for (const slot of sortedSlots) {
    const followers: { slot: SailingSlot; gapDays: number }[] = [];
    
    for (const candidate of sortedSlots) {
      if (slot.key === candidate.key) continue;
      
      const daysDiff = getDaysDifference(slot.returnDate, candidate.sailDate);
      
      if (daysDiff < 0 || daysDiff > maxGapDays) continue;
      
      const sameShip = normalizeShipName(slot.shipName) === normalizeShipName(candidate.shipName);
      if (!sameShip) continue;
      
      const samePort = areSamePort(slot.departurePort, candidate.departurePort);
      if (!samePort) continue;
      
      followers.push({ slot: candidate, gapDays: daysDiff });
    }
    
    if (followers.length > 0) {
      adjacencyMap.set(slot.key, followers);
      console.log(`[B2B Finder] Slot ${slot.shipName} ${slot.sailDate} can chain to ${followers.length} following slots`);
    }
  }

  console.log('[B2B Finder] Slots with potential followers:', adjacencyMap.size);

  const allChains: { slots: SailingSlot[]; gapDays: number[] }[] = [];
  const visitedInCurrentPath = new Set<string>();

  function findChains(currentSlot: SailingSlot, currentChain: SailingSlot[], currentGaps: number[]) {
    currentChain.push(currentSlot);
    visitedInCurrentPath.add(currentSlot.key);
    
    const followers = adjacencyMap.get(currentSlot.key) || [];
    let extended = false;
    
    for (const { slot: nextSlot, gapDays } of followers) {
      if (visitedInCurrentPath.has(nextSlot.key)) continue;
      
      extended = true;
      findChains(nextSlot, [...currentChain], [...currentGaps, gapDays]);
    }
    
    if (currentChain.length >= minChainLength) {
      allChains.push({ slots: [...currentChain], gapDays: [...currentGaps] });
    }
    
    visitedInCurrentPath.delete(currentSlot.key);
  }

  for (const slot of sortedSlots) {
    findChains(slot, [], []);
  }

  console.log('[B2B Finder] Found', allChains.length, 'total chains before deduplication');

  const uniqueChains = allChains.filter((chain, index) => {
    const chainKeys = chain.slots.map(s => s.key).join('|');
    
    for (let i = 0; i < allChains.length; i++) {
      if (i === index) continue;
      const otherKeys = allChains[i].slots.map(s => s.key).join('|');
      
      if (otherKeys.length > chainKeys.length && otherKeys.includes(chainKeys)) {
        return false;
      }
    }
    return true;
  });

  const longestChains = uniqueChains.filter((chain, index) => {
    const chainKeys = new Set(chain.slots.map(s => s.key));
    
    for (let i = 0; i < uniqueChains.length; i++) {
      if (i === index) continue;
      const otherChain = uniqueChains[i];
      
      if (otherChain.slots.length > chain.slots.length) {
        const isSubset = chain.slots.every(s => 
          otherChain.slots.some(os => os.key === s.key)
        );
        if (isSubset) return false;
      }
    }
    return true;
  });

  console.log('[B2B Finder] Unique chains after deduplication:', longestChains.length);

  const b2bSets: BackToBackSet[] = longestChains.map((chain, index) => {
    const setSlots = chain.slots;
    const setId = `b2b_${index}_${setSlots[0].sailDate}`;
    
    const totalNights = setSlots.reduce((sum, s) => sum + (s.nights || 0), 0);
    
    const allOfferCodes: string[] = [];
    const allOfferNames: string[] = [];
    setSlots.forEach(slot => {
      slot.offers.forEach(offer => {
        if (offer.offerCode && !allOfferCodes.includes(offer.offerCode)) {
          allOfferCodes.push(offer.offerCode);
        }
        if (offer.offerName && !allOfferNames.includes(offer.offerName)) {
          allOfferNames.push(offer.offerName);
        }
      });
    });

    const representativeCruises = setSlots.map(slot => slot.offers[0].cruise);
    
    const firstSlot = setSlots[0];
    const lastSlot = setSlots[setSlots.length - 1];

    console.log(`[B2B Finder] Set ${index + 1}: ${setSlots.length} sailings, ${totalNights} nights, ${firstSlot.sailDate} to ${lastSlot.returnDate}`);
    setSlots.forEach((slot, i) => {
      console.log(`  ${i + 1}. ${slot.shipName} ${slot.sailDate}-${slot.returnDate} (${slot.nights}N) - ${slot.offers.length} offer options`);
      slot.offers.forEach(o => {
        console.log(`     - ${o.offerCode || 'No code'} | ${o.cabinType} | ${o.guestsInfo}`);
      });
    });

    return {
      id: setId,
      cruises: representativeCruises,
      slots: setSlots,
      totalNights,
      departurePort: firstSlot.departurePort || 'Unknown',
      offerCodes: allOfferCodes,
      offerNames: allOfferNames,
      startDate: firstSlot.sailDate,
      endDate: lastSlot.returnDate,
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
