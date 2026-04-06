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

interface CertificateBenefitSnapshot {
  cabinLabel: string | null;
  cabinRank: number | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  benefitSummary: string[];
}

interface SailingEntry extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  shipName: string;
  sailDate: string;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface CertificateMatchLevel extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface CertificateOpportunity {
  fromCode: string;
  toCode: string;
  additionalPoints: number | null;
  summary: string;
}

interface SailingMatch {
  shipName: string;
  sailDate: string;
  levels: CertificateMatchLevel[];
  decisionGuide: string[];
  opportunities: CertificateOpportunity[];
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

interface CabinBenefitMatch {
  label: string;
  rank: number;
  index: number;
}

const CABIN_BENEFIT_PATTERNS: Array<{ label: string; rank: number; patterns: RegExp[] }> = [
  { label: 'Royal Suite', rank: 9, patterns: [/\broyal suite\b/i] },
  { label: 'Owner\'s Suite', rank: 8, patterns: [/\bowner'?s suite(?:\s*2br)?\b/i] },
  { label: 'Grand Suite', rank: 7, patterns: [/\bgrand suite(?:\s*2br)?\b/i] },
  { label: 'Junior Suite', rank: 6, patterns: [/\bjunior suite\b/i, /\bjr\.?\s*suite\b/i] },
  { label: 'Suite', rank: 5, patterns: [/\bsuite\b/i] },
  { label: 'Balcony', rank: 4, patterns: [/\bbalcony\b/i, /\bveranda\b/i, /\bocean view balcony\b/i] },
  { label: 'Oceanview', rank: 3, patterns: [/\bocean\s*view\b/i, /\boceanview\b/i, /\boutside stateroom\b/i] },
  { label: 'Interior', rank: 2, patterns: [/\binterior\b/i, /\binside stateroom\b/i] },
];

function extractDollarValues(text: string, patterns: RegExp[]): number[] {
  const values: number[] = [];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const rawValue = match[1] ?? '';
      const parsedValue = parseInt(rawValue.replace(/,/g, ''), 10);
      if (Number.isFinite(parsedValue)) {
        values.push(parsedValue);
      }
    }
  });

  return values;
}

function extractCabinBenefit(text: string): { cabinLabel: string | null; cabinRank: number | null } {
  const searchText = text.slice(0, 5000);
  let bestMatch: CabinBenefitMatch | null = null;

  for (const cabin of CABIN_BENEFIT_PATTERNS) {
    for (const pattern of cabin.patterns) {
      const matchIndex = searchText.search(pattern);
      if (matchIndex < 0) {
        continue;
      }

      if (
        bestMatch === null ||
        matchIndex < bestMatch.index ||
        (matchIndex === bestMatch.index && cabin.rank > bestMatch.rank)
      ) {
        bestMatch = {
          label: cabin.label,
          rank: cabin.rank,
          index: matchIndex,
        };
      }
    }
  }

  if (bestMatch === null) {
    return {
      cabinLabel: null,
      cabinRank: null,
    };
  }

  return {
    cabinLabel: bestMatch.label,
    cabinRank: bestMatch.rank,
  };
}

