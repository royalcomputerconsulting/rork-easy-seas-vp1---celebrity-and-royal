import type { AskAllOffersSourceCard } from '@/state/AskAllOffersProvider';
import { buildCruiseDetailsPath } from '@/lib/navigation/cruiseDetails';
import { buildOfferDetailsPath } from '@/lib/offers/offerInstanceIdentity';

type EvidenceStatus = AskAllOffersSourceCard['evidenceStatus'];

export interface AskAllOffersOfferRecord {
  id: string;
  title: string;
  offerCode?: string;
  offerName?: string;
  shipName?: string;
  sailingDate?: string;
  expiryDate?: string;
  expires?: string;
  offerExpiryDate?: string;
  guests?: number;
  guestsInfo?: string;
  roomType?: string;
  cabinType?: string;
  price?: number;
  totalPrice?: number;
  value?: number;
  offerValue?: number;
  totalValue?: number;
  freePlay?: number;
  freeplayAmount?: number;
  OBC?: number;
  obcAmount?: number;
  tradeInValue?: number;
  validationStatus?: string;
  isStale?: boolean;
}

export interface AskAllOffersCruiseRecord {
  id: string;
  shipName: string;
  sailDate: string;
  returnDate?: string;
  nights?: number;
  offerCode?: string;
  offerName?: string;
  cabinType?: string;
  price?: number;
  totalPrice?: number;
  freePlay?: number;
  freeOBC?: number;
  tradeInValue?: number;
  validationStatus?: string;
  isStale?: boolean;
}

export interface AskAllOffersCertificateRecord {
  id: string;
  label: string;
  value?: number;
  expiryDate?: string;
  certificateCode?: string;
  certificateFamily?: string;
  parserStatus?: string;
  validationStatus?: string;
}

export interface AskAllOffersCalendarRecord {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface AskAllOffersCasinoSession {
  id: string;
  date: string;
  winLoss?: number;
  pointsEarned?: number;
  freePlayUsed?: number;
}

export interface AskAllOffersWeatherRecord {
  cacheKey: string;
  cruiseId: string;
  shipName: string;
  dateKey: string;
  locationName: string;
  headline: string;
  summary: string;
  updatedAt: string;
  isStale: boolean;
  isFallback: boolean;
  dataConfidence: 'verified' | 'partial';
}

export interface AskAllOffersContext {
  offers: AskAllOffersOfferRecord[];
  cruises: AskAllOffersCruiseRecord[];
  bookedCruises: AskAllOffersCruiseRecord[];
  certificates: AskAllOffersCertificateRecord[];
  calendarEvents: AskAllOffersCalendarRecord[];
  casinoSessions: AskAllOffersCasinoSession[];
  weather: AskAllOffersWeatherRecord[];
  loyalty: {
    tier?: string;
    points?: number;
    pointsSource?: string;
  };
}

export interface AskAllOffersAnswer {
  content: string;
  evidenceStatus: 'verified' | 'partial' | 'missing';
  sources: AskAllOffersSourceCard[];
}

function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase().trim();
}

