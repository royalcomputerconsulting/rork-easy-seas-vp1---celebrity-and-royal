import type { CalendarEvent, CasinoOffer, Cruise, SlotMachine } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import { calculateOfferIntelligenceScore } from '@/lib/offerIntelligence';
import type { AskMyDataOverview } from '@/lib/askMyDataOverview';
import type { RecognitionEntryWithCrew } from '@/types/crew-recognition';
import type { SailingWeatherForecast } from '@/state/SailingWeatherProvider';
import type { ConversationSourceReference } from '@/lib/askAllOffers/types';

export type AskMyDataSource = 'overview' | 'offers' | 'cruises' | 'certificates' | 'calendar' | 'crew' | 'machines' | 'weather' | 'system';
export type AskMyDataConfidence = 'high' | 'medium' | 'low';

export interface AskMyDataContextBlock {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  detail: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface AskMyDataResult {
  id: string;
  source: AskMyDataSource;
  title: string;
  subtitle: string;
  score: number;
  owner?: string;
  offerScore?: number;
  certificateFit?: string;
  actionLabel: string;
  actionRoute?: string;
  confidence: AskMyDataConfidence;
  matchedTerms: string[];
  matchReasons: string[];
  detail?: string;
}

export interface AskMyDataResponse {
  query: string;
  filtersApplied: string[];
  results: AskMyDataResult[];
  noResultsExplanation?: string;
  interpretedIntent: string;
  suggestedQueries: string[];
  directAnswer?: string;
}

export function buildAskMyDataSourceReferences(response: AskMyDataResponse, limit = 8): ConversationSourceReference[] {
  const typeBySource: Record<AskMyDataSource, ConversationSourceReference['sourceType']> = {
    overview: 'system', offers: 'offer', cruises: 'cruise', certificates: 'certificate',
    calendar: 'calendar', crew: 'crew', machines: 'machine', weather: 'weather', system: 'system',
  };
  return response.results.slice(0, limit).map((result, index) => ({
    id: `ask-my-data-source-${index + 1}-${result.id}`,
    sourceType: typeBySource[result.source],
    label: `[S${index + 1}] ${result.title}`,
    detail: `${result.subtitle}${result.matchReasons.length ? ` · ${result.matchReasons.slice(0, 3).join('; ')}` : ''}`,
    evidenceKind: result.source === 'overview' || result.source === 'system'
      ? 'calculated'
      : result.confidence === 'high' ? 'fact' : result.confidence === 'medium' ? 'calculated' : 'estimated',
    route: result.actionRoute,
  }));
}

type ExtendedCertificate = Certificate & {
  ownerProfileId?: string;
  sourceEmail?: string;
  casinoProgram?: string;
  offerCode?: string;
  cabinEntitlement?: string;
  cruiseId?: string;
  importStatus?: string;
  reconciliationStatus?: string;
};

type SourceIntent = Record<AskMyDataSource, boolean>;

interface QueryIntent {
  originalQuery: string;
  normalizedQuery: string;
  tokens: string[];
  expandedTerms: string[];
  sources: SourceIntent;
  wantsAllSources: boolean;
  wantsExpiring: boolean;
  wantsExpired: boolean;
  wantsBooked: boolean;
  wantsAvailable: boolean;
  wantsArchivedOrSkipped: boolean;
  wantsHighValue: boolean;
  wantsLowCost: boolean;
  wantsFreePlay: boolean;
  wantsObc: boolean;
  wantsCertificateFit: boolean;
  wantsOwnerIssues: boolean;
  wantsReviewNeeded: boolean;
  wantsSeaDays: boolean;
  wantsPorts: boolean;
  wantsBalcony: boolean;
  wantsSuite: boolean;
  wantsCrew: boolean;
  wantsMachines: boolean;
  wantsWeather: boolean;
  wantsSystem: boolean;
  wantsAnnualTierRewardUsage: boolean;
  minNights?: number;
  maxNights?: number;
  afterDate?: string;
  beforeDate?: string;
  calendarMonth?: number;
  calendarYear?: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'show', 'find', 'what', 'which', 'need', 'have', 'has', 'are', 'about', 'into', 'onto', 'than', 'then', 'next', 'my', 'me', 'all', 'any', 'can', 'you', 'please', 'records', 'record', 'data', 'search', 'look', 'looking', 'tell', 'give', 'list',
]);

const SYNONYMS: Record<string, string[]> = {
  offer: ['offer', 'promo', 'promotion', 'certificate', 'comp', 'casino', 'deal', 'freeplay', 'free play', 'obc', 'credit'],
  cruise: ['cruise', 'sailing', 'voyage', 'ship', 'itinerary', 'reservation', 'booking', 'port', 'sea day', 'cabin'],
  certificate: ['certificate', 'cert', 'nextcruise', 'next cruise', 'fpp', 'freeplay certificate', 'voucher'],
  calendar: ['calendar', 'event', 'events', 'agenda', 'tripit', 'travel', 'flight', 'hotel', 'date'],
  crew: ['crew', 'recognition', 'crew recognition', 'staff', 'employee', 'server', 'host', 'dealer', 'casino host', 'bartender', 'waiter', 'waitress', 'department'],
  machine: ['slot', 'slots', 'machine', 'machines', 'slot machine', 'atlas', 'ap', 'advantage play', 'must hit', 'must-hit', 'persistent', 'volatility', 'denomination'],
  weather: ['weather', 'forecast', 'rough seas', 'marine', 'wind', 'wave', 'swell', 'rain', 'storm', 'squall', 'sea state'],
  system: ['financial', 'finance', 'money', 'payment', 'balance due', 'deposit', 'price drop', 'price history', 'upgrade price', 'alert', 'anomaly', 'insight', 'bankroll', 'limit', 'tax', 'w2g', 'w-2g', 'comp item', 'comp', 'achievement', 'goal', 'analytics', 'performance', 'portfolio', 'data source', 'system', 'casino session', 'session', 'machine log', 'condition log', 'deck mapping', 'atlas observation'],
  expiring: ['expiring', 'expires', 'expiration', 'urgent', 'soon', 'deadline', 'lapsing', 'last chance'],
  booked: ['booked', 'booking', 'reservation', 'reserved', 'hold', 'courtesy hold'],
  value: ['value', 'best', 'strongest', 'highest', 'worth', 'roi', 'score', 'retail', 'savings'],
  cost: ['cheap', 'cheaper', 'lowest', 'cost', 'cash', 'taxes', 'fees', 'out of pocket', 'out-of-pocket'],
  review: ['review', 'unassigned', 'unknown', 'missing', 'flagged', 'reconcile', 'reconciliation', 'owner'],
};

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function normalizeDate(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.includes('T') ? text.split('T')[0] : text;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function expandTokens(tokens: string[], normalizedQuery: string): string[] {
  const expanded = new Set(tokens);
  Object.entries(SYNONYMS).forEach(([canonical, terms]) => {
    if (tokens.includes(canonical) || hasAny(normalizedQuery, terms)) {
      expanded.add(canonical);
      terms.flatMap((term) => term.split(/\s+/)).forEach((term) => {
        if (term.length > 2) expanded.add(term);
      });
    }
  });
  return Array.from(expanded);
}

function wordToNumber(value: string): number | undefined {
  const map: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    fourteen: 14,
    fifteen: 15,
  };
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return map[value.toLowerCase()];
}

