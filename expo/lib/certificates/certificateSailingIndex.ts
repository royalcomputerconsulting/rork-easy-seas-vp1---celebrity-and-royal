import { buildCertificatePdfUrl } from './certificateCatalog';
import { DEFAULT_CERTIFICATE_POINTS, parseCertificateCode } from './certificatePdfParserCore';
import { formatGuestEligibility, parseGuestEligibility } from '../cruiseRecordIntegrity';
import { ROYAL_CARIBBEAN_SHIPS } from '@/constants/shipInfo';

export interface LocalCertificateLevel {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  departurePort: string | null;
  itinerary: string | null;
  shipClass: string | null;
  nights: number | null;
  startDay: string | null;
  endDay: string | null;
  isWeekendDeparture: boolean;
  isFloridaDeparture: boolean;
  offerTypeLabel: string | null;
  guestCount: number | null;
  cabinLabel: string | null;
  isGty: boolean;
  freePlay: number | null;
  onBoardCredit: number | null;
  tradeInValue: number | null;
  nextCruiseBonusLabel: string | null;
  benefitSummary: string[];
  sourcePage: number | null;
  sourceGroup: string | null;
  validationStatus: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

export interface LocalCertificateSailingMatch {
  shipName: string;
  sailDate: string;
  levels: LocalCertificateLevel[];
  decisionGuide: string[];
}

interface SearchableCertificateLike {
  certificateCode?: string;
  sourcePdfUrl?: string;
  sourceDocumentArchiveUri?: string;
  parsedSailings?: unknown[];
}

const ROYAL_CARIBBEAN_SHIP_CLASS_BY_NAME = new Map(
  Object.entries(ROYAL_CARIBBEAN_SHIPS).map(([name, details]) => [name.toLowerCase(), details.class] as const),
);

function normalized(value: unknown): string {
  return String(value ?? '').trim();
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]+/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizedShipClass(shipName: string, explicit: unknown): string | null {
  const provided = normalized(explicit);
  if (provided) return provided;
  return ROYAL_CARIBBEAN_SHIP_CLASS_BY_NAME.get(shipName.toLowerCase()) ?? null;
}

function extractNights(raw: Record<string, unknown>): number | null {
  const explicit = optionalNumber(raw.nights ?? raw.cruiseNights ?? raw.durationNights ?? raw.duration);
  if (explicit != null && explicit >= 1 && explicit <= 365) return Math.trunc(explicit);
  const searchable = [raw.itinerary, raw.offerTypeLabel, raw.cruiseLength, raw.duration]
    .map(normalized)
    .join(' ');
  const match = searchable.match(/\b(\d{1,3})\s*[- ]?nights?\b/i);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 365 ? parsed : null;
}

function dateFacts(sailDate: string, nights: number | null): { startDay: string | null; endDay: string | null } {
  const start = new Date(`${sailDate}T12:00:00Z`);
  if (!Number.isFinite(start.getTime())) return { startDay: null, endDay: null };
  const startDay = start.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  if (nights == null) return { startDay, endDay: null };
  const end = new Date(start.getTime() + nights * 86_400_000);
  return {
    startDay,
    endDay: end.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
  };
}

function isFloridaDeparturePort(value: string | null): boolean {
  const port = normalized(value).toLowerCase();
  if (!port) return false;
  return /\bflorida\b|,\s*fl\b/.test(port)
    || /\b(miami|port canaveral|fort lauderdale|tampa|jacksonville|palm beach)\b/.test(port);
}

function materialLevelKey(level: LocalCertificateLevel): string {
  return [
    level.certificateCode,
    level.cabinLabel,
    level.offerTypeLabel,
    level.guestCount,
    level.freePlay,
    level.onBoardCredit,
    level.tradeInValue,
    level.nextCruiseBonusLabel,
    level.departurePort,
    level.itinerary,
    level.shipClass,
    level.nights,
    level.isGty,
    level.benefitSummary.join('|'),
  ].map((value) => normalized(value).toLowerCase()).join('__');
}

/**
 * Builds the Certificate Lookup inventory only. This data is intentionally
 * never merged into CoreData/Available Cruises.
 */
export function buildLocalCertificateSailingIndex(certificates: SearchableCertificateLike[]): LocalCertificateSailingMatch[] {
  const groups = new Map<string, LocalCertificateSailingMatch>();
  const levelKeysByGroup = new Map<string, Set<string>>();
  const dateFactsCache = new Map<string, { startDay: string | null; endDay: string | null }>();

  for (const certificate of certificates) {
    for (const candidate of Array.isArray(certificate.parsedSailings) ? certificate.parsedSailings : []) {
      if (!candidate || typeof candidate !== 'object') continue;
      const raw = candidate as Record<string, unknown>;
      const certificateCode = normalized(raw.certificateCode || certificate.certificateCode).toUpperCase();
      const parts = parseCertificateCode(certificateCode);
      if (parts.family !== 'A' && parts.family !== 'C') continue;
      const shipName = normalized(raw.shipName);
      const sailDate = normalized(raw.sailingDate || raw.sailDate).slice(0, 10);
      if (!shipName || !sailDate) continue;

      const benefits = Array.isArray(raw.benefits) ? raw.benefits as Array<Record<string, unknown>> : [];
      const freePlay = optionalNumber(raw.freePlay) ?? optionalNumber(benefits.find((benefit) => benefit.kind === 'free_play')?.amount);
      const onBoardCredit = optionalNumber(raw.onboardCredit ?? raw.onBoardCredit) ?? optionalNumber(benefits.find((benefit) => benefit.kind === 'onboard_credit')?.amount);
      const cabinLabel = normalized(raw.cabinCategory || raw.cabinLabel) || null;
      const occupancy = normalized(raw.occupancy);
      const guestCount = optionalNumber(raw.guestCount)
        ?? parseGuestEligibility(occupancy)
        ?? null;
      const guestLabel = formatGuestEligibility(guestCount, 'Guest eligibility not stated');
      const departurePort = normalized(raw.departurePort) || null;
      const itinerary = normalized(raw.itinerary) || null;
      const nights = extractNights(raw);
      const dateKey = `${sailDate}__${nights ?? 'unknown'}`;
      const cachedDateFacts = dateFactsCache.get(dateKey) ?? dateFacts(sailDate, nights);
      dateFactsCache.set(dateKey, cachedDateFacts);
      const { startDay, endDay } = cachedDateFacts;
      const nextCruiseBonusLabel = normalized(raw.nextCruiseBonusLabel) || null;
      const tradeInValue = optionalNumber(raw.tradeInValue) ?? optionalNumber(benefits.find((benefit) => benefit.kind === 'trade_in_value')?.amount);
      const isGty = raw.gty === true || /\bgty\b|guarantee/i.test(`${cabinLabel ?? ''} ${normalized(raw.offerTypeLabel)}`);
      const benefitSummary = [
        cabinLabel,
        guestLabel,
        freePlay == null ? '' : `$${freePlay.toLocaleString()} free play`,
        onBoardCredit == null ? '' : `$${onBoardCredit.toLocaleString()} onboard credit`,
        tradeInValue == null ? '' : `$${tradeInValue.toLocaleString()} trade-in`,
        nextCruiseBonusLabel ?? '',
      ].filter((value): value is string => typeof value === 'string' && value.length > 0);
      const pdfUrl = normalized(certificate.sourceDocumentArchiveUri) || normalized(certificate.sourcePdfUrl) || buildCertificatePdfUrl(certificateCode);
      const level: LocalCertificateLevel = {
        certificateCode,
        certificateType: parts.family,
        level: parts.levelCode,
        points: optionalNumber(raw.pointRequirement) ?? DEFAULT_CERTIFICATE_POINTS[parts.levelCode] ?? null,
        departurePort,
        itinerary,
        shipClass: normalizedShipClass(shipName, raw.shipClass),
        nights,
        startDay,
        endDay,
        isWeekendDeparture: startDay === 'Friday' || startDay === 'Saturday' || startDay === 'Sunday',
        isFloridaDeparture: isFloridaDeparturePort(departurePort),
        offerTypeLabel: normalized(raw.offerTypeLabel) || occupancy || null,
        guestCount,
        cabinLabel,
        isGty,
        freePlay,
        onBoardCredit,
        tradeInValue,
        nextCruiseBonusLabel,
        benefitSummary,
        sourcePage: optionalNumber(raw.sourcePage),
        sourceGroup: normalized(raw.sourceGroup) || null,
        validationStatus: normalized(raw.validationStatus) || null,
        pdfUrl,
        monthlyIndexUrl: buildCertificatePdfUrl(`${parts.monthCode}${parts.family}`),
      };
      const groupKey = `${shipName.toLowerCase()}__${sailDate}`;
      const group = groups.get(groupKey) ?? { shipName, sailDate, levels: [], decisionGuide: [] };
      const levelKey = materialLevelKey(level);
      const knownLevelKeys = levelKeysByGroup.get(groupKey) ?? new Set<string>();
      if (!knownLevelKeys.has(levelKey)) {
        knownLevelKeys.add(levelKey);
        group.levels.push(level);
      }
      levelKeysByGroup.set(groupKey, knownLevelKeys);
      groups.set(groupKey, group);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      levels: group.levels.sort((left, right) => (left.points ?? Number.MAX_SAFE_INTEGER) - (right.points ?? Number.MAX_SAFE_INTEGER) || left.certificateCode.localeCompare(right.certificateCode)),
      decisionGuide: [`${group.levels.length} saved certificate option${group.levels.length === 1 ? '' : 's'} for this sailing.`],
    }))
    .sort((left, right) => left.sailDate.localeCompare(right.sailDate) || left.shipName.localeCompare(right.shipName));
}
