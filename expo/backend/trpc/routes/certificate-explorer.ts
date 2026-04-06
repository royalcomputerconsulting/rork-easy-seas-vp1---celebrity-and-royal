import * as z from 'zod';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { createTRPCRouter, publicProcedure } from '../create-context';

const CERTIFICATE_PDF_BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
const MONTH_CODE_REGEX = /^\d{4}$/;
const DATE_TEXT_REGEX = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/gi;

const ROYAL_SHIP_NAMES = [
  'Adventure Of The Seas',
  'Allure Of The Seas',
  'Anthem Of The Seas',
  'Brilliance Of The Seas',
  'Enchantment Of The Seas',
  'Explorer Of The Seas',
  'Freedom Of The Seas',
  'Grandeur Of The Seas',
  'Harmony Of The Seas',
  'Icon Of The Seas',
  'Independence Of The Seas',
  'Jewel Of The Seas',
  'Legend Of The Seas',
  'Liberty Of The Seas',
  'Mariner Of The Seas',
  'Navigator Of The Seas',
  'Oasis Of The Seas',
  'Odyssey Of The Seas',
  'Ovation Of The Seas',
  'Quantum Of The Seas',
  'Radiance Of The Seas',
  'Rhapsody Of The Seas',
  'Serenade Of The Seas',
  'Spectrum Of The Seas',
  'Star Of The Seas',
  'Symphony Of The Seas',
  'Utopia Of The Seas',
  'Vision Of The Seas',
  'Voyager Of The Seas',
  'Wonder Of The Seas',
] as const;