function parseDateConstraint(normalizedQuery: string, mode: 'after' | 'before'): string | undefined {
  const pattern = mode === 'after'
    ? /(?:after|from)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/
    : /(?:before|until|by)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;
  const match = normalizedQuery.match(pattern);
  if (!match?.[1]) return undefined;
  const raw = match[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const pieces = raw.split('/');
  if (pieces.length !== 3) return undefined;
  const [month, day, year] = pieces;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const MONTH_NUMBER_BY_NAME: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseCalendarMonthConstraint(normalizedQuery: string): { month?: number; year?: number } {
  const monthMatch = normalizedQuery.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(20\d{2}))?/);
  if (!monthMatch?.[1]) return {};
  return {
    month: MONTH_NUMBER_BY_NAME[monthMatch[1]],
    // An unqualified month means that month in the current calendar year.
    year: monthMatch[2] ? Number(monthMatch[2]) : new Date().getFullYear(),
  };
}

function parseQueryIntent(query: string): QueryIntent {
  const normalizedQuery = normalize(query);
  const tokens = tokenize(query);
  const expandedTerms = expandTokens(tokens, normalizedQuery);
  const sourceMentions: SourceIntent = {
    overview: false,
    offers: hasAny(normalizedQuery, SYNONYMS.offer),
    cruises: hasAny(normalizedQuery, SYNONYMS.cruise),
    certificates: hasAny(normalizedQuery, SYNONYMS.certificate),
    calendar: hasAny(normalizedQuery, SYNONYMS.calendar),
    crew: hasAny(normalizedQuery, SYNONYMS.crew),
    machines: hasAny(normalizedQuery, SYNONYMS.machine),
    weather: hasAny(normalizedQuery, SYNONYMS.weather),
    system: hasAny(normalizedQuery, SYNONYMS.system),
  };
  const wantsAllSources = !Object.values(sourceMentions).some(Boolean);

  const nightsMatch = normalizedQuery.match(/(?:longer than|more than|over|at least)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:night|nights|day|days)/);
  const maxNightsMatch = normalizedQuery.match(/(?:shorter than|less than|under|at most)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:night|nights|day|days)/);
  const calendarConstraint = parseCalendarMonthConstraint(normalizedQuery);

  return {
    originalQuery: query,
    normalizedQuery,
    tokens,
    expandedTerms,
    sources: sourceMentions,
    wantsAllSources,
    wantsExpiring: hasAny(normalizedQuery, SYNONYMS.expiring),
    wantsExpired: /expired|past due|lapsed/.test(normalizedQuery),
    wantsBooked: hasAny(normalizedQuery, SYNONYMS.booked),
    wantsAvailable: /available|unused|open|active/.test(normalizedQuery),
    wantsArchivedOrSkipped: /archived|skipped|hidden|replaced/.test(normalizedQuery),
    wantsHighValue: hasAny(normalizedQuery, SYNONYMS.value),
    wantsLowCost: hasAny(normalizedQuery, SYNONYMS.cost),
    wantsFreePlay: /free\s*play|freeplay|fp\b/.test(normalizedQuery),
    wantsObc: /obc|onboard credit|on board credit|shipboard credit/.test(normalizedQuery),
    wantsCertificateFit: /fit|stack|stacking|apply|match|use.*cert|cert.*offer/.test(normalizedQuery),
    wantsOwnerIssues: /owner|profile|unassigned|unknown email|account/.test(normalizedQuery),
    wantsReviewNeeded: hasAny(normalizedQuery, SYNONYMS.review),
    wantsSeaDays: /sea day|sea days|casino day|casino days/.test(normalizedQuery),
    wantsPorts: /port|ports|country|countries|destination/.test(normalizedQuery),
    wantsBalcony: /balcony/.test(normalizedQuery),
    wantsSuite: /suite|junior suite|grand suite/.test(normalizedQuery),
    wantsCrew: sourceMentions.crew,
    wantsMachines: sourceMentions.machines,
    wantsWeather: sourceMentions.weather,
    wantsSystem: sourceMentions.system,
    wantsAnnualTierRewardUsage: isAnnualTierRewardQuestion(query),
    minNights: nightsMatch?.[1] ? wordToNumber(nightsMatch[1]) : undefined,
    maxNights: maxNightsMatch?.[1] ? wordToNumber(maxNightsMatch[1]) : undefined,
    afterDate: parseDateConstraint(normalizedQuery, 'after'),
    beforeDate: parseDateConstraint(normalizedQuery, 'before'),
    calendarMonth: calendarConstraint.month,
    calendarYear: calendarConstraint.year,
  };
}

export function isAnnualTierRewardQuestion(message: string): boolean {
  const text = normalize(message).replace(/[^a-z0-9]+/g, ' ').trim();
  const asksForUsage = /\b(what|which|where|use|used|using|redeem|redeemed|apply|applied|book|booked)\b/.test(text);
  const referencesCruise = /\b(cruise|sailing|voyage|booking|reservation|ship)\b/.test(text);
  const referencesTier = /\b(signature|tier|status)\b/.test(text);
  const referencesAnnualReward = /\bannual\b/.test(text) && /\b(reward|rewards|benefit|benefits|offer|offers|cruise)\b/.test(text);
  const referencesAnnualCruise = /\bannual\s+(?:tier\s+|signature\s+|complimentary\s+|free\s+)?cruise\b/.test(text);
  const referencesExactTierCode = /\b(?:offer|promo|promotion|rate)?\s*code\s+(?:was\s+|is\s+)?tier\b/.test(text)
    || /\btier\s+(?:as\s+)?(?:the\s+)?(?:offer\s+|promo\s+|rate\s+)?code\b/.test(text);
  return asksForUsage && referencesCruise && ((referencesTier && referencesAnnualReward) || referencesAnnualCruise || referencesExactTierCode);
}

export function buildAskMyDataConversationalQuery(currentMessage: string, previousUserMessage?: string): string {
  const current = currentMessage.trim();
  const previous = previousUserMessage?.trim() ?? '';
  if (!current || !previous) return current;
  const tokenCount = current.split(/\s+/).filter(Boolean).length;
  const followUpLanguage = /^(?:and|also|yes|no|actually|instead|what about|how about)\b|\b(it|its|that|this|those|them|one|same|code|clarification|meant)\b/i.test(current);
  if (!followUpLanguage || tokenCount > 24) return current;
  return `${previous}\nFollow-up clarification: ${current}`;
}

function scoreText(intent: QueryIntent, text: string): { score: number; matchedTerms: string[] } {
  const normalizedText = normalize(text);
  const matchedTerms = intent.expandedTerms.filter((token) => normalizedText.includes(token));
  const exactPhraseBoost = intent.normalizedQuery.length > 4 && normalizedText.includes(intent.normalizedQuery) ? 32 : 0;
  return {
    score: matchedTerms.length * 10 + exactPhraseBoost,
    matchedTerms: unique(matchedTerms),
  };
}

function getOfferExpiry(offer: CasinoOffer): string | undefined {
  return offer.expiryDate || offer.expires || offer.offerExpiryDate || offer.validUntil;
}

function daysUntil(dateString?: string): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function datePasses(dateString: string | undefined, intent: QueryIntent): boolean {
  const date = normalizeDate(dateString);
  if (!date) return true;
  if (intent.afterDate && date < intent.afterDate) return false;
  if (intent.beforeDate && date > intent.beforeDate) return false;
  if (intent.calendarMonth || intent.calendarYear) {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    if (intent.calendarYear && Number(match[1]) !== intent.calendarYear) return false;
    if (intent.calendarMonth && Number(match[2]) !== intent.calendarMonth) return false;
  }
  return true;
}

