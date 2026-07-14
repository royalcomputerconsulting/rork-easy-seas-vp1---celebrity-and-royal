import type { CalendarEvent, CasinoOffer, Cruise, SlotMachine } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import { calculateOfferIntelligenceScore } from '@/lib/offerIntelligence';
import type { AskMyDataOverview } from '@/lib/askMyDataOverview';
import type { RecognitionEntryWithCrew } from '@/types/crew-recognition';
import type { SailingWeatherForecast } from '@/state/SailingWeatherProvider';

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
  wantsOfferInventoryOnly: boolean;
  wantsFreeCruise: boolean;
  wantsGuestCoverage: boolean;
  requestedGuestCount?: number;
  minNights?: number;
  maxNights?: number;
  afterDate?: string;
  beforeDate?: string;
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
  system: ['financial', 'finance', 'money', 'payment', 'balance due', 'deposit', 'price drop', 'price history', 'upgrade price', 'alert', 'anomaly', 'insight', 'bankroll', 'limit', 'tax', 'w2g', 'w-2g', 'comp item', 'comp', 'achievement', 'goal', 'analytics', 'performance', 'portfolio', 'data source', 'system'],
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

function parseRequestedGuestCount(normalizedQuery: string): number | undefined {
  const explicit = normalizedQuery.match(/(?:for|fare for|cruise fare for|covers|covering)\s+(\d+|one|two|three|four)\s*(?:guests?|people|passengers?|pax|persons?)?\b/);
  if (explicit?.[1]) return wordToNumber(explicit[1]);
  const guestNoun = normalizedQuery.match(/\b(\d+|one|two|three|four)\s*(?:guests?|people|passengers?|pax|persons?)\b/);
  if (guestNoun?.[1]) return wordToNumber(guestNoun[1]);
  if (/\bfor\s+2\b|\bfor\s+two\b|\bdouble\s+occupancy\b|\bfor\s+a\s+couple\b/.test(normalizedQuery)) return 2;
  if (/\bfor\s+1\b|\bfor\s+one\b|\bsolo\b|\bsingle\s+guest\b/.test(normalizedQuery)) return 1;
  return undefined;
}

function isOfferInventoryQuery(normalizedQuery: string, sourceMentions: SourceIntent, requestedGuestCount?: number): boolean {
  if (!sourceMentions.offers) return false;
  if (/\b(from|in|inside|using|use|loaded|current|active|available)\s+(my\s+)?offers?\b/.test(normalizedQuery)) return true;
  if (/\b(my|loaded|current|active|available|club royale|casino)\s+offers?\b/.test(normalizedQuery)) return true;
  if (/\boffer\s+catalog\b|\bcatalog\s+of\s+offers\b|\boffer\s+sailings\b|\boffer\s+rows\b/.test(normalizedQuery)) return true;
  if (requestedGuestCount !== undefined && /\boffers?\b/.test(normalizedQuery) && !/\bbooked|booking|reservation|reserved|already booked|completed|past\b/.test(normalizedQuery)) return true;
  return false;
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
  const requestedGuestCount = parseRequestedGuestCount(normalizedQuery);
  const wantsOfferInventoryOnly = isOfferInventoryQuery(normalizedQuery, sourceMentions, requestedGuestCount);
  if (wantsOfferInventoryOnly && !/\bbooked|booking|reservation|reserved|already booked|completed|past\b/.test(normalizedQuery)) {
    sourceMentions.cruises = false;
  }
  const wantsAllSources = !Object.values(sourceMentions).some(Boolean);

  const nightsMatch = normalizedQuery.match(/(?:longer than|more than|over|at least)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:night|nights|day|days)/);
  const maxNightsMatch = normalizedQuery.match(/(?:shorter than|less than|under|at most)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:night|nights|day|days)/);

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
    wantsOfferInventoryOnly,
    wantsFreeCruise: /free\s+cruise|comp(?:ed)?\s+cruise|cruise\s+fare/.test(normalizedQuery),
    wantsGuestCoverage: requestedGuestCount !== undefined || /guest|passenger|for\s+two|for\s+2|double\s+occupancy/.test(normalizedQuery),
    requestedGuestCount,
    minNights: nightsMatch?.[1] ? wordToNumber(nightsMatch[1]) : undefined,
    maxNights: maxNightsMatch?.[1] ? wordToNumber(maxNightsMatch[1]) : undefined,
    afterDate: parseDateConstraint(normalizedQuery, 'after'),
    beforeDate: parseDateConstraint(normalizedQuery, 'before'),
  };
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

