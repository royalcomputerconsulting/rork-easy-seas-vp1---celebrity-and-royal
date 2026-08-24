/**
 * Direct, on-device certificate PDF fetch + parse engine.
 *
 * Certificate PDFs are public Royal Caribbean resources, so the app fetches,
 * parses, and stores them directly without an Easy Seas backend dependency.
 *
 * Native (iOS/Android) has no CORS restriction, so this works exactly like
 * a normal app request. On web, royalcaribbean.com may not send permissive
 * CORS headers for a cross-origin fetch; if that happens the fetch below
 * throws and the caller reports the failure like any other network error.
 */
import { archiveCertificatePdfBytes, type CertificateDocumentEvidence, type CertificatePdfArchiveInput } from '@/lib/certificates/certificateDocumentStore';
import { extractCertificatePdfText, parseCertificateExtractedTextOnDevice } from '@/lib/certificates/certificatePdfPipeline';
import type { CertificateParseResult } from '@/lib/certificates/certificatePdfPipeline';
import { downloadPublicCertificatePdf, type DownloadedCertificatePdf } from '@/lib/certificates/certificatePdfPipeline';
import {
  parseCertificateSailingsFromText,
  groupCertificateSailings,
  parseCertificateCode,
  getCertificateFamilyFromCode as coreGetCertificateFamilyFromCode,
  getCertificateLevelCode as coreGetCertificateLevelCode,
  getDefaultPointsForCertificate as coreGetDefaultPointsForCertificate,
  extractExplicitPointsForCode,
  buildCertificateVariantId,
  type CertificateFamily,
  type ParsedCertificateSailing,
} from '@/lib/certificates/certificatePdfParserCore';

export const CLIENT_CERTIFICATE_PDF_ENGINE_VERSION = 'v2.4.0-hermes-explicit-date-dual-row-parser-completeness-authority';

const CERTIFICATE_PDF_BASE_URL = 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers';
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
  certificateType: CertificateFamily;
  points: number | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
  pointsSource?: 'pdf-explicit' | 'known-level-fallback' | 'missing';
  variantId?: string;
}


interface CertificateBenefitSnapshot {
  cabinLabel: string | null;
  cabinRank: number | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  guestCount: number | null;
  benefitSummary: string[];
  benefitEvidence?: string[];
}

interface SailingEntry extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: CertificateFamily;
  level: string;
  points: number | null;
  shipName: string;
  sailDate: string;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  variantId?: string;
  pointsSource?: 'pdf-explicit' | 'known-level-fallback' | 'missing';
  nextCruiseBonusLabel: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

interface CertificateMatchLevel extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: CertificateFamily;
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

interface SailingMatch {
  shipName: string;
  sailDate: string;
  levels: CertificateMatchLevel[];
  decisionGuide: string[];
  opportunities: CertificateOpportunity[];
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
      if (matchIndex < 0) continue;
      if (
        bestMatch === null ||
        matchIndex < bestMatch.index ||
        (matchIndex === bestMatch.index && cabin.rank > bestMatch.rank)
      ) {
        bestMatch = { label: cabin.label, rank: cabin.rank, index: matchIndex };
      }
    }
  }
  return bestMatch;
}

function extractCabinBenefit(text: string): { cabinLabel: string | null; cabinRank: number | null } {
  const bestMatch = findCabinBenefitMatch(text);
  if (bestMatch === null) return { cabinLabel: null, cabinRank: null };
  return { cabinLabel: bestMatch.label, cabinRank: bestMatch.rank };
}

function formatPointsLabel(points: number | null): string {
  if (points === null) return 'unknown points';
  return `${points.toLocaleString()} points`;
}

function describeVisibleBenefits(level: CertificateMatchLevel): string {
  if (level.benefitSummary.length > 0) return level.benefitSummary.join(' + ');
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
    improvements.push(
      fromLevel.cabinLabel
        ? `upgrades the room from ${fromLevel.cabinLabel} to ${toLevel.cabinLabel}`
        : `unlocks a ${toLevel.cabinLabel} room`
    );
  }

  const freePlayDelta = (toLevel.freePlay ?? 0) - (fromLevel.freePlay ?? 0);
  if (freePlayDelta > 0) improvements.push(`adds ${freePlayDelta.toLocaleString()} free play`);

  const obcDelta = (toLevel.onBoardCredit ?? 0) - (fromLevel.onBoardCredit ?? 0);
  if (obcDelta > 0) improvements.push(`adds ${obcDelta.toLocaleString()} OBC`);

  const summary = improvements.length > 0
    ? `${additionalPoints !== null ? `+${additionalPoints.toLocaleString()} pts` : 'Higher level'} ${toLevel.certificateCode} ${improvements.join(' and ')}.`
    : `${additionalPoints !== null ? `+${additionalPoints.toLocaleString()} pts` : 'Higher level'} ${toLevel.certificateCode} shows the same visible benefits.`;

  return { fromCode: fromLevel.certificateCode, toCode: toLevel.certificateCode, additionalPoints, summary };
}

