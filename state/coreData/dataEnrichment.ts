import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { KNOWN_RETAIL_VALUES } from '@/constants/knownRetailValues';
import { BOOKED_CRUISES_DATA } from '@/mocks/bookedCruises';
import { COMPLETED_CRUISES_DATA } from '@/mocks/completedCruises';
import { findReceiptByShipAndDate } from '@/constants/receiptData';

export function applyKnownRetailValues(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    const knownValue = KNOWN_RETAIL_VALUES.find(kv => {
      if (kv.cruiseId === cruise.id) return true;
      if (kv.cruiseId === cruise.bookingId) return true;
      
      const shipMatch = cruise.shipName?.toLowerCase().includes(kv.ship.toLowerCase().split(' ')[0]);
      const dateMatch = cruise.sailDate === kv.departureDate;
      return shipMatch && dateMatch;
    });
    
    if (knownValue && (!cruise.retailValue || cruise.retailValue === 0)) {
      return {
        ...cruise,
        retailValue: knownValue.retailCabinValue,
      };
    }
    
    return cruise;
  });
}

export function enrichCruisesWithReceiptData(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    const receipt = findReceiptByShipAndDate(cruise.shipName, cruise.sailDate);
    
    if (receipt) {
      return {
        ...cruise,
        pricePaid: receipt.pricePaid,
        totalRetailCost: receipt.totalRetailCost,
        totalCasinoDiscount: receipt.totalCasinoDiscount,
        cabinCategory: receipt.cabinCategory,
        cabinNumber: cruise.cabinNumber || receipt.cabinNumber,
        retailValue: receipt.totalRetailCost,
      };
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