type OfferGuestCoverage = 'two-free' | 'two-discount' | 'one-free' | 'dollars-off' | 'unknown';

function getOfferText(offer: CasinoOffer): string {
  return [
    offer.offerCode,
    offer.offerName,
    offer.title,
    offer.description,
    offer.category,
    offer.roomType,
    offer.guestsInfo,
    offer.classification,
    offer.offerType,
    offer.perks?.join(' '),
    offer.termsConditions,
  ].filter(Boolean).join(' ').toLowerCase();
}

function getOfferGuestCoverage(offer: CasinoOffer): { coverage: OfferGuestCoverage; guestCount: number | null; label: string; rank: number; reasons: string[] } {
  const text = getOfferText(offer);
  const reasons: string[] = [];
  const explicitGuests = typeof offer.guests === 'number' && Number.isFinite(offer.guests) ? offer.guests : null;
  const saysTwo = explicitGuests === 2 || /cruise\s*fare\s*for\s*2|cruise\s*fare\s*for\s*two|fare\s*for\s*2|fare\s*for\s*two|for\s*2\s*guests?|for\s*two\s*guests?|2\s*guests?|two\s*guests?|double\s*occupancy|for\s+two|classification\s*2person/.test(text) || offer.classification === '2person';
  const saysOne = explicitGuests === 1 || /cruise\s*fare\s*for\s*1|cruise\s*fare\s*for\s*one|fare\s*for\s*1|fare\s*for\s*one|for\s*1\s*guest|for\s*one\s*guest|1\s*guest|one\s*guest|solo/.test(text);
  const secondDiscount = /second\s+(guest|passenger|person).*discount|discount.*second\s+(guest|passenger|person)|1\s*\+\s*discount|one\s*\+\s*discount|companion\s+discount|discounted\s+companion|discounted\s+second/.test(text) || offer.classification === '1+discount';
  const dollarsOff = /dollars?\s*off|amount\s*off|discount\s*offer|\$\d+\s*off/.test(text) || offer.offerType === 'discount';

  if (saysTwo && !secondDiscount) {
    reasons.push('free cruise fare for 2 guests outranks one-person and discount-only offers');
    return { coverage: 'two-free', guestCount: 2, label: 'Free cruise fare for 2 guests', rank: 400, reasons };
  }
  if (secondDiscount) {
    reasons.push('covers a second guest only by discount, so it ranks below true free-for-two offers');
    return { coverage: 'two-discount', guestCount: 2, label: '1 guest plus discounted second guest', rank: 240, reasons };
  }
  if (saysOne) {
    reasons.push('free cruise fare appears to cover 1 guest only');
    return { coverage: 'one-free', guestCount: 1, label: 'Free cruise fare for 1 guest', rank: 140, reasons };
  }
  if (dollarsOff) {
    reasons.push('dollars-off/discount offer ranks below free cruise fare offers');
    return { coverage: 'dollars-off', guestCount: null, label: 'Dollars-off / discount offer', rank: 80, reasons };
  }
  return { coverage: 'unknown', guestCount: explicitGuests, label: explicitGuests ? `Guest coverage ${explicitGuests}` : 'Guest coverage unknown', rank: 100, reasons: ['guest coverage was not explicit in the saved offer row'] };
}

function getCabinRank(roomType?: string): number {
  const text = normalize(roomType);
  if (/grand suite|owner.?s suite|royal suite|penthouse/.test(text)) return 110;
  if (/junior suite|suite/.test(text)) return 90;
  if (/balcony/.test(text)) return 70;
  if (/ocean|outside/.test(text)) return 50;
  if (/interior|inside/.test(text)) return 30;
  return 10;
}

