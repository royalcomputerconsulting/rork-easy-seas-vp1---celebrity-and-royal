import * as pakoModule from 'pako';
import { normalizeCertificateSailingDate } from './certificateSailingDate';

function getCertificateBinaryTransport(): typeof import('@/lib/certificates/certificateBinaryTransport') {
  return require('@/lib/certificates/certificateBinaryTransport') as typeof import('@/lib/certificates/certificateBinaryTransport');
}

export type CertificateFamily = 'A' | 'C' | 'unclassified';
export type CertificateCodeClassification = 'certificate' | 'marketing_offer' | 'unclassified';
export type CertificateParserSource = 'backend' | 'device' | 'manual' | 'legacy_import';
export type CertificateBenefitKind = 'free_play' | 'onboard_credit' | 'trade_in_value';

export type CertificatePdfStatus =
  | 'downloaded'
  | 'download_failed'
  | 'redirect_blocked'
  | 'not_pdf'
  | 'pdf_corrupt'
  | 'unsupported_layout'
  | 'parse_failed'
  | 'parsed_zero_sailings'
  | 'parsed_with_warnings'
  | 'parsed_successfully';

export interface CertificateFamilyDefinition {
  family: CertificateFamily;
  familyCode: string | null;
  codeClassification: CertificateCodeClassification;
  known: boolean;
  layout: 'standard' | 'unknown';
}

export interface CertificatePdfProvenance {
  originalUrl: string;
  resolvedUrl?: string;
  retrievedAt: string;
  documentHash?: string;
  documentVersion?: string;
  documentSize?: number;
  contentType?: string | null;
  parserSource?: CertificateParserSource;
  parserVersion?: string;
  parseStatus?: CertificatePdfStatus;
  warnings?: string[];
  documentArchiveUri?: string | null;
  binaryTransport?: string;
  earnedCertificateFace?: EarnedCertificateFaceFields | null;
}

export interface DownloadedCertificatePdf {
  status: CertificatePdfStatus;
  bytes?: Uint8Array;
  provenance: CertificatePdfProvenance;
  errorMessage?: string;
}

export interface CertificateMonetaryBenefit {
  kind: CertificateBenefitKind;
  amount: number;
  evidence: string;
}

export interface CertificateSourceReference {
  page: number;
  group: string;
  pageAttribution: 'explicit' | 'inferred';
}

export interface ParsedCertificateSailing {
  certificateCode: string;
  certificateFamily: CertificateFamily;
  certificateFamilyCode: string | null;
  sourcePage: number;
  sourceGroup: string;
  sourceReferences: CertificateSourceReference[];
  pageAttribution: 'explicit' | 'inferred';
  shipName: string;
  sailingDate: string;
  departurePort?: string;
  itinerary?: string;
  offerTypeLabel?: string;
  nextCruiseBonusLabel?: string;
  cabinCategory?: string;
  occupancy?: string;
  guestCount?: number;
  freePlay?: number;
  onboardCredit?: number;
  tradeInValue?: number;
  pointRequirement?: number;
  benefits: CertificateMonetaryBenefit[];
  parserSource: 'backend' | 'device';
  parserVersion: string;
  documentHash?: string;
  documentVersion?: string;
  parsedAt: string;
  validationStatus: 'accepted' | 'quarantined';
  validationReasons?: string[];
}


export interface CertificateRejectedRow {
  sourcePage: number;
  sourceGroup: string;
  reason: string;
  evidence: string;
}

export interface CertificatePageReport {
  page: number;
  pageAttribution: 'explicit' | 'inferred';
  certificateCodes: string[];
  acceptedRows: number;
  rejectedRows: number;
  zeroSailingGroups: number;
  validationStatus: 'accepted' | 'partial' | 'quarantined';
  groups: CertificateGroupReport[];
}

export interface CertificateGroupReport {
  group: string;
  certificateCode: string;
  acceptedRows: number;
  rejectedRows: number;
  validationStatus: 'accepted' | 'partial' | 'quarantined';
}

export interface CertificateParseResult {
  status: CertificatePdfStatus;
  parserSource: 'backend' | 'device';
  parserVersion: string;
  sailings: ParsedCertificateSailing[];
  rejectedRows: CertificateRejectedRow[];
  pageReports: CertificatePageReport[];
  provenance: CertificatePdfProvenance;
  earnedCertificateFace?: EarnedCertificateFaceFields | null;
  warnings: string[];
}

export type DeviceCertificateParseResult = CertificateParseResult;

export interface CertificateParserReconciliation {
  status: 'equivalent' | 'disagreement' | 'single_source';
  retainedRows: ParsedCertificateSailing[];
  backendOnly: ParsedCertificateSailing[];
  deviceOnly: ParsedCertificateSailing[];
  warnings: string[];
}

export interface EarnedCertificateFaceFields {
  name?: string;
  crownAnchorNumber?: string;
  certificateCode?: string;
  awardType?: string;
  awardValue?: number;
  expirationDate?: string;
  shipName?: string;
  sailingDate?: string;
  tradeInValue?: number;
  pointsRequired?: number;
}

const ROYAL_CERTIFICATE_HOST_SUFFIX = 'royalcaribbean.com';
const CERTIFICATE_FAMILY_CODES = new Set(['A', 'C']);
const CERTIFICATE_CODE_REGEX = /\b(\d{4}[A-Z][A-Z0-9]{0,8})\b/gi;
// Royal's monthly index layout can place each visual part of a code in a
// separate PDF text object (for example, "260" + "6" + "A" + "VIP2").
// Keep this constrained to the published suffix shapes so nearby point totals
// cannot be mistaken for a certificate code.
const SPLIT_CERTIFICATE_CODE_REGEX = /\b((?:\d\s*){4}[A-Z]\s*(?:V\s*I\s*P\s*\d|\d\s*\d\s*[A-Z]?))\b/gi;
const DEVICE_PARSER_VERSION = 'certificate-parser-v2.4-hermes-explicit-date-parser';
const BACKEND_PARSER_VERSION = 'certificate-parser-v2';
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const EARNED_CERTIFICATE_POINT_REQUIREMENTS: Record<string, number> = {
  VIP2: 40000,
  '01': 25000,
  '02': 15000,
  '02A': 9000,
  '03': 6500,
  '03A': 4000,
  '04': 3000,
  '05': 2000,
  '06': 1500,
  '07': 1200,
  '08': 800,
  '09': 600,
  '10': 400,
};

const TIER_CERTIFICATE_TRADE_IN_VALUE = 2400;

function normalizeEarnedCertificateLevelCode(value: string): string {
  const level = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d$/.test(level)) return `0${level}`;
  return level;
}

function getEarnedCertificatePointRequirement(value: unknown): number | undefined {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = code.match(/^(\d{4})([ACD])((?:VIP\d+)|\d{1,2}[A-Z]?)$/);
  if (!match) return undefined;
  return EARNED_CERTIFICATE_POINT_REQUIREMENTS[normalizeEarnedCertificateLevelCode(match[3])];
}

function getEarnedTierCertificateTradeInValue(record: { offerCode?: string; awardType?: string; shipName?: string; notes?: string }): number {
  const fields = [record.offerCode, record.awardType, record.shipName, record.notes].map((value) => String(value ?? '')).join(' ');
  const offerCode = String(record.offerCode ?? '').trim().toUpperCase();
  const tierCode = offerCode === 'TIER' || /\b\d{2}TIER\d*\b/i.test(fields);
  const explicitTierReward = /\b(?:annual\s+(?:tier\s+)?cruise|(?:prime|signature|pinnacle)\s+(?:annual\s+)?cruise|(?:prime|signature|pinnacle)\s+certificate|(?:prime|signature|pinnacle)\s+reward|annual\s+(?:prime|signature|pinnacle)\s+reward)\b/i.test(fields);
  return tierCode || explicitTierReward ? TIER_CERTIFICATE_TRADE_IN_VALUE : 0;
}

function normalizeCode(value?: string | null): string | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  return /^\d{4}[A-Z][A-Z0-9]{0,8}$/.test(normalized) ? normalized : undefined;
}

function normalizePdfUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.toLowerCase().endsWith(ROYAL_CERTIFICATE_HOST_SUFFIX)) return null;
    return url;
  } catch {
    return null;
  }
}

function isPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function sha256DocumentHash(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15];
      const y = words[index - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      words[index] = (((words[index - 16] + s0) | 0) + ((words[index - 7] + s1) | 0)) >>> 0;
    }
    let a = h0; let b = h1; let c = h2; let d = h3; let e = h4; let f = h5; let g = h6; let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choice = (e & f) ^ (~e & g);
      const temp1 = (((((h + s1) | 0) + choice) | 0) + ((SHA256_K[index] + words[index]) | 0)) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return `sha256:${[h0, h1, h2, h3, h4, h5, h6, h7].map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('')}`;
}

function bytesToText(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('latin1').decode(bytes);
  let result = '';
  for (let index = 0; index < bytes.length; index += 8192) result += String.fromCharCode(...bytes.slice(index, index + 8192));
  return result;
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[escaped] ?? escaped))
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

type PakoRuntime = {
  inflate(input: Uint8Array): Uint8Array;
  inflateRaw(input: Uint8Array): Uint8Array;
};

const pakoRuntime: PakoRuntime = {
  inflate: (input) => pakoModule.inflate(input),
  inflateRaw: (input) => pakoModule.inflateRaw(input),
};

function getPakoRuntime(): PakoRuntime {
  // Static import is intentional. Metro/Hermes can omit a dependency that is
  // only reached through a guarded dynamic require, which caused real Royal
  // PDFs to download successfully but remain compressed and parse as zero rows.
  return pakoRuntime;
}

function uint8ToLatin1(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 1) result += String.fromCharCode(bytes[index]);
  return result;
}

function latin1ToUint8(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function readPdfLiteralAt(value: string, start: number): { text: string; end: number } {
  let raw = '';
  let position = start;
  let depth = 1;
  let escaping = false;
  while (position < value.length && depth > 0) {
    const character = value[position];
    if (escaping) {
      raw += `\\${character}`;
      escaping = false;
    } else if (character === '\\') {
      escaping = true;
    } else if (character === '(') {
      depth += 1;
      raw += character;
    } else if (character === ')') {
      depth -= 1;
      if (depth > 0) raw += character;
    } else {
      raw += character;
    }
    position += 1;
  }
  return { text: decodePdfLiteral(raw), end: position };
}

type PdfUnicodeMap = {
  codeWidth: number;
  characters: Map<string, string>;
};

function decodeUtf16BeHex(value: string): string {
  const normalized = value.replace(/\s/g, '').replace(/^FEFF/i, '');
  let result = '';
  for (let index = 0; index + 3 < normalized.length; index += 4) {
    const codeUnit = Number.parseInt(normalized.slice(index, index + 4), 16);
    if (Number.isFinite(codeUnit) && codeUnit !== 0) result += String.fromCharCode(codeUnit);
  }
  return result;
}

function parsePdfUnicodeMap(stream: string): PdfUnicodeMap | null {
  if (!/beginbf(?:char|range)/i.test(stream)) return null;
  const characters = new Map<string, string>();
  let codeWidth = 0;
  const add = (source: string, destination: string) => {
    const normalizedSource = source.replace(/\s/g, '').toUpperCase();
    if (!normalizedSource || normalizedSource.length % 2 !== 0 || characters.size >= 8192) return;
    const decoded = decodeUtf16BeHex(destination);
    if (!decoded) return;
    codeWidth = Math.max(codeWidth, normalizedSource.length);
    characters.set(normalizedSource, decoded);
  };

  for (const block of stream.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/gi)) {
    for (const pair of block[1].matchAll(/<([0-9A-F\s]+)>\s*<([0-9A-F\s]+)>/gi)) add(pair[1], pair[2]);
  }
  for (const block of stream.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/gi)) {
    for (const range of block[1].matchAll(/<([0-9A-F]+)>\s*<([0-9A-F]+)>\s*(?:<([0-9A-F]+)>|\[([^\]]+)\])/gi)) {
      const start = Number.parseInt(range[1], 16);
      const end = Number.parseInt(range[2], 16);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 4096) continue;
      const sourceWidth = range[1].length;
      if (range[4]) {
        const destinations = Array.from(range[4].matchAll(/<([0-9A-F\s]+)>/gi)).map((match) => match[1]);
        for (let offset = 0; offset <= end - start && offset < destinations.length; offset += 1) {
          add((start + offset).toString(16).padStart(sourceWidth, '0'), destinations[offset]);
        }
      } else if (range[3]) {
        const destinationStart = Number.parseInt(range[3], 16);
        const destinationWidth = range[3].length;
        if (!Number.isFinite(destinationStart)) continue;
        for (let offset = 0; offset <= end - start; offset += 1) {
          add(
            (start + offset).toString(16).padStart(sourceWidth, '0'),
            (destinationStart + offset).toString(16).padStart(destinationWidth, '0'),
          );
        }
      }
    }
  }
  return characters.size > 0 && codeWidth > 0 ? { codeWidth, characters } : null;
}