interface IndexEntry {
  certificateCode: string;
  certificateType: 'A' | 'C';
  points: number | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface SailingEntry {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  shipName: string;
  sailDate: string;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

function getDefaultMonthCode(): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function buildPdfUrl(code: string): string {
  return `${CERTIFICATE_PDF_BASE_URL}/${code}.pdf`;
}

function normalizeText(value?: string | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/®/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateToIso(value?: string | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function decodePdfLiteralString(value: string): string {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (current !== '\\') {
      result += current;
      continue;
    }

    index += 1;
    const escaped = value[index];

    if (escaped === undefined) {
      break;
    }

    if (escaped === 'n') {
      result += '\n';
      continue;
    }

    if (escaped === 'r') {
      result += '\r';
      continue;
    }

    if (escaped === 't') {
      result += '\t';
      continue;
    }

    if (escaped === 'b') {
      result += '\b';
      continue;
    }

    if (escaped === 'f') {
      result += '\f';
      continue;
    }

    if (escaped === '(' || escaped === ')' || escaped === '\\') {
      result += escaped;
      continue;
    }

    if (/[0-7]/.test(escaped)) {
      const octalDigits = [escaped];
      while (octalDigits.length < 3 && /[0-7]/.test(value[index + 1] ?? '')) {
        index += 1;
        octalDigits.push(value[index]);
      }
      result += String.fromCharCode(parseInt(octalDigits.join(''), 8));
      continue;
    }

    result += escaped;
  }

  return result;
}

function extractLiteralStringsFromStream(streamText: string): string[] {
  const results: string[] = [];
  let buffer = '';
  let depth = 0;
  let escaping = false;

  for (let index = 0; index < streamText.length; index += 1) {
    const char = streamText[index];

    if (depth === 0) {
      if (char === '(') {
        depth = 1;
        buffer = '';
      }
      continue;
    }

    if (escaping) {
      buffer += `\\${char}`;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (char === '(') {
      depth += 1;
      buffer += char;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        results.push(decodePdfLiteralString(buffer));
        buffer = '';
        continue;
      }
      buffer += char;
      continue;
    }

    buffer += char;
  }

  return results;
}

function sanitizePdfText(value: string): string {
  return Array.from(value)
    .filter(char => char !== '\u0000')
    .map(char => {
      const code = char.charCodeAt(0);
      const isUnsupportedControl = code <= 31 && code !== 9 && code !== 10 && code !== 13;
      return isUnsupportedControl ? ' ' : char;
    })
    .join('');
}

function extractPdfText(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes).toString('latin1');
  const streamRegex = /(<<[\s\S]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const extracted: string[] = [];

  for (const match of raw.matchAll(streamRegex)) {
    const dictionary = match[1] ?? '';
    const streamBinary = Buffer.from(match[2] ?? '', 'latin1');
    let decodedStream: string | null = null;

    if (dictionary.includes('/FlateDecode')) {
      try {
        decodedStream = inflateSync(streamBinary).toString('latin1');
      } catch {
        try {
          decodedStream = inflateRawSync(streamBinary).toString('latin1');
        } catch {
          decodedStream = null;
        }
      }
    } else {
      decodedStream = streamBinary.toString('latin1');
    }

    if (!decodedStream) {
      continue;
    }

    const literalStrings = extractLiteralStringsFromStream(decodedStream);
    if (literalStrings.length > 0) {
      extracted.push(literalStrings.join(''));
    }
  }

  return sanitizePdfText(extracted.join('\n'))
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPdfText(url: string): Promise<string> {
  console.log('[CertificateExplorer] Fetching PDF:', url);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/pdf,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} for ${url}`);
  }

  const pdfBytes = new Uint8Array(await response.arrayBuffer());
  console.log('[CertificateExplorer] PDF downloaded:', { url, bytes: pdfBytes.length });
  return extractPdfText(pdfBytes);
}

function extractIndexEntries(monthCode: string, certificateType: 'A' | 'C', pdfText: string): IndexEntry[] {
  const entryMap = new Map<string, IndexEntry>();
  const regex = new RegExp(`(\\d{4}${certificateType}[A-Z0-9]{1,8})\\s*[–—-]\\s*([\\d,]+)\\s*points`, 'gi');

  for (const match of pdfText.matchAll(regex)) {
    const certificateCode = (match[1] ?? '').toUpperCase();
    const pointsValue = parseInt((match[2] ?? '0').replace(/,/g, ''), 10);

    if (!certificateCode || entryMap.has(certificateCode)) {
      continue;
    }

    entryMap.set(certificateCode, {
      certificateCode,
      certificateType,
      points: Number.isFinite(pointsValue) ? pointsValue : null,
      pdfUrl: buildPdfUrl(certificateCode),
      monthlyIndexUrl: buildPdfUrl(`${monthCode}${certificateType}`),
    });
  }

  const entries = Array.from(entryMap.values());
  console.log('[CertificateExplorer] Index entries extracted:', {
    monthCode,
    certificateType,
    count: entries.length,
  });
  return entries;
}

function resolveShipTargets(shipQuery: string): string[] {
  const normalizedQuery = normalizeText(shipQuery);
  const rawSegments = shipQuery
    .split(/,|\band\b|&/gi)
    .map(segment => segment.trim())
    .filter(Boolean);

  const normalizedSegments = rawSegments.length > 0
    ? rawSegments.map(segment => normalizeText(segment)).filter(Boolean)
    : [normalizedQuery];

  const matches = new Set<string>();

  ROYAL_SHIP_NAMES.forEach(shipName => {
    const normalizedShip = normalizeText(shipName);
    const matched = normalizedSegments.some(segment => {
      if (!segment) return false;
      return normalizedShip.includes(segment) || segment.includes(normalizedShip);
    });

    if (matched) {
      matches.add(shipName);
    }
  });

  if (matches.size === 0 && normalizedQuery) {
    ROYAL_SHIP_NAMES.forEach(shipName => {
      const normalizedShip = normalizeText(shipName);
      if (normalizedShip.includes(normalizedQuery) || normalizedQuery.includes(normalizedShip)) {
        matches.add(shipName);
      }
    });
  }

  const result = Array.from(matches);
  console.log('[CertificateExplorer] Ship targets resolved:', { shipQuery, result });
  return result;
}

function extractSailingsFromCertificatePdf(indexEntry: IndexEntry, pdfText: string): SailingEntry[] {
  const normalizedText = pdfText.replace(/®/g, '').replace(/\s+/g, ' ').trim();
  const sailings = new Map<string, SailingEntry>();

  ROYAL_SHIP_NAMES.forEach(shipName => {
    const shipRegex = new RegExp(escapeRegExp(shipName.replace(/®/g, '')), 'gi');

    for (const match of normalizedText.matchAll(shipRegex)) {
      const matchIndex = match.index ?? -1;
      if (matchIndex < 0) {
        continue;
      }

      const searchWindow = normalizedText.slice(matchIndex, matchIndex + 220);
      const dateMatch = searchWindow.match(DATE_TEXT_REGEX)?.[0];
      if (!dateMatch) {
        continue;
      }

      const sailDate = parseDateToIso(dateMatch);
      if (!sailDate) {
        continue;
      }

      const key = `${shipName}__${sailDate}`;
      if (sailings.has(key)) {
        continue;
      }

      sailings.set(key, {
        certificateCode: indexEntry.certificateCode,
        certificateType: indexEntry.certificateType,
        level: indexEntry.certificateCode.slice(4),
        points: indexEntry.points,
        shipName,
        sailDate,
        pdfUrl: indexEntry.pdfUrl,
        monthlyIndexUrl: indexEntry.monthlyIndexUrl,
      });
    }
  });

  const results = Array.from(sailings.values());
  console.log('[CertificateExplorer] Sailings extracted from certificate PDF:', {
    certificateCode: indexEntry.certificateCode,
    count: results.length,
  });
  return results;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const itemIndex = currentIndex;
      currentIndex += 1;
      results[itemIndex] = await mapper(items[itemIndex], itemIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export const certificateExplorerRouter = createTRPCRouter({
  examine: publicProcedure
    .input(
      z.object({
        monthCode: z.string().regex(MONTH_CODE_REGEX).optional(),
        shipQuery: z.string().min(2),
        sailDate: z.string().optional(),
        includeA: z.boolean().optional(),
        includeC: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const monthCode = input.monthCode ?? getDefaultMonthCode();
      const includeA = input.includeA ?? true;
      const includeC = input.includeC ?? true;
      const requestedSailDate = parseDateToIso(input.sailDate);
      const targetShips = resolveShipTargets(input.shipQuery);
      const certificateTypes = (['A', 'C'] as const).filter(type => (type === 'A' ? includeA : includeC));

      if (certificateTypes.length === 0) {
        throw new Error('Select at least one certificate source.');
      }

      const indexResults = await Promise.all(
        certificateTypes.map(async certificateType => {
          const monthlyIndexUrl = buildPdfUrl(`${monthCode}${certificateType}`);
          const pdfText = await fetchPdfText(monthlyIndexUrl);
          return extractIndexEntries(monthCode, certificateType, pdfText);
        })
      );

      const allIndexEntries = indexResults.flat();
      if (allIndexEntries.length === 0) {
        return {
          monthCode,
          filters: {
            shipQuery: input.shipQuery,
            sailDate: requestedSailDate,
            includeA,
            includeC,
            resolvedShips: targetShips,
          },
          summary: {
            indexCount: 0,
            searchedCertificateCount: 0,
            matchedSailingCount: 0,
            matchedCertificateCount: 0,
          },
          matches: [],
        };
      }

      const sailingResults = await mapWithConcurrency(allIndexEntries, 4, async (entry) => {
        try {
          const pdfText = await fetchPdfText(entry.pdfUrl);
          return extractSailingsFromCertificatePdf(entry, pdfText);
        } catch (error) {
          console.error('[CertificateExplorer] Failed to inspect certificate PDF:', {
            certificateCode: entry.certificateCode,
            error: error instanceof Error ? error.message : String(error),
          });
          return [] as SailingEntry[];
        }
      });

      const allSailings = sailingResults.flat();
      const normalizedShipTargets = targetShips.map(ship => normalizeText(ship));

      const filteredSailings = allSailings.filter(sailing => {
        const shipMatches = normalizedShipTargets.length === 0
          ? normalizeText(sailing.shipName).includes(normalizeText(input.shipQuery))
          : normalizedShipTargets.includes(normalizeText(sailing.shipName));
        const dateMatches = requestedSailDate ? sailing.sailDate === requestedSailDate : true;
        return shipMatches && dateMatches;
      });

      const groupedMatches = new Map<string, {
        shipName: string;
        sailDate: string;
        levels: Array<{
          certificateCode: string;
          certificateType: 'A' | 'C';
          level: string;
          points: number | null;
          pdfUrl: string;
          monthlyIndexUrl: string;
        }>;
      }>();

      filteredSailings.forEach(sailing => {
        const key = `${sailing.shipName}__${sailing.sailDate}`;
        if (!groupedMatches.has(key)) {
          groupedMatches.set(key, {
            shipName: sailing.shipName,
            sailDate: sailing.sailDate,
            levels: [],
          });
        }

        groupedMatches.get(key)?.levels.push({
          certificateCode: sailing.certificateCode,
          certificateType: sailing.certificateType,
          level: sailing.level,
          points: sailing.points,
          pdfUrl: sailing.pdfUrl,
          monthlyIndexUrl: sailing.monthlyIndexUrl,
        });
      });

      const matches = Array.from(groupedMatches.values())
        .map(match => ({
          ...match,
          levels: [...match.levels].sort((left, right) => {
            const leftPoints = left.points ?? Number.MAX_SAFE_INTEGER;
            const rightPoints = right.points ?? Number.MAX_SAFE_INTEGER;
            if (leftPoints !== rightPoints) {
              return rightPoints - leftPoints;
            }
            return left.certificateCode.localeCompare(right.certificateCode);
          }),
        }))
        .sort((left, right) => {
          if (left.shipName !== right.shipName) {
            return left.shipName.localeCompare(right.shipName);
          }
          return left.sailDate.localeCompare(right.sailDate);
        });

      const matchedCertificateCount = new Set(filteredSailings.map(item => item.certificateCode)).size;

      console.log('[CertificateExplorer] Examination complete:', {
        monthCode,
        indexCount: allIndexEntries.length,
        searchedCertificateCount: sailingResults.length,
        extractedSailings: allSailings.length,
        matchedSailingCount: matches.length,
        matchedCertificateCount,
      });

      return {
        monthCode,
        filters: {
          shipQuery: input.shipQuery,
          sailDate: requestedSailDate,
          includeA,
          includeC,
          resolvedShips: targetShips,
        },
        summary: {
          indexCount: allIndexEntries.length,
          searchedCertificateCount: sailingResults.length,
          matchedSailingCount: matches.length,
          matchedCertificateCount,
        },
        matches,
      };
    }),
});
