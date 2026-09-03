export type CruiseDiscoveryEligibility = 'all' | 'offer' | 'certificate';

export interface CruiseDiscoveryFilterValues {
  cabinType: string;
  selectedShips: string[];
  selectedShipClasses: string[];
  guestCounts: number[];
  departurePorts: string[];
  regions: string[];
  dateFrom: string;
  dateTo: string;
  minNights: string;
  maxNights: string;
  eligibility: CruiseDiscoveryEligibility;
}

export interface CruiseDiscoveryRowFacts {
  shipName: string;
  shipClass: string;
  cabinType: string;
  guestCount: number | null;
  departurePort: string;
  regionOrDestination: string;
  sailDate: string;
  nights: number;
  hasOffer: boolean;
  hasCertificate: boolean;
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function matchesCruiseDiscoveryFilters(
  row: CruiseDiscoveryRowFacts,
  filters: CruiseDiscoveryFilterValues,
): boolean {
  if (filters.cabinType !== 'all' && !row.cabinType.toLowerCase().includes(filters.cabinType.toLowerCase())) return false;
  if (filters.selectedShips.length > 0 && !filters.selectedShips.includes(row.shipName)) return false;
  if (filters.selectedShipClasses.length > 0 && !filters.selectedShipClasses.includes(row.shipClass)) return false;
  if (filters.guestCounts.length > 0 && (row.guestCount == null || !filters.guestCounts.includes(row.guestCount))) return false;
  if (filters.departurePorts.length > 0 && !filters.departurePorts.includes(row.departurePort)) return false;
  if (filters.regions.length > 0 && !filters.regions.includes(row.regionOrDestination)) return false;
  if (filters.dateFrom && row.sailDate < filters.dateFrom) return false;
  if (filters.dateTo && row.sailDate > filters.dateTo) return false;

  const minNights = optionalNumber(filters.minNights);
  const maxNights = optionalNumber(filters.maxNights);
  if (minNights != null && row.nights < minNights) return false;
  if (maxNights != null && row.nights > maxNights) return false;
  if (filters.eligibility === 'offer' && !row.hasOffer) return false;
  if (filters.eligibility === 'certificate' && !row.hasCertificate) return false;
  return true;
}
