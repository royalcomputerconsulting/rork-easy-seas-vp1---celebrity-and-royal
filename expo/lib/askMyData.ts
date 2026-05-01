import type { CalendarEvent, CasinoOffer, Cruise } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import { calculateOfferIntelligenceScore } from '@/lib/offerIntelligence';

export type AskMyDataSource = 'offers' | 'cruises' | 'certificates' | 'calendar';

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
}

export interface AskMyDataResponse {
  query: string;
  filtersApplied: string[];
  results: AskMyDataResult[];
  noResultsExplanation?: string;
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function scoreText(queryTokens: string[], text: string): number {
  const normalizedText = normalize(text);
  return queryTokens.reduce((sum, token) => sum + (normalizedText.includes(token) ? 12 : 0), 0);
}

function getOfferExpiry(offer: CasinoOffer): string | undefined {
  return offer.expiryDate || offer.expires || offer.offerExpiryDate || offer.validUntil;
}

export function askMyDataSearch(params: {
  query: string;
  offers: CasinoOffer[];
  cruises: Cruise[];
  certificates: Certificate[];
  calendarEvents: CalendarEvent[];
}): AskMyDataResponse {
  const tokens = tokenize(params.query);
  const filtersApplied: string[] = [];
  const lowerQuery = normalize(params.query);
  const wantsOffers = /offer|freeplay|obc|comp|expiry|expiration/.test(lowerQuery);
  const wantsCruises = /cruise|ship|sail|port|sea|cabin|booking/.test(lowerQuery);
  const wantsCertificates = /certificate|cert|nextcruise|fpp|upgrade/.test(lowerQuery);
  const wantsCalendar = /calendar|event|date|agenda|travel|day/.test(lowerQuery);
  const wantsExpiring = /expir|soon|urgent|war room/.test(lowerQuery);
  const wantsBooked = /booked|booking|reservation/.test(lowerQuery);

  if (wantsExpiring) filtersApplied.push('expiring or date-sensitive');
  if (wantsBooked) filtersApplied.push('booked/reservation records');
  if (wantsOffers) filtersApplied.push('offers');
  if (wantsCruises) filtersApplied.push('cruises');
  if (wantsCertificates) filtersApplied.push('certificates');
  if (wantsCalendar) filtersApplied.push('calendar');
  if (filtersApplied.length === 0) filtersApplied.push('all data sources');

  const results: AskMyDataResult[] = [];

  if (wantsOffers || filtersApplied.includes('all data sources')) {
    params.offers.forEach((offer) => {
      const haystack = [offer.offerCode, offer.offerName, offer.title, offer.description, offer.shipName, offer.roomType, offer.sourceEmail].filter(Boolean).join(' ');
      const expiry = getOfferExpiry(offer);
      const expiryBoost = wantsExpiring && expiry ? Math.max(0, 28 - Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000))) : 0;
      const intelligence = calculateOfferIntelligenceScore(offer, params.cruises, params.certificates);
      const score = scoreText(tokens, haystack) + expiryBoost + Math.round(intelligence.score / 8);
      if (score > 0 || wantsExpiring) {
        results.push({
          id: `offer-${offer.id}`,
          source: 'offers',
          title: offer.offerName || offer.title || offer.offerCode || 'Casino offer',
          subtitle: `${offer.offerCode || 'No code'} · ${expiry ? `expires ${expiry}` : 'no expiry'} · ${offer.shipName || 'any ship'}`,
          score,
          owner: offer.sourceEmail || offer.ownerProfileId,
          offerScore: intelligence.score,
          certificateFit: params.certificates.some((certificate) => certificate.cruiseId === offer.cruiseId || certificate.description?.includes(offer.offerCode || '')) ? 'possible certificate fit' : 'no certificate match found',
          actionLabel: 'View offer',
          actionRoute: `/offer-details?offerCode=${encodeURIComponent(offer.offerCode || offer.id)}`,
        });
      }
    });
  }

  if (wantsCruises || filtersApplied.includes('all data sources')) {
    params.cruises.forEach((cruise) => {
      const haystack = [cruise.shipName, cruise.destination, cruise.departurePort, cruise.itineraryName, cruise.offerCode, cruise.cabinType, cruise.sourceEmail].filter(Boolean).join(' ');
      const bookedBoost = wantsBooked && cruise.status === 'booked' ? 18 : 0;
      const score = scoreText(tokens, haystack) + bookedBoost + (cruise.freePlay ? 5 : 0) + (cruise.freeOBC ? 5 : 0);
      if (score > 0 || wantsBooked) {
        results.push({
          id: `cruise-${cruise.id}`,
          source: 'cruises',
          title: cruise.shipName,
          subtitle: `${cruise.sailDate} · ${cruise.destination || cruise.departurePort} · ${cruise.nights} nights`,
          score,
          owner: cruise.sourceEmail || cruise.ownerProfileId,
          actionLabel: 'View cruise',
          actionRoute: `/cruise-details?id=${encodeURIComponent(cruise.id)}`,
        });
      }
    });
  }

  if (wantsCertificates || filtersApplied.includes('all data sources')) {
    params.certificates.forEach((certificate) => {
      const haystack = [certificate.type, certificate.description, certificate.reservationNumber, certificate.expiryDate].filter(Boolean).join(' ');
      const score = scoreText(tokens, haystack) + (certificate.used ? -10 : 10);
      if (score > 0) {
        results.push({
          id: `certificate-${certificate.id}`,
          source: 'certificates',
          title: `${certificate.type} certificate`,
          subtitle: `${certificate.used ? 'Used' : 'Available'} · $${certificate.value.toLocaleString()}${certificate.expiryDate ? ` · expires ${certificate.expiryDate}` : ''}`,
          score,
          owner: certificate.sourceEmail || certificate.ownerProfileId,
          certificateFit: certificate.used ? 'already used' : 'available for review',
          actionLabel: 'Review certificate',
        });
      }
    });
  }

  if (wantsCalendar || filtersApplied.includes('all data sources')) {
    params.calendarEvents.forEach((event) => {
      const haystack = [event.title, event.description, event.location, event.type].filter(Boolean).join(' ');
      const score = scoreText(tokens, haystack) + (event.type === 'cruise' ? 8 : 0);
      if (score > 0) {
        results.push({
          id: `calendar-${event.id}`,
          source: 'calendar',
          title: event.title,
          subtitle: `${event.startDate || event.start} · ${event.location || event.type}`,
          score,
          owner: event.sourceEmail || event.ownerProfileId,
          actionLabel: 'Open calendar',
          actionRoute: '/events',
        });
      }
    });
  }

  const rankedResults = results
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  console.log('[AskMyData] Search completed:', { query: params.query, filtersApplied, resultCount: rankedResults.length });

  return {
    query: params.query,
    filtersApplied,
    results: rankedResults,
    noResultsExplanation: rankedResults.length === 0 ? 'No matching offers, cruises, certificates, or calendar items were found. Try a ship name, offer code, port, date, or certificate type.' : undefined,
  };
}

export function formatAskMyDataResponse(response: AskMyDataResponse): string {
  if (response.results.length === 0) {
    return `Ask My Data searched ${response.filtersApplied.join(', ')} for “${response.query}”. ${response.noResultsExplanation}`;
  }

  const lines = response.results.map((result, index) => {
    const owner = result.owner ? ` · owner ${result.owner}` : '';
    const offerScore = result.offerScore !== undefined ? ` · offer score ${result.offerScore}` : '';
    const certificateFit = result.certificateFit ? ` · ${result.certificateFit}` : '';
    return `${index + 1}. [${result.source}] ${result.title} — ${result.subtitle}${owner}${offerScore}${certificateFit}. Action: ${result.actionLabel}.`;
  });

  return `Ask My Data searched ${response.filtersApplied.join(', ')} for “${response.query}”.\n\n${lines.join('\n')}`;
}
