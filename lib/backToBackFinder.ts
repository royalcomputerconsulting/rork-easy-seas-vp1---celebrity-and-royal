import type { Cruise, CasinoOffer } from '@/types/models';
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

function getDaysDifference(date1: string | undefined, date2: string | undefined): number {
  if (!date1 || !date2) return 999;
  try {
    const d1 = createDateFromString(date1);
    const d2 = createDateFromString(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function isValidDateString(dateStr: string): boolean {
  if (!dateStr || dateStr.includes('NaN') || dateStr.includes('undefined') || dateStr.includes('null')) return false;
  const d = createDateFromString(dateStr);
  return !isNaN(d.getTime());
}

function calculateReturnDate(sailDate: string, nights: number): string {
  try {
    if (!sailDate || isNaN(nights) || nights <= 0) return sailDate;
    const sail = createDateFromString(sailDate);
    if (isNaN(sail.getTime())) return sailDate;
    sail.setDate(sail.getDate() + nights);
    if (isNaN(sail.getTime())) return sailDate;
    const month = String(sail.getMonth() + 1).padStart(2, '0');
    const day = String(sail.getDate()).padStart(2, '0');
    const year = String(sail.getFullYear());
    return `${month}-${day}-${year}`;
  } catch {
    return sailDate;
  }
}

function normalizeShipName(name: string | undefined): string {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/of the seas/gi, '')
    .replace(/of the/gi, '')
    .trim();
}

function isMGMGoldOffer(offerName: string | undefined, offerCode: string | undefined): boolean {
  const lowerName = (offerName || '').toLowerCase();
  const lowerCode = (offerCode || '').toLowerCase();
  
  // Check offer name for MGM Gold variations
  if (lowerName.includes('mgm') && lowerName.includes('gold')) return true;
  if (lowerName.includes('gold%')) return true;
  if (lowerName.includes('gold ')) return true;
  
  // Check offer code for any GOLD% pattern (e.g., "25GOLD%", "50GOLD%", "GOLD25%")
  // Match any code containing "gold" with a percent sign or number
  if (lowerCode.includes('gold')) return true;
  
  return false;
}

function groupCruisesIntoSlots(cruises: Cruise[]): SailingSlot[] {
  const slotMap = new Map<string, SailingSlot>();
  
  for (const cruise of cruises) {
    if (!cruise.shipName || !cruise.sailDate) continue;
    
    // Skip MGM Gold% offers entirely
    if (isMGMGoldOffer(cruise.offerName, cruise.offerCode)) {
      console.log('[B2B Finder] Skipping MGM Gold offer:', cruise.offerCode, cruise.offerName, 'for', cruise.shipName, cruise.sailDate);
      continue;
    }
    
    const normalizedShip = normalizeShipName(cruise.shipName);
    const key = `${normalizedShip}_${cruise.sailDate}`;
    
    const nights = cruise.nights || 7;
    let returnDate = cruise.returnDate;
    if (!returnDate || !isValidDateString(returnDate)) {
      returnDate = calculateReturnDate(cruise.sailDate, nights);
    }
    
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
        returnDate: returnDate,
        nights: nights,
        departurePort: cruise.departurePort || '',
        offers: [offer],
      });
    }
  }
  
  return Array.from(slotMap.values());
}

