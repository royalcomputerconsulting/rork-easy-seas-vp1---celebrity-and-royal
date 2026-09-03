export const CERTIFICATE_PDF_PARSER_CORE_VERSION = 'v2.4.0-hermes-explicit-date-parser';

export type CertificateFamily = string;

export interface CertificateCodeParts {
  code: string;
  monthCode: string;
  family: CertificateFamily;
  levelCode: string;
  recognizedFamily: boolean;
}

export interface CertificateIndexDescriptor {
  certificateCode: string;
  certificateType: CertificateFamily;
  points: number | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
}

export interface CertificateBenefitSnapshot {
  cabinLabel: string | null;
  cabinRank: number | null;
  guestCount: number | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  benefitSummary: string[];
  benefitEvidence: string[];
}

export interface ParsedCertificateSailing extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: CertificateFamily;
  level: string;
  points: number | null;
  pointsSource: 'pdf-explicit' | 'known-level-fallback' | 'missing';
  shipName: string;
  sailDate: string;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
  variantId: string;
}

export interface ColumnarCertificateSailingFact {
  shipName: string;
  sailDate: string;
  cabinLabel: string | null;
  cabinRank: number | null;
  guestCount: number | null;
  onBoardCredit: number | null;
}

export interface CertificateMatchLevel extends CertificateBenefitSnapshot {
  certificateCode: string;
  certificateType: CertificateFamily;
  level: string;
  points: number | null;
  pointsSource?: 'pdf-explicit' | 'known-level-fallback' | 'missing';
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
  variantId: string;
  parserSources?: string[];
  documentSha256?: string | null;
  documentArchiveUri?: string | null;
}

export interface CertificateSailingMatch {
  shipName: string;
  sailDate: string;
  levels: CertificateMatchLevel[];
  decisionGuide?: string[];
  opportunities?: unknown[];
  parserDiscrepancies?: string[];
}

export const RECOGNIZED_CERTIFICATE_FAMILIES = ['A', 'C', 'D'] as const;
export const DEFAULT_CERTIFICATE_FAMILIES: CertificateFamily[] = [...RECOGNIZED_CERTIFICATE_FAMILIES];

export const ROYAL_SHIP_NAMES = [
  'Adventure Of The Seas', 'Allure Of The Seas', 'Anthem Of The Seas', 'Brilliance Of The Seas',
  'Enchantment Of The Seas', 'Explorer Of The Seas', 'Freedom Of The Seas', 'Grandeur Of The Seas',
  'Harmony Of The Seas', 'Icon Of The Seas', 'Independence Of The Seas', 'Jewel Of The Seas',
  'Legend Of The Seas', 'Liberty Of The Seas', 'Mariner Of The Seas', 'Navigator Of The Seas',
  'Oasis Of The Seas', 'Odyssey Of The Seas', 'Ovation Of The Seas', 'Quantum Of The Seas',
  'Radiance Of The Seas', 'Rhapsody Of The Seas', 'Serenade Of The Seas', 'Spectrum Of The Seas',
  'Star Of The Seas', 'Symphony Of The Seas', 'Utopia Of The Seas', 'Vision Of The Seas',
  'Voyager Of The Seas', 'Wonder Of The Seas',
] as const;

// Keep this expression Hermes-safe. JavaScript lookbehind worked in the Node
// fixture runner but is not supported consistently by the Hermes versions in
// shipped Expo clients, causing genuine PDFs to reach the device as zero rows.
// A word boundary is sufficient here because every supported month starts with
// an ASCII letter and the parser independently requires a known Royal ship.
const DATE_TEXT_REGEX = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/gi;
const CERTIFICATE_CODE_REGEX = /\b(\d{4})([A-Z])((?:VIP\d+)|(?:\d{2}[A-Z]?)|(?:[A-Z0-9]{2,8}))\b/g;

export const DEFAULT_CERTIFICATE_POINTS: Record<string, number> = {
  VIP2: 40000, '01': 25000, '02': 15000, '02A': 9000, '03': 6500, '03A': 4000,
  '04': 3000, '05': 2000, '06': 1500, '07': 1200, '08': 800, '09': 600, '10': 400,
};