function confidenceFromScore(score: number): AskMyDataConfidence {
  if (score >= 55) return 'high';
  if (score >= 24) return 'medium';
  return 'low';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getFirstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (isFiniteNumber(value)) return value;
  }
  return null;
}

function money(value: number | null): string | null {
  if (value === null) return null;
  return String.fromCharCode(36) + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCruiseOfferData(cruise: Cruise): {
  hasOfferData: boolean;
  offerLabel: string;
  retailValue: number | null;
  paidValue: number | null;
  compValue: number | null;
  freePlay: number | null;
  obc: number | null;
  points: number | null;
  winnings: number | null;
  detail: string;
} {
  const record = cruise as unknown as Cruise & Record<string, unknown>;
  const offerCode = typeof cruise.offerCode === 'string' ? cruise.offerCode : '';
  const offerName = typeof cruise.offerName === 'string' ? cruise.offerName : '';
  const offerCategory = typeof cruise.offerCategory === 'string' ? cruise.offerCategory : '';
  const perks = Array.isArray(cruise.perks) ? cruise.perks.join(', ') : '';
  const retailValue = getFirstNumber(record, ['retailValue', 'totalRetailCost', 'originalPrice', 'totalValue']);
  const paidValue = getFirstNumber(record, ['netEffectivePaid', 'pricePaid', 'amountPaid', 'taxesFeesEstimate', 'taxes', 'totalPrice', 'price']);
  const compValue = getFirstNumber(record, ['compValue', 'totalCasinoDiscount', 'cruiseValueCaptured']);
  const freePlay = getFirstNumber(record, ['freePlay', 'freeplayAmount']);
  const obc = getFirstNumber(record, ['freeOBC', 'OBC', 'obcAmount']);
  const points = getFirstNumber(record, ['pointsEarned', 'earnedPoints', 'casinoPoints']);
  const winnings = getFirstNumber(record, ['winningsBroughtHome', 'winnings', 'totalWinnings']);
  const sourcePayload = record.sourcePayload && typeof record.sourcePayload === 'object'
    ? JSON.stringify(record.sourcePayload)
    : '';

  const hasOfferData = Boolean(
    offerCode ||
    offerName ||
    offerCategory ||
    perks ||
    freePlay !== null ||
    obc !== null ||
    compValue !== null ||
    sourcePayload.toLowerCase().includes('casino') ||
    sourcePayload.toLowerCase().includes('offer')
  );

  const offerLabel = offerCode || offerName || offerCategory || (hasOfferData ? 'Casino offer-backed booking' : 'No offer label');
  const detailParts = [
    offerName ? `Offer: ${offerName}` : null,
    offerCategory ? `Category: ${offerCategory}` : null,
    money(retailValue) ? `Retail value ${money(retailValue)}` : null,
    money(paidValue) ? `Net/paid ${money(paidValue)}` : null,
    money(compValue) ? `Comp/value captured ${money(compValue)}` : null,
    money(freePlay) ? `FreePlay ${money(freePlay)}` : null,
    money(obc) ? `OBC ${money(obc)}` : null,
    points !== null ? `${Math.round(points).toLocaleString()} casino points recorded` : null,
    money(winnings) ? `Winnings brought home ${money(winnings)}` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    hasOfferData,
    offerLabel,
    retailValue,
    paidValue,
    compValue,
    freePlay,
    obc,
    points,
    winnings,
    detail: detailParts.join(' · '),
  };
}

const TIER_CODE_FIELDS = [
  'offerCode',
  'promoCode',
  'promotionCode',
  'rateCode',
  'casinoOfferCode',
  'bookingOfferCode',
] as const;

function stringField(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value).trim();
  }
  return '';
}

function findExactTierCodeInPayload(value: unknown, depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return /["'](?:offerCode|promoCode|promotionCode|rateCode|casinoOfferCode|bookingOfferCode)["']\s*:\s*["']TIER["']/i.test(value)
      ? 'source payload offer code TIER'
      : null;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) {
      const match = findExactTierCodeInPayload(item, depth + 1);
      if (match) return match;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (TIER_CODE_FIELDS.some((field) => field.toLowerCase() === key.toLowerCase()) && normalize(nested) === 'tier') {
      return `${key} TIER`;
    }
    const match = findExactTierCodeInPayload(nested, depth + 1);
    if (match) return match;
  }
  return null;
}

function exactTierCodeEvidence(record: Record<string, unknown>): string | null {
  for (const field of TIER_CODE_FIELDS) {
    if (normalize(record[field]) === 'tier') return `${field} TIER`;
  }
  return findExactTierCodeInPayload(record.sourcePayload ?? record.rawPayload ?? record.bookingPayload);
}

function hasBookedCruiseEvidence(cruise: Cruise): boolean {
  const record = cruise as unknown as Record<string, unknown>;
  const status = [cruise.status, record.bookingStatus, record.completionState, record.reservationStatus].filter(Boolean).join(' ').toLowerCase();
  if (/booked|confirmed|reserved|completed|courtesy hold|active/.test(status)) return true;
  if (record.isBooked === true || record.isReservation === true) return true;
  return Boolean(stringField(record, ['reservationNumber', 'reservationId', 'bookingNumber', 'bookingId', 'confirmationNumber']));
}

function findLinkedTierOffer(cruise: Cruise, offers: CasinoOffer[]): CasinoOffer | undefined {
  const cruiseRecord = cruise as unknown as Record<string, unknown>;
  const reservation = stringField(cruiseRecord, ['reservationNumber', 'reservationId', 'bookingNumber', 'bookingId', 'confirmationNumber']);
  const shipName = normalize(cruise.shipName);
  const sailDate = normalizeDate(cruise.sailDate);
  return offers.find((offer) => {
    const offerRecord = offer as unknown as Record<string, unknown>;
    if (!exactTierCodeEvidence(offerRecord)) return false;
    if (String(offer.cruiseId ?? '') === String(cruise.id) || offer.cruiseIds?.some((id) => String(id) === String(cruise.id))) return true;
    const offerReservation = stringField(offerRecord, ['reservationNumber', 'reservationId', 'bookingNumber', 'bookingId', 'confirmationNumber']);
    if (reservation && offerReservation && reservation === offerReservation) return true;
    return Boolean(shipName && sailDate && normalize(offer.shipName) === shipName && normalizeDate(offer.sailingDate) === sailDate);
  });
}