function buildDecisionGuide(levels: CertificateMatchLevel[]): string[] {
  if (levels.length === 0) return [];
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
      improvements.push(
        baseline.cabinLabel ? `upgrade to ${upgradeCandidate.cabinLabel}` : `unlock ${upgradeCandidate.cabinLabel}`
      );
    }
    const freePlayDelta = (upgradeCandidate.freePlay ?? 0) - (baseline.freePlay ?? 0);
    if (freePlayDelta > 0) improvements.push(`add ${freePlayDelta.toLocaleString()} free play`);
    const obcDelta = (upgradeCandidate.onBoardCredit ?? 0) - (baseline.onBoardCredit ?? 0);
    if (obcDelta > 0) improvements.push(`add ${obcDelta.toLocaleString()} OBC`);
    if (improvements.length > 0) {
      guide.push(
        `If you push to ${formatPointsLabel(upgradeCandidate.points)} with ${upgradeCandidate.certificateCode}, ${additionalPoints !== null ? `${additionalPoints.toLocaleString()} more points lets you ` : 'the higher level lets you '}${improvements.join(' and ')}.`
      );
    }
  }
  return guide;
}

function normalizeText(value?: string | null): string {
  return String(value ?? '').toLowerCase().replace(/®/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateToIso(value?: string | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
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
    if (index < 0 || !match?.[0]) return;
    if (bestMatch === null || index < bestMatch.index) {
      bestMatch = { label: cleanStructuredValue(match[0]) ?? match[0], index, raw: match[0] };
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
      if (index < 0 || !match[0]) continue;
      if (bestMatch === null || index > bestMatch.index) {
        bestMatch = { label: cleanStructuredValue(match[0]) ?? match[0], index, raw: match[0] };
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
    if (start < 0) return;
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
  if (cabinLabel) benefitSummary.push(cabinLabel);
  if (normalizedBonusText) benefitSummary.push(normalizedBonusText);
  return { cabinLabel, cabinRank, freePlay, onBoardCredit, guestCount: null, benefitSummary };
}

function splitStructuredRowSegments(indexEntry: IndexEntry, pdfText: string): string[] {
  const normalizedText = pdfText.replace(/®/g, '').replace(/\s+/g, ' ').trim();
  const startRegex = new RegExp(`(?=${escapeRegExp(indexEntry.certificateCode)}\\b)`, 'g');
  const starts = Array.from(normalizedText.matchAll(startRegex))
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);
  if (starts.length === 0) return [];
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? normalizedText.length;
    return normalizedText.slice(start, end).trim();
  }).filter(Boolean);
}

function parseStructuredCertificateRow(segment: string): StructuredCertificateRow | null {
  const cleanedSegment = cleanStructuredValue(segment);
  if (!cleanedSegment) return null;

  const shipMatch = findShipOccurrence(cleanedSegment);
  if (!shipMatch) return null;

  const dateMatch = Array.from(cleanedSegment.matchAll(DATE_TEXT_REGEX)).find((match) => {
    const index = match.index ?? -1;
    return index >= shipMatch.end;
  });
  const dateText = dateMatch?.[0] ?? null;
  const dateIndex = dateMatch?.index ?? -1;
  if (!dateText || dateIndex < 0) return null;

  const sailDate = parseDateToIso(dateText);
  if (!sailDate) return null;

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

  return { shipName: shipMatch.shipName, sailDate, departurePort, itinerary, offerTypeLabel, nextCruiseBonusLabel, benefits };
}

function extractStructuredRowsFromCertificatePdf(indexEntry: IndexEntry, pdfText: string): StructuredCertificateRow[] {
  const rowSegments = splitStructuredRowSegments(indexEntry, pdfText);
  const rowMap = new Map<string, StructuredCertificateRow>();
  rowSegments.forEach((segment) => {
    const parsedRow = parseStructuredCertificateRow(segment);
    if (!parsedRow) return;
    const key = `${parsedRow.shipName}__${parsedRow.sailDate}`;
    if (!rowMap.has(key)) rowMap.set(key, parsedRow);
  });
  return Array.from(rowMap.values());
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
    if (escaped === undefined) break;
    if (escaped === 'n') { result += '\n'; continue; }
    if (escaped === 'r') { result += '\r'; continue; }
    if (escaped === 't') { result += '\t'; continue; }
    if (escaped === 'b') { result += '\b'; continue; }
    if (escaped === 'f') { result += '\f'; continue; }
    if (escaped === '(' || escaped === ')' || escaped === '\\') { result += escaped; continue; }
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
    if (escaping) { raw += '\\' + ch; escaping = false; pos += 1; continue; }
    if (ch === '\\') { escaping = true; pos += 1; continue; }
    if (ch === '(') { depth += 1; raw += ch; pos += 1; continue; }
    if (ch === ')') { depth -= 1; if (depth > 0) raw += ch; pos += 1; continue; }
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
    if (!Number.isNaN(byte) && byte > 0) decoded += String.fromCharCode(byte);
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
        if (wordBuf) { words.push(wordBuf); wordBuf = ''; }
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
    .filter((char) => char !== '\u0000')
    .map((char) => {
      const code = char.charCodeAt(0);
      const isUnsupportedControl = code <= 31 && code !== 9 && code !== 10 && code !== 13;
      return isUnsupportedControl ? ' ' : char;
    })
    .join('');
}

function uint8ToLatin1(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes[i]);
  return result;
}

