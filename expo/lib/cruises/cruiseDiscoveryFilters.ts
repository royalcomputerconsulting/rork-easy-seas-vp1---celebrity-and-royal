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

export interface CruiseDiscoverySearchFacts {
  shipName?: string;
  shipClass?: string;
  itineraryName?: string;
  destination?: string;
  destinationRegion?: string;
  departurePort?: string;
  ports?: string[] | string;
  offerCode?: string;
  offerName?: string;
  guestsInfo?: string;
}

/** Match every meaningful query term against the complete cruise identity. */
export function matchesCruiseDiscoverySearch(row: CruiseDiscoverySearchFacts, query: string): boolean {
  const terms = Array.from(new Set(
    query.toLowerCase().split(/[^a-z0-9]+/i).map((term) => term.trim()).filter((term) => term.length >= 2),
  ));
  if (terms.length === 0) return true;
  const ports = Array.isArray(row.ports) ? row.ports.join(' ') : row.ports;
  const haystack = [
    row.shipName,
    row.shipClass ? `${row.shipClass} class` : '',
    row.itineraryName,
    row.destination,
    row.destinationRegion,
    row.departurePort,
    ports,
    row.offerCode,
    row.offerName,
    row.guestsInfo,
  ].map((value) => String(value ?? '').toLowerCase()).join(' ');
  return terms.every((term) => haystack.includes(term));
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