function buildAnnualTierRewardAnswer(offers: CasinoOffer[], cruises: Cruise[]): { results: AskMyDataResult[]; directAnswer?: string } {
  const matches = new Map<string, AskMyDataResult>();

  cruises.forEach((cruise) => {
    if (!hasBookedCruiseEvidence(cruise)) return;
    const record = cruise as unknown as Record<string, unknown>;
    const directEvidence = exactTierCodeEvidence(record);
    const linkedOffer = directEvidence ? undefined : findLinkedTierOffer(cruise, offers);
    const linkedEvidence = linkedOffer ? exactTierCodeEvidence(linkedOffer as unknown as Record<string, unknown>) : null;
    const codeEvidence = directEvidence ?? linkedEvidence;
    if (!codeEvidence) return;

    const reservation = stringField(record, ['reservationNumber', 'reservationId', 'bookingNumber', 'bookingId', 'confirmationNumber']);
    const status = stringField(record, ['status', 'bookingStatus', 'completionState', 'reservationStatus']);
    const endDate = stringField(record, ['returnDate', 'endDate', 'sailEndDate']);
    const key = reservation || `${normalize(cruise.shipName)}|${normalizeDate(cruise.sailDate)}`;
    const subtitleParts = [
      normalizeDate(cruise.sailDate) || 'sailing date missing',
      endDate ? `returns ${normalizeDate(endDate)}` : null,
      cruise.nights ? `${cruise.nights} nights` : null,
      cruise.destination || cruise.departurePort || null,
      reservation ? `reservation ${reservation}` : null,
    ].filter((part): part is string => Boolean(part));
    const evidenceParts = [
      `exact saved ${codeEvidence}`,
      status ? `booking status ${status}` : 'booked-cruise record',
      linkedOffer ? `linked offer record ${linkedOffer.id}` : null,
    ].filter((part): part is string => Boolean(part));

    matches.set(key, {
      id: `annual-tier-reward-${cruise.id}`,
      source: 'cruises',
      title: cruise.shipName || 'Saved cruise booking',
      subtitle: subtitleParts.join(' · '),
      score: directEvidence ? 500 : 450,
      owner: getOwner(cruise),
      actionLabel: 'View cruise',
      actionRoute: `/cruise-details?id=${encodeURIComponent(cruise.id)}`,
      confidence: 'high',
      matchedTerms: ['signature', 'annual', 'tier', 'cruise', 'tier code'],
      matchReasons: evidenceParts,
      detail: `Evidence: ${evidenceParts.join('; ')}.`,
    });
  });

  const results = Array.from(matches.values()).sort((left, right) => right.score - left.score);
  const primary = results[0];
  if (!primary) return { results };
  const extra = results.length > 1
    ? ` I found ${results.length} booked records carrying that exact code; the strongest saved match is shown first.`
    : '';
  return {
    results,
    directAnswer: `You used your Signature annual cruise reward on ${primary.title}, ${primary.subtitle}. Easy Seas identified it from the exact saved offer code TIER on the booked-cruise evidence.${extra}`,
  };
}

function addReason(reasons: string[], condition: boolean, reason: string, score: number): number {
  if (!condition) return 0;
  reasons.push(reason);
  return score;
}

function getOwner(record: { sourceEmail?: string; ownerProfileId?: string }): string | undefined {
  return record.sourceEmail || record.ownerProfileId;
}

function offerPassesStructuredFilters(offer: CasinoOffer, intent: QueryIntent): boolean {
  const expiry = getOfferExpiry(offer);
  const days = daysUntil(expiry);
  if (intent.wantsExpiring && (days === null || days > 45 || days < 0)) return false;
  if (intent.wantsExpired && !(days !== null && days < 0)) return false;
  if (intent.wantsArchivedOrSkipped && !/archived|skipped|replaced/.test(`${offer.status ?? ''} ${offer.archiveStatus ?? ''}`.toLowerCase())) return false;
  if (intent.wantsAvailable && /archived|skipped|expired|used|replaced/.test(`${offer.status ?? ''} ${offer.archiveStatus ?? ''}`.toLowerCase())) return false;
  if (intent.minNights && (offer.nights ?? 0) < intent.minNights) return false;
  if (intent.maxNights && (offer.nights ?? 999) > intent.maxNights) return false;
  if (intent.wantsBalcony && !normalize(offer.roomType).includes('balcony')) return false;
  if (intent.wantsSuite && !normalize(offer.roomType).includes('suite')) return false;
  if (intent.wantsFreePlay && !((offer.freePlay ?? 0) > 0 || (offer.freeplayAmount ?? 0) > 0)) return false;
  if (intent.wantsObc && !((offer.OBC ?? 0) > 0 || (offer.obcAmount ?? 0) > 0)) return false;
  return datePasses(offer.sailingDate || expiry, intent);
}

function cruisePassesStructuredFilters(cruise: Cruise, intent: QueryIntent): boolean {
  const record = cruise as unknown as Record<string, unknown>;
  const bookingState = `${cruise.status ?? ''} ${record.bookingStatus ?? ''} ${record.reservationStatus ?? ''} ${record.completionState ?? ''}`.toLowerCase();
  if (intent.wantsBooked && (!/booked|confirmed|reserved|reservation|courtesy hold|active/.test(bookingState) || /completed|cancelled/.test(bookingState))) return false;
  if (intent.wantsAvailable && /archived|cancelled/.test(`${cruise.status ?? ''}`.toLowerCase())) return false;
  if (intent.minNights && (cruise.nights ?? 0) < intent.minNights) return false;
  if (intent.maxNights && (cruise.nights ?? 999) > intent.maxNights) return false;
  if (intent.wantsBalcony && !normalize(cruise.cabinType).includes('balcony')) return false;
  if (intent.wantsSuite && !normalize(cruise.cabinType).includes('suite')) return false;
  if (intent.wantsPorts && !(cruise.ports?.length || cruise.destination || cruise.departurePort)) return false;
  return datePasses(cruise.sailDate, intent);
}

function certificatePassesStructuredFilters(certificate: ExtendedCertificate, intent: QueryIntent): boolean {
  const days = daysUntil(certificate.expiryDate);
  if (intent.wantsExpiring && (days === null || days > 60 || days < 0)) return false;
  if (intent.wantsExpired && !(days !== null && days < 0 || certificate.status === 'expired')) return false;
  if (intent.wantsAvailable && /used|expired/.test(certificate.status ?? '')) return false;
  // Query date constraints for certificates apply to parsed sailing dates, not
  // to the certificate's redemption deadline. Expiry filters are handled above.
  return true;
}

function crewPassesStructuredFilters(entry: RecognitionEntryWithCrew, intent: QueryIntent): boolean {
  return datePasses(entry.sailStartDate, intent) || datePasses(entry.sailEndDate, intent);
}

function weatherPassesStructuredFilters(forecast: SailingWeatherForecast, intent: QueryIntent): boolean {
  return datePasses(forecast.dateKey, intent);
}

function getInterpretedIntent(intent: QueryIntent): string {
  if (intent.wantsAnnualTierRewardUsage) return 'Club Royale annual tier cruise reward usage';
  const pieces: string[] = [];
  if (intent.wantsAllSources) pieces.push('all data sources');
  else {
    if (intent.sources.offers) pieces.push('offers');
    if (intent.sources.cruises) pieces.push('cruises');
    if (intent.sources.certificates) pieces.push('certificates');
    if (intent.sources.calendar) pieces.push('calendar/events');
    if (intent.sources.crew) pieces.push('crew recognition');
    if (intent.sources.machines) pieces.push('slot machines');
    if (intent.sources.weather) pieces.push('weather reports');
    if (intent.sources.system) pieces.push('app-wide system context');
  }
  if (intent.wantsExpiring) pieces.push('expiring soon');
  if (intent.wantsHighValue) pieces.push('high value');
  if (intent.wantsLowCost) pieces.push('low out-of-pocket');
  if (intent.minNights) pieces.push(`${intent.minNights}+ nights`);
  if (intent.maxNights) pieces.push(`≤${intent.maxNights} nights`);
  if (intent.afterDate) pieces.push(`after ${intent.afterDate}`);
  if (intent.beforeDate) pieces.push(`before ${intent.beforeDate}`);
  if (intent.calendarMonth && intent.calendarYear) pieces.push(`month ${String(intent.calendarMonth).padStart(2, '0')}/${intent.calendarYear}`);
  if (intent.wantsOwnerIssues || intent.wantsReviewNeeded) pieces.push('needs review/assignment');
  return pieces.join(' • ');
}