function getOfferValueAmount(offer: CasinoOffer): number {
  const values = [
    offer.totalValue,
    offer.offerValue,
    offer.value,
    offer.retailCabinValue,
    offer.balconyPrice,
    offer.oceanviewPrice,
    offer.interiorPrice,
    offer.suitePrice,
    offer.juniorSuitePrice,
    offer.grandSuitePrice,
    offer.discountValue,
    offer.tradeInValue,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : 0;
}

function buildOfferValueDetail(offer: CasinoOffer, coverageLabel: string): string {
  const value = getOfferValueAmount(offer);
  const parts = [
    `Guest value: ${coverageLabel}`,
    offer.roomType ? `Cabin: ${offer.roomType}` : null,
    value > 0 ? `Estimated offer value: ${money(value)}` : null,
    (offer.freePlay ?? offer.freeplayAmount ?? 0) > 0 ? `FreePlay: ${money(offer.freePlay ?? offer.freeplayAmount ?? null)}` : null,
    (offer.OBC ?? offer.obcAmount ?? 0) > 0 ? `OBC: ${money(offer.OBC ?? offer.obcAmount ?? null)}` : null,
    offer.taxesFees !== undefined ? `Taxes/fees: ${money(offer.taxesFees)}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' · ');
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
  if (intent.wantsBooked && !/booked|reservation|courtesy hold|completed/.test(`${cruise.status ?? ''} ${record.completionState ?? ''}`.toLowerCase())) return false;
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
  return datePasses(certificate.expiryDate, intent);
}

function crewPassesStructuredFilters(entry: RecognitionEntryWithCrew, intent: QueryIntent): boolean {
  return datePasses(entry.sailStartDate, intent) || datePasses(entry.sailEndDate, intent);
}

function weatherPassesStructuredFilters(forecast: SailingWeatherForecast, intent: QueryIntent): boolean {
  return datePasses(forecast.dateKey, intent);
}

function getInterpretedIntent(intent: QueryIntent): string {
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
  if (intent.wantsOfferInventoryOnly) pieces.push('standalone offer catalog only');
  if (intent.requestedGuestCount) pieces.push(`for ${intent.requestedGuestCount} guest(s)`);
  if (intent.wantsHighValue) pieces.push('high value');
  if (intent.wantsLowCost) pieces.push('low out-of-pocket');
  if (intent.minNights) pieces.push(`${intent.minNights}+ nights`);
  if (intent.maxNights) pieces.push(`≤${intent.maxNights} nights`);
  if (intent.afterDate) pieces.push(`after ${intent.afterDate}`);
  if (intent.beforeDate) pieces.push(`before ${intent.beforeDate}`);
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
  if (intent.sources.offers || intent.wantsExpiring) suggestions.unshift('Compare my best offers for 2 guests by value');
  if (intent.sources.offers || intent.wantsExpiring) suggestions.unshift('Compare my best expiring offers by score');
  if (intent.sources.cruises || intent.wantsSeaDays) suggestions.unshift('Show cruises with the most sea days');
  if (intent.sources.crew) suggestions.unshift('Summarize crew recognition by ship and department');
  if (intent.sources.machines) suggestions.unshift('Find AP-friendly slot machines and recent condition logs');
  if (intent.sources.weather) suggestions.unshift('Show rough seas and bad-weather watchouts');
  return unique(suggestions).slice(0, 5);
}

function wantsOverviewResult(intent: QueryIntent): boolean {
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
  const dataIndexLabel = `loaded ${params.offers.length.toLocaleString()} standalone offer sailing row(s), ${cruiseOfferRecords.length.toLocaleString()} booked-cruise offer/value record(s), ${params.cruises.length.toLocaleString()} cruise(s), ${params.certificates.length.toLocaleString()} certificate(s), ${params.calendarEvents.length.toLocaleString()} event(s), ${crewRecognitionEntries.length.toLocaleString()} crew recognition record(s), ${slotMachines.length.toLocaleString()} slot machine record(s), ${weatherReports.length.toLocaleString()} weather report(s), ${additionalContextBlocks.length.toLocaleString()} app-wide context block(s)`;
  const interpretedIntent = getInterpretedIntent(intent) || 'all data sources';
  const filtersApplied: string[] = [interpretedIntent, dataIndexLabel];
  if (intent.wantsOfferInventoryOnly) {
    filtersApplied.push('Offer-source lock: searching standalone loaded offer sailings, not booked/completed cruises.');
  }
  const results: AskMyDataResult[] = [];

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
      const coverage = getOfferGuestCoverage(offer);
      const offerValueAmount = getOfferValueAmount(offer);
      const reasons: string[] = [...coverage.reasons];
      let score = textScore.score + Math.round(intelligence.score / 6);
      if (intent.wantsOfferInventoryOnly || intent.wantsHighValue || intent.wantsGuestCoverage) {
        score += coverage.rank;
        score += Math.min(70, Math.round(offerValueAmount / 100));
        score += getCabinRank(offer.roomType);
      }
      if (intent.requestedGuestCount === 2) {
        if (coverage.coverage === 'two-free') score += 260;
        else if (coverage.coverage === 'two-discount') score += 70;
        else if (coverage.coverage === 'one-free') score -= 90;
        else if (coverage.coverage === 'dollars-off') score -= 120;
      }
      score += addReason(reasons, intent.wantsExpiring && expiryDays !== null && expiryDays >= 0 && expiryDays <= 45, `expires in ${expiryDays ?? 0} day(s)`, Math.max(8, 36 - (expiryDays ?? 0)));
      score += addReason(reasons, intent.wantsHighValue && intelligence.score >= 65, `offer score ${intelligence.score}/100`, 26);
      score += addReason(reasons, intent.wantsFreePlay && ((offer.freePlay ?? 0) > 0 || (offer.freeplayAmount ?? 0) > 0), 'has FreePlay', 18);
      score += addReason(reasons, intent.wantsObc && ((offer.OBC ?? 0) > 0 || (offer.obcAmount ?? 0) > 0), 'has onboard credit', 18);
      score += addReason(reasons, intent.wantsOwnerIssues && !getOwner(offer), 'missing owner/profile', 22);
      score += addReason(reasons, intent.wantsReviewNeeded && (offer.importStatus === 'reviewNeeded' || offer.reconciliationStatus === 'reviewNeeded' || offer.importStatus === 'unassigned'), 'needs import review', 24);
      score += addReason(reasons, intent.minNights !== undefined && (offer.nights ?? 0) >= intent.minNights, `${offer.nights} nights`, 10);
      score += addReason(reasons, intent.requestedGuestCount === 2 && coverage.coverage === 'two-free', 'best fit for 2: true free cruise fare for two', 40);
      score += addReason(reasons, intent.requestedGuestCount === 2 && coverage.coverage === 'two-discount', 'second passenger is discounted, not fully comped', 8);
      score += addReason(reasons, intent.requestedGuestCount === 2 && coverage.coverage === 'one-free', 'only one guest appears fully covered', -24);

      if (score > 0 || reasons.length > 0 || intent.wantsExpiring || intent.wantsReviewNeeded || intent.wantsOfferInventoryOnly) {
        results.push({
          id: `offer-${offer.id}`,
          source: 'offers',
          title: offer.offerName || offer.title || offer.offerCode || 'Casino offer',
          subtitle: `${offer.offerCode || 'No code'} · ${coverage.label} · ${expiry ? `expires ${expiry}` : 'no expiry'} · ${offer.shipName || 'any ship'}`,
          score,
          owner: getOwner(offer),
          offerScore: intelligence.score,
          certificateFit: params.certificates.some((certificate) => {
            const extended = certificate as ExtendedCertificate;
            return extended.cruiseId === offer.cruiseId || extended.offerCode === offer.offerCode || extended.description?.includes(offer.offerCode || '');
          }) ? 'possible certificate fit' : 'no certificate match found',
          actionLabel: 'View offer',
          actionRoute: `/offer-details?offerCode=${encodeURIComponent(offer.offerCode || offer.id)}&offerSource=${encodeURIComponent(String(offer.offerSource || offer.brand || 'unknown'))}`,
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? unique(reasons) : textScore.matchedTerms.map((term) => `matched “${term}”`),
          detail: buildOfferValueDetail(offer, coverage.label),
        });
      }
    });
  }

  if ((intent.sources.cruises || intent.sources.offers || intent.wantsAllSources) && !(intent.wantsOfferInventoryOnly && !intent.wantsBooked && params.offers.length > 0)) {
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

  if (intent.sources.certificates || intent.wantsAllSources || intent.wantsCertificateFit) {
    (params.certificates as ExtendedCertificate[]).forEach((certificate) => {
      if (!certificatePassesStructuredFilters(certificate, intent)) return;
      const haystack = [certificate.type, certificate.label, certificate.description, certificate.usedOnCruise, certificate.expiryDate, certificate.sourceEmail, certificate.ownerProfileId, certificate.casinoProgram, certificate.offerCode, certificate.cabinEntitlement].filter(Boolean).join(' ');
      const textScore = scoreText(intent, haystack);
      const expiryDays = daysUntil(certificate.expiryDate);
      const reasons: string[] = [];
      let score = textScore.score + (certificate.status === 'available' ? 8 : 0);
      score += addReason(reasons, intent.wantsExpiring && expiryDays !== null && expiryDays >= 0 && expiryDays <= 60, `expires in ${expiryDays ?? 0} day(s)`, Math.max(8, 32 - Math.floor((expiryDays ?? 0) / 2)));
      score += addReason(reasons, intent.wantsCertificateFit && Boolean(certificate.offerCode || certificate.cruiseId || certificate.description), 'has offer/cruise fit clues', 22);
      score += addReason(reasons, intent.wantsOwnerIssues && !getOwner(certificate), 'missing owner/profile', 18);
      score += addReason(reasons, intent.wantsReviewNeeded && (certificate.importStatus === 'reviewNeeded' || certificate.reconciliationStatus === 'reviewNeeded' || certificate.importStatus === 'unassigned'), 'needs import review', 22);

      if (score > 0 || reasons.length > 0 || intent.wantsCertificateFit) {
        results.push({
          id: `certificate-${certificate.id}`,
          source: 'certificates',
          title: certificate.label || `${certificate.type} certificate`,
          subtitle: `${certificate.status ?? 'available'} · $${(certificate.value ?? 0).toLocaleString()}${certificate.expiryDate ? ` · expires ${certificate.expiryDate}` : ''}`,
          score,
          owner: getOwner(certificate),
          certificateFit: certificate.status === 'used' ? 'already used' : certificate.offerCode ? `linked to ${certificate.offerCode}` : 'available for review',
          actionLabel: 'Review certificate',
          confidence: confidenceFromScore(score),
          matchedTerms: textScore.matchedTerms,
          matchReasons: reasons.length > 0 ? reasons : textScore.matchedTerms.map((term) => `matched “${term}”`),
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
  if (response.results.length === 0) {
    return `Ask My Data interpreted your query as: ${response.interpretedIntent}. ${response.noResultsExplanation}`;
  }

  const lines = response.results.slice(0, 12).map((result, index) => {
    const owner = result.owner ? ` · owner ${result.owner}` : '';
    const offerScore = result.offerScore !== undefined ? ` · offer score ${result.offerScore}` : '';
    const certificateFit = result.certificateFit ? ` · ${result.certificateFit}` : '';
    const reasons = result.matchReasons.length > 0 ? ` · why: ${result.matchReasons.slice(0, 3).join('; ')}` : '';
    const detail = result.detail ? `\n${result.detail}` : '';
    return `${index + 1}. [${result.source}/${result.confidence}] ${result.title} — ${result.subtitle}${owner}${offerScore}${certificateFit}${reasons}. Action: ${result.actionLabel}.${detail}`;
  });

  return `Ask My Data interpreted your query as: ${response.interpretedIntent}.\n\n${lines.join('\n')}\n\nTry next: ${response.suggestedQueries.slice(0, 3).join(' | ')}`;
}
