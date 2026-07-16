import type { OfferRow } from '@/lib/royalCaribbean/types';

export type CarnivalPayloadKind =
  | 'inventory'
  | 'inventory_empty'
  | 'pricing'
  | 'facets'
  | 'offer_catalog'
  | 'analytics'
  | 'configuration'
  | 'unknown';

export interface CarnivalRequestMetadata {
  requestUrl: string;
  responseUrl?: string;
  method?: string;
  body?: unknown;
  status?: number;
  contentType?: string;
  expectedOfferCode: string;
  expectedPageNumber: number;
  runId?: string;
  requestId?: string;
  contextFingerprint?: string;
  expectedUrl?: string;
  contextStartedAt?: number;
  requestStartedAt?: number;
  navigationSequenceId?: number;
  expectedNavigationSequenceId?: number;
  accountFingerprint?: string;
}

export interface CarnivalPayloadAnalysis {
  kind: CarnivalPayloadKind;
  adapterId: string;
  inventoryPath: string;
  inventoryItems: unknown[];
  totalResults: number | null;
  pageNumber: number | null;
  pageSize: number | null;
  offset: number | null;
  cursor: string;
  nextCursor: string;
  nextUrl: string;
  hasNextPage: boolean | null;
  requestOfferCodes: string[];
  payloadOfferCodes: string[];
  offerCodeMatched: boolean;
  pageMatched: boolean;
  approvedEndpoint: boolean;
  requestStartedAfterContext: boolean;
  navigationSequenceMatched: boolean;
  contextCorrelated: boolean;
  offerProofSource: 'request' | 'payload' | 'context' | 'none';
  pageProofSource: 'request' | 'cursor' | 'expected_url' | 'context' | 'none';
  authoritativeEmpty: boolean;
  confidence: number;
  reason: string;
  payloadBytes: number;
}

export interface CarnivalPaginationStepInput {
  currentPageNumber: number;
  pagesVisited: number;
  maxPages: number;
  uniqueCountBefore: number;
  uniqueCountAfter: number;
  expectedTotal: number;
  hasNextPage: boolean;
  payloadMatched: boolean;
  renderedTerminalProof?: boolean;
  resultStable?: boolean;
  authoritativeEmpty: boolean;
  pageSignature: string;
  priorSignatureCount: number;
  consecutiveNoGrowth: number;
  truncationReason?: string;
}

export interface CarnivalPaginationStepDecision {
  terminal: boolean;
  successfulTerminal: boolean;
  continuePaging: boolean;
  incompleteReason: string;
  warningReason?: string;
  nextConsecutiveNoGrowth: number;
  nextSignatureCount: number;
}

const RATE_CODE_KEYS = new Set(['ratecode', 'ratecodes', 'offercode', 'offercodes', 'promo', 'promocode']);
const PAGE_KEYS = new Set(['page', 'pagenumber', 'page_number', 'pageindex', 'currentpage']);
const PAGE_SIZE_KEYS = new Set(['pagesize', 'page_size', 'limit', 'perpage', 'itemsperpage']);
const OFFSET_KEYS = new Set(['offset', 'skip', 'startindex', 'start']);
const CURSOR_KEYS = new Set(['cursor', 'pagetoken', 'continuationtoken', 'continuation', 'after']);
const NEXT_CURSOR_KEYS = new Set(['nextcursor', 'nextpagetoken', 'continuationtoken', 'nexttoken', 'endcursor']);
const TOTAL_KEYS = new Set(['total', 'totalcount', 'totalresults', 'resultcount', 'recordcount', 'numberofresults']);
const HAS_NEXT_KEYS = new Set(['hasnext', 'hasnextpage', 'hasmore', 'more']);
const FACET_KEYS = /facet|filter|aggregation|bucket|refinement/i;
const PRICING_KEYS = /price|pricing|fare|cabin|room|stateroom|availability/i;
const ANALYTICS_KEYS = /analytic|tracking|telemetry|experiment|event/i;
const CONFIG_KEYS = /config|setting|featureflag|content|localization/i;

const EXPLICIT_INVENTORY_PATHS: Array<{ id: string; path: string[]; allowEmpty: boolean }> = [
  { id: 'root-sailings', path: ['sailings'], allowEmpty: true },
  { id: 'root-cruises', path: ['cruises'], allowEmpty: true },
  { id: 'root-voyages', path: ['voyages'], allowEmpty: true },
  { id: 'root-departures', path: ['departures'], allowEmpty: true },
  { id: 'data-sailings', path: ['data', 'sailings'], allowEmpty: true },
  { id: 'data-cruises', path: ['data', 'cruises'], allowEmpty: true },
  { id: 'data-voyages', path: ['data', 'voyages'], allowEmpty: true },
  { id: 'data-departures', path: ['data', 'departures'], allowEmpty: true },
  { id: 'data-itineraries', path: ['data', 'itineraries'], allowEmpty: true },
  { id: 'data-results', path: ['data', 'results'], allowEmpty: false },
  { id: 'data-records', path: ['data', 'records'], allowEmpty: false },
  { id: 'search-sailings', path: ['data', 'search', 'sailings'], allowEmpty: true },
  { id: 'search-results', path: ['data', 'search', 'results'], allowEmpty: true },
  { id: 'cruise-search-sailings', path: ['data', 'cruiseSearch', 'sailings'], allowEmpty: true },
  { id: 'cruise-search-results', path: ['data', 'cruiseSearch', 'results'], allowEmpty: true },
  { id: 'search-cruises-results', path: ['data', 'searchCruises', 'results'], allowEmpty: true },
  { id: 'search-cruises-sailings', path: ['data', 'searchCruises', 'sailings'], allowEmpty: true },
  { id: 'payload-sailings', path: ['payload', 'sailings'], allowEmpty: true },
  { id: 'payload-results', path: ['payload', 'results'], allowEmpty: false },
];

function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').match(/-?[0-9][0-9,]*/);
  return match ? Number(match[0].replace(/,/g, '')) : null;
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value); } catch { return ''; }
}