function buildSuggestedQueries(intent: QueryIntent): string[] {
  const suggestions = [
    'Give me my casino and ROI overview',
    'Show current Signature tier progress',
    'Show expiring high value offers with free play',
    'Find booked balcony cruises longer than seven nights',
    'Show my upcoming calendar events',
    'Which crew members have I recognized on recent sailings?',
    'What slot machines should I check on my next ship?',
    'Show weather and rough seas reports for my next cruise',
  ];
  if (intent.sources.offers || intent.wantsExpiring) suggestions.unshift('Compare my best expiring offers by score');
  if (intent.sources.cruises || intent.wantsSeaDays) suggestions.unshift('Show cruises with the most sea days');
  if (intent.sources.crew) suggestions.unshift('Summarize crew recognition by ship and department');
  if (intent.sources.machines) suggestions.unshift('Find AP-friendly slot machines and recent condition logs');
  if (intent.sources.weather) suggestions.unshift('Show rough seas and bad-weather watchouts');
  return unique(suggestions).slice(0, 5);
}

function wantsOverviewResult(intent: QueryIntent): boolean {
  if (intent.wantsAnnualTierRewardUsage) return false;
  return intent.wantsAllSources || /overview|summary|annual|historical|current season|season|roi|cash result|value capture|economic value|coin.?in|tier|signature|masters|points|casino|context|latest/.test(intent.normalizedQuery);
}