function readableTextScore(value: string): number {
  if (!value) return -1000;
  let score = 0;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (/[A-Za-z0-9 $,&.'®™:\/-]/.test(character)) score += 3;
    else if (character === '\n' || character === '\r' || character === '\t') score += 1;
    else if (code >= 32 && code !== 0x7f) score += 0.5;
    else score -= 6;
  }
  const certificateTerms = value.match(/\b(?:offer|code|ship|cruise|seas|sail|date|guest|interior|oceanview|balcony|suite|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi);
  score += (certificateTerms?.length ?? 0) * 25;
  return score;
}

function decodePdfHex(value: string, unicodeMaps: PdfUnicodeMap[]): string {
  let normalized = value.replace(/\s/g, '').toUpperCase();
  if (!normalized) return '';
  if (normalized.length % 2 !== 0) normalized += '0';
  const candidates: string[] = [];
  let latin1 = '';
  for (let index = 0; index < normalized.length; index += 2) {
    const byte = Number.parseInt(normalized.slice(index, index + 2), 16);
    if (Number.isFinite(byte) && byte !== 0) latin1 += String.fromCharCode(byte);
  }
  if (latin1) candidates.push(latin1);

  if (/^FEFF/i.test(normalized) || (normalized.length % 4 === 0 && (normalized.match(/00/g)?.length ?? 0) >= normalized.length / 8)) {
    const utf16 = decodeUtf16BeHex(normalized);
    if (utf16) candidates.push(utf16);
  }

  unicodeMaps.forEach((unicodeMap) => {
    if (normalized.length % unicodeMap.codeWidth !== 0) return;
    let decoded = '';
    let mapped = 0;
    const tokenCount = normalized.length / unicodeMap.codeWidth;
    for (let index = 0; index < normalized.length; index += unicodeMap.codeWidth) {
      const character = unicodeMap.characters.get(normalized.slice(index, index + unicodeMap.codeWidth));
      if (character) {
        decoded += character;
        mapped += 1;
      }
    }
    if (decoded && mapped / tokenCount >= 0.8) candidates.push(decoded);
  });

  return candidates.sort((left, right) => readableTextScore(right) - readableTextScore(left) || right.length - left.length)[0] ?? '';
}

function readPdfTextArray(value: string, start: number, unicodeMaps: PdfUnicodeMap[]): { text: string; end: number } {
  let position = start;
  let word = '';
  const words: string[] = [];
  while (position < value.length && value[position] !== ']') {
    while (/\s/.test(value[position] ?? '')) position += 1;
    if (value[position] === '(') {
      const literal = readPdfLiteralAt(value, position + 1);
      word += literal.text;
      position = literal.end;
    } else if (value[position] === '<') {
      const close = value.indexOf('>', position + 1);
      const hex = value.slice(position + 1, close < 0 ? value.length : close).replace(/\s/g, '');
      word += decodePdfHex(hex, unicodeMaps);
      position = close < 0 ? value.length : close + 1;
    } else if (/[-\d.]/.test(value[position] ?? '')) {
      let numeric = '';
      while (/[-\d.]/.test(value[position] ?? '')) numeric += value[position++];
      if (Math.abs(Number.parseFloat(numeric)) > 120 && word) {
        words.push(word);
        word = '';
      }
    } else {
      position += 1;
    }
  }
  if (word) words.push(word);
  return { text: words.join(' '), end: value[position] === ']' ? position + 1 : position };
}

function extractTextFromPdfContentStream(stream: string, unicodeMaps: PdfUnicodeMap[]): string {
  const segments: string[] = [];
  let position = 0;
  while (position < stream.length) {
    while (/\s/.test(stream[position] ?? '')) position += 1;
    if (stream[position] === '[') {
      const saved = position;
      const array = readPdfTextArray(stream, position + 1, unicodeMaps);
      position = array.end;
      while (/\s/.test(stream[position] ?? '')) position += 1;
      if (stream.slice(position, position + 2) === 'TJ') {
        position += 2;
        if (array.text.trim()) segments.push(array.text.trim());
        continue;
      }
      position = saved + 1;
      continue;
    }
    if (stream[position] === '(') {
      const saved = position;
      const literal = readPdfLiteralAt(stream, position + 1);
      position = literal.end;
      while (/\s/.test(stream[position] ?? '')) position += 1;
      if (stream.slice(position, position + 2) === 'Tj' || stream[position] === "'") {
        position += stream[position] === "'" ? 1 : 2;
        if (literal.text.trim()) segments.push(literal.text.trim());
        continue;
      }
      position = saved + 1;
      continue;
    }
    if (stream[position] === '<' && stream[position + 1] !== '<') {
      const saved = position;
      const close = stream.indexOf('>', position + 1);
      if (close > position) {
        const decoded = decodePdfHex(stream.slice(position + 1, close), unicodeMaps);
        position = close + 1;
        while (/\s/.test(stream[position] ?? '')) position += 1;
        if (stream.slice(position, position + 2) === 'Tj' || stream[position] === "'") {
          position += stream[position] === "'" ? 1 : 2;
          if (decoded.trim()) segments.push(decoded.trim());
          continue;
        }
      }
      position = saved + 1;
      continue;
    }
    position += 1;
  }
  return segments.join(' ');
}

function extractCompressedPdfText(bytes: Uint8Array): string {
  const pako = getPakoRuntime();
  if (!pako) return '';
  const raw = uint8ToLatin1(bytes);
  const decodedStreams: Array<{ stream: string; printableRatio: number }> = [];

  // Walk real PDF object bodies instead of pairing an arbitrary `<<` token
  // with a later stream. The object body may contain nested dictionaries, and
  // /Length may be either direct (`/Length 2046`) or indirect (`/Length 2 0 R`).
  // Treating the first number of an indirect reference as the byte length was
  // the reason some production July layouts produced zero or truncated rows.
  const objectHeaderPattern = /\b\d+\s+\d+\s+obj\b/g;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = objectHeaderPattern.exec(raw)) !== null) {
    const bodyStart = objectHeaderPattern.lastIndex;
    const endObject = raw.indexOf('endobj', bodyStart);
    if (endObject < 0) continue;

    const streamMarkerPattern = /\bstream(?:\r\n|\n|\r)/g;
    streamMarkerPattern.lastIndex = bodyStart;
    const streamMarker = streamMarkerPattern.exec(raw);
    if (!streamMarker || streamMarker.index >= endObject) continue;

    const dictionary = raw.slice(bodyStart, streamMarker.index);
    const streamStart = streamMarkerPattern.lastIndex;
    const lengthToken = dictionary.match(/\/Length\s+(\d+)(?:\s+(\d+)\s+R)?/);
    const hasDirectLength = Boolean(lengthToken?.[1] && !lengthToken?.[2]);

    let streamEnd: number;
    if (hasDirectLength) {
      streamEnd = streamStart + Number.parseInt(lengthToken![1], 10);
    } else {
      const endMarker = raw.indexOf('endstream', streamStart);
      if (endMarker < 0 || endMarker > endObject) continue;
      streamEnd = endMarker;
      while (streamEnd > streamStart && /[\r\n]/.test(raw[streamEnd - 1] ?? '')) streamEnd -= 1;
    }
    if (!Number.isFinite(streamEnd) || streamEnd <= streamStart || streamEnd > raw.length) continue;

    const streamBytes = latin1ToUint8(raw.slice(streamStart, streamEnd));
    let decoded: Uint8Array | undefined;
    try {
      decoded = dictionary.includes('/FlateDecode') ? pako.inflate(streamBytes) : streamBytes;
    } catch {
      try {
        decoded = dictionary.includes('/FlateDecode') ? pako.inflateRaw(streamBytes) : streamBytes;
      } catch {
        decoded = undefined;
      }
    }
    if (!decoded) continue;

    const decodedStream = uint8ToLatin1(decoded);
    const printableCharacters = Array.from(decodedStream).reduce((count, character) => {
      const code = character.charCodeAt(0);
      return count + (character === '\r' || character === '\n' || character === '\t' || (code >= 32 && code <= 126) ? 1 : 0);
    }, 0);
    const printableRatio = decodedStream.length > 0 ? printableCharacters / decodedStream.length : 0;

    decodedStreams.push({ stream: decodedStream, printableRatio });
  }
  // Royal periodically changes the embedded font encoding in its monthly
  // Excel-generated PDFs. Decode embedded ToUnicode CMaps before interpreting
  // hexadecimal Tj/TJ strings so a valid PDF cannot silently yield zero rows.
  const unicodeMaps = decodedStreams
    .map(({ stream }) => parsePdfUnicodeMap(stream))
    .filter((map): map is PdfUnicodeMap => map !== null);
  const streams: string[] = [];
  decodedStreams.forEach(({ stream, printableRatio }) => {
    // Content streams are text-like and use PDF text-showing operators. This
    // excludes font programs, images and unrelated object streams.
    if (printableRatio < 0.75) return;
    if (!/(?:\bTj\b|\bTJ\b|[>)]\s*')/.test(stream)) return;
    const text = extractTextFromPdfContentStream(stream, unicodeMaps);
    if (text.trim()) streams.push(text.trim());
  });
  return streams.join('\n').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

export function extractCertificatePdfText(bytes: Uint8Array): string {
  const compressedText = extractCompressedPdfText(bytes);
  if (compressedText.length >= 20) return compressedText;
  const raw = bytesToText(bytes);
  return Array.from(raw.matchAll(/\((?:\\.|[^()\\])*\)/g))
    .map((match) => decodePdfLiteral(match[0].slice(1, -1)))
    .filter((fragment) => /[A-Za-z0-9]/.test(fragment) || fragment.includes('\f'))
    .join('\n')
    .replace(/\u0000/g, '')
    .trim();
}

function parseCurrency(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeDate(value: string): string | undefined {
  return normalizeCertificateSailingDate(value) ?? undefined;
}

const EARNED_CERTIFICATE_FACE_LABELS = [
  'Name',
  'Crown & Anchor Number',
  'Offer Code',
  'Award Type',
  'Expiration Date',
  'Ship Name',
  'Sailing Date',
  'Trade In Value',
] as const;

type EarnedCertificateFaceLabel = typeof EARNED_CERTIFICATE_FACE_LABELS[number];

function labelPattern(label: string): string {
  return label
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s*&\s*/g, '\\s*(?:&|and)\\s*')
    .replace(/\s+/g, '\\s+');
}

function cleanFaceValue(value?: string): string | undefined {
  const cleaned = value?.replace(/\s{2,}/g, ' ').trim();
  if (!cleaned) return undefined;
  if (EARNED_CERTIFICATE_FACE_LABELS.some((label) => new RegExp(`^${labelPattern(label)}\\s*:?$`, 'i').test(cleaned))) {
    return undefined;
  }
  if (EARNED_CERTIFICATE_FACE_LABELS.some((label) => new RegExp(`^${labelPattern(label)}\\s*:`, 'i').test(cleaned))) {
    return undefined;
  }
  return cleaned;
}

function matchFaceLabelOnly(line: string): EarnedCertificateFaceLabel | null {
  const normalized = line.trim();
  for (const label of EARNED_CERTIFICATE_FACE_LABELS) {
    if (new RegExp(`^${labelPattern(label)}\\s*:?$`, 'i').test(normalized)) {
      return label;
    }
  }
  return null;
}

function isFaceBoilerplateLine(line: string): boolean {
  return /^(?:scan\b|booking bonus\b|contact\b|casino reservation center\b|independent casino representative\b|section\b|stateroom\b|only one instant|to qualify|visit\b|app\.see\b)/i.test(line.trim());
}

function extractColumnarFaceFields(text: string): Partial<Record<EarnedCertificateFaceLabel, string>> {
  const normalized = String(text ?? '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const labelEntries: Array<{ label: EarnedCertificateFaceLabel; index: number }> = [];
  const fields: Partial<Record<EarnedCertificateFaceLabel, string>> = {};

  lines.forEach((line, index) => {
    const label = matchFaceLabelOnly(line);
    if (!label) return;
    labelEntries.push({ label, index });
    const next = lines[index + 1];
    if (next && !matchFaceLabelOnly(next) && !isFaceBoilerplateLine(next)) {
      fields[label] = cleanFaceValue(next);
    }
  });

  const coreLabels = new Set(labelEntries.map((entry) => entry.label));
  const hasCertificateFaceBlock = coreLabels.has('Offer Code')
    && coreLabels.has('Award Type')
    && coreLabels.has('Expiration Date')
    && coreLabels.has('Ship Name')
    && coreLabels.has('Sailing Date');
  if (hasCertificateFaceBlock) {
    const orderedLabels = EARNED_CERTIFICATE_FACE_LABELS.filter((label) => coreLabels.has(label));
    const lastLabelIndex = Math.max(...labelEntries.map((entry) => entry.index));
    const valueCandidates = lines
      .slice(lastLabelIndex + 1)
      .filter((line) => !matchFaceLabelOnly(line) && !isFaceBoilerplateLine(line))
      .slice(0, orderedLabels.length);
    orderedLabels.forEach((label, index) => {
      fields[label] = cleanFaceValue(valueCandidates[index]) ?? fields[label];
    });
  }

  return fields;
}

function extractFaceField(text: string, label: EarnedCertificateFaceLabel, options?: { includeFlatFallback?: boolean }): string | undefined {
  const normalized = String(text ?? '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ');
  const pattern = labelPattern(label);
  for (const line of normalized.split('\n')) {
    const match = new RegExp(`^${pattern}(?:\\s*:\\s*|\\s+)(.+)$`, 'i').exec(line.trim());
    const value = cleanFaceValue(match?.[1]);
    if (value) return value;
  }
  if (options?.includeFlatFallback === false) {
    return undefined;
  }
  const nextLabels = EARNED_CERTIFICATE_FACE_LABELS
    .filter((entry) => entry !== label)
    .map(labelPattern)
    .join('|');
  const flat = normalized.replace(/\n+/g, ' ');
  const match = new RegExp(`\\b${pattern}(?:\\s*:\\s*|\\s+)([\\s\\S]{1,120}?)(?=\\s+\\b(?:${nextLabels})\\s*:?|$)`, 'i').exec(flat);
  return cleanFaceValue(match?.[1]);
}

function normalizeFaceDate(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  const direct = normalizeDate(normalized);
  if (direct) return direct;
  const dayMonthYear = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/i);
  if (dayMonthYear) {
    return normalizeDate(`${dayMonthYear[2]} ${dayMonthYear[1]}, ${dayMonthYear[3]}`);
  }
  return undefined;
}

export function extractEarnedCertificateFaceFields(text: string): EarnedCertificateFaceFields | null {
  const columnarFields = extractColumnarFaceFields(text);
  const field = (label: EarnedCertificateFaceLabel): string | undefined => extractFaceField(text, label, { includeFlatFallback: false }) ?? columnarFields[label] ?? extractFaceField(text, label);
  const offerCode = field('Offer Code')?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const shipName = field('Ship Name');
  const sailingDate = normalizeFaceDate(field('Sailing Date'));
  const hasCoreIdentity = Boolean(offerCode || shipName || sailingDate);
  const hasFaceLabels = /Crown\s*(?:&|and)\s*Anchor\s*Number/i.test(text)
    && /Offer\s*Code/i.test(text)
    && /Award\s*Type/i.test(text);
  if (!hasCoreIdentity || !hasFaceLabels) return null;

  const awardType = field('Award Type');
  const awardValue = parseCurrency(awardType?.match(/\$?\s*([0-9][0-9,]*)/)?.[1]);
  const tradeInValue = parseCurrency(field('Trade In Value')?.match(/\$?\s*([0-9][0-9,]*)/)?.[1])
    ?? getEarnedTierCertificateTradeInValue({ offerCode, awardType, shipName, notes: text });
  return {
    name: field('Name'),
    crownAnchorNumber: field('Crown & Anchor Number')?.replace(/\D/g, ''),
    certificateCode: offerCode,
    awardType,
    awardValue,
    expirationDate: normalizeFaceDate(field('Expiration Date')),
    shipName,
    sailingDate,
    tradeInValue: tradeInValue || undefined,
    pointsRequired: getEarnedCertificatePointRequirement(offerCode),
  };
}

function cleanShipName(value: string): string | undefined {
  const normalized = value
    .replace(CERTIFICATE_CODE_REGEX, ' ')
    .replace(/\b(?:sailing|departure|date|ship|nights?|interior|oceanview|ocean\s*view|balcony|suite|free\s*play|on\s*board\s*credit|obc|trade[\s-]*in|points?)\b/gi, ' ')
    .replace(/\$[\d,]+/g, ' ')
    .replace(/[|;]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (normalized.length < 3 || normalized.length > 80 || !/[A-Za-z]/.test(normalized)) return undefined;
  return normalized;
}

function extractBenefits(section: string): CertificateMonetaryBenefit[] {
  const definitions: Array<{ kind: CertificateBenefitKind; label: RegExp }> = [
    { kind: 'free_play', label: /(?:free\s*play|freeplay|\bfp\b)/i },
    { kind: 'onboard_credit', label: /(?:obc|on[-\s]*board credit)/i },
    { kind: 'trade_in_value', label: /(?:trade[\s-]*in(?:\s*value)?)/i },
  ];
  const benefits: CertificateMonetaryBenefit[] = [];
  const identities = new Set<string>();
  section.split(/\r?\n/).filter(Boolean).forEach((line) => {
    definitions.forEach(({ kind, label }) => {
      const labelFirst = new RegExp(`${label.source}\\D{0,24}?\\$?\\s*([0-9][0-9,]*)`, 'gi');
      const amountFirst = new RegExp(`\\$\\s*([0-9][0-9,]*)\\s*(?:in\\s*)?${label.source}`, 'gi');
      const matches = [...line.matchAll(amountFirst), ...line.matchAll(labelFirst)];
      matches.forEach((match) => {
        const amount = parseCurrency(match[1]);
        if (amount === undefined) return;
        const prefix = line.slice(0, match.index ?? 0);
        const competingLabelAppearsFirst = definitions.some((candidate) => candidate.kind !== kind && candidate.label.test(prefix));
        if (competingLabelAppearsFirst && (match.index ?? 0) > 0 && match[0].trimStart().startsWith('$')) return;
        const identity = `${kind}:${amount}:${match[0].replace(/\s+/g, ' ').toLowerCase()}`;
        if (identities.has(identity)) return;
        identities.add(identity);
        benefits.push({ kind, amount, evidence: match[0].replace(/\s+/g, ' ').trim() });
      });
    });
  });
  return benefits;
}

function firstBenefit(benefits: CertificateMonetaryBenefit[], kind: CertificateBenefitKind): number | undefined {
  return benefits.find((benefit) => benefit.kind === kind)?.amount;
}

function findPointRequirement(section: string): number | undefined {
  const match = section.match(/\b([0-9][0-9,]*)\s*(?:casino\s*)?points?\b/i);
  return match?.[1] ? parseCurrency(match[1]) : undefined;
}

function dateIndices(lines: string[], pattern: RegExp): number[] {
  return lines.reduce<number[]>((indices, line, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(line)) indices.push(index);
    return indices;
  }, []);
}

interface PipelineColumnarSailingFact {
  shipName: string;
  sailDate: string;
  cabinLabel: string | null;
  guestCount: number | null;
  onBoardCredit: number | null;
}

function extractPipelineColumnarSailingFacts(code: string, section: string): PipelineColumnarSailingFact[] {
  const normalized = section.replace(/\s+/g, ' ').trim();
  const requiredHeadings = [/Offer\s*Code/i, /Ship/i, /Departure\s*Port/i, /Sail\s*Date/i, /Itinerary/i, /Stateroom\s*Type/i, /Offer\s*Type/i];
  if (!requiredHeadings.every((heading) => heading.test(normalized))) return [];

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const codeCount = Array.from(normalized.matchAll(new RegExp(`\\b${escapedCode}\\b`, 'gi'))).length;
  const shipMatches = Array.from(normalized.matchAll(/\b([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*){0,3}\s+Of\s+The\s+Seas|Mardi\s+Gras)\s*(?:®|™)?/gi))
    .filter((match) => match.index != null)
    .map((match) => ({ shipName: match[1].replace(/\s+/g, ' ').trim(), index: match.index! }));
  const datePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi;
  const dateMatches = Array.from(normalized.matchAll(datePattern))
    .filter((match) => match.index != null)
    .map((match) => ({ sailDate: normalizeDate(match[1]), index: match.index! }))
    .filter((match): match is { sailDate: string; index: number } => Boolean(match.sailDate));
  const rowCount = shipMatches.length;
  if (rowCount === 0 || codeCount < rowCount || dateMatches.length < rowCount || dateMatches.length > rowCount + 3) return [];

  const cabinMatches = Array.from(normalized.matchAll(/\b(Interior|Ocean\s*View|Oceanview|Balcony|Junior\s*Suite|Grand\s*Suite|Owner'?s\s*Suite|Suite)\s*(?:-\s*GTY)?\b/gi))
    .map((match) => match[1].replace(/\s+/g, ' ').trim());
  const guestMatches = Array.from(normalized.matchAll(/\bCruise\s*Fare\s*For\s*(\d+)\s*Guests?\b/gi))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  const obcMatches = /Next\s*Cruise\s*OBC/i.test(normalized)
    ? Array.from(normalized.matchAll(/\$\s*([0-9][0-9,]*)/g))
      .map((match) => Number.parseInt(match[1].replace(/,/g, ''), 10))
      .filter((value) => Number.isFinite(value) && value >= 0)
    : [];

  return shipMatches.map((ship, index) => ({
    shipName: ship.shipName,
    sailDate: dateMatches[index].sailDate,
    cabinLabel: cabinMatches.length >= rowCount ? cabinMatches[index] ?? null : null,
    guestCount: guestMatches.length >= rowCount ? guestMatches[index] ?? null : null,
    onBoardCredit: obcMatches.length === rowCount ? obcMatches[index] ?? null : null,
  }));
}

function findColumnarCertificateRows(
  section: string,
  code: string,
  source: { page: number; group: string; pageAttribution: 'explicit' | 'inferred'; parserSource: 'backend' | 'device'; parserVersion: string; provenance: CertificatePdfProvenance; parsedAt: string },
): ParsedCertificateSailing[] {
  const familyDefinition = getCertificateFamilyDefinition(code);
  return extractPipelineColumnarSailingFacts(code, section).map((fact, index) => {
    const group = `${source.group}-columnar-${index + 1}`;
    const benefits: CertificateMonetaryBenefit[] = fact.onBoardCredit !== null
      ? [{ kind: 'onboard_credit', amount: fact.onBoardCredit, evidence: `$${fact.onBoardCredit} Next Cruise OBC` }]
      : [];
    return {
      certificateCode: code,
      certificateFamily: familyDefinition.family,
      certificateFamilyCode: familyDefinition.familyCode,
      sourcePage: source.page,
      sourceGroup: group,
      sourceReferences: [{ page: source.page, group, pageAttribution: source.pageAttribution }],
      pageAttribution: source.pageAttribution,
      shipName: fact.shipName,
      sailingDate: fact.sailDate,
      cabinCategory: fact.cabinLabel ?? undefined,
      occupancy: fact.guestCount !== null ? `${fact.guestCount} guest${fact.guestCount === 1 ? '' : 's'}` : undefined,
      guestCount: fact.guestCount ?? undefined,
      onboardCredit: fact.onBoardCredit ?? undefined,
      pointRequirement: undefined,
      benefits,
      parserSource: source.parserSource,
      parserVersion: source.parserVersion,
      documentHash: source.provenance.documentHash,
      documentVersion: source.provenance.documentVersion,
      parsedAt: source.parsedAt,
      validationStatus: 'accepted',
    };
  });
}

function findCompactCertificateRows(
  section: string,
  code: string,
  source: { page: number; group: string; pageAttribution: 'explicit' | 'inferred'; parserSource: 'backend' | 'device'; parserVersion: string; provenance: CertificatePdfProvenance; parsedAt: string },
): { rows: ParsedCertificateSailing[]; rejectedRows: CertificateRejectedRow[] } {
  const familyDefinition = getCertificateFamilyDefinition(code);
  const shipAndDate = /\b([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*){0,3}\s+Of\s+The\s+Seas|Mardi\s+Gras)\s*(?:®|™)?[\s\S]{0,180}?\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi;
  const matches = Array.from(section.matchAll(shipAndDate));
  const rows: ParsedCertificateSailing[] = [];
  const rejectedRows: CertificateRejectedRow[] = [];
  matches.forEach((match, index) => {
    const shipName = match[1]?.replace(/\s+/g, ' ').trim();
    const sailingDate = normalizeDate(match[2] ?? '');
    const rowStart = match.index ?? 0;
    const nextShipStart = matches[index + 1]?.index ?? section.length;
    const nextCodeMatcher = new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    nextCodeMatcher.lastIndex = Math.max(rowStart + match[0].length, rowStart + 1);
    const nextCodeMatch = nextCodeMatcher.exec(section);
    const rowEnd = nextCodeMatch?.index != null && nextCodeMatch.index < nextShipStart ? nextCodeMatch.index : nextShipStart;
    const rowSection = section.slice(rowStart, Math.min(section.length, rowEnd));
    if (!shipName || !sailingDate) {
      rejectedRows.push({ sourcePage: source.page, sourceGroup: source.group, reason: !sailingDate ? 'invalid_sailing_date' : 'missing_ship_name', evidence: rowSection.slice(0, 400) });
      return;
    }
    const benefits = extractBenefits(rowSection);
    if (/Next\s*Cruise\s*OBC/i.test(section) && !benefits.some((benefit) => benefit.kind === 'onboard_credit')) {
      const freePlayMatch = rowSection.match(/\$\s*([0-9][0-9,]*)\s*(?:in\s*)?(?:Free\s*Play|FreePlay|FP)\b/i);
      if (freePlayMatch?.index != null) {
        const after = rowSection.slice(freePlayMatch.index + freePlayMatch[0].length);
        const obcMatch = after.match(/\$\s*([0-9][0-9,]*)/);
        const amount = parseCurrency(obcMatch?.[1]);
        if (amount !== undefined) benefits.push({ kind: 'onboard_credit', amount, evidence: `${obcMatch?.[0] ?? `$${amount}`} Next Cruise OBC` });
      }
    }
    const cabinMatch = rowSection.match(/\b(interior|ocean\s*view|balcony|junior\s*suite|grand\s*suite|owner'?s\s*suite|suite)\b/i);
    const occupancyMatch = rowSection.match(/\b(\d+\s*(?:guests?|people|passengers?)|double occupancy|single occupancy)\b/i);
    const guestCount = occupancyMatch
      ? (/single occupancy/i.test(occupancyMatch[1]) ? 1 : /double occupancy/i.test(occupancyMatch[1]) ? 2 : Number.parseInt(occupancyMatch[1], 10))
      : undefined;
    const group = `${source.group}-compact-${index + 1}`;
    rows.push({
      certificateCode: code,
      certificateFamily: familyDefinition.family,
      certificateFamilyCode: familyDefinition.familyCode,
      sourcePage: source.page,
      sourceGroup: group,
      sourceReferences: [{ page: source.page, group, pageAttribution: source.pageAttribution }],
      pageAttribution: source.pageAttribution,
      shipName,
      sailingDate,
      cabinCategory: cabinMatch?.[1],
      occupancy: occupancyMatch?.[1],
      guestCount: Number.isFinite(guestCount) ? guestCount : undefined,
      freePlay: firstBenefit(benefits, 'free_play'),
      onboardCredit: firstBenefit(benefits, 'onboard_credit'),
      tradeInValue: firstBenefit(benefits, 'trade_in_value'),
      pointRequirement: findPointRequirement(rowSection),
      benefits,
      parserSource: source.parserSource,
      parserVersion: source.parserVersion,
      documentHash: source.provenance.documentHash,
      documentVersion: source.provenance.documentVersion,
      parsedAt: source.parsedAt,
      validationStatus: 'accepted',
    });
  });
  return { rows, rejectedRows };
}

function findSailingRows(
  section: string,
  code: string,
  source: { page: number; group: string; pageAttribution: 'explicit' | 'inferred'; parserSource: 'backend' | 'device'; parserVersion: string; provenance: CertificatePdfProvenance; parsedAt: string },
): { rows: ParsedCertificateSailing[]; rejectedRows: CertificateRejectedRow[] } {
  // Royal's production Excel-generated PDFs expose a whole table as one text
  // run. Treating that run as one line would attach the departure port to the
  // ship name and bleed benefits across every date on the page.
  if (
    (section.length > 400 && /Offer\s+Code\s+Ship\s+Departure\s+Port/i.test(section))
    || (!section.includes('\n') && /\b(?:[A-Z][A-Za-z'’-]*\s+Of\s+The\s+Seas|Mardi\s+Gras)\b/i.test(section))
  ) {
    const compact = findCompactCertificateRows(section, code, source);
    if (compact.rows.length > 0) return compact;
    const columnarRows = findColumnarCertificateRows(section, code, source);
    return columnarRows.length > 0 ? { rows: columnarRows, rejectedRows: [] } : compact;
  }
  const familyDefinition = getCertificateFamilyDefinition(code);
  const lines = section.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const datePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi;
  const rowDateIndices = dateIndices(lines, datePattern);
  const rows: ParsedCertificateSailing[] = [];
  const rejectedRows: CertificateRejectedRow[] = [];

  rowDateIndices.forEach((lineIndex, dateIndex) => {
    const line = lines[lineIndex];
    datePattern.lastIndex = 0;
    const dateMatch = datePattern.exec(line);
    datePattern.lastIndex = 0;
    if (!dateMatch) return;
    const sailingDate = normalizeDate(dateMatch[1]);
    const nextBoundary = rowDateIndices[dateIndex + 1] ?? lines.length;
    const start = lineIndex;
    const end = nextBoundary;
    const rowSection = lines.slice(start, end).join('\n');
    const candidateShip = cleanShipName(line.slice(0, dateMatch.index).replace(/[|,;]+$/g, '').trim())
      ?? cleanShipName(lines[lineIndex - 1] ?? '')
      ?? cleanShipName(lines[lineIndex + 1] ?? '');

    if (!sailingDate || !candidateShip || !/(?:of\s+the\s+seas|mardi\s+gras)$/i.test(candidateShip)) {
      rejectedRows.push({ sourcePage: source.page, sourceGroup: source.group, reason: !sailingDate ? 'invalid_sailing_date' : 'missing_or_unrecognized_ship_name', evidence: rowSection.slice(0, 400) });
      return;
    }

    const benefits = extractBenefits(rowSection);
    const cabinMatch = rowSection.match(/\b(interior|ocean\s*view|balcony|junior\s*suite|grand\s*suite|owner'?s\s*suite|suite)\b/i);
    const occupancyMatch = rowSection.match(/\b(\d+\s*(?:guests?|people|passengers?)|double occupancy|single occupancy)\b/i);
    const guestCount = occupancyMatch
      ? (/single occupancy/i.test(occupancyMatch[1]) ? 1 : /double occupancy/i.test(occupancyMatch[1]) ? 2 : Number.parseInt(occupancyMatch[1], 10))
      : undefined;
    rows.push({
      certificateCode: code,
      certificateFamily: familyDefinition.family,
      certificateFamilyCode: familyDefinition.familyCode,
      sourcePage: source.page,
      sourceGroup: `${source.group}-sailing-${lineIndex + 1}`,
      sourceReferences: [{ page: source.page, group: `${source.group}-sailing-${lineIndex + 1}`, pageAttribution: source.pageAttribution }],
      pageAttribution: source.pageAttribution,
      shipName: candidateShip,
      sailingDate,
      cabinCategory: cabinMatch?.[1],
      occupancy: occupancyMatch?.[1],
      guestCount: Number.isFinite(guestCount) ? guestCount : undefined,
      freePlay: firstBenefit(benefits, 'free_play'),
      onboardCredit: firstBenefit(benefits, 'onboard_credit'),
      tradeInValue: firstBenefit(benefits, 'trade_in_value'),
      pointRequirement: findPointRequirement(rowSection),
      benefits,
      parserSource: source.parserSource,
      parserVersion: source.parserVersion,
      documentHash: source.provenance.documentHash,
      documentVersion: source.provenance.documentVersion,
      parsedAt: source.parsedAt,
      validationStatus: 'accepted',
    });
  });
  if (rows.length > 0) return { rows, rejectedRows };
  const compact = findCompactCertificateRows(section, code, source);
  if (compact.rows.length > 0) return compact;
  const columnarRows = findColumnarCertificateRows(section, code, source);
  return columnarRows.length > 0 ? { rows: columnarRows, rejectedRows: [] } : compact;
}

function materialIdentity(row: ParsedCertificateSailing): string {
  return [
    row.documentHash ?? '',
    row.certificateCode,
    row.sourcePage,
    row.sourceGroup,
    row.shipName.toLowerCase(),
    row.sailingDate,
    row.cabinCategory?.toLowerCase() ?? '',
    row.occupancy?.toLowerCase() ?? '',
    row.guestCount ?? '',
    row.pointRequirement ?? '',
    row.benefits.map((benefit) => `${benefit.kind}:${benefit.amount}`).sort().join(','),
  ].join('|');
}

/** A parser comparison is about the same document content, not transport metadata. */
function parserComparisonIdentity(row: ParsedCertificateSailing): string {
  return [
    row.certificateCode,
    row.sourcePage,
    row.sourceGroup,
    row.shipName.toLowerCase(),
    row.sailingDate,
    row.cabinCategory?.toLowerCase() ?? '',
    row.occupancy?.toLowerCase() ?? '',
    row.guestCount ?? '',
    row.pointRequirement ?? '',
    row.benefits.map((benefit) => `${benefit.kind}:${benefit.amount}`).sort().join(','),
  ].join('|');
}

export function getCertificateSailingGroupCount(rows: ParsedCertificateSailing[]): number {
  return new Set(rows.map((row) => `${row.documentHash ?? ''}|${row.certificateCode}|${row.sourcePage}|${row.sourceGroup}`)).size;
}

export function dedupeCertificateSailings(rows: ParsedCertificateSailing[]): ParsedCertificateSailing[] {
  const deduped = new Map<string, ParsedCertificateSailing>();
  rows.forEach((row) => {
    const key = materialIdentity(row);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { ...row, sourceReferences: [...row.sourceReferences] });
      return;
    }
    const references = [...existing.sourceReferences, ...row.sourceReferences].filter((reference, index, all) => all.findIndex((candidate) => candidate.page === reference.page && candidate.group === reference.group) === index);
    deduped.set(key, { ...existing, sourceReferences: references });
  });
  return Array.from(deduped.values());
}

export function getCertificateFamilyDefinition(code?: string | null): CertificateFamilyDefinition {
  const normalized = normalizeCode(code);
  const familyCode = normalized?.[4] ?? null;
  if (familyCode === 'A' || familyCode === 'C') {
    return { family: familyCode, familyCode, codeClassification: 'certificate', known: true, layout: 'standard' };
  }
  if (familyCode === 'D') {
    return { family: 'unclassified', familyCode, codeClassification: 'marketing_offer', known: false, layout: 'unknown' };
  }
  return { family: 'unclassified', familyCode, codeClassification: 'unclassified', known: false, layout: 'unknown' };
}

export function classifyCertificateFamily(code?: string | null): CertificateFamily {
  return getCertificateFamilyDefinition(code).family;
}

export function isCertificateCode(code?: string | null): boolean {
  return getCertificateFamilyDefinition(code).codeClassification === 'certificate';
}

function extractCertificateCodeCandidates(text: string): string[] {
  const directCodes = Array.from(text.matchAll(CERTIFICATE_CODE_REGEX)).map((match) => match[1].toUpperCase());
  const splitCodes = Array.from(text.matchAll(SPLIT_CERTIFICATE_CODE_REGEX))
    .map((match) => match[1].replace(/\s/g, '').toUpperCase())
    .filter((code) => normalizeCode(code) !== undefined);
  return Array.from(new Set([...directCodes, ...splitCodes]));
}

export function discoverCertificateCodesFromText(text: string, options?: { monthCode?: string; familyCodes?: string[] }): string[] {
  const monthCode = options?.monthCode?.trim();
  const families = new Set((options?.familyCodes ?? []).map((family) => family.toUpperCase()).filter((family) => CERTIFICATE_FAMILY_CODES.has(family)));
  return extractCertificateCodeCandidates(text)
    .filter((code) => isCertificateCode(code))
    .filter((code) => !monthCode || code.startsWith(monthCode))
    .filter((code) => families.size === 0 || families.has(code[4]));
}

export function discoverCertificateCodesFromDownloadedPdf(download: DownloadedCertificatePdf, options?: { monthCode?: string; familyCodes?: string[] }): string[] {
  if (download.status !== 'downloaded' || !download.bytes || !isPdfSignature(download.bytes)) return [];
  return discoverCertificateCodesFromText(extractCertificatePdfText(download.bytes), options);
}

function parseCertificateText(
  text: string,
  options: { expectedCode?: string; parserSource: 'backend' | 'device'; parserVersion: string; provenance: CertificatePdfProvenance },
): CertificateParseResult {
  const parsedAt = new Date().toISOString();
  const warnings: string[] = [];
  const normalizedExpected = normalizeCode(options.expectedCode);
  const expectedDefinition = getCertificateFamilyDefinition(normalizedExpected);
  if (normalizedExpected && expectedDefinition.codeClassification !== 'certificate') {
    return createNonCertificateCodeResult(normalizedExpected, options.parserSource, options.parserVersion, options.provenance);
  }
  const earnedCertificateFace = extractEarnedCertificateFaceFields(text);
  const textCandidateCodes = extractCertificateCodeCandidates(text);
  const textCodes = discoverCertificateCodesFromText(text);
  const expectedCodeMismatch = Boolean(normalizedExpected && textCandidateCodes.length > 0 && !textCandidateCodes.includes(normalizedExpected));
  const codes = textCodes.length > 0 ? textCodes : expectedCodeMismatch ? [] : normalizedExpected ? [normalizedExpected] : [];
  const pageSections = text.split('\f');
  const pageAttribution: 'explicit' | 'inferred' = pageSections.length > 1 ? 'explicit' : 'inferred';
  const extractedRows: ParsedCertificateSailing[] = [];
  const rejectedRows: CertificateRejectedRow[] = [];
  const pageReports: CertificatePageReport[] = [];

  if (expectedCodeMismatch) warnings.push(`Expected certificate code ${normalizedExpected} was not visible in the extracted PDF text.`);
  pageSections.forEach((pageText, pageIndex) => {
    const pageCodes = discoverCertificateCodesFromText(pageText);
    const directMatches = Array.from(pageText.matchAll(CERTIFICATE_CODE_REGEX));
    const pageGroups = normalizedExpected
      ? [{ code: normalizedExpected, text: pageText }]
      : pageCodes.length > 0
        ? directMatches
          .map((match, index, matches) => ({ code: match[1].toUpperCase(), text: pageText.slice(match.index, matches[index + 1]?.index) }))
          .filter((group) => isCertificateCode(group.code))
        : codes.map((code) => ({ code, text: pageText }));
    let acceptedRows = 0;
    let rejectedCount = 0;
    let zeroSailingGroups = 0;
    const groups: CertificateGroupReport[] = [];
    pageGroups.forEach((group, groupIndex) => {
      const groupName = `page-${pageIndex + 1}-group-${groupIndex + 1}`;
      const parsed = findSailingRows(group.text, group.code, {
        page: pageIndex + 1,
        group: groupName,
        pageAttribution,
        parserSource: options.parserSource,
        parserVersion: options.parserVersion,
        provenance: options.provenance,
        parsedAt,
      });
      extractedRows.push(...parsed.rows);
      rejectedRows.push(...parsed.rejectedRows);
      acceptedRows += parsed.rows.length;
      rejectedCount += parsed.rejectedRows.length;
      const validationStatus: CertificateGroupReport['validationStatus'] = parsed.rows.length > 0 && parsed.rejectedRows.length === 0
        ? 'accepted'
        : parsed.rows.length > 0
          ? 'partial'
          : 'quarantined';
      if (parsed.rows.length === 0) zeroSailingGroups += 1;
      groups.push({
        group: groupName,
        certificateCode: group.code,
        acceptedRows: parsed.rows.length,
        rejectedRows: parsed.rejectedRows.length,
        validationStatus,
      });
    });
    const validationStatus: CertificatePageReport['validationStatus'] = groups.length === 0
      ? 'quarantined'
      : groups.every((group) => group.validationStatus === 'accepted')
        ? 'accepted'
        : groups.some((group) => group.acceptedRows > 0)
          ? 'partial'
          : 'quarantined';
    pageReports.push({
      page: pageIndex + 1,
      pageAttribution,
      certificateCodes: pageCodes,
      acceptedRows,
      rejectedRows: rejectedCount,
      zeroSailingGroups,
      validationStatus,
      groups,
    });
  });

  const sailings = dedupeCertificateSailings(extractedRows);
  if (rejectedRows.length > 0) warnings.push(`${rejectedRows.length} row candidate(s) were quarantined because ship or sailing-date evidence was incomplete.`);
  const incompleteGroups = pageReports.reduce((count, page) => count + page.groups.filter((group) => group.validationStatus !== 'accepted').length, 0);
  if (incompleteGroups > 0) warnings.push(`${incompleteGroups} certificate group(s) did not produce fully validated sailing rows.`);
  const status: CertificatePdfStatus = sailings.length === 0 ? 'parsed_zero_sailings' : warnings.length > 0 ? 'parsed_with_warnings' : 'parsed_successfully';
  return {
    status,
    parserSource: options.parserSource,
    parserVersion: options.parserVersion,
    sailings,
    rejectedRows,
    pageReports,
    provenance: { ...options.provenance, parserSource: options.parserSource, parserVersion: options.parserVersion, parseStatus: status, warnings: warnings.length > 0 ? warnings : undefined, earnedCertificateFace },
    earnedCertificateFace,
    warnings,
  };
}

function createNonCertificateCodeResult(
  code: string,
  parserSource: 'backend' | 'device',
  parserVersion: string,
  provenance: CertificatePdfProvenance,
): CertificateParseResult {
  const definition = getCertificateFamilyDefinition(code);
  const warning = definition.codeClassification === 'marketing_offer'
    ? `${code} is a marketing offer code, not an A or C certificate.`
    : `${code} is not a recognized A or C certificate code.`;
  return {
    status: 'parse_failed',
    parserSource,
    parserVersion,
    sailings: [],
    rejectedRows: [],
    pageReports: [],
    provenance: { ...provenance, parserSource, parserVersion, parseStatus: 'parse_failed', warnings: [warning] },
    warnings: [warning],
  };
}

export function isCertificateParseFullyValidated(result: CertificateParseResult): boolean {
  return result.status === 'parsed_successfully'
    && result.pageReports.length > 0
    && result.pageReports.every((page) => page.validationStatus === 'accepted');
}

export function parseCertificatePdfTextOnBackend(text: string, provenance: CertificatePdfProvenance, expectedCode?: string): CertificateParseResult {
  const normalizedExpected = normalizeCode(expectedCode);
  if (normalizedExpected && !isCertificateCode(normalizedExpected)) {
    return createNonCertificateCodeResult(normalizedExpected, 'backend', BACKEND_PARSER_VERSION, provenance);
  }
  if (text.trim().length < 20) {
    return {
      status: 'unsupported_layout', parserSource: 'backend', parserVersion: BACKEND_PARSER_VERSION, sailings: [], rejectedRows: [], pageReports: [],
      provenance: { ...provenance, parserSource: 'backend', parserVersion: BACKEND_PARSER_VERSION, parseStatus: 'unsupported_layout', warnings: ['The backend could not extract readable certificate text.'] },
      warnings: ['The backend could not extract readable certificate text.'],
    };
  }
  return parseCertificateText(text, { expectedCode, parserSource: 'backend', parserVersion: BACKEND_PARSER_VERSION, provenance });
}

export function reconcileCertificateParserResults(backend: CertificateParseResult | null, device: CertificateParseResult | null): CertificateParserReconciliation {
  if (!backend && !device) return { status: 'single_source', retainedRows: [], backendOnly: [], deviceOnly: [], warnings: ['No parser result was available.'] };
  if (!backend || !device) {
    const result = backend ?? device as CertificateParseResult;
    return { status: 'single_source', retainedRows: result.sailings, backendOnly: backend?.sailings ?? [], deviceOnly: device?.sailings ?? [], warnings: ['Only one parser result was available; no cross-parser equivalence claim was made.'] };
  }
  const backendByKey = new Map(backend.sailings.map((row) => [parserComparisonIdentity(row), row]));
  const deviceByKey = new Map(device.sailings.map((row) => [parserComparisonIdentity(row), row]));
  const backendOnly = [...backendByKey.entries()].filter(([key]) => !deviceByKey.has(key)).map(([, row]) => row);
  const deviceOnly = [...deviceByKey.entries()].filter(([key]) => !backendByKey.has(key)).map(([, row]) => row);
  const retainedRows = dedupeCertificateSailings([...backend.sailings, ...device.sailings]);
  const disagreement = backendOnly.length > 0 || deviceOnly.length > 0;
  return { status: disagreement ? 'disagreement' : 'equivalent', retainedRows, backendOnly, deviceOnly, warnings: disagreement ? ['Backend and device parsers disagreed. All material variants were retained with their source evidence.'] : [] };
}

export async function downloadPublicCertificatePdf(url: string): Promise<DownloadedCertificatePdf> {
  const retrievedAt = new Date().toISOString();
  const validUrl = normalizePdfUrl(url);
  if (!validUrl) {
    return {
      status: 'redirect_blocked',
      provenance: {
        originalUrl: url,
        retrievedAt,
        parseStatus: 'redirect_blocked',
        warnings: ['Only HTTPS Royal Caribbean certificate URLs are allowed.'],
      },
      errorMessage: 'Certificate URL is not an approved Royal Caribbean HTTPS URL.',
    };
  }

  let temporaryFileUri: string | null = null;
  try {
    const { archiveCertificateLocalFile, downloadCertificateBinary, removeTemporaryCertificateFile } = getCertificateBinaryTransport();
    const download = await downloadCertificateBinary(validUrl.toString());
    temporaryFileUri = download.temporaryFileUri;
    const bytes = download.bytes;
    const documentHash = sha256DocumentHash(bytes);
    const baseProvenance: CertificatePdfProvenance = {
      originalUrl: url,
      resolvedUrl: download.resolvedUrl,
      retrievedAt,
      contentType: download.contentType,
      documentSize: bytes.byteLength,
      documentHash,
      documentVersion: documentHash,
      binaryTransport: download.transport,
    };
    if (!isPdfSignature(bytes)) {
      await removeTemporaryCertificateFile(temporaryFileUri);
      temporaryFileUri = null;
      return {
        status: 'not_pdf',
        provenance: {
          ...baseProvenance,
          parseStatus: 'not_pdf',
          warnings: ['The response did not have a PDF file signature.'],
        },
        errorMessage: 'The certificate URL returned content that is not a PDF.',
      };
    }

    const certificateCode = validUrl.pathname.split('/').pop()?.replace(/\.pdf$/i, '').toUpperCase() || 'CERTIFICATE';
    const documentArchiveUri = await archiveCertificateLocalFile({
      temporaryFileUri,
      certificateCode,
      documentHash,
    });
    temporaryFileUri = null;
    const provenance: CertificatePdfProvenance = {
      ...baseProvenance,
      documentArchiveUri,
    };
    return { status: 'downloaded', bytes, provenance };
  } catch (error) {
    await getCertificateBinaryTransport().removeTemporaryCertificateFile(temporaryFileUri);
    return {
      status: 'download_failed',
      provenance: { originalUrl: url, retrievedAt, parseStatus: 'download_failed' },
      errorMessage: error instanceof Error ? error.message : 'Certificate download failed.',
    };
  }
}

export function parseCertificateExtractedTextOnDevice(
  text: string,
  expectedCode?: string,
  sourceProvenance?: CertificatePdfProvenance,
): DeviceCertificateParseResult {
  const provenance: CertificatePdfProvenance = {
    ...(sourceProvenance ?? { originalUrl: '', retrievedAt: new Date().toISOString() }),
    parserSource: 'device',
    parserVersion: DEVICE_PARSER_VERSION,
  };
  const normalizedExpected = normalizeCode(expectedCode);
  if (normalizedExpected && !isCertificateCode(normalizedExpected)) {
    return createNonCertificateCodeResult(normalizedExpected, 'device', DEVICE_PARSER_VERSION, provenance);
  }
  if (text.length < 20) return { status: 'unsupported_layout', parserSource: 'device', parserVersion: DEVICE_PARSER_VERSION, sailings: [], rejectedRows: [], pageReports: [], provenance: { ...provenance, parseStatus: 'unsupported_layout', warnings: ['This PDF uses an image or compressed-text layout that the on-device parser cannot verify.'] }, warnings: ['This PDF uses an image or compressed-text layout that the on-device parser cannot verify.'] };
  return parseCertificateText(text, { expectedCode, parserSource: 'device', parserVersion: DEVICE_PARSER_VERSION, provenance });
}

export function parseCertificatePdfOnDevice(download: DownloadedCertificatePdf, expectedCode?: string): DeviceCertificateParseResult {
  const provenance: CertificatePdfProvenance = { ...download.provenance, parserSource: 'device', parserVersion: DEVICE_PARSER_VERSION };
  if (!download.bytes || download.status !== 'downloaded') {
    const status = download.status === 'not_pdf' ? 'not_pdf' : 'parse_failed';
    return { status, parserSource: 'device', parserVersion: DEVICE_PARSER_VERSION, sailings: [], rejectedRows: [], pageReports: [], provenance: { ...provenance, parseStatus: status }, warnings: ['A downloaded certificate PDF was required before parsing.'] };
  }
  if (!isPdfSignature(download.bytes)) return { status: 'pdf_corrupt', parserSource: 'device', parserVersion: DEVICE_PARSER_VERSION, sailings: [], rejectedRows: [], pageReports: [], provenance: { ...provenance, parseStatus: 'pdf_corrupt' }, warnings: ['The downloaded bytes no longer have a PDF signature.'] };
  const text = extractCertificatePdfText(download.bytes);
  return parseCertificateExtractedTextOnDevice(text, expectedCode, provenance);
}
