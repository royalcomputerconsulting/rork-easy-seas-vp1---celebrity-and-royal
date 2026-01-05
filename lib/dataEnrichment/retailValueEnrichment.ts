import type { BookedCruise } from '@/types/models';
import { KNOWN_RETAIL_VALUES } from '@/constants/knownRetailValues';

export function applyKnownRetailValuesToBooked(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map(cruise => {
    const knownValue = KNOWN_RETAIL_VALUES.find(kv => {
      if (kv.cruiseId === cruise.id) return true;
      if (kv.cruiseId === cruise.bookingId) return true;
      
      const shipMatch = cruise.shipName?.toLowerCase().includes(kv.ship.toLowerCase().split(' ')[0]);
      const dateMatch = cruise.sailDate === kv.departureDate;
      return shipMatch && dateMatch;
    });
    
    if (knownValue && (!cruise.retailValue || cruise.retailValue === 0)) {
      console.log(`[DataEnrichment] Applied known retail value ${knownValue.retailCabinValue} to cruise ${cruise.id} (${cruise.shipName})`);
      return {
        ...cruise,
        retailValue: knownValue.retailCabinValue,
      };
    }
    
    return cruise;
  });
}