export function askMyDataSearch(params: {
  query: string;
  offers: CasinoOffer[];
  cruises: Cruise[];
  certificates: Certificate[];
  calendarEvents: CalendarEvent[];
  crewRecognitionEntries?: RecognitionEntryWithCrew[];
  slotMachines?: SlotMachine[];
  weatherReports?: SailingWeatherForecast[];
  additionalContextBlocks?: AskMyDataContextBlock[];
  overview?: AskMyDataOverview;
}): AskMyDataResponse {
  const intent = parseQueryIntent(params.query);
  const crewRecognitionEntries = params.crewRecognitionEntries ?? [];
  const slotMachines = params.slotMachines ?? [];
  const weatherReports = params.weatherReports ?? [];
  const additionalContextBlocks = params.additionalContextBlocks ?? [];
  const cruiseOfferRecords = params.cruises.filter((cruise) => getCruiseOfferData(cruise).hasOfferData);
  const certificateSailingRecords = params.certificates.reduce((total, certificate) => total + (certificate.parsedSailings?.length ?? 0), 0);
  const dataIndexLabel = `loaded ${params.offers.length.toLocaleString()} standalone offer(s), ${cruiseOfferRecords.length.toLocaleString()} booked cruise offer record(s), ${params.cruises.length.toLocaleString()} cruise(s), ${params.certificates.length.toLocaleString()} certificate(s) with ${certificateSailingRecords.toLocaleString()} parsed sailing row(s), ${params.calendarEvents.length.toLocaleString()} event(s), ${crewRecognitionEntries.length.toLocaleString()} crew recognition record(s), ${slotMachines.length.toLocaleString()} slot machine record(s), ${weatherReports.length.toLocaleString()} weather report(s), ${additionalContextBlocks.length.toLocaleString()} app-wide context block(s)`;
  const interpretedIntent = getInterpretedIntent(intent) || 'all data sources';
  const filtersApplied: string[] = [interpretedIntent, dataIndexLabel];
  const results: AskMyDataResult[] = [];

  if (intent.wantsAnnualTierRewardUsage) {
    const annualReward = buildAnnualTierRewardAnswer(params.offers, params.cruises);
    return {
      query: params.query,
      filtersApplied,
      results: annualReward.results,
      interpretedIntent,
      directAnswer: annualReward.directAnswer,
      suggestedQueries: ['Show this booked cruise', 'What benefits were recorded on that booking?', 'Show my other booked casino offer cruises'],
      noResultsExplanation: annualReward.results.length === 0
        ? 'I searched booked and completed cruise records, linked offers, reservation fields, and retained source payloads for the exact offer code TIER, but no verified match was stored in the active profile scope.'
        : undefined,
    };
  }

  if (params.overview && wantsOverviewResult(intent)) {
    results.push({
      id: 'overview-casino-roi-context',
      source: 'overview',
      title: 'Casino / ROI Overview',
      subtitle: `${params.overview.currentSeason.points.toLocaleString()} current-season points · ${params.overview.currentSeason.pointsNeededForSignature.toLocaleString()} to keep Signature · ${params.overview.annual.totals.totalPoints.toLocaleString()} annual points`,
      score: 140,
      actionLabel: 'Use this context',
      confidence: 'high',
      matchedTerms: intent.expandedTerms,
      matchReasons: ['loaded latest saved cruise/casino context', 'uses corrected ROI formulas', 'coin-in isolated to gaming activity'],
      detail: params.overview.text,
    });
  }

  if (intent.sources.offers || intent.wantsAllSources) {
    params.offers.forEach((offer) => {
      if (!offerPassesStructuredFilters(offer, intent)) return;
      const haystack = [offer.offerCode, offer.offerName, offer.title, offer.description, offer.shipName, offer.roomType, offer.sourceEmail, offer.ownerProfileId, offer.casinoProgram, offer.brand, offer.offerSource, offer.status, offer.archiveStatus].filter(Boolean).join(' ');
      const expiry = getOfferExpiry(offer);
      const expiryDays = daysUntil(expiry);
      const textScore = scoreText(intent, haystack);
      const intelligence = calculateOfferIntelligenceScore(offer, params.cruises, params.certificates);
      const reasons: string[] = [];
      let score = textScore.score + Math.round(intelligence.score / 6);
      score += addReason(reasons, intent.wantsExpiring && expiryDays !== null && expiryDays >= 0 && expiryDays <= 45, `expires in ${expiryDays ?? 0} day(s)`, Math.max(8, 36 - (expiryDays ?? 0)));
      score += addReason(reasons, intent.wantsHighValue && intelligence.score >= 65, `offer score ${intelligence.score}/100`, 26);
      score += addReason(reasons, intent.wantsFreePlay && ((offer.freePlay ?? 0) > 0 || (offer.freeplayAmount ?? 0) > 0), 'has FreePlay', 18);
      score += addReason(reasons, intent.wantsObc && ((offer.OBC ?? 0) > 0 || (offer.obcAmount ?? 0) > 0), 'has onboard credit', 18);
      score += addReason(reasons, intent.wantsOwnerIssues && !getOwner(offer), 'missing owner/profile', 22);
      score += addReason(reasons, intent.wantsReviewNeeded && (offer.importStatus === 'reviewNeeded' || offer.reconciliationStatus === 'reviewNeeded' || offer.importStatus === 'unassigned'), 'needs import review', 24);
      score += addReason(reasons, intent.minNights !== undefined && (offer.nights ?? 0) >= intent.minNights, `${offer.nights} nights`, 10);

      if (score > 0 || reasons.length > 0 || intent.wantsExpiring || intent.wantsReviewNeeded) {
        results.push({
          id: `offer-${offer.id}`,
          source: 'offers',
          title: offer.offerName || offer.title || offer.offerCode || 'Casino offer',
          subtitle: `${offer.offerCode || 'No code'} · ${expiry ? `expires ${expiry}` : 'no expiry'} · ${offer.shipName || 'any ship'}`,
          score,
          owner: getOwner(offer),
          offerScore: intelligence.score,
          certificateFit: params.certificates.some((certificate) => {
            const extended = certificate as ExtendedCertificate;
            return extended.cruiseId === offer.cruiseId || extended.offerCode === offer.offerCode || extended.description?.includes(offer.offerCode || '');
          }) ? 'possible certificate fit' : 'no certificate match found',
          actionLabel: 'View offer',
          actionRoute: `/offer-details?offerId=${encodeURIComponent(offer.id)}&offerCode=${encodeURIComponent(offer.offerCode || offer.id)}`,
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
        });
      }
    });
  }

  if (intent.sources.cruises || intent.sources.offers || intent.wantsAllSources) {
    params.cruises.forEach((cruise) => {
      const offerData = getCruiseOfferData(cruise);
      if (intent.sources.offers && !intent.sources.cruises && !intent.wantsAllSources && !offerData.hasOfferData) return;
      if (!cruisePassesStructuredFilters(cruise, intent)) return;
      const offerSearchTerms = offerData.hasOfferData ? 'casino offer comp promotion certificate freeplay onboard credit retail value paid value booked offer-backed cruise' : '';
      const record = cruise as unknown as Cruise & Record<string, unknown>;
      const sourcePayload = record.sourcePayload && typeof record.sourcePayload === 'object' ? JSON.stringify(record.sourcePayload) : '';
      const haystack = [
        cruise.shipName,
        cruise.destination,
        cruise.departurePort,
        cruise.itineraryName,
        cruise.offerCode,
        cruise.offerName,
        cruise.offerCategory,
        cruise.cabinType,
        cruise.sourceEmail,
        cruise.ownerProfileId,
        cruise.status,
        cruise.cruiseSource,
        cruise.brand,
        cruise.casinoProgram,
        cruise.perks?.join(' '),
        cruise.notes,
        sourcePayload,
        cruise.ports?.join(' '),
        offerSearchTerms,
      ].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const reasons: string[] = [];
      let score = textScore.score;
      score += addReason(reasons, intent.sources.offers && offerData.hasOfferData, 'offer data is stored on this booked cruise', 54);
      score += addReason(reasons, intent.sources.offers && offerData.retailValue !== null, `retail value ${money(offerData.retailValue)}`, 18);
      score += addReason(reasons, intent.sources.offers && offerData.compValue !== null, `comp/value captured ${money(offerData.compValue)}`, 14);
      score += addReason(reasons, intent.wantsBooked && /booked|completed|courtesy hold/.test(`${cruise.status ?? ''} ${record.completionState ?? ''}`.toLowerCase()), `status ${cruise.status ?? record.completionState ?? 'booked'}`, 22);
      score += addReason(reasons, intent.wantsSeaDays && ((cruise.seaDays ?? 0) > 0 || (cruise.casinoOpenDays ?? 0) > 0), `${cruise.seaDays ?? cruise.casinoOpenDays} sea/casino day(s)`, 20);
      score += addReason(reasons, intent.wantsPorts && Boolean(cruise.ports?.length || cruise.destination), 'has itinerary/port data', 16);
      score += addReason(reasons, intent.wantsLowCost && ((cruise.price ?? cruise.totalPrice ?? offerData.paidValue ?? 0) > 0), 'price/paid data available', 12);
      score += addReason(reasons, intent.minNights !== undefined && cruise.nights >= intent.minNights, `${cruise.nights} nights`, 10);
      score += addReason(reasons, intent.wantsOwnerIssues && !getOwner(cruise), 'missing owner/profile', 18);
      score += addReason(reasons, intent.wantsReviewNeeded && (cruise.importStatus === 'reviewNeeded' || cruise.reconciliationStatus === 'reviewNeeded' || cruise.importStatus === 'unassigned'), 'needs import review', 22);

      if (score > 0 || reasons.length > 0 || intent.wantsBooked || intent.wantsReviewNeeded) {
        const shouldPresentAsOffer = intent.sources.offers && offerData.hasOfferData && !intent.sources.cruises;
        results.push({
          id: shouldPresentAsOffer ? `cruise-offer-${cruise.id}` : `cruise-${cruise.id}`,
          source: shouldPresentAsOffer ? 'offers' : 'cruises',
          title: shouldPresentAsOffer ? `${offerData.offerLabel} · ${cruise.shipName}` : cruise.shipName,
          subtitle: `${cruise.sailDate} · ${cruise.destination || cruise.departurePort || 'destination missing'} · ${cruise.nights} nights`,
          score,
          owner: getOwner(cruise),
          actionLabel: 'View cruise',
          actionRoute: `/cruise-details?id=${encodeURIComponent(cruise.id)}`,
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: offerData.detail || undefined,
        });
      }
    });
  }

  if (intent.sources.certificates || intent.sources.offers || intent.sources.cruises || intent.wantsAllSources || intent.wantsCertificateFit) {
    (params.certificates as ExtendedCertificate[]).forEach((certificate) => {
      if (!certificatePassesStructuredFilters(certificate, intent)) return;
      const parsedSailings = Array.isArray(certificate.parsedSailings) ? certificate.parsedSailings : [];
      const certificateHaystack = [
        certificate.type,
        certificate.label,
        certificate.description,
        certificate.usedOnCruise,
        certificate.expiryDate,
        certificate.sourceEmail,
        certificate.ownerProfileId,
        certificate.casinoProgram,
        certificate.offerCode,
        certificate.certificateCode,
        certificate.certificateFamily,
        certificate.cabinEntitlement,
        certificate.parserStatus,
        parsedSailings.map((sailing) => [
          sailing.certificateCode,
          sailing.shipName,
          sailing.sailingDate,
          sailing.cabinCategory,
          sailing.occupancy,
          sailing.guestCount,
          sailing.departurePort,
          sailing.itinerary,
          sailing.offerTypeLabel,
          sailing.freePlay,
          sailing.onboardCredit,
          sailing.tradeInValue,
          sailing.pointRequirement,
        ].filter(Boolean).join(' ')).join(' '),
      ].filter(Boolean).join(' ');
      const certificateTextScore = scoreText(intent, certificateHaystack);
      const expiryDays = daysUntil(certificate.expiryDate);
      const certificateReasons: string[] = [];
      let certificateScore = certificateTextScore.score + (certificate.status === 'available' ? 8 : 0);
      certificateScore += addReason(certificateReasons, intent.wantsExpiring && expiryDays !== null && expiryDays >= 0 && expiryDays <= 60, `expires in ${expiryDays ?? 0} day(s)`, Math.max(8, 32 - Math.floor((expiryDays ?? 0) / 2)));
      certificateScore += addReason(certificateReasons, intent.wantsCertificateFit && Boolean(certificate.offerCode || certificate.cruiseId || certificate.description || parsedSailings.length), 'has offer/cruise fit clues', 22);
      certificateScore += addReason(certificateReasons, intent.wantsOwnerIssues && !getOwner(certificate), 'missing owner/profile', 18);
      certificateScore += addReason(certificateReasons, intent.wantsReviewNeeded && (certificate.importStatus === 'reviewNeeded' || certificate.reconciliationStatus === 'reviewNeeded' || certificate.importStatus === 'unassigned'), 'needs import review', 22);
      certificateScore += addReason(certificateReasons, parsedSailings.length > 0, `${parsedSailings.length.toLocaleString()} parsed eligible sailing(s)`, 18);

      const matchingSailings = parsedSailings
        .map((sailing) => {
          const haystack = [
            sailing.certificateCode,
            sailing.shipName,
            sailing.sailingDate,
            sailing.cabinCategory,
            sailing.occupancy,
            sailing.guestCount,
            sailing.departurePort,
            sailing.itinerary,
            sailing.offerTypeLabel,
            sailing.freePlay,
            sailing.onboardCredit,
            sailing.tradeInValue,
            sailing.pointRequirement,
          ].filter(Boolean).join(' ');
          const textScore = scoreText(intent, haystack);
          const reasons: string[] = [];
          let score = textScore.score;
          score += addReason(reasons, intent.wantsFreePlay && (sailing.freePlay ?? 0) > 0, `$${(sailing.freePlay ?? 0).toLocaleString()} FreePlay`, 22);
          score += addReason(reasons, intent.wantsObc && (sailing.onboardCredit ?? 0) > 0, `$${(sailing.onboardCredit ?? 0).toLocaleString()} OBC`, 22);
          score += addReason(reasons, intent.wantsSuite && /suite/i.test(sailing.cabinCategory ?? ''), sailing.cabinCategory || 'suite', 20);
          score += addReason(reasons, intent.wantsBalcony && /balcony/i.test(sailing.cabinCategory ?? ''), sailing.cabinCategory || 'balcony', 20);
          score += addReason(reasons, intent.afterDate !== undefined && sailing.sailingDate >= intent.afterDate, `sails ${sailing.sailingDate}`, 10);
          score += addReason(reasons, intent.beforeDate !== undefined && sailing.sailingDate <= intent.beforeDate, `sails ${sailing.sailingDate}`, 10);
          return { sailing, score, matchedTerms: textScore.matchedTerms, reasons };
        })
        .filter((match) => match.score > 0 || match.reasons.length > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 12);

      matchingSailings.forEach(({ sailing, score, matchedTerms, reasons }) => {
        const benefits = [
          sailing.cabinCategory,
          sailing.occupancy,
          sailing.freePlay ? `$${sailing.freePlay.toLocaleString()} FreePlay` : null,
          sailing.onboardCredit ? `$${sailing.onboardCredit.toLocaleString()} OBC` : null,
          sailing.tradeInValue ? `$${sailing.tradeInValue.toLocaleString()} trade-in` : null,
          sailing.pointRequirement ? `${sailing.pointRequirement.toLocaleString()} points` : null,
        ].filter(Boolean).join(' · ');
        results.push({
          id: `certificate-sailing-${certificate.id}-${sailing.certificateCode}-${sailing.shipName}-${sailing.sailingDate}`,
          source: 'certificates',
          title: `${sailing.shipName} — ${sailing.sailingDate}`,
          subtitle: `${sailing.certificateCode}${benefits ? ` · ${benefits}` : ''}`,
          score: score + 40,
          owner: getOwner(certificate),
          certificateFit: certificate.status === 'used' ? 'certificate already used' : `eligible sailing on ${sailing.certificateCode}`,
          actionLabel: 'Open certificate lookup',
          actionRoute: `/certificate-lookup?query=${encodeURIComponent(`${sailing.certificateCode} ${sailing.shipName} ${sailing.sailingDate}`)}`,
          confidence: confidenceFromScore(score + 40),
          matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : matchedTerms.map((term) => `matched “${term}”`),
          detail: [
            sailing.departurePort ? `Departs ${sailing.departurePort}` : null,
            sailing.itinerary || null,
            sailing.offerTypeLabel || null,
            `Source PDF parsed successfully${certificate.parserVersion ? ` with ${certificate.parserVersion}` : ''}. Page ${sailing.sourcePage}; group ${sailing.sourceGroup}.`,
          ].filter(Boolean).join(' · '),
        });
      });

      if (certificateScore > 0 || certificateReasons.length > 0 || intent.wantsCertificateFit) {
        results.push({
          id: `certificate-${certificate.id}`,
          source: 'certificates',
          title: certificate.label || certificate.certificateCode || `${certificate.type} certificate`,
          subtitle: `${certificate.status ?? 'available'} · $${(certificate.value ?? 0).toLocaleString()}${certificate.expiryDate ? ` · expires ${certificate.expiryDate}` : ''}${parsedSailings.length ? ` · ${parsedSailings.length.toLocaleString()} sailings` : ''}`,
          score: certificateScore,
          owner: getOwner(certificate),
          certificateFit: certificate.status === 'used' ? 'already used' : certificate.offerCode ? `linked to ${certificate.offerCode}` : parsedSailings.length ? 'parsed sailing inventory available' : 'available for review',
          actionLabel: 'Open certificate lookup',
          actionRoute: `/certificate-lookup?query=${encodeURIComponent(certificate.certificateCode || certificate.label || '')}`,
          confidence: confidenceFromScore(certificateScore),
          matchedTerms: certificateTextScore.matchedTerms,
          matchReasons: certificateReasons.length > 0 ? certificateReasons : certificateTextScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: certificate.parserWarnings?.length ? `Parser warnings: ${certificate.parserWarnings.join('; ')}` : certificate.description,
        });
      }
    });
  }

  if (intent.sources.calendar || intent.wantsAllSources) {
    params.calendarEvents.forEach((event) => {
      const eventDate = event.startDate || event.start;
      if (!datePasses(eventDate, intent)) return;
      const haystack = [event.title, event.description, event.notes, event.location, event.type, event.sourceType, event.sourceEmail, event.ownerProfileId].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const reasons: string[] = [];
      let score = textScore.score + (event.type === 'cruise' ? 8 : 0);
      score += addReason(reasons, intent.sources.calendar && Boolean(eventDate), `dated ${normalizeDate(eventDate)}`, 10);
      score += addReason(reasons, intent.wantsOwnerIssues && !getOwner(event), 'missing owner/profile', 18);
      score += addReason(reasons, intent.wantsReviewNeeded && (event.importStatus === 'reviewNeeded' || event.reconciliationStatus === 'reviewNeeded' || event.importStatus === 'unassigned'), 'needs import review', 22);

      if (score > 0 || reasons.length > 0) {
        results.push({
          id: `calendar-${event.id}`,
          source: 'calendar',
          title: event.title,
          subtitle: `${eventDate || 'date missing'} · ${event.location || event.type}`,
          score,
          owner: getOwner(event),
          actionLabel: 'Open events',
          actionRoute: '/events',
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: event.description || event.notes,
        });
      }
    });
  }

  if (intent.sources.crew || intent.wantsAllSources) {
    crewRecognitionEntries.forEach((entry) => {
      if (!crewPassesStructuredFilters(entry, intent)) return;
      const haystack = [entry.fullName, entry.department, entry.roleTitle, entry.shipName, entry.sailStartDate, entry.sailEndDate, entry.sourceText, entry.crewNotes].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const reasons: string[] = [];
      let score = textScore.score;
      score += addReason(reasons, intent.sources.crew, 'crew recognition record loaded', 18);
      score += addReason(reasons, Boolean(entry.shipName), `ship ${entry.shipName}`, 8);
      score += addReason(reasons, Boolean(entry.department), `department ${entry.department}`, 8);

      if (score > 0 || reasons.length > 0) {
        const dateRange = entry.sailStartDate === entry.sailEndDate ? entry.sailStartDate : `${entry.sailStartDate}–${entry.sailEndDate}`;
        results.push({
          id: `crew-${entry.id}`,
          source: 'crew',
          title: entry.fullName,
          subtitle: `${entry.department}${entry.roleTitle ? ` · ${entry.roleTitle}` : ''} · ${entry.shipName} · ${dateRange}`,
          score,
          actionLabel: 'Open crew recognition',
          actionRoute: '/events',
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: entry.crewNotes || entry.sourceText,
        });
      }
    });
  }

  if (intent.sources.machines || intent.wantsAllSources) {
    slotMachines.forEach((machine) => {
      const apText = [
        machine.apMetadata?.persistenceType,
        machine.apMetadata?.notesAndTips,
        machine.apMetadata?.entryConditions?.join(' '),
        machine.apMetadata?.exitConditions?.join(' '),
        machine.detailedProfile?.simpleSummary,
        machine.shipSpecificNotes?.map((note) => `${note.shipName} ${note.deckLocation ?? ''} ${note.notes}`).join(' '),
      ].filter(Boolean).join(' ');
      const haystack = [machine.machineName, machine.manufacturer, machine.gameSeries, machine.theme, machine.volatility, machine.cabinetType, machine.denominationFamilies?.join(' '), machine.userNotes, apText].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const reasons: string[] = [];
      let score = textScore.score;
      score += addReason(reasons, intent.sources.machines, 'slot machine record loaded', 14);
      score += addReason(reasons, Boolean(machine.apMetadata?.hasMustHitBy), 'has must-hit-by metadata', 18);
      score += addReason(reasons, Boolean(machine.apMetadata?.persistenceType), `persistence ${machine.apMetadata?.persistenceType}`, 12);
      score += addReason(reasons, machine.source === 'user', 'saved in personal machine atlas', 10);

      if (score > 0 || reasons.length > 0) {
        const rtp = machine.rtpRanges ? ` · RTP ${machine.rtpRanges.min}-${machine.rtpRanges.max}%` : '';
        results.push({
          id: `machine-${machine.id}`,
          source: 'machines',
          title: machine.machineName,
          subtitle: `${machine.manufacturer} · ${machine.volatility} volatility · ${machine.cabinetType}${rtp}`,
          score,
          actionLabel: 'Open machine atlas',
          actionRoute: '/machines',
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: machine.detailedProfile?.simpleSummary || machine.apMetadata?.notesAndTips || machine.userNotes,
        });
      }
    });
  }

  if (intent.sources.system || intent.wantsAllSources) {
    additionalContextBlocks.forEach((block) => {
      const haystack = [block.title, block.subtitle, block.detail, block.keywords.join(' ')].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const reasons: string[] = [];
      let score = textScore.score;
      score += addReason(reasons, intent.sources.system, 'app-wide system context loaded', 26);
      score += addReason(reasons, block.detail.length > 0, 'detailed app data snapshot available', 8);

      if (score > 0 || reasons.length > 0 || intent.wantsAllSources) {
        results.push({
          id: `system-${block.id}`,
          source: 'system',
          title: block.title,
          subtitle: block.subtitle,
          score,
          actionLabel: block.actionLabel ?? 'Use this context',
          actionRoute: block.actionRoute,
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: block.detail,
        });
      }
    });
  }

  if (intent.sources.weather || intent.wantsAllSources) {
    weatherReports.forEach((forecast) => {
      if (!weatherPassesStructuredFilters(forecast, intent)) return;
      const advisoryText = forecast.advisories.map((advisory) => `${advisory.title} ${advisory.detail} ${advisory.severity}`).join(' ');
      const haystack = [forecast.shipName, forecast.dateKey, forecast.locationName, forecast.zoneLabel, forecast.headline, forecast.summary, forecast.metrics.conditionLabel, advisoryText].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const reasons: string[] = [];
      let score = textScore.score;
      score += addReason(reasons, intent.sources.weather, 'weather report loaded for cruise context', 24);
      score += addReason(reasons, forecast.advisories.length > 0, `${forecast.advisories.length} advisory/advisories`, 22);
      score += addReason(reasons, (forecast.metrics.maxWaveHeightFt ?? 0) >= 8, `waves up to ${forecast.metrics.maxWaveHeightFt?.toFixed(1)} ft`, 20);
      score += addReason(reasons, (forecast.metrics.maxWindGustMph ?? 0) >= 30, `gusts up to ${forecast.metrics.maxWindGustMph?.toFixed(0)} mph`, 18);

      if (score > 0 || reasons.length > 0) {
        const metrics = [
          forecast.metrics.conditionLabel,
          forecast.metrics.maxWindMph !== null ? `${forecast.metrics.maxWindMph.toFixed(0)} mph wind` : null,
          forecast.metrics.maxWindGustMph !== null ? `${forecast.metrics.maxWindGustMph.toFixed(0)} mph gusts` : null,
          forecast.metrics.maxWaveHeightFt !== null ? `${forecast.metrics.maxWaveHeightFt.toFixed(1)} ft waves` : null,
          forecast.metrics.precipitationChance !== null ? `${forecast.metrics.precipitationChance.toFixed(0)}% rain` : null,
        ].filter(Boolean).join(' · ');
        results.push({
          id: `weather-${forecast.cacheKey}`,
          source: 'weather',
          title: `${forecast.shipName} weather — ${forecast.dateKey}`,
          subtitle: `${forecast.locationName} · ${metrics}`,
          score,
          actionLabel: 'Open weather reports',
          actionRoute: '/day-agenda',
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: `${forecast.headline}. ${forecast.summary}${forecast.advisories.length > 0 ? ` Advisories: ${forecast.advisories.map((item) => item.title).join(', ')}` : ''}`,
        });
      }
    });
  }

  const rankedResults = results
    .sort((left, right) => right.score - left.score)
    .slice(0, 24);

  console.log('[AskMyData] Semantic search completed:', {
    query: params.query,
    interpretedIntent,
    filtersApplied,
    resultCount: rankedResults.length,
  });

  return {
    query: params.query,
    filtersApplied,
    results: rankedResults,
    interpretedIntent,
    suggestedQueries: buildSuggestedQueries(intent),
    noResultsExplanation: rankedResults.length === 0 ? `Ask My Data did load your active scope (${dataIndexLabel}), but no records matched the query terms and filters. Try a ship name, offer code, port, date, owner email, cabin type, crew name, department, slot machine, weather, alert, tax, bankroll, price, or financial term.` : undefined,
  };
}

