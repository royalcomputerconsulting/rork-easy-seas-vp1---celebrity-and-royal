import * as z from 'zod';
import pako from 'pako';
import { createTRPCRouter, publicProcedure } from '../create-context';

const CERTIFICATE_PDF_BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
const MONTH_CODE_REGEX = /^\d{4}$/;
const DATE_TEXT_REGEX = /(?<![a-zA-Z])(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/gi;

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
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface CertificateMatchLevel extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: 'A' | 'C';
  level: string;
  points: number | null;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface StructuredCertificateRow {
  shipName: string;
  sailDate: string;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  benefits: CertificateBenefitSnapshot;
}

interface CertificateOpportunity {
  fromCode: string;
  toCode: string;
  additionalPoints: number | null;
  summary: string;
}

interface PdfScanLogEntry {
  certificateCode: string;
  status: 'ok' | 'empty' | 'error' | 'no_sailings';
  textLength: number;
  sailingsFound: number;
  errorMessage: string | null;
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

interface TextMatch {
  label: string;
  index: number;
  raw: string;
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

const OFFER_TYPE_PATTERNS: RegExp[] = [
  /cruise fare for 2 guests/gi,
  /cruise fare for 1 guest/gi,
  /cruise fare for 2 guest/gi,
  /cruise fare for 1 guests/gi,
  /cruise fare/gi,
];

const BONUS_TEXT_PATTERNS: RegExp[] = [
  /\$\s*[0-9][0-9,]*\s*(?:free\s*play|freeplay|fp|obc|on[-\s]*board credit|onboard credit)\b/gi,
  /(?:free\s*play|freeplay|fp|obc|on[-\s]*board credit|onboard credit)\s*\$\s*[0-9][0-9,]*\b/gi,
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

function findCabinBenefitMatch(text: string): CabinBenefitMatch | null {
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

  return bestMatch;
}

function extractCabinBenefit(text: string): { cabinLabel: string | null; cabinRank: number | null } {
  const bestMatch = findCabinBenefitMatch(text);

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

function cleanStructuredValue(value?: string | null): string | null {
  const cleaned = String(value ?? '')
    .replace(/\bOffer Code\b/gi, ' ')
    .replace(/\bShip\b/gi, ' ')
    .replace(/\bDeparture Port\b/gi, ' ')
    .replace(/\bSail Date\b/gi, ' ')
    .replace(/\bItinerary\b/gi, ' ')
    .replace(/\bStateroom Type\b/gi, ' ')
    .replace(/\bOffer Type\b/gi, ' ')
    .replace(/\bNext Cruise Bonus\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, '')
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function findFirstTextMatch(text: string, patterns: RegExp[]): TextMatch | null {
  let bestMatch: TextMatch | null = null;

  patterns.forEach((pattern) => {
    const flags = pattern.flags.replace(/g/g, '');
    const matcher = new RegExp(pattern.source, flags);
    const match = matcher.exec(text);
    const index = match?.index ?? -1;

    if (index < 0 || !match?.[0]) {
      return;
    }

    if (bestMatch === null || index < bestMatch.index) {
      bestMatch = {
        label: cleanStructuredValue(match[0]) ?? match[0],
        index,
        raw: match[0],
      };
    }
  });

  return bestMatch;
}

function findLastTextMatch(text: string, patterns: RegExp[]): TextMatch | null {
  let bestMatch: TextMatch | null = null;

  patterns.forEach((pattern) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const matcher = new RegExp(pattern.source, flags);

    for (const match of text.matchAll(matcher)) {
      const index = match.index ?? -1;
      if (index < 0 || !match[0]) {
        continue;
      }

      if (bestMatch === null || index > bestMatch.index) {
        bestMatch = {
          label: cleanStructuredValue(match[0]) ?? match[0],
          index,
          raw: match[0],
        };
      }
    }
  });

  return bestMatch;
}

function findShipOccurrence(text: string): { shipName: string; start: number; end: number } | null {
  let bestMatch: { shipName: string; start: number; end: number } | null = null;

  ROYAL_SHIP_NAMES.forEach((shipName) => {
    const normalizedShipName = shipName.replace(/®/g, '');
    const matcher = new RegExp(escapeRegExp(normalizedShipName), 'i');
    const match = matcher.exec(text);
    const start = match?.index ?? -1;

    if (start < 0) {
      return;
    }

    const end = start + normalizedShipName.length;
    if (bestMatch === null || start < bestMatch.start) {
      bestMatch = { shipName, start, end };
    }
  });

  return bestMatch;
}

function extractStructuredBenefitSnapshot(segment: string, nextCruiseBonusLabel: string | null): CertificateBenefitSnapshot {
  const normalizedBonusText = cleanStructuredValue(nextCruiseBonusLabel) ?? '';
  const { cabinLabel, cabinRank } = extractCabinBenefit(segment);

  const freePlayValues = extractDollarValues(normalizedBonusText, [
    /\$\s*([0-9][0-9,]*)\s*(?:in\s*)?(?:free\s*play|freeplay|fp)\b/gi,
    /(?:free\s*play|freeplay|fp)\s*(?:of|included|:)?\s*\$?\s*([0-9][0-9,]*)\b/gi,
  ]);

  const onBoardCreditValues = extractDollarValues(normalizedBonusText, [
    /\$\s*([0-9][0-9,]*)\s*(?:in\s*)?(?:obc|on[-\s]*board credit|onboard credit)\b/gi,
    /(?:obc|on[-\s]*board credit|onboard credit)\s*(?:of|included|:)?\s*\$?\s*([0-9][0-9,]*)\b/gi,
  ]);

  const freePlay = freePlayValues.length > 0 ? Math.max(...freePlayValues) : null;
  const onBoardCredit = onBoardCreditValues.length > 0 ? Math.max(...onBoardCreditValues) : null;
  const benefitSummary: string[] = [];

  if (cabinLabel) {
    benefitSummary.push(cabinLabel);
  }
  if (normalizedBonusText) {
    benefitSummary.push(normalizedBonusText);
  }

  return {
    cabinLabel,
    cabinRank,
    freePlay,
    onBoardCredit,
    benefitSummary,
  };
}

function splitStructuredRowSegments(indexEntry: IndexEntry, pdfText: string): string[] {
  const normalizedText = pdfText.replace(/®/g, '').replace(/\s+/g, ' ').trim();
  const startRegex = new RegExp(`(?=${escapeRegExp(indexEntry.certificateCode)}\\b)`, 'g');
  const starts = Array.from(normalizedText.matchAll(startRegex))
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);

  if (starts.length === 0) {
    return [];
  }

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? normalizedText.length;
    return normalizedText.slice(start, end).trim();
  }).filter(Boolean);
}

function parseStructuredCertificateRow(segment: string): StructuredCertificateRow | null {
  const cleanedSegment = cleanStructuredValue(segment);
  if (!cleanedSegment) {
    return null;
  }

  const shipMatch = findShipOccurrence(cleanedSegment);
  if (!shipMatch) {
    return null;
  }

  const dateMatch = Array.from(cleanedSegment.matchAll(DATE_TEXT_REGEX)).find((match) => {
    const index = match.index ?? -1;
    return index >= shipMatch.end;
  });
  const dateText = dateMatch?.[0] ?? null;
  const dateIndex = dateMatch?.index ?? -1;

  if (!dateText || dateIndex < 0) {
    return null;
  }

  const sailDate = parseDateToIso(dateText);
  if (!sailDate) {
    return null;
  }

  const departurePort = cleanStructuredValue(cleanedSegment.slice(shipMatch.end, dateIndex));
  const tailText = cleanStructuredValue(cleanedSegment.slice(dateIndex + dateText.length)) ?? '';

  const cabinMatch = findCabinBenefitMatch(tailText);
  const offerTypeMatch = findFirstTextMatch(tailText, OFFER_TYPE_PATTERNS);
  const bonusMatch = findLastTextMatch(tailText, BONUS_TEXT_PATTERNS);
  const itineraryBoundaryCandidates = [cabinMatch?.index, offerTypeMatch?.index, bonusMatch?.index]
    .filter((value): value is number => typeof value === 'number' && value >= 0);
  const itineraryBoundary = itineraryBoundaryCandidates.length > 0 ? Math.min(...itineraryBoundaryCandidates) : tailText.length;
  const itinerary = cleanStructuredValue(tailText.slice(0, itineraryBoundary));
  const offerTypeLabel = cleanStructuredValue(offerTypeMatch?.label);
  const nextCruiseBonusLabel = cleanStructuredValue(bonusMatch?.label);
  const benefits = extractStructuredBenefitSnapshot(tailText, nextCruiseBonusLabel);

  console.log('[CertificateExplorer] Parsed structured certificate row:', {
    shipName: shipMatch.shipName,
    sailDate,
    departurePort,
    itinerary,
    offerTypeLabel,
    nextCruiseBonusLabel,
    benefits: benefits.benefitSummary,
  });

  return {
    shipName: shipMatch.shipName,
    sailDate,
    departurePort,
    itinerary,
    offerTypeLabel,
    nextCruiseBonusLabel,
    benefits,
  };
}

function extractStructuredRowsFromCertificatePdf(indexEntry: IndexEntry, pdfText: string): StructuredCertificateRow[] {
  const rowSegments = splitStructuredRowSegments(indexEntry, pdfText);
  const rowMap = new Map<string, StructuredCertificateRow>();

  rowSegments.forEach((segment) => {
    const parsedRow = parseStructuredCertificateRow(segment);
    if (!parsedRow) {
      return;
    }

    const key = `${parsedRow.shipName}__${parsedRow.sailDate}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, parsedRow);
    }
  });

  const rows = Array.from(rowMap.values());
  console.log('[CertificateExplorer] Structured rows extracted from certificate PDF:', {
    certificateCode: indexEntry.certificateCode,
    rowCount: rows.length,
  });
  return rows;
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

function readLiteralStringAt(text: string, startPos: number): { str: string; endPos: number } {
  let raw = '';
  let depth = 1;
  let escaping = false;
  let pos = startPos;

  while (pos < text.length && depth > 0) {
    const ch = text[pos];
    if (escaping) {
      raw += '\\' + ch;
      escaping = false;
      pos += 1;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      pos += 1;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      raw += ch;
      pos += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth > 0) raw += ch;
      pos += 1;
      continue;
    }
    raw += ch;
    pos += 1;
  }

  return { str: decodePdfLiteralString(raw), endPos: pos };
}

function readHexStringAt(text: string, startPos: number): { str: string; endPos: number } {
  let hex = '';
  let pos = startPos;

  while (pos < text.length && text[pos] !== '>') {
    hex += text[pos];
    pos += 1;
  }
  pos += 1;

  hex = hex.replace(/\s/g, '');
  let decoded = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (!Number.isNaN(byte) && byte > 0) {
      decoded += String.fromCharCode(byte);
    }
  }

  return { str: decoded, endPos: pos };
}

const TJ_WORD_SPACE_THRESHOLD = 120;

function parseTJArrayAt(text: string, startPos: number): { str: string; endPos: number } {
  let pos = startPos;
  let wordBuf = '';
  const words: string[] = [];

  while (pos < text.length && text[pos] !== ']') {
    while (pos < text.length && /\s/.test(text[pos])) pos += 1;
    if (pos >= text.length || text[pos] === ']') break;

    if (text[pos] === '(') {
      pos += 1;
      const r = readLiteralStringAt(text, pos);
      wordBuf += r.str;
      pos = r.endPos;
    } else if (text[pos] === '<') {
      pos += 1;
      const r = readHexStringAt(text, pos);
      wordBuf += r.str;
      pos = r.endPos;
    } else if (/[-\d.]/.test(text[pos])) {
      let numStr = '';
      while (pos < text.length && /[-\d.]/.test(text[pos])) {
        numStr += text[pos];
        pos += 1;
      }
      const num = parseFloat(numStr);
      if (!Number.isNaN(num) && Math.abs(num) > TJ_WORD_SPACE_THRESHOLD) {
        if (wordBuf) {
          words.push(wordBuf);
          wordBuf = '';
        }
      }
    } else {
      pos += 1;
    }
  }

  if (wordBuf) words.push(wordBuf);
  if (pos < text.length && text[pos] === ']') pos += 1;

  return { str: words.join(' '), endPos: pos };
}

function extractTextFromContentStream(streamText: string): string {
  const segments: string[] = [];
  let pos = 0;

  while (pos < streamText.length) {
    while (pos < streamText.length && /\s/.test(streamText[pos])) pos += 1;
    if (pos >= streamText.length) break;

    if (streamText[pos] === '[') {
      const savedPos = pos;
      pos += 1;
      const r = parseTJArrayAt(streamText, pos);
      pos = r.endPos;

      while (pos < streamText.length && /\s/.test(streamText[pos])) pos += 1;
      if (streamText.slice(pos, pos + 2) === 'TJ') {
        pos += 2;
        if (r.str.trim()) segments.push(r.str.trim());
        continue;
      }
      pos = savedPos + 1;
      continue;
    }

    if (streamText[pos] === '(') {
      const savedPos = pos;
      pos += 1;
      const r = readLiteralStringAt(streamText, pos);
      pos = r.endPos;

      while (pos < streamText.length && /\s/.test(streamText[pos])) pos += 1;
      if (streamText.slice(pos, pos + 2) === 'Tj') {
        pos += 2;
        if (r.str.trim()) segments.push(r.str.trim());
        continue;
      }
      pos = savedPos + 1;
      continue;
    }

    pos += 1;
  }

  return segments.join(' ');
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

function uint8ToLatin1(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function stringToUint8(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

function extractPdfText(pdfBytes: Uint8Array): string {
  const raw = uint8ToLatin1(pdfBytes);
  const streamRegex = /(<<[\s\S]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const extracted: string[] = [];

  for (const match of raw.matchAll(streamRegex)) {
    const dictionary = match[1] ?? '';
    const streamBinary = stringToUint8(match[2] ?? '');
    let decodedStream: string | null = null;

    if (dictionary.includes('/FlateDecode')) {
      try {
        const inflated = pako.inflate(streamBinary);
        decodedStream = uint8ToLatin1(inflated);
      } catch {
        try {
          const inflatedRaw = pako.inflateRaw(streamBinary);
          decodedStream = uint8ToLatin1(inflatedRaw);
        } catch {
          decodedStream = null;
        }
      }
    } else {
      decodedStream = uint8ToLatin1(streamBinary);
    }

    if (!decodedStream) {
      continue;
    }

    const text = extractTextFromContentStream(decodedStream);
    if (text.trim()) {
      extracted.push(text.trim());
    }
  }

  return sanitizePdfText(extracted.join(' '))
    .replace(/\s+/g, ' ')
    .trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitteredDelay(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs * 0.5);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

const MAX_RETRIES = 5;
const FETCH_TIMEOUT_MS = 25000;
const BASE_RETRY_DELAY_MS = 1500;

async function fetchPdfText(url: string, retries = MAX_RETRIES): Promise<string> {
  console.log('[CertificateExplorer] Fetching PDF:', url);

  const HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,application/octet-stream,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.royalcaribbean.com/',
    'Origin': 'https://www.royalcaribbean.com',
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (attempt > 0) {
      const delay = jitteredDelay(BASE_RETRY_DELAY_MS * attempt);
      console.log(`[CertificateExplorer] Retry ${attempt}/${retries - 1} after ${delay}ms for ${url}`);
      await sleep(delay);
    }

    try {
      const response = await fetchWithTimeout(url, { headers: HEADERS }, FETCH_TIMEOUT_MS);

      if (response.status === 503 || response.status === 429) {
        lastError = new Error(`Server returned ${response.status} for ${url}`);
        console.warn('[CertificateExplorer] Retryable status:', { status: response.status, url, attempt });
        continue;
      }

      if (response.status === 403) {
        lastError = new Error(`Blocked by CDN (403) for ${url}`);
        console.warn('[CertificateExplorer] CDN blocked (403), retrying:', { url, attempt });
        continue;
      }

      if (response.status === 404) {
        console.log('[CertificateExplorer] PDF not found (404):', url);
        return '';
      }

      if (response.status >= 500) {
        lastError = new Error(`Server error ${response.status} for ${url}`);
        console.warn('[CertificateExplorer] Server error, retrying:', { status: response.status, url, attempt });
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`Request failed with ${response.status} for ${url}`);
        console.warn('[CertificateExplorer] Non-OK response:', { status: response.status, url, attempt });
        continue;
      }

      const pdfBytes = new Uint8Array(await response.arrayBuffer());
      if (pdfBytes.length === 0) {
        console.warn('[CertificateExplorer] Empty response body for:', url);
        lastError = new Error(`Empty response body for ${url}`);
        continue;
      }

      console.log('[CertificateExplorer] PDF downloaded:', { url, bytes: pdfBytes.length });
      return extractPdfText(pdfBytes);
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const isNetworkError = error instanceof TypeError && (
        error.message.includes('fetch') ||
        error.message.includes('Failed') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')
      );
      const isRetryableError = error instanceof Error && (
        error.message.includes('503') ||
        error.message.includes('429') ||
        error.message.includes('fetch') ||
        error.message.includes('Failed') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('socket')
      );

      if (isAbort || isNetworkError || isRetryableError) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CertificateExplorer] ${isAbort ? 'Timeout' : 'Network error'} on attempt ${attempt}:`, lastError.message);
        continue;
      }

      console.error('[CertificateExplorer] Non-retryable error:', error);
      return '';
    }
  }

  console.error(`[CertificateExplorer] All ${retries} attempts exhausted for ${url}:`, lastError?.message);
  return '';
}

