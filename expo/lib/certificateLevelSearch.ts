import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { createDateFromString, formatDate } from '@/lib/date';
import { getCertificatePdfMatch } from '@/lib/royalCaribbean/certificatePdf';

export interface CertificateLevelSearchInput {
  query?: string;
  shipNames?: string[];
  sailDates?: string[];
}

export interface CertificateLevelSearchContext {
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  offers: CasinoOffer[];
}

interface CertificateEntry {
  shipName: string;
  sailDate: string;
  certificateCode: string;
  certificateType: 'A' | 'C';
  certificateLevel: string;
  pdfUrl: string;
  monthlyIndexUrl: string;
  source: 'cruise' | 'booked' | 'offer';
}

interface CertificateSailingAggregate {
  shipName: string;
  sailDate: string;
  levels: string[];
  codes: string[];
  types: Array<'A' | 'C'>;
}

function normalizeText(value?: string | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildShipAliases(shipName: string): string[] {
  const normalized = normalizeText(shipName);
  const withoutSuffix = normalized.replace(/\bof the seas\b/g, '').trim();
  const tokens = withoutSuffix.split(' ').filter(Boolean);
  const aliases = new Set<string>();

  if (normalized) aliases.add(normalized);
  if (withoutSuffix && withoutSuffix !== normalized) aliases.add(withoutSuffix);
  if (tokens.length > 0) aliases.add(tokens[0]);
  if (tokens.length > 1) aliases.add(tokens.join(' '));

  return Array.from(aliases).filter(alias => alias.length >= 3);
}

function formatDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? createDateFromString(value) : value;
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortCertificateLevel(a: string, b: string): number {
  const aType = a.slice(0, 1);
  const bType = b.slice(0, 1);
  if (aType !== bType) {
    return aType.localeCompare(bType);
  }

  const aNumeric = parseInt(a.slice(1), 10);
  const bNumeric = parseInt(b.slice(1), 10);
  const aHasNumber = Number.isFinite(aNumeric);
  const bHasNumber = Number.isFinite(bNumeric);

  if (aHasNumber && bHasNumber && aNumeric !== bNumeric) {
    return aNumeric - bNumeric;
  }

  return a.localeCompare(b);
}

function getAllShipNames(context: CertificateLevelSearchContext): string[] {
  const ships = new Set<string>();

  context.cruises.forEach(cruise => {
    if (cruise.shipName) ships.add(cruise.shipName);
  });

  context.bookedCruises.forEach(cruise => {
    if (cruise.shipName) ships.add(cruise.shipName);
  });

  context.offers.forEach(offer => {
    if (offer.shipName) ships.add(offer.shipName);
  });

  return Array.from(ships).sort((a, b) => a.localeCompare(b));
}

function buildCertificateEntries(context: CertificateLevelSearchContext): CertificateEntry[] {
  const entries = new Map<string, CertificateEntry>();

  const registerEntry = (
    source: 'cruise' | 'booked' | 'offer',
    payload: {
      shipName?: string;
      sailDate?: string;
      offerCode?: string;
      offerName?: string;
    }
  ) => {
    const shipName = payload.shipName?.trim();
    const sailDate = payload.sailDate?.trim();

    if (!shipName || !sailDate) {
      return;
    }

    const certificateMatch = getCertificatePdfMatch({
      offerCode: payload.offerCode,
      offerName: payload.offerName,
    });

    if (!certificateMatch) {
      return;
    }

    const certificateLevel = certificateMatch.certificateCode.slice(4).toUpperCase();
    const dateKey = formatDateKey(sailDate);
    const entryKey = `${shipName}__${dateKey}__${certificateMatch.certificateCode}`;

    if (entries.has(entryKey)) {
      return;
    }

    entries.set(entryKey, {
      shipName,
      sailDate: dateKey,
      certificateCode: certificateMatch.certificateCode,
      certificateType: certificateMatch.certificateType,
      certificateLevel,
      pdfUrl: certificateMatch.pdfUrl,
      monthlyIndexUrl: certificateMatch.monthlyIndexUrl,
      source,
    });
  };

  context.cruises.forEach(cruise => {
    registerEntry('cruise', {
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
      offerCode: cruise.offerCode,
      offerName: cruise.offerName,
    });
  });

  context.bookedCruises.forEach(cruise => {
    registerEntry('booked', {
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
      offerCode: cruise.offerCode,
      offerName: cruise.offerName,
    });
  });

  context.offers.forEach(offer => {
    registerEntry('offer', {
      shipName: offer.shipName,
      sailDate: offer.sailingDate,
      offerCode: offer.offerCode,
      offerName: offer.offerName || offer.title,
    });
  });

  const results = Array.from(entries.values()).sort((a, b) => {
    if (a.shipName !== b.shipName) {
      return a.shipName.localeCompare(b.shipName);
    }

    if (a.sailDate !== b.sailDate) {
      return a.sailDate.localeCompare(b.sailDate);
    }

    return sortCertificateLevel(a.certificateLevel, b.certificateLevel);
  });

  console.log('[CertificateLevelSearch] Built certificate entries:', {
    cruiseCount: context.cruises.length,
    bookedCruiseCount: context.bookedCruises.length,
    offerCount: context.offers.length,
    certificateEntryCount: results.length,
  });

  return results;
}

export function parseCertificateSearchShipNames(query: string, context: CertificateLevelSearchContext): string[] {
  const normalizedQuery = normalizeText(query);
  const matchingShips = getAllShipNames(context).filter(shipName => {
    return buildShipAliases(shipName).some(alias => normalizedQuery.includes(alias));
  });

  console.log('[CertificateLevelSearch] Parsed ship filters:', {
    query,
    matchingShips,
  });

  return matchingShips;
}

export function parseCertificateSearchSailDates(query: string): string[] {
  const matches = new Set<string>();
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
  ];

  patterns.forEach(pattern => {
    const foundMatches = query.match(pattern) ?? [];
    foundMatches.forEach(value => {
      const parsed = createDateFromString(value);
      if (!Number.isNaN(parsed.getTime())) {
        matches.add(formatDateKey(parsed));
      }
    });
  });

  const sailDates = Array.from(matches).sort();

  console.log('[CertificateLevelSearch] Parsed sail date filters:', {
    query,
    sailDates,
  });

  return sailDates;
}

