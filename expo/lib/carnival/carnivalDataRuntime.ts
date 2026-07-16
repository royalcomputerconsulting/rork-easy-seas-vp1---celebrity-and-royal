import type { BookedCruiseRow, OfferRow } from '@/lib/royalCaribbean/types';

export type CarnivalTierEvidence = 'authoritative' | 'inferred' | 'unknown';
export type CarnivalSyncTerminalStatus =
  | 'complete'
  | 'partial_resumable'
  | 'cancelled'
  | 'auth_lost'
  | 'interrupted_resumable'
  | 'error';

export type CarnivalCodeLedgerStatus =
  | 'success'
  | 'authoritative_empty'
  | 'incomplete'
  | 'blocked'
  | 'auth_lost'
  | 'cancelled'
  | 'failed'
  | 'pending';

export interface CarnivalCodeLedgerEntry {
  code: string;
  offerName: string;
  status: CarnivalCodeLedgerStatus;
  rowCount: number;
  totalResults: number;
  pagesVisited: number;
  truncated: boolean;
  message?: string;
  updatedAt: string;
}

export interface CarnivalSyncManifest {
  version: 1;
  runId: string;
  appProfileId: string;
  authenticatedEmailHash: string;
  accountFingerprint: string;
  vifpFingerprint: string;
  catalogHash: string;
  catalogCount: number;
  completedCodeCount: number;
  successfulCodes: string[];
  authoritativeEmptyCodes: string[];
  failedCodes: string[];
  incompleteCodes: string[];
  rowBearingCodes: string[];
  uniqueSailingCount: number;
  rawSailingRowCount: number;
  upcomingBookingCount: number;
  completedHistoryCount: number;
  codeLedger: CarnivalCodeLedgerEntry[];
  terminalStatus: CarnivalSyncTerminalStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  error?: string;
}

export interface CarnivalBridgeMessageScopeInput {
  messageRunId?: unknown;
  messageRequestId?: unknown;
  activeRunId?: unknown;
  activeRequestId?: unknown;
}

export function evaluateCarnivalBridgeMessageScope(input: CarnivalBridgeMessageScopeInput): { current: boolean; reason?: 'stale_run_message' | 'stale_request_message' } {
  const messageRunId = String(input.messageRunId ?? '').trim();
  const activeRunId = String(input.activeRunId ?? '').trim();
  const messageRequestId = String(input.messageRequestId ?? '').trim();
  const activeRequestId = String(input.activeRequestId ?? '').trim();
  if (activeRunId && messageRunId !== activeRunId) return { current: false, reason: 'stale_run_message' };
  if (activeRequestId && messageRequestId !== activeRequestId) return { current: false, reason: 'stale_request_message' };
  return { current: true };
}

export interface CarnivalProfileLike {
  firstName?: string;
  lastName?: string;
  vifpNumber?: string;
  vifpTier?: string;
  vifpTierSource?: CarnivalTierEvidence;
  vifpPoints?: number;
  cruiseDayPoints?: number;
  totalCruises?: number;
  playersClubTier?: string;
  playersClubPoints?: number;
  hasVifpData?: boolean;
  hasPlayersClubData?: boolean;
  authoritativeFields?: string[];
}

