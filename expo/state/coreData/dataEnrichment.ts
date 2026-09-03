import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { findSingleMaterialOffer } from '@/lib/itineraryIntegrity';

export function applyKnownRetailValues(cruises: BookedCruise[]): BookedCruise[] {
  // Bundled values are fixtures, not a source of truth for the signed-in user.
  return cruises;
}

export function enrichCruisesWithReceiptData(cruises: BookedCruise[]): BookedCruise[] {
  return cruises;
}

export function applyFreeplayOBCData(cruises: BookedCruise[]): BookedCruise[] {
  return cruises;
}

export function enrichCruisesWithMockItineraries(cruises: BookedCruise[]): BookedCruise[] {
  // Historical mock records are fixtures only. Production data must retain an
  // explicitly missing itinerary until a provider, document, or user supplies it.
  return cruises;
}

export function enrichCruisesWithOfferData(cruises: Cruise[], offers: CasinoOffer[]): Cruise[] {
  if (!offers || offers.length === 0) return cruises;
  
  return cruises.map(cruise => {
    if (!cruise.offerCode) return cruise;
    
    const linkedOffer = findSingleMaterialOffer(cruise, offers);
    
    if (!linkedOffer) return cruise;
    
    const needsPricing = !cruise.interiorPrice && !cruise.oceanviewPrice && !cruise.balconyPrice && !cruise.suitePrice;
    const needsPorts = !cruise.ports || cruise.ports.length === 0;
    
    if (needsPricing || needsPorts) {
      return {
        ...cruise,
        interiorPrice: cruise.interiorPrice || linkedOffer.interiorPrice,
        oceanviewPrice: cruise.oceanviewPrice || linkedOffer.oceanviewPrice,
        balconyPrice: cruise.balconyPrice || linkedOffer.balconyPrice,
        suitePrice: cruise.suitePrice || linkedOffer.suitePrice,
        taxes: cruise.taxes || linkedOffer.taxesFees,
        // findSingleMaterialOffer has verified ship/date identity before any
        // row-specific itinerary evidence can cross this boundary.
        portsAndTimes: needsPorts ? (cruise.portsAndTimes || linkedOffer.portsAndTimes) : cruise.portsAndTimes,
        ports: needsPorts ? (cruise.ports || linkedOffer.ports) : cruise.ports,
        tradeInValue: cruise.tradeInValue || linkedOffer.tradeInValue,
        freePlay: cruise.freePlay || linkedOffer.freePlay || linkedOffer.freeplayAmount,
        perks: cruise.perks || linkedOffer.perks,
        guestsInfo: cruise.guestsInfo || linkedOffer.guestsInfo,
        offerExpiry: cruise.offerExpiry || linkedOffer.expiryDate || linkedOffer.offerExpiryDate,
        offerName: cruise.offerName || linkedOffer.offerName || linkedOffer.title,
        dataConfidence: cruise.dataConfidence ?? 'enriched',
        sourceProvider: cruise.sourceProvider ?? 'material-offer-link',
      };
    }
    
    return cruise;
  });
}