export function executeCertificateLevelSearch(
  input: CertificateLevelSearchInput,
  context: CertificateLevelSearchContext
): string {
  console.log('[CertificateLevelSearch] Executing certificate level search:', input);

  const query = input.query ?? '';
  const shipNames = input.shipNames && input.shipNames.length > 0
    ? Array.from(new Set(input.shipNames))
    : parseCertificateSearchShipNames(query, context);
  const sailDates = input.sailDates && input.sailDates.length > 0
    ? Array.from(new Set(input.sailDates.map(value => formatDateKey(value))))
    : parseCertificateSearchSailDates(query);

  const entries = buildCertificateEntries(context);

  if (entries.length === 0) {
    return 'No certificate-coded offers are currently available in your imported data.';
  }

  if (shipNames.length === 0 && sailDates.length === 0) {
    return 'Tell me a ship name or sailing date and I can list the certificate levels that match it.';
  }

  const normalizedShipFilters = shipNames.map(name => normalizeText(name));

  const matchedEntries = entries.filter(entry => {
    const shipMatches = normalizedShipFilters.length === 0
      ? true
      : normalizedShipFilters.some(filterValue => normalizeText(entry.shipName) === filterValue);
    const dateMatches = sailDates.length === 0
      ? true
      : sailDates.includes(entry.sailDate);
    return shipMatches && dateMatches;
  });

  console.log('[CertificateLevelSearch] Matched entries:', {
    shipNames,
    sailDates,
    matchedEntryCount: matchedEntries.length,
  });

  if (matchedEntries.length === 0) {
    const requestedShipsText = shipNames.length > 0 ? shipNames.join(', ') : 'the requested filters';
    return `No certificate-level matches were found for ${requestedShipsText} in your current imported offers.`;
  }

  const shipSummaryMap = new Map<string, Set<string>>();
  const sailingMap = new Map<string, CertificateSailingAggregate>();

  matchedEntries.forEach(entry => {
    if (!shipSummaryMap.has(entry.shipName)) {
      shipSummaryMap.set(entry.shipName, new Set<string>());
    }
    shipSummaryMap.get(entry.shipName)?.add(entry.certificateLevel);

    const sailingKey = `${entry.shipName}__${entry.sailDate}`;
    const existing = sailingMap.get(sailingKey);

    if (existing) {
      if (!existing.levels.includes(entry.certificateLevel)) {
        existing.levels.push(entry.certificateLevel);
      }
      if (!existing.codes.includes(entry.certificateCode)) {
        existing.codes.push(entry.certificateCode);
      }
      if (!existing.types.includes(entry.certificateType)) {
        existing.types.push(entry.certificateType);
      }
      return;
    }

    sailingMap.set(sailingKey, {
      shipName: entry.shipName,
      sailDate: entry.sailDate,
      levels: [entry.certificateLevel],
      codes: [entry.certificateCode],
      types: [entry.certificateType],
    });
  });

  const sortedShipSummaries = Array.from(shipSummaryMap.entries())
    .map(([shipName, levels]) => ({
      shipName,
      levels: Array.from(levels).sort(sortCertificateLevel),
    }))
    .sort((a, b) => a.shipName.localeCompare(b.shipName));

  const sortedSailings = Array.from(sailingMap.values())
    .map(sailing => ({
      ...sailing,
      levels: [...sailing.levels].sort(sortCertificateLevel),
      codes: [...sailing.codes].sort((a, b) => a.localeCompare(b)),
      types: [...sailing.types].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      if (a.shipName !== b.shipName) {
        return a.shipName.localeCompare(b.shipName);
      }
      return a.sailDate.localeCompare(b.sailDate);
    });

  const lines: string[] = [
    '## Certificate Level Search',
    '',
  ];

  if (shipNames.length > 0) {
    lines.push(`**Ships:** ${shipNames.join(', ')}`);
  }
  if (sailDates.length > 0) {
    lines.push(`**Sailing Dates:** ${sailDates.map(date => formatDate(date, 'medium')).join(', ')}`);
  }
  lines.push(`**Matched Sailings:** ${sortedSailings.length}`);
  lines.push(`**Matched Certificate Entries:** ${matchedEntries.length}`);
  lines.push('');
  lines.push('### Ship Summary');
  sortedShipSummaries.forEach(summary => {
    lines.push(`• ${summary.shipName}: ${summary.levels.join(', ')}`);
  });
  lines.push('');
  lines.push('### Matching Sailings');
  lines.push('');

  sortedSailings.forEach((sailing, index) => {
    lines.push(`${index + 1}. **${sailing.shipName}**`);
    lines.push(`   📅 ${formatDate(sailing.sailDate, 'medium')}`);
    lines.push(`   🎟️ Levels: ${sailing.levels.join(', ')}`);
    lines.push(`   🔖 Certificate Codes: ${sailing.codes.join(', ')}`);
    lines.push('');
  });

  return lines.join('\n');
}
