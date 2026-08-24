import { buildCertificatePdfUrl } from './certificateCatalog';
import { DEFAULT_CERTIFICATE_POINTS, parseCertificateCode } from './certificatePdfParserCore';

export interface LocalCertificateLevel {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  guestCount: number | null;
  cabinLabel: string | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  benefitSummary: string[];
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

function normalized(value: unknown): string {
  return String(value ?? '').trim();
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function materialLevelKey(level: LocalCertificateLevel): string {
  return [
    level.certificateCode,
    level.cabinLabel,
    level.offerTypeLabel,
    level.guestCount,
    level.freePlay,
    level.onBoardCredit,
    level.itinerary,
  ].map((value) => normalized(value).toLowerCase()).join('__');
}

/**
 * Builds the Certificate Lookup inventory only. This data is intentionally
 * never merged into CoreData/Available Cruises.
 */
export function buildLocalCertificateSailingIndex(certificates: SearchableCertificateLike[]): LocalCertificateSailingMatch[] {
  const groups = new Map<string, LocalCertificateSailingMatch>();

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
        ?? optionalNumber(occupancy.match(/\d+/)?.[0] ? Number(occupancy.match(/\d+/)?.[0]) : null);
      const benefitSummary = [
        cabinLabel,
        occupancy,
        freePlay == null ? '' : `$${freePlay.toLocaleString()} free play`,
        onBoardCredit == null ? '' : `$${onBoardCredit.toLocaleString()} onboard credit`,
      ].filter((value): value is string => typeof value === 'string' && value.length > 0);
      const pdfUrl = normalized(certificate.sourceDocumentArchiveUri) || normalized(certificate.sourcePdfUrl) || buildCertificatePdfUrl(certificateCode);
      const level: LocalCertificateLevel = {
        certificateCode,
        certificateType: parts.family,
        level: parts.levelCode,
        points: optionalNumber(raw.pointRequirement) ?? DEFAULT_CERTIFICATE_POINTS[parts.levelCode] ?? null,
        departurePort: normalized(raw.departurePort) || null,
        itinerary: normalized(raw.itinerary) || null,
        offerTypeLabel: normalized(raw.offerTypeLabel) || occupancy || null,
        guestCount,
        cabinLabel,
        freePlay,
        onBoardCredit,
        benefitSummary,
        pdfUrl,
        monthlyIndexUrl: buildCertificatePdfUrl(`${parts.monthCode}${parts.family}`),
      };
      const groupKey = `${shipName.toLowerCase()}__${sailDate}`;
      const group = groups.get(groupKey) ?? { shipName, sailDate, levels: [], decisionGuide: [] };
      const levelKey = materialLevelKey(level);
      if (!group.levels.some((candidate) => materialLevelKey(candidate) === levelKey)) group.levels.push(level);
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