function stringToUint8(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
}

function extractPdfText(pdfBytes: Uint8Array): string {
  // One authoritative compressed-PDF stream walker is used by fixture tests
  // and the live direct-device downloader. Keeping a second
  // broad binary regex here caused current Royal July PDFs to download but
  // produce zero rows on device.
  return extractCertificatePdfText(pdfBytes);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredDelay(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs * 0.5);
}

const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 600;

interface DirectPdfReadResult {
  text: string;
  bytes: number;
  contentType: string | null;
  pdfBytes: Uint8Array | null;
  documentEvidence: CertificateDocumentEvidence | null;
  binaryTransport: string | null;
  download: DownloadedCertificatePdf | null;
}

const pdfTextCache = new Map<string, { result: DirectPdfReadResult; fetchedAt: number }>();
const PDF_TEXT_CACHE_TTL_MS = 1000 * 60 * 15;
const PDF_TEXT_CACHE_MAX_ENTRIES = 6;

function cachePdfText(cacheKey: string, result: DirectPdfReadResult): void {
  pdfTextCache.delete(cacheKey);
  pdfTextCache.set(cacheKey, { result, fetchedAt: Date.now() });
  while (pdfTextCache.size > PDF_TEXT_CACHE_MAX_ENTRIES) {
    const oldestKey = pdfTextCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    pdfTextCache.delete(oldestKey);
  }
}

async function fetchPdfTextDirect(url: string, documentStorageKey?: string): Promise<DirectPdfReadResult> {
  const cacheKey = `${documentStorageKey ?? 'legacy'}|${url}`;
  const cached = pdfTextCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < PDF_TEXT_CACHE_TTL_MS) return cached.result;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(jitteredDelay(BASE_RETRY_DELAY_MS * attempt));
    try {
      const download = await downloadPublicCertificatePdf(url);
      if (download.status !== 'downloaded' || !download.bytes) {
        if (/HTTP 404/i.test(download.errorMessage ?? '')) {
          const result: DirectPdfReadResult = { text: '', bytes: 0, contentType: download.provenance.contentType ?? null, pdfBytes: null, documentEvidence: null, binaryTransport: download.provenance.binaryTransport ?? null, download: null };
          cachePdfText(cacheKey, result);
          return result;
        }
        throw new Error(download.errorMessage || `Direct certificate PDF download failed with status ${download.status}.`);
      }

      const pdfBytes = download.bytes;
      const extractedText = extractPdfText(pdfBytes);
      const result: DirectPdfReadResult = {
        text: extractedText,
        bytes: pdfBytes.length,
        contentType: download.provenance.contentType ?? null,
        pdfBytes,
        documentEvidence: null,
        binaryTransport: download.provenance.binaryTransport ?? null,
        download,
      };
      cachePdfText(cacheKey, result);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`Direct PDF download exhausted retries for ${url}`);
}

function getCertificateLevelCode(certificateCode: string): string {
  return coreGetCertificateLevelCode(certificateCode);
}