function extractCertificateBenefits(pdfText: string): CertificateBenefitSnapshot {
  const normalizedText = pdfText.replace(/®/g, ' ').replace(/\s+/g, ' ').trim();
  const { cabinLabel, cabinRank } = extractCabinBenefit(normalizedText);

  const freePlayValues = extractDollarValues(normalizedText, [
    /\$\s*([0-9][0-9,]*)\s*(?:in\s*)?(?:free\s*play|freeplay|fp)\b/gi,
    /(?:free\s*play|freeplay|fp)\s*(?:of|included|:|up to)?\s*\$?\s*([0-9][0-9,]*)\b/gi,
  ]);

  const onBoardCreditValues = extractDollarValues(normalizedText, [
    /\$\s*([0-9][0-9,]*)\s*(?:in\s*)?(?:obc|on[-\s]*board credit|onboard credit)\b/gi,
    /(?:obc|on[-\s]*board credit|onboard credit)\s*(?:of|included|:)?\s*\$?\s*([0-9][0-9,]*)\b/gi,
  ]);

  const freePlay = freePlayValues.length > 0 ? Math.max(...freePlayValues) : null;
  const onBoardCredit = onBoardCreditValues.length > 0 ? Math.max(...onBoardCreditValues) : null;

  const benefitSummary: string[] = [];
  if (cabinLabel) {
    benefitSummary.push(cabinLabel);
  }
  if (freePlay !== null) {
    benefitSummary.push(`${freePlay.toLocaleString()} free play`);
  }
  if (onBoardCredit !== null) {
    benefitSummary.push(`${onBoardCredit.toLocaleString()} OBC`);
  }

  console.log('[CertificateExplorer] Parsed certificate benefits:', {
    cabinLabel,
    cabinRank,
    freePlay,
    onBoardCredit,
    benefitSummary,
  });

  return {
    cabinLabel,
    cabinRank,
    freePlay,
    onBoardCredit,
    benefitSummary,
  };
}

function formatPointsLabel(points: number | null): string {
  if (points === null) {
    return 'unknown points';
  }

  return `${points.toLocaleString()} points`;
}

function describeVisibleBenefits(level: CertificateMatchLevel): string {
  if (level.benefitSummary.length > 0) {
    return level.benefitSummary.join(' + ');
  }

  return 'visible benefits still parsing';
}

function hasVisibleUpgrade(fromLevel: CertificateMatchLevel, toLevel: CertificateMatchLevel): boolean {
  const cabinUpgrade = (toLevel.cabinRank ?? 0) > (fromLevel.cabinRank ?? 0);
  const freePlayUpgrade = (toLevel.freePlay ?? 0) > (fromLevel.freePlay ?? 0);
  const obcUpgrade = (toLevel.onBoardCredit ?? 0) > (fromLevel.onBoardCredit ?? 0);
  return cabinUpgrade || freePlayUpgrade || obcUpgrade;
}

function buildOpportunity(fromLevel: CertificateMatchLevel, toLevel: CertificateMatchLevel): CertificateOpportunity {
  const improvements: string[] = [];
  const additionalPoints =
    fromLevel.points !== null && toLevel.points !== null
      ? Math.max(0, toLevel.points - fromLevel.points)
      : null;

  if ((toLevel.cabinRank ?? 0) > (fromLevel.cabinRank ?? 0) && toLevel.cabinLabel) {
    if (fromLevel.cabinLabel) {
      improvements.push(`upgrades the room from ${fromLevel.cabinLabel} to ${toLevel.cabinLabel}`);
    } else {
      improvements.push(`unlocks a ${toLevel.cabinLabel} room`);
    }
  }

  const freePlayDelta = (toLevel.freePlay ?? 0) - (fromLevel.freePlay ?? 0);
  if (freePlayDelta > 0) {
    improvements.push(`adds ${freePlayDelta.toLocaleString()} free play`);
  }

  const obcDelta = (toLevel.onBoardCredit ?? 0) - (fromLevel.onBoardCredit ?? 0);
  if (obcDelta > 0) {
    improvements.push(`adds ${obcDelta.toLocaleString()} OBC`);
  }

  const summary = improvements.length > 0
    ? `${additionalPoints !== null ? `+${additionalPoints.toLocaleString()} pts` : 'Higher level'} ${toLevel.certificateCode} ${improvements.join(' and ')}.`
    : `${additionalPoints !== null ? `+${additionalPoints.toLocaleString()} pts` : 'Higher level'} ${toLevel.certificateCode} shows the same visible benefits.`;

  return {
    fromCode: fromLevel.certificateCode,
    toCode: toLevel.certificateCode,
    additionalPoints,
    summary,
  };
}