const normalize = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeLower = (value: unknown): string => normalize(value).toLowerCase();
const numeric = (value: unknown): number => {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export function carnivalStableHash(value: unknown): string {
  const input = typeof value === 'string' ? value : stableStringify(value);
  const utf8 = unescape(encodeURIComponent(input));
  const words: number[] = [];
  const bitLength = utf8.length * 8;
  for (let index = 0; index < utf8.length; index += 1) {
    words[index >> 2] = (words[index >> 2] || 0) | (utf8.charCodeAt(index) << (24 - (index % 4) * 8));
  }
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotateRight = (number: number, amount: number): number => (number >>> amount) | (number << (32 - amount));
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const schedule = new Array<number>(64);
  for (let offset = 0; offset < words.length; offset += 16) {
    for (let index = 0; index < 64; index += 1) {
      if (index < 16) schedule[index] = words[offset + index] || 0;
      else {
        const s0 = rotateRight(schedule[index - 15], 7) ^ rotateRight(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3);
        const s1 = rotateRight(schedule[index - 2], 17) ^ rotateRight(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10);
        schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) | 0;
      }
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + schedule[index]) | 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return `sha256-${hash.map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('')}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export function parseCarnivalDate(value: unknown): Date | null {
  const raw = normalize(value).replace(/\u00a0/g, ' ');
  if (!raw) return null;
  const iso = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  const us = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  const textMonthFirst = raw.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i);
  const textDayFirst = raw.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?[,]?\s+(20\d{2})\b/i);
  let year = 0;
  let month = 0;
  let day = 0;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else if (us) {
    year = Number(us[3]); month = Number(us[1]); day = Number(us[2]);
  } else if (textMonthFirst) {
    year = Number(textMonthFirst[3]); month = MONTHS[textMonthFirst[1].toLowerCase()] || 0; day = Number(textMonthFirst[2]);
  } else if (textDayFirst) {
    year = Number(textDayFirst[3]); month = MONTHS[textDayFirst[2].toLowerCase()] || 0; day = Number(textDayFirst[1]);
  }
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function formatCarnivalDate(value: unknown): string {
  const date = parseCarnivalDate(value);
  if (!date) return normalize(value);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

export const CARNIVAL_SHIP_CODE_MAP: Readonly<Record<string, string>> = Object.freeze({
  BL: 'Carnival Breeze', BZ: 'Carnival Horizon', CN: 'Carnival Conquest', DR: 'Carnival Dream',
  EL: 'Carnival Elation', FA: 'Carnival Fascination', FR: 'Carnival Freedom', FS: 'Carnival Firenze',
  GL: 'Carnival Glory', HZ: 'Carnival Horizon', JB: 'Carnival Jubilee', LE: 'Carnival Legend',
  LI: 'Carnival Liberty', LU: 'Carnival Luminosa', MG: 'Carnival Magic', 'MG2': 'Mardi Gras',
  MI: 'Carnival Miracle', PO: 'Carnival Panorama', PA: 'Carnival Paradise', PR: 'Carnival Pride',
  RA: 'Carnival Radiance', SN: 'Carnival Sensation', SP: 'Carnival Spirit', SL: 'Carnival Splendor',
  SR: 'Carnival Sunrise', SS: 'Carnival Sunshine', VL: 'Carnival Valor', VE: 'Carnival Venice',
  VI: 'Carnival Vista',
});

export const CARNIVAL_VIFP_TIER_BY_CODE: Readonly<Record<string, string>> = Object.freeze({
  '00': 'Blue',
  '0': 'Blue',
  '01': 'Red',
  '1': 'Red',
  '02': 'Gold',
  '2': 'Gold',
  '03': 'Platinum',
  '3': 'Platinum',
  '04': 'Diamond',
  '4': 'Diamond',
});

export const CARNIVAL_VIFP_TIER_BY_NAME: Readonly<Record<string, string>> = Object.freeze({
  blue: 'Blue',
  red: 'Red',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
});

export function decodeCarnivalVifpTier(
  value: unknown,
  cruiseDays?: unknown,
): { tier: string; source: CarnivalTierEvidence; displayTier: string } {
  const raw = normalizeLower(value).replace(/\s+tier$/, '');
  const authoritative = CARNIVAL_VIFP_TIER_BY_CODE[raw]
    || CARNIVAL_VIFP_TIER_BY_NAME[raw]
    || Object.values(CARNIVAL_VIFP_TIER_BY_NAME).find((name) => raw.includes(name.toLowerCase()));
  if (authoritative) return { tier: authoritative, source: 'authoritative', displayTier: authoritative };
  const days = numeric(cruiseDays);
  if (days > 0) {
    const tier = days >= 200 ? 'Diamond' : days >= 75 ? 'Platinum' : days >= 25 ? 'Gold' : 'Red';
    return { tier, source: 'inferred', displayTier: `${tier} (inferred)` };
  }
  return { tier: '', source: 'unknown', displayTier: '' };
}

export function isCarnivalSyntheticBookingId(value: unknown): boolean {
  const id = normalizeLower(value);
  return !id
    || /^carnival-synthetic-/.test(id)
    || /^carnival-(?:history|upcoming)-/.test(id)
    || /^carnival-\d{10,}-\d+$/.test(id)
    || /^booking_\d+$/.test(id);
}

function primaryPassenger(row: Partial<BookedCruiseRow>): string {
  const passenger = row.passengers?.[0] || row.passengersInStateroom?.[0];
  return normalize(`${passenger?.firstName || ''} ${passenger?.lastName || ''}`).toLowerCase();
}

export function carnivalBookingCanonicalKey(row: Partial<BookedCruiseRow>): string {
  return [
    normalizeLower(row.shipName),
    formatCarnivalDate(row.sailingStartDate || row.sailingDates),
    formatCarnivalDate(row.sailingEndDate),
    normalizeLower(row.itinerary || row.cruiseTitle),
    primaryPassenger(row),
    normalizeLower(row.cabinNumberOrGTY || row.stateroomNumber),
  ].join('|');
}

export function buildCarnivalSyntheticBookingId(row: Partial<BookedCruiseRow>): string {
  return `carnival-synthetic-${carnivalStableHash(carnivalBookingCanonicalKey(row)).replace(/^sha256-/, '').slice(0, 16)}`;
}

export function ensureCarnivalBookingIdentity(row: BookedCruiseRow): BookedCruiseRow {
  const start = formatCarnivalDate(row.sailingStartDate || row.sailingDates);
  const end = formatCarnivalDate(row.sailingEndDate);
  return {
    ...row,
    sailingStartDate: start,
    sailingEndDate: end,
    sailingDates: start || formatCarnivalDate(row.sailingDates),
    bookingId: isCarnivalSyntheticBookingId(row.bookingId) ? buildCarnivalSyntheticBookingId({ ...row, sailingStartDate: start, sailingEndDate: end }) : normalize(row.bookingId),
  };
}

export function isCarnivalBookingCompleted(row: Partial<BookedCruiseRow>, now = new Date()): boolean {
  const status = `${normalize(row.status)} ${normalize(row.bookingStatus)} ${normalize(row.sourcePage)}`;
  if (/completed|past|history/i.test(status)) return true;
  if (/cancelled|canceled/i.test(status)) return false;
  const start = parseCarnivalDate(row.sailingStartDate || row.sailingDates);
  const end = parseCarnivalDate(row.sailingEndDate) || start;
  if (!end) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  return end.getTime() < today.getTime();
}

export function normalizeCarnivalBookingClassification(row: BookedCruiseRow, now = new Date()): BookedCruiseRow {
  const identified = ensureCarnivalBookingIdentity(row);
  if (!isCarnivalBookingCompleted(identified, now)) return identified;
  return { ...identified, sourcePage: 'Completed', status: 'Completed', bookingStatus: 'COMPLETED', daysToGo: '0' };
}

export function mergeCarnivalProfileSnapshots(snapshots: CarnivalProfileLike[]): CarnivalProfileLike {
  const valid = snapshots.filter(Boolean);
  const isTrusted = (item: CarnivalProfileLike, field: string): boolean => Array.isArray(item.authoritativeFields) && item.authoritativeFields.includes(field);
  const choose = (selector: (item: CarnivalProfileLike) => unknown, field?: string): string => {
    const candidates = field && valid.some((item) => isTrusted(item, field)) ? valid.filter((item) => isTrusted(item, field)) : valid;
    for (const item of candidates) {
      const value = normalize(selector(item));
      if (value) return value;
    }
    return '';
  };
  const chooseNumber = (selector: (item: CarnivalProfileLike) => unknown, field: string): number => {
    const candidates = valid.some((item) => isTrusted(item, field)) ? valid.filter((item) => isTrusted(item, field)) : valid;
    return Math.max(0, ...candidates.map((item) => numeric(selector(item))));
  };
  const authoritativeTier = valid.find((item) => isTrusted(item, 'vifpTier') && item.vifpTierSource === 'authoritative' && normalize(item.vifpTier));
  const anyTier = valid.find((item) => normalize(item.vifpTier));
  const tierItem = authoritativeTier || anyTier;
  const authoritativeFields = Array.from(new Set(valid.flatMap((item) => Array.isArray(item.authoritativeFields) ? item.authoritativeFields : [])));
  return {
    firstName: choose((item) => item.firstName),
    lastName: choose((item) => item.lastName),
    vifpNumber: choose((item) => item.vifpNumber, 'vifpNumber'),
    vifpTier: normalize(tierItem?.vifpTier),
    vifpTierSource: tierItem?.vifpTierSource || (tierItem ? 'authoritative' : 'unknown'),
    vifpPoints: chooseNumber((item) => item.vifpPoints, 'vifpPoints'),
    cruiseDayPoints: chooseNumber((item) => item.cruiseDayPoints, 'cruiseDayPoints'),
    totalCruises: chooseNumber((item) => item.totalCruises, 'totalCruises'),
    playersClubTier: choose((item) => item.playersClubTier, 'playersClubTier'),
    playersClubPoints: chooseNumber((item) => item.playersClubPoints, 'playersClubPoints'),
    hasVifpData: valid.some((item) => Boolean(item.hasVifpData || item.vifpNumber || item.vifpTier || item.vifpPoints || item.cruiseDayPoints)),
    hasPlayersClubData: valid.some((item) => Boolean(item.hasPlayersClubData || item.playersClubTier || item.playersClubPoints)),
    authoritativeFields,
  };
}

export interface CarnivalSailingLike {
  shipName?: unknown;
  sailingDate?: unknown;
  sailDate?: unknown;
  itinerary?: unknown;
  itineraryName?: unknown;
  destination?: unknown;
  departurePort?: unknown;
}

export function carnivalSailingCanonicalKey(row: CarnivalSailingLike): string {
  const itinerary = Array.isArray(row.itinerary)
    ? row.itinerary.map((item) => normalize((item as { port?: unknown })?.port)).filter(Boolean).join(' > ')
    : row.itinerary ?? row.itineraryName ?? row.destination;
  return [
    normalizeLower(row.shipName),
    formatCarnivalDate(row.sailingDate ?? row.sailDate),
    normalizeLower(itinerary),
    normalizeLower(row.departurePort),
  ].join('|');
}

export function countUniqueCarnivalSailings(rows: CarnivalSailingLike[]): number {
  return new Set(rows.map(carnivalSailingCanonicalKey).filter((key) => key.replace(/\|/g, ''))).size;
}

export function buildCarnivalSyncManifest(input: Omit<CarnivalSyncManifest, 'version' | 'updatedAt'> & { updatedAt?: string }): CarnivalSyncManifest {
  const updatedAt = input.updatedAt || new Date().toISOString();
  const unique = (values: string[]) => Array.from(new Set(values.map((value) => normalize(value).toUpperCase()).filter(Boolean))).sort();
  const ledger = [...(input.codeLedger || [])].map((item) => ({ ...item, code: normalize(item.code).toUpperCase() })).sort((a, b) => a.code.localeCompare(b.code));
  return {
    ...input,
    version: 1,
    updatedAt,
    successfulCodes: unique(input.successfulCodes),
    authoritativeEmptyCodes: unique(input.authoritativeEmptyCodes),
    failedCodes: unique(input.failedCodes),
    incompleteCodes: unique(input.incompleteCodes),
    rowBearingCodes: unique(input.rowBearingCodes),
    codeLedger: ledger,
  };
}

export function isCarnivalManifestComplete(manifest: CarnivalSyncManifest | null | undefined): boolean {
  return Boolean(manifest && manifest.terminalStatus === 'complete' && manifest.incompleteCodes.length === 0 && manifest.failedCodes.length === 0 && manifest.completedCodeCount >= manifest.catalogCount);
}

export type CarnivalNavigationAuthState = 'authenticated_or_public' | 'auth_lost' | 'indeterminate';

export function classifyCarnivalNavigationAuth(input: {
  url?: unknown;
  hasPasswordField?: unknown;
  bodyText?: unknown;
  httpStatus?: unknown;
}): CarnivalNavigationAuthState {
  const url = normalizeLower(input.url);
  const body = normalizeLower(input.bodyText);
  const status = Number(input.httpStatus || 0);
  if (Boolean(input.hasPasswordField)) return 'auth_lost';
  if (status === 401 || status === 403) return 'auth_lost';
  if (/(?:login|sign[-_]?in|identity|security|challenge|authenticate|session-expired)/i.test(url)) return 'auth_lost';
  if (/session (?:has )?expired|please sign in|log in to continue|access denied|authentication required/i.test(body)) return 'auth_lost';
  if (!url) return 'indeterminate';
  return 'authenticated_or_public';
}

export function calculateCarnivalCurrentRunEta(input: {
  runStartedAt: number;
  now?: number;
  processedThisRun: number;
  remainingThisRun: number;
}): number | null {
  const processed = Math.max(0, Math.floor(input.processedThisRun));
  const remaining = Math.max(0, Math.floor(input.remainingThisRun));
  if (!processed || !remaining) return remaining === 0 ? 0 : null;
  const elapsed = Math.max(1, (input.now ?? Date.now()) - input.runStartedAt);
  return Math.ceil((elapsed / processed) * remaining);
}