function getDefaultPointsForCertificate(certificateCode: string): number | null {
  return coreGetDefaultPointsForCertificate(certificateCode);
}

function getCertificateTypeFromCode(code: string): CertificateFamily {
  return coreGetCertificateFamilyFromCode(code);
}

function extractPointsFromPdfText(certificateCode: string, pdfText: string): number | null {
  return extractExplicitPointsForCode(certificateCode, pdfText);
}

function resolveShipTargets(shipQuery: string): string[] {
  const normalizedQuery = normalizeText(shipQuery);
  const rawSegments = shipQuery.split(/,|\band\b|&/gi).map((segment) => segment.trim()).filter(Boolean);
  const normalizedSegments = rawSegments.length > 0
    ? rawSegments.map((segment) => normalizeText(segment)).filter(Boolean)
    : [normalizedQuery];

  const matches = new Set<string>();
  ROYAL_SHIP_NAMES.forEach((shipName) => {
    const normalizedShip = normalizeText(shipName);
    const matched = normalizedSegments.some((segment) => {
      if (!segment) return false;
      return normalizedShip.includes(segment) || segment.includes(normalizedShip);
    });
    if (matched) matches.add(shipName);
  });

  if (matches.size === 0 && normalizedQuery) {
    ROYAL_SHIP_NAMES.forEach((shipName) => {
      const normalizedShip = normalizeText(shipName);
      if (normalizedShip.includes(normalizedQuery) || normalizedQuery.includes(normalizedShip)) {
        matches.add(shipName);
      }
    });
  }

  return Array.from(matches);
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
  if (cabinLabel) benefitSummary.push(cabinLabel);
  if (freePlay !== null) benefitSummary.push(`${freePlay.toLocaleString()} free play`);
  if (onBoardCredit !== null) benefitSummary.push(`${onBoardCredit.toLocaleString()} OBC`);
  return { cabinLabel, cabinRank, freePlay, onBoardCredit, guestCount: null, benefitSummary };
}

function extractSailingsFromCertificatePdf(indexEntry: IndexEntry, pdfText: string): SailingEntry[] {
  return parseCertificateSailingsFromText(indexEntry, pdfText) as SailingEntry[];
}