function parseBody(body: unknown): unknown {
  if (body === null || body === undefined) return null;
  if (typeof body === 'object') return body;
  const raw = String(body).trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
  try {
    const params = new URLSearchParams(raw);
    const result: Record<string, string | string[]> = {};
    params.forEach((value, key) => {
      const prior = result[key];
      result[key] = prior === undefined ? value : Array.isArray(prior) ? [...prior, value] : [prior, value];
    });
    return result;
  } catch {
    return raw;
  }
}

function collectCodesFromValue(value: unknown, depth = 0, output = new Set<string>()): Set<string> {
  if (depth > 7 || value === null || value === undefined) return output;
  if (typeof value === 'string') {
    const matches = value.match(/(?:ratecodes?|offercodes?|promo(?:code)?)\s*[=:]\s*([A-Z0-9,;-]{2,100})/ig) || [];
    for (const match of matches) {
      const rhs = match.split(/[=:]/).slice(1).join(':');
      rhs.split(/[,;|-]/).map(normalizeCode).filter((code) => /^[A-Z0-9]{2,10}$/.test(code)).forEach((code) => output.add(code));
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < Math.min(value.length, 2000); index += 1) collectCodesFromValue(value[index], depth + 1, output);
    return output;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 300)) {
      const lower = key.toLowerCase();
      if (RATE_CODE_KEYS.has(lower)) {
        const values = Array.isArray(item) ? item : String(item ?? '').split(/[,;|]/);
        for (const codeValue of values) {
          const code = normalizeCode(codeValue);
          if (/^[A-Z0-9]{2,10}$/.test(code)) output.add(code);
        }
      }
      collectCodesFromValue(item, depth + 1, output);
    }
  }
  return output;
}

export function extractCarnivalRequestOfferCodes(urlValue: string, body?: unknown): string[] {
  const output = new Set<string>();
  try {
    const url = new URL(String(urlValue || ''), 'https://www.carnival.com');
    for (const [key, value] of url.searchParams.entries()) {
      if (!RATE_CODE_KEYS.has(key.toLowerCase())) continue;
      value.split(/[,;|]/).map(normalizeCode).filter((code) => /^[A-Z0-9]{2,10}$/.test(code)).forEach((code) => output.add(code));
    }
  } catch { /* ignore malformed URL */ }
  collectCodesFromValue(parseBody(body), 0, output);
  return Array.from(output);
}

function extractRequestNumber(urlValue: string, body: unknown, keys: Set<string>): number | null {
  try {
    const url = new URL(String(urlValue || ''), 'https://www.carnival.com');
    for (const [key, value] of url.searchParams.entries()) {
      if (keys.has(key.toLowerCase())) {
        const parsed = numberValue(value);
        if (parsed !== null) return parsed;
      }
    }
  } catch { /* ignore */ }
  const parsedBody = parseBody(body);
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const queue: unknown[] = [parsedBody];
    let visited = 0;
    while (queue.length && visited < 100) {
      const current = queue.shift(); visited += 1;
      if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        if (keys.has(key.toLowerCase())) {
          const parsed = numberValue(value);
          if (parsed !== null) return parsed;
        }
        if (value && typeof value === 'object') queue.push(value);
      }
    }
  }
  return null;
}

function extractRequestString(urlValue: string, body: unknown, keys: Set<string>): string {
  try {
    const url = new URL(String(urlValue || ''), 'https://www.carnival.com');
    for (const [key, value] of url.searchParams.entries()) if (keys.has(key.toLowerCase()) && value) return value;
  } catch { /* ignore */ }
  const parsedBody = parseBody(body);
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const queue: unknown[] = [parsedBody];
    let visited = 0;
    while (queue.length && visited < 100) {
      const current = queue.shift(); visited += 1;
      if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        if (keys.has(key.toLowerCase()) && value !== null && value !== undefined && typeof value !== 'object') return String(value);
        if (value && typeof value === 'object') queue.push(value);
      }
    }
  }
  return '';
}

function objectShip(value: Record<string, unknown>): string {
  const shipInfo = value.shipInfo && typeof value.shipInfo === 'object' ? value.shipInfo as Record<string, unknown> : null;
  const vessel = value.vessel && typeof value.vessel === 'object' ? value.vessel as Record<string, unknown> : null;
  return String(value.shipName || value.ship || value.vesselName || value.shipCode || shipInfo?.name || vessel?.name || '').trim();
}

function objectDate(value: Record<string, unknown>): string {
  const voyage = value.voyage && typeof value.voyage === 'object' ? value.voyage as Record<string, unknown> : null;
  return String(value.sailDate || value.departureDate || value.startDate || value.embarkDate || value.sailingDate || value.departure || voyage?.departureDate || voyage?.sailDate || '').trim();
}

export function isCarnivalSailingObject(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const ship = objectShip(record);
  const date = objectDate(record);
  if (ship && date) return true;
  const keys = Object.keys(record).map((key) => key.toLowerCase());
  return Boolean(date && keys.some((key) => /voyage|itinerary|ship|vessel/.test(key)));
}

function getAtPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function parentAtPath(root: unknown, path: string[]): Record<string, unknown> | null {
  const value = getAtPath(root, path.slice(0, -1));
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

interface InventoryAdapterResult {
  adapterId: string;
  path: string;
  items: unknown[];
  parent: Record<string, unknown> | null;
  containers: Record<string, unknown>[];
  explicitEmptyCollection: boolean;
}

function arrayHasSailings(items: unknown[]): boolean {
  return items.some(isCarnivalSailingObject);
}

function directObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * Authoritative adapters only inspect documented/observed inventory envelopes.
 * They never select the largest arbitrary nested array or the maximum arbitrary
 * `total` value from a hydration blob, facet tree, pricing response, or analytics payload.
 */
function adaptCarnivalInventoryPayload(root: unknown): InventoryAdapterResult | null {
  for (const adapter of EXPLICIT_INVENTORY_PATHS) {
    const value = getAtPath(root, adapter.path);
    if (!Array.isArray(value)) continue;
    if (value.length > 0 && !arrayHasSailings(value)) continue;
    if (value.length === 0 && !adapter.allowEmpty) continue;
    const parent = parentAtPath(root, adapter.path);
    const parentPagination = directObject(parent?.pagination) || directObject(parent?.pageInfo) || directObject(parent?.meta);
    const dataRoot = directObject(getAtPath(root, ['data']));
    return {
      adapterId: adapter.id,
      path: adapter.path.join('.'),
      items: value,
      parent,
      containers: [parentPagination, parent, dataRoot, directObject(root)].filter((item): item is Record<string, unknown> => Boolean(item)),
      explicitEmptyCollection: value.length === 0,
    };
  }

  const dataRoot = directObject(getAtPath(root, ['data'])) || directObject(root);
  if (!dataRoot) return null;
  const candidates: Array<{ field: string; value: Record<string, unknown> }> = [];
  for (const [field, raw] of Object.entries(dataRoot).slice(0, 100)) {
    const object = directObject(raw);
    if (object) candidates.push({ field, value: object });
    if (object) {
      for (const [nestedField, nestedRaw] of Object.entries(object).slice(0, 60)) {
        const nestedObject = directObject(nestedRaw);
        if (nestedObject) candidates.push({ field: `${field}.${nestedField}`, value: nestedObject });
      }
    }
  }
  for (const candidate of candidates) {
    const nodes = Array.isArray(candidate.value.nodes) ? candidate.value.nodes : null;
    const edges = Array.isArray(candidate.value.edges)
      ? candidate.value.edges.map((edge) => directObject(edge)?.node).filter(Boolean)
      : null;
    const items = nodes || edges;
    if (!items) continue;
    if (items.length > 0 && !arrayHasSailings(items)) continue;
    const pageInfo = directObject(candidate.value.pageInfo) || directObject(candidate.value.pagination) || directObject(candidate.value.meta);
    return {
      adapterId: `graphql-connection:${candidate.field}`,
      path: `data.${candidate.field}.${nodes ? 'nodes' : 'edges[].node'}`,
      items,
      parent: candidate.value,
      containers: [pageInfo, candidate.value, dataRoot, directObject(root)].filter((item): item is Record<string, unknown> => Boolean(item)),
      explicitEmptyCollection: items.length === 0,
    };
  }
  return null;
}

interface PaginationMeta {
  totalResults: number | null;
  pageNumber: number | null;
  pageSize: number | null;
  offset: number | null;
  cursor: string;
  nextCursor: string;
  nextUrl: string;
  hasNextPage: boolean | null;
}

function firstDirectValue(containers: Record<string, unknown>[], keys: Set<string>): unknown {
  for (const container of containers) {
    for (const [key, value] of Object.entries(container)) if (keys.has(key.toLowerCase())) return value;
  }
  return undefined;
}

function firstDirectMatchingValue(containers: Record<string, unknown>[], pattern: RegExp): unknown {
  for (const container of containers) {
    for (const [key, value] of Object.entries(container)) if (pattern.test(key.toLowerCase())) return value;
  }
  return undefined;
}

function paginationFromAdapter(adapter: InventoryAdapterResult | null, metadata: CarnivalRequestMetadata): PaginationMeta {
  const requestPage = extractRequestNumber(metadata.requestUrl, metadata.body, PAGE_KEYS);
  const requestPageSize = extractRequestNumber(metadata.requestUrl, metadata.body, PAGE_SIZE_KEYS);
  const requestOffset = extractRequestNumber(metadata.requestUrl, metadata.body, OFFSET_KEYS);
  const requestCursor = extractRequestString(metadata.requestUrl, metadata.body, CURSOR_KEYS);
  const containers = adapter?.containers || [];
  const directTotal = numberValue(firstDirectValue(containers, TOTAL_KEYS));
  const directPage = numberValue(firstDirectValue(containers, PAGE_KEYS));
  const directPageSize = numberValue(firstDirectValue(containers, PAGE_SIZE_KEYS));
  const directOffset = numberValue(firstDirectValue(containers, OFFSET_KEYS));
  const directCursor = firstDirectValue(containers, CURSOR_KEYS);
  const directNextCursor = firstDirectValue(containers, NEXT_CURSOR_KEYS);
  const directHasNext = firstDirectValue(containers, HAS_NEXT_KEYS);
  const directNextUrl = firstDirectMatchingValue(containers, /^(next|nextpage|nextpageurl|nexturl)$/);

  const pageNumber = directPage ?? requestPage;
  const normalizedPage = pageNumber === 0 ? 1 : pageNumber;
  const pageSize = directPageSize && directPageSize > 0 && directPageSize <= 1000 ? directPageSize : requestPageSize;
  const offset = directOffset ?? requestOffset;
  let hasNextPage = typeof directHasNext === 'boolean' ? directHasNext : null;
  const nextCursor = directNextCursor !== undefined && directNextCursor !== null ? String(directNextCursor) : '';
  const nextUrl = typeof directNextUrl === 'string' ? directNextUrl : '';
  if (nextCursor || nextUrl) hasNextPage = true;
  if (hasNextPage === null && directTotal !== null && pageSize && normalizedPage) hasNextPage = normalizedPage * pageSize < directTotal;

  return {
    totalResults: directTotal,
    pageNumber: normalizedPage,
    pageSize,
    offset,
    cursor: directCursor !== undefined && directCursor !== null ? String(directCursor) : requestCursor,
    nextCursor,
    nextUrl,
    hasNextPage,
  };
}

function payloadKeySummary(root: unknown): string {
  const keys = new Set<string>();
  const seen = new Set<object>();
  let nodes = 0;
  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > 4 || nodes > 3000 || seen.has(value as object)) return;
    seen.add(value as object); nodes += 1;
    if (Array.isArray(value)) {
      for (let index = 0; index < Math.min(value.length, 20); index += 1) walk(value[index], depth + 1);
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 150)) {
      keys.add(key.toLowerCase());
      walk(item, depth + 1);
    }
  };
  walk(root, 0);
  return Array.from(keys).join('|');
}

