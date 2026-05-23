export interface KnownRetailValue {
  cruiseId: string;
  ship: string;
  departureDate: string;
  retailCabinValue: number;
}

export const KNOWN_RETAIL_VALUES: KnownRetailValue[] = [
  { cruiseId: '2665774', ship: 'Star of the Seas', departureDate: '2025-08-27', retailCabinValue: 6580 },
  { cruiseId: '7836829', ship: 'Radiance of the Seas', departureDate: '2025-09-26', retailCabinValue: 4480 },
  { cruiseId: '6242276', ship: 'Navigator of the Seas', departureDate: '2025-08-01', retailCabinValue: 2880 },
  { cruiseId: '5156149', ship: 'Navigator of the Seas', departureDate: '2025-09-08', retailCabinValue: 2880 },
  { cruiseId: '5207254', ship: 'Navigator of the Seas', departureDate: '2025-09-15', retailCabinValue: 2880 },
  { cruiseId: '2501764', ship: 'Harmony of the Seas', departureDate: '2025-04-20', retailCabinValue: 6020 },
  { cruiseId: '7871133', ship: 'Wonder of the Seas', departureDate: '2025-03-09', retailCabinValue: 6300 },
  { cruiseId: '236930', ship: 'Ovation of the Seas', departureDate: '2025-07-29', retailCabinValue: 5460 },
];

export function getKnownRetailValue(cruiseId: string): number | null {
  const entry = KNOWN_RETAIL_VALUES.find(v => v.cruiseId === cruiseId);
  return entry?.retailCabinValue ?? null;
}

export function findRetailValueByShipAndDate(ship: string, departureDate: string): number | null {
  const normalizedShip = ship.toLowerCase();
  const entry = KNOWN_RETAIL_VALUES.find(v => 
    v.ship.toLowerCase().includes(normalizedShip) || normalizedShip.includes(v.ship.toLowerCase().split(' ')[0])
  );
  
  if (entry && entry.departureDate === departureDate) {
    return entry.retailCabinValue;
  }
  
  const byDate = KNOWN_RETAIL_VALUES.find(v => v.departureDate === departureDate);
  if (byDate) {
    return byDate.retailCabinValue;
  }
  
  return null;
}