function buildDecisionGuide(levels: CertificateMatchLevel[]): string[] {
  if (levels.length === 0) {
    return [];
  }

  const baseline = levels[0];
  const guide: string[] = [
    `If you settle for ${formatPointsLabel(baseline.points)} with ${baseline.certificateCode}, you get ${describeVisibleBenefits(baseline)}.`,
  ];

  const upgradeCandidate = levels.slice(1).find((level) => hasVisibleUpgrade(baseline, level)) ?? levels[1];

  if (upgradeCandidate) {
    const additionalPoints =
      baseline.points !== null && upgradeCandidate.points !== null
        ? Math.max(0, upgradeCandidate.points - baseline.points)
        : null;
    const improvements: string[] = [];

    if ((upgradeCandidate.cabinRank ?? 0) > (baseline.cabinRank ?? 0) && upgradeCandidate.cabinLabel) {
      if (baseline.cabinLabel) {
        improvements.push(`upgrade to ${upgradeCandidate.cabinLabel}`);
      } else {
        improvements.push(`unlock ${upgradeCandidate.cabinLabel}`);
      }
    }

    const freePlayDelta = (upgradeCandidate.freePlay ?? 0) - (baseline.freePlay ?? 0);
    if (freePlayDelta > 0) {
      improvements.push(`add ${freePlayDelta.toLocaleString()} free play`);
    }

    const obcDelta = (upgradeCandidate.onBoardCredit ?? 0) - (baseline.onBoardCredit ?? 0);
    if (obcDelta > 0) {
      improvements.push(`add ${obcDelta.toLocaleString()} OBC`);
    }

    if (improvements.length > 0) {
      guide.push(
        `If you push to ${formatPointsLabel(upgradeCandidate.points)} with ${upgradeCandidate.certificateCode}, ${additionalPoints !== null ? `${additionalPoints.toLocaleString()} more points lets you ` : 'the higher level lets you '}${improvements.join(' and ')}.`
      );
    }
  }

  return guide;
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
  const benefits = extractCertificateBenefits(normalizedText);
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
        cabinLabel: benefits.cabinLabel,
        cabinRank: benefits.cabinRank,
        freePlay: benefits.freePlay,
        onBoardCredit: benefits.onBoardCredit,
        benefitSummary: benefits.benefitSummary,
      });
    }
  });

  const results = Array.from(sailings.values());
  console.log('[CertificateExplorer] Sailings extracted from certificate PDF:', {
    certificateCode: indexEntry.certificateCode,
    count: results.length,
    benefits: benefits.benefitSummary,
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

      const groupedMatches = new Map<string, SailingMatch>();

      filteredSailings.forEach(sailing => {
        const key = `${sailing.shipName}__${sailing.sailDate}`;
        if (!groupedMatches.has(key)) {
          groupedMatches.set(key, {
            shipName: sailing.shipName,
            sailDate: sailing.sailDate,
            levels: [],
            decisionGuide: [],
            opportunities: [],
          });
        }

        groupedMatches.get(key)?.levels.push({
          certificateCode: sailing.certificateCode,
          certificateType: sailing.certificateType,
          level: sailing.level,
          points: sailing.points,
          pdfUrl: sailing.pdfUrl,
          monthlyIndexUrl: sailing.monthlyIndexUrl,
          cabinLabel: sailing.cabinLabel,
          cabinRank: sailing.cabinRank,
          freePlay: sailing.freePlay,
          onBoardCredit: sailing.onBoardCredit,
          benefitSummary: sailing.benefitSummary,
        });
      });

      const matches = Array.from(groupedMatches.values())
        .map((match) => {
          const levels = [...match.levels].sort((left, right) => {
            const leftPoints = left.points ?? Number.MAX_SAFE_INTEGER;
            const rightPoints = right.points ?? Number.MAX_SAFE_INTEGER;
            if (leftPoints !== rightPoints) {
              return leftPoints - rightPoints;
            }
            return left.certificateCode.localeCompare(right.certificateCode);
          });

          const opportunities = levels.slice(1).map((level, index) => buildOpportunity(levels[index], level));

          return {
            ...match,
            levels,
            opportunities,
            decisionGuide: buildDecisionGuide(levels),
          };
        })
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