export function analyzeCarnivalPayload(data: unknown, metadata: CarnivalRequestMetadata): CarnivalPayloadAnalysis {
  const encoded = safeJson(data);
  const payloadBytes = encoded.length;
  const requestOfferCodes = extractCarnivalRequestOfferCodes(metadata.requestUrl, metadata.body);
  const payloadOfferCodes = Array.from(collectCodesFromValue(data));
  const expectedCode = normalizeCode(metadata.expectedOfferCode);
  const requestCodeMatched = requestOfferCodes.includes(expectedCode);
  const payloadCodeMatched = payloadOfferCodes.length === 1 && payloadOfferCodes[0] === expectedCode;
  const requestCodeConflict = requestOfferCodes.length > 0 && !requestCodeMatched;
  const payloadCodeConflict = payloadOfferCodes.length === 1 && !payloadCodeMatched;
  const approvedEndpoint = (() => {
    try {
      const requestUrl = new URL(String(metadata.responseUrl || metadata.requestUrl || ''), 'https://www.carnival.com');
      const approvedHost = /(^|\.)carnival\.com$/i.test(requestUrl.hostname);
      const endpointText = `${requestUrl.pathname}${requestUrl.search}`;
      return approvedHost && /(?:cruise|sailing|voyage|itinerar|search|departure)/i.test(endpointText);
    } catch { return false; }
  })();
  const contextStartedAt = Number(metadata.contextStartedAt || 0);
  const requestStartedAt = Number(metadata.requestStartedAt || 0);
  const requestStartedAfterContext = contextStartedAt > 0 && requestStartedAt >= contextStartedAt;
  const expectedNavigationSequenceId = Number(metadata.expectedNavigationSequenceId || metadata.navigationSequenceId || 0);
  const navigationSequenceId = Number(metadata.navigationSequenceId || 0);
  const navigationSequenceMatched = expectedNavigationSequenceId > 0 && navigationSequenceId === expectedNavigationSequenceId;

  const requestPage = extractRequestNumber(metadata.requestUrl, metadata.body, PAGE_KEYS);
  const requestPageSize = extractRequestNumber(metadata.requestUrl, metadata.body, PAGE_SIZE_KEYS);
  const requestOffset = extractRequestNumber(metadata.requestUrl, metadata.body, OFFSET_KEYS);
  const requestCursor = extractRequestString(metadata.requestUrl, metadata.body, CURSOR_KEYS);
  const expectedPage = Math.max(1, Number(metadata.expectedPageNumber || 1));
  const derivedPage = requestPage !== null
    ? (requestPage === 0 ? 1 : requestPage)
    : requestOffset !== null && requestPageSize ? Math.floor(requestOffset / requestPageSize) + 1 : null;
  const normalizedUrl = (raw: string): string => {
    try {
      const url = new URL(String(raw || ''), 'https://www.carnival.com');
      url.hash = '';
      url.searchParams.sort();
      return url.toString();
    } catch { return String(raw || ''); }
  };
  const exactExpectedUrlMatched = Boolean(metadata.expectedUrl && normalizedUrl(metadata.requestUrl) === normalizedUrl(metadata.expectedUrl));

  const adapter = adaptCarnivalInventoryPayload(data);
  const inventoryItems = (adapter?.items || []).filter(isCarnivalSailingObject);
  const contextCorrelated = Boolean(
    adapter
    && approvedEndpoint
    && requestStartedAfterContext
    && navigationSequenceMatched
    && !requestCodeConflict
    && !payloadCodeConflict
    && expectedCode,
  );
  const offerCodeMatched = Boolean(expectedCode && (requestCodeMatched || (requestOfferCodes.length === 0 && payloadCodeMatched) || contextCorrelated));
  const pageMatched = derivedPage === null
    ? (Boolean(requestCursor) || exactExpectedUrlMatched || contextCorrelated || expectedPage === 1)
    : derivedPage === expectedPage;
  const offerProofSource: CarnivalPayloadAnalysis['offerProofSource'] = requestCodeMatched
    ? 'request'
    : payloadCodeMatched
      ? 'payload'
      : contextCorrelated
        ? 'context'
        : 'none';
  const pageProofSource: CarnivalPayloadAnalysis['pageProofSource'] = derivedPage !== null && derivedPage === expectedPage
    ? 'request'
    : requestCursor
      ? 'cursor'
      : exactExpectedUrlMatched
        ? 'expected_url'
        : contextCorrelated
          ? 'context'
          : 'none';
  const pagination = paginationFromAdapter(adapter, metadata);
  if (pagination.pageNumber === null && derivedPage !== null) pagination.pageNumber = derivedPage;
  const keys = payloadKeySummary(data);
  const hasOfferCatalogShape = /offerid|ctaurl|offertitle|subtitle/.test(keys) && !adapter;
  const hasFacetShape = FACET_KEYS.test(keys) && !adapter;
  const hasPricingShape = PRICING_KEYS.test(keys) && !adapter;
  const hasAnalyticsShape = ANALYTICS_KEYS.test(keys) && !adapter;
  const hasConfigShape = CONFIG_KEYS.test(keys) && !adapter;
  const reportedZero = pagination.totalResults === 0;

  let kind: CarnivalPayloadKind = 'unknown';
  let reason = 'No whitelisted Carnival inventory adapter matched this payload';
  let confidence = 0;
  if (adapter && inventoryItems.length > 0) {
    kind = 'inventory';
    confidence = Math.min(100, 80 + Math.min(19, inventoryItems.length));
    reason = `Adapter ${adapter.adapterId} found ${inventoryItems.length} sailing object(s) at ${adapter.path}`;
  } else if (hasOfferCatalogShape) {
    kind = 'offer_catalog'; confidence = 85; reason = 'Offer catalog schema without sailing inventory';
  } else if (hasFacetShape) {
    kind = 'facets'; confidence = 85; reason = 'Facet/filter schema without sailing inventory';
  } else if (hasPricingShape) {
    kind = 'pricing'; confidence = 75; reason = 'Pricing/availability schema without sailing inventory';
  } else if (adapter && adapter.explicitEmptyCollection && offerCodeMatched && pageMatched && reportedZero) {
    kind = 'inventory_empty';
    confidence = 98;
    reason = `Adapter ${adapter.adapterId} matched the requested code/page and reported authoritative totalResults=0`;
  } else if (hasAnalyticsShape) {
    kind = 'analytics'; confidence = 80; reason = 'Analytics/telemetry schema';
  } else if (hasConfigShape) {
    kind = 'configuration'; confidence = 70; reason = 'Configuration/content schema';
  }

  return {
    kind,
    adapterId: adapter?.adapterId || '',
    inventoryPath: adapter?.path || '',
    inventoryItems,
    totalResults: pagination.totalResults,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    offset: pagination.offset,
    cursor: pagination.cursor,
    nextCursor: pagination.nextCursor,
    nextUrl: pagination.nextUrl,
    hasNextPage: pagination.hasNextPage,
    requestOfferCodes,
    payloadOfferCodes,
    offerCodeMatched,
    pageMatched,
    approvedEndpoint,
    requestStartedAfterContext,
    navigationSequenceMatched,
    contextCorrelated,
    offerProofSource,
    pageProofSource,
    authoritativeEmpty: kind === 'inventory_empty' && offerCodeMatched && pageMatched,
    confidence,
    reason,
    payloadBytes,
  };
}

