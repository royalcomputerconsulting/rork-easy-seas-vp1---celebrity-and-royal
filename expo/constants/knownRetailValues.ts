export interface KnownRetailValue {
  cruiseId: string;
  ship: string;
  departureDate: string;
  retailCabinValue: number;
}

export const KNOWN_RETAIL_VALUES: KnownRetailValue[] = [
  { cruiseId: 'booked-icon-2026-05-09', ship: 'Icon of the Seas', departureDate: '2026-05-09', retailCabinValue: 4800 },
  { cruiseId: 'booked-symphony-2026-05-17', ship: 'Symphony of the Seas', departureDate: '2026-05-17', retailCabinValue: 3786 },
  { cruiseId: 'booked-navigator-2026-05-29', ship: 'Navigator of the Seas', departureDate: '2026-05-29', retailCabinValue: 1798 },
  { cruiseId: 'booked-quantum-2026-06-05', ship: 'Quantum of the Seas', departureDate: '2026-06-05', retailCabinValue: 2650 },
  { cruiseId: 'booked-quantum-2026-06-19', ship: 'Quantum of the Seas', departureDate: '2026-06-19', retailCabinValue: 2250 },
  { cruiseId: '2656334', ship: 'Star of the Seas', departureDate: '2026-07-05', retailCabinValue: 5500 },
  { cruiseId: 'booked-navigator-2026-07-17', ship: 'Navigator of the Seas', departureDate: '2026-07-17', retailCabinValue: 3874 },
  { cruiseId: 'booked-navigator-2026-07-24', ship: 'Navigator of the Seas', departureDate: '2026-07-24', retailCabinValue: 3750 },
  { cruiseId: 'booked-celebrity-equinox-2026-08-05', ship: 'Celebrity Equinox', departureDate: '2026-08-05', retailCabinValue: 5156 },
  { cruiseId: 'booked-navigator-2026-08-21', ship: 'Navigator of the Seas', departureDate: '2026-08-21', retailCabinValue: 3700 },
  { cruiseId: 'booked-ovation-2026-09-04', ship: 'Ovation of the Seas', departureDate: '2026-09-04', retailCabinValue: 2100 },
  { cruiseId: 'booked-ovation-2026-09-11', ship: 'Ovation of the Seas', departureDate: '2026-09-11', retailCabinValue: 1478 },
  { cruiseId: 'booked-anthem-2026-09-29', ship: 'Anthem of the Seas', departureDate: '2026-09-29', retailCabinValue: 4226 },
  { cruiseId: 'booked-allure-2026-10-25', ship: 'Allure of the Seas', departureDate: '2026-10-25', retailCabinValue: 3900 },
  { cruiseId: 'booked-adventure-2026-11-15', ship: 'Adventure of the Seas', departureDate: '2026-11-15', retailCabinValue: 2250 },
  { cruiseId: 'booked-celebrity-beyond-2026-12-06', ship: 'Celebrity Beyond', departureDate: '2026-12-06', retailCabinValue: 2208 },
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
  const normalizedShip = ship.toLowerCase().trim();
  const entry = KNOWN_RETAIL_VALUES.find(v => {
    const normalizedKnownShip = v.ship.toLowerCase().trim();
    const shipMatches = normalizedKnownShip === normalizedShip || normalizedShip.includes(normalizedKnownShip) || normalizedKnownShip.includes(normalizedShip);
    return shipMatches && v.departureDate === departureDate;
  });

  return entry?.retailCabinValue ?? null;
}
