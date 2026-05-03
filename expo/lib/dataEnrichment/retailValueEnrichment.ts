import type { BookedCruise } from '@/types/models';
import { KNOWN_RETAIL_VALUES } from '@/constants/knownRetailValues';

export function applyKnownRetailValuesToBooked(cruises: BookedCruise[]): BookedCruise[] {
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
      console.log(`[DataEnrichment] Applied known retail value ${knownValue.retailCabinValue} to cruise ${cruise.id} (${cruise.shipName})`);
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