export function createCarnivalSailingKey(row: Partial<OfferRow>): string {
  return [row.offerCode, row.shipName, row.sailingDate, row.itinerary, row.departurePort]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .join('|');
}

export function createCarnivalPageSignature(input: {
  rows: Array<Partial<OfferRow>>;
  totalResults?: number;
  pageNumber?: number;
  pageSize?: number;
  offset?: number;
  cursor?: string;
  nextCursor?: string;
  nextUrl?: string;
}): string {
  const rowKeys = input.rows.map(createCarnivalSailingKey).sort();
  return stableHash(JSON.stringify({
    rowKeys,
    totalResults: Number(input.totalResults || 0),
    pageNumber: Number(input.pageNumber || 0),
    pageSize: Number(input.pageSize || 0),
    offset: Number(input.offset || 0),
    cursor: String(input.cursor || ''),
    nextCursor: String(input.nextCursor || ''),
    nextUrl: String(input.nextUrl || ''),
  }));
}

export function evaluateCarnivalPaginationStep(input: CarnivalPaginationStepInput): CarnivalPaginationStepDecision {
  const added = Math.max(0, input.uniqueCountAfter - input.uniqueCountBefore);
  const nextNoGrowth = added > 0 ? 0 : input.consecutiveNoGrowth + 1;
  const nextSignatureCount = input.priorSignatureCount + 1;

  if (input.authoritativeEmpty) {
    return { terminal: true, successfulTerminal: true, continuePaging: false, incompleteReason: '', nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
  }
  if (input.expectedTotal > 0 && input.uniqueCountAfter >= input.expectedTotal) {
    const terminalProof = input.payloadMatched || Boolean(input.renderedTerminalProof && input.resultStable);
    const incomplete = terminalProof
      ? ''
      : `Reached the displayed total ${input.uniqueCountAfter}/${input.expectedTotal} without verified API or settled rendered-page terminal proof`;
    return { terminal: true, successfulTerminal: !incomplete, continuePaging: false, incompleteReason: incomplete, nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
  }
  if (input.truncationReason) {
    return { terminal: true, successfulTerminal: false, continuePaging: false, incompleteReason: input.truncationReason, nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
  }
  if (!input.hasNextPage) {
    const terminalProof = input.payloadMatched || Boolean(input.renderedTerminalProof && input.resultStable);
    if (terminalProof && (input.expectedTotal === 0 || input.uniqueCountAfter > 0)) {
      const incomplete = input.expectedTotal > input.uniqueCountAfter
        ? `Authoritative pagination ended early at ${input.uniqueCountAfter}/${input.expectedTotal} unique sailings`
        : '';
      return { terminal: true, successfulTerminal: !incomplete, continuePaging: false, incompleteReason: incomplete, nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
    }
    return { terminal: true, successfulTerminal: false, continuePaging: false, incompleteReason: 'No verified API or settled rendered-page next-page proof was available', nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
  }
  if (input.pagesVisited >= input.maxPages) {
    const duplicateDetail = nextSignatureCount >= 2 ? `; repeated page signature ${input.pageSignature}` : nextNoGrowth >= 2 ? '; repeated no-growth pages' : '';
    return { terminal: true, successfulTerminal: false, continuePaging: false, incompleteReason: `Safety page limit ${input.maxPages} reached before authoritative completion${duplicateDetail}`, nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
  }

  // A duplicate or temporarily empty page is diagnostic evidence, not proof of
  // completion. Continue while the authoritative API says a next page exists;
  // only the safety limit may stop a broken/repeating server sequence.
  const warningReason = nextSignatureCount >= 2
    ? `Repeated page signature ${input.pageSignature}; continuing because the authoritative API still reports a next page`
    : nextNoGrowth >= 2
      ? 'Multiple pages added no new unique sailings; continuing because the authoritative API still reports a next page'
      : undefined;
  return { terminal: false, successfulTerminal: false, continuePaging: true, incompleteReason: '', warningReason, nextConsecutiveNoGrowth: nextNoGrowth, nextSignatureCount };
}

export function buildCarnivalNextPageUrl(input: {
  currentUrl: string;
  offerCode: string;
  nextPageNumber: number;
  pageSize: number;
  nextUrl?: string;
  nextOffset?: number | null;
  nextCursor?: string;
}): string {
  const current = new URL(input.currentUrl, 'https://www.carnival.com');
  let candidate: URL | null = null;
  try { candidate = input.nextUrl ? new URL(input.nextUrl, current) : null; } catch { candidate = null; }
  const candidateIsBrowserSearch = Boolean(candidate
    && /cruise-search/i.test(candidate.pathname)
    && !/(?:^|\/)(?:api|graphql)(?:\/|$)/i.test(candidate.pathname));
  const url = candidateIsBrowserSearch ? new URL(candidate!.toString()) : new URL(current.toString());
  const candidateCursor = candidate
    ? Array.from(candidate.searchParams.entries()).find(([key]) => CURSOR_KEYS.has(key.toLowerCase()))?.[1] || ''
    : '';
  const candidateOffsetRaw = candidate
    ? Array.from(candidate.searchParams.entries()).find(([key]) => OFFSET_KEYS.has(key.toLowerCase()))?.[1]
    : undefined;
  const candidateOffset = candidateOffsetRaw === undefined ? null : numberValue(candidateOffsetRaw);
  const candidatePageRaw = candidate
    ? Array.from(candidate.searchParams.entries()).find(([key]) => PAGE_KEYS.has(key.toLowerCase()))?.[1]
    : undefined;
  const candidatePage = candidatePageRaw === undefined ? null : numberValue(candidatePageRaw);

  url.searchParams.set('ratecodes', normalizeCode(input.offerCode));
  const effectiveCursor = input.nextCursor || candidateCursor;
  const effectiveOffset = input.nextOffset !== null && input.nextOffset !== undefined ? input.nextOffset : candidateOffset;
  if (effectiveCursor) {
    const cursorKey = Array.from(url.searchParams.keys()).find((key) => CURSOR_KEYS.has(key.toLowerCase())) || 'cursor';
    url.searchParams.set(cursorKey, effectiveCursor);
  } else if (effectiveOffset !== null && effectiveOffset !== undefined) {
    const offsetKey = Array.from(url.searchParams.keys()).find((key) => OFFSET_KEYS.has(key.toLowerCase())) || 'offset';
    url.searchParams.set(offsetKey, String(effectiveOffset));
    const sizeKey = Array.from(url.searchParams.keys()).find((key) => PAGE_SIZE_KEYS.has(key.toLowerCase())) || 'pagesize';
    url.searchParams.set(sizeKey, String(input.pageSize));
  } else {
    const pageKey = Array.from(url.searchParams.keys()).find((key) => PAGE_KEYS.has(key.toLowerCase())) || 'pageNumber';
    url.searchParams.set(pageKey, String(Math.max(1, candidatePage || input.nextPageNumber)));
    const sizeKey = Array.from(url.searchParams.keys()).find((key) => PAGE_SIZE_KEYS.has(key.toLowerCase())) || 'pagesize';
    url.searchParams.set(sizeKey, String(input.pageSize));
  }
  return url.toString();
}

/** ES5-safe mirror used inside the Carnival WebView. */
export const CARNIVAL_CAPTURE_RUNTIME_SCRIPT = String.raw`
  function __esCompact(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function __esNum(value) { if (typeof value === 'number' && isFinite(value)) return value; var m = String(value == null ? '' : value).match(/-?[0-9][0-9,]*/); return m ? Number(m[0].replace(/,/g, '')) : null; }
  function __esParseBody(body) { if (body == null || body === '') return null; if (typeof body === 'object') return body; var raw = String(body || '').trim(); if (!raw) return null; try { return JSON.parse(raw); } catch (e) {} try { var params = new URLSearchParams(raw); var out = {}; params.forEach(function(v, k) { out[k] = v; }); return out; } catch (e2) {} return raw; }
  function __esRequestCodes(urlValue, body) {
    var seen = {}, out = [];
    function add(value) { var code = __esCompact(value).toUpperCase(); if (/^[A-Z0-9]{2,10}$/.test(code) && !seen[code]) { seen[code] = true; out.push(code); } }
    try { var url = new URL(String(urlValue || ''), window.location.href); url.searchParams.forEach(function(v, k) { if (/^(ratecodes?|offercodes?|promo(?:code)?)$/i.test(k)) String(v || '').split(/[,;|]/).forEach(add); }); } catch (e) {}
    function walk(value, depth) { if (value == null || depth > 6) return; if (typeof value === 'string') { var matches = value.match(/(?:ratecodes?|offercodes?|promo(?:code)?)\s*[=:]\s*([A-Z0-9,;|-]{2,100})/ig) || []; for (var mi = 0; mi < matches.length; mi++) matches[mi].split(/[=:]/).slice(1).join(':').split(/[,;|-]/).forEach(add); return; } if (Array.isArray(value)) { for (var ai = 0; ai < value.length && ai < 500; ai++) walk(value[ai], depth + 1); return; } if (typeof value === 'object') { var keys = Object.keys(value); for (var ki = 0; ki < keys.length && ki < 250; ki++) { var key = keys[ki], item = value[key]; if (/^(ratecodes?|offercodes?|promo(?:code)?)$/i.test(key)) (Array.isArray(item) ? item : String(item || '').split(/[,;|]/)).forEach(add); walk(item, depth + 1); } } }
    walk(__esParseBody(body), 0); return out;
  }
  function __esRequestNumber(urlValue, body, pattern) { try { var url = new URL(String(urlValue || ''), window.location.href), found = null; url.searchParams.forEach(function(v, k) { if (found === null && pattern.test(k)) found = __esNum(v); }); if (found !== null) return found; } catch (e) {} var parsed = __esParseBody(body); var queue = parsed && typeof parsed === 'object' ? [parsed] : []; var visited = 0; while (queue.length && visited++ < 100) { var current = queue.shift(); if (!current || typeof current !== 'object' || Array.isArray(current)) continue; var keys = Object.keys(current); for (var i = 0; i < keys.length; i++) { var key = keys[i], value = current[key]; if (pattern.test(key)) { var n = __esNum(value); if (n !== null) return n; } if (value && typeof value === 'object') queue.push(value); } } return null; }
  function __esSailingObject(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) return false; var shipInfo = value.shipInfo && typeof value.shipInfo === 'object' ? value.shipInfo : {}; var vessel = value.vessel && typeof value.vessel === 'object' ? value.vessel : {}; var ship = value.shipName || value.ship || value.vesselName || value.shipCode || shipInfo.name || vessel.name || ''; var voyage = value.voyage && typeof value.voyage === 'object' ? value.voyage : {}; var date = value.sailDate || value.departureDate || value.startDate || value.embarkDate || value.sailingDate || value.departure || voyage.departureDate || voyage.sailDate || ''; return !!(ship && date) || !!(date && /voyage|itinerary|ship|vessel/i.test(Object.keys(value).join('|'))); }
  function __esGet(root, path) { var current = root; for (var i = 0; i < path.length; i++) { if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined; current = current[path[i]]; } return current; }
  function __esObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
  function __esAdapter(data) {
    var paths = [
      ['sailings'],['cruises'],['voyages'],['departures'],['data','sailings'],['data','cruises'],['data','voyages'],['data','departures'],['data','itineraries'],['data','results'],['data','records'],['data','search','sailings'],['data','search','results'],['data','cruiseSearch','sailings'],['data','cruiseSearch','results'],['data','searchCruises','results'],['data','searchCruises','sailings'],['payload','sailings'],['payload','results']
    ];
    for (var pi = 0; pi < paths.length; pi++) { var path = paths[pi], value = __esGet(data, path); if (!Array.isArray(value)) continue; var parent = __esObject(__esGet(data, path.slice(0, path.length - 1))); var leaf = String(path[path.length - 1] || '').toLowerCase(); if (value.length === 0 && /^(results|records)$/.test(leaf)) { var siblingKeys = Object.keys(parent || {}).join('|').toLowerCase(); if (/facet|filter|aggregation|bucket|pricing|cabin|availability|config/.test(siblingKeys)) continue; } var valid = value.length === 0; for (var vi = 0; vi < value.length && !valid; vi++) valid = __esSailingObject(value[vi]); if (!valid) continue; var pagination = parent && (__esObject(parent.pagination) || __esObject(parent.pageInfo) || __esObject(parent.meta)); return { id: 'explicit:' + path.join('.'), path: path.join('.'), items: value, parent: parent, containers: [pagination, parent, __esObject(data && data.data), __esObject(data)].filter(Boolean), empty: value.length === 0 }; }
    var dataRoot = __esObject(data && data.data) || __esObject(data); if (!dataRoot) return null; var candidates = []; var fields = Object.keys(dataRoot).slice(0, 100); for (var fi = 0; fi < fields.length; fi++) { var field = fields[fi], object = __esObject(dataRoot[field]); if (object) candidates.push({ field: field, value: object }); if (object) { var nested = Object.keys(object).slice(0, 60); for (var ni = 0; ni < nested.length; ni++) { var nestedObject = __esObject(object[nested[ni]]); if (nestedObject) candidates.push({ field: field + '.' + nested[ni], value: nestedObject }); } } }
    for (var ci = 0; ci < candidates.length; ci++) { var candidate = candidates[ci], nodes = Array.isArray(candidate.value.nodes) ? candidate.value.nodes : null, edges = Array.isArray(candidate.value.edges) ? candidate.value.edges.map(function(edge) { return edge && edge.node; }).filter(Boolean) : null, items = nodes || edges; if (!items) continue; var validItems = items.length === 0; for (var ii = 0; ii < items.length && !validItems; ii++) validItems = __esSailingObject(items[ii]); if (!validItems) continue; var pageInfo = __esObject(candidate.value.pageInfo) || __esObject(candidate.value.pagination) || __esObject(candidate.value.meta); return { id: 'graphql:' + candidate.field, path: 'data.' + candidate.field + (nodes ? '.nodes' : '.edges[].node'), items: items, parent: candidate.value, containers: [pageInfo, candidate.value, dataRoot, __esObject(data)].filter(Boolean), empty: items.length === 0 }; }
    return null;
  }
  function __esFirst(containers, pattern) { for (var i = 0; i < containers.length; i++) { var keys = Object.keys(containers[i] || {}); for (var j = 0; j < keys.length; j++) if (pattern.test(keys[j])) return containers[i][keys[j]]; } return undefined; }
  function __esAnalyzeCarnivalPayload(data, meta) {
    var encoded = ''; try { encoded = JSON.stringify(data); } catch (e) {}
    var requestCodes = __esRequestCodes(meta.requestUrl || '', meta.body), expectedCode = __esCompact(meta.expectedOfferCode).toUpperCase(), payloadCodes = __esRequestCodes('', data), requestCodeMatched = requestCodes.indexOf(expectedCode) >= 0, payloadCodeMatched = payloadCodes.length === 1 && payloadCodes[0] === expectedCode, requestCodeConflict = requestCodes.length > 0 && !requestCodeMatched, payloadCodeConflict = payloadCodes.length === 1 && !payloadCodeMatched;
    var approvedEndpoint = false; try { var approvedUrl = new URL(String(meta.responseUrl || meta.requestUrl || ''), window.location.href); approvedEndpoint = /(^|\.)carnival\.com$/i.test(approvedUrl.hostname) && /(?:cruise|sailing|voyage|itinerar|search|departure)/i.test(approvedUrl.pathname + approvedUrl.search); } catch (e0) {}
    var contextStartedAt = Number(meta.contextStartedAt || 0), requestStartedAt = Number(meta.requestStartedAt || 0), requestStartedAfterContext = contextStartedAt > 0 && requestStartedAt >= contextStartedAt, expectedNavigationSequenceId = Number(meta.expectedNavigationSequenceId || meta.navigationSequenceId || 0), navigationSequenceId = Number(meta.navigationSequenceId || 0), navigationSequenceMatched = expectedNavigationSequenceId > 0 && navigationSequenceId === expectedNavigationSequenceId;
    var reqPage = __esRequestNumber(meta.requestUrl || '', meta.body, /^(page|pagenumber|page_number|pageindex|currentpage)$/i), reqSize = __esRequestNumber(meta.requestUrl || '', meta.body, /^(pagesize|page_size|limit|perpage|itemsperpage)$/i), reqOffset = __esRequestNumber(meta.requestUrl || '', meta.body, /^(offset|skip|startindex|start)$/i), expectedPage = Math.max(1, Number(meta.expectedPageNumber || 1)), derivedPage = reqPage !== null ? (reqPage === 0 ? 1 : reqPage) : (reqOffset !== null && reqSize ? Math.floor(reqOffset / reqSize) + 1 : null);
    function normalizeUrl(raw) { try { var u = new URL(String(raw || ''), window.location.href); u.hash = ''; u.searchParams.sort(); return u.toString(); } catch (e) { return String(raw || ''); } }
    var exactExpectedUrlMatched = !!meta.expectedUrl && normalizeUrl(meta.requestUrl || '') === normalizeUrl(meta.expectedUrl || '');
    var adapter = __esAdapter(data), items = adapter ? adapter.items.filter(__esSailingObject) : [], contextCorrelated = !!(adapter && approvedEndpoint && requestStartedAfterContext && navigationSequenceMatched && !requestCodeConflict && !payloadCodeConflict && expectedCode), codeMatched = !!expectedCode && (requestCodeMatched || (requestCodes.length === 0 && payloadCodeMatched) || contextCorrelated), pageMatched = derivedPage === null ? (expectedPage === 1 || exactExpectedUrlMatched || /(?:cursor|pagetoken|continuationtoken|after)=/i.test(String(meta.requestUrl || '') + String(meta.body || '')) || contextCorrelated) : derivedPage === expectedPage, offerProofSource = requestCodeMatched ? 'request' : (payloadCodeMatched ? 'payload' : (contextCorrelated ? 'context' : 'none')), pageProofSource = derivedPage !== null && derivedPage === expectedPage ? 'request' : (/(?:cursor|pagetoken|continuationtoken|after)=/i.test(String(meta.requestUrl || '') + String(meta.body || '')) ? 'cursor' : (exactExpectedUrlMatched ? 'expected_url' : (contextCorrelated ? 'context' : 'none'))), containers = adapter ? adapter.containers : [], total = __esNum(__esFirst(containers, /^(total|totalcount|totalresults|resultcount|recordcount|numberofresults)$/i)), directPage = __esNum(__esFirst(containers, /^(page|pagenumber|page_number|pageindex|currentpage)$/i)), size = __esNum(__esFirst(containers, /^(pagesize|page_size|limit|perpage|itemsperpage)$/i)) || reqSize, offset = __esNum(__esFirst(containers, /^(offset|skip|startindex|start)$/i)), nextCursorRaw = __esFirst(containers, /^(nextcursor|nextpagetoken|continuationtoken|nexttoken|endcursor)$/i), nextUrlRaw = __esFirst(containers, /^(next|nextpage|nextpageurl|nexturl)$/i), hasNextRaw = __esFirst(containers, /^(hasnext|hasnextpage|hasmore|more)$/i), hasNext = typeof hasNextRaw === 'boolean' ? hasNextRaw : null, pageNumber = directPage === 0 ? 1 : (directPage !== null ? directPage : derivedPage), nextCursor = nextCursorRaw == null ? '' : String(nextCursorRaw), nextUrl = typeof nextUrlRaw === 'string' ? nextUrlRaw : '';
    if (nextCursor || nextUrl) hasNext = true; if (hasNext === null && total !== null && size && pageNumber) hasNext = pageNumber * size < total;
    var keyText = ''; try { keyText = Object.keys(__esObject(data) || {}).join('|').toLowerCase() + '|' + Object.keys(__esObject(data && data.data) || {}).join('|').toLowerCase(); } catch (e2) {}
    var kind = 'unknown', reason = 'No whitelisted Carnival inventory adapter matched this payload', confidence = 0;
    if (adapter && items.length > 0) { kind = 'inventory'; confidence = Math.min(100, 80 + Math.min(19, items.length)); reason = 'Adapter ' + adapter.id + ' found ' + items.length + ' sailing object(s)'; }
    else if (!adapter && /offerid|ctaurl|offertitle|subtitle/.test(keyText)) { kind = 'offer_catalog'; confidence = 85; reason = 'Offer catalog schema'; }
    else if (!adapter && /facet|filter|aggregation|bucket|refinement/.test(keyText)) { kind = 'facets'; confidence = 85; reason = 'Facet/filter schema'; }
    else if (!adapter && /price|pricing|fare|cabin|room|stateroom|availability/.test(keyText)) { kind = 'pricing'; confidence = 75; reason = 'Pricing/availability schema'; }
    else if (adapter && adapter.empty && codeMatched && pageMatched && total === 0) { kind = 'inventory_empty'; confidence = 98; reason = 'Matched explicit inventory adapter reported zero'; }
    else if (!adapter && /analytic|tracking|telemetry|experiment/.test(keyText)) { kind = 'analytics'; confidence = 80; reason = 'Analytics schema'; }
    else if (!adapter && /config|setting|featureflag|localization/.test(keyText)) { kind = 'configuration'; confidence = 70; reason = 'Configuration schema'; }
    return { kind: kind, adapterId: adapter ? adapter.id : '', inventoryPath: adapter ? adapter.path : '', inventoryItems: items, totalResults: total, pageNumber: pageNumber, pageSize: size, offset: offset !== null ? offset : reqOffset, cursor: '', nextCursor: nextCursor, nextUrl: nextUrl, hasNextPage: hasNext, requestOfferCodes: requestCodes, payloadOfferCodes: payloadCodes, offerCodeMatched: codeMatched, pageMatched: pageMatched, approvedEndpoint: approvedEndpoint, requestStartedAfterContext: requestStartedAfterContext, navigationSequenceMatched: navigationSequenceMatched, contextCorrelated: contextCorrelated, offerProofSource: offerProofSource, pageProofSource: pageProofSource, authoritativeEmpty: kind === 'inventory_empty' && codeMatched && pageMatched, confidence: confidence, reason: reason, payloadBytes: encoded.length };
  }
`;