function asCurrency(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'unknown';
  return `$${Math.round(value).toLocaleString()}`;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function evidenceStatus(record: { validationStatus?: string; isStale?: boolean; parserStatus?: string }): EvidenceStatus {
  if (record.validationStatus === 'quarantined' || record.validationStatus === 'rejected') return 'missing';
  if (record.isStale) return 'stale';
  if (record.validationStatus === 'partial' || record.parserStatus === 'parsed_with_warnings') return 'partial';
  return 'verified';
}

function statusSummary(sources: AskAllOffersSourceCard[]): AskAllOffersAnswer['evidenceStatus'] {
  if (sources.length === 0 || sources.every((source) => source.evidenceStatus === 'missing')) return 'missing';
  if (sources.some((source) => source.evidenceStatus === 'partial' || source.evidenceStatus === 'stale')) return 'partial';
  return 'verified';
}

function offerValue(offer: AskAllOffersOfferRecord): number | undefined {
  const explicitValue = offer.totalValue ?? offer.offerValue ?? offer.value;
  if (typeof explicitValue === 'number' && Number.isFinite(explicitValue)) return explicitValue;
  const benefits = [offer.freePlay, offer.freeplayAmount, offer.OBC, offer.obcAmount, offer.tradeInValue]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return benefits.length > 0 ? benefits.reduce((total, value) => total + value, 0) : undefined;
}

function offerCashCost(offer: AskAllOffersOfferRecord): number | undefined {
  const value = offer.totalPrice ?? offer.price;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function offerSource(offer: AskAllOffersOfferRecord): AskAllOffersSourceCard {
  const title = offer.offerCode || offer.offerName || offer.title || 'Offer';
  const sailing = [offer.shipName, offer.sailingDate].filter(Boolean).join(' · ');
  return {
    id: `offer:${offer.id}`,
    type: 'offer',
    title,
    subtitle: sailing || 'Saved offer record',
    route: buildOfferDetailsPath({
      id: offer.id,
      offerCode: offer.offerCode,
      offerName: offer.offerName,
      title: offer.title,
      roomType: offer.roomType,
      cabinType: offer.cabinType,
      guests: offer.guests,
      guestsInfo: offer.guestsInfo,
    }),
    evidenceStatus: evidenceStatus(offer),
  };
}

function cruiseSource(cruise: AskAllOffersCruiseRecord): AskAllOffersSourceCard {
  return {
    id: `cruise:${cruise.id}`,
    type: 'cruise',
    title: cruise.shipName || 'Cruise',
    subtitle: [cruise.sailDate, cruise.nights ? `${cruise.nights} nights` : undefined].filter(Boolean).join(' · ') || 'Saved cruise record',
    route: buildCruiseDetailsPath(cruise, { source: 'agent-sea' }),
    evidenceStatus: evidenceStatus(cruise),
  };
}

function certificateSource(certificate: AskAllOffersCertificateRecord): AskAllOffersSourceCard {
  return {
    id: `certificate:${certificate.id}`,
    type: 'certificate',
    title: certificate.certificateCode || certificate.label || 'Certificate',
    subtitle: [certificate.certificateFamily, certificate.expiryDate ? `expires ${certificate.expiryDate}` : undefined].filter(Boolean).join(' · ') || 'Saved certificate record',
    route: '/war-room',
    evidenceStatus: evidenceStatus(certificate),
  };
}

function calendarSource(event: AskAllOffersCalendarRecord): AskAllOffersSourceCard {
  return {
    id: `calendar:${event.id}`,
    type: 'calendar',
    title: event.title || 'Calendar event',
    subtitle: event.startDate || event.endDate || 'Saved calendar event',
    route: '/day-agenda',
    evidenceStatus: 'verified',
  };
}

function weatherSource(forecast: AskAllOffersWeatherRecord): AskAllOffersSourceCard {
  const status: EvidenceStatus = forecast.isStale
    ? 'stale'
    : forecast.isFallback || forecast.dataConfidence === 'partial'
      ? 'partial'
      : 'verified';
  return {
    id: `weather:${forecast.cacheKey}`,
    type: 'weather',
    title: `${forecast.shipName || 'Cruise'} · ${forecast.dateKey}`,
    subtitle: [forecast.locationName, forecast.headline].filter(Boolean).join(' · ') || 'Saved weather forecast',
    route: `/cruise-details?id=${encodeURIComponent(forecast.cruiseId)}`,
    evidenceStatus: status,
  };
}

function formatOffer(offer: AskAllOffersOfferRecord): string {
  const name = offer.offerCode || offer.offerName || offer.title || 'Offer';
  const trip = [offer.shipName, offer.sailingDate].filter(Boolean).join(' on ');
  const benefits = offerValue(offer);
  return `${name}${trip ? ` for ${trip}` : ''}${benefits !== undefined ? ` (${asCurrency(benefits)} recorded value)` : ''}`;
}

function selectSources<T>(records: T[], makeSource: (record: T) => AskAllOffersSourceCard, limit = 6): AskAllOffersSourceCard[] {
  return records.slice(0, limit).map(makeSource);
}

function response(content: string, sources: AskAllOffersSourceCard[]): AskAllOffersAnswer {
  return { content, sources, evidenceStatus: statusSummary(sources) };
}

function activeOffers(context: AskAllOffersContext): AskAllOffersOfferRecord[] {
  const now = new Date();
  return context.offers.filter((offer) => {
    const expiry = parseDate(offer.expiryDate || offer.expires || offer.offerExpiryDate);
    return !expiry || expiry >= now;
  });
}

function queryTerms(query: string): string[] {
  const stopWords = new Set(['a', 'an', 'and', 'are', 'best', 'can', 'for', 'from', 'give', 'have', 'i', 'is', 'me', 'my', 'of', 'on', 'please', 'show', 'the', 'to', 'what', 'which', 'with']);
  return normalize(query).split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !stopWords.has(term));
}

function sourceMatchesQuery(source: AskAllOffersSourceCard, terms: string[]): boolean {
  const haystack = normalize(`${source.title} ${source.subtitle}`);
  return terms.some((term) => haystack.includes(term));
}

export function buildAskAllOffersAnswer(query: string, context: AskAllOffersContext): AskAllOffersAnswer {
  const normalizedQuery = normalize(query);
  const offers = activeOffers(context);
  const allCruises = [...context.cruises, ...context.bookedCruises];


  const asksForOffers = /\b(?:offer|offers|eligible sailing|eligible sailings|trade[-\s]?in|active casino offer|casino offer)\b/.test(normalizedQuery);
  if (asksForOffers) {
    if (offers.length === 0) {
      return response('No active saved offers are available in this scope. Sync or import offer data first; casino-session history is a separate data source.', []);
    }
    const ranked = offers.slice().sort((left, right) => (offerValue(right) ?? -1) - (offerValue(left) ?? -1));
    return response(
      `I found ${offers.length} active saved offer${offers.length === 1 ? '' : 's'}. Here are the first records ranked by known recorded value: ${ranked.slice(0, 4).map(formatOffer).join('; ')}.`,
      selectSources(ranked, offerSource),
    );
  }

  if (/\b(weather|forecast|wind|wave|rough seas|marine)\b/.test(normalizedQuery)) {
    const sources = selectSources(context.weather, weatherSource);
    if (sources.length > 0) {
      const statusNote = sources.some((source) => source.evidenceStatus === 'stale')
        ? ' Some saved forecasts are stale and are labeled below.'
        : sources.some((source) => source.evidenceStatus === 'partial')
          ? ' Some saved forecasts are partial or use a labeled location fallback.'
          : '';
      return response(`I found ${sources.length} saved weather forecast${sources.length === 1 ? '' : 's'} for cruises in this scope. Each linked record shows its source confidence and location.${statusNote}`, sources);
    }
    return response(
      'I do not have a verified stored weather result in this conversation scope. I will not infer conditions from an itinerary alone. Open a booked cruise or the day agenda when the provider forecast window is available.',
      []
    );
  }

  if (/\b(loyalty|tier|points|crown|captain|vifp|blue chip)\b/.test(normalizedQuery)) {
    const tier = context.loyalty.tier || 'tier not verified';
    const points = typeof context.loyalty.points === 'number' ? `${context.loyalty.points.toLocaleString()} points` : 'points not verified';
    return response(`Current loyalty evidence shows ${tier} with ${points}${context.loyalty.pointsSource ? ` (${context.loyalty.pointsSource})` : ''}.`, [{
      id: 'loyalty:current', type: 'loyalty', title: tier, subtitle: points, route: '/analytics', evidenceStatus: context.loyalty.tier || typeof context.loyalty.points === 'number' ? 'verified' : 'missing',
    }]);
  }

  if (/\b(calendar|conflict|schedule|event)\b/.test(normalizedQuery)) {
    const sources = selectSources(context.calendarEvents, calendarSource);
    if (sources.length === 0) return response('No saved calendar evidence is available in this scope, so I cannot identify a scheduling conflict.', []);
    return response(`I found ${sources.length} saved calendar event${sources.length === 1 ? '' : 's'} in this scope. Review the linked records before treating overlap as a conflict.`, sources);
  }

  if (/\b(casino|bankroll|loss|win|coin.?in|play)\b/.test(normalizedQuery) && !/\boffers?\b/.test(normalizedQuery)) {
    const sessionCount = context.casinoSessions.length;
    const pointTotal = context.casinoSessions.reduce((total, session) => total + (session.pointsEarned ?? 0), 0);
    const sources: AskAllOffersSourceCard[] = sessionCount > 0 ? [{
      id: 'casino:sessions', type: 'casino', title: `${sessionCount} saved casino session${sessionCount === 1 ? '' : 's'}`,
      subtitle: pointTotal > 0 ? `${pointTotal.toLocaleString()} recorded points` : 'Recorded play history', route: '/analytics', evidenceStatus: 'verified',
    }] : [];
    return response(
      sessionCount > 0
        ? `I found ${sessionCount} saved casino session${sessionCount === 1 ? '' : 's'}${pointTotal > 0 ? ` with ${pointTotal.toLocaleString()} recorded points` : ''}. I can compare existing offers and history, but I will not recommend increasing play or exceeding your bankroll limits.`
        : 'No saved casino-session evidence is available in this scope. I cannot make a play recommendation from missing history.',
      sources
    );
  }

  if (/\b(certificate|cert|freeplay|free play|obc|onboard credit)\b/.test(normalizedQuery)) {
    const sources = selectSources(context.certificates, certificateSource);
    if (sources.length === 0) return response('No saved certificate evidence is available in this scope. I cannot claim that a certificate fits a sailing without a parsed or manually saved record.', []);
    return response(`I found ${sources.length} certificate record${sources.length === 1 ? '' : 's'}. Their code, family, expiration, and parser status are linked below; verify terms and sailing eligibility before booking.`, sources);
  }

  if (/\b(expir|ending|deadline|soon)\b/.test(normalizedQuery)) {
    const expiring = offers
      .map((offer) => ({ offer, date: parseDate(offer.expiryDate || offer.expires || offer.offerExpiryDate) }))
      .filter((entry): entry is { offer: AskAllOffersOfferRecord; date: Date } => entry.date !== null)
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(0, 6)
      .map((entry) => entry.offer);
    if (expiring.length === 0) return response('No saved active offers with a verified expiration date are available in this scope.', []);
    return response(`The nearest recorded expirations are: ${expiring.map((offer) => `${offer.offerCode || offer.title} (${offer.expiryDate || offer.expires || offer.offerExpiryDate})`).join('; ')}.`, selectSources(expiring, offerSource));
  }

  if (/\b(two|2)\s*(?:guest|guests|people|passengers?)\b/.test(normalizedQuery)) {
    const matching = offers.filter((offer) => offer.guests === 2 || /\b(two|2)\b/.test(normalize(offer.guestsInfo)));
    if (matching.length === 0) return response('I found no saved offer with verified two-guest eligibility in this scope. I will not assume occupancy eligibility.', []);
    return response(`I found ${matching.length} saved offer${matching.length === 1 ? '' : 's'} with explicit two-guest evidence: ${matching.slice(0, 4).map(formatOffer).join('; ')}.`, selectSources(matching, offerSource));
  }

  if (/\b(lowest|least|cheapest|cash cost|out of pocket)\b/.test(normalizedQuery)) {
    const priced = offers.filter((offer) => offerCashCost(offer) !== undefined).sort((left, right) => (offerCashCost(left) ?? Number.POSITIVE_INFINITY) - (offerCashCost(right) ?? Number.POSITIVE_INFINITY));
    if (priced.length === 0) return response('No saved offer has a verified cash price in this scope, so I cannot rank a lowest cash-cost option.', []);
    const best = priced[0];
    return response(`The lowest recorded cash cost is ${asCurrency(offerCashCost(best))} for ${formatOffer(best)}. Taxes, fees, and eligibility can still change the final amount.`, selectSources(priced, offerSource));
  }

  if (/\b(highest|best value|most value|value)\b/.test(normalizedQuery)) {
    const valued = offers.filter((offer) => offerValue(offer) !== undefined).sort((left, right) => (offerValue(right) ?? 0) - (offerValue(left) ?? 0));
    if (valued.length === 0) return response('No saved offer has a verified value or benefit amount in this scope, so I cannot rank value.', []);
    const best = valued[0];
    return response(`The highest recorded value is ${asCurrency(offerValue(best))} for ${formatOffer(best)}. This compares saved benefits only; it does not guarantee availability or final pricing.`, selectSources(valued, offerSource));
  }

  if (/\b(booked|booking|upcoming|cruise)\b/.test(normalizedQuery) && !/\boffer/.test(normalizedQuery)) {
    const sources = selectSources(context.bookedCruises, cruiseSource);
    if (sources.length === 0) return response('No saved booked-cruise evidence is available in this scope.', []);
    return response(`I found ${sources.length} saved booked cruise${sources.length === 1 ? '' : 's'} in this scope. Dates and itinerary confidence are shown on each linked source.`, sources);
  }

  if (/\b(all|available|offer|offers)\b/.test(normalizedQuery)) {
    if (offers.length === 0) return response('No active saved offers are available in this scope. Sync or import data before relying on an offer answer.', []);
    return response(`I found ${offers.length} active saved offer${offers.length === 1 ? '' : 's'}. Here are the first records ranked by known recorded value: ${offers.slice().sort((left, right) => (offerValue(right) ?? -1) - (offerValue(left) ?? -1)).slice(0, 4).map(formatOffer).join('; ')}.`, selectSources(offers.slice().sort((left, right) => (offerValue(right) ?? -1) - (offerValue(left) ?? -1)), offerSource));
  }

  const terms = queryTerms(query);
  const candidateSources = [
    ...context.offers.map(offerSource),
    ...allCruises.map(cruiseSource),
    ...context.certificates.map(certificateSource),
    ...context.calendarEvents.map(calendarSource),
  ].filter((source) => sourceMatchesQuery(source, terms)).slice(0, 6);
  if (candidateSources.length === 0) {
    return response('I could not find supporting EasySeas records for that question in the current conversation scope. I do not have enough evidence to answer it as fact.', []);
  }

  return response(`I found ${candidateSources.length} saved record${candidateSources.length === 1 ? '' : 's'} related to your question. The linked sources are the evidence I used; anything beyond them is unknown or needs provider verification.`, candidateSources);
}