function slotConflictsWithBookedDates(slot: SailingSlot, bookedDates: Set<string>): boolean {
  if (bookedDates.size === 0) return false;
  
  try {
    const sailDate = createDateFromString(slot.sailDate);
    const returnDateStr = slot.returnDate || calculateReturnDate(slot.sailDate, slot.nights || 7);
    const returnDate = createDateFromString(returnDateStr);
    let currentDate = new Date(sailDate);
    
    while (currentDate <= returnDate) {
      if (bookedDates.has(currentDate.toISOString().split('T')[0])) {
        return true;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (e) {
    console.log('[B2B Finder] Error checking conflicts for slot:', slot.key, e);
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
    bookedCruises?: Cruise[];
    minDaysBetweenBatches?: number;
    casinoOffers?: CasinoOffer[];
  } = {}
): BackToBackSet[] {
  const {
    maxGapDays = 2,
    requireDifferentOffers = false,
    excludeConflicts = true,
    minChainLength = 2,
    bookedCruises = [],
    minDaysBetweenBatches = 3,
    casinoOffers = [],
  } = options;

  console.log('[B2B Finder] Starting search with', cruises.length, 'cruise records');
  console.log('[B2B Finder] Options:', { maxGapDays, excludeConflicts, minChainLength });
  console.log('[B2B Finder] Booked dates count:', bookedDates.size);
  console.log('[B2B Finder] Booked cruises count:', bookedCruises.length);
  console.log('[B2B Finder] Casino offers count:', casinoOffers.length);

  const offerStatusMap = new Map<string, string>();
  casinoOffers.forEach(offer => {
    if (offer.offerCode && offer.status) {
      offerStatusMap.set(offer.offerCode, offer.status);
    }
  });
  console.log('[B2B Finder] Offer status map size:', offerStatusMap.size);

  const validCruises = cruises.filter(cruise => {
    if (!cruise.sailDate) return false;
    if (isDateInPast(cruise.sailDate)) return false;
    
    if (cruise.offerCode) {
      const offerStatus = offerStatusMap.get(cruise.offerCode);
      if (offerStatus === 'booked') {
        console.log('[B2B Finder] Excluding cruise with in-progress offer:', cruise.offerCode, cruise.shipName, cruise.sailDate);
        return false;
      }
    }
    
    return true;
  });

  console.log('[B2B Finder] Valid future cruises:', validCruises.length);

  const validBookedCruises = bookedCruises.filter(cruise => {
    if (!cruise.sailDate) return false;
    if (isDateInPast(cruise.returnDate || cruise.sailDate)) return false;
    return true;
  });

  console.log('[B2B Finder] Valid future booked cruises:', validBookedCruises.length);

  const combinedCruises = [...validCruises, ...validBookedCruises];
  console.log('[B2B Finder] Combined total (available + booked):', combinedCruises.length);

  const allSlots = groupCruisesIntoSlots(combinedCruises);
  console.log('[B2B Finder] Unique sailing slots (ship+date combinations):', allSlots.length);

  const bookedSlotKeys = new Set(
    validBookedCruises
      .filter(c => c.shipName && c.sailDate)
      .map(c => `${normalizeShipName(c.shipName)}_${c.sailDate}`)
  );
  console.log('[B2B Finder] Booked slot keys:', Array.from(bookedSlotKeys));

  const availableSlots = allSlots;

  console.log('[B2B Finder] Total slots for matching:', availableSlots.length);

  if (availableSlots.length < 2) {
    console.log('[B2B Finder] Not enough slots to form back-to-back sets');
    console.log('[B2B Finder] Need at least 2 slots but only have', availableSlots.length);
    return [];
  }
  
  // Log sample of filtered cruises to understand what's being excluded
  const mgmGoldCount = validCruises.filter(c => isMGMGoldOffer(c.offerName, c.offerCode)).length;
  console.log('[B2B Finder] MGM Gold offers filtered out:', mgmGoldCount, 'out of', validCruises.length, 'valid cruises');

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

  const shipGroups = new Map<string, SailingSlot[]>();
  for (const slot of sortedSlots) {
    const shipKey = normalizeShipName(slot.shipName);
    if (!shipGroups.has(shipKey)) {
      shipGroups.set(shipKey, []);
    }
    shipGroups.get(shipKey)!.push(slot);
  }

  console.log('[B2B Finder] Ships found:', Array.from(shipGroups.keys()));
  console.log('[B2B Finder] Slots per ship:', Array.from(shipGroups.entries()).map(([ship, slots]) => `${ship}: ${slots.length}`));

  const adjacencyMap = new Map<string, { slot: SailingSlot; gapDays: number }[]>();
  
  for (const [shipKey, shipSlots] of shipGroups) {
    const sortedShipSlots = [...shipSlots].sort((a, b) => 
      createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime()
    );
    
    console.log(`[B2B Finder] Processing ${shipKey} with ${sortedShipSlots.length} sailings`);
    
    for (let i = 0; i < sortedShipSlots.length; i++) {
      const slot = sortedShipSlots[i];
      const followers: { slot: SailingSlot; gapDays: number }[] = [];
      
      for (let j = i + 1; j < sortedShipSlots.length; j++) {
        const candidate = sortedShipSlots[j];
        
        const daysDiff = getDaysDifference(slot.returnDate, candidate.sailDate);
        
        if (daysDiff < 0) {
          console.log(`[B2B Finder] OVERLAP: ${slot.sailDate}→${slot.returnDate} overlaps with ${candidate.sailDate}, gap=${daysDiff}`);
          continue;
        }
        
        if (daysDiff > maxGapDays) {
          break;
        }
        
        const samePort = areSamePort(slot.departurePort, candidate.departurePort);
        if (!samePort) {
          console.log(`[B2B Finder] Port mismatch: ${slot.departurePort} vs ${candidate.departurePort}`);
          continue;
        }
        
        console.log(`[B2B Finder] MATCH: ${slot.shipName} ${slot.sailDate}→${slot.returnDate} can chain to ${candidate.sailDate} (gap=${daysDiff}d)`);
        followers.push({ slot: candidate, gapDays: daysDiff });
      }
      
      if (followers.length > 0) {
        adjacencyMap.set(slot.key, followers);
      }
    }
  }

  console.log('[B2B Finder] Slots with potential followers:', adjacencyMap.size);
  
  if (adjacencyMap.size === 0) {
    console.log('[B2B Finder] No adjacent slot pairs found. Possible reasons:');
    console.log('  - Sailings have overlapping dates');
    console.log('  - Gap between sailings exceeds', maxGapDays, 'days');
    console.log('  - Departure ports don\'t match');
    console.log('  - Not enough sailings on the same ship');
    
    // Sample diagnostics
    const shipCounts = Array.from(shipGroups.entries())
      .map(([ship, slots]) => ({ ship, count: slots.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    console.log('[B2B Finder] Top ships by sailing count:', shipCounts);
  }

  const allChains: { slots: SailingSlot[]; gapDays: number[]; usedOfferCodes: Set<string> }[] = [];
  const visitedInCurrentPath = new Set<string>();

  function getAvailableOfferCodes(slot: SailingSlot, usedCodes: Set<string>): string[] {
    const codes: string[] = [];
    for (const offer of slot.offers) {
      const code = offer.offerCode || 'NO_CODE';
      if (!usedCodes.has(code) && !codes.includes(code)) {
        codes.push(code);
      }
    }
    return codes;
  }

  function findChains(
    currentSlot: SailingSlot, 
    currentChain: SailingSlot[], 
    currentGaps: number[],
    usedOfferCodes: Set<string>
  ) {
    // Check if slot has any offers
    if (currentSlot.offers.length === 0 && currentChain.length > 0) {
      console.log('[B2B Finder] No offers for slot', currentSlot.key);
      return;
    }
    
    // If requiring different offers, get available codes for this slot
    if (requireDifferentOffers) {
      const availableCodes = getAvailableOfferCodes(currentSlot, usedOfferCodes);
      if (availableCodes.length === 0 && currentChain.length > 0) {
        console.log('[B2B Finder] No unique offer codes left for slot', currentSlot.key);
        return;
      }
    }
    
    currentChain.push(currentSlot);
    visitedInCurrentPath.add(currentSlot.key);
    
    // Update used codes only if we're requiring different offers
    let newUsedCodes = usedOfferCodes;
    if (requireDifferentOffers) {
      const availableCodes = getAvailableOfferCodes(currentSlot, usedOfferCodes);
      const codeToUse = availableCodes[0] || 'NO_CODE';
      newUsedCodes = new Set(usedOfferCodes);
      newUsedCodes.add(codeToUse);
    }
    
    const followers = adjacencyMap.get(currentSlot.key) || [];
    
    for (const { slot: nextSlot, gapDays } of followers) {
      if (visitedInCurrentPath.has(nextSlot.key)) continue;
      
      // Check if next slot has offers and unique codes if required
      if (nextSlot.offers.length === 0) {
        console.log('[B2B Finder] Next slot', nextSlot.key, 'has no offers, skipping');
        continue;
      }
      
      if (requireDifferentOffers) {
        const nextAvailableCodes = getAvailableOfferCodes(nextSlot, newUsedCodes);
        if (nextAvailableCodes.length === 0) {
          console.log('[B2B Finder] Next slot', nextSlot.key, 'has no unique codes, skipping chain extension');
          continue;
        }
      }
      
      findChains(nextSlot, [...currentChain], [...currentGaps, gapDays], newUsedCodes);
    }
    
    if (currentChain.length >= minChainLength) {
      allChains.push({ 
        slots: [...currentChain], 
        gapDays: [...currentGaps],
        usedOfferCodes: newUsedCodes
      });
    }
    
    visitedInCurrentPath.delete(currentSlot.key);
  }

  for (const slot of sortedSlots) {
    findChains(slot, [], [], new Set());
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

  // Filter slots' offers to only include non-MGM Gold offers and track unique codes per chain if required
  const chainsWithFilteredOffers = longestChains.map(chain => {
    const usedCodesInChain = new Set<string>();
    const filteredSlots = chain.slots.map(slot => {
      // Filter out MGM Gold offers and optionally filter already-used offer codes
      const availableOffers = slot.offers.filter(o => {
        if (isMGMGoldOffer(o.offerName, o.offerCode)) return false;
        
        // Only enforce unique codes if requireDifferentOffers is true
        if (requireDifferentOffers) {
          const code = o.offerCode || 'NO_CODE';
          return !usedCodesInChain.has(code);
        }
        
        return true;
      });
      
      // Mark codes from this slot as used only if we're requiring different offers
      if (requireDifferentOffers) {
        availableOffers.forEach(o => {
          const code = o.offerCode || 'NO_CODE';
          usedCodesInChain.add(code);
        });
      }
      
      return {
        ...slot,
        offers: availableOffers.length > 0 ? availableOffers : slot.offers.filter(o => !isMGMGoldOffer(o.offerName, o.offerCode)),
      };
    });
    
    return {
      ...chain,
      slots: filteredSlots,
    };
  });

  // Filter out chains where any slot has no valid offers
  const validChains = chainsWithFilteredOffers.filter(chain => 
    chain.slots.every(slot => slot.offers.length > 0)
  );

  console.log('[B2B Finder] Unique chains after deduplication:', longestChains.length);
  console.log('[B2B Finder] Valid chains with unique offer codes:', validChains.length);

  const b2bSets: BackToBackSet[] = validChains.map((chain, index) => {
    const setSlots = chain.slots;
    const setId = `b2b_${index}_${setSlots[0].sailDate}`;
    
    const totalNights = setSlots.reduce((sum, s) => sum + (s.nights || 0), 0);
    
    const allOfferCodes: string[] = [];
    const allOfferNames: string[] = [];
    let hasBookedCruise = false;
    
    setSlots.forEach(slot => {
      if (bookedSlotKeys.has(slot.key)) {
        hasBookedCruise = true;
      }
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

    console.log(`[B2B Finder] Set ${index + 1}: ${setSlots.length} sailings, ${totalNights} nights, ${firstSlot.sailDate} to ${lastSlot.returnDate}${hasBookedCruise ? ' (includes booked cruise)' : ''}`);
    setSlots.forEach((slot, i) => {
      const isBooked = bookedSlotKeys.has(slot.key);
      console.log(`  ${i + 1}. ${slot.shipName} ${slot.sailDate}-${slot.returnDate} (${slot.nights}N)${isBooked ? ' [BOOKED]' : ''} - ${slot.offers.length} offer options`);
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

  const filteredSets = b2bSets.filter(set => set.totalNights <= 14);

  console.log('[B2B Finder] Final result before 14-night filter:', b2bSets.length, 'back-to-back sets');
  console.log('[B2B Finder] Filtered sets (≤14 nights):', filteredSets.length, 'back-to-back sets');
  
  if (b2bSets.length > filteredSets.length) {
    console.log('[B2B Finder] Excluded', b2bSets.length - filteredSets.length, 'sets exceeding 14 nights');
  }

  const sortedSets = filteredSets.sort((a, b) => {
    if (a.totalNights !== b.totalNights) {
      return a.totalNights - b.totalNights;
    }
    return createDateFromString(a.startDate).getTime() - createDateFromString(b.startDate).getTime();
  });

  const spacedSets: BackToBackSet[] = [];
  
  for (const set of sortedSets) {
    const setStartDate = createDateFromString(set.startDate);
    const setEndDate = createDateFromString(set.endDate);
    
    let hasConflict = false;
    for (const existingSet of spacedSets) {
      const existingEndDate = createDateFromString(existingSet.endDate);
      const existingStartDate = createDateFromString(existingSet.startDate);
      
      const daysBetweenEnd = getDaysDifference(existingSet.endDate, set.startDate);
      const daysBetweenStart = getDaysDifference(set.endDate, existingSet.startDate);
      
      if (daysBetweenEnd >= 0 && daysBetweenEnd < minDaysBetweenBatches) {
        console.log(`[B2B Finder] Excluding set ${set.id}: only ${daysBetweenEnd} days after ${existingSet.id} (need ${minDaysBetweenBatches})`);
        hasConflict = true;
        break;
      }
      
      if (daysBetweenStart >= 0 && daysBetweenStart < minDaysBetweenBatches) {
        console.log(`[B2B Finder] Excluding set ${set.id}: only ${daysBetweenStart} days before ${existingSet.id} (need ${minDaysBetweenBatches})`);
        hasConflict = true;
        break;
      }
      
      const datesOverlap = setStartDate <= existingEndDate && setEndDate >= existingStartDate;
      if (datesOverlap) {
        console.log(`[B2B Finder] Excluding set ${set.id}: overlaps with ${existingSet.id}`);
        hasConflict = true;
        break;
      }
    }
    
    if (!hasConflict) {
      spacedSets.push(set);
    }
  }

  console.log('[B2B Finder] Final sets with adequate spacing:', spacedSets.length);
  if (sortedSets.length > spacedSets.length) {
    console.log('[B2B Finder] Excluded', sortedSets.length - spacedSets.length, 'sets for insufficient spacing');
  }

  return spacedSets;
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