interface CertificateSailingExtraction {
  sailings: SailingEntry[];
  parserAuthority: 'structured-text' | 'shared-device-pdf-fallback' | 'shared-device-pdf-completeness-recovery';
  warnings: string[];
  parsedResult?: CertificateParseResult;
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSharedDeviceSailing(indexEntry: IndexEntry, sailing: any): SailingEntry {
  const cabin = extractCabinBenefit(String(sailing?.cabinCategory ?? ''));
  const occupancyGuestCount = finiteNumberOrNull(String(sailing?.occupancy ?? '').match(/\d+/)?.[0]);
  const guestCount = finiteNumberOrNull(sailing?.guestCount) ?? occupancyGuestCount;
  const freePlay = finiteNumberOrNull(sailing?.freePlay);
  const onBoardCredit = finiteNumberOrNull(sailing?.onboardCredit);
  const explicitPoints = finiteNumberOrNull(sailing?.pointRequirement);
  const points = explicitPoints ?? indexEntry.points;
  const benefitEvidence = Array.isArray(sailing?.benefits)
    ? sailing.benefits.map((benefit: any) => String(benefit?.evidence ?? '')).filter(Boolean)
    : [];
  const benefitSummary = [
    cabin.cabinLabel,
    guestCount === null ? null : `${guestCount} guest${guestCount === 1 ? '' : 's'}`,
    freePlay === null ? null : `$${freePlay.toLocaleString()} free play`,
    onBoardCredit === null ? null : `$${onBoardCredit.toLocaleString()} OBC`,
  ].filter((value): value is string => Boolean(value));
  const row: SailingEntry = {
    certificateCode: indexEntry.certificateCode,
    certificateType: indexEntry.certificateType,
    level: getCertificateLevelCode(indexEntry.certificateCode),
    points,
    pointsSource: explicitPoints !== null
      ? 'pdf-explicit'
      : points !== null ? 'known-level-fallback' : 'missing',
    shipName: String(sailing?.shipName ?? '').trim(),
    sailDate: String(sailing?.sailingDate ?? '').trim(),
    departurePort: String(sailing?.departurePort ?? '').trim() || null,
    itinerary: String(sailing?.itinerary ?? '').trim() || null,
    offerTypeLabel: String(sailing?.offerTypeLabel ?? '').trim() || null,
    nextCruiseBonusLabel: String(sailing?.nextCruiseBonusLabel ?? '').trim() || null,
    pdfUrl: indexEntry.pdfUrl,
    monthlyIndexUrl: indexEntry.monthlyIndexUrl,
    cabinLabel: cabin.cabinLabel,
    cabinRank: cabin.cabinRank,
    guestCount,
    freePlay,
    onBoardCredit,
    benefitSummary,
    benefitEvidence,
  };
  return { ...row, variantId: buildCertificateVariantId(row) };
}

function extractSailingsFromCertificateDownload(
  indexEntry: IndexEntry,
  pdfText: string,
  download: DownloadedCertificatePdf | null,
  forceSharedDeviceAuthority = false,
): CertificateSailingExtraction {
  const structuredRows = forceSharedDeviceAuthority ? [] : extractSailingsFromCertificatePdf(indexEntry, pdfText);
  if (!download?.bytes || download.status !== 'downloaded') {
    return {
      sailings: structuredRows,
      parserAuthority: 'structured-text',
      warnings: structuredRows.length > 0
        ? []
        : ['The structured parser returned zero rows and no downloaded PDF bytes were available for the shared device parser.'],
    };
  }

  // Run both independent row analyzers over the one already-extracted text.
  // This preserves the shared device fallback without decompressing the PDF a
  // second time, and it prevents a partially successful parser from hiding a
  // more complete set of valid ship/date rows.
  const sharedResult = parseCertificateExtractedTextOnDevice(
    pdfText,
    indexEntry.certificateCode,
    download.provenance,
  );
  const sharedRows = sharedResult.sailings
    .map((sailing) => mapSharedDeviceSailing(indexEntry, sailing))
    .filter((sailing) => Boolean(sailing.shipName && sailing.sailDate));

  const countWarning = structuredRows.length !== sharedRows.length && !forceSharedDeviceAuthority
    ? [`Independent row analyzers found ${structuredRows.length} and ${sharedRows.length} sailing references; retained the more complete verified result.`]
    : [];
  if (!forceSharedDeviceAuthority && structuredRows.length >= sharedRows.length && structuredRows.length > 0) {
    return {
      sailings: structuredRows,
      parserAuthority: 'structured-text',
      warnings: [...countWarning, ...sharedResult.warnings],
      parsedResult: sharedResult,
    };
  }
  return {
    sailings: sharedRows,
    parserAuthority: structuredRows.length > 0
      ? 'shared-device-pdf-completeness-recovery'
      : 'shared-device-pdf-fallback',
    warnings: [...countWarning, ...sharedResult.warnings],
    parsedResult: sharedResult,
  };
}

export interface ClientCertificateFallbackInput {
  monthCode: string;
  certificateCodes: string[];
  shipQuery?: string;
  sailDate?: string;
  documentStorageKey?: string;
  deferDocumentStorage?: boolean;
}

export interface ClientCertificateFallbackResult {
  catalog: any[];
  matches: any[];
  source: 'direct-royal-caribbean';
  parserVersion?: string;
  documentArtifacts?: CertificatePdfArchiveInput[];
}

/**
 * Fetches + parses the given certificate codes directly from
 * royalcaribbean.com from the device, with no backend involved at all.
 * Returns the shared catalog + matches shape used by the certificate screens.
 */
export async function fetchCertificatesDirectFromRoyalCaribbean(
  input: ClientCertificateFallbackInput
): Promise<ClientCertificateFallbackResult> {
  const requestedSailDate = parseDateToIso(input.sailDate);
  const effectiveShipQuery = input.shipQuery?.trim() || '';
  const targetShips = resolveShipTargets(effectiveShipQuery);

  const indexEntries: IndexEntry[] = input.certificateCodes.map((rawCode) => {
    const certificateCode = rawCode.toUpperCase().trim();
    const certificateType = getCertificateTypeFromCode(certificateCode);
    const monthPrefix = certificateCode.slice(0, 4) || input.monthCode;
    return {
      certificateCode,
      certificateType,
      points: getDefaultPointsForCertificate(certificateCode),
      pdfUrl: buildPdfUrl(certificateCode),
      monthlyIndexUrl: buildPdfUrl(`${monthPrefix}${certificateType}`),
    };
  });

  const catalog: any[] = [];
  const allSailings: SailingEntry[] = [];
  const documentArtifacts: CertificatePdfArchiveInput[] = [];

  for (const entry of indexEntries) {
    try {
      const pdfRead = await fetchPdfTextDirect(entry.pdfUrl, input.documentStorageKey);
      const pdfText = pdfRead.text;

      if (!pdfText || pdfText.length < 20) {
        catalog.push({
          certificateCode: entry.certificateCode,
          certificateType: entry.certificateType,
          level: getCertificateLevelCode(entry.certificateCode),
          points: entry.points,
          pdfUrl: entry.pdfUrl,
          monthlyIndexUrl: entry.monthlyIndexUrl,
          status: pdfRead.bytes > 0 ? 'unsupported_pdf' : 'network_error',
          parserSource: 'direct-device',
          downloadedBytes: pdfRead.bytes,
          extractedTextLength: pdfText.length,
          parsedSailingReferences: 0,
          sailingGroups: 0,
          evidence: pdfRead.bytes > 0 ? ['PDF bytes downloaded but readable sailing text was not extracted'] : [],
          errorMessage: pdfRead.bytes > 0 ? 'PDF text was empty or too short to contain a sailing table' : 'PDF was unavailable',
          sailingsFound: 0,
        });
        continue;
      }

      const detectedPoints = extractPointsFromPdfText(entry.certificateCode, pdfText);
      entry.points = detectedPoints ?? entry.points ?? getDefaultPointsForCertificate(entry.certificateCode);

      const extraction = extractSailingsFromCertificateDownload(entry, pdfText, pdfRead.download);
      const sailings = extraction.sailings;
      allSailings.push(...sailings);
      const archiveInput: CertificatePdfArchiveInput = {
        certificateCode: entry.certificateCode,
        sourceUrl: entry.pdfUrl,
        bytes: pdfRead.pdfBytes as Uint8Array,
        parserSource: 'direct-device',
        provenance: pdfRead.download?.provenance,
        storageKey: input.documentStorageKey,
        materialSailings: sailings,
        parsedResult: extraction.parsedResult,
      };
      if (input.deferDocumentStorage) {
        documentArtifacts.push(archiveInput);
      } else {
        pdfRead.documentEvidence = await archiveCertificatePdfBytes(archiveInput);
      }

      catalog.push({
        certificateCode: entry.certificateCode,
        certificateType: entry.certificateType,
        level: getCertificateLevelCode(entry.certificateCode),
        points: entry.points,
        pdfUrl: entry.pdfUrl,
        monthlyIndexUrl: entry.monthlyIndexUrl,
        status: sailings.length > 0 ? 'parsed' : 'parse_failed',
        parserSource: 'direct-device',
        downloadedBytes: pdfRead.bytes,
        extractedTextLength: pdfText.length,
        parsedSailingReferences: sailings.length,
        sailingGroups: sailings.length,
        evidence: [
          `Downloaded bytes: ${pdfRead.bytes}`,
          `Binary transport: ${pdfRead.binaryTransport ?? 'unknown'}`,
          `Extracted text characters: ${pdfText.length}`,
          `Parser authority: ${extraction.parserAuthority}`,
          `Parsed sailing references: ${sailings.length}`,
          ...extraction.warnings.map((warning) => `Parser warning: ${warning}`),
          ...(pdfRead.documentEvidence ? [`Archived original PDF SHA-256: ${pdfRead.documentEvidence.sha256}`] : []),
        ],
        documentSha256: pdfRead.documentEvidence?.sha256 ?? null,
        documentArchiveUri: pdfRead.documentEvidence?.archiveUri ?? null,
        documentStorageStatus: input.deferDocumentStorage ? 'pending' : pdfRead.documentEvidence?.storageStatus ?? null,
        errorMessage: sailings.length === 0 ? 'Readable PDF text contained no recognized ship/date sailing rows' : null,
        sailingsFound: sailings.length,
      });
    } catch (error) {
      console.warn('[ClientCertificatePdfEngine] Direct fetch failed for', entry.certificateCode, error);
      catalog.push({
        certificateCode: entry.certificateCode,
        certificateType: entry.certificateType,
        level: getCertificateLevelCode(entry.certificateCode),
        points: entry.points,
        pdfUrl: entry.pdfUrl,
        monthlyIndexUrl: entry.monthlyIndexUrl,
        status: /pdf|content-type|header|extract|unreadable/i.test(error instanceof Error ? error.message : String(error)) ? 'unsupported_pdf' : 'network_error',
        parserSource: 'direct-device',
        downloadedBytes: null,
        extractedTextLength: 0,
        parsedSailingReferences: 0,
        sailingGroups: 0,
        evidence: [],
        errorMessage: error instanceof Error ? error.message : String(error),
        sailingsFound: 0,
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  const normalizedShipTargets = targetShips.map((ship) => normalizeText(ship));
  const filteredSailings = allSailings.filter((sailing) => {
    const shipMatches = normalizedShipTargets.length === 0
      ? (effectiveShipQuery ? normalizeText(sailing.shipName).includes(normalizeText(effectiveShipQuery)) : true)
      : normalizedShipTargets.includes(normalizeText(sailing.shipName));
    const dateMatches = requestedSailDate ? sailing.sailDate === requestedSailDate : true;
    return shipMatches && dateMatches;
  });

  const groupedMatches = new Map<string, SailingMatch>();
  filteredSailings.forEach((sailing) => {
    const key = `${sailing.shipName}__${sailing.sailDate}`;
    if (!groupedMatches.has(key)) {
      groupedMatches.set(key, { shipName: sailing.shipName, sailDate: sailing.sailDate, levels: [], decisionGuide: [], opportunities: [] });
    }
    const targetGroup = groupedMatches.get(key);
    const candidateLevel: any = {
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
      guestCount: sailing.guestCount,
      benefitSummary: sailing.benefitSummary,
      benefitEvidence: sailing.benefitEvidence ?? [],
      variantId: sailing.variantId,
      pointsSource: sailing.pointsSource,
    };
    if (targetGroup && !targetGroup.levels.some((level: any) => level.variantId === candidateLevel.variantId)) targetGroup.levels.push(candidateLevel);
  });

  const matches = Array.from(groupedMatches.values())
    .map((match) => {
      const levels = [...match.levels].sort((left, right) => {
        const leftPoints = left.points ?? Number.MAX_SAFE_INTEGER;
        const rightPoints = right.points ?? Number.MAX_SAFE_INTEGER;
        if (leftPoints !== rightPoints) return leftPoints - rightPoints;
        return left.certificateCode.localeCompare(right.certificateCode);
      });
      const opportunities = levels.slice(1).map((level, index) => buildOpportunity(levels[index], level));
      return { ...match, levels, opportunities, decisionGuide: buildDecisionGuide(levels) };
    })
    .sort((left, right) => {
      if (left.shipName !== right.shipName) return left.shipName.localeCompare(right.shipName);
      return left.sailDate.localeCompare(right.sailDate);
    });

  return { catalog, matches, source: 'direct-royal-caribbean', parserVersion: CLIENT_CERTIFICATE_PDF_ENGINE_VERSION, documentArtifacts };
}

/**
 * Deterministic parser-fixture entry point used by regression tests. It runs
 * the exact production extraction functions without performing a network
 * request or weakening the PDF download path.
 */
export function parseCertificatePdfTextFixture(input: {
  certificateCode: string;
  pdfText: string;
}): { catalog: any[]; matches: any[] } {
  const certificateCode = input.certificateCode.toUpperCase().trim();
  const certificateType = getCertificateTypeFromCode(certificateCode);
  const monthPrefix = certificateCode.slice(0, 4);
  const entry: IndexEntry = {
    certificateCode,
    certificateType,
    points: getDefaultPointsForCertificate(certificateCode),
    pdfUrl: buildPdfUrl(certificateCode),
    monthlyIndexUrl: buildPdfUrl(`${monthPrefix}${certificateType}`),
  };
  const text = input.pdfText.replace(/\s+/g, ' ').trim();
  const sailings = text.length >= 20 ? extractSailingsFromCertificatePdf(entry, text) : [];
  const grouped = new Map<string, SailingMatch>();
  sailings.forEach((sailing) => {
    const key = `${sailing.shipName}__${sailing.sailDate}`;
    if (!grouped.has(key)) grouped.set(key, { shipName: sailing.shipName, sailDate: sailing.sailDate, levels: [], decisionGuide: [], opportunities: [] });
    const targetGroup = grouped.get(key);
    const candidateLevel: any = {
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
      guestCount: sailing.guestCount,
      benefitSummary: sailing.benefitSummary,
      benefitEvidence: sailing.benefitEvidence ?? [],
      variantId: sailing.variantId,
      pointsSource: sailing.pointsSource,
    };
    if (targetGroup && !targetGroup.levels.some((level: any) => level.variantId === candidateLevel.variantId)) targetGroup.levels.push(candidateLevel);
  });
  const matches = Array.from(grouped.values());
  return {
    catalog: [{
      certificateCode,
      certificateType,
      level: getCertificateLevelCode(certificateCode),
      points: entry.points,
      pdfUrl: entry.pdfUrl,
      monthlyIndexUrl: entry.monthlyIndexUrl,
      status: sailings.length > 0 ? 'parsed' : 'parse_failed',
      parserSource: 'direct-device',
      downloadedBytes: null,
      extractedTextLength: text.length,
      parsedSailingReferences: sailings.length,
      sailingGroups: matches.length,
      evidence: [`Fixture text characters: ${text.length}`, `Parsed sailing references: ${sailings.length}`],
      errorMessage: sailings.length === 0 ? 'Fixture contained no recognized ship/date sailing rows' : null,
      sailingsFound: sailings.length,
    }],
    matches,
  };
}

export function parseCertificatePdfBytesFixture(input: { certificateCode: string; pdfBytes: Uint8Array }): { catalog: any[]; matches: any[] } {
  const header = String.fromCharCode(...input.pdfBytes.slice(0, 5));
  if (header !== '%PDF-') throw new Error('Unsupported PDF fixture: missing %PDF header');
  return parseCertificatePdfTextFixture({ certificateCode: input.certificateCode, pdfText: extractPdfText(input.pdfBytes) });
}

/**
 * Exercises the same byte-level recovery branch used when the richer text
 * parser returns zero rows on Hermes. Kept as a deterministic release gate so
 * a future refactor cannot silently disconnect the working shared PDF parser
 * from the certificate download screen again.
 */
export function parseCertificatePdfBytesWithDeviceFallbackFixture(input: {
  certificateCode: string;
  pdfBytes: Uint8Array;
}): { sailingCount: number; parserAuthority: string; firstSailing: any | null; lastSailing: any | null } {
  const certificateCode = input.certificateCode.toUpperCase().trim();
  const certificateType = getCertificateTypeFromCode(certificateCode);
  const entry: IndexEntry = {
    certificateCode,
    certificateType,
    points: getDefaultPointsForCertificate(certificateCode),
    pdfUrl: buildPdfUrl(certificateCode),
    monthlyIndexUrl: buildPdfUrl(`${certificateCode.slice(0, 4)}${certificateType}`),
  };
  const download: DownloadedCertificatePdf = {
    status: 'downloaded',
    bytes: input.pdfBytes,
    provenance: { originalUrl: entry.pdfUrl, retrievedAt: new Date(0).toISOString() },
  };
  const extraction = extractSailingsFromCertificateDownload(
    entry,
    extractPdfText(input.pdfBytes),
    download,
    true,
  );
  return {
    sailingCount: extraction.sailings.length,
    parserAuthority: extraction.parserAuthority,
    firstSailing: extraction.sailings[0] ?? null,
    lastSailing: extraction.sailings[extraction.sailings.length - 1] ?? null,
  };
}

/**
 * Exercises the exact production parser-selection path against retained Royal
 * PDF fixtures. This is intentionally separate from the forced fallback gate:
 * it verifies that a partially successful parser cannot suppress a richer set
 * of independently recognized sailing rows.
 */
export function parseCertificatePdfBytesBestAvailableFixture(input: {
  certificateCode: string;
  pdfBytes: Uint8Array;
}): { sailingCount: number; parserAuthority: string; firstSailing: any | null; lastSailing: any | null } {
  const certificateCode = input.certificateCode.toUpperCase().trim();
  const certificateType = getCertificateTypeFromCode(certificateCode);
  const entry: IndexEntry = {
    certificateCode,
    certificateType,
    points: getDefaultPointsForCertificate(certificateCode),
    pdfUrl: buildPdfUrl(certificateCode),
    monthlyIndexUrl: buildPdfUrl(`${certificateCode.slice(0, 4)}${certificateType}`),
  };
  const download: DownloadedCertificatePdf = {
    status: 'downloaded',
    bytes: input.pdfBytes,
    provenance: { originalUrl: entry.pdfUrl, retrievedAt: new Date(0).toISOString() },
  };
  const extraction = extractSailingsFromCertificateDownload(
    entry,
    extractPdfText(input.pdfBytes),
    download,
  );
  return {
    sailingCount: extraction.sailings.length,
    parserAuthority: extraction.parserAuthority,
    firstSailing: extraction.sailings[0] ?? null,
    lastSailing: extraction.sailings[extraction.sailings.length - 1] ?? null,
  };
}
