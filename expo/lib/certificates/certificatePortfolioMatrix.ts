import type { CasinoOffer } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import type { LocalCertificateLevel, LocalCertificateSailingMatch } from './certificateSailingIndex';

export type CertificatePortfolioSignal = 'overlap' | 'unique' | 'certificate_only' | 'dominated' | 'expiring';

export interface CertificatePortfolioRow {
  certificateCode: string;
  certificateType: 'A' | 'C';
  points: number | null;
  sailingCount: number;
  ships: string[];
  months: string[];
  cabins: string[];
  departurePorts: string[];
  overlapSailings: number;
  uniqueSailings: number;
  certificateOnlySailings: number;
  dominatedUses: number;
  expiresAt?: string;
  daysUntilExpiry: number | null;
  signals: CertificatePortfolioSignal[];
}

export interface CertificatePortfolioReport {
  rows: CertificatePortfolioRow[];
  certificateCount: number;
  sailingCount: number;
  overlapSailingCount: number;
  uniqueAccessCount: number;
  certificateOnlyCount: number;
  dominatedUseCount: number;
  expiringCertificateCount: number;
  shipColumns: string[];
  monthColumns: string[];
  cabinColumns: string[];
  departurePortColumns: string[];
}

interface RowAccumulator {
  levelsBySailing: Map<string, LocalCertificateLevel>;
  ships: Set<string>;
  months: Set<string>;
  cabins: Set<string>;
  departurePorts: Set<string>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sailingKey(shipName: string, sailDate: string): string {
  return `${normalized(shipName)}__${text(sailDate).slice(0, 10)}`;
}

function cabinRank(value: string | null): number {
  const cabin = normalized(value);
  if (cabin.includes('royal suite') || cabin.includes('owners suite') || cabin.includes('owner s suite')) return 7;
  if (cabin.includes('grand suite')) return 6;
  if (cabin.includes('junior suite')) return 5;
  if (cabin.includes('suite')) return 4;
  if (cabin.includes('balcony')) return 3;
  if (cabin.includes('ocean')) return 2;
  if (cabin.includes('interior') || cabin.includes('inside')) return 1;
  return 0;
}

function amount(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isDominated(candidate: LocalCertificateLevel, alternatives: LocalCertificateLevel[]): boolean {
  const candidatePoints = candidate.points;
  if (candidatePoints == null) return false;
  return alternatives.some((other) => {
    if (other.certificateCode === candidate.certificateCode || other.points == null || other.points > candidatePoints) return false;
    const cabinAtLeastAsGood = cabinRank(other.cabinLabel) >= cabinRank(candidate.cabinLabel);
    const freePlayAtLeastAsGood = amount(other.freePlay) >= amount(candidate.freePlay);
    const obcAtLeastAsGood = amount(other.onBoardCredit) >= amount(candidate.onBoardCredit);
    const strictlyBetter = other.points < candidatePoints
      || cabinRank(other.cabinLabel) > cabinRank(candidate.cabinLabel)
      || amount(other.freePlay) > amount(candidate.freePlay)
      || amount(other.onBoardCredit) > amount(candidate.onBoardCredit);
    return cabinAtLeastAsGood && freePlayAtLeastAsGood && obcAtLeastAsGood && strictlyBetter;
  });
}

function getCertificateCode(certificate: Certificate): string {
  const explicit = text(certificate.certificateCode).toUpperCase();
  if (explicit) return explicit;
  return text(certificate.label).toUpperCase().match(/\b\d{4}[AC][A-Z0-9]+\b/)?.[0] ?? '';
}

function daysUntil(dateValue: string | undefined, now: Date): number | null {
  if (!dateValue) return null;
  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((timestamp - today) / 86_400_000);
}

function sorted(values: Set<string>): string[] {
  return Array.from(values).filter(Boolean).sort((left, right) => left.localeCompare(right));
}

/**
 * Builds a mobile-friendly matrix from locally retained certificate evidence.
 * Certificate sailings remain separate from the master Available Cruises
 * catalog. “Certificate only” means no exact dated current offer matched; it
 * is a review signal, not a promise of bookability or stackability.
 */
export function buildCertificatePortfolioMatrix(
  matches: LocalCertificateSailingMatch[],
  currentOffers: CasinoOffer[],
  ownedCertificates: Certificate[],
  now = new Date(),
): CertificatePortfolioReport {
  const rowsByCode = new Map<string, RowAccumulator>();
  const codesBySailing = new Map<string, Set<string>>();
  const levelsBySailing = new Map<string, LocalCertificateLevel[]>();
  const datedOfferKeys = new Set(currentOffers
    .filter((offer) => offer.status !== 'archived' && offer.status !== 'expired' && offer.status !== 'skipped' && offer.shipName && offer.sailingDate)
    .map((offer) => sailingKey(offer.shipName as string, offer.sailingDate as string)));

  matches.forEach((match) => {
    const key = sailingKey(match.shipName, match.sailDate);
    const materialLevels = new Map(match.levels.map((level) => [level.certificateCode, level]));
    levelsBySailing.set(key, Array.from(materialLevels.values()));
    materialLevels.forEach((level, code) => {
      const accumulator = rowsByCode.get(code) ?? {
        levelsBySailing: new Map<string, LocalCertificateLevel>(),
        ships: new Set<string>(),
        months: new Set<string>(),
        cabins: new Set<string>(),
        departurePorts: new Set<string>(),
      };
      accumulator.levelsBySailing.set(key, level);
      accumulator.ships.add(match.shipName);
      accumulator.months.add(match.sailDate.slice(0, 7));
      if (level.cabinLabel) accumulator.cabins.add(level.cabinLabel);
      if (level.departurePort) accumulator.departurePorts.add(level.departurePort);
      rowsByCode.set(code, accumulator);
      const sailingCodes = codesBySailing.get(key) ?? new Set<string>();
      sailingCodes.add(code);
      codesBySailing.set(key, sailingCodes);
    });
  });

  const expiryByCode = new Map<string, string>();
  ownedCertificates.forEach((certificate) => {
    const code = getCertificateCode(certificate);
    if (!code || !certificate.expiryDate || certificate.status === 'used') return;
    const previous = expiryByCode.get(code);
    if (!previous || certificate.expiryDate < previous) expiryByCode.set(code, certificate.expiryDate);
  });

  const rows = Array.from(rowsByCode.entries()).map(([certificateCode, accumulator]): CertificatePortfolioRow => {
    const entries = Array.from(accumulator.levelsBySailing.entries());
    const firstLevel = entries[0]?.[1];
    const overlapSailings = entries.filter(([key]) => (codesBySailing.get(key)?.size ?? 0) > 1).length;
    const uniqueSailings = entries.filter(([key]) => codesBySailing.get(key)?.size === 1).length;
    const certificateOnlySailings = entries.filter(([key]) => !datedOfferKeys.has(key)).length;
    const dominatedUses = entries.filter(([key, level]) => isDominated(level, levelsBySailing.get(key) ?? [])).length;
    const expiresAt = expiryByCode.get(certificateCode);
    const expiryDays = daysUntil(expiresAt, now);
    const signals: CertificatePortfolioSignal[] = [];
    if (overlapSailings > 0) signals.push('overlap');
    if (uniqueSailings > 0) signals.push('unique');
    if (certificateOnlySailings > 0) signals.push('certificate_only');
    if (dominatedUses > 0) signals.push('dominated');
    if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 45) signals.push('expiring');
    return {
      certificateCode,
      certificateType: firstLevel?.certificateType ?? (certificateCode.slice(4, 5) === 'A' ? 'A' : 'C'),
      points: firstLevel?.points ?? null,
      sailingCount: entries.length,
      ships: sorted(accumulator.ships),
      months: sorted(accumulator.months),
      cabins: sorted(accumulator.cabins),
      departurePorts: sorted(accumulator.departurePorts),
      overlapSailings,
      uniqueSailings,
      certificateOnlySailings,
      dominatedUses,
      expiresAt,
      daysUntilExpiry: expiryDays,
      signals,
    };
  }).sort((left, right) => (left.points ?? Number.MAX_SAFE_INTEGER) - (right.points ?? Number.MAX_SAFE_INTEGER) || left.certificateCode.localeCompare(right.certificateCode));

  const allSailingKeys = new Set(matches.map((match) => sailingKey(match.shipName, match.sailDate)));
  const allShips = new Set(rows.flatMap((row) => row.ships));
  const allMonths = new Set(rows.flatMap((row) => row.months));
  const allCabins = new Set(rows.flatMap((row) => row.cabins));
  const allPorts = new Set(rows.flatMap((row) => row.departurePorts));
  return {
    rows,
    certificateCount: rows.length,
    sailingCount: allSailingKeys.size,
    overlapSailingCount: Array.from(codesBySailing.values()).filter((codes) => codes.size > 1).length,
    uniqueAccessCount: rows.reduce((sum, row) => sum + row.uniqueSailings, 0),
    certificateOnlyCount: rows.reduce((sum, row) => sum + row.certificateOnlySailings, 0),
    dominatedUseCount: rows.reduce((sum, row) => sum + row.dominatedUses, 0),
    expiringCertificateCount: rows.filter((row) => row.signals.includes('expiring')).length,
    shipColumns: sorted(allShips),
    monthColumns: sorted(allMonths),
    cabinColumns: sorted(allCabins),
    departurePortColumns: sorted(allPorts),
  };
}
