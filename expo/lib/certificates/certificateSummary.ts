import type { LocalCertificateLevel, LocalCertificateSailingMatch } from './certificateSailingIndex';

export type CertificateSummaryMetric =
  | 'all'
  | 'one_guest'
  | 'two_guests'
  | 'unknown_guests'
  | 'weekend_departure'
  | 'florida_departure'
  | 'shortest'
  | 'longest';

export type CertificateSummaryQualityIssue =
  | 'missing_guest_count'
  | 'missing_nights'
  | 'missing_ship_class'
  | 'missing_departure_port'
  | 'missing_cabin'
  | 'not_accepted';

export type CertificateSummarySort =
  | 'soonest'
  | 'latest'
  | 'points_low'
  | 'points_high'
  | 'nights_short'
  | 'nights_long'
  | 'ship'
  | 'class'
  | 'cabin'
  | 'port'
  | 'guest_low'
  | 'guest_high'
  | 'freeplay_high'
  | 'obc_high';

export interface CertificateSummaryOption extends LocalCertificateLevel {
  optionId: string;
  shipName: string;
  sailDate: string;
  certificateMonth: string | null;
  region: string | null;
}

export interface CertificateSummaryFilter {
  certificateCodes?: string[];
  certificateMonths?: string[];
  certificateTypes?: Array<'A' | 'C'>;
  guestCounts?: number[];
  includeUnknownGuests?: boolean;
  shipNames?: string[];
  shipClasses?: string[];
  cabinLabels?: string[];
  departurePorts?: string[];
  regions?: string[];
  itineraries?: string[];
  startDays?: string[];
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  minimumPoints?: number;
  maximumPoints?: number;
  minimumNights?: number;
  maximumNights?: number;
  minimumFreePlay?: number;
  maximumFreePlay?: number;
  minimumOnBoardCredit?: number;
  maximumOnBoardCredit?: number;
  hasNextCruiseBonus?: boolean;
  weekendDepartureOnly?: boolean;
  floridaDepartureOnly?: boolean;
  gty?: boolean;
  qualityIssues?: CertificateSummaryQualityIssue[];
  metric?: CertificateSummaryMetric;
  metricCertificateCode?: string;
}

export interface CertificateSummaryRow {
  certificateCode: string;
  certificateType: 'A' | 'C';
  points: number | null;
  oneGuestOptions: number;
  twoGuestOptions: number;
  unknownGuestOptions: number;
  totalOptions: number;
  physicalSailings: number;
  weekendDepartures: number;
  floridaDepartures: number;
  shortestNights: number | null;
  longestNights: number | null;
}