export function formatAskMyDataResponse(response: AskMyDataResponse): string {
  if (response.directAnswer) {
    const citations = response.results.slice(0, 4).map((_, index) => `[S${index + 1}]`).join(' ');
    return `${response.directAnswer}${citations ? `\n\nSources: ${citations}` : ''}`;
  }
  if (response.results.length === 0) {
    return `I searched ${response.interpretedIntent} in the active local scope, but I did not find a matching saved record. ${response.noResultsExplanation}`;
  }

  const lines = response.results.slice(0, 12).map((result, index) => {
    const owner = result.owner ? ` · owner ${result.owner}` : '';
    const offerScore = result.offerScore !== undefined ? ` · offer score ${result.offerScore}` : '';
    const certificateFit = result.certificateFit ? ` · ${result.certificateFit}` : '';
    const reasons = result.matchReasons.length > 0 ? ` · why: ${result.matchReasons.slice(0, 3).join('; ')}` : '';
    const detail = result.detail ? `\n${result.detail}` : '';
    return `[S${index + 1}] [${result.source}/${result.confidence}] ${result.title} — ${result.subtitle}${owner}${offerScore}${certificateFit}${reasons}. Action: ${result.actionLabel}.${detail}`;
  });

  const sourceLabels = Array.from(new Set(response.results.map((result) => result.source))).join(', ');
  const highConfidenceCount = response.results.filter((result) => result.confidence === 'high').length;
  const summary = `I found ${response.results.length} relevant local record${response.results.length === 1 ? '' : 's'} across ${sourceLabels}. ${highConfidenceCount > 0 ? `${highConfidenceCount} high-confidence match${highConfidenceCount === 1 ? '' : 'es'} ranked first.` : 'The closest matches are ranked first with their evidence.'}`;

  return `${summary}\nInterpreted request: ${response.interpretedIntent}.\n\n${lines.join('\n')}\n\nYou can also ask: ${response.suggestedQueries.slice(0, 3).join(' | ')}`;
}