const CABIN_PATTERNS: Array<{ label: string; rank: number; patterns: RegExp[] }> = [
  { label: 'Royal Suite', rank: 9, patterns: [/\broyal suite\b/i] },
  { label: "Owner's Suite", rank: 8, patterns: [/\bowner'?s suite(?:\s*2br)?\b/i] },
  { label: 'Grand Suite', rank: 7, patterns: [/\bgrand suite(?:\s*2br)?\b/i] },
  { label: 'Junior Suite', rank: 6, patterns: [/\bjunior suite\b/i, /\bjr\.?\s*suite\b/i] },
  { label: 'Suite', rank: 5, patterns: [/\bsuite\b/i] },
  { label: 'Balcony', rank: 4, patterns: [/\bocean view balcony\b/i, /\bbalcony\b/i, /\bveranda\b/i] },
  { label: 'Oceanview', rank: 3, patterns: [/\bocean\s*view\b/i, /\boceanview\b/i, /\boutside stateroom\b/i] },
  { label: 'Interior', rank: 2, patterns: [/\binterior\b/i, /\binside stateroom\b/i] },
];

const OFFER_TYPE_REGEX = /\bcruise fare(?:\s+for\s+(\d+)\s+guests?)?\b/i;
const BENEFIT_LABEL_REGEX = /\b(next\s*cruise\s*bonus|free\s*play|freeplay|fp|next\s*cruise\s*obc|obc|on[-\s]*board credit|onboard credit)\b/gi;
const MONEY_REGEX = /\$\s*([0-9][0-9,]*)/g;

function clean(value: string | null | undefined): string | null {
  const result = String(value ?? '').replace(/®/g, '').replace(/\s+/g, ' ').trim();
  return result || null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CERTIFICATE_RECOGNITION_PHRASES = [
  'Offer Code', 'Departure Port', 'Sail Date', 'Stateroom Type', 'Offer Type',
  'Next Cruise Bonus', 'Next Cruise OBC', 'Cruise Fare For', 'Free Play',
  'Onboard Credit', 'On-Board Credit', 'Royal Suite', "Owner's Suite",
  'Grand Suite', 'Junior Suite', 'Ocean View', 'Oceanview', 'Balcony',
  'Interior', 'Suite', 'Guests', 'Guest', 'Ship', 'Itinerary',
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function glyphFlexiblePattern(value: string): string {
  return Array.from(value.replace(/\s+/g, ''))
    .map((character) => escapeRegExp(character))
    .join('\\s*');
}

function replaceGlyphFlexiblePhrase(text: string, phrase: string, replacement = phrase): string {
  return text.replace(new RegExp(glyphFlexiblePattern(phrase), 'gi'), ` ${replacement} `);
}

function hasRecognizedShip(value: string): boolean {
  const lower = value.toLowerCase();
  return ROYAL_SHIP_NAMES.some((shipName) => lower.includes(shipName.toLowerCase()));
}

/**
 * Royal's August 2026 PDFs changed how some Excel text runs are emitted. On
 * device, a valid row can consequently arrive as `A d v e n t u r e ...` or
 * `AdventureOfTheSeas` even though the PDF is visually normal. Recover only
 * the closed vocabulary needed to identify certificate rows; do not broadly
 * collapse arbitrary user-visible text or invent a ship/date association.
 */
export function repairCertificateRecognitionText(certificateCode: string, value: string): string {
  let repaired = clean(value) ?? '';
  if (!repaired) return '';

  const normalizedCode = parseCertificateCode(certificateCode).code;
  if (normalizedCode && !new RegExp(`\\b${escapeRegExp(normalizedCode)}\\b`, 'i').test(repaired)) {
    repaired = replaceGlyphFlexiblePhrase(repaired, normalizedCode, normalizedCode);
  }

  if (!hasRecognizedShip(repaired)) {
    for (const shipName of ROYAL_SHIP_NAMES) {
      repaired = replaceGlyphFlexiblePhrase(repaired, shipName, shipName);
    }
  }

  for (const phrase of CERTIFICATE_RECOGNITION_PHRASES) {
    if (!new RegExp(escapeRegExp(phrase).replace(/\\ /g, '\\s+'), 'i').test(repaired)) {
      repaired = replaceGlyphFlexiblePhrase(repaired, phrase, phrase);
    }
  }

  for (const month of MONTH_NAMES) {
    if (!new RegExp(`\\b${month}\\b`, 'i').test(repaired)) {
      repaired = replaceGlyphFlexiblePhrase(repaired, month, month);
    }
  }

  const monthAlternation = MONTH_NAMES.join('|');
  repaired = repaired.replace(
    new RegExp(`\\b(${monthAlternation})\\s*((?:\\d\\s*){1,2})\\s*,?\\s*(2\\s*0\\s*\\d\\s*\\d)\\b`, 'gi'),
    (_match, month: string, day: string, year: string) => `${month} ${day.replace(/\s/g, '')}, ${year.replace(/\s/g, '')}`,
  );
  repaired = repaired.replace(
    /\b((?:\d\s*){1,2})\s*[\/-]\s*((?:\d\s*){1,2})\s*[\/-]\s*((?:\d\s*){2,4})\b/g,
    (_match, month: string, day: string, year: string) => `${month.replace(/\s/g, '')}/${day.replace(/\s/g, '')}/${year.replace(/\s/g, '')}`,
  );
  return clean(repaired) ?? '';
}

export function parseCertificateCode(rawCode: string): CertificateCodeParts {
  const code = String(rawCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = code.match(/^(\d{4})([A-Z])([A-Z0-9]+)$/);
  if (!match) {
    return { code, monthCode: code.slice(0, 4), family: code.charAt(4) || 'UNKNOWN', levelCode: code.slice(5), recognizedFamily: false };
  }
  const family = match[2];
  return {
    code,
    monthCode: match[1],
    family,
    levelCode: match[3],
    recognizedFamily: (RECOGNIZED_CERTIFICATE_FAMILIES as readonly string[]).includes(family),
  };
}

export function getCertificateLevelCode(code: string): string {
  return parseCertificateCode(code).levelCode;
}

export function getCertificateFamilyFromCode(code: string): CertificateFamily {
  return parseCertificateCode(code).family;
}

export function getDefaultPointsForCertificate(code: string): number | null {
  return DEFAULT_CERTIFICATE_POINTS[getCertificateLevelCode(code)] ?? null;
}

export function discoverCertificateCodesFromText(text: string, monthCode?: string): string[] {
  const normalizedMonth = String(monthCode ?? '').replace(/\D/g, '').slice(0, 4);
  const found = new Set<string>();
  for (const match of String(text ?? '').toUpperCase().matchAll(CERTIFICATE_CODE_REGEX)) {
    const code = `${match[1]}${match[2]}${match[3]}`;
    if (!normalizedMonth || code.startsWith(normalizedMonth)) found.add(code);
  }
  return Array.from(found).sort((left, right) => {
    const a = parseCertificateCode(left);
    const b = parseCertificateCode(right);
    if (a.family !== b.family) return a.family.localeCompare(b.family);
    const ap = getDefaultPointsForCertificate(left) ?? -1;
    const bp = getDefaultPointsForCertificate(right) ?? -1;
    if (ap !== bp) return bp - ap;
    return left.localeCompare(right);
  });
}

export function extractExplicitPointsForCode(certificateCode: string, text: string): number | null {
  const normalized = clean(text) ?? '';
  const escaped = escapeRegExp(parseCertificateCode(certificateCode).code);
  const patterns = [
    new RegExp(`${escaped}\\s*(?:[–—\\-:]\\s*)?([\\d,]+)\\s*(?:club\\s*royale\\s*)?points\\b`, 'i'),
    new RegExp(`([\\d,]+)\\s*(?:club\\s*royale\\s*)?points\\s*(?:[–—\\-:]\\s*)?${escaped}\\b`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
    if (Number.isFinite(parsed) && parsed >= 100 && parsed <= 1_000_000) return parsed;
  }
  return null;
}

function parseDateToIso(value: string): string | null {
  const match = String(value ?? '').replace(/\s+/g, ' ').trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!match) return null;
  const monthTokens = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = monthTokens.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
  const day = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximumDay = month === 2 ? (leapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (year < 2000 || year > 2199 || month < 1 || day < 1 || day > maximumDay) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Royal's Excel-generated certificate PDFs can expose a table as separate
 * column runs: every code, then every ship, then every date. Recover those
 * rows only when all official headings are present and column cardinalities
 * agree. Callers must use this only after the benefit-preserving parsers fail.
 */
export function extractColumnarCertificateSailingFacts(certificateCode: string, text: string): ColumnarCertificateSailingFact[] {
  const normalized = clean(text) ?? '';
  const requiredHeadings = [
    /Offer\s*Code/i,
    /Ship/i,
    /Departure\s*Port/i,
    /Sail\s*Date/i,
    /Itinerary/i,
    /Stateroom\s*Type/i,
    /Offer\s*Type/i,
  ];
  if (!requiredHeadings.every((heading) => heading.test(normalized))) return [];

  const normalizedCode = parseCertificateCode(certificateCode).code;
  if (!normalizedCode) return [];
  const codeCount = Array.from(normalized.matchAll(new RegExp(`\\b${escapeRegExp(normalizedCode)}\\b`, 'gi'))).length;
  const shipMatches = ROYAL_SHIP_NAMES.flatMap((shipName) =>
    Array.from(normalized.matchAll(new RegExp(escapeRegExp(shipName), 'gi')))
      .filter((match) => match.index != null)
      .map((match) => ({ shipName, index: match.index! })),
  ).sort((left, right) => left.index - right.index);
  const uniqueShipMatches = shipMatches.filter((match, index, all) => index === 0 || match.index !== all[index - 1].index);
  const dateMatches = Array.from(normalized.matchAll(DATE_TEXT_REGEX))
    .filter((match) => match.index != null && Boolean(match[0]))
    .map((match) => ({ sailDate: parseDateToIso(match[0]), index: match.index! }))
    .filter((match): match is { sailDate: string; index: number } => Boolean(match.sailDate));

  const rowCount = uniqueShipMatches.length;
  // Individual Royal certificate PDFs commonly print the certificate code once
  // in the title while the sailing table is exported as column runs (all ships,
  // then all dates). Requiring the code once per ship incorrectly rejected those
  // official documents as zero-row PDFs. The verified table headings, exact code
  // presence, known Royal ship names and matching date cardinality remain the
  // acceptance boundary.
  if (rowCount === 0 || codeCount === 0 || dateMatches.length < rowCount || dateMatches.length > rowCount + 3) return [];

  const cabinMatches = Array.from(normalized.matchAll(/\b(Interior|Ocean\s*View|Oceanview|Balcony|Junior\s*Suite|Grand\s*Suite|Owner'?s\s*Suite|Suite)\s*(?:-\s*GTY)?\b/gi))
    .map((match) => findCabin(match[0]));
  const guestMatches = Array.from(normalized.matchAll(/\bCruise\s*Fare\s*For\s*(\d+)\s*Guests?\b/gi))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  const obcMatches = /Next\s*Cruise\s*OBC/i.test(normalized)
    ? Array.from(normalized.matchAll(/\$\s*([0-9][0-9,]*)/g))
      .map((match) => Number.parseInt(match[1].replace(/,/g, ''), 10))
      .filter((value) => Number.isFinite(value) && value >= 0)
    : [];

  return uniqueShipMatches.map((ship, index) => ({
    shipName: ship.shipName,
    sailDate: dateMatches[index].sailDate,
    cabinLabel: cabinMatches.length >= rowCount ? cabinMatches[index]?.cabinLabel ?? null : null,
    cabinRank: cabinMatches.length >= rowCount ? cabinMatches[index]?.cabinRank ?? null : null,
    guestCount: guestMatches.length >= rowCount ? guestMatches[index] ?? null : null,
    onBoardCredit: obcMatches.length === rowCount ? obcMatches[index] ?? null : null,
  }));
}

function findShip(text: string): { shipName: string; start: number; end: number } | null {
  let best: { shipName: string; start: number; end: number } | null = null;
  for (const shipName of ROYAL_SHIP_NAMES) {
    const match = new RegExp(escapeRegExp(shipName), 'i').exec(text);
    if (!match) continue;
    const candidate = { shipName, start: match.index, end: match.index + match[0].length };
    if (!best || candidate.start < best.start) best = candidate;
  }
  return best;
}

function findCabin(text: string): { cabinLabel: string | null; cabinRank: number | null; index: number | null } {
  let best: { cabinLabel: string; cabinRank: number; index: number } | null = null;
  for (const cabin of CABIN_PATTERNS) {
    for (const pattern of cabin.patterns) {
      const match = pattern.exec(text);
      if (!match) continue;
      const candidate = { cabinLabel: cabin.label, cabinRank: cabin.rank, index: match.index };
      if (!best || candidate.index < best.index || (candidate.index === best.index && candidate.cabinRank > best.cabinRank)) best = candidate;
    }
  }
  return best ?? { cabinLabel: null, cabinRank: null, index: null };
}

interface LabelOccurrence { kind: 'freePlay' | 'onBoardCredit'; label: string; index: number; end: number; }
interface AmountOccurrence { value: number; raw: string; index: number; end: number; }

function labelKind(label: string): 'freePlay' | 'onBoardCredit' {
  return /obc|board credit/i.test(label) ? 'onBoardCredit' : 'freePlay';
}

function extractBenefits(text: string, options?: { inferTrailingObc?: boolean }): CertificateBenefitSnapshot & { firstBenefitIndex: number | null; combinedLabel: string | null } {
  const normalized = clean(text) ?? '';
  const cabin = findCabin(normalized);
  const offerMatch = OFFER_TYPE_REGEX.exec(normalized);
  const guestCount = offerMatch?.[1] ? Number.parseInt(offerMatch[1], 10) : null;
  const labels: LabelOccurrence[] = [];
  for (const match of normalized.matchAll(BENEFIT_LABEL_REGEX)) {
    if (match.index == null) continue;
    labels.push({ kind: labelKind(match[0]), label: clean(match[0]) ?? match[0], index: match.index, end: match.index + match[0].length });
  }
  const amounts: AmountOccurrence[] = [];
  for (const match of normalized.matchAll(MONEY_REGEX)) {
    if (match.index == null) continue;
    const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
    if (Number.isFinite(value)) amounts.push({ value, raw: match[0], index: match.index, end: match.index + match[0].length });
  }

  const assignments: Array<{ kind: 'freePlay' | 'onBoardCredit'; value: number; evidence: string; amountIndex: number }> = [];
  const consumedAmounts = new Set<number>();

  // Associate each label with at most one nearby dollar amount. The previous
  // implementation could attach both `$300` and the following `$100` OBC to
  // the single `FreePlay` label in Royal's flattened table rows.
  labels.forEach((label) => {
    const candidate = amounts
      .map((amount, amountIndex) => ({ amount, amountIndex, distance: amount.index >= label.end ? amount.index - label.end : label.index >= amount.end ? label.index - amount.end : 0 }))
      .filter(({ amountIndex, distance }) => !consumedAmounts.has(amountIndex) && distance <= 55)
      .sort((a, b) => a.distance - b.distance || a.amount.index - b.amount.index)[0];
    if (!candidate) return;
    assignments.push({ kind: label.kind, value: candidate.amount.value, evidence: `${candidate.amount.raw} ${label.label}`, amountIndex: candidate.amountIndex });
    consumedAmounts.add(candidate.amountIndex);
  });

  // C-family tables with a `Next Cruise OBC` column flatten each row as
  // `$300 FreePlay $100`. The second amount has no repeated OBC label in the
  // row, so use the verified table heading to scope that trailing value.
  if (options?.inferTrailingObc && assignments.some((item) => item.kind === 'freePlay') && !assignments.some((item) => item.kind === 'onBoardCredit')) {
    const freePlayAmountIndex = assignments.find((item) => item.kind === 'freePlay')?.amountIndex ?? -1;
    const trailing = amounts
      .map((amount, amountIndex) => ({ amount, amountIndex }))
      .filter(({ amountIndex }) => !consumedAmounts.has(amountIndex) && amountIndex > freePlayAmountIndex)
      .sort((a, b) => a.amount.index - b.amount.index)[0];
    if (trailing) {
      assignments.push({ kind: 'onBoardCredit', value: trailing.amount.value, evidence: `${trailing.amount.raw} Next Cruise OBC`, amountIndex: trailing.amountIndex });
      consumedAmounts.add(trailing.amountIndex);
    }
  }

  // Exact duplicate text fragments are ignored; distinct FP and OBC values are preserved.
  const seen = new Set<string>();
  const uniqueAssignments = assignments.filter((assignment) => {
    const key = `${assignment.kind}:${assignment.value}:${assignment.amountIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const freePlayValues = uniqueAssignments.filter((item) => item.kind === 'freePlay').map((item) => item.value);
  const obcValues = uniqueAssignments.filter((item) => item.kind === 'onBoardCredit').map((item) => item.value);
  const freePlay = freePlayValues.length ? Math.max(...freePlayValues) : null;
  const onBoardCredit = obcValues.length ? Math.max(...obcValues) : null;
  const benefitEvidence = uniqueAssignments.map((item) => item.evidence);
  const benefitSummary: string[] = [];
  if (cabin.cabinLabel) benefitSummary.push(cabin.cabinLabel);
  if (guestCount !== null) benefitSummary.push(`${guestCount} guest${guestCount === 1 ? '' : 's'}`);
  if (freePlay !== null) benefitSummary.push(`$${freePlay.toLocaleString()} free play`);
  if (onBoardCredit !== null) benefitSummary.push(`$${onBoardCredit.toLocaleString()} OBC`);
  const firstBenefitIndex = [cabin.index, offerMatch?.index, labels[0]?.index, amounts[0]?.index]
    .filter((value): value is number => typeof value === 'number' && value >= 0)
    .sort((a, b) => a - b)[0] ?? null;

  return {
    cabinLabel: cabin.cabinLabel,
    cabinRank: cabin.cabinRank,
    guestCount: Number.isFinite(guestCount) ? guestCount : null,
    freePlay,
    onBoardCredit,
    benefitSummary,
    benefitEvidence,
    firstBenefitIndex,
    combinedLabel: benefitEvidence.length ? benefitEvidence.join(' + ') : null,
  };
}

export function buildCertificateVariantId(row: Pick<ParsedCertificateSailing,
  'certificateCode' | 'shipName' | 'sailDate' | 'departurePort' | 'itinerary' | 'offerTypeLabel' |
  'cabinLabel' | 'guestCount' | 'freePlay' | 'onBoardCredit' | 'nextCruiseBonusLabel'>): string {
  return [
    row.certificateCode, row.shipName, row.sailDate, row.departurePort, row.itinerary, row.offerTypeLabel,
    row.cabinLabel, row.guestCount, row.freePlay, row.onBoardCredit, row.nextCruiseBonusLabel,
  ].map(normalizeKey).join('__');
}

function splitRowSegments(indexEntry: CertificateIndexDescriptor, text: string): string[] {
  const normalized = clean(text) ?? '';
  const starts = Array.from(normalized.matchAll(new RegExp(`(?=${escapeRegExp(indexEntry.certificateCode)}\\b)`, 'g')))
    .map((match) => match.index ?? -1).filter((index) => index >= 0);
  if (!starts.length) return [];
  return starts.map((start, index) => normalized.slice(start, starts[index + 1] ?? normalized.length).trim()).filter(Boolean);
}

function parseStructuredRow(indexEntry: CertificateIndexDescriptor, segment: string, explicitPoints: number | null, hasNextCruiseObcColumn: boolean): ParsedCertificateSailing | null {
  const cleaned = clean(segment);
  if (!cleaned) return null;
  const ship = findShip(cleaned);
  if (!ship) return null;
  const dateMatch = Array.from(cleaned.matchAll(DATE_TEXT_REGEX)).find((match) => (match.index ?? -1) >= ship.end);
  if (!dateMatch?.[0] || dateMatch.index == null) return null;
  const sailDate = parseDateToIso(dateMatch[0]);
  if (!sailDate) return null;
  const departurePort = clean(cleaned.slice(ship.end, dateMatch.index));
  const tail = clean(cleaned.slice(dateMatch.index + dateMatch[0].length)) ?? '';
  const offerMatch = OFFER_TYPE_REGEX.exec(tail);
  const benefits = extractBenefits(tail, { inferTrailingObc: hasNextCruiseObcColumn });
  const boundary = benefits.firstBenefitIndex ?? tail.length;
  const itinerary = clean(tail.slice(0, boundary));
  const points = explicitPoints ?? indexEntry.points ?? getDefaultPointsForCertificate(indexEntry.certificateCode);
  const base = {
    certificateCode: indexEntry.certificateCode,
    certificateType: indexEntry.certificateType,
    level: getCertificateLevelCode(indexEntry.certificateCode),
    points,
    pointsSource: explicitPoints !== null ? 'pdf-explicit' as const : points !== null ? 'known-level-fallback' as const : 'missing' as const,
    shipName: ship.shipName,
    sailDate,
    departurePort,
    itinerary,
    offerTypeLabel: clean(offerMatch?.[0]),
    nextCruiseBonusLabel: benefits.combinedLabel,
    pdfUrl: indexEntry.pdfUrl,
    monthlyIndexUrl: indexEntry.monthlyIndexUrl,
    cabinLabel: benefits.cabinLabel,
    cabinRank: benefits.cabinRank,
    guestCount: benefits.guestCount,
    freePlay: benefits.freePlay,
    onBoardCredit: benefits.onBoardCredit,
    benefitSummary: benefits.benefitSummary,
    benefitEvidence: benefits.benefitEvidence,
  };
  return { ...base, variantId: buildCertificateVariantId(base) };
}

function parseLocalFallbackRow(indexEntry: CertificateIndexDescriptor, window: string, shipName: string, explicitPoints: number | null): ParsedCertificateSailing | null {
  const dateText = window.match(DATE_TEXT_REGEX)?.[0];
  const sailDate = dateText ? parseDateToIso(dateText) : null;
  if (!sailDate) return null;
  const benefits = extractBenefits(window);
  // Never inherit a PDF-wide maximum. Only labeled values in this ship/date window are allowed.
  const points = explicitPoints ?? indexEntry.points ?? getDefaultPointsForCertificate(indexEntry.certificateCode);
  const base = {
    certificateCode: indexEntry.certificateCode,
    certificateType: indexEntry.certificateType,
    level: getCertificateLevelCode(indexEntry.certificateCode),
    points,
    pointsSource: explicitPoints !== null ? 'pdf-explicit' as const : points !== null ? 'known-level-fallback' as const : 'missing' as const,
    shipName,
    sailDate,
    departurePort: null,
    itinerary: null,
    offerTypeLabel: null,
    nextCruiseBonusLabel: benefits.combinedLabel,
    pdfUrl: indexEntry.pdfUrl,
    monthlyIndexUrl: indexEntry.monthlyIndexUrl,
    cabinLabel: benefits.cabinLabel,
    cabinRank: benefits.cabinRank,
    guestCount: benefits.guestCount,
    freePlay: benefits.freePlay,
    onBoardCredit: benefits.onBoardCredit,
    benefitSummary: benefits.benefitSummary,
    benefitEvidence: benefits.benefitEvidence,
  };
  return { ...base, variantId: buildCertificateVariantId(base) };
}

function parseColumnarFallbackRows(indexEntry: CertificateIndexDescriptor, normalized: string, explicitPoints: number | null): ParsedCertificateSailing[] {
  return extractColumnarCertificateSailingFacts(indexEntry.certificateCode, normalized).map((fact) => {
    const points = explicitPoints ?? indexEntry.points ?? getDefaultPointsForCertificate(indexEntry.certificateCode);
    const benefitSummary = [
      fact.cabinLabel,
      fact.guestCount !== null ? `${fact.guestCount} guest${fact.guestCount === 1 ? '' : 's'}` : null,
      fact.onBoardCredit !== null ? `$${fact.onBoardCredit.toLocaleString()} OBC` : null,
    ].filter((value): value is string => Boolean(value));
    const benefitEvidence = fact.onBoardCredit !== null ? [`$${fact.onBoardCredit} Next Cruise OBC`] : [];
    const base = {
      certificateCode: indexEntry.certificateCode,
      certificateType: indexEntry.certificateType,
      level: getCertificateLevelCode(indexEntry.certificateCode),
      points,
      pointsSource: explicitPoints !== null ? 'pdf-explicit' as const : points !== null ? 'known-level-fallback' as const : 'missing' as const,
      shipName: fact.shipName,
      sailDate: fact.sailDate,
      departurePort: null,
      itinerary: null,
      offerTypeLabel: fact.guestCount !== null ? `Cruise Fare For ${fact.guestCount} Guest${fact.guestCount === 1 ? '' : 's'}` : null,
      nextCruiseBonusLabel: fact.onBoardCredit !== null ? `$${fact.onBoardCredit} Next Cruise OBC` : null,
      pdfUrl: indexEntry.pdfUrl,
      monthlyIndexUrl: indexEntry.monthlyIndexUrl,
      cabinLabel: fact.cabinLabel,
      cabinRank: fact.cabinRank,
      guestCount: fact.guestCount,
      freePlay: null,
      onBoardCredit: fact.onBoardCredit,
      benefitSummary,
      benefitEvidence,
    };
    return { ...base, variantId: buildCertificateVariantId(base) };
  });
}

export function parseCertificateSailingsFromText(indexEntry: CertificateIndexDescriptor, pdfText: string): ParsedCertificateSailing[] {
  const initiallyNormalized = clean(pdfText) ?? '';
  const hasCode = new RegExp(`\\b${escapeRegExp(indexEntry.certificateCode)}\\b`, 'i').test(initiallyNormalized);
  const hasShip = hasRecognizedShip(initiallyNormalized);
  const hasDate = new RegExp(DATE_TEXT_REGEX.source, 'i').test(initiallyNormalized);
  const normalized = hasCode && hasShip && hasDate
    ? initiallyNormalized
    : repairCertificateRecognitionText(indexEntry.certificateCode, initiallyNormalized);
  const explicitPoints = extractExplicitPointsForCode(indexEntry.certificateCode, normalized);
  const hasNextCruiseObcColumn = /Next\s*Cruise\s*OBC/i.test(normalized);
  const rows = splitRowSegments(indexEntry, normalized)
    .map((segment) => parseStructuredRow(indexEntry, segment, explicitPoints, hasNextCruiseObcColumn))
    .filter((row): row is ParsedCertificateSailing => row !== null);
  const columnarRows = parseColumnarFallbackRows(indexEntry, normalized, explicitPoints);
  // A single code/header segment can look like one structured row even when the
  // PDF actually contains hundreds of column-major rows. Prefer the verified
  // column reconstruction whenever it recovers more material ship/date rows.
  if (columnarRows.length > rows.length) return dedupeExactCertificateRows(columnarRows);
  if (rows.length) return dedupeExactCertificateRows(rows);

  const fallbackRows: ParsedCertificateSailing[] = [];
  for (const shipName of ROYAL_SHIP_NAMES) {
    const matcher = new RegExp(escapeRegExp(shipName), 'gi');
    for (const match of normalized.matchAll(matcher)) {
      if (match.index == null) continue;
      const localWindow = normalized.slice(match.index, match.index + 500);
      const row = parseLocalFallbackRow(indexEntry, localWindow, shipName, explicitPoints);
      if (row) fallbackRows.push(row);
    }
  }
  if (fallbackRows.length) return dedupeExactCertificateRows(fallbackRows);
  return dedupeExactCertificateRows(columnarRows);
}

export function dedupeExactCertificateRows<T extends { variantId?: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  rows.forEach((row, index) => {
    const key = row.variantId || `row-${index}-${JSON.stringify(row)}`;
    if (!map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

export function materialCertificateLevelKey(level: any): string {
  return [
    level?.certificateCode, level?.departurePort, level?.itinerary, level?.offerTypeLabel,
    level?.cabinLabel, level?.guestCount, level?.freePlay, level?.onBoardCredit,
    level?.nextCruiseBonusLabel, level?.variantId,
  ].map(normalizeKey).join('__');
}

export function groupCertificateSailings(sailings: ParsedCertificateSailing[]): CertificateSailingMatch[] {
  const groups = new Map<string, CertificateSailingMatch>();
  for (const sailing of sailings) {
    const key = `${normalizeKey(sailing.shipName)}__${sailing.sailDate}`;
    if (!groups.has(key)) groups.set(key, { shipName: sailing.shipName, sailDate: sailing.sailDate, levels: [] });
    const group = groups.get(key)!;
    const level: CertificateMatchLevel = { ...sailing };
    if (!group.levels.some((existing) => materialCertificateLevelKey(existing) === materialCertificateLevelKey(level))) group.levels.push(level);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    levels: group.levels.sort((a, b) => {
      const ap = a.points ?? Number.MAX_SAFE_INTEGER;
      const bp = b.points ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return materialCertificateLevelKey(a).localeCompare(materialCertificateLevelKey(b));
    }),
  })).sort((a, b) => a.shipName.localeCompare(b.shipName) || a.sailDate.localeCompare(b.sailDate));
}