export interface CertificateSummaryReport {
  rows: CertificateSummaryRow[];
  options: CertificateSummaryOption[];
  certificateCount: number;
  totalOptions: number;
  physicalSailingCount: number;
  oneGuestOptions: number;
  twoGuestOptions: number;
  unknownGuestOptions: number;
  weekendDepartures: number;
  floridaDepartures: number;
  unknownNightOptions: number;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function certificateMonth(code: string): string | null {
  const match = code.match(/^(\d{2})(\d{2})[AC]/i);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `20${match[1]}-${match[2]}`;
}

function destinationRegion(itinerary: string | null, departurePort: string | null): string | null {
  const value = normalized(`${itinerary ?? ''} ${departurePort ?? ''}`);
  if (!value) return null;
  if (/transatlantic|atlantic crossing/.test(value)) return 'Transatlantic';
  if (/mediterranean|europe|spain|italy|greece|norway|british isles|iceland/.test(value)) return 'Europe';
  if (/alaska/.test(value)) return 'Alaska';
  if (/hawaii|south pacific|tahiti/.test(value)) return 'Hawaii & South Pacific';
  if (/australia|new zealand/.test(value)) return 'Australia & New Zealand';
  if (/asia|japan|china|singapore|busan|shanghai/.test(value)) return 'Asia';
  if (/canada|new england|bermuda/.test(value)) return 'Canada, New England & Bermuda';
  if (/mexico|ensenada|cabo|mazatlan/.test(value)) return 'Mexico';
  if (/bahamas|perfect day|cococay|nassau/.test(value)) return 'Bahamas & Perfect Day';
  if (/caribbean|aruba|curacao|st maarten|st thomas|jamaica/.test(value)) return 'Caribbean';
  return 'Other';
}

function optionIdentity(match: LocalCertificateSailingMatch, level: LocalCertificateLevel): string {
  return [
    level.certificateCode,
    match.shipName,
    match.sailDate,
    level.departurePort,
    level.itinerary,
    level.nights,
    level.cabinLabel,
    level.guestCount,
    level.isGty,
    level.freePlay,
    level.onBoardCredit,
    level.tradeInValue,
    level.nextCruiseBonusLabel,
  ].map(normalized).join('__');
}

export function flattenCertificateSummaryOptions(matches: LocalCertificateSailingMatch[]): CertificateSummaryOption[] {
  const options = new Map<string, CertificateSummaryOption>();
  matches.forEach((match) => {
    match.levels.forEach((level) => {
      const optionId = optionIdentity(match, level);
      if (options.has(optionId)) return;
      options.set(optionId, {
        ...level,
        optionId,
        shipName: match.shipName,
        sailDate: match.sailDate,
        certificateMonth: certificateMonth(level.certificateCode),
        region: destinationRegion(level.itinerary, level.departurePort),
      });
    });
  });
  return Array.from(options.values()).sort((left, right) =>
    left.certificateCode.localeCompare(right.certificateCode)
    || left.sailDate.localeCompare(right.sailDate)
    || left.shipName.localeCompare(right.shipName)
    || (left.guestCount ?? Number.MAX_SAFE_INTEGER) - (right.guestCount ?? Number.MAX_SAFE_INTEGER)
    || normalized(left.cabinLabel).localeCompare(normalized(right.cabinLabel)));
}

function containsNormalized(values: string[] | undefined, candidate: string | null): boolean {
  if (!values?.length) return true;
  const wanted = new Set(values.map(normalized));
  return wanted.has(normalized(candidate));
}
function containsNormalizedPhrase(values: string[] | undefined, candidate: string | null): boolean { if (!values?.length) return true; const actual = normalized(candidate); return values.some((value) => actual.includes(normalized(value))); }

function hasQualityIssue(option: CertificateSummaryOption, issue: CertificateSummaryQualityIssue): boolean {
  if (issue === 'missing_guest_count') return option.guestCount == null;
  if (issue === 'missing_nights') return option.nights == null;
  if (issue === 'missing_ship_class') return !option.shipClass;
  if (issue === 'missing_departure_port') return !option.departurePort;
  if (issue === 'missing_cabin') return !option.cabinLabel;
  if (issue === 'not_accepted') return Boolean(option.validationStatus && option.validationStatus !== 'accepted');
  return false;
}

function matchesMetric(option: CertificateSummaryOption, filter: CertificateSummaryFilter): boolean {
  const metric = filter.metric ?? 'all';
  if (filter.metricCertificateCode && normalized(option.certificateCode) !== normalized(filter.metricCertificateCode)) return false;
  if (metric === 'one_guest') return option.guestCount === 1;
  if (metric === 'two_guests') return option.guestCount === 2;
  if (metric === 'unknown_guests') return option.guestCount == null;
  if (metric === 'weekend_departure') return option.isWeekendDeparture;
  if (metric === 'florida_departure') return option.isFloridaDeparture;
  return true;
}

export function filterCertificateSummaryOptions(
  options: CertificateSummaryOption[],
  filter: CertificateSummaryFilter = {},
): CertificateSummaryOption[] {
  let filtered = options.filter((option) => {
    if (!containsNormalized(filter.certificateCodes, option.certificateCode)) return false;
    if (!containsNormalized(filter.certificateMonths, option.certificateMonth)) return false;
    if (filter.certificateTypes?.length && !filter.certificateTypes.includes(option.certificateType)) return false;
    if (filter.guestCounts?.length && (option.guestCount == null || !filter.guestCounts.includes(option.guestCount))) return false;
    if (filter.includeUnknownGuests === false && option.guestCount == null) return false;
    if (!containsNormalizedPhrase(filter.shipNames, option.shipName)) return false;
    if (!containsNormalizedPhrase(filter.shipClasses, option.shipClass)) return false;
    if (!containsNormalizedPhrase(filter.cabinLabels, option.cabinLabel)) return false;
    if (!containsNormalizedPhrase(filter.departurePorts, option.departurePort)) return false;
    if (!containsNormalized(filter.regions, option.region)) return false;
    if (!containsNormalized(filter.itineraries, option.itinerary)) return false;
    if (!containsNormalized(filter.startDays, option.startDay)) return false;
    if (filter.searchQuery) {
      const queryTerms = normalized(filter.searchQuery).split(' ').filter(Boolean);
      const haystack = normalized([
        option.certificateCode, option.shipName, option.shipClass, option.departurePort,
        option.itinerary, option.region, option.cabinLabel, option.offerTypeLabel, option.nextCruiseBonusLabel,
        option.sailDate, option.points,
      ].join(' '));
      if (!queryTerms.every((term) => haystack.includes(term))) return false;
    }
    if (filter.startDate && option.sailDate < filter.startDate.slice(0, 10)) return false;
    if (filter.endDate && option.sailDate > filter.endDate.slice(0, 10)) return false;
    if (filter.minimumPoints != null && (option.points == null || option.points < filter.minimumPoints)) return false;
    if (filter.maximumPoints != null && (option.points == null || option.points > filter.maximumPoints)) return false;
    if (filter.minimumNights != null && (option.nights == null || option.nights < filter.minimumNights)) return false;
    if (filter.maximumNights != null && (option.nights == null || option.nights > filter.maximumNights)) return false;
    if (filter.minimumFreePlay != null && (option.freePlay == null || option.freePlay < filter.minimumFreePlay)) return false;
    if (filter.maximumFreePlay != null && (option.freePlay == null || option.freePlay > filter.maximumFreePlay)) return false;
    if (filter.minimumOnBoardCredit != null && (option.onBoardCredit == null || option.onBoardCredit < filter.minimumOnBoardCredit)) return false;
    if (filter.maximumOnBoardCredit != null && (option.onBoardCredit == null || option.onBoardCredit > filter.maximumOnBoardCredit)) return false;
    if (filter.hasNextCruiseBonus != null && Boolean(option.nextCruiseBonusLabel) !== filter.hasNextCruiseBonus) return false;
    if (filter.weekendDepartureOnly && !option.isWeekendDeparture) return false;
    if (filter.floridaDepartureOnly && !option.isFloridaDeparture) return false;
    if (filter.gty != null && option.isGty !== filter.gty) return false;
    if (filter.qualityIssues?.length && !filter.qualityIssues.some((issue) => hasQualityIssue(option, issue))) return false;
    return matchesMetric(option, filter);
  });

  if ((filter.metric === 'shortest' || filter.metric === 'longest') && filter.metricCertificateCode) {
    const knownNights = filtered.map((option) => option.nights).filter((value): value is number => value != null);
    if (!knownNights.length) return [];
    const target = filter.metric === 'shortest' ? Math.min(...knownNights) : Math.max(...knownNights);
    filtered = filtered.filter((option) => option.nights === target);
  }
  return filtered;
}

export function sortCertificateSummaryOptions(
  options: CertificateSummaryOption[],
  sort: CertificateSummarySort = 'soonest',
): CertificateSummaryOption[] {
  const direction = (left: CertificateSummaryOption, right: CertificateSummaryOption): number => {
    if (sort === 'latest') return right.sailDate.localeCompare(left.sailDate);
    if (sort === 'points_low') return (left.points ?? Number.MAX_SAFE_INTEGER) - (right.points ?? Number.MAX_SAFE_INTEGER);
    if (sort === 'points_high') return (right.points ?? -1) - (left.points ?? -1);
    if (sort === 'nights_short') return (left.nights ?? Number.MAX_SAFE_INTEGER) - (right.nights ?? Number.MAX_SAFE_INTEGER);
    if (sort === 'nights_long') return (right.nights ?? -1) - (left.nights ?? -1);
    if (sort === 'ship') return normalized(left.shipName).localeCompare(normalized(right.shipName));
    if (sort === 'class') return normalized(left.shipClass).localeCompare(normalized(right.shipClass));
    if (sort === 'cabin') return normalized(left.cabinLabel).localeCompare(normalized(right.cabinLabel));
    if (sort === 'port') return normalized(left.departurePort).localeCompare(normalized(right.departurePort));
    if (sort === 'guest_low') return (left.guestCount ?? Number.MAX_SAFE_INTEGER) - (right.guestCount ?? Number.MAX_SAFE_INTEGER);
    if (sort === 'guest_high') return (right.guestCount ?? -1) - (left.guestCount ?? -1);
    if (sort === 'freeplay_high') return (right.freePlay ?? -1) - (left.freePlay ?? -1);
    if (sort === 'obc_high') return (right.onBoardCredit ?? -1) - (left.onBoardCredit ?? -1);
    return left.sailDate.localeCompare(right.sailDate);
  };
  return [...options].sort((left, right) => direction(left, right)
    || left.certificateCode.localeCompare(right.certificateCode)
    || left.shipName.localeCompare(right.shipName)
    || left.optionId.localeCompare(right.optionId));
}

export function getCertificateSummaryQualityCounts(options: CertificateSummaryOption[]): Record<CertificateSummaryQualityIssue, number> {
  const issues: CertificateSummaryQualityIssue[] = [
    'missing_guest_count', 'missing_nights', 'missing_ship_class',
    'missing_departure_port', 'missing_cabin', 'not_accepted',
  ];
  return issues.reduce((result, issue) => {
    result[issue] = options.filter((option) => hasQualityIssue(option, issue)).length;
    return result;
  }, {} as Record<CertificateSummaryQualityIssue, number>);
}

function physicalKey(option: CertificateSummaryOption): string {
  return `${normalized(option.shipName)}__${option.sailDate}`;
}

function summarizeRow(certificateCode: string, options: CertificateSummaryOption[]): CertificateSummaryRow {
  const relevant = options.filter((option) => option.certificateCode === certificateCode);
  const knownNights = relevant.map((option) => option.nights).filter((value): value is number => value != null);
  return {
    certificateCode,
    certificateType: relevant[0]?.certificateType ?? (certificateCode.slice(4, 5).toUpperCase() === 'A' ? 'A' : 'C'),
    points: relevant.find((option) => option.points != null)?.points ?? null,
    oneGuestOptions: relevant.filter((option) => option.guestCount === 1).length,
    twoGuestOptions: relevant.filter((option) => option.guestCount === 2).length,
    unknownGuestOptions: relevant.filter((option) => option.guestCount == null).length,
    totalOptions: relevant.length,
    physicalSailings: new Set(relevant.map(physicalKey)).size,
    weekendDepartures: relevant.filter((option) => option.isWeekendDeparture).length,
    floridaDepartures: relevant.filter((option) => option.isFloridaDeparture).length,
    shortestNights: knownNights.length ? Math.min(...knownNights) : null,
    longestNights: knownNights.length ? Math.max(...knownNights) : null,
  };
}

export function buildCertificateSummaryReport(
  matches: LocalCertificateSailingMatch[],
  filter: CertificateSummaryFilter = {},
): CertificateSummaryReport {
  const options = filterCertificateSummaryOptions(flattenCertificateSummaryOptions(matches), filter);
  const codes = Array.from(new Set(options.map((option) => option.certificateCode))).sort((left, right) => {
    const leftPoints = options.find((option) => option.certificateCode === left)?.points ?? Number.MAX_SAFE_INTEGER;
    const rightPoints = options.find((option) => option.certificateCode === right)?.points ?? Number.MAX_SAFE_INTEGER;
    return rightPoints - leftPoints || left.localeCompare(right);
  });
  return {
    rows: codes.map((code) => summarizeRow(code, options)),
    options,
    certificateCount: codes.length,
    totalOptions: options.length,
    physicalSailingCount: new Set(options.map(physicalKey)).size,
    oneGuestOptions: options.filter((option) => option.guestCount === 1).length,
    twoGuestOptions: options.filter((option) => option.guestCount === 2).length,
    unknownGuestOptions: options.filter((option) => option.guestCount == null).length,
    weekendDepartures: options.filter((option) => option.isWeekendDeparture).length,
    floridaDepartures: options.filter((option) => option.isFloridaDeparture).length,
    unknownNightOptions: options.filter((option) => option.nights == null).length,
  };
}
