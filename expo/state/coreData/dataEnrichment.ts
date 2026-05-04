import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { KNOWN_RETAIL_VALUES } from '@/constants/knownRetailValues';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { COMPLETED_CRUISES_DATA } from '@/mocks/completedCruises';
import { findReceiptByShipAndDate } from '@/constants/receiptData';
import { findFreeplayOBCByOfferCode, findFreeplayOBCByShipAndDate } from '@/constants/freeplayOBCData';

export function applyKnownRetailValues(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    const knownValue = KNOWN_RETAIL_VALUES.find(kv => {
      if (kv.cruiseId === cruise.id || kv.cruiseId === cruise.bookingId || kv.cruiseId === cruise.reservationNumber) return true;

      const normalizedShip = cruise.shipName?.toLowerCase().trim() ?? '';
      const normalizedKnownShip = kv.ship.toLowerCase().trim();
      const shipMatch = normalizedShip === normalizedKnownShip || normalizedShip.includes(normalizedKnownShip) || normalizedKnownShip.includes(normalizedShip);
      const dateMatch = cruise.sailDate === kv.departureDate;
      return shipMatch && dateMatch;
    });
    
    if (knownValue) {
      return {
        ...cruise,
        retailValue: knownValue.retailCabinValue,
        totalRetailCost: knownValue.retailCabinValue,
        originalPrice: knownValue.retailCabinValue,
      };
    }
    
    return cruise;
  });
}

export function enrichCruisesWithReceiptData(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    const receipt = findReceiptByShipAndDate(cruise.shipName, cruise.sailDate);
    
    if (receipt) {
      const knownRetailValue = KNOWN_RETAIL_VALUES.find(kv => {
        if (kv.cruiseId === cruise.id || kv.cruiseId === cruise.bookingId || kv.cruiseId === cruise.reservationNumber) return true;
        const normalizedShip = cruise.shipName?.toLowerCase().trim() ?? '';
        const normalizedKnownShip = kv.ship.toLowerCase().trim();
        return kv.departureDate === cruise.sailDate && (normalizedShip === normalizedKnownShip || normalizedShip.includes(normalizedKnownShip) || normalizedKnownShip.includes(normalizedShip));
      })?.retailCabinValue;
      const retailValue = Math.max(knownRetailValue ?? 0, receipt.totalRetailCost);
      const casinoDiscount = Math.max(receipt.totalCasinoDiscount, retailValue - receipt.pricePaid);

      return {
        ...cruise,
        pricePaid: receipt.pricePaid,
        taxesFeesEstimate: cruise.taxesFeesEstimate ?? receipt.pricePaid,
        netEffectivePaid: cruise.netEffectivePaid ?? receipt.pricePaid,
        totalRetailCost: retailValue,
        totalCasinoDiscount: casinoDiscount,
        cabinCategory: receipt.cabinCategory,
        cabinNumber: cruise.cabinNumber || receipt.cabinNumber,
        retailValue,
        originalPrice: retailValue,
      };
    }
    
    return cruise;
  });
}

export function applyFreeplayOBCData(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    let freeplayRecord = cruise.offerCode 
      ? findFreeplayOBCByOfferCode(cruise.offerCode)
      : undefined;
    
    if (!freeplayRecord && cruise.shipName && cruise.sailDate) {
      freeplayRecord = findFreeplayOBCByShipAndDate(cruise.shipName, cruise.sailDate);
    }
    
    if (freeplayRecord) {
      const updates: Partial<BookedCruise> = {};
      
      if (freeplayRecord.freePlay > 0 && (!cruise.freePlay || cruise.freePlay === 0)) {
        updates.freePlay = freeplayRecord.freePlay;
      }
      
      if (freeplayRecord.obc > 0 && (!cruise.freeOBC || cruise.freeOBC === 0)) {
        updates.freeOBC = freeplayRecord.obc;
      }
      
      if (!cruise.offerCode && freeplayRecord.offerCode) {
        updates.offerCode = freeplayRecord.offerCode;
      }
      
      if (Object.keys(updates).length > 0) {
        console.log('[DataEnrichment] Applied freeplay/OBC data to cruise:', {
          cruiseId: cruise.id,
          shipName: cruise.shipName,
          sailDate: cruise.sailDate,
          offerCode: freeplayRecord.offerCode,
          freePlay: freeplayRecord.freePlay,
          obc: freeplayRecord.obc,
        });
        return { ...cruise, ...updates };
      }
    }
    
    return cruise;
  });
}

export function enrichCruisesWithMockItineraries(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    const allMockCruises = [...COMPLETED_CRUISES_DATA, ...BOOKED_CRUISES_DATA];
    const mockCruise = allMockCruises.find(mc => 
      mc.id === cruise.id || 
      mc.reservationNumber === cruise.reservationNumber ||
      (mc.shipName === cruise.shipName && mc.sailDate === cruise.sailDate)
    );
    
    if (mockCruise?.itinerary && mockCruise.itinerary.length > 0) {
      return {
        ...cruise,
        itinerary: mockCruise.itinerary,
        seaDays: mockCruise.seaDays,
        portDays: mockCruise.portDays,
        casinoOpenDays: mockCruise.casinoOpenDays,
      };
    }
    
    return cruise;
  });
}

export function enrichCruisesWithOfferData(cruises: Cruise[], offers: CasinoOffer[]): Cruise[] {
  if (!offers || offers.length === 0) return cruises;
  
  return cruises.map(cruise => {
    if (!cruise.offerCode) return cruise;
    
    const linkedOffer = offers.find(o => 
      o.offerCode === cruise.offerCode ||
      o.id === cruise.offerCode ||
      (o.cruiseIds && o.cruiseIds.includes(cruise.id))
    );
    
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
        portsAndTimes: cruise.portsAndTimes || linkedOffer.portsAndTimes,
        ports: cruise.ports || linkedOffer.ports,
        tradeInValue: cruise.tradeInValue || linkedOffer.tradeInValue,
        freePlay: cruise.freePlay || linkedOffer.freePlay || linkedOffer.freeplayAmount,
        perks: cruise.perks || linkedOffer.perks,
        guestsInfo: cruise.guestsInfo || linkedOffer.guestsInfo,
        offerExpiry: cruise.offerExpiry || linkedOffer.expiryDate || linkedOffer.offerExpiryDate,
        offerName: cruise.offerName || linkedOffer.offerName || linkedOffer.title,
      };
    }
    
    return cruise;
  });
}