const KNOWN_CERTIFICATE_SUFFIXES = [
  'VIP2',
  '01',
  '02',
  '02A',
  '03',
  '03A',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
];

function buildKnownIndexEntries(monthCode: string, certificateType: 'A' | 'C'): IndexEntry[] {
  const monthlyIndexUrl = buildPdfUrl(`${monthCode}${certificateType}`);
  const entries: IndexEntry[] = KNOWN_CERTIFICATE_SUFFIXES.map(suffix => {
    const certificateCode = `${monthCode}${certificateType}${suffix}`.toUpperCase();
    return {
      certificateCode,
      certificateType,
      points: null,
      pdfUrl: buildPdfUrl(certificateCode),
      monthlyIndexUrl,
    };
  });

  console.log('[CertificateExplorer] Built known index entries:', {
    monthCode,
    certificateType,
    count: entries.length,
    codes: entries.map(e => e.certificateCode),
  });
  return entries;
}

function extractPointsFromPdfText(certificateCode: string, pdfText: string): number | null {
  const normalizedText = pdfText.replace(/®/g, ' ').replace(/\s+/g, ' ').trim();
  const pointsPatterns = [
    new RegExp(`${escapeRegExp(certificateCode)}\\s*(?:[–—\\-]\\s*)?([\\d,]+)\\s*points`, 'i'),
    new RegExp(`${escapeRegExp(certificateCode)}\\s*(?:[–—\\-]\\s*)?\\$\\s*([\\d,]+)`, 'i'),
    new RegExp(`\\$\\s*([\\d,]+)\\s*(?:[–—\\-]\\s*)?${escapeRegExp(certificateCode)}`, 'i'),
  ];

  for (const pattern of pointsPatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const pts = parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(pts)) return pts;
    }
  }

  return null;
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
  const structuredRows = extractStructuredRowsFromCertificatePdf(indexEntry, normalizedText);

  if (structuredRows.length > 0) {
    return structuredRows.map((row) => ({
      certificateCode: indexEntry.certificateCode,
      certificateType: indexEntry.certificateType,
      level: indexEntry.certificateCode.slice(4),
      points: indexEntry.points,
      shipName: row.shipName,
      sailDate: row.sailDate,
      departurePort: row.departurePort,
      itinerary: row.itinerary,
      offerTypeLabel: row.offerTypeLabel,
      nextCruiseBonusLabel: row.nextCruiseBonusLabel,
      pdfUrl: indexEntry.pdfUrl,
      monthlyIndexUrl: indexEntry.monthlyIndexUrl,
      cabinLabel: row.benefits.cabinLabel,
      cabinRank: row.benefits.cabinRank,
      freePlay: row.benefits.freePlay,
      onBoardCredit: row.benefits.onBoardCredit,
      benefitSummary: row.benefits.benefitSummary,
    }));
  }

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
        departurePort: null,
        itinerary: null,
        offerTypeLabel: null,
        nextCruiseBonusLabel: null,
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
    usedStructuredRows: false,
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

      const allIndexEntries = certificateTypes.flatMap(certificateType =>
        buildKnownIndexEntries(monthCode, certificateType)
      );

      console.log('[CertificateExplorer] Using known certificate codes:', {
        monthCode,
        types: certificateTypes,
        totalEntries: allIndexEntries.length,
      });

      const pdfScanLog: PdfScanLogEntry[] = [];

      const sailingResults = await mapWithConcurrency<IndexEntry, SailingEntry[]>(allIndexEntries, 2, async (entry, entryIndex) => {
        if (entryIndex > 0 && entryIndex % 4 === 0) {
          await sleep(jitteredDelay(800));
        }
        try {
          const pdfText = await fetchPdfText(entry.pdfUrl);

          if (!pdfText || pdfText.length < 20) {
            console.log('[CertificateExplorer] PDF not available or empty (skipping):', {
              certificateCode: entry.certificateCode,
              textLength: pdfText.length,
            });
            pdfScanLog.push({
              certificateCode: entry.certificateCode,
              status: 'empty',
              textLength: pdfText.length,
              sailingsFound: 0,
              errorMessage: pdfText.length === 0 ? 'PDF not found for this code (404 or unavailable)' : 'PDF text too short to contain sailings',
            });
            return [] as SailingEntry[];
          }

          const detectedPoints = extractPointsFromPdfText(entry.certificateCode, pdfText);
          if (detectedPoints !== null) {
            entry.points = detectedPoints;
          }

          const sailings = extractSailingsFromCertificatePdf(entry, pdfText);
          pdfScanLog.push({
            certificateCode: entry.certificateCode,
            status: sailings.length > 0 ? 'ok' : 'no_sailings',
            textLength: pdfText.length,
            sailingsFound: sailings.length,
            errorMessage: sailings.length === 0 ? 'Text extracted but no ship+date pairs found' : null,
          });
          return sailings;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[CertificateExplorer] Failed to inspect certificate PDF:', {
            certificateCode: entry.certificateCode,
            error: errorMsg,
          });
          pdfScanLog.push({
            certificateCode: entry.certificateCode,
            status: 'error',
            textLength: 0,
            sailingsFound: 0,
            errorMessage: errorMsg,
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
          departurePort: sailing.departurePort,
          itinerary: sailing.itinerary,
          offerTypeLabel: sailing.offerTypeLabel,
          nextCruiseBonusLabel: sailing.nextCruiseBonusLabel,
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

      const errorCount = pdfScanLog.filter(e => e.status === 'error').length;
      const emptyCount = pdfScanLog.filter(e => e.status === 'empty').length;
      const noSailingsCount = pdfScanLog.filter(e => e.status === 'no_sailings').length;
      const okCount = pdfScanLog.filter(e => e.status === 'ok').length;

      console.log('[CertificateExplorer] PDF scan summary:', {
        ok: okCount,
        noSailings: noSailingsCount,
        empty: emptyCount,
        errors: errorCount,
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
        pdfScanLog,
        matches,
      };
    }),
});
